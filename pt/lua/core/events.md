---
title: "Event Bus"
description: "Publique e observe eventos best-effort do runtime e da aplicação."
---

# Event Bus
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="permissions"/>

Publique e inscreva-se em eventos para observabilidade — monitoramento de atividade do runtime e da aplicação e reação a ela.

<note>
Use o event bus apenas para observação: monitoramento, logging, métricas e efeitos colaterais reativos. É um canal publish/subscribe de melhor esforço, não um transporte confiável — não construa lógica de negócio sobre ele nem dependa dele para entrega garantida. Para mensagens críticas de negócio, use mensagens de processo (`process.send`), channels ou a [fila de mensagens](../storage/queue.md).
</note>

## Carregamento

```lua
local events = require("events")
```

## Inscrevendo-se em Eventos

Inscreva-se em eventos do event bus:

```lua
-- Subscribe to all order events
local sub, err = events.subscribe("orders.*")
if err then
    return nil, err
end

-- Process events
local ch = sub:channel()
while true do
    local evt, ok = ch:receive()
    if not ok then break end

    print(evt.system, evt.kind, evt.path)
    -- Process evt.data when the publisher supplied a payload.
end
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `system` | string | Padrão do sistema (suporta wildcards como "test.*") |
| `kind` | string | Filtro de tipo de evento (opcional) |

**Retorna:** `Subscription, error`

## Enviando Eventos

Enviar um evento para o event bus:

```lua
-- Send order created event
local ok, err = events.send("orders", "order.created", "/orders/123", {
    order_id = "123",
    customer_id = "456",
    total = 99.99
})
if err then
    return nil, err
end

-- Send without data
local heartbeat_sent, heartbeat_err = events.send("system", "heartbeat", "/health")
if heartbeat_err then
    return nil, heartbeat_err
end
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `system` | string | Identificador do sistema |
| `kind` | string | Tipo do evento |
| `path` | string | Caminho do evento para roteamento |
| `data` | any | Payload do evento (opcional) |

**Retorna:** `boolean, error`

## Métodos de Subscription

### Obtendo o Channel

Obter o channel para receber eventos:

```lua
local json = require("json")
local ch = sub:channel()

local evt, ok = ch:receive()
if ok then
    print("System:", evt.system)
    print("Kind:", evt.kind)
    print("Path:", evt.path)
    local encoded, encode_err = json.encode(evt.data)
    if encode_err then return nil, encode_err end
    print("Data:", encoded)
end
```

Campos do evento: `system`, `kind`, `path`, `data`

### Fechando Subscription

Cancelar inscrição e fechar o channel:

```lua
local closed = sub:close() -- true
```

## Permissões

| Ação | Recurso | Descrição |
|------|---------|-----------|
| `events.subscribe` | sistema | Inscrever-se em eventos de um sistema |
| `events.send` | sistema | Enviar eventos para um sistema |

## Erros

| Condição | Tipo | Retentável |
|----------|------|------------|
| Sistema vazio | `errors.INVALID` | não |
| Tipo vazio | `errors.INVALID` | não |
| Caminho vazio | `errors.INVALID` | não |
| Política negou | `errors.INVALID` | não |

Veja [Tratamento de Erros](./errors.md) para trabalhar com erros.
