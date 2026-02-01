# Procesos y Mensajería

Genere procesos aislados y comuníquese vía paso de mensajes.

## Resumen

Los procesos proporcionan unidades de ejecución aisladas que se comunican a través de paso de mensajes. Cada proceso tiene su propio inbox y puede suscribirse a tópicos de mensajes específicos.

Conceptos clave:
- Generar procesos con `process.spawn()` y variantes
- Enviar mensajes a PIDs o nombres registrados vía tópicos
- Recibir mensajes usando `process.listen()` o `process.inbox()`
- Monitorear ciclo de vida de procesos con eventos
- Enlazar procesos para manejo coordinado de fallos

## Generar Procesos

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
- Referencia de entrada (ej. `"app.test.process:echo_worker"`)
- Referencia de host (ej. `"app:processes"`)
- Argumentos opcionales pasados a la función main del worker

### Obtener Su Propio PID

```lua
local my_pid = process.pid()
-- Retorna string PID del proceso actual
```

## Paso de Mensajes

Los mensajes usan un sistema de routing basado en tópicos. Envíe mensajes a PIDs con un tópico, luego reciba vía suscripción a tópico o inbox.

### Enviar Mensajes

```lua
-- Enviar a proceso por PID
local sent, err = process.send(worker_pid, "messages", "hello from parent")
if err then
    return false, "send failed: " .. err
end

-- send retorna (bool, error)
```

### Recibir vía Suscripción a Tópico

Suscríbase a tópicos específicos usando `process.listen()`:

```lua
-- Worker que escucha mensajes en tópico "messages"
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

### Recibir vía Inbox

Inbox recibe mensajes que no coinciden con ningún listener de tópico:

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
            -- Mensajes a "specific_topic" llegan aquí
            local payload = result.value
        elseif result.channel == inbox_ch then
            -- Mensajes a CUALQUIER OTRO tópico llegan aquí
            local msg = result.value
            print("Inbox got:", msg.topic, msg.payload)
        end
    end
end
```

### Modo Message para Info del Remitente

Use `{ message = true }` para acceder PID del remitente y tópico:

```lua
-- Worker que hace eco de mensajes al remitente
local function main()
    local ch = process.listen("echo", { message = true })

    local msg = ch:receive()
    if msg then
        local sender = msg:from()
        local payload = msg:payload()

        if sender then
            process.send(sender, "reply", payload)
        end
        return true
    end

    return false
end

return { main = main }
```

## Monitorear Procesos

Monitoree procesos para recibir eventos EXIT cuando terminan.

### Spawn con Monitoreo

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
    if event.error then
        print("Exit error:", event.error)
    end
    -- Acceder valor de retorno vía event.result
end
```

### Monitoreo Explícito

Monitorear un proceso ya en ejecución:

```lua
local events_ch = process.events()

-- Spawn sin monitoreo
local worker_pid, err = process.spawn("app.test.process:long_worker", "app:processes")
if err then
    return false, "spawn failed: " .. err
end

-- Agregar monitoreo explícitamente
local ok, monitor_err = process.monitor(worker_pid)
if monitor_err then
    return false, "monitor failed: " .. monitor_err
end

-- Ahora recibirá eventos EXIT para este worker
```

Detener monitoreo:

```lua
local ok, err = process.unmonitor(worker_pid)
```

## Enlace de Procesos

Enlace procesos para gestión coordinada de ciclo de vida. Los procesos enlazados reciben eventos LINK_DOWN cuando procesos enlazados fallan.

### Spawn de Proceso Enlazado

```lua
-- Hijo termina si padre crashea (a menos que trap_links esté establecido)
local pid, err = process.spawn_linked("app.test.process:child_worker", "app:processes")
if err then
    return false, "spawn_linked failed: " .. err
end
```

### Enlace Explícito

```lua
-- Enlazar a proceso existente
local ok, err = process.link(target_pid)
if err then
    return false, "link failed: " .. err
end

-- Desenlazar
local ok, err = process.unlink(target_pid)
```

### Manejar Eventos LINK_DOWN

Por defecto, LINK_DOWN causa que el proceso falle. Habilite `trap_links` para recibirlo como evento:

```lua
local function main()
    -- Habilitar trap_links para recibir eventos LINK_DOWN en lugar de crashear
    local ok, err = process.set_options({ trap_links = true })
    if not ok then
        return false, "set_options failed: " .. err
    end

    local events_ch = process.events()

    -- Spawn un proceso enlazado que fallará
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
        -- Manejar gracefully en lugar de crashear
        return true
    end

    return false, "expected LINK_DOWN, got: " .. tostring(event.kind)
end

return { main = main }
```

## Registry de Procesos

Registre nombres para procesos para habilitar lookups y mensajería por nombre.

### Registrar Nombres

```lua
local function main()
    local test_name = "my_service_" .. tostring(os.time())

    -- Registrar proceso actual con un nombre
    local ok, err = process.registry.register(test_name)
    if err then
        return false, "register failed: " .. err
    end

    -- Lookup del nombre registrado
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

-- Lookup después de desregistrar retorna nil + error
local pid, err = process.registry.lookup(test_name)
-- pid será nil, err será non-nil
```

Los nombres se liberan automáticamente cuando el proceso termina.

## Resumen

Generación de procesos:
- `process.spawn()` - Spawn básico, retorna PID
- `process.spawn_monitored()` - Spawn con monitoreo automático
- `process.spawn_linked()` - Spawn con acoplamiento de ciclo de vida
- `process.pid()` - Obtener PID del proceso actual

Mensajería:
- `process.send(pid, topic, payload)` - Enviar mensaje a PID
- `process.listen(topic)` - Suscribirse a tópico, recibir payloads
- `process.listen(topic, { message = true })` - Recibir mensaje completo con `:from()`, `:payload()`, `:topic()`
- `process.inbox()` - Recibir mensajes no coincidentes por listeners

Monitoreo:
- `process.events()` - Canal para eventos EXIT y LINK_DOWN
- `process.monitor(pid)` - Monitorear proceso existente
- `process.unmonitor(pid)` - Detener monitoreo

Enlace:
- `process.link(pid)` - Enlazar a proceso
- `process.unlink(pid)` - Desenlazar de proceso
- `process.set_options({ trap_links = true })` - Recibir LINK_DOWN como evento en lugar de crashear
- `process.get_options()` - Obtener opciones del proceso actual

Registry:
- `process.registry.register(name)` - Registrar nombre para proceso actual
- `process.registry.lookup(name)` - Encontrar PID por nombre
- `process.registry.unregister(name)` - Remover registro de nombre

## Ver También

- [Referencia del Módulo Process](lua-process.md) - Documentación completa de API
- [Canales](channels.md) - Operaciones de canal para manejo de mensajes
