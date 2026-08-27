---
title: "Prozesse und Messaging: Einführung"
description: "APIs zum Starten, zur Kommunikation, Überwachung, Verknüpfung und Namensregistrierung von Prozessen kennenlernen."
---

# Prozesse und Messaging: Einführung

Lernen Sie die Prozess-APIs kennen, um isolierte Arbeit zu starten, Nachrichten auszutauschen, Lebenszyklen zu überwachen, Fehler zu verknüpfen und Prozessnamen zu registrieren.

## Überblick

Prozesse bieten isolierte Ausführungseinheiten, die durch Message-Passing kommunizieren. Jeder Prozess hat seine eigene Inbox und kann spezifische Message-Topics abonnieren.

**Klassifizierung:** Referenz/API-Einführung. Jedes Snippet zeigt eine einzelne Operation
isoliert; die Seite ist kein eigenständiges Projekt. Eine vollständige Anwendung,
die Starten, Überwachen und Messaging kombiniert, finden Sie im Tutorial
[Echo-Service](echo-service.md).

## Kontext und Abhängigkeiten

Die Beispiele setzen voraus, dass sie in einem ausführbaren Lua-Eintrag laufen und
ein laufender `process.host` als `app:processes` registriert ist. Eintrags-IDs wie
`app.test.process:echo_worker` sind Platzhalter für Prozesseinträge, die Ihr Projekt
definieren muss. Die APIs `process` und `channel` sind Umgebungs-Globals; direkter
Zugriff über `process.*` ist üblich, und `require("process")` wird ebenfalls ohne
Moduldeklaration aufgelöst. Snippets mit `time.after()` benötigen
`local time = require("time")` sowie `time` in der `modules`-Liste des Eintrags.

Das Starten, Senden, Überwachen, Verknüpfen, Abbrechen und Beenden von Prozessen sowie
Änderungen an der Registry sind geschützte Operationen. Geben Sie dem ausführenden
Eintrag einen Actor und Policies ausschließlich für die benötigten Operationen und
Ressourcen; andernfalls verweigert der Strict Mode sie.

Schlüsselkonzepte:

- Prozesse mit `process.spawn()` und seinen Varianten starten.
- Topic-basierte Nachrichten an PIDs oder registrierte Namen senden.
- Nachrichten mit `process.listen()` oder `process.inbox()` empfangen.
- Prozesslebenszyklen mit Events überwachen.
- Prozesse für eine koordinierte Fehlerbehandlung verknüpfen.

## Prozesse starten

Starten Sie einen neuen Prozess aus einer Entry-Referenz.

```lua
local pid, err = process.spawn("app.test.process:echo_worker", "app:processes", "hello")
if err then
    return false, "spawn failed: " .. tostring(err)
end

-- pid is a string identifier for the spawned process
print("Started worker:", pid)
```

Parameter:
- Entry-Referenz (z.B. `"app.test.process:echo_worker"`)
- Host-Referenz (z.B. `"app:processes"`)
- Optionale Argumente, die an die main-Funktion des Workers übergeben werden

### Eigene PID abrufen

```lua
local my_pid = process.pid()
-- Returns string PID of current process
```

## Message-Passing

Nachrichten verwenden ein Topic-basiertes Routing-System. Senden Sie Nachrichten an PIDs mit einem Topic, dann empfangen Sie via Topic-Subscription oder Inbox.

### Nachrichten senden

```lua
-- Send to process by PID
local sent, err = process.send(worker_pid, "messages", "hello from parent")
if err then
    return false, "send failed: " .. tostring(err)
end

-- send returns (bool, error)
```

### Über Topic-Subscription empfangen

Abonnieren Sie spezifische Topics mit `process.listen()`:

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

### Über Inbox empfangen

Inbox empfängt Nachrichten, die keinem Topic-Listener entsprechen:

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

### Message-Modus für Sender-Info

Verwenden Sie `{ message = true }` um auf Sender-PID und Topic zuzugreifen:

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

## Prozesse überwachen

Überwachen Sie Prozesse um EXIT-Events zu erhalten wenn sie beenden.

### Spawn mit Monitoring

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

### Explizites Monitoring

Überwachen Sie einen bereits laufenden Prozess:

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

Monitoring beenden:

```lua
local ok, err = process.unmonitor(worker_pid)
if err then
    return false, "unmonitor failed: " .. tostring(err)
end
```

## Prozess-Linking

Verknüpfen Sie Prozesse für eine koordinierte Lebenszyklusverwaltung. Ein abnormaler Exit beendet standardmäßig verknüpfte Peers. Ein Peer mit `trap_links=true` läuft weiter und empfängt stattdessen ein `LINK_DOWN`-Event.

### Verlinkten Prozess starten

```lua
-- Child terminates if parent crashes (unless trap_links is set)
local pid, err = process.spawn_linked("app.test.process:child_worker", "app:processes")
if err then
    return false, "spawn_linked failed: " .. tostring(err)
end
```

### Explizites Linking

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

### LINK_DOWN-Events behandeln

Standardmäßig beendet ein abnormaler Exit eines verknüpften Peers den aktuellen Prozess; es wird kein Lua-Event `LINK_DOWN` zugestellt. Aktivieren Sie `trap_links`, damit der Prozess weiterläuft und stattdessen dieses Event empfängt:

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

## Prozess-Registry

Registrieren Sie Namen für Prozesse um namensbasierte Lookups und Messaging zu ermöglichen.

### Namen registrieren

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

### Namen deregistrieren

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

Namen werden automatisch freigegeben wenn der Prozess beendet wird.

## Beispiel: Überwachter Worker-Pool

Dieses Teilbeispiel zeigt, wie ein Elternprozess mehrere überwachte Worker startet
und deren Abschluss verfolgt. Definieren Sie zur Verwendung den Elternprozess,
die Einträge `app.test.process:task_worker`, den Host `app:processes`, die benötigten
Prozess-Policies sowie `time` in den Modullisten beider Einträge.

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

Worker-Prozess:

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

## Nächste Schritte

- [Prozessmodul-Referenz](../lua/core/process.md) — Dokumentation der Prozess-API
- [Channels](channels.md) — Channel-Operationen für die Nachrichtenverarbeitung
