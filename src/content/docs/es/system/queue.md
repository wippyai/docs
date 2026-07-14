---
title: "Cola"
---

# Cola

Wippy proporciona un sistema de colas para procesamiento asíncrono de mensajes con drivers y consumidores configurables.

## Arquitectura

```mermaid
flowchart LR
    P[Publicador] --> D[Driver]
    D --> Q[Cola]
    Q --> C[Consumidor]
    C --> W[Pool de Workers]
    W --> F[Función]
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
| `default_message_ttl` | duration | - | TTL de mensaje por defecto aplicado a colas declaradas |
| `default_queue_ttl` | duration | - | TTL por defecto aplicado a colas declaradas |
| `default_queue_expiry` | duration | - | Expiración de cola por defecto para colas declaradas |
| `prefetch_count` | int | - | Tope de prefetch a nivel de canal |
| `frame_size` | int | - | Límite de tamaño de frame AMQP |
| `channel_max` | int | - | Máximo de canales por conexión |
| `tls` | object | - | Configuración TLS (ver abajo) |

Bloque TLS:

```yaml
  tls:
    enabled: true
    server_name: "rabbit.example.com"
    cert_env: "AMQP_CLIENT_CERT"
    key_env: "AMQP_CLIENT_KEY"
    ca_env: "AMQP_CA_CERT"
    insecure_skip_verify: false
```

Los campos inline `cert`/`key`/`ca` contienen contenido PEM; las variantes `*_env` se resuelven a través del registro env. Las dos fuentes son mutuamente excluyentes por campo. `insecure_skip_verify` desactiva la verificación de certificado (solo desarrollo).

### Driver SQS

Para AWS SQS y endpoints compatibles con SQS (LocalStack, ElasticMQ). Las credenciales, región y otras configuraciones del AWS SDK provienen de un recurso `config.aws` compartido.

```yaml
- name: aws_config
  kind: config.aws
  region: us-east-1
  access_key_id_env: app:AWS_ACCESS_KEY_ID
  secret_access_key_env: app:AWS_SECRET_ACCESS_KEY

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

Las colas son creadas automáticamente por el driver en el primer uso. Use headers con prefijo SQS (`sqs.*`) para direccionar atributos específicos de SQS al publicar; las claves neutrales como `correlation_id` y `content_type` se traducen a atributos del sistema SQS cuando es posible.

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
| `dead_letter.queue` | ID de Registro | No | ID de cola para mensajes fallidos |
| `dead_letter.max_attempts` | int | No | Intentos antes de enrutar a la DLQ |

### Opciones de Driver

Las claves bajo `driver_options` están agrupadas por nombre de driver. Un driver lee solo su propio sub-bag — las otras claves quedan inactivas, lo que permite que una sola entrada de cola declare configuraciones para múltiples drivers si es necesario.

**memory:**

| Clave | Descripción |
|-------|-------------|
| `max_length` | Tamaño de buffer acotado (0 = sin límite) |

**amqp:**

| Clave | Descripción |
|-------|-------------|
| `durable` | Sobrevive al reinicio del broker |
| `auto_delete` | Se elimina cuando el último consumidor se desconecta |
| `message_ttl` | Override de TTL de mensaje por cola |
| `queue_expiry` | Expiración de colas no utilizadas |
| `max_length` | Máximo de mensajes retenidos |

### Códecs {id="codecs"}

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
    depends_on:
      - app.queue:tasks
```

| Campo | Por Defecto | Descripción |
|-------|-------------|-------------|
| `queue` | requerido | ID de registro de la cola |
| `func` | requerido | ID de registro de la función handler |
| `concurrency` | 1 | Conteo de workers paralelos |
| `prefetch` | 10 | Tamaño del buffer por worker |
| `auto_ack` | false | Cuando es true, el runtime no llama al ack del broker; el éxito/fallo del handler es la única señal de settle |
| `driver_options` | - | Sub-bag por driver (misma estructura que la cola) |

**Opciones de consumidor amqp:**

| Clave | Descripción |
|-------|-------------|
| `exclusive` | Acceso a cola de un solo consumidor |
| `no_local` | Rechazar mensajes publicados en la misma conexión |
| `no_wait` | No esperar confirmación del broker al suscribirse |
| `consumer_tag` | Identificador para esta suscripción |

<tip>
Los consumidores respetan el contexto de llamada y pueden estar sujetos a políticas de seguridad. Configure actor y políticas a nivel de ciclo de vida. Ver <a href="system/security.md">Seguridad</a>.
</tip>

### Pool de Workers

Los workers se ejecutan como goroutines concurrentes:

```
concurrency: 3, prefetch: 10

1. El driver entrega hasta 10 mensajes al buffer
2. 3 workers extraen del buffer concurrentemente
3. A medida que los workers terminan, el buffer se rellena
4. Backpressure cuando todos los workers están ocupados y el buffer lleno
```

## Función Handler

Los handlers de consumidor reciben el cuerpo decodificado del mensaje como primer argumento. Use `queue.message()` para acceder a metadatos de entrega (id, headers).

```lua
local queue = require("queue")
local logger = require("logger")

local function main(body)
    local msg = queue.message()
    logger:info("processing", {
        id = msg:id(),
        correlation_id = msg:header("correlation_id")
    })

    local ok, err = process_task(body)
    if err then
        return false  -- nack: redelivery or DLQ
    end
    return true       -- ack: remove from queue
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

El runtime hace settle automáticamente según el retorno del handler:

| Resultado del Handler | Acción |
|-----------------------|--------|
| `true` o retorno no-`false` | Ack |
| `false` | Nack (redelivery o dead-letter según el driver) |
| Error lanzado | Nack |

Llame `msg:ack()` o `msg:nack()` explícitamente solo para hacer settle anticipado. El settlement es de un solo disparo: gana la primera llamada que llega.

### Enrutamiento Dead-Letter

Cuando `dead_letter` está configurado en la cola, un mensaje que es nack más allá de `max_attempts` es enrutado a la DLQ con los headers `x_dead_letter_reason` y `x_original_queue` establecidos por el driver. Los publicadores no deben establecer ningún header `x_*` — estos están reservados para el registro de DLQ.

## Publicando Mensajes

Desde código Lua:

```lua
local queue = require("queue")

queue.publish("app.queue:tasks", {
    id = "task-123",
    action = "process",
    data = payload
})
```

Ver [Módulo Queue](lua/storage/queue.md) para la API completa.

## Apagado Graceful

Al detener el consumidor:

1. Dejar de aceptar nuevas entregas
2. Cancelar contextos de workers
3. Esperar mensajes en vuelo (con timeout)
4. Retornar error si los workers no terminan a tiempo

## Ver También

- [Módulo Queue](lua/storage/queue.md) - Referencia de API Lua
- [Guía de Consumidores de Cola](guides/queue-consumers.md) - Patrones de consumidor y pools de workers
- [Supervisión](guides/supervision.md) - Gestión del ciclo de vida del consumidor
