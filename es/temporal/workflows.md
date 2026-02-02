# Workflows

Los workflows son funciones durables que orquestan activities y mantienen estado a través de fallos y reinicios. Se definen usando el tipo de entrada `workflow.lua`.

## Definición

```yaml
- name: order_workflow
  kind: workflow.lua
  source: file://order_workflow.lua
  method: main
  modules:
    - funcs
    - time
    - workflow
  meta:
    temporal:
      workflow:
        worker: app:worker
```

### Campos de Metadatos

| Campo | Requerido | Descripción |
|-------|-----------|-------------|
| `worker` | Sí | Referencia a entrada `temporal.worker` |
| `name` | No | Nombre personalizado del workflow (por defecto ID de entrada) |

## Implementación Básica

```lua
local funcs = require("funcs")
local time = require("time")

local function main(order)
    -- Llamar activity
    local payment, err = funcs.call("app:charge_payment", {
        amount = order.total,
        customer = order.customer_id
    })
    if err then
        return {status = "failed", error = tostring(err)}
    end

    -- Sleep durable (sobrevive reinicios)
    time.sleep("1h")

    -- Otra activity
    local shipment, err = funcs.call("app:ship_order", {
        order_id = order.id,
        address = order.shipping_address
    })
    if err then
        funcs.call("app:refund_payment", payment.id)
        return {status = "failed", error = tostring(err)}
    end

    return {
        status = "completed",
        payment_id = payment.id,
        tracking = shipment.tracking_number
    }
end

return { main = main }
```

## Módulo Workflow

El módulo `workflow` proporciona operaciones específicas de workflow.

### workflow.info()

Obtener información de ejecución del workflow:

```lua
local workflow = require("workflow")

local info = workflow.info()
print(info.workflow_id)    -- ID de ejecución del workflow
print(info.run_id)         -- ID de ejecución actual
print(info.workflow_type)  -- Nombre del tipo de workflow
print(info.task_queue)     -- Nombre de cola de tareas
print(info.namespace)      -- Namespace de Temporal
print(info.attempt)        -- Número de intento actual
print(info.history_length) -- Número de eventos en historial
print(info.history_size)   -- Tamaño del historial en bytes
```

### workflow.version()

Manejar cambios de código con versionado determinístico:

```lua
local version = workflow.version("payment-v2", 1, 2)

if version == 1 then
    -- Comportamiento anterior (para ejecuciones existentes)
    result = funcs.call("app:old_payment", input)
else
    -- Nuevo comportamiento (versión 2)
    result = funcs.call("app:new_payment", input)
end
```

Parámetros:
- `change_id` - Identificador único para este cambio
- `min_supported` - Versión mínima soportada
- `max_supported` - Versión máxima (actual)

### workflow.attrs()

Actualizar atributos de búsqueda y memo:

```lua
workflow.attrs({
    search = {
        status = "processing",
        customer_id = order.customer_id,
        order_total = order.total
    },
    memo = {
        notes = "Cliente prioritario",
        source = "web"
    }
})
```

### workflow.history_length()

Obtener el número de eventos en el historial del workflow:

```lua
local length = workflow.history_length()
if length > 10000 then
    -- Considerar continue-as-new
end
```

### workflow.history_size()

Obtener el tamaño del historial del workflow en bytes:

```lua
local size = workflow.history_size()
```

### workflow.exec()

Ejecutar un workflow hijo:

```lua
local result, err = workflow.exec("app:child_workflow", input_data)
```

## Signals

Envíe datos a workflows en ejecución usando el inbox del proceso.

**Enviar signals:**

```lua
process.send(workflow_pid, "approve", {
    approved_by = "admin",
    comment = "Se ve bien"
})
```

**Recibir signals en workflow:**

```lua
local function main(order)
    local inbox = process.inbox()

    while true do
        local msg = inbox:receive()
        local topic = msg:topic()

        if topic == "approve" then
            local data = msg:payload():data()
            break
        elseif topic == "cancel" then
            local data = msg:payload():data()
            return {status = "cancelled", reason = data.reason}
        end
    end

    return process_order(order)
end
```

## Timers

Los timers durables sobreviven reinicios:

```lua
local time = require("time")

time.sleep("24h")
time.sleep("5m")
time.sleep("30s")
```

## Determinismo

El código del workflow debe ser determinístico. Las mismas entradas deben producir la misma secuencia de comandos.

### Hacer

```lua
-- Usar workflow info para contexto de tiempo actual
local info = workflow.info()

-- Usar sleep durable
time.sleep("1h")

-- Usar activities para I/O
local data = funcs.call("app:fetch_data", id)

-- Usar versionado para cambios de código
local v = workflow.version("change-1", 1, 2)
```

### No Hacer

```lua
-- No usar tiempo de reloj de pared
local now = os.time()  -- No determinístico

-- No usar random directamente
local r = math.random()  -- No determinístico

-- No hacer I/O en código de workflow
local file = io.open("data.txt")  -- No determinístico

-- No usar estado global mutable
counter = counter + 1  -- No determinístico entre replays
```

## Manejo de Errores

```lua
local function main(order)
    local result, err = funcs.call("app:risky_activity", order)

    if err then
        -- Registrar y compensar
        funcs.call("app:send_alert", {
            error = tostring(err),
            order_id = order.id
        })

        return {status = "failed", error = tostring(err)}
    end

    return {status = "completed", result = result}
end
```

## Patrón de Compensación (Saga)

```lua
local function main(order)
    local compensations = {}

    -- Paso 1: Reservar inventario
    local reservation, err = funcs.call("app:reserve_inventory", order.items)
    if err then
        return {status = "failed", step = "inventory", error = tostring(err)}
    end
    table.insert(compensations, 1, {
        action = "app:release_inventory",
        args = reservation.id
    })

    -- Paso 2: Cobrar pago
    local payment, err = funcs.call("app:charge_payment", order.payment)
    if err then
        run_compensations(compensations)
        return {status = "failed", step = "payment", error = tostring(err)}
    end
    table.insert(compensations, 1, {
        action = "app:refund_payment",
        args = payment.id
    })

    -- Paso 3: Enviar orden
    local shipment, err = funcs.call("app:ship_order", order.shipping)
    if err then
        run_compensations(compensations)
        return {status = "failed", step = "shipping", error = tostring(err)}
    end

    return {status = "completed", tracking = shipment.tracking}
end

local function run_compensations(compensations)
    for _, comp in ipairs(compensations) do
        funcs.call(comp.action, comp.args)
    end
end
```

## Iniciar Workflows

Inicie workflows desde cualquier código:

```lua
local pid, err = process.spawn(
    "app:order_workflow",    -- entrada de workflow
    "app:worker",            -- worker de temporal
    {order_id = "123"}       -- entrada
)
```

Desde manejadores HTTP:

```lua
local function handler()
    local req = http.request()
    local order = json.decode(req:body())

    local pid, err = process.spawn(
        "app:order_workflow",
        "app:worker",
        order
    )

    if err then
        return http.response():status(500):json({error = tostring(err)})
    end

    return http.response():json({
        workflow_id = tostring(pid),
        status = "started"
    })
end
```

## Ver También

- [Overview](temporal/overview.md) - Configuración
- [Activities](temporal/activities.md) - Definiciones de activities
- [Procesos](lua/core/process.md) - Gestión de procesos
- [Funciones](lua/core/funcs.md) - Llamadas a funciones
