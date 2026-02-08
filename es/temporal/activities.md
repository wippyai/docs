# Activities

Las activities son funciones que ejecutan operaciones no determinísticas. Cualquier entrada `function.lua` o `process.lua` puede registrarse como activity de Temporal agregando metadatos.

## Registrar Activities

Agregue `meta.temporal.activity` para registrar una función como activity:

```yaml
- name: charge_payment
  kind: function.lua
  source: file://payment.lua
  method: charge
  modules:
    - http_client
    - json
  meta:
    temporal:
      activity:
        worker: app:worker
```

### Campos de Metadatos

| Campo | Requerido | Descripción |
|-------|-----------|-------------|
| `worker` | Sí | Referencia a entrada `temporal.worker` |
| `local` | No | Ejecutar como activity local (por defecto: false) |

## Implementación

Las activities son funciones Lua regulares:

```lua
-- payment.lua
local http = require("http_client")
local json = require("json")

local function charge(input)
    local response, err = http.post("https://api.stripe.com/v1/charges", {
        headers = {
            ["Authorization"] = "Bearer " .. input.api_key,
            ["Content-Type"] = "application/json"
        },
        body = json.encode({
            amount = input.amount,
            currency = input.currency,
            source = input.token
        })
    })

    if err then
        return nil, err
    end

    return json.decode(response:body())
end

return { charge = charge }
```

## Llamar Activities

Desde workflows, use el módulo `funcs`:

```lua
local funcs = require("funcs")

local result, err = funcs.call("app:charge_payment", {
    amount = 5000,
    currency = "usd",
    token = "tok_visa",
    api_key = ctx.stripe_key
})

if err then
    return nil, err
end
```

## Opciones de Activity

Configure timeouts, comportamiento de reintentos y otros parámetros de ejecución usando el constructor de executor:

```lua
local funcs = require("funcs")

local executor = funcs.new():with_options({
    ["activity.start_to_close_timeout"] = "30s",
    ["activity.schedule_to_close_timeout"] = "5m",
    ["activity.heartbeat_timeout"] = "10s",
    ["activity.retry_policy"] = {
        maximum_attempts = 3,
        initial_interval = 1000,
        backoff_coefficient = 2.0,
        maximum_interval = 60000,
    }
})

local result, err = executor:call("app:charge_payment", input)
```

El executor es inmutable y reutilizable. Constrúyalo una vez y úselo para múltiples llamadas:

```lua
local reliable = funcs.new():with_options({
    ["activity.start_to_close_timeout"] = "60s",
    ["activity.retry_policy"] = {
        maximum_attempts = 5,
        initial_interval = 2000,
        backoff_coefficient = 2.0,
        maximum_interval = 120000,
    }
})

local a, err = reliable:call("app:step_one", input)
local b, err = reliable:call("app:step_two", a)
```

### Referencia de Opciones

| Opción | Tipo | Predeterminado | Descripción |
|--------|------|-------------|-------------|
| `activity.start_to_close_timeout` | duration | 10m | Tiempo máximo de ejecución de la activity |
| `activity.schedule_to_close_timeout` | duration | - | Tiempo máximo desde la programación hasta la finalización |
| `activity.schedule_to_start_timeout` | duration | - | Tiempo máximo antes de que la activity inicie |
| `activity.heartbeat_timeout` | duration | - | Tiempo máximo entre heartbeats |
| `activity.id` | string | - | ID de ejecución personalizado de la activity |
| `activity.task_queue` | string | - | Sobreescribir cola de tareas para esta llamada |
| `activity.wait_for_cancellation` | boolean | false | Esperar cancelación de la activity |
| `activity.disable_eager_execution` | boolean | false | Deshabilitar ejecución anticipada |
| `activity.retry_policy` | table | - | Configuración de reintentos (ver abajo) |

Los valores de duración aceptan cadenas (`"5s"`, `"10m"`, `"1h"`) o milisegundos como números.

### Política de Reintentos

Configurar comportamiento automático de reintentos para activities fallidas:

```lua
["activity.retry_policy"] = {
    initial_interval = 1000,         -- ms before first retry
    backoff_coefficient = 2.0,       -- multiplier for each retry
    maximum_interval = 300000,       -- max interval between retries (ms)
    maximum_attempts = 10,           -- max retry attempts (0 = unlimited)
    non_retryable_error_types = {    -- errors that skip retries
        "INVALID",
        "PERMISSION_DENIED"
    }
}
```

| Campo | Tipo | Predeterminado | Descripción |
|-------|------|-------------|-------------|
| `initial_interval` | number | 1000 | Milisegundos antes del primer reintento |
| `backoff_coefficient` | number | 2.0 | Multiplicador aplicado al intervalo en cada reintento |
| `maximum_interval` | number | - | Límite del intervalo de reintento (ms) |
| `maximum_attempts` | number | 0 | Intentos máximos (0 = ilimitado) |
| `non_retryable_error_types` | array | - | Tipos de error que omiten reintentos |

