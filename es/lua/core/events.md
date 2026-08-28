---
title: "Bus de eventos"
description: "Publica y observa eventos de mejor esfuerzo del runtime y la aplicación."
---

# Bus de eventos
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="permissions"/>

El bus de eventos publica actividad del runtime y la aplicación para monitorización,
logs, métricas y efectos secundarios reactivos. Esta página es una referencia de API;
los fragmentos presuponen una entrada Lua ejecutable con el módulo y permisos indicados.

<note>
El bus de eventos es un canal publish/subscribe de mejor esfuerzo, no un transporte
fiable. No dependas de él para entregas críticas para el negocio. Usa mensajería de
procesos (`process.send`), canales o la [cola de mensajes](lua/storage/queue.md) cuando
la entrega forme parte de la corrección de la aplicación.
</note>

## Carga

```lua
local events = require("events")
```

## Suscribirse a Eventos

Suscríbete a un sistema o patrón de sistema, con un filtro opcional por tipo de evento:

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

Pasa un segundo argumento para limitar la entrega a un tipo, por ejemplo
`events.subscribe("users", "user.created")`. Si se omite, se aceptan todos los tipos
del sistema coincidente.

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `system` | string | Patrón de sistema (soporta comodines como "test.*") |
| `kind` | string | Filtro de tipo de evento (opcional) |

**Devuelve:** `Subscription, error`

## Publicar eventos

Enviar un evento al bus de eventos:

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

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `system` | string | Identificador del sistema |
| `kind` | string | Tipo/clase del evento |
| `path` | string | Ruta del evento para enrutamiento |
| `data` | any | Carga del evento (opcional) |

**Devuelve:** `boolean, error`

Un retorno correcto confirma que el runtime aceptó el envío. No confirma que algún
suscriptor haya recibido o procesado el evento.

## Métodos de Suscripción

### Obtener el Canal

Obtener el canal para recibir eventos:

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

Cada evento contiene `system`, `kind` y `path`. El campo `data` solo está presente
cuando el publicador proporcionó un payload distinto de nil.

### Cerrar Suscripción

Desuscribirse y cerrar el canal:

```lua
local closed = sub:close() -- true
```

El cierre es idempotente. Después de cerrar el canal, `receive()` devuelve
`nil, false` cuando se agotan los eventos almacenados.

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
| Falta el contexto de ejecución o proceso | `errors.INTERNAL` | no |

Consulta [Manejo de errores](lua/core/errors.md) para trabajar con errores.
