# Event Bus
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="permissions"/>

Publique e inscreva-se em eventos em toda sua aplicação para arquiteturas orientadas a eventos.

## Carregamento

```lua
local events = require("events")
```

## Inscrevendo-se em Eventos

Inscreva-se em eventos do event bus:

```lua
-- Inscreva-se em todos os eventos de pedidos
local sub, err = events.subscribe("orders.*")
if err then
    return nil, err
end

-- Inscreva-se em tipo de evento específico
local sub = events.subscribe("users", "user.created")

-- Inscrever em todos os eventos de um sistema
local sub = events.subscribe("payments")

-- Processar eventos
local ch = sub:channel()
while true do
    local evt, ok = ch:receive()
    if not ok then break end

    logger:info("Received event", {
        system = evt.system,
        kind = evt.kind,
        path = evt.path
    })
    handle_event(evt)
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
-- Enviar evento de pedido criado
local ok, err = events.send("orders", "order.created", "/orders/123", {
    order_id = "123",
    customer_id = "456",
    total = 99.99
})
if err then
    return nil, err
end

-- Enviar evento de usuário
events.send("users", "user.registered", "/users/" .. user.id, {
    user_id = user.id,
    email = user.email,
    created_at = time.now():format("2006-01-02T15:04:05Z07:00")
})

-- Enviar evento de pagamento
events.send("payments", "payment.completed", "/payments/" .. payment.id, {
    payment_id = payment.id,
    order_id = payment.order_id,
    amount = payment.amount,
    method = payment.method
})

-- Enviar sem dados
events.send("system", "heartbeat", "/health")
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
local ch = sub:channel()

local evt, ok = ch:receive()
if ok then
    print("System:", evt.system)
    print("Kind:", evt.kind)
    print("Path:", evt.path)
    print("Data:", json.encode(evt.data))
end
```

Campos do evento: `system`, `kind`, `path`, `data`

### Fechando Subscription

Cancelar inscrição e fechar o channel:

```lua
sub:close()
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

Veja [Error Handling](lua/core/errors.md) para trabalhar com erros.

