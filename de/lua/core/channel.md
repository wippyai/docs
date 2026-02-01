# Channels und Coroutinen
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>


Go-artige Channels für Inter-Coroutine-Kommunikation. Erstellen Sie gepufferte oder ungepufferte Channels, senden und empfangen Sie Werte und koordinieren Sie zwischen nebenläufigen Prozessen mit Select-Statements.

Die globale `channel`-Variable ist immer verfügbar.

## Channels erstellen

Ungepufferte Channels (Größe 0) erfordern, dass sowohl Sender als auch Empfänger bereit sind, bevor die Übertragung abgeschlossen wird. Gepufferte Channels erlauben sofortige Sends, solange Platz verfügbar ist:

```lua
-- Ungepuffert: synchronisiert Sender und Empfänger
local sync_ch = channel.new()

-- Gepuffert: bis zu 10 Nachrichten in Warteschlange
local work_queue = channel.new(10)
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `size` | integer | Pufferkapazität (Standard: 0 für ungepuffert) |

**Gibt zurück:** `channel`

## Werte senden

Sendet einen Wert an den Channel. Blockiert bis ein Empfänger bereit ist (ungepuffert) oder Pufferplatz verfügbar ist (gepuffert):

```lua
-- Arbeit an Worker-Pool senden
local jobs = channel.new(100)
for i, task in ipairs(tasks) do
    jobs:send(task)  -- Blockiert wenn Puffer voll
end
jobs:close()  -- Signalisiert keine weitere Arbeit
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `value` | any | Zu sendender Wert |

**Gibt zurück:** `boolean`

Wirft Fehler wenn Channel geschlossen ist.

## Werte empfangen

Empfängt einen Wert vom Channel. Blockiert bis ein Wert verfügbar ist oder der Channel geschlossen wird:

```lua
-- Worker konsumiert von Job-Queue
while true do
    local job, ok = work:receive()
    if not ok then
        break  -- Channel geschlossen, keine weitere Arbeit
    end
    process(job)
end
```

**Gibt zurück:** `any, boolean`

- `value, true` - Einen Wert empfangen
- `nil, false` - Channel geschlossen und leer

## Channels schließen

Schließt den Channel. Wartende Sender erhalten einen Fehler, wartende Empfänger erhalten `nil, false`. Wirft Fehler wenn bereits geschlossen:

```lua
local results = channel.new(10)

-- Produzent füllt Ergebnisse
for _, item in ipairs(data) do
    results:send(process(item))
end
results:close()  -- Signalisiert Abschluss
```

## Aus mehreren Channels auswählen

Wartet gleichzeitig auf mehrere Channel-Operationen. Unverzichtbar für die Behandlung mehrerer Ereignisquellen, Implementierung von Timeouts und Erstellung reaktionsfähiger Systeme:

```lua
local result = channel.select(cases)
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `cases` | table | Array von Select-Cases |
| `default` | boolean | Wenn true, kehrt sofort zurück wenn kein Case bereit |

**Gibt zurück:** `table` mit Feldern: `channel`, `value`, `ok`, `default`

### Timeout-Muster

Warten auf Ergebnis mit Timeout unter Verwendung von `time.after()`.

```lua
local time = require("time")

local result_ch = worker:response()
local timeout = time.after("5s")

local r = channel.select {
    result_ch:case_receive(),
    timeout:case_receive()
}

if r.channel == timeout then
    return nil, errors.new("TIMEOUT", "Operation timed out")
end
return r.value
```

### Fan-in-Muster

Mehrere Quellen in einen Handler zusammenführen.

```lua
local events = process.events()
local inbox = process.inbox()
local shutdown = channel.new()

while true do
    local r = channel.select {
        events:case_receive(),
        inbox:case_receive(),
        shutdown:case_receive()
    }

    if r.channel == shutdown then
        break
    elseif r.channel == events then
        handle_event(r.value)
    else
        handle_message(r.value)
    end
end
```

### Nicht-blockierende Prüfung

Prüfen ob Daten verfügbar sind ohne zu blockieren.

```lua
local r = channel.select {
    ch:case_receive(),
    default = true
}

if r.default then
    -- Nichts verfügbar, etwas anderes tun
else
    process(r.value)
end
```

## Select-Cases erstellen

Cases zur Verwendung mit `channel.select` erstellen:

```lua
-- Send-Case - abgeschlossen wenn Channel Wert akzeptieren kann
ch:case_send(value)

-- Receive-Case - abgeschlossen wenn Wert verfügbar
ch:case_receive()
```

## Worker-Pool-Muster

```lua
local work = channel.new(100)
local results = channel.new(100)

-- Worker spawnen
for i = 1, num_workers do
    process.spawn("app.workers:processor", "app:processes", work, results)
end

-- Arbeit einspeisen
for _, item in ipairs(items) do
    work:send(item)
end
work:close()

-- Ergebnisse sammeln
local processed = {}
while #processed < #items do
    local result, ok = results:receive()
    if not ok then break end
    table.insert(processed, result)
end
```

## Fehler

| Bedingung | Art | Wiederholbar |
|-----------|------|-----------|
| Send auf geschlossenem Channel | Laufzeitfehler | nein |
| Close eines geschlossenen Channels | Laufzeitfehler | nein |
| Ungültiger Case in Select | Laufzeitfehler | nein |

## Siehe auch

- [Prozessverwaltung](lua/core/process.md) - Prozess-Spawning und Kommunikation
- [Nachrichtenwarteschlange](lua/storage/queue.md) - Queue-basiertes Messaging
- [Funktionen](lua/core/funcs.md) - Funktionsaufruf
