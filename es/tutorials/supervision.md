# Supervision de Procesos

Monitoree y enlace procesos para construir sistemas tolerantes a fallos.

## Monitoreo vs Enlace

**Monitoreo** proporciona observacion unidireccional:
- El padre monitorea al hijo
- El hijo termina, el padre recibe evento EXIT
- El padre continua ejecutando

**Enlace** crea vinculacion bidireccional de destino:
- Padre e hijo estan enlazados
- Si alguno falla, ambos terminan
- A menos que `trap_links=true` este establecido

```
MONITOREO (unidireccional)        ENLACE (bidireccional)
┌──────────┐                      ┌──────────┐
│ Padre    │                      │ Padre    │
│ monitorea│                      │ enlazado │
└────┬─────┘                      └────┬─────┘
     │ evento EXIT                     │ LINK_DOWN
     │ (padre continua)                │ (ambos mueren)
┌────▼─────┐                      ┌────▼─────┐
│  Hijo    │                      │  Hijo    │
│ termina  │                      │ termina  │
└──────────┘                      └──────────┘
```

## Monitoreo de Procesos

### Spawn con Monitoreo

Use `process.spawn_monitored()` para generar y monitorear en una llamada:

```lua
local function main()
    local events_ch = process.events()

    -- Generar worker y comenzar monitoreo
    local worker_pid, err = process.spawn_monitored(
        "app.workers:task_worker",
        "app:processes"
    )
    if err then
        return nil, "spawn failed: " .. tostring(err)
    end

    -- Esperar a que worker complete
    local event = events_ch:receive()

    if event.kind == process.event.EXIT then
        print("Worker exited:", event.from)
        if event.result then
            print("Result:", event.result.value)
        end
        if event.result and event.result.error then
            print("Error:", event.result.error)
        end
    end
end
```

### Monitorear Proceso Existente

Llame `process.monitor()` para comenzar a monitorear un proceso ya en ejecucion:

```lua
local function main()
    local time = require("time")
    local events_ch = process.events()

    -- Spawn sin monitoreo
    local worker_pid, err = process.spawn(
        "app.workers:long_worker",
        "app:processes"
    )
    if err then
        return nil, "spawn failed: " .. tostring(err)
    end

    -- Comenzar monitoreo despues
    local ok, monitor_err = process.monitor(worker_pid)
    if monitor_err then
        return nil, "monitor failed: " .. tostring(monitor_err)
    end

    -- Cancelar el worker
    time.sleep("5ms")
    process.cancel(worker_pid, "100ms")

    -- Recibir evento EXIT
    local event = events_ch:receive()
    if event.kind == process.event.EXIT then
        print("Worker terminated:", event.from)
    end
end
```

### Detener Monitoreo

Use `process.unmonitor()` para dejar de recibir eventos EXIT:

```lua
local function main()
    local time = require("time")
    local events_ch = process.events()

    -- Spawn y monitorear
    local worker_pid, err = process.spawn_monitored(
        "app.workers:long_worker",
        "app:processes"
    )

    time.sleep("5ms")

    -- Detener monitoreo
    local ok, unmon_err = process.unmonitor(worker_pid)
    if unmon_err then
        return nil, "unmonitor failed: " .. tostring(unmon_err)
    end

    -- Cancelar worker
    process.cancel(worker_pid, "100ms")

    -- No se recibira evento EXIT (desmonitoreamos)
    local timeout = time.after("200ms")
    local result = channel.select {
        events_ch:case_receive(),
        timeout:case_receive(),
    }

    if result.channel == events_ch then
        return nil, "should not receive event after unmonitor"
    end
end
```

## Enlace de Procesos

### Enlace Explicito

Use `process.link()` para crear un enlace bidireccional:

