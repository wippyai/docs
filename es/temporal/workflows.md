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
| `name` | No | Nombre personalizado del tipo de workflow (por defecto ID de entrada) |

## Implementación Básica

```lua
local funcs = require("funcs")
local time = require("time")

local function main(order)
    local payment, err = funcs.call("app:charge_payment", {
        amount = order.total,
        customer = order.customer_id
    })
    if err then
        return {status = "failed", error = tostring(err)}
    end

    time.sleep("1h")

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
print(info.workflow_id)    -- Workflow execution ID
print(info.run_id)         -- Current run ID
print(info.workflow_type)  -- Workflow type name
print(info.task_queue)     -- Task queue name
print(info.namespace)      -- Temporal namespace
print(info.attempt)        -- Current attempt number
print(info.history_length) -- Number of history events
print(info.history_size)   -- History size in bytes
```

### workflow.exec()

Ejecutar un workflow hijo de forma síncrona y esperar su resultado:

```lua
local result, err = workflow.exec("app:child_workflow", input_data)
if err then
    return nil, err
end
```

Esta es la forma más simple de ejecutar workflows hijos cuando se necesita esperar el resultado.

### workflow.version()

Manejar cambios de código con versionado determinístico:

```lua
local version = workflow.version("payment-v2", 1, 2)

if version == 1 then
    result = funcs.call("app:old_payment", input)
else
    result = funcs.call("app:new_payment", input)
end
```

Parámetros:
- `change_id` - Identificador único para este cambio
- `min_supported` - Versión mínima soportada
- `max_supported` - Versión máxima (actual)

El número de versión es determinístico por ejecución de workflow. Los workflows en curso continúan usando su versión registrada, mientras que los nuevos workflows usan `max_supported`.

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
        notes = "Priority customer",
        source = "web"
    }
})
```

Los atributos de búsqueda están indexados y son consultables mediante las APIs de visibilidad de Temporal. El memo contiene datos arbitrarios no indexados adjuntos al workflow.

### workflow.history_length() / workflow.history_size()

Monitorear el crecimiento del historial del workflow:

```lua
local length = workflow.history_length()
local size = workflow.history_size()

if length > 10000 then
    -- Consider continue-as-new to reset history
end
```

## Iniciar Workflows

### Spawn Básico

Iniciar un workflow desde cualquier código usando `process.spawn()`:

```lua
local pid, err = process.spawn(
    "app:order_workflow",    -- workflow entry
    "app:worker",            -- temporal worker
    {order_id = "123"}       -- input
)
```

El parámetro host es el temporal worker (no un host de proceso). El workflow se ejecuta de forma durable en la infraestructura de Temporal.

### Spawn con Monitoreo

Monitorear workflows para recibir eventos EXIT cuando se completan:

```lua
local pid, err = process.spawn_monitored(
    "app:order_workflow",
    "app:worker",
    {order_id = "123"}
)

local events = process.events()
local event = events:receive()

if event.kind == process.event.EXIT then
    local result = event.result.value
    local error = event.result.error
end
```

### Spawn con Nombre

Asignar un nombre a un workflow para inicios idempotentes:

```lua
local spawner = process
    .with_options({})
    :with_name("order-" .. order.id)

local pid, err = spawner:spawn_monitored(
    "app:order_workflow",
    "app:worker",
    {order_id = order.id}
)
```

Cuando se proporciona un nombre, Temporal lo usa para deduplicar inicios de workflow. Hacer spawn con el mismo nombre mientras un workflow está en ejecución retorna el PID del workflow existente por defecto.

### Spawn con ID de Workflow Explícito

Establecer un ID de workflow de Temporal específico:

```lua
local spawner = process
    .with_options({
        ["temporal.workflow.id"] = "order-" .. order.id,
    })

local pid, err = spawner:spawn_monitored(
    "app:order_workflow",
    "app:worker",
    order
)
```

### Políticas de Conflicto de ID

Controlar el comportamiento al hacer spawn de un workflow con un ID que ya existe:

```lua
-- Fail if workflow already exists
local spawner = process
    .with_options({
        ["temporal.workflow.id"] = "order-123",
        ["temporal.workflow.id_conflict_policy"] = "fail",
    })

local pid, err = spawner:spawn("app:order_workflow", "app:worker", order)
if err then
    -- Workflow already running with this ID
end
```

```lua
-- Error when already started (alternative approach)
local spawner = process
    .with_options({
        ["temporal.workflow.id"] = "order-123",
        ["temporal.workflow.execution_error_when_already_started"] = true,
    })

