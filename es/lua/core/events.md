# Bus de Eventos
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="permissions"/>

Publicar y suscribirse a eventos para observabilidad — monitorear la actividad del runtime y de la aplicación y reaccionar a ella.

<note>
Usar el bus de eventos solo para observación: monitoreo, registro, métricas y efectos secundarios reactivos. Es un canal de publish/subscribe de mejor esfuerzo, no un transporte confiable — no construir lógica de negocio sobre él ni depender de él para entrega garantizada. Para mensajería crítica de negocio usar mensajería de proceso (`process.send`), canales, o la [cola de mensajes](lua/storage/queue.md).
</note>

## Carga

```lua
local events = require("events")
```

## Suscribirse a Eventos

Suscribirse a eventos del bus de eventos:

```lua
-- Suscribirse a todos los eventos de pedidos
local sub, err = events.subscribe("orders.*")
if err then
    return nil, err
end

-- Suscribirse a tipo de evento específico
local sub = events.subscribe("users", "user.created")

-- Suscribirse a todos los eventos de un sistema
local sub = events.subscribe("payments")

-- Procesar eventos
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

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `system` | string | Patrón de sistema (soporta comodines como "test.*") |
| `kind` | string | Filtro de tipo de evento (opcional) |

**Devuelve:** `Subscription, error`

## Enviar Eventos

Enviar un evento al bus de eventos:

```lua
-- Enviar evento de pedido creado
local ok, err = events.send("orders", "order.created", "/orders/123", {
    order_id = "123",
    customer_id = "456",
    total = 99.99
})
if err then
    return nil, err
end

-- Enviar evento de usuario
events.send("users", "user.registered", "/users/" .. user.id, {
    user_id = user.id,
    email = user.email,
    created_at = time.now():format("2006-01-02T15:04:05Z07:00")
})

-- Enviar evento de pago
events.send("payments", "payment.completed", "/payments/" .. payment.id, {
    payment_id = payment.id,
    order_id = payment.order_id,
    amount = payment.amount,
    method = payment.method
})

-- Enviar sin datos
events.send("system", "heartbeat", "/health")
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `system` | string | Identificador del sistema |
| `kind` | string | Tipo/clase del evento |
| `path` | string | Ruta del evento para enrutamiento |
| `data` | any | Carga del evento (opcional) |

**Devuelve:** `boolean, error`

## Métodos de Suscripción

### Obtener el Canal

Obtener el canal para recibir eventos:

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

Campos del evento: `system`, `kind`, `path`, `data`

### Cerrar Suscripción

Desuscribirse y cerrar el canal:

```lua
sub:close()
```

## Permisos

| Acción | Recurso | Descripción |
|--------|---------|-------------|
| `events.subscribe` | sistema | Suscribirse a eventos de un sistema |
| `events.send` | sistema | Enviar eventos a un sistema |

## Errores

| Condición | Tipo | Reintentable |
|-----------|------|--------------|
| Sistema vacío | `errors.INVALID` | no |
| Tipo vacío | `errors.INVALID` | no |
| Ruta vacía | `errors.INVALID` | no |
| Política denegada | `errors.INVALID` | no |

Consulte [Manejo de Errores](lua/core/errors.md) para trabajar con errores.
