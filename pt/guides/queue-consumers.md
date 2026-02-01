# Consumidores de Filas

Consumidores de filas processam mensagens de filas usando pools de workers.

## Visão Geral

```mermaid
flowchart LR
    subgraph Consumer[Consumidor]
        QD[Driver de Fila] --> DC[Canal de Entrega<br/>prefetch=10]
        DC --> WP[Pool de Workers<br/>concurrency]
        WP --> FH[Handler de Função]
        FH --> AN[Ack/Nack]
    end
```

## Configuracao

| Opcao | Padrao | Max | Descricao |
|-------|--------|-----|-----------|
| `queue` | Obrigatorio | - | ID do registro da fila |
| `func` | Obrigatorio | - | ID do registro da funcao handler |
| `concurrency` | 1 | 1000 | Quantidade de workers |
| `prefetch` | 10 | 10000 | Tamanho do buffer de mensagens |

## Definicao de Entrada

```yaml
- name: order_consumer
  kind: queue.consumer
  queue: app:orders
  func: app:process_order
  concurrency: 5
  prefetch: 20
  lifecycle:
    auto_start: true
    depends_on:
      - app:orders
```

## Funcao Handler

A funcao handler recebe o corpo da mensagem:

```lua
-- process_order.lua
local json = require("json")

local function handler(body)
    local order = json.decode(body)

    -- Processa o pedido
    local result, err = process_order(order)
    if err then
        -- Retorna erro para disparar Nack (reenfileirar)
        return nil, err
    end

    -- Sucesso dispara Ack
    return result
end

return handler
```

```yaml
- name: process_order
  kind: function.lua
  source: file://process_order.lua
  modules:
    - json
```

## Reconhecimento

| Resultado | Acao | Efeito |
|-----------|------|--------|
| Sucesso | Ack | Mensagem removida da fila |
| Erro | Nack | Mensagem reenfileirada (dependente do driver) |

## Pool de Workers

- Workers executam como goroutines concorrentes
- Cada worker processa uma mensagem por vez
- Mensagens distribuidas round-robin do canal de entrega
- Buffer de prefetch permite driver entregar antecipadamente

### Exemplo

```
concurrency: 3
prefetch: 10

Fluxo:
1. Driver entrega ate 10 mensagens para o buffer
2. 3 workers pegam do buffer concorrentemente
3. Conforme workers terminam, buffer reabastece
4. Contrapressao quando todos workers ocupados e buffer cheio
```

## Encerramento Gracioso

Ao parar:
1. Para de aceitar novas entregas
2. Cancela contextos de workers
3. Aguarda mensagens em voo (com timeout)
4. Retorna erro de timeout se workers nao terminarem

## Declaracao de Fila

```yaml
# Driver de fila (memoria para dev/teste)
- name: queue_driver
  kind: queue.driver.memory
  lifecycle:
    auto_start: true

# Definicao de fila
- name: orders
  kind: queue.queue
  driver: app:queue_driver
  options:
    queue_name: orders      # Sobrescreve nome (padrao: nome da entrada)
    max_length: 10000       # Tamanho maximo da fila
    durable: true           # Sobrevive a reinicializacoes
```

| Opcao | Descricao |
|-------|-----------|
| `queue_name` | Sobrescreve nome da fila (padrao: nome do ID da entrada) |
| `max_length` | Tamanho maximo da fila |
| `durable` | Sobrevive a reinicializacoes (dependente do driver) |

## Driver de Memoria

Fila em memoria embutida para desenvolvimento/testes:

- Tipo: `queue.driver.memory`
- Mensagens armazenadas em memoria
- Nack reenfileira mensagem no inicio da fila
- Sem persistencia entre reinicializacoes

## Veja Tambem

- [Fila de Mensagens](lua/storage/queue.md) - Referencia do modulo de filas
- [Configuracao de Filas](system/queue.md) - Drivers de fila e definicoes de entrada
- [Arvores de Supervisao](guides/supervision.md) - Ciclo de vida do consumidor
- [Gerenciamento de Processos](lua/core/process.md) - Criacao e comunicacao de processos
