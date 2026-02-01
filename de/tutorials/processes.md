# Prozesse und Messaging

Starten Sie isolierte Prozesse und kommunizieren Sie via Message-Passing.

## Überblick

Prozesse bieten isolierte Ausführungseinheiten, die durch Message-Passing kommunizieren. Jeder Prozess hat seine eigene Inbox und kann spezifische Message-Topics abonnieren.

Schlüsselkonzepte:
- Prozesse mit `process.spawn()` und Varianten starten
- Nachrichten an PIDs oder registrierte Namen via Topics senden
- Nachrichten mit `process.listen()` oder `process.inbox()` empfangen
- Prozess-Lebenszyklus mit Events überwachen
- Prozesse für koordinierte Fehlerbehandlung verlinken

## Prozesse starten

Starten Sie einen neuen Prozess aus einer Entry-Referenz.

```lua
local pid, err = process.spawn("app.test.process:echo_worker", "app:processes", "hello")
if err then
    return false, "spawn failed: " .. err
end

-- pid ist ein String-Identifier für den gestarteten Prozess
print("Started worker:", pid)
```

Parameter:
- Entry-Referenz (z.B. `"app.test.process:echo_worker"`)
- Host-Referenz (z.B. `"app:processes"`)
- Optionale Argumente, die an die main-Funktion des Workers übergeben werden

### Eigene PID abrufen

```lua
local my_pid = process.pid()
-- Gibt String-PID des aktuellen Prozesses zurück
```

## Message-Passing

Nachrichten verwenden ein Topic-basiertes Routing-System. Senden Sie Nachrichten an PIDs mit einem Topic, dann empfangen Sie via Topic-Subscription oder Inbox.

### Nachrichten senden

```lua
-- An Prozess per PID senden
local sent, err = process.send(worker_pid, "messages", "hello from parent")
if err then
    return false, "send failed: " .. err
end

-- send gibt (bool, error) zurück
```

### Über Topic-Subscription empfangen

Abonnieren Sie spezifische Topics mit `process.listen()`:

```lua
-- Worker der auf "messages" Topic lauscht
local function main()
    local ch = process.listen("messages")

    local msg = ch:receive()
    if msg then
        -- msg ist direkt die Payload
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
            -- Nachrichten an "specific_topic" kommen hier an
            local payload = result.value
        elseif result.channel == inbox_ch then
            -- Nachrichten an ANDERE Topics kommen hier an
            local msg = result.value
            print("Inbox got:", msg.topic, msg.payload)
        end
    end
end
```

### Message-Modus für Sender-Info

Verwenden Sie `{ message = true }` um auf Sender-PID und Topic zuzugreifen:

```lua
-- Worker der Nachrichten an Sender zurücksendet
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
    return false, "spawn failed: " .. err
end

-- Auf EXIT-Event warten
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
    -- Rückgabewert via event.result zugreifbar
end
```

### Explizites Monitoring

Überwachen Sie einen bereits laufenden Prozess:

```lua
local events_ch = process.events()

-- Ohne Monitoring starten
local worker_pid, err = process.spawn("app.test.process:long_worker", "app:processes")
if err then
    return false, "spawn failed: " .. err
end

-- Monitoring explizit hinzufügen
local ok, monitor_err = process.monitor(worker_pid)
if monitor_err then
    return false, "monitor failed: " .. monitor_err
end

-- Jetzt werden EXIT-Events für diesen Worker empfangen
```

Monitoring beenden:

```lua
local ok, err = process.unmonitor(worker_pid)
```

## Prozess-Linking

Verlinken Sie Prozesse für koordiniertes Lebenszyklus-Management. Verlinkte Prozesse erhalten LINK_DOWN-Events wenn verlinkte Prozesse fehlschlagen.

### Verlinkten Prozess starten

```lua
-- Kind terminiert wenn Eltern abstürzt (außer trap_links ist gesetzt)
local pid, err = process.spawn_linked("app.test.process:child_worker", "app:processes")
if err then
    return false, "spawn_linked failed: " .. err
end
```

### Explizites Linking

```lua
-- Mit existierendem Prozess verlinken
local ok, err = process.link(target_pid)
if err then
    return false, "link failed: " .. err
end

-- Unlink
local ok, err = process.unlink(target_pid)
```

### LINK_DOWN-Events behandeln