```lua
-- Worker que enlaza a proceso destino
local function worker_main()
    local time = require("time")
    local events_ch = process.events()
    local inbox_ch = process.inbox()

    -- Habilitar trap_links para recibir eventos LINK_DOWN
    process.set_options({ trap_links = true })

    -- Recibir PID destino del remitente
    local msg = inbox_ch:receive()
    local target_pid = msg:payload():data()
    local sender = msg:from()

    -- Crear enlace bidireccional
    local ok, err = process.link(target_pid)
    if err then
        return nil, "link failed: " .. tostring(err)
    end

    -- Notificar remitente que estamos enlazados
    process.send(sender, "linked", process.pid())

    -- Esperar LINK_DOWN cuando destino termina
    local timeout = time.after("3s")
    local result = channel.select {
        events_ch:case_receive(),
        timeout:case_receive(),
    }

    if result.channel == events_ch then
        local event = result.value
        if event.kind == process.event.LINK_DOWN then
            return "LINK_DOWN_RECEIVED"
        end
    end

    return nil, "no LINK_DOWN received"
end
```

### Spawn con Enlace

Use `process.spawn_linked()` para generar y enlazar en una llamada:

```lua
local function parent_main()
    -- Habilitar trap_links para manejar muerte del hijo
    process.set_options({ trap_links = true })

    local events_ch = process.events()

    -- Spawn y enlazar a hijo
    local child_pid, err = process.spawn_linked(
        "app.workers:child_worker",
        "app:processes"
    )
    if err then
        return nil, "spawn_linked failed: " .. tostring(err)
    end

    -- Si hijo muere, recibimos LINK_DOWN
    local event = events_ch:receive()
    if event.kind == process.event.LINK_DOWN then
        print("Child died:", event.from)
    end
end
```

## Trap Links

Por defecto, cuando un proceso enlazado falla, el proceso actual tambien falla. Establezca `trap_links=true` para recibir eventos LINK_DOWN en su lugar.

### Comportamiento por Defecto (trap_links=false)

Sin `trap_links`, fallo de proceso enlazado termina el proceso actual:

```lua
local function worker_main()
    local events_ch = process.events()

    -- trap_links es false por defecto
    local opts = process.get_options()
    print("trap_links:", opts.trap_links)  -- false

    -- Spawn worker enlazado que fallara
    local child_pid, err = process.spawn_linked(
        "app.workers:error_worker",
        "app:processes"
    )

    -- Cuando hijo da error, ESTE proceso termina
    -- Nunca llegamos a este punto
    local event = events_ch:receive()
end
```

### Con trap_links=true

Habilite `trap_links` para recibir eventos LINK_DOWN y sobrevivir:

```lua
local function worker_main()
    -- Habilitar trap_links
    process.set_options({ trap_links = true })

    local events_ch = process.events()

    -- Spawn worker enlazado que fallara
    local child_pid, err = process.spawn_linked(
        "app.workers:error_worker",
        "app:processes"
    )

    -- Esperar evento LINK_DOWN
    local event = events_ch:receive()

    if event.kind == process.event.LINK_DOWN then
        print("Child failed, handling gracefully")
        return "LINK_DOWN_RECEIVED"
    end
end
```

## Cancelacion

### Enviar Senal de Cancelacion

Use `process.cancel()` para terminar un proceso gracefully:

```lua
local function main()
    local time = require("time")
    local events_ch = process.events()

    -- Spawn y monitorear worker
    local worker_pid, err = process.spawn_monitored(
        "app.workers:long_worker",
        "app:processes"
    )

    time.sleep("5ms")

    -- Cancelar con timeout de 100ms para cleanup
    local ok, cancel_err = process.cancel(worker_pid, "100ms")
    if cancel_err then
        return nil, "cancel failed: " .. tostring(cancel_err)
    end

    -- Esperar evento EXIT
    local event = events_ch:receive()
    if event.kind == process.event.EXIT then
        print("Worker cancelled:", event.from)
    end
end
```

### Manejar Cancelacion

Worker recibe evento CANCEL a traves de `process.events()`:

```lua
local function worker_main()
    local events_ch = process.events()
    local inbox_ch = process.inbox()

    while true do
        local result = channel.select {
            inbox_ch:case_receive(),
            events_ch:case_receive(),
        }

        if result.channel == events_ch then
            local event = result.value
            if event.kind == process.event.CANCEL then
                -- Limpiar recursos
                cleanup()
                return "cancelled gracefully"
            end
        else
            -- Procesar mensaje de inbox
            handle_message(result.value)
        end
    end
end
```

