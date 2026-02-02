# Channels und Nebenläufigkeit

Go-Style-Channels für nebenläufige Programmierung innerhalb von Prozessen.

## Channels erstellen

Channels sind Kommunikationsröhren für Coroutines. Erstellen Sie mit `channel.new(capacity)`:

```lua
local ch = channel.new(1)  -- Gepufferter Channel, Kapazität 1
```

### Gepufferte Channels

Gepufferte Channels erlauben Sends ohne Blockierung bis der Puffer voll ist:

```lua
local ch = channel.new(3)  -- Puffer hält 3 Elemente

-- Ohne Blockierung senden
ch:send(1)
ch:send(2)
ch:send(3)

-- In FIFO-Reihenfolge empfangen
local v1, ok1 = ch:receive()  -- 1, true
local v2, ok2 = ch:receive()  -- 2, true
local v3, ok3 = ch:receive()  -- 3, true
```

### Ungepufferte Channels

Ungepufferte Channels (Kapazität 0) synchronisieren Sender und Empfänger:

```lua
local ch = channel.new(0)  -- Ungepuffert
local done = channel.new(1)

coroutine.spawn(function()
    ch:send("from spawn")  -- Blockiert bis Empfänger bereit
    done:send(true)
end)

local val = ch:receive()  -- Empfängt "from spawn"
local completed = done:receive()
```

## Channel-Select

`channel.select` wartet auf mehrere Channels, gibt die erste bereite Operation zurück:

```lua
local ch1 = channel.new(1)
local ch2 = channel.new(1)

ch1:send("ch1_value")

local result = channel.select{
    ch1:case_receive(),
    ch2:case_receive()
}

-- result ist eine Tabelle mit: channel, value, ok
result.channel == ch1  -- true
result.value           -- "ch1_value"
result.ok              -- true
```

### Select mit Send

Verwenden Sie `case_send` um nicht-blockierende Sends zu versuchen:

```lua
local ch = channel.new(1)

local result = channel.select{
    ch:case_send("sent")
}

result.ok  -- true (Send erfolgreich)

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

-- 3 Worker starten
for w = 1, 3 do
    coroutine.spawn(function()
        while true do
            local job, ok = work:receive()
            if not ok then break end
            results:send(job * 2)
        end
    end)
end

-- Arbeit senden
for i = 1, 6 do
    work:send(i)
end
work:close()

-- Ergebnisse sammeln
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

-- Producer starten
for p = 1, producer_count do
    coroutine.spawn(function()
        for i = 1, items_per_producer do
            output:send({producer = p, item = i})
        end
    end)
end

-- Alle Nachrichten sammeln
local received = {}
for i = 1, producer_count * items_per_producer do
    local msg = output:receive()
    table.insert(received, msg)
end

-- Verifizieren dass alle Producer ihre Items gesendet haben
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
        if not ok then break end  -- Channel geschlossen
        count = count + 1
    end
    done:send(count)
end)

for i = 1, 10 do
    ch:send(i)
end
ch:close()  -- Signalisiert keine weiteren Werte

local total = done:receive()
```

## Channel-Methoden

Verfügbare Operationen:

- `channel.new(capacity)` - Channel mit Puffergröße erstellen
- `ch:send(value)` - Wert senden (blockiert wenn Puffer voll)
- `ch:receive()` - Wert empfangen, gibt `value, ok` zurück
- `ch:close()` - Channel schließen
- `ch:case_send(value)` - Send-Case für Select erstellen
- `ch:case_receive()` - Receive-Case für Select erstellen
- `channel.select{cases...}` - Auf mehrere Operationen warten

## Nächste Schritte

- [Channel-Modul-Referenz](lua/core/channel.md) - Vollständige API-Dokumentation
- [Prozesse](processes.md) - Inter-Prozess-Kommunikation