Standardmäßig bewirkt LINK_DOWN, dass der Prozess fehlschlägt. Aktivieren Sie `trap_links` um es als Event zu empfangen:

```lua
local function main()
    -- trap_links aktivieren um LINK_DOWN-Events statt Crash zu empfangen
    local ok, err = process.set_options({ trap_links = true })
    if not ok then
        return false, "set_options failed: " .. err
    end

    -- Verifizieren dass trap_links aktiviert ist
    local opts = process.get_options()
    if not opts.trap_links then
        return false, "trap_links should be true"
    end

    local events_ch = process.events()

    -- Verlinkten Prozess starten der fehlschlagen wird
    local error_pid, err2 = process.spawn_linked(
        "app.test.process:error_exit_worker",
        "app:processes"
    )
    if err2 then
        return false, "spawn error worker failed: " .. err2
    end

    -- Auf LINK_DOWN-Event warten
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
        -- Graceful behandeln statt zu crashen
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

    -- Aktuellen Prozess mit Namen registrieren
    local ok, err = process.registry.register(test_name)
    if err then
        return false, "register failed: " .. err
    end

    -- Registrierten Namen nachschlagen
    local pid, lookup_err = process.registry.lookup(test_name)
    if lookup_err then
        return false, "lookup failed: " .. lookup_err
    end

    -- Verifizieren dass er zu unserer PID auflöst
    if pid ~= process.pid() then
        return false, "lookup returned wrong pid"
    end

    return true
end

return { main = main }
```

### Namen deregistrieren

```lua
-- Explizit deregistrieren
local unregistered = process.registry.unregister(test_name)
if not unregistered then
    print("Name was not registered")
end

-- Lookup nach Unregister gibt nil + error zurück
local pid, err = process.registry.lookup(test_name)
-- pid wird nil sein, err wird non-nil sein
```

Namen werden automatisch freigegeben wenn der Prozess beendet wird.

## Vollständiges Beispiel: Überwachter Worker-Pool

Dieses Beispiel zeigt einen Eltern-Prozess der mehrere überwachte Worker startet und deren Abschluss verfolgt.

```lua
-- Eltern-Prozess
local time = require("time")

local function main()
    local events_ch = process.events()

    -- Gestartete Worker verfolgen
    local workers = {}
    local worker_count = 5

    -- Mehrere überwachte Worker starten
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

    -- Auf Abschluss aller Worker warten
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
                if event.error then
                    print("Worker " .. worker.task_id .. " failed:", event.error)
                else
                    print("Worker " .. worker.task_id .. " completed:", event.result)
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
    -- Arbeit simulieren
    time.sleep("100ms")

    -- Task verarbeiten
    local result = task.value * 2

    return result
end

return { main = main }
```

## Zusammenfassung

Prozess-Spawning:
- `process.spawn()` - Einfacher Spawn, gibt PID zurück
- `process.spawn_monitored()` - Spawn mit automatischem Monitoring
- `process.spawn_linked()` - Spawn mit Lebenszyklus-Kopplung
- `process.pid()` - Aktuelle Prozess-PID abrufen

Messaging:
- `process.send(pid, topic, payload)` - Nachricht an PID senden
- `process.listen(topic)` - Topic abonnieren, Payloads empfangen
- `process.listen(topic, { message = true })` - Vollständige Nachricht mit `:from()`, `:payload()`, `:topic()` empfangen
- `process.inbox()` - Nachrichten empfangen die nicht von Listenern gematched werden

Monitoring:
- `process.events()` - Channel für EXIT und LINK_DOWN Events
- `process.monitor(pid)` - Existierenden Prozess überwachen
- `process.unmonitor(pid)` - Überwachung beenden

Linking:
- `process.link(pid)` - Mit Prozess verlinken
- `process.unlink(pid)` - Verlinkung aufheben
- `process.set_options({ trap_links = true })` - LINK_DOWN als Event statt Crash empfangen
- `process.get_options()` - Aktuelle Prozess-Optionen abrufen

Registry:
- `process.registry.register(name)` - Namen für aktuellen Prozess registrieren
- `process.registry.lookup(name)` - PID nach Namen finden
- `process.registry.unregister(name)` - Namensregistrierung entfernen

## Siehe auch

- [Prozess-Modul-Referenz](lua-process.md) - Vollständige API-Dokumentation
- [Channels](channels.md) - Channel-Operationen für Message-Handling
