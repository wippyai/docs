---
title: "Channels und Nebenläufigkeit: Einführung"
description: "Channel-Operationen und Muster zur Koordination von Coroutinen kennenlernen."
---

# Channels und Nebenläufigkeit: Einführung

Diese Seite führt Channels zur Koordination von Coroutinen innerhalb eines Prozesses ein. Die Beispiele behandeln Pufferung, Auswahl, Producer-Consumer-Flows, Fan-out, Fan-in und das Schließen von Channels.

**Klassifizierung:** Referenz/API-Einführung. Die Snippets sind voneinander unabhängige Beispiele und keine eigenständige Anwendung.

## Kontext und Abhängigkeiten

Führen Sie diese Snippets in einer exportierten Funktion eines ausführbaren Lua-Eintrags wie `process.lua` aus. Die APIs `channel` und `coroutine` sind in diesem Ausführungskontext Umgebungs-Globals; sie benötigen weder `require()`-Aufrufe noch `modules`-Deklarationen. Jedes Snippet erstellt seine eigenen Channels und sollte separat ausgeführt werden.

## Channels erstellen

Channels übertragen Werte zwischen Coroutinen. Erstellen Sie einen Channel mit `channel.new(capacity)`:

```lua
local ch = channel.new(1)  -- buffered channel, capacity 1
```

### Gepufferte Channels

Ein Send an einen gepufferten Channel blockiert erst, wenn dessen Puffer voll ist:

```lua
local ch = channel.new(3)  -- buffer holds 3 items

-- Send without blocking
ch:send(1)
ch:send(2)
ch:send(3)

-- Receive in FIFO order
local v1, ok1 = ch:receive()  -- 1, true
local v2, ok2 = ch:receive()  -- 2, true
local v3, ok3 = ch:receive()  -- 3, true
```

### Ungepufferte Channels

Ungepufferte Channels (Kapazität 0) synchronisieren Sender und Empfänger:

```lua
local ch = channel.new(0)  -- unbuffered
local done = channel.new(1)

coroutine.spawn(function()
    ch:send("from spawn")  -- blocks until receiver ready
    done:send(true)
end)

local val = ch:receive()  -- receives "from spawn"
local completed = done:receive()
```

## Channel-Select

`channel.select` wartet auf mehrere Channel-Operationen und gibt die erste bereite Operation zurück:

```lua
local ch1 = channel.new(1)
local ch2 = channel.new(1)

ch1:send("ch1_value")

local result = channel.select{
    ch1:case_receive(),
    ch2:case_receive()
}

-- result is a table with: channel, value, ok
result.channel == ch1  -- true
result.value           -- "ch1_value"
result.ok              -- true
```

### Select mit Send

Verwenden Sie `case_send`, um eine Send-Operation in ein Select aufzunehmen. Ohne Default-Case wartet `channel.select`, bis einer seiner Cases bereit ist. Mit `default = true` wird der Versuch nicht blockierend:

```lua
local ch = channel.new(1)

local result = channel.select{
    ch:case_send("sent"),
    default = true
}

if not result.default then
    result.ok  -- true (send succeeded)
end

local v = ch:receive()  -- "sent"
```

## Producer-Consumer-Muster

Ein Producer, ein Consumer:

```lua
local ch = channel.new(5)
local done = channel.new(1)
local consumed = 0

-- Consumer
coroutine.spawn(function()
    while true do
        local v, ok = ch:receive()
        if not ok then break end
        consumed = consumed + 1
    end
    done:send(consumed)
end)

-- Producer
for i = 1, 10 do
    ch:send(i)
end
ch:close()

local total = done:receive()  -- 10
```

### Ping-Pong-Muster

Zwei Coroutines synchronisieren:

```lua
local ping = channel.new(0)
local pong = channel.new(0)
local rounds_done = channel.new(1)

coroutine.spawn(function()
    for i = 1, 5 do
        ping:receive()
        pong:send("pong")
    end
    rounds_done:send(true)
end)

for i = 1, 5 do
    ping:send("ping")
    pong:receive()
end

local completed = rounds_done:receive()
```

## Fan-Out-Muster

Ein Producer, mehrere Consumer:

```lua
local work = channel.new(10)
local results = channel.new(10)

-- Spawn 3 workers
for w = 1, 3 do
    coroutine.spawn(function()
        while true do
            local job, ok = work:receive()
            if not ok then break end
            results:send(job * 2)
        end
    end)
end

-- Send work
for i = 1, 6 do
    work:send(i)
end
work:close()

-- Collect results
local sum = 0
for i = 1, 6 do
    local r = results:receive()
    sum = sum + r
end
-- sum = (1+2+3+4+5+6)*2 = 42
```

## Fan-In-Muster

Mehrere Producer, ein Consumer:

```lua
local output = channel.new(10)
local producer_count = 4
local items_per_producer = 5

-- Spawn producers
for p = 1, producer_count do
    local producer_id = p
    coroutine.spawn(function()
        for i = 1, items_per_producer do
            output:send({producer = producer_id, item = i})
        end
    end)
end

-- Collect all messages
local received = {}
for i = 1, producer_count * items_per_producer do
    local msg = output:receive()
    table.insert(received, msg)
end

-- Verify all producers sent their items
local counts = {}
for _, msg in ipairs(received) do
    counts[msg.producer] = (counts[msg.producer] or 0) + 1
end
```

## Channels schließen

Schließen Sie Channels um Abschluss zu signalisieren. Empfänger erhalten `ok = false` wenn Channel geschlossen und leer ist:

```lua
local ch = channel.new(5)
local done = channel.new(1)

coroutine.spawn(function()
    local count = 0
    while true do
        local v, ok = ch:receive()
        if not ok then break end  -- channel closed
        count = count + 1
    end
    done:send(count)
end)

for i = 1, 10 do
    ch:send(i)
end
ch:close()  -- signal no more values

local total = done:receive()
```

## Channel-Methoden

Channel-Operationen:

- `channel.new(capacity)` — Einen Channel mit der angegebenen Puffergröße erstellen
- `ch:send(value)` — Einen Wert senden und blockieren, wenn der Puffer voll ist; das Senden an einen geschlossenen Channel löst einen Fehler aus
- `ch:receive()` — Einen Wert empfangen und `value, ok` zurückgeben
- `ch:close()` — Den Channel schließen; erneutes Schließen löst einen Fehler aus
- `ch:case_send(value)` — Einen Send-Case für `select` erstellen
- `ch:case_receive()` — Einen Receive-Case für `select` erstellen
- `channel.select{cases...}` — Auf mehrere Operationen warten und `channel`, `value` und `ok` zurückgeben
- `channel.select{cases..., default = true}` — Sofort `{default = true, ok = true}` zurückgeben, wenn kein Case bereit ist

## Nächste Schritte

- [Channel-Modulreferenz](../lua/core/channel.md) — Dokumentation der Channel-API
- [Prozesse](processes.md) — Kommunikation zwischen Prozessen
