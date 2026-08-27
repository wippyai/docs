---
title: "Message Queue"
description: "Publique mensagens e processe entregas de filas configuradas."
---

# Message Queue
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>
<secondary-label ref="permissions"/>

Publique e consuma mensagens de filas distribuidas. Suporta multiplos backends incluindo RabbitMQ e outros brokers compativeis com AMQP.

Para configurar a fila, veja [Fila](../../system/queue.md).

## Carregamento

```lua
local queue = require("queue")
```

## Publicando Mensagens

Enviar mensagens para uma fila por ID:

```lua
local ok, err = queue.publish("app:tasks", {
    action = "send_email",
    user_id = 456,
    template = "welcome"
})
if err then
    return nil, err
end
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `queue_id` | string | Identificador da fila (formato: "namespace:name") |
| `data` | any | Dados da mensagem (tabelas, strings, numeros, booleans) |
| `headers` | table | Headers opcionais da mensagem |

**Retorna:** `boolean, error`

### Headers de Mensagem

Headers habilitam roteamento, prioridade e rastreamento:

```lua
local ok, err = queue.publish("app:notifications", {
    type = "order_shipped",
    order_id = order.id
}, {
    priority = 5,
    correlation_id = request_id
})
if err then return nil, err end
```

## Acessando Contexto de Entrega

Dentro de um consumer de fila, acessar a mensagem atual:

```lua
local msg, err = queue.message()
if err then
    return nil, err
end

local msg_id, id_err = msg:id()
if id_err then return nil, id_err end
local priority, header_err = msg:header("priority")
if header_err then return nil, header_err end
local all_headers, headers_err = msg:headers()
if headers_err then return nil, headers_err end
```

**Retorna:** `Message, error`

Disponível apenas ao processar mensagens de fila em contexto de consumer.

## Métodos de Message

| Método | Retorna | Descrição |
|--------|---------|-----------|
| `id()` | `string, error` | Identificador único da mensagem |
| `header(key)` | `any, error` | Valor de header único (nil se ausente) |
| `headers()` | `table, error` | Todos os headers da mensagem |
| `ack()` | `boolean, error` | Confirmar processamento (single-shot) |
| `nack()` | `boolean, error` | Sinalizar falha para reentrega ou dead-letter (single-shot) |

O runtime faz auto-ack no sucesso do handler e auto-nack no erro do handler. Chame `ack`/`nack` apenas para confirmar antecipadamente.

## Informação da Fila

```lua
local stats, err = queue.info("app:tasks")
if err then return nil, err end
-- stats may contain: message_count, consumer_count, ready (driver-dependent)
```

**Retorna:** `table, error`

## Padrão de Consumer

Consumers de fila sao definidos como entry points que recebem o payload diretamente:

```yaml
- name: email_worker
  kind: queue.consumer
  queue: app:emails
  func: app:email_handler
```

```lua
local queue = require("queue")
local logger = require("logger")

local function main(payload)
    local msg, msg_err = queue.message()
    if msg_err then return nil, msg_err end

    local message_id, id_err = msg:id()
    if id_err then return nil, id_err end

    logger:info("Processing", {
        message_id = message_id,
        to = payload.to
    })

    local ok, send_err = deliver_email(payload)
    if send_err then return nil, send_err end
    return ok
end

return {main = main}
```

## Permissões

Operações de fila estao sujeitas a avaliação de política de segurança.

| Ação | Recurso | Descrição |
|------|---------|-----------|
| `queue.publish` | - | Permissão geral para publicar mensagens |
| `queue.publish.queue` | ID da Fila | Publicar em fila específica |

Ambas as permissões sao verificadas: primeiro a permissão geral, depois a específica da fila.

## Erros

| Condição | Tipo | Retentável |
|----------|------|------------|
| ID da fila vazio | `errors.INVALID` | não |
| Dados da mensagem vazios | `errors.INVALID` | não |
| Sem contexto de entrega | `errors.INVALID` | não |
| Publicação não permitida | `errors.INVALID` | não |
| Publicação falhou | `errors.INTERNAL` | não |

Veja [Tratamento de Erros](../core/errors.md) para trabalhar com erros.

## Veja Também

- [Configuração de Filas](../../system/queue.md) - Drivers de fila e definições de entrada
- [Guia de Consumidores de Fila](../../guides/queue-consumers.md) - Padrões de consumer e pools de workers
- [Gerenciamento de Processos](../core/process.md) - Criação de processos e comunicação
- [Channels](../core/channel.md) - Padrões de comunicação entre processos
- [Funções](../core/funcs.md) - Invocação de funções assíncronas
