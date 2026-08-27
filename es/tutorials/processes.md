---
title: "Introducción a procesos y mensajería"
description: "Consulta las API de creación de procesos, mensajería, supervisión, enlaces y registro de nombres."
---

# Introducción a procesos y mensajería

Aprende las API de procesos para crear trabajo aislado, intercambiar mensajes, supervisar ciclos de vida, enlazar fallos y registrar nombres de procesos.

## Resumen

Los procesos proporcionan unidades de ejecución aisladas que se comunican mediante paso de mensajes. Cada proceso tiene su propio inbox y puede suscribirse a temas de mensajes específicos.

**Clasificación:** introducción de referencia/API. Cada fragmento ilustra una operación de forma aislada; la página no es un proyecto autónomo. Para ver una aplicación completa que combina creación, supervisión y mensajería, consulta el tutorial de [Servicio Echo](echo-service.md).

## Contexto y dependencias

Los ejemplos presuponen que se ejecutan dentro de una entrada Lua ejecutable y que existe un `process.host` en ejecución registrado como `app:processes`. Los ID de entrada como `app.test.process:echo_worker` son marcadores de posición para entradas de proceso que debe definir el proyecto. Las API `process` y `channel` son globales ambientales; el acceso directo `process.*` es idiomático y `require("process")` también se resuelve sin una declaración de módulo. Los fragmentos que llaman a `time.after()` requieren `local time = require("time")` y `time` en la lista `modules` de la entrada.

La creación, el envío, la supervisión, el enlace, la cancelación, la terminación y la modificación del registro son operaciones protegidas. Asigna a la entrada ejecutora un actor y políticas solo para las operaciones y los recursos que necesita; de lo contrario, el modo estricto las deniega.

Conceptos clave:
- Generar procesos con `process.spawn()` y sus variantes
- Enviar mensajes a PIDs o nombres registrados mediante temas
- Recibir mensajes usando `process.listen()` o `process.inbox()`
- Monitorear el ciclo de vida del proceso con eventos
- Enlazar procesos para el manejo coordinado de fallos

## Generación de Procesos

Genere un nuevo proceso desde una referencia de entrada.

```lua
local pid, err = process.spawn("app.test.process:echo_worker", "app:processes", "hello")
if err then
    return false, "spawn failed: " .. tostring(err)
end

-- pid is a string identifier for the spawned process
print("Started worker:", pid)
```

Parámetros:
- Referencia de entrada (p. ej., `"app.test.process:echo_worker"`)
- Referencia al host (p. ej., `"app:processes"`)
- Argumentos opcionales pasados a la función main del worker

### Obtener tu Propio PID

```lua
local my_pid = process.pid()
-- Returns string PID of current process
```

## Paso de Mensajes

Los mensajes usan un sistema de enrutamiento basado en temas. Envíe mensajes a PIDs con un tema y luego recíbalos por suscripción a tema o por inbox.

### Envío de Mensajes

```lua
-- Send to process by PID
local sent, err = process.send(worker_pid, "messages", "hello from parent")
if err then
    return false, "send failed: " .. tostring(err)
end

-- send returns (bool, error)
```

### Recepción por Suscripción a Tema

Suscríbase a temas específicos usando `process.listen()`:

```lua
-- Worker that listens for messages on "messages" topic
local function main()
    local ch = process.listen("messages")

    local msg, ok = ch:receive()
    if ok then
        -- msg is the payload directly
        print("Received:", msg)
        return true
    end

    return false
end

return { main = main }
```

### Recepción por Inbox

El inbox recibe mensajes que no coinciden con ningún listener de tema:

```lua
local function main()
    local inbox_ch = process.inbox()
    local specific_ch = process.listen("specific_topic")

    while true do
        local result = channel.select({
            specific_ch:case_receive(),
            inbox_ch:case_receive()
        })

        if result.channel == specific_ch then
            -- Messages to "specific_topic" arrive here
            local payload = result.value
        elseif result.channel == inbox_ch then
            -- Messages to any OTHER topic arrive here
            local msg = result.value
            print("Inbox got:", msg:topic(), msg:payload():data())
        end
    end
end
```

### Modo Mensaje para Información del Remitente

Use `{ message = true }` para acceder al PID del remitente y al tema:

```lua
-- Worker that echoes messages back to sender
local function main()
    local ch = process.listen("echo", { message = true })

    local msg = ch:receive()
    if msg then
        local sender = msg:from()
        local data = msg:payload():data()

        if sender then
            local _, send_err = process.send(sender, "reply", data)
            if send_err then
                return false, "reply failed: " .. tostring(send_err)
            end
        end
        return true
    end

    return false
end

return { main = main }
```

## Monitoreo de Procesos

Monitoree procesos para recibir eventos EXIT cuando terminen.

### Generar con Monitoreo

```lua
local events_ch = process.events()

local worker_pid, err = process.spawn_monitored(
    "app.test.process:events_exit_worker",
    "app:processes"
)
if err then
    return false, "spawn failed: " .. tostring(err)
end

-- Wait for EXIT event
local timeout = time.after("3s")
local result = channel.select {
    events_ch:case_receive(),
    timeout:case_receive(),
}

if result.channel == timeout then
    return false, "timeout waiting for EXIT event"
end

local event = result.value
if event.kind == process.event.EXIT then
    print("Worker exited:", event.from)
    if event.result and event.result.error then
        print("Exit error:", event.result.error)
    elseif event.result then
        print("Return value:", event.result.value)
    end
end
```

### Monitoreo Explícito

Monitorear un proceso ya en ejecución:

