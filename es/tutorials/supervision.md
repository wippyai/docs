# Supervisión de Procesos

Monitoree y enlace procesos para construir sistemas tolerantes a fallos.

## Monitoreo vs Enlace

**Monitoreo** proporciona observación unidireccional:
- El padre monitorea al hijo
- Si el hijo termina, el padre recibe un evento EXIT
- El padre continúa ejecutándose

**Enlace** crea un destino compartido bidireccional:
- Padre e hijo están enlazados
- Si cualquier proceso falla, ambos terminan
- A menos que se establezca `trap_links=true`

```mermaid
flowchart TB
    subgraph Monitoring["MONITORING (one-way)"]
        direction TB
        P1[Parent monitors] -->|EXIT event<br/>parent continues| C1[Child exits]
    end

    subgraph Linking["LINKING (bidirectional)"]
        direction TB
        P2[Parent linked] <-->|LINK_DOWN<br/>both die| C2[Child exits]
    end
```

## Monitoreo de Procesos

### Generar con Monitoreo

Use `process.spawn_monitored()` para generar y monitorear en una sola llamada:

```lua
local function main()
    local events_ch = process.events()

    -- Generar worker e iniciar monitoreo
    local worker_pid, err = process.spawn_monitored(
        "app.workers:task_worker",
        "app:processes"
    )
    if err then
        return nil, "spawn failed: " .. tostring(err)
    end

    -- Esperar a que el worker termine
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

### Monitorear un Proceso Existente

Llame a `process.monitor()` para comenzar a monitorear un proceso ya en ejecución:

```lua
local function main()
    local time = require("time")
    local events_ch = process.events()

    -- Generar sin monitoreo
    local worker_pid, err = process.spawn(
        "app.workers:long_worker",
        "app:processes"
    )
    if err then
        return nil, "spawn failed: " .. tostring(err)
    end

    -- Iniciar monitoreo después
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

### Detener el Monitoreo

Use `process.unmonitor()` para dejar de recibir eventos EXIT:

```lua
local function main()
    local time = require("time")
    local events_ch = process.events()

    -- Generar y monitorear
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

    -- No se recibirá evento EXIT (dejamos de monitorear)
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

### Enlace Explícito

Use `process.link()` para crear un enlace bidireccional:

```lua
-- Worker que se enlaza a un proceso objetivo
local function worker_main()
    local time = require("time")
    local events_ch = process.events()
    local inbox_ch = process.inbox()

    -- Activar trap_links para recibir eventos LINK_DOWN
    process.set_options({ trap_links = true })

    -- Recibir PID objetivo desde el remitente
    local msg = inbox_ch:receive()
    local target_pid = msg:payload():data()
    local sender = msg:from()

    -- Crear enlace bidireccional
    local ok, err = process.link(target_pid)
    if err then
        return nil, "link failed: " .. tostring(err)
    end

    -- Notificar al remitente que estamos enlazados
    process.send(sender, "linked", process.pid())

    -- Esperar LINK_DOWN cuando el objetivo termine
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

### Generar con Enlace

Use `process.spawn_linked()` para generar y enlazar en una sola llamada:

```lua
local function parent_main()
    -- Activar trap_links para manejar la muerte del hijo
    process.set_options({ trap_links = true })

    local events_ch = process.events()

    -- Generar y enlazar al hijo
    local child_pid, err = process.spawn_linked(
        "app.workers:child_worker",
        "app:processes"
    )
    if err then
        return nil, "spawn_linked failed: " .. tostring(err)
    end

    -- Si el hijo muere, recibimos LINK_DOWN
    local event = events_ch:receive()
    if event.kind == process.event.LINK_DOWN then
        print("Child died:", event.from)
    end
end
```

## Trap Links

Por defecto, cuando un proceso enlazado falla, el proceso actual también falla. Establezca `trap_links=true` para recibir eventos LINK_DOWN en su lugar.

### Comportamiento Predeterminado (trap_links=false)

Sin `trap_links`, la falla de un proceso enlazado termina el proceso actual:

```lua
local function worker_main()
    local events_ch = process.events()

    -- trap_links es false por defecto
    local opts = process.get_options()
    print("trap_links:", opts.trap_links)  -- false

    -- Generar worker enlazado que fallará
    local child_pid, err = process.spawn_linked(
        "app.workers:error_worker",
        "app:processes"
    )

    -- Cuando el hijo falla, ESTE proceso termina
    -- Nunca llegamos a este punto
    local event = events_ch:receive()
end
```

### Con trap_links=true

Active `trap_links` para recibir eventos LINK_DOWN y sobrevivir:

```lua
local function worker_main()
    -- Activar trap_links
    process.set_options({ trap_links = true })

    local events_ch = process.events()

    -- Generar worker enlazado que fallará
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

## Cancelación

### Enviar Señal de Cancelación

Use `process.cancel()` para terminar un proceso de forma controlada:

```lua
local function main()
    local time = require("time")
    local events_ch = process.events()

    -- Generar y monitorear worker
    local worker_pid, err = process.spawn_monitored(
        "app.workers:long_worker",
        "app:processes"
    )

    time.sleep("5ms")

    -- Cancelar con timeout de 100ms para limpieza
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

### Manejar la Cancelación

El worker recibe el evento CANCEL a través de `process.events()`:

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
            -- Procesar mensaje del inbox
            handle_message(result.value)
        end
    end
end
```

## Topologías de Supervisión

### Topología en Estrella

Padre con múltiples hijos que se enlazan hacia él:

```lua
-- El worker padre genera hijos que se enlazan AL padre
local function star_parent_main()
    local time = require("time")
    local events_ch = process.events()
    local child_count = 10

    -- Activar trap_links para ver morir a los hijos
    process.set_options({ trap_links = true })

    local children = {}

    -- Generar hijos
    for i = 1, child_count do
        local child_pid, err = process.spawn(
            "app.workers:linker_child",
            "app:processes"
        )
        if err then
            error("spawn child failed: " .. tostring(err))
        end

        -- Enviar PID del padre al hijo
        process.send(child_pid, "inbox", process.pid())
        children[child_pid] = true
    end

    -- Esperar a que todos los hijos confirmen el enlace
    for i = 1, child_count do
        local msg = process.inbox():receive()
        if msg:topic() ~= "linked" then
            error("expected linked confirmation")
        end
    end

    -- Disparar fallo - todos los hijos deberían recibir LINK_DOWN
    error("PARENT_STAR_FAILURE")
end
```

Worker hijo que se enlaza al padre:

```lua
local function linker_child_main()
    local events_ch = process.events()
    local inbox_ch = process.inbox()

    -- Recibir PID del padre
    local msg = inbox_ch:receive()
    local parent_pid = msg:payload():data()

    -- Enlazar al padre
    process.link(parent_pid)

    -- Confirmar enlace
    process.send(parent_pid, "linked", process.pid())

    -- Esperar LINK_DOWN cuando el padre muere
    local event = events_ch:receive()
    if event.kind == process.event.LINK_DOWN then
        return "parent_died"
    end
end
```

### Topología en Cadena

Cadena lineal donde cada nodo se enlaza con su padre:

```lua
-- Raíz de cadena: A -> B -> C -> D -> E
local function chain_root_main()
    local time = require("time")

    -- Generar primer hijo
    local child_pid, err = process.spawn_linked(
        "app.workers:chain_node",
        "app:processes",
        4  -- profundidad restante
    )
    if err then
        error("spawn failed: " .. tostring(err))
    end

    -- Esperar a que se construya la cadena
    time.sleep("100ms")

    -- Disparar cascada - todos los procesos enlazados mueren
    error("CHAIN_ROOT_FAILURE")
end
```

El nodo de la cadena genera el siguiente nodo y lo enlaza:

```lua
local function chain_node_main(depth)
    local time = require("time")

    if depth > 0 then
        -- Generar siguiente en la cadena
        local child_pid, err = process.spawn_linked(
            "app.workers:chain_node",
            "app:processes",
            depth - 1
        )
        if err then
            error("spawn failed: " .. tostring(err))
        end
    end

    -- Esperar a que el padre muera (dispara nuestra muerte vía LINK_DOWN)
    time.sleep("5s")
end
```

## Pool de Workers con Supervisión

### Configuración

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

```yaml
# src/supervisor/_index.yaml
version: "1.0"
namespace: app.supervisor