### Relaciones entre Timeouts

```
|--- schedule_to_close_timeout --------------------------------|
|--- schedule_to_start_timeout ---|--- start_to_close_timeout -|
     (waiting in queue)                (executing)
```

- `start_to_close_timeout`: Cuánto tiempo puede ejecutarse la activity. Es el timeout más comúnmente usado.
- `schedule_to_close_timeout`: Tiempo total desde que la activity se programa hasta que se completa, incluyendo tiempo de espera en cola y reintentos.
- `schedule_to_start_timeout`: Tiempo máximo que la activity puede esperar en la cola de tareas antes de que un worker la tome.
- `heartbeat_timeout`: Para activities de larga ejecución, el tiempo máximo entre reportes de heartbeat.

## Activities Locales

Las activities locales se ejecutan en el proceso del workflow worker sin polling de cola de tareas separado:

```yaml
- name: validate_input
  kind: function.lua
  source: file://validate.lua
  method: validate
  modules:
    - json
  meta:
    temporal:
      activity:
        worker: app:worker
        local: true
```

Características:
- Se ejecutan en el proceso del workflow worker
- Menor latencia (sin ida y vuelta a la cola de tareas)
- Sin overhead de cola de tareas separada
- Limitadas a tiempos de ejecución cortos
- Sin heartbeating

Use activities locales para operaciones rápidas y cortas como validación de entrada, transformación de datos o consultas a caché.

## Nombrado de Activities

Las activities se registran con su ID de entrada completo como nombre:

```yaml
namespace: app
entries:
  - name: charge_payment
    kind: function.lua
    # ...
```

Nombre de activity: `app:charge_payment`

## Propagación de Contexto

Los valores de contexto establecidos al hacer spawn del workflow están disponibles dentro de las activities:

```lua
-- Spawner sets context
local spawner = process.with_context({
    user_id = "user-1",
    tenant = "tenant-1",
})
local pid = spawner:spawn("app:order_workflow", "app:worker", order)
```

```lua
-- Activity reads context
local ctx = require("ctx")

local function process_order(input)
    local user_id = ctx.get("user_id")   -- "user-1"
    local tenant = ctx.get("tenant")     -- "tenant-1"
    -- use context for authorization, logging, etc.
end
```

Las activities llamadas desde un workflow con `funcs.new():with_context()` también propagan contexto:

```lua
-- Inside workflow
local executor = funcs.new():with_context({trace_id = "abc-123"})
local result, err = executor:call("app:charge_payment", input)
```

## Manejo de Errores

Retorne errores mediante el patrón estándar de Lua:

```lua
local errors = require("errors")

local function charge(input)
    if not input.amount or input.amount <= 0 then
        return nil, errors.new("INVALID", "amount must be positive")
    end

    local response, err = http.post(url, options)
    if err then
        return nil, errors.wrap(err, "payment API failed")
    end

    if response:status() >= 400 then
        return nil, errors.new("FAILED", "payment declined")
    end

    return json.decode(response:body())
end
```

### Objetos de Error

Los errores de activity propagados a workflows portan metadatos estructurados:

```lua
local result, err = funcs.call("app:charge_payment", input)
if err then
    err:kind()       -- error classification string
    err:retryable()  -- boolean, whether retry makes sense
    err:message()    -- human-readable error message
end
```

### Modos de Fallo

| Fallo | Tipo de Error | Reintentable | Descripción |
|-------|---------------|--------------|-------------|
| Error de aplicación | varía | varía | Error retornado por código de activity |
| Crash en tiempo de ejecución | `INTERNAL` | sí | Error Lua no manejado en activity |
| Activity faltante | `NOT_FOUND` | no | Activity no registrada con el worker |
| Timeout | `TIMEOUT` | sí | La activity excedió el timeout configurado |

```lua
local executor = funcs.new():with_options({
    ["activity.retry_policy"] = {maximum_attempts = 1}
})

local result, err = executor:call("app:missing_activity", input)
if err then
    print(err:kind())      -- "NOT_FOUND"
    print(err:retryable())  -- false
end
```

## Activities de Proceso

Las entradas `process.lua` también pueden registrarse como activities para operaciones de larga ejecución:

```yaml
- name: long_task
  kind: process.lua
  source: file://long_task.lua
  method: main
  modules:
    - http_client
  meta:
    temporal:
      activity:
        worker: app:worker
```

## Ver También

- [Overview](temporal/overview.md) - Configuración
- [Workflows](temporal/workflows.md) - Implementación de workflows
- [Funciones](lua/core/funcs.md) - Módulo de funciones
- [Manejo de Errores](lua/core/errors.md) - Tipos de error y patrones