local pid, err = spawner:spawn("app:order_workflow", "app:worker", order)
```

```lua
-- Reuse existing (default behavior with explicit ID)
local spawner = process
    .with_options({
        ["temporal.workflow.id"] = "order-123",
    })

local pid, err = spawner:spawn("app:order_workflow", "app:worker", order)
-- Returns existing workflow PID if already running
```

| Política | Comportamiento |
|----------|----------------|
| `"use_existing"` | Retorna el PID del workflow existente (por defecto con ID explícito) |
| `"fail"` | Retorna error si el workflow existe |
| `"terminate_existing"` | Termina el existente e inicia uno nuevo |

### Opciones de Inicio de Workflow

Pasar opciones de workflow de Temporal mediante `with_options()`:

```lua
local spawner = process.with_options({
    ["temporal.workflow.id"] = "order-123",
    ["temporal.workflow.execution_timeout"] = "24h",
    ["temporal.workflow.run_timeout"] = "1h",
    ["temporal.workflow.task_timeout"] = "30s",
    ["temporal.workflow.id_conflict_policy"] = "fail",
    ["temporal.workflow.retry_policy"] = {
        initial_interval = 1000,
        backoff_coefficient = 2.0,
        maximum_interval = 300000,
        maximum_attempts = 3,
    },
    ["temporal.workflow.cron_schedule"] = "0 */6 * * *",
    ["temporal.workflow.search_attributes"] = {
        customer_id = "cust-123"
    },
    ["temporal.workflow.memo"] = {
        source = "api"
    },
    ["temporal.workflow.start_delay"] = "5m",
    ["temporal.workflow.parent_close_policy"] = "terminate",
})
```

#### Referencia Completa de Opciones

| Opción | Tipo | Descripción |
|--------|------|-------------|
| `temporal.workflow.id` | string | ID de ejecución explícito del workflow |
| `temporal.workflow.task_queue` | string | Sobreescribir cola de tareas |
| `temporal.workflow.execution_timeout` | duration | Timeout total de ejecución del workflow |
| `temporal.workflow.run_timeout` | duration | Timeout de ejecución individual |
| `temporal.workflow.task_timeout` | duration | Timeout de procesamiento de tarea del workflow |
| `temporal.workflow.id_conflict_policy` | string | `use_existing`, `fail`, `terminate_existing` |
| `temporal.workflow.id_reuse_policy` | string | `allow_duplicate`, `allow_duplicate_failed_only`, `reject_duplicate` |
| `temporal.workflow.execution_error_when_already_started` | boolean | Error si el workflow ya está en ejecución |
| `temporal.workflow.retry_policy` | table | Política de reintentos (ver abajo) |
| `temporal.workflow.cron_schedule` | string | Expresión cron para workflows recurrentes |
| `temporal.workflow.memo` | table | Metadatos no indexados del workflow |
| `temporal.workflow.search_attributes` | table | Atributos indexados consultables |
| `temporal.workflow.enable_eager_start` | boolean | Iniciar ejecución inmediatamente |
| `temporal.workflow.start_delay` | duration | Retardo antes de que el workflow inicie |
| `temporal.workflow.parent_close_policy` | string | Comportamiento del hijo al cerrar el padre |
| `temporal.workflow.wait_for_cancellation` | boolean | Esperar a que la cancelación finalice |
| `temporal.workflow.namespace` | string | Sobreescritura del namespace de Temporal |

Los valores de duración aceptan cadenas (`"5s"`, `"10m"`, `"1h"`) o milisegundos como números.

#### Política de Cierre del Padre

Controla qué sucede con los workflows hijos cuando el padre se cierra:

| Política | Comportamiento |
|----------|----------------|
| `"terminate"` | Terminar el workflow hijo |
| `"abandon"` | Dejar que el hijo continúe independientemente |
| `"request_cancel"` | Enviar solicitud de cancelación al hijo |

### Mensajes de Inicio

Agregar signals a la cola para enviarlos a un workflow inmediatamente después de que inicie. Los mensajes se entregan antes de cualquier signal externo:

```lua
local spawner = process
    .with_options({})
    :with_name("counter-workflow")
    :with_message("increment", {amount = 2})
    :with_message("increment", {amount = 1})
    :with_message("increment", {amount = 4})

local pid, err = spawner:spawn_monitored(
    "app:counter_workflow",
    "app:worker",
    {initial = 0}
)
```

Los mensajes de inicio son especialmente útiles con la política de conflicto `use_existing`. Cuando un segundo spawn se resuelve a un workflow existente, los mensajes de inicio aún se entregan:

```lua
-- First spawn starts the workflow with initial messages
local first = process
    .with_options({})
    :with_name("my-counter")
    :with_message("increment", {amount = 3})