## Pool de Workers con Supervision

### Configuracion

```yaml
# src/_index.yaml
version: "1.0"
namespace: app

entries:
  - name: processes
    kind: process.host
    host:
      workers: 16
    lifecycle:
      auto_start: true
```

### Implementacion del Supervisor

```lua
-- src/supervisor/pool.lua
local function main(worker_count)
    local time = require("time")
    worker_count = worker_count or 4

    -- Habilitar trap_links para manejar muertes de workers
    process.set_options({ trap_links = true })

    local events_ch = process.events()
    local workers = {}

    local function start_worker(id)
        local pid, err = process.spawn_linked(
            "app.workers:task_worker",
            "app:processes",
            id
        )
        if err then
            print("Failed to start worker " .. id .. ": " .. tostring(err))
            return nil
        end

        workers[pid] = {id = id, started_at = os.time()}
        print("Worker " .. id .. " started: " .. pid)
        return pid
    end

    -- Iniciar pool inicial
    for i = 1, worker_count do
        start_worker(i)
    end

    print("Supervisor started with " .. worker_count .. " workers")

    -- Loop de supervision
    while true do
        local timeout = time.after("60s")
        local result = channel.select {
            events_ch:case_receive(),
            timeout:case_receive(),
        }

        if result.channel == timeout then
            -- Health check periodico
            local count = 0
            for _ in pairs(workers) do count = count + 1 end
            print("Health check: " .. count .. " active workers")

        elseif result.channel == events_ch then
            local event = result.value

            if event.kind == process.event.LINK_DOWN then
                local dead_worker = workers[event.from]
                if dead_worker then
                    workers[event.from] = nil
                    local uptime = os.time() - dead_worker.started_at
                    print("Worker " .. dead_worker.id .. " died after " .. uptime .. "s, restarting")

                    -- Breve delay antes de reiniciar
                    time.sleep("100ms")
                    start_worker(dead_worker.id)
                end
            end
        end
    end
end

return { main = main }
```

## Configuracion de Process Host

El process host controla cuantos threads del SO ejecutan procesos:

```yaml
# src/_index.yaml
version: "1.0"
namespace: app

entries:
  - name: processes
    kind: process.host
    host:
      workers: 16  # Numero de threads del SO
    lifecycle:
      auto_start: true
```

Configuracion de workers:
- Controla paralelismo para trabajo CPU-bound
- Tipicamente establecido al numero de cores de CPU
- Todos los procesos comparten este pool de threads

## Conceptos Clave

**Monitoreo** (observacion unidireccional):
- Use `process.spawn_monitored()` o `process.monitor()`
- Reciba eventos EXIT cuando proceso monitoreado termina
- El padre continua ejecutando despues de que hijo termina

**Enlace** (vinculacion bidireccional de destino):
- Use `process.spawn_linked()` o `process.link()`
- Por defecto: si alguno falla, ambos terminan
- Con `trap_links=true`: reciba eventos LINK_DOWN en su lugar

**Cancelacion**:
- Use `process.cancel(pid, timeout)` para apagado graceful
- Worker recibe evento CANCEL via `process.events()`
- Tiene duracion de timeout para cleanup antes de terminacion forzada

## Tipos de Eventos

| Evento | Disparado Por | Configuracion Requerida |
|--------|---------------|------------------------|
| `EXIT` | Proceso monitoreado termina | `spawn_monitored()` o `monitor()` |
| `LINK_DOWN` | Proceso enlazado falla | `spawn_linked()` o `link()` con `trap_links=true` |
| `CANCEL` | `process.cancel()` llamado | Ninguna (siempre entregado) |

## Siguientes Pasos

- [Procesos](processes.md) - Fundamentos de procesos
- [Canales](channels.md) - Patrones de paso de mensajes
- [Modulo Process](lua-process.md) - Referencia de API
