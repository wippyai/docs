# Prozess-Supervision

Überwachen und verlinken Sie Prozesse um fehlertolerante Systeme zu bauen.

## Monitoring vs Linking

**Monitoring** bietet einseitige Beobachtung:
- Eltern überwacht Kind
- Kind beendet sich, Eltern erhält EXIT-Event
- Eltern läuft weiter

**Linking** erstellt bidirektionales Schicksalsteilen:
- Eltern und Kind sind verlinkt
- Einer der Prozesse schlägt fehl, beide terminieren
- Außer `trap_links=true` ist gesetzt

```
MONITORING (einseitig)                LINKING (bidirektional)
┌──────────┐                      ┌──────────┐
│ Eltern   │                      │ Eltern   │
│ monitors │                      │ linked   │
└────┬─────┘                      └────┬─────┘
     │ EXIT event                      │ LINK_DOWN
     │ (Eltern läuft weiter)           │ (beide sterben)
┌────▼─────┐                      ┌────▼─────┐
│  Kind    │                      │  Kind    │
│  exits   │                      │  exits   │
└──────────┘                      └──────────┘
```

## Prozess-Monitoring

### Spawn mit Monitoring

Verwenden Sie `process.spawn_monitored()` um in einem Aufruf zu starten und zu überwachen:

```lua
local function main()
    local events_ch = process.events()

    -- Worker starten und überwachen
    local worker_pid, err = process.spawn_monitored(
        "app.workers:task_worker",
        "app:processes"
    )
    if err then
        return nil, "spawn failed: " .. tostring(err)
    end

    -- Auf Worker-Abschluss warten
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

### Existierenden Prozess überwachen

Rufen Sie `process.monitor()` auf um einen bereits laufenden Prozess zu überwachen:

```lua
local function main()
    local time = require("time")
    local events_ch = process.events()

    -- Ohne Monitoring starten
    local worker_pid, err = process.spawn(
        "app.workers:long_worker",
        "app:processes"
    )
    if err then
        return nil, "spawn failed: " .. tostring(err)
    end

    -- Später Monitoring hinzufügen
    local ok, monitor_err = process.monitor(worker_pid)
    if monitor_err then
        return nil, "monitor failed: " .. tostring(monitor_err)
    end

    -- Worker abbrechen
    time.sleep("5ms")
    process.cancel(worker_pid, "100ms")

    -- EXIT-Event empfangen
    local event = events_ch:receive()
    if event.kind == process.event.EXIT then
        print("Worker terminated:", event.from)
    end
end
```

### Monitoring beenden

Verwenden Sie `process.unmonitor()` um keine EXIT-Events mehr zu empfangen:

```lua
local function main()
    local time = require("time")
    local events_ch = process.events()

    -- Starten und überwachen
    local worker_pid, err = process.spawn_monitored(
        "app.workers:long_worker",
        "app:processes"
    )

    time.sleep("5ms")

    -- Monitoring beenden
    local ok, unmon_err = process.unmonitor(worker_pid)
    if unmon_err then
        return nil, "unmonitor failed: " .. tostring(unmon_err)
    end

    -- Worker abbrechen
    process.cancel(worker_pid, "100ms")

    -- Kein EXIT-Event wird empfangen (wir haben unmonitored)
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

## Prozess-Linking

### Explizites Linking

Verwenden Sie `process.link()` um eine bidirektionale Verlinkung zu erstellen:

```lua
-- Worker der sich mit einem Zielprozess verlinkt
local function worker_main()
    local time = require("time")
    local events_ch = process.events()
    local inbox_ch = process.inbox()

    -- trap_links aktivieren um LINK_DOWN-Events zu empfangen
    process.set_options({ trap_links = true })

    -- Ziel-PID vom Sender empfangen
    local msg = inbox_ch:receive()
    local target_pid = msg:payload():data()
    local sender = msg:from()

    -- Bidirektionale Verlinkung erstellen
    local ok, err = process.link(target_pid)
    if err then
        return nil, "link failed: " .. tostring(err)
    end

    -- Sender benachrichtigen dass wir verlinkt sind
    process.send(sender, "linked", process.pid())

    -- Auf LINK_DOWN warten wenn Ziel beendet
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

### Spawn mit Link

Verwenden Sie `process.spawn_linked()` um in einem Aufruf zu starten und zu verlinken:

```lua
local function parent_main()
    -- trap_links aktivieren um Kind-Tod zu behandeln
    process.set_options({ trap_links = true })

    local events_ch = process.events()

    -- Kind starten und verlinken
    local child_pid, err = process.spawn_linked(
        "app.workers:child_worker",
        "app:processes"
    )
    if err then
        return nil, "spawn_linked failed: " .. tostring(err)
    end

    -- Wenn Kind stirbt, empfangen wir LINK_DOWN
    local event = events_ch:receive()
    if event.kind == process.event.LINK_DOWN then
        print("Child died:", event.from)
    end
