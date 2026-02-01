# Activities

Las activities son funciones que ejecutan operaciones no deterministas. Cualquier entrada `function.lua` o `process.lua` puede registrarse como activity de Temporal agregando metadatos.

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

### Opciones de Activity

Configure timeouts y comportamiento de reintentos:

```lua
local funcs = require("funcs")

local executor = funcs.new()
executor = executor:with_options({
    start_to_close_timeout = "30s",
    schedule_to_close_timeout = "5m",
    heartbeat_timeout = "10s",
    retry_policy = {
        max_attempts = 3,
        initial_interval = "1s",
        backoff_coefficient = 2.0,
        max_interval = "1m"
    }
})

local result, err = executor:call("app:charge_payment", input)
```

## Activities Locales

Las activities locales se ejecutan en el proceso del workflow worker sin polling de cola de tareas separado. Use para operaciones rápidas y cortas:

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
- Menor latencia
- Sin overhead de cola de tareas separada
- Limitadas a tiempos de ejecución cortos
- Sin heartbeating

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

## Manejo de Errores

Retorne errores vía el patrón estándar de Lua:

```lua
local function charge(input)
    if not input.amount or input.amount <= 0 then
        return nil, errors.new("INVALID", "amount debe ser positivo")
    end

    local response, err = http.post(url, options)
    if err then
        return nil, errors.wrap(err, "API de pagos falló")
    end

    if response:status() >= 400 then
        return nil, errors.new("FAILED", "pago rechazado")
    end

    return json.decode(response:body())
end
```

## Activities de Proceso

Las entradas `process.lua` también pueden registrarse como activities:

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
