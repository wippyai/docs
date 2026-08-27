---
title: "Cola"
description: "Configure drivers de cola en memoria, AMQP o SQS, colas lógicas, consumidores, reconocimientos y publicación."
---

# Cola

El sistema de colas conecta publicadores de mensajes asíncronos, drivers, colas, consumidores y funciones handler.

Esta página es una referencia de configuración y comportamiento. Los fences YAML son fragmentos para una lista de entradas existente salvo cuando muestran un documento completo; los ejemplos de drivers externos presuponen que ya existe el broker o servicio compatible con AWS.

## Arquitectura

```mermaid
flowchart LR
    P[Publisher] --> D[Driver]
    D --> Q[Queue]
    Q --> C[Consumer]
    C --> W[Worker Pool]
    W --> F[Function]
```

- **Driver** - Implementación de backend (memory, AMQP, SQS)
- **Cola** - Cola lógica vinculada a un driver
- **Consumidor** - Conecta cola a handler con configuración de concurrencia
- **Pool de Workers** - Procesadores de mensajes concurrentes

Múltiples colas pueden compartir un driver. Múltiples consumidores pueden procesar de la misma cola.

## Tipos de Entrada

| Tipo | Descripción |
|------|-------------|
| `queue.driver.memory` | Driver de cola en memoria |
| `queue.driver.amqp` | Driver AMQP (RabbitMQ) |
| `queue.driver.sqs` | Driver AWS SQS (también LocalStack, ElasticMQ) |
| `queue.queue` | Declaración de cola con referencia a driver |
| `queue.consumer` | Consumidor que procesa mensajes |

## Configuración de Driver

### Driver de Memoria

Driver in-process para desarrollo y despliegues de un solo nodo. Sin dependencias externas.

```yaml
- name: memory_driver
  kind: queue.driver.memory
  lifecycle:
    auto_start: true
```

### Driver AMQP

Para RabbitMQ y brokers compatibles con AMQP 0-9-1.

```yaml
- name: amqp_driver
  kind: queue.driver.amqp
  url: "amqp://guest:guest@localhost:5672/"
  vhost: "/"
  connection_name: "wippy-service"
  heartbeat: "10s"
  connection_timeout: "30s"
  reconnect_delay: "1s"
  reconnect_max_delay: "30s"
  default_message_ttl: "1h"
  default_queue_expiry: "24h"
  prefetch_count: 10
  lifecycle:
    auto_start: true
```

| Campo | Tipo | Por Defecto | Descripción |
|-------|------|-------------|-------------|
| `url` | string | `amqp://guest:guest@localhost:5672/` | URL del broker |
| `vhost` | string | - | Override de virtual host |
| `connection_name` | string | - | Identificador mostrado en la UI del broker |
| `auth_mechanism` | string | `PLAIN` | `PLAIN`, `EXTERNAL` (mTLS), o `AMQPLAIN` |
| `heartbeat` | duration | - | Intervalo de keep-alive |
| `connection_timeout` | duration | - | Timeout de conexión |
| `reconnect_delay` | duration | `1s` | Backoff inicial de reconexión |
| `reconnect_max_delay` | duration | `30s` | Backoff máximo de reconexión |
| `default_message_ttl` | duration | - | Expiración por mensaje usada cuando el publicador no establece una |
| `default_queue_ttl` | duration | - | TTL predeterminado de mensajes a nivel de cola (`x-message-ttl`) |
| `default_queue_expiry` | duration | - | Expiración predeterminada de colas sin usar (`x-expires`) |
| `prefetch_count` | int | - | Tope de prefetch a nivel de canal |
| `frame_size` | int | - | Límite de tamaño de frame AMQP |
| `channel_max` | int | - | Máximo de canales por conexión |
| `tls` | object | - | Configuración TLS (ver abajo) |

Configure TLS bajo `tls`:

```yaml
  tls:
    enabled: true
    server_name: "rabbit.example.com"
    cert: ${env:app.env:amqp_cert}
    key:  ${env:app.env:amqp_key}
    ca:   ${env:app.env:amqp_ca}
    insecure_skip_verify: false
```

`cert`/`key`/`ca` contienen datos PEM: en línea, mediante `file://` o mediante un marcador `${env:NAME}` resuelto a través del [registro de entorno](./env.md). `insecure_skip_verify` deshabilita la verificación del certificado (solo para desarrollo). Las directivas heredadas `cert_env`/`key_env`/`ca_env` también consultan el registro de entorno, pero conservan un valor en línea o cero cuando la consulta está ausente o vacía; los marcadores modernos sin valor predeterminado fallan si falta la variable. Las directivas heredadas están obsoletas.