end
```

## Trap Links

Standardmäßig terminiert der aktuelle Prozess wenn ein verlinkter Prozess fehlschlägt. Setzen Sie `trap_links=true` um stattdessen LINK_DOWN-Events zu empfangen.

### Standardverhalten (trap_links=false)

Ohne `trap_links` terminiert der aktuelle Prozess bei Fehlschlag eines verlinkten Prozesses:

```lua
local function worker_main()
    local events_ch = process.events()

    -- trap_links ist standardmäßig false
    local opts = process.get_options()
    print("trap_links:", opts.trap_links)  -- false

    -- Verlinkten Worker starten der fehlschlagen wird
    local child_pid, err = process.spawn_linked(
        "app.workers:error_worker",
        "app:processes"
    )

    -- Wenn Kind Fehler hat, terminiert DIESER Prozess
    -- Wir erreichen diesen Punkt nie
    local event = events_ch:receive()
end
```

### Mit trap_links=true

Aktivieren Sie `trap_links` um LINK_DOWN-Events zu empfangen und zu überleben:

```lua
local function worker_main()
    -- trap_links aktivieren
    process.set_options({ trap_links = true })

    local events_ch = process.events()

    -- Verlinkten Worker starten der fehlschlagen wird
    local child_pid, err = process.spawn_linked(
        "app.workers:error_worker",
        "app:processes"
    )

    -- Auf LINK_DOWN-Event warten
    local event = events_ch:receive()

    if event.kind == process.event.LINK_DOWN then
        print("Child failed, handling gracefully")
        return "LINK_DOWN_RECEIVED"
    end
end
```

## Cancellation

### Cancel-Signal senden

Verwenden Sie `process.cancel()` um einen Prozess graceful zu terminieren:

```lua
local function main()
    local time = require("time")
    local events_ch = process.events()

    -- Worker starten und überwachen
    local worker_pid, err = process.spawn_monitored(
        "app.workers:long_worker",
        "app:processes"
    )

    time.sleep("5ms")

    -- Mit 100ms Timeout für Cleanup abbrechen
    local ok, cancel_err = process.cancel(worker_pid, "100ms")
    if cancel_err then
        return nil, "cancel failed: " .. tostring(cancel_err)
    end

    -- Auf EXIT-Event warten
    local event = events_ch:receive()
    if event.kind == process.event.EXIT then
        print("Worker cancelled:", event.from)
    end
end
```

### Cancellation behandeln

Worker empfängt CANCEL-Event über `process.events()`:

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
                -- Ressourcen aufräumen
                cleanup()
                return "cancelled gracefully"
            end
        else
            -- Inbox-Nachricht verarbeiten
            handle_message(result.value)
        end
    end
end
```

## Supervision-Topologien

### Stern-Topologie

Eltern mit mehreren Kindern die zurück verlinken:

```lua
-- Eltern-Worker startet Kinder die ZUM Eltern verlinken
local function star_parent_main()
    local time = require("time")
    local events_ch = process.events()
    local child_count = 10

    -- trap_links aktivieren um Kinder-Tod zu sehen
    process.set_options({ trap_links = true })

    local children = {}

    -- Kinder starten
    for i = 1, child_count do
        local child_pid, err = process.spawn(
            "app.workers:linker_child",
            "app:processes"
        )
        if err then
            error("spawn child failed: " .. tostring(err))
        end

        -- Eltern-PID an Kind senden
        process.send(child_pid, "inbox", process.pid())
        children[child_pid] = true
    end

    -- Auf Bestätigung aller Kinder warten
    for i = 1, child_count do
        local msg = process.inbox():receive()
        if msg:topic() ~= "linked" then
            error("expected linked confirmation")
        end
    end

    -- Fehler auslösen - alle Kinder sollten LINK_DOWN empfangen
    error("PARENT_STAR_FAILURE")
end
```

Kind-Worker der sich mit Eltern verlinkt:

```lua
local function linker_child_main()
    local events_ch = process.events()
    local inbox_ch = process.inbox()

    -- Eltern-PID empfangen
    local msg = inbox_ch:receive()
    local parent_pid = msg:payload():data()

    -- Mit Eltern verlinken
    process.link(parent_pid)

    -- Verlinkung bestätigen
    process.send(parent_pid, "linked", process.pid())

    -- Auf LINK_DOWN warten wenn Eltern stirbt
    local event = events_ch:receive()
    if event.kind == process.event.LINK_DOWN then
        return "parent_died"
    end
end
```