```lua
local events_ch = process.events()

-- Spawn without monitoring
local worker_pid, err = process.spawn("app.test.process:long_worker", "app:processes")
if err then
    return false, "spawn failed: " .. tostring(err)
end

-- Add monitoring explicitly
local ok, monitor_err = process.monitor(worker_pid)
if monitor_err then
    return false, "monitor failed: " .. tostring(monitor_err)
end

-- Now will receive EXIT events for this worker
```

Detener el monitoreo:

```lua
local ok, err = process.unmonitor(worker_pid)
if err then
    return false, "unmonitor failed: " .. tostring(err)
end
```

## Enlace de Procesos

Enlaza procesos para coordinar la gestión del ciclo de vida. Una salida anómala termina de forma predeterminada los pares enlazados. Un par con `trap_links=true` permanece en ejecución y recibe en su lugar un evento `LINK_DOWN`.

### Generar Proceso Enlazado

```lua
-- Child terminates if parent crashes (unless trap_links is set)
local pid, err = process.spawn_linked("app.test.process:child_worker", "app:processes")
if err then
    return false, "spawn_linked failed: " .. tostring(err)
end
```

### Enlace Explícito

```lua
-- Link to existing process
local ok, err = process.link(target_pid)
if err then
    return false, "link failed: " .. tostring(err)
end

-- Unlink
local ok, err = process.unlink(target_pid)
if err then
    return false, "unlink failed: " .. tostring(err)
end
```

### Manejar Eventos LINK_DOWN

De forma predeterminada, la salida anómala de un par enlazado termina el proceso actual; no se entrega ningún evento Lua `LINK_DOWN`. Activa `trap_links` para permanecer en ejecución y recibir el evento:

```lua
local function main()
    -- Enable trap_links to receive LINK_DOWN events instead of crashing
    local ok, err = process.set_options({ trap_links = true })
    if not ok then
        return false, "set_options failed: " .. tostring(err)
    end

    -- Verify trap_links is enabled
    local opts = process.get_options()
    if not opts.trap_links then
        return false, "trap_links should be true"
    end

    local events_ch = process.events()

    -- Spawn a linked process that will fail
    local error_pid, err2 = process.spawn_linked(
        "app.test.process:error_exit_worker",
        "app:processes"
    )
    if err2 then
        return false, "spawn error worker failed: " .. tostring(err2)
    end

    -- Wait for LINK_DOWN event
    local timeout = time.after("2s")
    local result = channel.select {
        events_ch:case_receive(),
        timeout:case_receive(),
    }

    if result.channel == timeout then
        return false, "timeout waiting for LINK_DOWN"
    end

    local event = result.value
    if event.kind == process.event.LINK_DOWN then
        print("Linked process died:", event.from)
        -- Handle gracefully instead of crashing
        return true
    end

    return false, "expected LINK_DOWN, got: " .. tostring(event.kind)
end

return { main = main }
```

## Registro de Procesos

Registre nombres para procesos para habilitar búsquedas y mensajería por nombre.

### Registrar Nombres

```lua
local function main()
    local test_name = "my_service_" .. tostring(os.time())

    -- Register current process with a name
    local ok, err = process.registry.register(test_name)
    if err then
        return false, "register failed: " .. tostring(err)
    end

    -- Lookup the registered name
    local pid, lookup_err = process.registry.lookup(test_name)
    if lookup_err then
        return false, "lookup failed: " .. tostring(lookup_err)
    end

    -- Verify it resolves to our PID
    if pid ~= process.pid() then
        return false, "lookup returned wrong pid"
    end

    return true
end

return { main = main }
```

### Desregistrar Nombres

```lua
-- Unregister explicitly
local unregistered = process.registry.unregister(test_name)
if not unregistered then
    print("Name was not registered")
end

-- Lookup after unregister returns nil + error
local pid, err = process.registry.lookup(test_name)
-- pid will be nil, err will be non-nil
```

Los nombres se liberan automáticamente cuando el proceso termina.

## Ejemplo: pool de workers supervisados

Este ejemplo parcial ilustra un proceso padre que crea varios workers supervisados y rastrea su finalización. Para utilizarlo, define las entradas del padre y de `app.test.process:task_worker`, el host `app:processes`, las políticas de proceso necesarias y `time` en las listas de módulos de ambas entradas.

```lua
-- Parent process
local time = require("time")

local function main()
    local events_ch = process.events()

    -- Track spawned workers
    local workers = {}
    local worker_count = 5

    -- Spawn multiple monitored workers
    for i = 1, worker_count do
        local worker_pid, err = process.spawn_monitored(
            "app.test.process:task_worker",
            "app:processes",
            { task_id = i, value = i * 10 }
        )

        if err then
            return false, "spawn worker " .. i .. " failed: " .. tostring(err)
        end

        workers[worker_pid] = { task_id = i, started = os.time() }
    end

    -- Wait for all workers to complete
    local completed = 0
    local timeout = time.after("10s")

    while completed < worker_count do
        local result = channel.select {
            events_ch:case_receive(),
            timeout:case_receive(),
        }

        if result.channel == timeout then
            return false, "timeout waiting for workers"
        end

        local event = result.value
        if event.kind == process.event.EXIT then
            local worker = workers[event.from]
            if worker then
                if event.result and event.result.error then
                    print("Worker " .. worker.task_id .. " failed:", event.result.error)
                else
                    print("Worker " .. worker.task_id .. " completed:", event.result and event.result.value)
                end
                completed = completed + 1
            end
        end
    end

    return true
end

return { main = main }
```

Proceso worker:

```lua
-- task_worker.lua
local time = require("time")

local function main(task)
    -- Simulate work
    time.sleep("100ms")

    -- Process task
    local result = task.value * 2

    return result
end

return { main = main }
```

## Siguientes Pasos

- [Referencia del módulo Process](../lua/core/process.md) — Documentación de la API de procesos
- [Canales](channels.md) — Operaciones de canales para gestionar mensajes
