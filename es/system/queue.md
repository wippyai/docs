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

- **Driver** - Implementación de backend (memory, AMQP, Redis)
- **Cola** - Cola lógica vinculada a un driver
- **Consumidor** - Conecta cola a handler con configuración de concurrencia
- **Pool de Workers** - Procesadores de mensajes concurrentes

Múltiples colas pueden compartir un driver. Múltiples consumidores pueden procesar de la misma cola.

## Tipos de Entrada

| Tipo | Descripción |
|------|-------------|
| `queue.driver.memory` | Driver de cola en memoria |
| `queue.queue` | Declaración de cola con referencia a driver |
| `queue.consumer` | Consumidor que procesa mensajes |

## Configuración de Driver

### Driver de Memoria

Driver en memoria para desarrollo y pruebas.

```yaml
- name: memory_driver
  kind: queue.driver.memory
  lifecycle:
    auto_start: true
```

<note>
Drivers adicionales (AMQP, Redis, SQS) están planeados. La interfaz del driver permite intercambiar backends sin cambiar la configuración de cola o consumidor.
</note>

## Configuración de Cola

```yaml
- name: tasks
  kind: queue.queue
  driver: app.queue:memory_driver
```

| Campo | Tipo | Requerido | Descripción |
|-------|------|----------|-------------|
| `driver` | ID de Registro | Sí | Referencia al driver de cola |
| `options` | Map | No | Opciones específicas del driver |

<note>
El driver de memoria no tiene opciones de configuración. Los drivers externos (AMQP, Redis, SQS) definen sus propias opciones para comportamiento de cola como durabilidad, longitud máxima, y TTL.
</note>

## Configuración de Consumidor

```yaml
- name: task_consumer
  kind: queue.consumer
  queue: app.queue:tasks
  func: app.queue:task_handler
  concurrency: 4
  prefetch: 20
  lifecycle:
    auto_start: true
    depends_on:
      - app.queue:tasks
```

| Campo | Por Defecto | Máx | Descripción |
|-------|---------|-----|-------------|
| `queue` | Requerido | - | ID de registro de la cola |
| `func` | Requerido | - | ID de registro de la función handler |
| `concurrency` | 1 | 1000 | Conteo de workers paralelos |
| `prefetch` | 10 | 10000 | Tamaño del buffer de mensajes |

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

Las funciones del consumidor reciben datos del mensaje y retornan éxito o error:

```lua
local json = require("json")
local logger = require("logger")

local function handler(body)
    local data = json.decode(body)

    logger.info("Procesando", {task_id = data.id})

    local result, err = process_task(data)
    if err then
        return nil, err  -- Nack: reencolar mensaje
    end

    return result  -- Ack: remover de cola
end

return handler
```

```yaml
- name: task_handler
  kind: function.lua
  source: file://task_handler.lua
  modules:
    - json
    - logger
```

### Reconocimiento

| Resultado del Handler | Acción | Efecto |
|----------------|--------|--------|
| Valor de retorno | Ack | Mensaje removido de la cola |
| Retornar error | Nack | Mensaje reencolado (dependiente del driver) |

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