local pid, err = first:spawn("app:counter_workflow", "app:worker", {initial = 0})

-- Second spawn reuses existing workflow and delivers new messages
local second = process
    .with_options({})
    :with_name("my-counter")
    :with_message("increment", {amount = 2})

local pid2, err = second:spawn("app:counter_workflow", "app:worker", {initial = 999})
-- pid2 == pid (same workflow), input {initial = 999} is ignored
-- But the increment message with amount=2 is delivered
```

### Propagación de Contexto

Pasar valores de contexto accesibles dentro del workflow y sus activities:

```lua
local spawner = process.with_context({
    user_id = "user-1",
    tenant = "tenant-1",
    request_id = "req-abc",
})

local pid, err = spawner:spawn_monitored(
    "app:order_workflow",
    "app:worker",
    order
)
```

Dentro del workflow (o cualquier activity que invoque), leer el contexto mediante el módulo `ctx`:

```lua
local ctx = require("ctx")

local user_id = ctx.get("user_id")       -- "user-1"
local tenant = ctx.get("tenant")         -- "tenant-1"
local all = ctx.all()                    -- {user_id="user-1", tenant="tenant-1", request_id="req-abc"}
```

### Desde Manejadores HTTP

```lua
local function handler()
    local req = http.request()
    local order = json.decode(req:body())

    local spawner = process
        .with_context({request_id = req:header("X-Request-ID")})
        :with_options({
            ["temporal.workflow.id"] = "order-" .. order.id,
            ["temporal.workflow.id_conflict_policy"] = "fail",
        })

    local pid, err = spawner:spawn(
        "app:order_workflow",
        "app:worker",
        order
    )

    if err then
        return http.response():status(409):json({error = tostring(err)})
    end

    return http.response():status(202):json({
        workflow_id = tostring(pid),
        status = "started"
    })
end
```

## Signals

Los workflows reciben signals mediante el sistema de mensajería de procesos. Los signals son durables: sobreviven replays del workflow.

### Patrón Inbox

Recibir todos los mensajes a través del inbox del proceso:

```lua
local function main(order)
    local inbox = process.inbox()

    while true do
        local msg = inbox:receive()
        local topic = msg:topic()
        local data = msg:payload():data()

        if topic == "approve" then
            break
        elseif topic == "cancel" then
            return {status = "cancelled", reason = data.reason}
        end
    end

    return process_order(order)
