# WebSocket-Client
<secondary-label ref="network"/>
<secondary-label ref="io"/>
<secondary-label ref="permissions"/>

WebSocket-Client für bidirektionale Echtzeit-Kommunikation mit Servern.

## Laden

```lua
local websocket = require("websocket")
```

## Verbinden

### Einfache Verbindung

```lua
local client, err = websocket.connect("wss://api.example.com/ws")
if err then
    return nil, err
end
```

### Mit Optionen

```lua
local client, err = websocket.connect("wss://api.example.com/ws", {
    headers = {
        ["Authorization"] = "Bearer " .. token
    },
    protocols = {"graphql-ws"},
    dial_timeout = "10s",
    read_timeout = "30s",
    compression = websocket.COMPRESSION.CONTEXT_TAKEOVER
})
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `url` | string | WebSocket-URL (ws:// oder wss://) |
| `options` | table | Verbindungsoptionen (optional) |

**Gibt zurück:** `Client, error`

### Verbindungsoptionen

| Option | Typ | Beschreibung |
|--------|------|-------------|
| `headers` | table | HTTP-Header für Handshake |
| `protocols` | table | WebSocket-Subprotokolle |
| `dial_timeout` | number/string | Verbindungs-Timeout (ms oder "5s") |
| `read_timeout` | number/string | Lese-Timeout |
| `write_timeout` | number/string | Schreib-Timeout |
| `compression` | number | Komprimierungsmodus (siehe Konstanten) |
| `compression_threshold` | number | Min. Größe zum Komprimieren (0-100MB) |
| `read_limit` | number | Max. Nachrichtengröße (0-128MB) |
| `channel_capacity` | number | Empfangs-Channel-Puffer (1-10000) |

**Timeout-Format:** Zahlen sind Millisekunden, Strings verwenden Go-Dauerformat ("5s", "1m").

## Nachrichten senden

### Textnachrichten

```lua
local ok, err = client:send("Hello, Server!")
if err then
    return nil, err
end

-- JSON senden
client:send(json.encode({
    type = "subscribe",
    channel = "orders"
}))
```

### Binarnachrichten

```lua
client:send(binary_data, websocket.BINARY)
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `data` | string | Nachrichteninhalt |
| `type` | number | `websocket.TEXT` (1) oder `websocket.BINARY` (2) |

**Gibt zurück:** `boolean, error`

### Ping

```lua
client:ping()
```

**Gibt zurück:** `boolean, error`

## Nachrichten empfangen

Die `channel()`-Methode gibt einen Channel zum Empfangen von Nachrichten zurück. Funktioniert mit `channel.select` für Multiplexing.

### Einfaches Empfangen

```lua
local ch = client:channel()

local msg, ok = ch:receive()
if ok then
    print("Type:", msg.type)  -- "text" oder "binary"
    print("Data:", msg.data)
end
```

### Nachrichtenschleife

```lua
local ch = client:channel()

while true do
    local msg, ok = ch:receive()
    if not ok then
        break  -- Verbindung geschlossen
    end

    if msg.type == "text" then
        local data = json.decode(msg.data)
        handle_message(data)
    end
end
```

### Mit Select

```lua
local ch = client:channel()
local timeout = time.after("30s")

while true do
    local r = channel.select {
        ch:case_receive(),
        timeout:case_receive()
    }

    if r.channel == timeout then
        client:ping()  -- Keep-Alive
        timeout = time.after("30s")
    else
        local data = json.decode(r.value.data)
        process(data)
    end
end
```

### Nachrichtenobjekt

| Feld | Typ | Beschreibung |
|-------|------|-------------|
| `type` | string | `"text"` oder `"binary"` |
| `data` | string | Nachrichteninhalt |

## Verbindung schließen

```lua
-- Normales Schließen (Code 1000)
client:close()

-- Mit Code und Grund
client:close(websocket.CLOSE_CODES.NORMAL, "Session ended")

-- Fehler-Schließen
client:close(websocket.CLOSE_CODES.INTERNAL_ERROR, "Processing failed")
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `code` | number | Schließ-Code (1000-4999), Standard 1000 |
| `reason` | string | Schließgrund (optional) |

**Gibt zurück:** `boolean, error`

## Konstanten

### Nachrichtentypen

```lua
-- Numerisch (für send)
websocket.TEXT    -- 1
websocket.BINARY  -- 2