### Driver SQS

Para AWS SQS y endpoints compatibles con SQS (LocalStack, ElasticMQ). Las credenciales, región y otras configuraciones del AWS SDK provienen de un recurso `config.aws` compartido.

```yaml
- name: aws_config
  kind: config.aws
  region: us-east-1
  access_key_id: ${env:app:AWS_ACCESS_KEY_ID}
  secret_access_key: ${env:app:AWS_SECRET_ACCESS_KEY}

- name: sqs_driver
  kind: queue.driver.sqs
  config: app:aws_config
  endpoint: "http://localhost:9324"
  message_retention_period: 345600
  default_delay_seconds: 0
  lifecycle:
    auto_start: true
```

| Campo | Tipo | Por Defecto | Descripción |
|-------|------|-------------|-------------|
| `config` | ID de Registro | requerido | Recurso `config.aws` que provee región y credenciales |
| `endpoint` | string | - | URL de endpoint personalizado (LocalStack, ElasticMQ); omitir para AWS real |
| `message_retention_period` | int | `345600` (4d) | Retención a nivel de cola en segundos (60–1209600) |
| `default_delay_seconds` | int | `0` | Retardo de entrega por defecto aplicado en CreateQueue (0–900) |
| `disable_message_checksum_validation` | bool | `false` | Desactiva verificación de checksum de mensajes SQS al enviar/recibir |
| `use_fips` | bool | `false` | Usar endpoints conformes a FIPS |
| `use_dual_stack` | bool | `false` | Usar endpoints dual-stack (IPv4 + IPv6) |

El driver crea las colas automáticamente en el primer uso. Use cabeceras con prefijo SQS para indicar campos propios de SQS al publicar: `sqs.delay_seconds`, `sqs.message_group_id` y `sqs.message_deduplication_id` se convierten en campos tipados de mensajes SQS. Todas las demás cabeceras (claves neutrales como `correlation_id` y `content_type`, además de cualquier clave `sqs.message_attributes.*`) se conservan literalmente como atributos de mensaje SQS.

## Configuración de Cola