entries:
  - name: pool
    kind: process.lua
    source: file://pool.lua
    method: main
    modules:
      - time
    lifecycle:
      auto_start: true
```

### Implementación del Supervisor

```lua
-- src/supervisor/pool.lua
local function main(worker_count)
    local time = require("time")
    worker_count = worker_count or 4

    -- Activar trap_links para manejar las muertes de workers
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

    -- Bucle de supervisión
    while true do
        local timeout = time.after("60s")
        local result = channel.select {
            events_ch:case_receive(),
            timeout:case_receive(),
        }

        if result.channel == timeout then
            -- Chequeo de salud periódico
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

                    -- Breve retraso antes de reiniciar
                    time.sleep("100ms")
                    start_worker(dead_worker.id)
                end
            end
        end
    end
end

return { main = main }
```

## Configuración del Proceso

### Definición del Worker

```yaml
# src/workers/_index.yaml
version: "1.0"
namespace: app.workers

entries:
  - name: task_worker
    kind: process.lua
    source: file://task_worker.lua
    method: main
    modules:
      - time
```

### Implementación del Worker

```lua
-- src/workers/task_worker.lua
local function main(worker_id)
    local time = require("time")
    local events_ch = process.events()
    local inbox_ch = process.inbox()

    print("Task worker " .. worker_id .. " started")

    while true do
        local timeout = time.after("5s")
        local result = channel.select {
            inbox_ch:case_receive(),
            events_ch:case_receive(),
            timeout:case_receive(),
        }

        if result.channel == events_ch then
            local event = result.value
            if event.kind == process.event.CANCEL then
                print("Worker " .. worker_id .. " cancelled")
                return "cancelled"
            elseif event.kind == process.event.LINK_DOWN then
                print("Worker " .. worker_id .. " linked process died")
                return nil, "linked_process_died"
            end

        elseif result.channel == inbox_ch then
            local msg = result.value
            local topic = msg:topic()
            local payload = msg:payload():data()

            if topic == "work" then
                print("Worker " .. worker_id .. " processing: " .. payload)
                time.sleep("100ms")
                process.send(msg:from(), "result", "completed: " .. payload)
            end

        elseif result.channel == timeout then
            -- Timeout de inactividad
            print("Worker " .. worker_id .. " idle")
        end
    end
end

return { main = main }
```

## Configuración del Host de Procesos

El host de procesos controla cuántos hilos del SO ejecutan procesos:

```yaml
# src/_index.yaml
version: "1.0"
namespace: app

entries:
  - name: processes
    kind: process.host
    host:
      workers: 16  # Número de hilos del SO
    lifecycle:
      auto_start: true
```

Configuración de workers:
- Controla el paralelismo para trabajo ligado a CPU
- Normalmente se establece al número de núcleos de CPU
- Todos los procesos comparten este pool de hilos

## Conceptos Clave

**Monitoreo** (observación unidireccional):
- Use `process.spawn_monitored()` o `process.monitor()`
- Reciba eventos EXIT cuando el proceso monitoreado termine
- El padre continúa ejecutándose tras la salida del hijo

**Enlace** (destino compartido bidireccional):
- Use `process.spawn_linked()` o `process.link()`
- Por defecto: si cualquier proceso falla, ambos terminan
- Con `trap_links=true`: reciba eventos LINK_DOWN en su lugar

**Cancelación**:
- Use `process.cancel(pid, timeout)` para apagado controlado
- El worker recibe el evento CANCEL vía `process.events()`
- Dispone del tiempo de timeout para limpiar antes de la terminación forzada

## Tipos de Eventos

| Evento | Disparado por | Configuración Requerida |
|--------|---------------|-------------------------|
| `EXIT` | El proceso monitoreado termina | `spawn_monitored()` o `monitor()` |
| `LINK_DOWN` | El proceso enlazado falla | `spawn_linked()` o `link()` con `trap_links=true` |
| `CANCEL` | Se llama a `process.cancel()` | Ninguna (siempre entregado) |

## Siguientes Pasos

- [Procesos](processes.md) - Fundamentos de procesos
- [Canales](channels.md) - Patrones de paso de mensajes
- [Módulo Process](lua/core/process.md) - Referencia de la API
