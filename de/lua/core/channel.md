---
title: "Channels und Coroutinen"
description: "Gepufferte und ungepufferte Channels erstellen, Werte austauschen, Operationen auswählen und nebenläufige Arbeit koordinieren."
---

# Channels und Coroutinen
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

Channels tauschen Werte zwischen nebenläufigen Tasks aus. Sie können gepuffert oder ungepuffert sein und lassen sich mit `channel.select` kombinieren, um mehrere Operationen zu koordinieren.

Diese Seite ist eine API-Referenz. Die grundlegenden Blöcke sind isolierte Snippets; die Abschnitte zu Timeout, Fan-in und nicht blockierendem Zugriff sind partielle Muster, deren benannte Channels und Callbacks aus der umgebenden Anwendung stammen. Der Worker-Pool-Block ist ein vollständiges Beispiel innerhalb eines Prozesses.

Die globalen Werte `channel` und `coroutine` sind immer verfügbar. Channels koordinieren Coroutinen innerhalb eines Lua-Prozesses; verwenden Sie Prozessnachrichten, Funktionen oder Queues über Prozessgrenzen hinweg.

## Channels erstellen

Bei einem ungepufferten Channel (Größe 0) müssen Sender und Empfänger bereit sein, bevor eine Übertragung abgeschlossen wird. Ein gepufferter Channel lässt Sends abschließen, solange Pufferplatz verfügbar ist.

```lua
-- Unbuffered: synchronizes sender and receiver
local sync_ch = channel.new()

-- Buffered: queue up to 10 messages
local work_queue = channel.new(10)
```

| Parameter | Typ | Beschreibung |
|-----------|-----|--------------|
| `size` | integer | Pufferkapazität (Standard: 0 für ungepuffert) |

**Rückgabewert:** `channel`

## Werte senden

Das Senden blockiert bei einem ungepufferten Channel, bis ein Empfänger bereit ist, oder bei einem gepufferten Channel, bis Pufferplatz verfügbar ist.

```lua
-- Send work to a worker pool
local tasks = {"task-a", "task-b"}
local jobs = channel.new(100)
for i, task in ipairs(tasks) do
    jobs:send(task)  -- Blocks if buffer full
end
jobs:close()  -- Signal no more work
```

| Parameter | Typ | Beschreibung |
|-----------|-----|--------------|
| `value` | any | Zu sendender Wert |

**Rückgabewert:** `boolean`

Das Senden an einen geschlossenen Channel löst einen Fehler aus.

## Werte empfangen

Das Empfangen blockiert, bis ein Wert verfügbar oder der Channel geschlossen ist.

```lua
-- Worker consuming from job queue
while true do
    local job, ok = jobs:receive()
    if not ok then
        break  -- Channel closed, no more work
    end
    process(job)
end
```

Hier ist `jobs` die von der Anwendung bereitgestellte Queue und `process` ihr Callback zur Task-Verarbeitung.

**Rückgabewerte:** `any, boolean`

- `value, true` — ein Wert wurde empfangen
- `nil, false` — der Channel ist geschlossen und leer

## Channels schließen

Beim Schließen eines Channels erhalten wartende Sender einen Fehler und wartende Empfänger `nil, false`. Das erneute Schließen eines bereits geschlossenen Channels hat keine Wirkung.

```lua
local results = channel.new(10)

-- Producer fills results
for _, item in ipairs(data) do
    results:send(process(item))
end
results:close()  -- Signal completion
```

Dieses isolierte Producer-Snippet setzt voraus, dass die Anwendung `data` und den Callback `process` bereitstellt.

## Aus mehreren Channels auswählen

`channel.select` wartet gleichzeitig auf mehrere Channel-Operationen. Damit lassen sich Ereignisquellen, Timeouts und nicht blockierende Prüfungen koordinieren.

```lua
local result = channel.select(cases)
```

| Parameter | Typ | Beschreibung |
|-----------|-----|--------------|
| `cases` | table | Array von Select-Cases |
| `default` | boolean | Gibt sofort zurück, wenn `true` und kein Case bereit ist |

