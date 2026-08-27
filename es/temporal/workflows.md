---
title: "Workflows"
description: "Defina workflows duraderos de Temporal con entradas workflow.lua, activities, señales, workflows hijos, temporizadores y operaciones seguras para replay."
---

# Workflows

Una entrada `workflow.lua` define un workflow duradero de Temporal que orquesta activities y mantiene el estado a través de fallos y reinicios.

Esta página es una referencia de API con recetas parciales. Las declaraciones de entradas, el registro del worker, las implementaciones de activities, las políticas de seguridad y los datos circundantes de la aplicación solo se muestran cuando son relevantes para un contrato concreto.

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
|-------|----------|-------------|
| `worker` | Sí | Referencia a la entrada `temporal.worker` |
| `name` | No | Nombre de tipo de workflow personalizado (por defecto el ID de entrada) |

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
        local _, refund_err = funcs.call("app:refund_payment", payment.id)
        if refund_err then
            return {
                status = "failed",
                error = tostring(err),
                compensation_error = tostring(refund_err)
            }
        end
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

## Módulo workflow

El módulo `workflow` proporciona operaciones específicas de workflow.

### workflow.info()

Obtener información de ejecución del workflow:

```lua
local workflow = require("workflow")

local info, info_err = workflow.info()
if info_err then return nil, info_err end
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

Use esta forma cuando el padre deba esperar el resultado del hijo en línea.

### workflow.version()

Manejar cambios de código con versionado determinista:

```lua
local version, err = workflow.version("payment-v2", 1, 2)
if err then
    return nil, err
end

if version == 1 then
    return funcs.call("app:old_payment", input)
else
    return funcs.call("app:new_payment", input)
