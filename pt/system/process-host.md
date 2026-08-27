---
title: "Host de processos"
description: "Hosts de processos gerenciam a execução de processos Lua e WebAssembly com um agendador de work stealing."
---

# Host de processos

Um `process.host` executa processos Lua e WebAssembly em um agendador de work stealing. Esta página é uma referência de configuração e ciclo de vida; o bloco YAML é um fragmento de entrada.

<note>
Cada host agenda processos de forma independente. A carga não é distribuída automaticamente entre hosts.
</note>

## Tipo de entrada

| Tipo | Descrição |
|------|-------------|
| `process.host` | Host de execução de processos com agendador |

## Configuração

```yaml
- name: main_host
  kind: process.host
  host:
    workers: 8
    queue_size: 1024
    local_queue_size: 256
  lifecycle:
    auto_start: true
```

| Campo | Tipo | Padrão | Descrição |
|-------|------|---------|-------------|
| `workers` | int | NumCPU | Goroutines de trabalho |
| `queue_size` | int | 1024 | Capacidade inicial da fila global |
| `local_queue_size` | int | 256 | Capacidade inicial do deque local de cada worker |

As duas filas crescem quando sua capacidade inicial se esgota. Os valores devem ser positivos após a aplicação dos padrões. A fila global limita sua capacidade inicial efetiva a pelo menos 16; cada deque local arredonda a capacidade para a potência de dois seguinte.

## Ciclo de vida

Um host de processos é um serviço gerenciado pelo supervisor. `lifecycle.auto_start` usa `false` por padrão; um host que ainda não iniciou rejeita a criação de processos. Os campos de ciclo de vida padrão também se aplicam, incluindo `requires`, `startup`, `start_timeout`, `stop_timeout`, `stable_threshold`, `restart` e `security`.

Parar um host é terminal para essa instância. O agendador envia um evento de cancelamento a cada processo, espera que eles terminem até o contexto de parada expirar e então cancela e fecha os processos restantes.

Atualizações em tempo real podem redimensionar `host.workers`. Alterações nos tamanhos das filas ou na configuração do ciclo de vida são rejeitadas e exigem a substituição do host. Quando a afinidade de CPU gerencia o conjunto de workers, a quantidade de workers também não pode ser alterada em tempo real.

## Agendador

O agendador usa work stealing: cada worker tem um deque local, e workers ociosos roubam tarefas da fila global ou de outros workers. Isso equilibra a carga automaticamente.

- **Workers** executam processos simultaneamente.
- **Fila global** mantém processos pendentes quando todos os workers estão ocupados.
- **Filas locais** reduzem a contenção mantendo o trabalho próximo aos workers.

## Tipos de processos

Hosts de processos executam entradas destes tipos:

| Tipo | Descrição |
|------|-------------|
| `process.lua` | Processo Lua baseado em código-fonte |
| `process.lua.bc` | Bytecode Lua pré-compilado |
| `process.wasm` | Processo WebAssembly (experimental) |

Os processos são executados de forma independente, cada um com seu próprio contexto de frame, e se comunicam por mensagens. A segurança configurada na entrada do processo é aplicada ao frame antes da execução. Monitores, links e supervisores da aplicação podem reagir a falhas; o host de processos não reinicia automaticamente todos os processos que falham.

## Veja também

- [Módulo Process](../lua/core/process.md) - Crie e gerencie processos em Lua
- [Processos WASM](../wasm/processes.md) - Configure entradas `process.wasm`
- [Modelo de processos](../concepts/process-model.md) - Conceitos de ciclo de vida e supervisão
- [Supervisão](../guides/supervision.md) - Construa árvores de supervisão
