---
title: "Activities"
description: "Registre entradas function.lua o process.lua como activities de Temporal para ejecutar operaciones no deterministas."
---

# Activities

Las activities de Temporal ejecutan operaciones no deterministas. Registre una entrada `function.lua` o `process.lua` como activity mediante sus metadatos.

Los fragmentos son recetas de API. El ejemplo de pago es ilustrativo y requiere una entrada de entorno propiedad de la aplicación, permiso `env.get` para la credencial, permiso `http_client.request` para la URL del proveedor y un contrato con el proveedor de pagos.

## Registrar Activities

Agregue `meta.temporal.activity` para registrar una función como activity:

```yaml
- name: charge_payment
  kind: function.lua
  source: file://payment.lua
  method: charge
  modules:
    - env
    - errors
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

Las activities son funciones Lua normales. Mantenga las credenciales fuera de las entradas del workflow, porque Temporal las conserva en su historial. Este ejemplo lee la clave de pago del registro de entorno dentro de la activity. El proveedor de ejemplo acepta una solicitud de cobro JSON y devuelve una respuesta JSON. La correspondencia de estados es una política propiedad de la aplicación: sustituya la URL, los campos de solicitud y respuesta y la correspondencia de fallos por el contrato de su proveedor.

```lua
-- payment.lua
local http = require("http_client")
local json = require("json")
local env = require("env")
local errors = require("errors")

local function payment_error(status)
    if status == 408 then
        return errors.new({kind = errors.TIMEOUT, message = "payment provider timed out", retryable = true})
    elseif status == 429 then
        return errors.new({kind = errors.RATE_LIMITED, message = "payment provider rate limited the request", retryable = true})
    elseif status >= 500 then
        return errors.new({kind = errors.UNAVAILABLE, message = "payment provider is unavailable", retryable = true})
    end
    return errors.new({kind = errors.INVALID, message = "payment request was rejected", retryable = false})
end

local function charge(input)
    local api_key, env_err = env.get("PAYMENTS_API_KEY")
    if env_err then return nil, env_err end

    local body, encode_err = json.encode({
        amount = input.amount,
        currency = input.currency,
        payment_token = input.payment_token
    })
    if encode_err then
        return nil, encode_err
    end

    local response, err = http.post("https://payments.example.com/v1/charges", {
        headers = {
            ["Authorization"] = "Bearer " .. api_key,
            ["Content-Type"] = "application/json"
        },
        body = body
    })

    if err then
        return nil, err
    end

    if response.status_code >= 400 then
        return nil, payment_error(response.status_code)
    end

    return json.decode(response.body)
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
    payment_token = "payment-token-123"
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
if err then
    return nil, err
end
local b, err = reliable:call("app:step_two", a)
if err then
    return nil, err
end
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
| `activity.versioning_intent` | string o number | - | Intención de versionado del worker para la activity |
| `activity.summary` | string | - | Resumen mostrado en los metadatos de la activity de Temporal |
| `activity.priority` | table | - | Clave de prioridad y ajustes opcionales de equidad |
| `activity.name` | string | - | Nombre alternativo del tipo de activity |

Los valores de duración aceptan cadenas (`"5s"`, `"10m"`, `"1h"`) o milisegundos como números.

Use los nombres canónicos `activity.*` en código nuevo. Los alias heredados `temporal.activity.*` siguen aceptándose por compatibilidad.

```lua
local executor = funcs.new():with_options({
    ["activity.summary"] = "Charge the order payment",
    ["activity.priority"] = {
        priority_key = 10,
        fairness_key = "customer-123",
        fairness_weight = 1.0,
    },
    ["activity.name"] = "charge-payment",
    ["activity.versioning_intent"] = "use_assignment_rules",
})
```

### Política de Reintentos

Configurar comportamiento automático de reintentos para activities fallidas:

```lua
["activity.retry_policy"] = {
    initial_interval = 1000,         -- ms before first retry
    backoff_coefficient = 2.0,       -- multiplier for each retry
    maximum_interval = 300000,       -- max interval between retries (ms)
    maximum_attempts = 10,           -- max retry attempts (0 = unlimited)
    non_retryable_error_types = {    -- errors that skip retries
        "Invalid",
        "PermissionDenied"
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

El campo `local` se acepta en una activity:

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

Actualmente, `local: true` se analiza pero se comporta igual que una activity normal: se registra y ejecuta por la ruta estándar de activities. Todavía no existe una ejecución diferenciada de activities locales, por lo que no cambia la latencia, el comportamiento de la cola de tareas ni el heartbeating.

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
local pid, err = spawner:spawn("app:order_workflow", "app:worker", order)
if err then
    return nil, err
end
```

```lua
-- Activity reads context
local ctx = require("ctx")

local function process_order(input)
    local user_id, user_err = ctx.get("user_id")   -- "user-1"
    if user_err then return nil, user_err end
    local tenant, tenant_err = ctx.get("tenant")   -- "tenant-1"
    if tenant_err then return nil, tenant_err end
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

-- Replace this mapping with the payment provider's documented error contract.
local function payment_error(status)
    if status == 408 then
        return errors.new({kind = errors.TIMEOUT, message = "payment provider timed out", retryable = true})
    elseif status == 429 then
        return errors.new({kind = errors.RATE_LIMITED, message = "payment provider rate limited the request", retryable = true})
    elseif status >= 500 then
        return errors.new({kind = errors.UNAVAILABLE, message = "payment provider is unavailable", retryable = true})
    end
    return errors.new({kind = errors.INVALID, message = "payment request was rejected", retryable = false})
end

local function charge(input)
    if not input.amount or input.amount <= 0 then
        return nil, errors.new({ kind = errors.INVALID, message = "amount must be positive" })
    end

    local response, err = http.post(url, options)
    if err then
        return nil, errors.wrap(err, "payment API failed")
    end

    if response.status_code >= 400 then
        return nil, payment_error(response.status_code)
    end

    return json.decode(response.body)
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
| Error de aplicación | Lo que la activity haya retornado | Heredado del error retornado | Error retornado por código de activity vía `return nil, err` |
| Crash en tiempo de ejecución | `Internal` | no | Error Lua no controlado en la activity |
| Activity faltante | `NotFound` | no | Activity no registrada con el worker |
| Timeout | `Timeout` | no | La activity superó el timeout configurado |

```lua
local executor = funcs.new():with_options({
    ["activity.retry_policy"] = {maximum_attempts = 1}
})

local result, err = executor:call("app:missing_activity", input)
if err then
    print(err:kind())      -- "NotFound"
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
- [Manejo de errores](lua/core/errors.md) - Tipos de error y patrones
