# Fila

O Wippy fornece um sistema de filas para processamento assíncrono de mensagens com drivers e consumidores configuráveis.

## Arquitetura

```mermaid
flowchart LR
    P[Publisher] --> D[Driver]
    D --> Q[Queue]
    Q --> C[Consumer]
    C --> W[Worker Pool]
    W --> F[Function]
```

- **Driver** - Implementação de backend (memória, AMQP, Redis)
- **Queue** - Fila lógica vinculada a um driver
- **Consumer** - Conecta fila ao handler com configurações de concorrência
- **Worker Pool** - Processadores de mensagens concorrentes

Múltiplas filas podem compartilhar um driver. Múltiplos consumidores podem processar da mesma fila.

## Tipos de Entradas

| Tipo | Descrição |
|------|-----------|
| `queue.driver.memory` | Driver de fila em memória |
| `queue.queue` | Declaração de fila com referência ao driver |
| `queue.consumer` | Consumidor que processa mensagens |

## Configuração do Driver

### Driver de Memória

Driver em memória para desenvolvimento e testes.

```yaml
- name: memory_driver
  kind: queue.driver.memory
  lifecycle:
    auto_start: true
```

<note>
Drivers adicionais (AMQP, Redis, SQS) estão planejados. A interface de driver permite trocar backends sem mudar configuração de fila ou consumidor.
</note>

## Configuração de Fila

```yaml
- name: tasks
  kind: queue.queue
  driver: app.queue:memory_driver
```

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `driver` | ID do Registro | Sim | Referência ao driver de fila |
| `options` | Map | Não | Opções específicas do driver |

<note>
O driver de memória não tem opções de configuração. Drivers externos (AMQP, Redis, SQS) definem suas próprias opções para comportamento de fila como durabilidade, tamanho máximo e TTL.
</note>

## Configuração do Consumidor

```yaml
- name: task_consumer
  kind: queue.consumer
  queue: app.queue:tasks
  func: app.queue:task_handler
  concurrency: 4
  prefetch: 20
  lifecycle:
    auto_start: true
    depends_on:
      - app.queue:tasks
```

| Campo | Padrão | Max | Descrição |
|-------|--------|-----|-----------|
| `queue` | Obrigatório | - | ID do registro da fila |
| `func` | Obrigatório | - | ID do registro da função handler |
| `concurrency` | 1 | 1000 | Contagem de workers paralelos |
| `prefetch` | 10 | 10000 | Tamanho do buffer de mensagens |

<tip>
Consumidores respeitam contexto de chamada e podem estar sujeitos a políticas de segurança. Configure ator e políticas no nível de ciclo de vida. Veja <a href="system/security.md">Segurança</a>.
</tip>

### Pool de Workers

Workers executam como goroutines concorrentes:

```
concurrency: 3, prefetch: 10

1. Driver entrega até 10 mensagens para o buffer
2. 3 workers pegam do buffer concorrentemente
3. Conforme workers terminam, buffer reabastece
4. Contrapressão quando todos workers ocupados e buffer cheio
```

## Função Handler

Funções de consumidor recebem dados da mensagem e retornam sucesso ou erro:

```lua
local json = require("json")
local logger = require("logger")

local function handler(body)
    local data = json.decode(body)

    logger.info("Processando", {task_id = data.id})

    local result, err = process_task(data)
    if err then
        return nil, err  -- Nack: reenfileira mensagem
    end

    return result  -- Ack: remove da fila
end

return handler
```

```yaml
- name: task_handler
  kind: function.lua
  source: file://task_handler.lua
  modules:
    - json
    - logger
```

### Reconhecimento

| Resultado do Handler | Ação | Efeito |
|----------------------|------|--------|
| Valor de retorno | Ack | Mensagem removida da fila |
| Retorna erro | Nack | Mensagem reenfileirada (dependente do driver) |

## Publicando Mensagens

A partir de código Lua:

```lua
local queue = require("queue")

queue.publish("app.queue:tasks", {
    id = "task-123",
    action = "process",
    data = payload
})
```

Veja [Módulo Queue](lua/storage/queue.md) para API completa.

## Encerramento Gracioso

Ao parar consumidor:

1. Para de aceitar novas entregas
2. Cancela contextos de workers
3. Aguarda mensagens em voo (com timeout)
4. Retorna erro se workers não terminarem a tempo

## Veja Também

- [Módulo Queue](lua/storage/queue.md) - Referência da API Lua
- [Guia de Consumidores de Filas](guides/queue-consumers.md) - Padrões de consumidor e pools de workers
- [Supervisão](guides/supervision.md) - Gerenciamento de ciclo de vida do consumidor
