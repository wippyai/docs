---
title: "Cola de mensajes"
description: "Publica mensajes y procesa entregas de colas configuradas."
---

# Cola de mensajes
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>
<secondary-label ref="permissions"/>

El módulo `queue` publica mensajes y procesa entregas de colas distribuidas configuradas, incluidas RabbitMQ y otros brokers compatibles con AMQP.

Esta página es una referencia de API. Los fragmentos de publicación presuponen que las entradas de cola y los permisos ya existen. La sección de consumidor es una receta parcial para un handler invocado por `queue.consumer`; no es un despliegue de cola independiente.

Para configurar colas, consulta [Cola](system/queue.md).

## Carga

```lua
local queue = require("queue")
```

## Publicación de mensajes

Publica un mensaje en una cola por su ID:

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
| `data` | any | Datos del mensaje (tablas, cadenas, números, booleanos) |
| `headers` | table | Cabeceras de mensaje opcionales |

**Devuelve:** `boolean, error`

### Cabeceras de mensajes

Las cabeceras transportan metadatos de enrutamiento, prioridad y trazabilidad. Las claves deben ser cadenas y los valores del publicador pueden ser cadenas, enteros, números o booleanos:

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

Los consumidores reciben todos los valores de cabecera como cadenas. Las claves `x_original_queue`, `x_dead_letter_reason`, `x_dead_letter_time` y `attempts` están reservadas para la gestión de entregas y dead letters, y los publicadores no deben establecerlas.

## Acceso al contexto de entrega

Accede a la entrega actual desde un consumidor de cola:

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

**Devuelve:** `Message, error`

Esta función solo está disponible mientras un consumidor de cola procesa un mensaje.

## Métodos de Message

| Método | Devuelve | Descripción |
|--------|----------|-------------|
| `id()` | `string, error` | Identificador único de mensaje |
| `header(key)` | `string?, error` | Valor normalizado como cadena, o nil si falta |
| `headers()` | `{[string]: string}, error` | Todas las cabeceras con valores normalizados como cadenas |
| `ack()` | `boolean, error` | Confirmar procesamiento (single-shot) |
| `nack()` | `boolean, error` | Señalar fallo para reentrega o dead-letter (single-shot) |

El runtime ejecuta auto-ack cuando el handler termina correctamente y auto-nack cuando termina con error. Llama a `ack`/`nack` solo para liquidar la entrega antes. La liquidación solo puede hacerse una vez y un `Message` deja de ser válido cuando retorna su handler de consumidor.

## Información de la cola

```lua
local stats, err = queue.info("app:tasks")
if err then return nil, err end
-- stats may contain: message_count, consumer_count, ready (driver-dependent)
```

**Devuelve:** `table, error`

## Patrón de consumidor

Una entrada `queue.consumer` vincula una cola al handler indicado por `func`. El handler recibe directamente el payload del mensaje:

```yaml
- name: email_worker
  kind: queue.consumer
  queue: app:emails
  func: app:email_handler
```

Este fragmento presupone que ya existen `app:emails` y la entrada de función `app:email_handler`. El código de función siguiente presupone que la aplicación proporciona `deliver_email(payload)` y concede los permisos que necesite.

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

Devolver un error de invocación hace que el consumidor ejecute nack sobre la entrega no liquidada. La reentrega sigue entonces el comportamiento del driver seleccionado; la configuración de dead letters integrada no se aplica en esta versión.

## Permisos

La evaluación de políticas de seguridad se aplica a las operaciones de cola.

| Acción | Recurso | Descripción |
|--------|---------|-------------|
| `queue.publish` | - | Permiso general para publicar mensajes |
| `queue.publish.queue` | ID de cola | Publicar en una cola específica |

Ambos permisos se verifican: primero el permiso general, luego el específico de cola.

## Errores

| Condición | Clase | Reintentable |
|-----------|------|--------------|
| ID de cola vacío | `errors.INVALID` | no |
| Falta el argumento de mensaje o es una tabla vacía | `errors.INVALID` | no |
| Sin contexto de entrega | `errors.INVALID` | no |
| Mensaje liberado o ya liquidado | `errors.INVALID` | no |
| Publicación no permitida | `errors.INVALID` | no |
| Error de publicación | `errors.INTERNAL` | no |
| No se encontró la cola o el driver para `info` | `errors.INTERNAL` | no |

Consulta [Manejo de errores](lua/core/errors.md) para trabajar con errores.

## Véase también

- [Configuración de colas](system/queue.md) - Drivers de cola y definiciones de entradas
- [Guía de consumidores de cola](guides/queue-consumers.md) - Patrones de consumidor y pools de workers
- [Gestión de procesos](lua/core/process.md) - Creación y comunicación de procesos
- [Canales](lua/core/channel.md) - Patrones de comunicación entre procesos
- [Funciones](lua/core/funcs.md) - Invocación asíncrona de funciones
