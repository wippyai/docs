# Echo-Service

Bauen Sie einen verteilten Echo-Service, der Prozesse, Channels, Coroutines, Message-Passing und Supervision demonstriert.

## Überblick

Dieses Tutorial erstellt einen CLI-Client, der Nachrichten an einen Relay-Service sendet, der Worker für jede Nachricht startet. Es demonstriert:

- **Prozess-Spawning** - Dynamisches Erstellen von Child-Prozessen
- **Message-Passing** - Kommunikation zwischen Prozessen via Send/Receive
- **Channels und Select** - Multiplexing mehrerer Ereignisquellen
- **Coroutines** - Nebenläufige Ausführung innerhalb eines Prozesses
- **Prozess-Registrierung** - Prozesse nach Namen finden
- **Monitoring** - Lebenszyklus von Child-Prozessen verfolgen

## Architektur

```mermaid
flowchart TB
    subgraph terminal["terminal.host"]
        CLI["CLI-Prozess"]
    end

    subgraph processes["process.host"]
        Relay["Relay-Prozess<br/>(+ Stats-Coroutine)"]
        W1["Worker 1"]
        W2["Worker 2"]
        W3["Worker N"]
    end

    CLI -->|"send('relay', 'echo', msg)"| Relay
    Relay -->|"spawn_monitored(worker)"| W1
    Relay -->|"spawn_monitored(...)"| W2
    Relay -->|"spawn_monitored(...)"| W3
    W1 -->|"send(sender, 'echo_response')"| CLI
    W2 -->|"send(...)"| CLI
    W3 -->|"send(...)"| CLI
```

## Projektstruktur

```
echo-service/
├── wippy.lock
└── src/
    ├── _index.yaml
    ├── cli.lua
    ├── relay.lua
    └── worker.lua
```

## Entry-Definitionen

Erstellen Sie `src/_index.yaml`:

```yaml
version: "1.0"
namespace: app

entries:
  - name: terminal
    kind: terminal.host
    lifecycle:
      auto_start: true

  - name: processes
    kind: process.host
    lifecycle:
      auto_start: true

  - name: cli
    kind: process.lua
    source: file://cli.lua
    method: main
    modules:
      - io
      - process
      - time
      - channel

  - name: relay
    kind: process.lua
    source: file://relay.lua
    method: main
    modules:
      - process
      - logger
      - channel
      - time

  - name: relay-service
    kind: process.service
    process: app:relay
    host: app:processes
    lifecycle:
      auto_start: true

  - name: worker
    kind: process.lua
    source: file://worker.lua
    method: main
    modules:
      - process
      - time
```

## Der Relay-Prozess

Der Relay registriert sich, behandelt Nachrichten, startet Worker und führt eine Stats-Coroutine aus.

Erstellen Sie `src/relay.lua`:

```lua
local logger = require("logger")
local time = require("time")

local stats = {
    messages = 0,
    workers_spawned = 0
}

local function stats_reporter()
    while true do
        time.sleep("5s")
        logger:info("stats", {
            messages = stats.messages,
            workers_spawned = stats.workers_spawned
        })
    end
end

local function main()
    local inbox = process.inbox()
    local events = process.events()

    process.registry.register("relay")
    logger:info("relay started", {pid = process.pid()})

    coroutine.spawn(stats_reporter)

    while true do
        local r = channel.select {
            inbox:case_receive(),
            events:case_receive()
        }

        if r.channel == events then
            local event = r.value
            if event.kind == process.event.EXIT then
                logger:info("worker exited", {
                    from = event.from,
                    result = event.result
                })
            end
        else
            local msg = r.value
            if msg:topic() == "echo" then
                local echo = msg:payload():data()
                stats.messages = stats.messages + 1

                local worker_pid, err = process.spawn_monitored(
                    "app:worker",
                    "app:processes",
                    echo.sender,
                    echo.data
                )

                if err then
                    logger:error("spawn failed", {error = err})
                else
                    stats.workers_spawned = stats.workers_spawned + 1
                end
            end
        end
    end
end

return { main = main }
```

### Schlüsselmuster {id="relay-key-patterns"}

**Coroutine-Spawning**

```lua
coroutine.spawn(stats_reporter)
```

