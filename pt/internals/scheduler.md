---
title: "Scheduler"
description: "Como o Wippy agenda processos, roteia eventos, gerencia filas de workers e encerra processos."
---

# Scheduler

O scheduler executa processos em workers com deques locais, filas de injeção, uma fila global e work stealing.

Esta é uma referência de implementação. As estruturas Go e os diagramas descrevem o scheduler da versão fixada do runtime, e não APIs implementadas pelo código da aplicação.

## Interface Process

O scheduler trabalha com qualquer tipo que implemente a interface `Process`:

```go
type Process interface {
    Init(ctx context.Context, method string, input payload.Payloads) error
    Step(events []Event, out *StepOutput) error
    Close()
}
```

| Método | Propósito |
|--------|-----------|
| `Init` | Preparar processo com nome do método de entrada e argumentos de entrada |
| `Step` | Avançar máquina de estado com eventos de entrada, escrever yields na saída |
| `Close` | Liberar recursos |

O parâmetro `method` de `Init` especifica qual ponto de entrada invocar. Uma instância de processo pode expor vários pontos de entrada, e o chamador escolhe qual executar.

O scheduler chama `Step()` repetidamente, passando eventos (completações de yield, mensagens) e coletando yields (comandos para despachar). O processo escreve seu status e quaisquer yields no buffer `StepOutput`.

```go
type Event struct {
    Type  EventType  // EventYieldComplete or EventMessage
    Tag   uint64     // Correlation tag for yield completions
    Data  any        // Result data or message payload
    Error error      // Error if yield failed
}
```

## Estrutura

O scheduler cria `GOMAXPROCS` workers por padrão. Cada worker possui um deque local para acesso LIFO eficiente em cache e uma fila de injeção MPSC por worker para trabalhos reenfileirados que têm afinidade com ele, incluindo conclusões de yield e ativações por mensagem. Uma fila FIFO global recebe novas submissões e reenfileiramentos sem afinidade. Os processos são rastreados por PID para o roteamento de mensagens.

## Busca de Trabalho

```mermaid
flowchart TD
    W[Worker needs work] --> L{Local deque?}
    L -->|has items| LP[Pop from bottom LIFO]
    L -->|empty| I{Inject queue?}
    I -->|has items| IP[Pop + drain up to 16 to local]
    I -->|empty| G{Global queue?}
    G -->|has items| GP[Pop + batch transfer up to 16]
    G -->|empty| S[Scan other workers from rotating start]
    S --> SH[Steal up to half, capped at 32]
```

Workers verificam fontes em ordem de prioridade:

| Prioridade | Fonte | Padrão |
|------------|-------|--------|
| 1 | Deque local | LIFO pop, sem lock, amigável ao cache |
| 2 | Fila de injeção | Pop MPSC de eventos e reenfileiramentos com afinidade; drena até 16 para o deque local |
| 3 | Fila global | Pop FIFO com transferência em lote |
| 4 | Outros workers | Varredura a partir de um índice inicial rotativo; rouba até metade, limitado a 32 itens por tentativa |

Ao retirar um item da fila de injeção ou da fila global, o worker pega esse item e move até 16 adicionais para seu deque local.

## Deque Chase-Lev

Cada worker possui um deque de work-stealing Chase-Lev:

```go
type Deque struct {
    buffer atomic.Pointer[dequeBuffer]
    top    atomic.Int64  // Thieves steal from here (CAS)
    bottom atomic.Int64  // Owner pushes/pops here
}
```

O proprietário insere e remove itens pelo fundo (LIFO) sem mutex; a remoção do último item usa CAS para coordenar com os workers que tentam roubá-lo. Esses workers roubam pelo topo (FIFO) usando CAS. Isso dá ao proprietário acesso eficiente em cache aos itens inseridos recentemente e distribui o trabalho mais antigo entre os demais workers.

`StealHalfInto` retira até metade dos itens disponíveis em uma operação CAS, limitado pelo buffer de destino. As tentativas de roubo dos workers usam um buffer de 32 itens.

## Spinning Adaptativo

Antes de bloquear na variável de condição, workers fazem spinning adaptativo:

| Contagem de Spin | Ação |
|------------------|------|
| < 4 | Loop apertado |
| 4-15 | Cede a thread (`runtime.Gosched`) |
| >= 16 | Bloquear na variável de condição |

## Estados de Processo

```mermaid
stateDiagram-v2
    [*] --> Ready: Submit
    Ready --> Running: CAS by worker
    Running --> Complete: done
    Running --> Blocked: yields commands
    Running --> Idle: waiting for messages
    Blocked --> Ready: CompleteYield
    Idle --> Ready: Send arrives
```

| Estado | Descrição |
|--------|-----------|
| Ready | Enfileirado para execução |
| Running | Worker está executando Step() |
| Blocked | Aguardando completação de yield |
| Idle | Aguardando mensagens |
| Complete | Execução finalizada |

Uma flag de wakeup trata corridas: se um handler chama `CompleteYield` enquanto o worker ainda possui o processo (Running), ele define a flag. O worker verifica a flag após despachar e re-enfileira se definida.

## Fila de Eventos

Cada processo tem uma fila de eventos MPSC (multi-producer, single-consumer):

- **Produtores**: Handlers de comando (`CompleteYield`), remetentes de mensagem (`Send`)
- **Consumidor**: Worker drena eventos em `Step()`

## Roteamento de Mensagens

O scheduler implementa `relay.Receiver` para rotear mensagens aos processos. Quando `Send()` é chamado, ele procura o PID de destino no mapa `byPID`, insere a mensagem como evento na fila do processo e o acorda se estiver idle ou blocked. O reenfileiramento usa injectOrGlobal: quando o processo tem afinidade conhecida, ele é inserido na fila de injeção do último worker; caso contrário, volta para a fila global.

## Encerramento :id=shutdown

Durante o encerramento, o scheduler envia eventos de cancelamento a todos os processos rastreados e aguarda que terminem ou que o timeout expire. Os workers saem quando não há mais trabalho.

## Consulte também

- [Despacho de comandos](internals/dispatch.md) — Como os yields chegam aos handlers
- [Modelo de processos](concepts/process-model.md) — Conceitos de alto nível