### Ketten-Topologie

Lineare Kette wo jeder Knoten zu seinem Eltern verlinkt:

```lua
-- Ketten-Root: A -> B -> C -> D -> E
local function chain_root_main()
    local time = require("time")

    -- Erstes Kind starten
    local child_pid, err = process.spawn_linked(
        "app.workers:chain_node",
        "app:processes",
        4  -- Verbleibende Tiefe
    )
    if err then
        error("spawn failed: " .. tostring(err))
    end

    -- Warten bis Kette aufgebaut ist
    time.sleep("100ms")

    -- Kaskade auslösen - alle verlinkten Prozesse sterben
    error("CHAIN_ROOT_FAILURE")
end
```

Ketten-Knoten startet nächsten Knoten und verlinkt:

```lua
local function chain_node_main(depth)
    local time = require("time")

    if depth > 0 then
        -- Nächsten in Kette starten
        local child_pid, err = process.spawn_linked(
            "app.workers:chain_node",
            "app:processes",
            depth - 1
        )
        if err then
            error("spawn failed: " .. tostring(err))
        end
    end

    -- Warten bis Eltern stirbt (löst unseren Tod via LINK_DOWN aus)
    time.sleep("5s")
end
```

## Worker-Pool mit Supervision

### Konfiguration

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

### Supervisor-Implementierung

```lua
-- src/supervisor/pool.lua
local function main(worker_count)
    local time = require("time")
    worker_count = worker_count or 4

    -- trap_links aktivieren um Worker-Tod zu behandeln
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

    -- Initialen Pool starten
    for i = 1, worker_count do
        start_worker(i)
    end

    print("Supervisor started with " .. worker_count .. " workers")

    -- Supervision-Loop
    while true do
        local timeout = time.after("60s")
        local result = channel.select {
            events_ch:case_receive(),
            timeout:case_receive(),
        }

        if result.channel == timeout then
            -- Periodischer Health-Check
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

                    -- Kurze Verzögerung vor Neustart
                    time.sleep("100ms")
                    start_worker(dead_worker.id)
                end
            end
        end
    end
end

return { main = main }
```

## Prozess-Konfiguration

### Worker-Definition

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

### Worker-Implementierung

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
            -- Idle-Timeout
            print("Worker " .. worker_id .. " idle")
        end
    end
end

return { main = main }
```

## Prozess-Host-Konfiguration

Der Prozess-Host steuert wie viele OS-Threads Prozesse ausführen:

```yaml
# src/_index.yaml
version: "1.0"
namespace: app

entries:
  - name: processes
    kind: process.host
    host:
      workers: 16  # Anzahl OS-Threads
    lifecycle:
      auto_start: true
```

Workers-Einstellung:
- Steuert Parallelität für CPU-gebundene Arbeit
- Typischerweise auf Anzahl CPU-Kerne gesetzt
- Alle Prozesse teilen sich diesen Thread-Pool

## Schlüsselkonzepte

**Monitoring** (einseitige Beobachtung):
- Verwenden Sie `process.spawn_monitored()` oder `process.monitor()`
- Empfangen Sie EXIT-Events wenn überwachter Prozess terminiert
- Eltern läuft weiter nach Kind-Exit

**Linking** (bidirektionales Schicksalsteilen):
- Verwenden Sie `process.spawn_linked()` oder `process.link()`
- Standardmäßig: wenn einer der Prozesse fehlschlägt, terminieren beide
- Mit `trap_links=true`: LINK_DOWN-Events stattdessen empfangen

**Cancellation**:
- Verwenden Sie `process.cancel(pid, timeout)` für graceful Shutdown
- Worker empfängt CANCEL-Event via `process.events()`
- Hat Timeout-Dauer für Cleanup vor erzwungener Terminierung

## Event-Typen

| Event | Ausgelöst durch | Erforderliches Setup |
|-------|-----------------|----------------------|
| `EXIT` | Überwachter Prozess beendet | `spawn_monitored()` oder `monitor()` |
| `LINK_DOWN` | Verlinkter Prozess schlägt fehl | `spawn_linked()` oder `link()` mit `trap_links=true` |
| `CANCEL` | `process.cancel()` aufgerufen | Keines (wird immer geliefert) |

## Nächste Schritte

- [Prozesse](processes.md) - Prozess-Grundlagen
- [Channels](channels.md) - Message-Passing-Muster
- [Prozess-Modul](lua-process.md) - API-Referenz