end
```

### Suscripción Basada en Tópicos

Suscribirse a tópicos específicos usando `process.listen()`:

```lua
local function main(input)
    local results = {}
    local job_ch = process.listen("add_job")
    local exit_ch = process.listen("exit")

    while true do
        local result = channel.select{
            job_ch:case_receive(),
            exit_ch:case_receive()
        }

        if result.channel == exit_ch then
            break
        elseif result.channel == job_ch then
            local job_data = result.value
            local activity_result, err = funcs.call(
                "app:echo_activity",
                {job_id = job_data.id, data = job_data}
            )
            table.insert(results, {
                job_id = job_data.id,
                result = activity_result
            })
        end
    end

    return {total_jobs = #results, results = results}
end
```

Por defecto, `process.listen()` retorna datos de payload sin procesar. Use `{message = true}` para recibir objetos Message con información del remitente:

```lua
local ch = process.listen("request", {message = true})
local msg = ch:receive()
local sender = msg:from()
local data = msg:payload():data()
```

### Múltiples Manejadores de Signals

Use `coroutine.spawn()` para manejar diferentes tipos de signals concurrentemente:

```lua
local function main(input)
    local counter = input.initial or 0
    local done = false

    coroutine.spawn(function()
        local ch = process.listen("increment", {message = true})
        while not done do
            local msg, ok = ch:receive()
            if not ok then break end

            local data = msg:payload():data()
            local reply_to = msg:from()

            if type(data) ~= "table" or type(data.amount) ~= "number" then
                process.send(reply_to, "nak", "amount must be a number")
            else
                process.send(reply_to, "ack")
                counter = counter + data.amount
                process.send(reply_to, "ok", {value = counter})
            end
        end
    end)

    coroutine.spawn(function()
        local ch = process.listen("decrement", {message = true})
        while not done do
            local msg, ok = ch:receive()
            if not ok then break end

            local data = msg:payload():data()
            local reply_to = msg:from()

            if counter - data.amount < 0 then
                process.send(reply_to, "nak", "would result in negative value")
            else
                process.send(reply_to, "ack")
                counter = counter - data.amount
                process.send(reply_to, "ok", {value = counter})
            end
        end
    end)

    -- Main coroutine waits for finish signal
    local finish_ch = process.listen("finish", {message = true})
    local msg = finish_ch:receive()
    process.send(msg:from(), "ack")
    process.send(msg:from(), "ok", {message = "finishing"})
    done = true

    return {final_counter = counter}
end
```

### Acuse de Recibo de Signals

Implementar patrones de solicitud-respuesta enviando respuestas al remitente:

```lua
-- Workflow side
local ch = process.listen("get_status", {message = true})
local msg = ch:receive()
process.send(msg:from(), "status_response", {status = "processing", progress = 75})
```

```lua
-- Caller side
local response_ch = process.listen("status_response")
process.send(workflow_pid, "get_status", {})

local timeout = time.after("5s")
local result = channel.select{
    response_ch:case_receive(),
    timeout:case_receive()
}

if result.channel == response_ch then
    local status = result.value
end
```

### Señalización entre Workflows

Los workflows pueden enviar signals a otros workflows usando su PID:

```lua
-- Sender workflow
local function main(input)
    local target_pid = input.target
    local ok, err = process.send(target_pid, "cross_host_ping", {data = "hello"})
    if err then
        return {ok = false, error = tostring(err)}
    end

    local response_ch = process.listen("cross_host_pong")
    local response = response_ch:receive()
    return {ok = true, received = response}
end
```

## Workflows Hijos

### Hijo Síncrono (workflow.exec)

Ejecutar un workflow hijo y esperar el resultado:

```lua
local result, err = workflow.exec("app:child_workflow", input_data)
if err then
    return nil, err
end
```

### Hijo Asíncrono (process.spawn)

Iniciar un workflow hijo sin bloquear, luego esperar su finalización mediante eventos:

```lua
local events_ch = process.events()

local child_pid, err = process.spawn(
    "app:child_workflow",
    "app:worker",
    {message = "hello from parent"}
)
if err then
    return {status = "spawn_failed", error = tostring(err)}
end

-- Wait for child EXIT event
local event = events_ch:receive()

if event.kind == process.event.EXIT then
    local child_result = event.result.value
    local child_error = event.result.error
end
```

### Propagación de Errores desde Hijos

Cuando un workflow hijo retorna un error, aparece en el evento EXIT:

```lua
local events_ch = process.events()
local child_pid, err = process.spawn(
    "app:error_child_workflow",
    "app:worker"
)

local event = events_ch:receive()
if event.result.error then
    local child_err = event.result.error
    -- Error objects have kind(), retryable(), message() methods
    print(child_err:kind())       -- e.g. "NOT_FOUND"
    print(child_err:retryable())  -- false
    print(child_err:message())    -- error message text
end
```

### Ejecutar Workflows Síncronamente (process.exec)

Ejecutar un workflow y esperar su resultado en una sola llamada:

```lua
local result, err = process.exec(
    "app:hello_workflow",
    "app:worker",
    {name = "world"}
)
if err then
    return nil, err
end
-- result contains the workflow return value
```

## Monitoreo y Enlace

### Monitoreo Post-Inicio

Monitorear un workflow después de que ya ha iniciado:

```lua
local pid, err = process.spawn(
    "app:long_workflow",
    "app:worker",
    {iterations = 100}
)

-- Monitor later
local ok, err = process.monitor(pid)

local events_ch = process.events()
local event = events_ch:receive()  -- EXIT when workflow completes
```

### Enlace Post-Inicio

Enlazarse a un workflow en ejecución para recibir LINK_DOWN en terminación anormal:

```lua
local ok, err = process.set_options({trap_links = true})

local pid, err = process.spawn(
    "app:long_workflow",
    "app:worker",
    {iterations = 100}
)

-- Link after workflow has started
time.sleep("200ms")
local ok, err = process.link(pid)

-- If workflow is terminated, receive LINK_DOWN
process.terminate(pid)

local events_ch = process.events()
local event = events_ch:receive()
-- event.kind == process.event.LINK_DOWN
```

Los eventos LINK_DOWN requieren `trap_links = true` en las opciones del proceso. Sin esto, la terminación de un proceso enlazado propaga el fallo.

### Desmonitorear / Desenlazar

Remover monitoreo o enlace:

```lua
process.unmonitor(pid)  -- stop receiving EXIT events
process.unlink(pid)     -- remove bidirectional link
```

Después de desmonitorear o desenlazar, los eventos para ese proceso ya no se entregan.

## Terminación y Cancelación

### Terminar

Terminar forzosamente un workflow en ejecución:

```lua
local ok, err = process.terminate(workflow_pid)
```

Los llamadores monitoreados reciben un evento EXIT con un error.

### Cancelar

Solicitar cancelación con un deadline opcional:

```lua
local ok, err = process.cancel(workflow_pid, "5s")
```

## Trabajo Concurrente

Use `coroutine.spawn()` y channels para trabajo paralelo dentro de workflows:

```lua
local function main(input)
    local worker_count = input.workers or 3
    local job_count = input.jobs or 6

    local work_queue = channel.new(10)
    local results = channel.new(10)

    for w = 1, worker_count do
        coroutine.spawn(function()
            while true do
                local job, ok = work_queue:receive()
                if not ok then break end
                time.sleep(10 * time.MILLISECOND)
                results:send({worker = w, job = job, result = job * 2})
            end
        end)
    end

    for j = 1, job_count do
        work_queue:send(j)
    end
    work_queue:close()

    local total = 0
    local processed = {}
    for _ = 1, job_count do
        local r = results:receive()
        total = total + r.result
        table.insert(processed, r)
    end

    return {total = total, processed = processed}
end
```

Todas las operaciones de channel y sleeps dentro de coroutines son seguras para replay.

## Timers

Los timers durables sobreviven reinicios:

```lua
local time = require("time")

time.sleep("24h")
time.sleep("5m")
time.sleep("30s")
time.sleep(100 * time.MILLISECOND)
```

Rastrear tiempo transcurrido:

```lua
local start = time.now()
time.sleep("1s")
local elapsed = time.now():sub(start):milliseconds()
```

## Determinismo

El código del workflow debe ser determinístico. Las mismas entradas deben producir la misma secuencia de comandos.

### Operaciones Seguras para Replay

Estas operaciones son interceptadas automáticamente y sus resultados registrados. En replay, se retornan los valores registrados:

```lua
-- Activity calls
local data = funcs.call("app:fetch_data", id)

-- Durable sleep
time.sleep("1h")

-- Current time
local now = time.now()

-- UUID generation
local id = uuid.v4()

-- Crypto operations
local bytes = crypto.random_bytes(32)

-- Child workflows
local result = workflow.exec("app:child", input)

-- Versioning
local v = workflow.version("change-1", 1, 2)
```

### No Determinístico (Evitar)

```lua
-- Don't use wall clock time
local now = os.time()              -- non-deterministic

-- Don't use random directly
local r = math.random()            -- non-deterministic

-- Don't do I/O in workflow code
local file = io.open("data.txt")   -- non-deterministic

-- Don't use global mutable state
counter = counter + 1               -- non-deterministic across replays
```

## Manejo de Errores

### Errores de Activity

Los errores de activity portan metadatos estructurados:

```lua
local result, err = funcs.call("app:risky_activity", order)
if err then
    print(err:kind())       -- error classification (e.g. "NOT_FOUND", "INTERNAL")
    print(err:retryable())  -- whether the error is retryable
    print(err:message())    -- human-readable error message
end
```

### Modos de Fallo de Activity

Configurar comportamiento de reintentos para llamadas a activities:

```lua
local executor = funcs.new():with_options({
    ["activity.retry_policy"] = {
        maximum_attempts = 1,
    }
})

local result, err = executor:call("app:unreliable_activity", input)
if err then
    local kind = err:kind()         -- "INTERNAL" for runtime errors
    local retryable = err:retryable()
end
```

### Errores de Workflows Hijos

Los errores de workflows hijos (mediante `process.exec` o eventos EXIT) portan los mismos metadatos:

```lua
local result, err = process.exec("app:error_workflow", "app:worker")
if err then
    print(err:kind())       -- e.g. "NOT_FOUND"
    print(err:retryable())  -- false
    print(err:message())    -- error details
end
```

## Patrón de Compensación (Saga)

```lua
local function main(order)
    local compensations = {}

    local reservation, err = funcs.call("app:reserve_inventory", order.items)
    if err then
        return {status = "failed", step = "inventory", error = tostring(err)}
    end
    table.insert(compensations, 1, {
        action = "app:release_inventory",
        args = reservation.id
    })

    local payment, err = funcs.call("app:charge_payment", order.payment)
    if err then
        run_compensations(compensations)
        return {status = "failed", step = "payment", error = tostring(err)}
    end
    table.insert(compensations, 1, {
        action = "app:refund_payment",
        args = payment.id
    })

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

## Ver También

- [Overview](temporal/overview.md) - Configuración de cliente y worker
- [Activities](temporal/activities.md) - Definiciones de activities y opciones
- [Procesos](lua/core/process.md) - API de gestión de procesos
- [Funciones](lua/core/funcs.md) - Invocación de funciones
- [Channels](lua/core/channel.md) - Operaciones de channel
