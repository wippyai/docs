---
title: "Procesos y Mensajería"
description: "Genere procesos aislados y comuníquese mediante paso de mensajes."
---

# Procesos y Mensajería

Genere procesos aislados y comuníquese mediante paso de mensajes.

## Resumen

Los procesos proporcionan unidades de ejecución aisladas que se comunican mediante paso de mensajes. Cada proceso tiene su propio inbox y puede suscribirse a temas de mensajes específicos.

Esta página es una introducción: cada fragmento muestra una API de forma aislada. Para una aplicación completa y ejecutable que conecta generación, monitoreo y mensajería, consulta el tutorial de [Echo Service](tutorials/echo-service.md).

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
    return false, "spawn failed: " .. err
end

-- pid es un identificador string para el proceso generado
print("Started worker:", pid)
```

Parámetros:
- Referencia de entrada (p. ej., `"app.test.process:echo_worker"`)
- Referencia al host (p. ej., `"app:processes"`)
- Argumentos opcionales pasados a la función main del worker

### Obtener tu Propio PID

```lua
local my_pid = process.pid()
-- Devuelve el PID del proceso actual como string
```

## Paso de Mensajes

Los mensajes usan un sistema de enrutamiento basado en temas. Envíe mensajes a PIDs con un tema y luego recíbalos por suscripción a tema o por inbox.

### Envío de Mensajes

```lua
-- Enviar a proceso por PID
local sent, err = process.send(worker_pid, "messages", "hello from parent")
if err then
    return false, "send failed: " .. err
end

-- send devuelve (bool, error)
```

### Recepción por Suscripción a Tema

Suscríbase a temas específicos usando `process.listen()`:

```lua
-- Worker que escucha mensajes en el tema "messages"
local function main()
    local ch = process.listen("messages")

    local msg = ch:receive()
    if msg then
        -- msg es el payload directamente
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
            -- Los mensajes a "specific_topic" llegan aquí
            local payload = result.value
        elseif result.channel == inbox_ch then
            -- Los mensajes a CUALQUIER otro tema llegan aquí
            local msg = result.value
            print("Inbox got:", msg:topic(), msg:payload():data())
        end
    end
end
```

### Modo Mensaje para Información del Remitente

Use `{ message = true }` para acceder al PID del remitente y al tema:

```lua
-- Worker que devuelve los mensajes al remitente
local function main()
    local ch = process.listen("echo", { message = true })

    local msg = ch:receive()
    if msg then
        local sender = msg:from()
        local data = msg:payload():data()

        if sender then
            process.send(sender, "reply", data)
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
    return false, "spawn failed: " .. err
end

-- Esperar evento EXIT
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

-- Generar sin monitoreo
local worker_pid, err = process.spawn("app.test.process:long_worker", "app:processes")
if err then
    return false, "spawn failed: " .. err
end

-- Añadir monitoreo explícitamente
local ok, monitor_err = process.monitor(worker_pid)
if monitor_err then
    return false, "monitor failed: " .. monitor_err
end

-- Ahora recibirá eventos EXIT de este worker
```

Detener el monitoreo:

```lua
local ok, err = process.unmonitor(worker_pid)
```

## Enlace de Procesos

Enlace procesos para la gestión coordinada del ciclo de vida. Los procesos enlazados reciben eventos LINK_DOWN cuando los procesos enlazados fallan.

### Generar Proceso Enlazado

```lua
-- El hijo termina si el padre falla (a menos que trap_links esté activo)
local pid, err = process.spawn_linked("app.test.process:child_worker", "app:processes")
if err then
    return false, "spawn_linked failed: " .. err
end
```

### Enlace Explícito

```lua
-- Enlazar con proceso existente
local ok, err = process.link(target_pid)
if err then
    return false, "link failed: " .. err
end

-- Desenlazar
local ok, err = process.unlink(target_pid)
```

### Manejar Eventos LINK_DOWN

Por defecto, LINK_DOWN hace que el proceso falle. Active `trap_links` para recibirlo como evento:

```lua
local function main()
    -- Activar trap_links para recibir eventos LINK_DOWN en vez de fallar
    local ok, err = process.set_options({ trap_links = true })
    if not ok then
        return false, "set_options failed: " .. err
    end

    -- Verificar que trap_links está activo
    local opts = process.get_options()
    if not opts.trap_links then
        return false, "trap_links should be true"
    end

    local events_ch = process.events()

    -- Generar un proceso enlazado que fallará
    local error_pid, err2 = process.spawn_linked(
        "app.test.process:error_exit_worker",
        "app:processes"
    )
    if err2 then
        return false, "spawn error worker failed: " .. err2
    end

    -- Esperar evento LINK_DOWN
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
        -- Manejar el fallo sin hacer crash
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

    -- Registrar el proceso actual con un nombre
    local ok, err = process.registry.register(test_name)
    if err then
        return false, "register failed: " .. err
    end

    -- Buscar el nombre registrado
    local pid, lookup_err = process.registry.lookup(test_name)
    if lookup_err then
        return false, "lookup failed: " .. lookup_err
    end

    -- Verificar que resuelve a nuestro PID
    if pid ~= process.pid() then
        return false, "lookup returned wrong pid"
    end

    return true
end

return { main = main }
```

### Desregistrar Nombres

```lua
-- Desregistrar explícitamente
local unregistered = process.registry.unregister(test_name)
if not unregistered then
    print("Name was not registered")
end

-- La búsqueda tras desregistrar devuelve nil + error
local pid, err = process.registry.lookup(test_name)
-- pid será nil, err será no-nil
```

Los nombres se liberan automáticamente cuando el proceso termina.

## Ejemplo Completo: Pool de Workers Monitoreados

Este ejemplo muestra un proceso padre que genera múltiples workers monitoreados y rastrea su finalización.

```lua
-- Proceso padre
local time = require("time")

local function main()
    local events_ch = process.events()

    -- Rastrear workers generados
    local workers = {}
    local worker_count = 5

    -- Generar múltiples workers monitoreados
    for i = 1, worker_count do
        local worker_pid, err = process.spawn_monitored(
            "app.test.process:task_worker",
            "app:processes",
            { task_id = i, value = i * 10 }
        )

        if err then
            return false, "spawn worker " .. i .. " failed: " .. err
        end

        workers[worker_pid] = { task_id = i, started = os.time() }
    end

    -- Esperar a que todos los workers terminen
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
    -- Simular trabajo
    time.sleep("100ms")

    -- Procesar tarea
    local result = task.value * 2

    return result
end

return { main = main }
```

## Siguientes Pasos

- [Referencia del Módulo Process](lua/core/process.md) - Documentación completa de la API
- [Canales](tutorials/channels.md) - Operaciones de canales para el manejo de mensajes
