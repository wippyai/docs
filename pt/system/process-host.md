# Host de Processos

Hosts de processos gerenciam a execucao de processos Lua usando um agendador de roubo de trabalho.

<note>
Cada host agenda processos independentemente. A carga nao e distribuida entre hosts automaticamente.
</note>

## Tipo de Entrada

| Tipo | Descricao |
|------|-----------|
| `process.host` | Host de execucao de processos com agendador |

## Configuracao

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

| Campo | Tipo | Padrao | Descricao |
|-------|------|--------|-----------|
| `workers` | int | NumCPU | Goroutines workers |
| `queue_size` | int | 1024 | Capacidade da fila global |
| `local_queue_size` | int | 256 | Tamanho do deque local por worker |

## Agendador

O agendador usa roubo de trabalho: cada worker tem um deque local, e workers ociosos roubam da fila global ou de outros workers. Isso balanceia a carga automaticamente.

- **Workers** executam processos concorrentemente
- **Fila global** armazena processos pendentes quando todos os workers estao ocupados
- **Filas locais** reduzem contencao mantendo trabalho proximo aos workers

## Tipos de Processos

Hosts de processos executam entradas destes tipos:

| Tipo | Descricao |
|------|-----------|
| `lua.process` | Processo Lua baseado em codigo fonte |
| `lua.process.bytecode` | Bytecode Lua pre-compilado |

<note>
Tipos de processos adicionais estao planejados para releases futuros.
</note>

Processos executam independentemente com seu proprio contexto, comunicam via mensagens, e sao supervisionados para tolerancia a falhas.