end
```

Parámetros:
- `change_id` - Identificador único para este cambio
- `min_supported` - Versión mínima soportada
- `max_supported` - Versión máxima (actual)

El número de versión es determinista por ejecución de workflow. Los workflows en vuelo existentes continúan usando su versión registrada, mientras que los nuevos workflows usan `max_supported`.

### workflow.attrs()

Actualizar atributos de búsqueda y memo:

```lua
local updated, err = workflow.attrs({
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
if err then
    return nil, err
end
```

Los atributos de búsqueda están indexados y son consultables via las APIs de visibilidad de Temporal. El memo son datos arbitrarios no indexados adjuntos al workflow.

### workflow.history_length() / workflow.history_size()

Monitorear el crecimiento del historial del workflow:

```lua
local length, length_err = workflow.history_length()
if length_err then return nil, length_err end
local size, size_err = workflow.history_size()
if size_err then return nil, size_err end

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
if err then
    return nil, err
end
```

El parámetro host es el worker de temporal (no un host de proceso). El workflow se ejecuta de forma durable en la infraestructura de Temporal.

### Spawn con Monitoreo

Monitorear workflows para recibir eventos EXIT cuando se completan:

```lua
local pid, err = process.spawn_monitored(
    "app:order_workflow",
    "app:worker",
    {order_id = "123"}
)
if err then
    return nil, err
end

local events = process.events()
local event, open = events:receive()
if not open then
    return nil, errors.new({kind = errors.INTERNAL, message = "process event channel closed"})
end

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
if err then
    return nil, err
end
```

Cuando se proporciona un nombre, Temporal lo usa para deduplicar inicios de workflow. Hacer spawn con el mismo nombre mientras un workflow está ejecutándose devuelve el PID del workflow existente por defecto.

### Spawn con ID de Workflow Explícito

Establecer un ID de workflow de Temporal específico:

```lua
local spawner = process
    .with_options({
        ["workflow.id"] = "order-" .. order.id,
    })

local pid, err = spawner:spawn_monitored(
    "app:order_workflow",
    "app:worker",
    order
)
if err then
    return nil, err
end
```

### Políticas de Conflicto de ID

Controlar el comportamiento al hacer spawn de un workflow con un ID que ya existe:

```lua
-- Fail if workflow already exists
local spawner = process
    .with_options({
        ["workflow.id"] = "order-123",
        ["workflow.id_conflict_policy"] = "fail",
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
        ["workflow.id"] = "order-123",
        ["workflow.execution_error_when_already_started"] = true,
    })

local pid, err = spawner:spawn("app:order_workflow", "app:worker", order)
if err then return nil, err end
```

```lua
-- Reuse existing (default behavior with explicit ID)
local spawner = process
    .with_options({
        ["workflow.id"] = "order-123",
    })

local pid, err = spawner:spawn("app:order_workflow", "app:worker", order)
if err then return nil, err end
-- Returns existing workflow PID if already running
```

| Política | Comportamiento |
|----------|----------------|
| `"use_existing"` | Devolver PID del workflow existente (por defecto con ID explícito) |
| `"fail"` | Devolver error si el workflow existe |
| `"terminate_existing"` | Terminar el existente e iniciar uno nuevo |

### Opciones de Inicio del Workflow

Pasar opciones de workflow de Temporal via `with_options()`:

```lua
local spawner = process.with_options({
    ["workflow.id"] = "order-123",
    ["workflow.execution_timeout"] = "24h",
    ["workflow.run_timeout"] = "1h",
    ["workflow.task_timeout"] = "30s",
    ["workflow.id_conflict_policy"] = "fail",
    ["workflow.retry_policy"] = {
        initial_interval = 1000,
        backoff_coefficient = 2.0,
        maximum_interval = 300000,
        maximum_attempts = 3,
    },
    ["workflow.cron_schedule"] = "0 */6 * * *",
    ["workflow.search_attributes"] = {
        customer_id = "cust-123"
    },
    ["workflow.memo"] = {
        source = "api"
    },
    ["workflow.start_delay"] = "5m",
    ["workflow.parent_close_policy"] = "terminate",
})
```

#### Referencia de opciones

| Opción | Tipo | Descripción |
|--------|------|-------------|
| `workflow.id` | string | ID explícito de ejecución del workflow |
| `workflow.task_queue` | string | Sobrescribir la cola de tareas |
| `workflow.execution_timeout` | duration | Timeout total de ejecución del workflow |
| `workflow.run_timeout` | duration | Timeout de una sola ejecución |
| `workflow.task_timeout` | duration | Timeout de procesamiento de una tarea del workflow |
| `workflow.id_conflict_policy` | string | `use_existing`, `fail`, `terminate_existing` |
| `workflow.id_reuse_policy` | string | `allow_duplicate`, `allow_duplicate_failed_only`, `reject_duplicate` |
| `workflow.execution_error_when_already_started` | boolean | Error si el workflow ya se está ejecutando |
| `workflow.retry_policy` | table | Política de reintentos (véase abajo) |
| `workflow.cron_schedule` | string | Expresión cron para workflows recurrentes |
| `workflow.memo` | table | Metadatos no indexados del workflow |
| `workflow.search_attributes` | table | Atributos indexados consultables |
| `workflow.enable_eager_start` | boolean | Iniciar la ejecución inmediatamente |
| `workflow.start_delay` | duration | Retraso antes de que se inicie el workflow |
| `workflow.summary` | string | Resumen mostrado en los metadatos del workflow de Temporal |
| `workflow.details` | string | Detalles mostrados en los metadatos del workflow de Temporal |
| `workflow.versioning_override` | string o table | Modo de actualización automática o versión fijada de deployment/build |
| `workflow.priority` | table | Clave de prioridad y ajustes opcionales de equidad |
| `workflow.parent_close_policy` | string | Comportamiento del hijo cuando se cierra el padre |
| `workflow.wait_for_cancellation` | boolean | Esperar a que finalice la cancelación |
| `workflow.namespace` | string | Sobrescribir el namespace de Temporal |
| `workflow.versioning_intent` | string o number | Intención de versionado del worker para el workflow hijo |
| `workflow.name` | string | Nombre alternativo del tipo de workflow hijo |

Los valores de duración aceptan cadenas (`"5s"`, `"10m"`, `"1h"`) o milisegundos como números.

Los alias heredados `temporal.workflow.*` siguen aceptándose por compatibilidad. El código nuevo debe usar los nombres canónicos `workflow.*` mostrados arriba.

Una versión fijada requiere tanto el modo como la versión del deployment:

```lua
["workflow.versioning_override"] = {
    mode = "pinned",
    version = {
        deployment_name = "orders",
        build_id = "orders-v2",
    },
}
```

Use la cadena `"auto_upgrade"` para seleccionar la actualización automática.

#### Política de Cierre del Padre

Controla qué sucede con los workflows hijos cuando el padre se cierra:

| Política | Comportamiento |
|----------|----------------|
| `"terminate"` | Terminar el workflow hijo |
| `"abandon"` | Dejar que el hijo continúe independientemente |
| `"request_cancel"` | Enviar solicitud de cancelación al hijo |

### Mensajes de Inicio

Encole señales junto con el inicio de un workflow. El primer mensaje de inicio no vacío se envía atómicamente con el inicio. Los mensajes de inicio restantes se envían secuencialmente en el orden del builder después de que se inicia el workflow, pero pueden intercalarse con señales enviadas de forma concurrente por otros callers:

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
if err then return nil, err end
```

Con la política de conflicto `use_existing`, los mensajes de inicio también se entregan cuando un segundo spawn se resuelve como un workflow existente:

```lua
-- First spawn starts the workflow with initial messages
local first = process
    .with_options({})
    :with_name("my-counter")
    :with_message("increment", {amount = 3})

local pid, first_err = first:spawn("app:counter_workflow", "app:worker", {initial = 0})
if first_err then return nil, first_err end

-- Second spawn reuses existing workflow and delivers new messages
local second = process
    .with_options({})
    :with_name("my-counter")
    :with_message("increment", {amount = 2})

local pid2, second_err = second:spawn("app:counter_workflow", "app:worker", {initial = 999})
if second_err then return nil, second_err end
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
if err then return nil, err end
```

Dentro del workflow (o cualquier activity que llame), leer el contexto via el módulo `ctx`:

```lua
local ctx = require("ctx")

local user_id, user_err = ctx.get("user_id")       -- "user-1"
if user_err then return nil, user_err end
local tenant, tenant_err = ctx.get("tenant")       -- "tenant-1"
if tenant_err then return nil, tenant_err end
local all, err = ctx.all()               -- {user_id="user-1", tenant="tenant-1", request_id="req-abc"}
if err then
    return nil, err
end
```

### Desde Handlers HTTP

```lua
local function handler()
    local req, req_err = http.request()
    if req_err then
        return nil, req_err
    end

    local body, body_err = req:body()
    if body_err then
        return nil, body_err
    end
    local order, decode_err = json.decode(body)
    if decode_err then
        return nil, decode_err
    end

    local request_id, header_err = req:header("X-Request-ID")
    if header_err then
        return nil, header_err
    end

    local spawner = process
        .with_context({request_id = request_id})
        :with_options({
            ["workflow.id"] = "order-" .. order.id,
            ["workflow.id_conflict_policy"] = "fail",
        })

    local pid, err = spawner:spawn(
        "app:order_workflow",
        "app:worker",
        order
    )

    local res, res_err = http.response()
    if res_err then
        return nil, res_err
    end
    if err then
        local status_err = res:set_status(409)
        if status_err then
            return nil, status_err
        end
        local write_err = res:write_json({error = tostring(err)})
        if write_err then return nil, write_err end
        return true
    end

    local status_err = res:set_status(202)
    if status_err then
        return nil, status_err
    end
    local write_err = res:write_json({
        workflow_id = tostring(pid),
        status = "started"
    })
    if write_err then return nil, write_err end
    return true
end
```

## Señales

Los workflows reciben señales a través del sistema de mensajería de procesos. Las señales son durables — sobreviven a los replays del workflow.

### Patrón de Buzón

Recibir todos los mensajes a través del buzón del proceso:

```lua
local function main(order)
    local inbox = process.inbox()

    while true do
        local msg, open = inbox:receive()
        if not open then
            return nil, errors.new({kind = errors.INTERNAL, message = "workflow inbox closed"})
        end
        local topic = msg:topic()

        if topic == "approve" then
            break
        elseif topic == "cancel" then
            local payload = msg:payload()
            local data
            if payload then
                local payload_err
                data, payload_err = payload:data()
                if payload_err then return nil, payload_err end
            end
            local reason = type(data) == "table" and data.reason or nil
            return {status = "cancelled", reason = reason}
        end
    end

    return process_order(order)
end
```

### Suscripción por Tema

Suscribirse a temas específicos usando `process.listen()`:

```lua
local function main(input)
    local results = {}
    local job_ch, job_err = process.listen("add_job")
    if job_err then return nil, job_err end
    local exit_ch, exit_err = process.listen("exit")
    if exit_err then return nil, exit_err end

    while true do
        local result = channel.select{
            job_ch:case_receive(),
            exit_ch:case_receive()
        }

        if result.channel == exit_ch then
            break
        elseif result.channel == job_ch then
            if not result.ok then
                break
            end
            local job_data = result.value
            local activity_result, err = funcs.call(
                "app:echo_activity",
                {job_id = job_data.id, data = job_data}
            )
            if err then
                return nil, err
            end
            table.insert(results, {
                job_id = job_data.id,
                result = activity_result
            })
        end
    end

    return {total_jobs = #results, results = results}
end
```

Por defecto, `process.listen()` devuelve datos de payload raw. Usar `{message = true}` para recibir objetos Message con información del remitente:

```lua
local ch, err = process.listen("request", {message = true})
if err then return nil, err end
local msg, open = ch:receive()
if not open then
    return nil, errors.new({kind = errors.INTERNAL, message = "request channel closed"})
end
local sender = msg:from()
local payload = msg:payload()
local data
if payload then
    local payload_err
    data, payload_err = payload:data()
    if payload_err then return nil, payload_err end
end
```

### Manejo serializado de señales

Use un único bucle `channel.select()` cuando las señales muten estado compartido del workflow. Esto conserva un orden determinista de mutación y permite que la rama `finish` retorne sin dejar coroutines de handlers bloqueadas:

```lua
local function main(input)
    local counter = input.initial or 0

    local function send_reply(pid, topic, payload)
        local sent, err = process.send(pid, topic, payload)
        if err then error(err) end
        return sent
    end

    local function message_data(msg)
        local payload = msg:payload()
        if not payload then return nil end
        return payload:data()
    end

    local increment_ch, increment_err = process.listen("increment", {message = true})
    if increment_err then return nil, increment_err end
    local decrement_ch, decrement_err = process.listen("decrement", {message = true})
    if decrement_err then return nil, decrement_err end
    local finish_ch, finish_err = process.listen("finish", {message = true})
    if finish_err then return nil, finish_err end

    while true do
        local result = channel.select{
            increment_ch:case_receive(),
            decrement_ch:case_receive(),
            finish_ch:case_receive()
        }
        if not result.ok then
            return nil, errors.new({kind = errors.INTERNAL, message = "signal channel closed"})
        end

        local msg = result.value
        local reply_to = msg:from()

        if result.channel == finish_ch then
            send_reply(reply_to, "ack")
            send_reply(reply_to, "ok", {message = "finishing", value = counter})
            return {final_counter = counter}
        end

        local data, payload_err = message_data(msg)
        if payload_err then return nil, payload_err end

        if type(data) ~= "table" or type(data.amount) ~= "number" then
            send_reply(reply_to, "nak", "amount must be a number")
        elseif result.channel == decrement_ch and counter - data.amount < 0 then
            send_reply(reply_to, "nak", "would result in negative value")
        else
            send_reply(reply_to, "ack")
            if result.channel == increment_ch then
                counter = counter + data.amount
            else
                counter = counter - data.amount
            end
            send_reply(reply_to, "ok", {value = counter})
        end
    end
end
```

### Reconocimiento de Señales

Implementar patrones de solicitud-respuesta enviando respuestas de vuelta al remitente:

```lua
-- Workflow side
local ch, err = process.listen("get_status", {message = true})
if err then return nil, err end
local msg, open = ch:receive()
if not open then return nil, errors.new({kind = errors.INTERNAL, message = "status channel closed"}) end
local sent, send_err = process.send(msg:from(), "status_response", {status = "processing", progress = 75})
if send_err then return nil, send_err end
```

```lua
-- Caller side
local response_ch, listen_err = process.listen("status_response")
if listen_err then return nil, listen_err end
local sent, send_err = process.send(workflow_pid, "get_status", {})
if send_err then return nil, send_err end

local timeout, timeout_err = time.after("5s")
if timeout_err then return nil, timeout_err end
local result = channel.select{
    response_ch:case_receive(),
    timeout:case_receive()
}

if result.channel == response_ch then
    if not result.ok then
        return nil, errors.new({kind = errors.INTERNAL, message = "status response channel closed"})
    end
    return result.value
end

if not result.ok then
    return nil, errors.new({kind = errors.INTERNAL, message = "status timeout channel closed"})
end
return nil, errors.new({kind = errors.TIMEOUT, message = "status request timed out", retryable = true})
```

### Señalización Entre Workflows

Los workflows pueden enviar señales a otros workflows usando su PID:

```lua
-- Sender workflow
local function main(input)
    local target_pid = input.target
    local response_ch, listen_err = process.listen("cross_host_pong")
    if listen_err then return nil, listen_err end

    local ok, err = process.send(target_pid, "cross_host_ping", {data = "hello"})
    if err then
        return {ok = false, error = tostring(err)}
    end

    local response, open = response_ch:receive()
    if not open then
        return {ok = false, error = "cross_host_pong channel closed"}
    end
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

Lanzar un workflow hijo sin bloquear, luego esperar su completación via eventos:

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
local event, open = events_ch:receive()
if not open then
    return nil, errors.new({kind = errors.INTERNAL, message = "process event channel closed"})
end

if event.kind == process.event.EXIT then
    local child_result = event.result.value
    local child_error = event.result.error
end
```

### Propagación de Errores desde Hijos

Cuando un workflow hijo devuelve un error, aparece en el evento EXIT:

```lua
local events_ch = process.events()
local child_pid, err = process.spawn(
    "app:error_child_workflow",
    "app:worker"
)
if err then
    return nil, err
end

local event, open = events_ch:receive()
if not open then
    return nil, errors.new({kind = errors.INTERNAL, message = "process event channel closed"})
end
if event.result.error then
    local child_err = event.result.error
    -- Error objects have kind(), retryable(), message() methods
    print(child_err:kind())       -- e.g. "NotFound"
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

### Monitoreo Posterior al Inicio

Monitorear un workflow después de que ya ha iniciado:

```lua
local pid, err = process.spawn(
    "app:long_workflow",
    "app:worker",
    {iterations = 100}
)
if err then
    return nil, err
end

-- Monitor later
local ok, monitor_err = process.monitor(pid)
if monitor_err then
    return nil, monitor_err
end

local events_ch = process.events()
local event, open = events_ch:receive()  -- EXIT when workflow completes
if not open then
    return nil, errors.new({kind = errors.INTERNAL, message = "process event channel closed"})
end
```

### Enlace Posterior al Inicio

Enlazar a un workflow en ejecución para recibir LINK_DOWN en terminación anormal:

```lua
local ok, err = process.set_options({trap_links = true})
if err then
    return nil, err
end

local pid, err = process.spawn(
    "app:long_workflow",
    "app:worker",
    {iterations = 100}
)
if err then
    return nil, err
end

-- Link after workflow has started
time.sleep("200ms")
local linked, link_err = process.link(pid)
if link_err then return nil, link_err end

-- If workflow is terminated, receive LINK_DOWN
local terminated, terminate_err = process.terminate(pid)
if terminate_err then return nil, terminate_err end

local events_ch = process.events()
local event, open = events_ch:receive()
if not open then
    return nil, errors.new({kind = errors.INTERNAL, message = "process event channel closed"})
end
-- event.kind == process.event.LINK_DOWN
```

Los eventos LINK_DOWN requieren `trap_links = true` en las opciones del proceso. Sin él, la terminación de un proceso enlazado propaga el fallo.

### Desmonitorear / Desenlazar

Eliminar monitoreo o enlace:

```lua
local unmonitored, unmonitor_err = process.unmonitor(pid)
if unmonitor_err then return nil, unmonitor_err end
local unlinked, unlink_err = process.unlink(pid)
if unlink_err then return nil, unlink_err end
```

Tras desmonitorear o desenlazar, los eventos para ese proceso ya no se entregan.

## Terminación y Cancelación

### Terminar

Terminar forzosamente un workflow en ejecución:

```lua
local ok, err = process.terminate(workflow_pid)
```

Los callers monitorizados reciben un evento EXIT con un error.

### Cancelar

Solicitar cancelación controlada con un motivo opcional:

```lua
local ok, err = process.cancel(workflow_pid, "cancelled by operator")
```

## Trabajo Concurrente

Usar `coroutine.spawn()` y canales para trabajo paralelo dentro de workflows:

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
        local r, open = results:receive()
        if not open then
            return nil, errors.new({kind = errors.INTERNAL, message = "results channel closed"})
        end
        total = total + r.result
        table.insert(processed, r)
    end

    return {total = total, processed = processed}
end
```

Todas las operaciones de canal y sleeps dentro de coroutines son seguras para replay.

## Temporizadores

Los temporizadores durables sobreviven a los reinicios:

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

El código del workflow debe ser determinista. Las mismas entradas deben producir la misma secuencia de comandos.

### Operaciones Seguras para Replay

Estas operaciones se interceptan automáticamente y sus resultados se registran. En el replay, se devuelven los valores registrados:

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
local bytes = crypto.random.bytes(32)

-- Child workflows
local result = workflow.exec("app:child", input)

-- Versioning
local v = workflow.version("change-1", 1, 2)
```

### No Deterministas (Evitar)

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

### Errores de Activities

Los errores de activities llevan metadatos estructurados:

```lua
local result, err = funcs.call("app:risky_activity", order)
if err then
    print(err:kind())       -- error classification (e.g. "NotFound", "Internal")
    print(err:retryable())  -- whether the error is retryable
    print(err:message())    -- human-readable error message
end
```

### Modos de Fallo de Activities

Configurar el comportamiento de reintento para llamadas a activities:

```lua
local executor = funcs.new():with_options({
    ["activity.retry_policy"] = {
        maximum_attempts = 1,
    }
})

local result, err = executor:call("app:unreliable_activity", input)
if err then
    local kind = err:kind()         -- "Internal" for runtime errors
    local retryable = err:retryable()
end
```

### Errores de Workflows Hijos

Los errores de workflows hijos (via `process.exec` o eventos EXIT) llevan los mismos metadatos:

```lua
local result, err = process.exec("app:error_workflow", "app:worker")
if err then
    print(err:kind())       -- e.g. "NotFound"
    print(err:retryable())  -- false
    print(err:message())    -- error details
end
```

## Patrón de Compensación (Saga)

```lua
local function run_compensations(compensations)
    local first_err
    for _, comp in ipairs(compensations) do
        local _, err = funcs.call(comp.action, comp.args)
        if err and not first_err then
            first_err = err
        end
    end
    if first_err then return nil, first_err end
    return true
end

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
        local _, compensation_err = run_compensations(compensations)
        if compensation_err then
            return {status = "failed", step = "payment", error = tostring(err), compensation_error = tostring(compensation_err)}
        end
        return {status = "failed", step = "payment", error = tostring(err)}
    end
    table.insert(compensations, 1, {
        action = "app:refund_payment",
        args = payment.id
    })

    local shipment, err = funcs.call("app:ship_order", order.shipping)
    if err then
        local _, compensation_err = run_compensations(compensations)
        if compensation_err then
            return {status = "failed", step = "shipping", error = tostring(err), compensation_error = tostring(compensation_err)}
        end
        return {status = "failed", step = "shipping", error = tostring(err)}
    end

    return {status = "completed", tracking = shipment.tracking}
end
```

Las compensaciones se ejecutan en orden inverso al de registro. Si falla más de una compensación, el workflow aun así intenta las acciones restantes e informa del primer fallo mediante `compensation_error`.

## Ver También

- [Visión general](./overview.md) - Configuración de cliente y worker
- [Activities](./activities.md) - Definiciones y opciones de activities
- [Process](../lua/core/process.md) - API de gestión de procesos
- [Funciones](../lua/core/funcs.md) - Invocación de funciones
- [Canales](../lua/core/channel.md) - Operaciones de canales