Erstellt eine nebenläufige Coroutine, die Speicher mit der Hauptfunktion teilt. Coroutines yielden bei I/O-Operationen wie `time.sleep`.

**Channel-Select**

```lua
local r = channel.select {
    inbox:case_receive(),
    events:case_receive()
}
```

Wartet auf mehrere Channels. `r.channel` identifiziert welcher gefeuert hat, `r.value` enthält die Daten.

**Payload-Extraktion**

```lua
local echo = msg:payload():data()
```

Nachrichten haben `msg:topic()` für den Topic-String und `msg:payload():data()` für die Payload.

**Spawn mit Monitoring**

```lua
local worker_pid, err = process.spawn_monitored("app:worker", "app:processes", ...)
```

Kombiniert Spawn und Monitor. Wenn der Worker beendet wird, erhalten wir ein EXIT-Event.

## Der Worker-Prozess

Worker erhalten Argumente direkt und senden Antworten an den Sender.

Erstellen Sie `src/worker.lua`:

```lua
local time = require("time")

local function main(sender_pid, data)
    time.sleep("100ms")

    local response = {
        data = string.upper(data),
        worker = process.pid()
    }

    process.send(sender_pid, "echo_response", response)

    return 0
end

return { main = main }
```

## Der CLI-Prozess

Das CLI sendet Nachrichten nach registriertem Namen und wartet auf Antworten mit Timeout.

Erstellen Sie `src/cli.lua`:

```lua
local io = require("io")
local time = require("time")

local reset = "\027[0m"
local function dim(s) return "\027[2m" .. s .. reset end
local function green(s) return "\027[32m" .. s .. reset end
local function yellow(s) return "\027[33m" .. s .. reset end
local function cyan(s) return "\027[36m" .. s .. reset end

local function main()
    local inbox = process.inbox()

    -- Warten bis Relay registriert ist
    time.sleep("200ms")

    io.print(cyan("Echo Client"))
    io.print(dim("Nachrichten zum Echo eingeben. Ctrl+C zum Beenden.\n"))

    while true do
        io.write(yellow("> "))
        local input = io.readline()

        if not input or #input == 0 then
            break
        end

        local msg = {
            sender = process.pid(),
            data = input
        }
        local ok, err = process.send("relay", "echo", msg)
        if err then
            io.print(dim("  fehler: relay nicht verfügbar"))
        else
            local timeout = time.after("2s")
            local r = channel.select {
                inbox:case_receive(),
                timeout:case_receive()
            }

            if r.channel == timeout then
                io.print(dim("  timeout"))
            else
                local msg = r.value
                if msg:topic() == "echo_response" then
                    local resp = msg:payload():data()
                    io.print(green("  " .. resp.data))
                    io.print(dim("  von worker: " .. resp.worker))
                end
            end
        end
    end

    io.print("\nAuf Wiedersehen!")
    return 0
end

return { main = main }
```

### Schlüsselmuster {id="cli-key-patterns"}

**Nach Namen senden**

```lua
process.send("relay", "echo", msg)
```

`process.send` akzeptiert registrierte Namen direkt. Gibt Fehler zurück wenn nicht gefunden.

**Timeout-Muster**

```lua
local timeout = time.after("2s")
local r = channel.select {
    inbox:case_receive(),
    timeout:case_receive()
}
if r.channel == timeout then
    -- Timeout aufgetreten
end
```

## Ausführen

```bash
wippy init
wippy run -x app:terminal/app:cli
```

Beispielausgabe:

```
Echo Client
Nachrichten zum Echo eingeben. Ctrl+C zum Beenden.

> hello world
  HELLO WORLD
  von worker: {app:processes|0x00004}
```

## Konzepte-Zusammenfassung

| Konzept | API |
|---------|-----|
| Prozess-Spawning | `process.spawn_monitored(entry, host, ...)` |
| Message-Passing | `process.send(dest, topic, data)` |
| Inbox | `process.inbox()` |
| Events | `process.events()` |
| Registrierung | `process.registry.register(name)` |
| Channel-Select | `channel.select {...}` |
| Timeout | `time.after(duration)` |
| Coroutines | `coroutine.spawn(fn)` |

## Nächste Schritte

- [Prozess-Verwaltung](lua/core/process.md)
- [Channels](lua/core/channel.md)
- [Zeit und Dauer](lua/core/time.md)
