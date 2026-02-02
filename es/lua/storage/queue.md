# Cola de Mensajes
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>
<secondary-label ref="permissions"/>

Publicar y consumir mensajes de colas distribuidas. Soporta multiples backends incluyendo RabbitMQ y otros brokers compatibles con AMQP.

Para configuración de colas, consulte [Cola](system-queue.md).

## Carga

```lua
local queue = require("queue")
```

## Publicar Mensajes

Enviar mensajes a una cola por ID:

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

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `queue_id` | string | Identificador de cola (formato: "namespace:name") |
| `data` | any | Datos del mensaje (tablas, strings, numeros, booleanos) |
| `headers` | table | Cabeceras de mensaje opcionales |

**Devuelve:** `boolean, error`

### Cabeceras de Mensaje

Las cabeceras permiten enrutamiento, prioridad y trazabilidad:

```lua
queue.publish("app:notifications", {
    type = "order_shipped",
    order_id = order.id
}, {
    priority = "high",
    correlation_id = request_id
})
```

## Acceder al Contexto de Entrega

Dentro de un consumidor de cola, acceder al mensaje actual:

```lua
local msg, err = queue.message()
if err then
    return nil, err
end

local msg_id = msg:id()
local priority = msg:header("priority")
local all_headers = msg:headers()
```

**Devuelve:** `Message, error`

Solo disponible cuando se procesan mensajes de cola en contexto de consumidor.

## Metodos de Message

| Método | Devuelve | Descripción |
|--------|----------|-------------|
| `id()` | `string, error` | Identificador único de mensaje |
| `header(key)` | `any, error` | Valor de cabecera individual (nil si falta) |
| `headers()` | `table, error` | Todas las cabeceras del mensaje |

## Patrón de Consumidor

Los consumidores de cola se definen como puntos de entrada que reciben el payload directamente:

```yaml
entries:
  - kind: queue.consumer
    id: email_worker
    queue: app:emails
    method: handle_email
```

```lua
function handle_email(payload)
    local msg = queue.message()

    logger:info("Processing", {
        message_id = msg:id(),
        to = payload.to
    })

    local ok, err = email.send(payload.to, payload.template, payload.data)
    if err then
        return nil, err  -- El mensaje sera reencolado o enviado a dead-letter
    end
end
```

## Permisos

Las operaciones de cola estan sujetas a evaluacion de politica de seguridad.

| Accion | Recurso | Descripción |
|--------|---------|-------------|
| `queue.publish` | - | Permiso general para publicar mensajes |
| `queue.publish.queue` | ID de Cola | Publicar a cola especifica |

Ambos permisos se verifican: primero el permiso general, luego el específico de cola.

## Errores

| Condición | Tipo | Reintentable |
|-----------|------|--------------|
| ID de cola vacio | `errors.INVALID` | no |
| Datos de mensaje vacios | `errors.INVALID` | no |
| Sin contexto de entrega | `errors.INVALID` | no |
| Permiso denegado | `errors.PERMISSION_DENIED` | no |
| Publicacion fallida | `errors.INTERNAL` | si |

Consulte [Manejo de Errores](lua/core/errors.md) para trabajar con errores.

## Vea También

- [Configuración de Cola](system/queue.md) - Drivers de cola y definiciones de entrada
- [Guia de Consumidores de Cola](guides/queue-consumers.md) - Patrones de consumidor y pools de workers
- [Gestión de Procesos](lua/core/process.md) - Creacion y comunicación de procesos
- [Canales](lua/core/channel.md) - Patrones de comunicación entre procesos
- [Funciones](lua/core/funcs.md) - Invocacion asincrona de funciones