**Rückgabewert:** `table`

- Für einen Channel-Case: `{channel, value, ok}` — `channel` ist der Channel des Cases, `value` der empfangene oder gesendete Wert und `ok` bei einem Receive auf einem geschlossenen Channel `false`.
- Für den Default-Zweig, wenn kein Case bereit und `default = true` ist: `{default = true, ok = true}`.

### Timeout-Muster

Fügen Sie einem Channel-Wait mit `time.after()` ein Zeitlimit hinzu.

```lua
local time = require("time")

local result_ch = application_response_channel
local timeout, err = time.after("5s")
if err then
    return nil, err
end

local r = channel.select {
    result_ch:case_receive(),
    timeout:case_receive()
}

if r.channel == timeout then
    return nil, errors.new({
        message = "Operation timed out",
        kind = errors.TIMEOUT
    })
end
if not r.ok then
    return nil, errors.new("Response channel closed")
end
return r.value
```

Dieses partielle Muster setzt voraus, dass der Eintrag `time` unter `modules:` aufführt und die Anwendung `application_response_channel` bereitstellt. `time.after` gibt bei Erfolg genau einen Channel zurück; bei einer ungültigen oder nicht positiven Dauer lautet das Ergebnis `nil, error`.

### Fan-in-Muster

Verarbeiten Sie Werte aus mehreren Quellen in einer Schleife.

Dieses Muster für einen Prozesseintrag verwendet den ambienten Wert `process`; die Anwendung stellt das Shutdown-Signal und die beiden Handlerfunktionen bereit.

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

### Nicht blockierende Prüfung

Prüfen Sie mit einem Default-Case auf verfügbare Daten, ohne zu blockieren.

In diesem isolierten Muster stammen `ch` und der Callback `process` aus der Anwendung.

```lua
local r = channel.select {
    ch:case_receive(),
    default = true
}

if r.default then
    -- Nothing available, do something else
elseif not r.ok then
    -- The channel is closed
else
    process(r.value)
end
```

## Select-Cases erstellen

Erstellen Sie Send- und Receive-Cases für `channel.select`:

```lua
-- Send case - completes when channel can accept value
ch:case_send(value)

-- Receive case - completes when value available
ch:case_receive()
```

Werte in der Cases-Tabelle, die keine Send- oder Receive-Cases sind, werden ignoriert. Stellen Sie sicher, dass die Tabelle mindestens einen gültigen Case enthält, sofern sie keinen Default-Zweig besitzt.

## Worker-Pool-Muster

```lua
local items = {1, 2, 3, 4}
local num_workers = 2

local function process_item(item)
    return item * 2
end

local work = channel.new(#items)
local results = channel.new(#items)

-- Spawn workers
for _ = 1, num_workers do
    coroutine.spawn(function()
        while true do
            local item, ok = work:receive()
            if not ok then
                return
            end
            results:send(process_item(item))
        end
    end)
end

-- Feed work
for _, item in ipairs(items) do
    work:send(item)
end
work:close()

-- Collect results
local processed = {}
while #processed < #items do
    local result, ok = results:receive()
    if not ok then break end
    table.insert(processed, result)
end
```

Nach der Schleife enthält `processed` die Werte `2`, `4`, `6` und `8`; ihre Reihenfolge hängt vom Coroutine-Scheduling ab. Die Worker teilen Channels, weil sie Coroutinen im selben Lua-Prozess sind.

## Fehler

| Bedingung | Art | Wiederholbar |
|-----------|-----|--------------|
| Send auf geschlossenem Channel | Runtime-Fehler | nicht anwendbar |

## Siehe auch

- [Prozessverwaltung](lua/core/process.md) - Prozesse starten und kommunizieren lassen
- [Nachrichten-Queue](lua/storage/queue.md) - Queue-basierte Nachrichtenübermittlung
- [Funktionen](lua/core/funcs.md) - Funktionen aufrufen