```yaml
- name: tasks
  kind: queue.queue
  driver: app.queue:memory_driver
  codec: json/plain
  queue_name: "app_tasks"
  driver_options:
    memory:
      max_length: 500
  dead_letter:
    queue: app.queue:tasks_dlq
    max_attempts: 5
```

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `driver` | ID de Registro | Sí | Driver de cola |
| `codec` | string | No | Codificación de transporte para los cuerpos de mensaje. Por defecto `json/plain` (ver [Códecs](#codecs)) |
| `queue_name` | string | No | Nombre externo de cola (por defecto el nombre de entrada) |
| `driver_options` | object | No | Sub-bag por driver, indexado por kind del driver |
| `dead_letter.queue` | ID de Registro | No | ID de cola para mensajes fallidos (se acepta, pero ningún driver incorporado lo aplica todavía) |
| `dead_letter.max_attempts` | int | No | Intentos antes de enrutar a la DLQ (se acepta, pero ningún driver incorporado lo aplica todavía) |

### Opciones de Driver

Las claves bajo `driver_options` están agrupadas por nombre de driver. Un driver lee solo su propio sub-bag — las otras claves quedan inactivas, lo que permite que una sola entrada de cola declare configuraciones para múltiples drivers si es necesario.

**memory:**

| Clave | Descripción |
|-------|-------------|
| `max_length` | Tamaño del buffer acotado (0 o ausente = valor predeterminado 1000) |

**amqp:**

| Clave | Descripción |
|-------|-------------|
| `durable` | Sobrevive al reinicio del broker |
| `auto_delete` | Se elimina cuando el último consumidor se desconecta |
| `message_ttl` | Override de TTL de mensaje por cola |
| `queue_expiry` | Expiración de colas no utilizadas |
| `max_length` | Máximo de mensajes retenidos |

### Códecs {#codecs}

El `codec` selecciona cómo se serializa el cuerpo de un mensaje antes de entregarlo al broker. Es una cadena de formato de payload y por defecto es `json/plain`:

| Códec | Formato |
|-------|---------|
| `json/plain` | JSON (por defecto) |
| `application/msgpack` | MessagePack |

El driver AMQP establece un `content-type` correspondiente (`application/json` o `application/msgpack`) en los mensajes publicados. Un códec desconocido falla al declarar la cola, no al publicar.

## Configuración de Consumidor

```yaml
- name: task_consumer
  kind: queue.consumer
  queue: app.queue:tasks
  func: app.queue:task_handler
  concurrency: 4
  prefetch: 20
  auto_ack: false
  driver_options:
    amqp:
      consumer_tag: "worker-1"
      exclusive: false
  lifecycle:
    auto_start: true
    requires:
      - app.queue:tasks
```

| Campo | Por Defecto | Descripción |
|-------|-------------|-------------|
| `queue` | requerido | ID de registro de la cola |
| `func` | requerido | ID de registro de la función handler |
| `concurrency` | 1 | Conteo de workers paralelos |
| `prefetch` | 10 | Tamaño compartido del buffer de entregas; AMQP también lo aplica como recuento de prefetch QoS del canal |
| `auto_ack` | false | Opción de auto-ack propia del backend; en AMQP, `true` pide al broker que confirme al entregar |
| `driver_options` | - | Sub-bag por driver (misma estructura que la cola) |

**Opciones de consumidor amqp:**

| Clave | Descripción |
|-------|-------------|
| `exclusive` | Acceso a cola de un solo consumidor |
| `no_local` | Rechazar mensajes publicados en la misma conexión |
| `no_wait` | No esperar confirmación del broker al suscribirse |
| `consumer_tag` | Identificador para esta suscripción |

<tip>
Los consumidores respetan el contexto de llamada y pueden estar sujetos a políticas de seguridad. Configure el actor y las políticas a nivel de lifecycle. Consulte <a href="./security.md">Seguridad</a>.
</tip>

### Pool de Workers

Los workers se ejecutan de forma concurrente:

```
concurrency: 3, prefetch: 10

1. Driver delivers up to 10 messages to the shared buffer
2. 3 workers pull from the buffer and can each hold an active delivery
3. As workers finish, buffer refills
4. Backpressure when all workers busy and buffer full
```

## Función Handler

Los handlers de consumidor reciben el cuerpo decodificado del mensaje como primer argumento. Use `queue.message()` para acceder a metadatos de entrega (id, headers).

```lua
local queue = require("queue")
local logger = require("logger")

local function main(body)
    local msg, msg_err = queue.message()
    if msg_err then return nil, msg_err end
    local message_id, id_err = msg:id()
    if id_err then return nil, id_err end
    local correlation_id, header_err = msg:header("correlation_id")
    if header_err then return nil, header_err end

    logger:info("processing", {
        id = message_id,
        correlation_id = correlation_id
    })

    local _, task_err = process_task(body)
    if task_err then return nil, task_err end
    return true
end

return { main = main }
```

```yaml
- name: task_handler
  kind: function.lua
  source: file://task_handler.lua
  method: main
  modules:
    - queue
    - logger
```

### Reconocimiento

Salvo que el handler resuelva explícitamente el mensaje, el consumidor lo resuelve según el resultado de la invocación de la función:

| Resultado del Handler | Acción |
|-----------------------|--------|
| Finaliza sin error de invocación | Ack |
| Devuelve o lanza un error de invocación | Nack (redelivery según el driver) |

Los valores de retorno normales, incluido `false`, no seleccionan el comportamiento de reconocimiento. Llame a `msg:ack()` o `msg:nack()` para resolver el mensaje explícitamente. La resolución es de un solo disparo: gana la primera llamada que llega.

### Enrutamiento Dead-Letter

El enrutamiento dead-letter aún no está implementado. El bloque `dead_letter` (consulte [Configuración de cola](#configuración-de-cola)) se acepta en la configuración, pero ningún driver incorporado cuenta actualmente los intentos, enruta mensajes con nack a la DLQ configurada ni establece cabeceras `x_dead_letter_*`. Un mensaje con nack se vuelve a entregar según la política del propio driver. El namespace de cabeceras `x_*` se reserva para un futuro registro de DLQ, por lo que los publicadores deben evitar establecer cabeceras `x_*`.

## Publicando Mensajes

Desde código Lua:

```lua
local queue = require("queue")

local published, publish_err = queue.publish("app.queue:tasks", {
    id = "task-123",
    action = "process",
    data = payload
})
if publish_err then return nil, publish_err end
return published
```

Consulte el [módulo Queue](../lua/storage/queue.md) para la API Lua de publicación y mensajes.

## Apagado Graceful

Al detener el consumidor:

1. Dejar de aceptar nuevas entregas
2. Cancelar contextos de workers
3. Esperar mensajes en vuelo (con timeout)
4. Retornar error si los workers no terminan a tiempo

## Ver También

- [Módulo Queue](../lua/storage/queue.md) - Referencia de API Lua
- [Guía de consumidores de cola](../guides/queue-consumers.md) - Patrones de consumidor y pools de workers
- [Supervisión](../guides/supervision.md) - Gestión del lifecycle del consumidor