-- String (empfangener Nachrichtentyp-Feld)
websocket.TYPE_TEXT    -- "text"
websocket.TYPE_BINARY  -- "binary"
websocket.TYPE_PING    -- "ping"
websocket.TYPE_PONG    -- "pong"
websocket.TYPE_CLOSE   -- "close"
```

### Komprimierungsmodi

```lua
websocket.COMPRESSION.DISABLED         -- 0 (keine Komprimierung)
websocket.COMPRESSION.CONTEXT_TAKEOVER -- 1 (gleitendes Fenster)
websocket.COMPRESSION.NO_CONTEXT       -- 2 (pro Nachricht)
```

### Schließ-Codes

| Konstante | Code | Beschreibung |
|----------|------|-------------|
| `NORMAL` | 1000 | Normales Schließen |
| `GOING_AWAY` | 1001 | Server fährt herunter |
| `PROTOCOL_ERROR` | 1002 | Protokollfehler |
| `UNSUPPORTED_DATA` | 1003 | Nicht unterstützter Datentyp |
| `NO_STATUS` | 1005 | Kein Status empfangen |
| `ABNORMAL_CLOSURE` | 1006 | Verbindung verloren |
| `INVALID_PAYLOAD` | 1007 | Ungültiger Frame-Payload |
| `POLICY_VIOLATION` | 1008 | Richtlinienverletzung |
| `MESSAGE_TOO_BIG` | 1009 | Nachricht zu groß |
| `INTERNAL_ERROR` | 1011 | Serverfehler |
| `SERVICE_RESTART` | 1012 | Server startet neu |
| `TRY_AGAIN_LATER` | 1013 | Server überlastet |

```lua
client:close(websocket.CLOSE_CODES.NORMAL, "Done")
```

## Beispiele

### Echtzeit-Chat

```lua
local function connect_chat(room_id, on_message)
    local client, err = websocket.connect("wss://chat.example.com/ws", {
        headers = {["Authorization"] = "Bearer " .. token}
    })
    if err then
        return nil, err
    end

    -- Raum beitreten
    client:send(json.encode({
        type = "join",
        room = room_id
    }))

    -- Nachrichtenschleife
    local ch = client:channel()
    while true do
        local msg, ok = ch:receive()
        if not ok then break end

        local data = json.decode(msg.data)
        on_message(data)
    end

    client:close()
end
```

### Preis-Stream mit Keep-Alive

```lua
local client = websocket.connect("wss://stream.example.com/prices")

client:send(json.encode({
    action = "subscribe",
    symbols = {"BTC-USD", "ETH-USD"}
}))

local ch = client:channel()
local heartbeat = time.after("30s")

while true do
    local r = channel.select {
        ch:case_receive(),
        heartbeat:case_receive()
    }

    if r.channel == heartbeat then
        client:ping()
        heartbeat = time.after("30s")
    elseif not r.ok then
        break  -- Verbindung geschlossen
    else
        local price = json.decode(r.value.data)
        update_price(price.symbol, price.value)
    end
end

client:close()
```

## Berechtigungen

WebSocket-Verbindungen unterliegen der Sicherheitsrichtlinienauswertung.

### Sicherheitsaktionen

| Aktion | Ressource | Beschreibung |
|--------|----------|-------------|
| `websocket.connect` | - | WebSocket-Verbindungen erlauben/verweigern |
| `websocket.connect.url` | URL | Verbindungen zu bestimmten URLs erlauben/verweigern |

Siehe [Sicherheitsmodell](system-security.md) für Richtlinienkonfiguration.

## Fehler

| Bedingung | Art | Wiederholbar |
|-----------|------|-----------|
| Verbindungen deaktiviert | `errors.PERMISSION_DENIED` | nein |
| URL nicht erlaubt | `errors.PERMISSION_DENIED` | nein |
| Kein Kontext | `errors.INTERNAL` | nein |
| Verbindung fehlgeschlagen | `errors.INTERNAL` | ja |
| Ungültige Verbindungs-ID | `errors.INTERNAL` | nein |

```lua
local client, err = websocket.connect(url)
if err then
    if errors.is(err, errors.PERMISSION_DENIED) then
        print("Access denied:", err:message())
    elseif err:retryable() then
        print("Temporary error:", err:message())
    end
    return nil, err
end
```

Siehe [Fehlerbehandlung](lua-errors.md) für die Arbeit mit Fehlern.
