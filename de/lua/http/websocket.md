---
title: "WebSocket-Client"
description: "Verbindungen zu WebSocket-Servern herstellen, Nachrichten senden und empfangen, Komprimierung verwenden und Verbindungen schließen."
---

# WebSocket-Client
<secondary-label ref="network"/>
<secondary-label ref="io"/>
<secondary-label ref="permissions"/>

Das Modul `websocket` erstellt bidirektionale Clientverbindungen zu WebSocket-Servern.

Diese Seite ist eine API-Referenz mit Teilrezepten für Verbindungen und Abonnements. Endpoint-URLs, Tokens, Nachrichten-Handler und Anwendungsdaten stammen aus der umgebenden Anwendung. Die Lebenszyklusbeispiele schließen den Client auf jedem abschließenden oder geprüften Fehlerpfad; kleinere Methodenausschnitte setzen voraus, dass ein umgebender Besitzer das Cleanup übernimmt.

## Laden

```lua
local websocket = require("websocket")
```

## Verbinden

### `connect`

Öffnet eine WebSocket-Verbindung mit Standardoptionen.

```lua
local client, err = websocket.connect("wss://api.example.com/ws")
if err then
    return nil, err
end
```

Übergeben Sie eine Optionstabelle, um die Verbindung zu konfigurieren:

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
if err then
    return nil, err
end
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `url` | string | WebSocket-URL (ws:// oder wss://) |
| `options` | table | Verbindungsoptionen (optional) |

**Gibt zurück:** `Client, error`

#### Verbindungsoptionen

| Option | Typ | Beschreibung |
|--------|------|-------------|
| `headers` | table | HTTP-Handshake-Header als Zeichenkettenpaare; andere Einträge werden ignoriert |
| `protocols` | table | WebSocket-Subprotokolle als Zeichenketten; andere Einträge werden ignoriert |
| `dial_timeout` | number/string | Verbindungs-Timeout; `0` setzt keine Runtime-weite Frist, Standardwerte des HTTP-Transports gelten weiterhin |
| `read_timeout` | number/string | Lese-Timeout pro Nachricht; `0` deaktiviert ihn |
| `write_timeout` | number/string | Von der Lua-API akzeptiert, in Runtime `v0.3.32a` aber nicht angewendet |
| `compression` | number/string | `0`/`"disabled"`, `1`/`"context_takeover"` oder `2`/`"no_context_takeover"`; standardmäßig deaktiviert |
| `compression_threshold` | number | Mindestgröße für Komprimierung in Bytes (0-104857600); `0` verwendet 128 Bytes bei Context Takeover oder 512 bei No Context Takeover |
| `read_limit` | number | Maximale Größe eingehender Nachrichten in Bytes (0-134217728); `0` verwendet 16 MiB |
| `channel_capacity` | number | Serverseitiger Puffer eingehender Nachrichten (1-10000); Standard 16 |

**Timeout-Format:** Zahlen sind Millisekunden; Zeichenketten verwenden Go-Dauersyntax wie `"5s"` oder `"1m"`. Ungültige Timeout-Zeichenketten und nicht unterstützte oder außerhalb des Bereichs liegende Optionswerte werden ignoriert, sodass der jeweilige Standard gilt.

## Nachrichten senden

### Textnachrichten

```lua
local json = require("json")

client:send("Hello, Server!")

-- Send JSON
local payload, encode_err = json.encode({
    type = "subscribe",
    channel = "orders"
})
if encode_err then return nil, encode_err end
client:send(payload)
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

Fehlt `type` oder ist es weder `websocket.TEXT` noch `websocket.BINARY`, sendet die Runtime eine Textnachricht. Der Aufruf yieldet bis zum Abschluss des Send-Commands und gibt keine Werte zurück. Transportfehler beim Senden werden in Runtime `v0.3.32a` nicht an Lua gemeldet.

### Ping

```lua
client:ping()
```

**Gibt zurück:** `boolean, error`

Der Aufruf yieldet bis zum Abschluss des Ping-Commands und gibt keine Werte zurück. Transportfehler beim Ping werden in Runtime `v0.3.32a` nicht an Lua gemeldet.

## Nachrichten empfangen

`channel()` liefert den Empfangs-Channel; `receive()` ist ein Alias. Der erste Aufruf yieldet, während die Runtime das Abonnement erstellt; spätere Aufrufe liefern sofort denselben Channel. Ein Abonnementfehler liefert `nil, error`. Der Channel kann mit `channel.select` verwendet werden.

### Einfaches Empfangen

```lua
local ch, err = client:channel()
if err then
    client:close()
    return nil, err
end

local msg, ok = ch:receive()
if ok then
    print("Type:", msg.type)  -- "text" or "binary"
    print("Data:", msg.data)
end

local _, close_err = client:close()
if close_err then return nil, close_err end
```

### Nachrichtenschleife

```lua
local json = require("json")

local ch, err = client:channel()
if err then
    client:close()
    return nil, err
end

while true do
    local msg, ok = ch:receive()
    if not ok then
        break  -- Connection closed
    end

    if msg.type == "text" then
        local data, decode_err = json.decode(msg.data)
        if decode_err then
            client:close()
            return nil, decode_err
        end
        handle_message(data)
    end
end

local _, close_err = client:close()
if close_err then return nil, close_err end
```

### Mit Select

```lua
local json = require("json")
local time = require("time")

local ch, ch_err = client:channel()
if ch_err then
    client:close()
    return nil, ch_err
end

local timeout, timeout_err = time.after("30s")
if timeout_err then
    client:close()
    return nil, timeout_err
end

while true do
    local r = channel.select {
        ch:case_receive(),
        timeout:case_receive()
    }

    if r.channel == timeout then
        client:ping()  -- Keep-alive
        timeout, timeout_err = time.after("30s")
        if timeout_err then
            client:close()
            return nil, timeout_err
        end
    elseif not r.ok then
        break
    else
        local data, decode_err = json.decode(r.value.data)
        if decode_err then
            client:close()
            return nil, decode_err
        end
        process(data)
    end
end

local _, close_err = client:close()
if close_err then return nil, close_err end
```

### Nachrichtenobjekt

| Feld | Typ | Beschreibung |
|-------|------|-------------|
| `type` | string | `"text"` oder `"binary"` |
| `data` | string? | Nachrichteninhalt (nil bei unbekannten Payload-Typen) |

## Verbindung schließen

```lua
local _, close_err = client:close(websocket.CLOSE_CODES.NORMAL, "Session ended")
if close_err then return nil, close_err end

-- Omitting both arguments also uses normal close code 1000.
-- Use INTERNAL_ERROR with an application-owned reason for a failed session.
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `code` | number | Schließ-Code (1000-4999), Standard 1000 |
| `reason` | string | Schließgrund (optional) |

**Gibt zurück:** `boolean, error`

Der Aufruf yieldet bis zum Abschluss des Close-Commands. Erfolg gibt keine Werte zurück; ein Fehler liefert `nil, error`. Erfassen Sie beim Prüfen zwei Ergebnisse, da der Fehler an zweiter Stelle steht. Werte außerhalb des erlaubten numerischen Bereichs werden ignoriert und durch den Standardcode `1000` ersetzt.

Der Empfangs-Channel gehört dem Client; schließen Sie ihn nicht direkt. Ein entferntes Terminalereignis schließt den Channel. `client:close()` beendet das Abonnement und den clientseitigen Producer; rufen Sie es zeitnah auf, statt sich auf Cleanup beim Prozessende zu verlassen.

## Konstanten

### Nachrichtentypen

```lua
-- Numeric (for send)
websocket.TEXT    -- 1
websocket.BINARY  -- 2

-- Compatibility string constants
websocket.TYPE_TEXT    -- "text"
websocket.TYPE_BINARY  -- "binary"
websocket.TYPE_PING    -- "ping"
websocket.TYPE_PONG    -- "pong"
websocket.TYPE_CLOSE   -- "close"
```

### Komprimierungsmodi

```lua
websocket.COMPRESSION.DISABLED         -- 0 (no compression)
websocket.COMPRESSION.CONTEXT_TAKEOVER -- 1 (sliding window)
websocket.COMPRESSION.NO_CONTEXT       -- 2 (per-message)
```

### Schließ-Codes

| Konstante | Code | Beschreibung |
|----------|------|-------------|
| `NORMAL` | 1000 | Normales Schließen |
| `GOING_AWAY` | 1001 | Server fährt herunter |
| `PROTOCOL_ERROR` | 1002 | Protokollfehler |
| `UNSUPPORTED_DATA` | 1003 | Nicht unterstützter Datentyp |
| `RESERVED` | 1004 | Reserviert |
| `NO_STATUS` | 1005 | Kein Status empfangen |
| `ABNORMAL_CLOSURE` | 1006 | Verbindung verloren |
| `INVALID_PAYLOAD` | 1007 | Ungültiger Frame-Payload |
| `POLICY_VIOLATION` | 1008 | Richtlinienverletzung |
| `MESSAGE_TOO_BIG` | 1009 | Nachricht zu groß |
| `MANDATORY_EXTENSION` | 1010 | Erforderliche Erweiterung nicht ausgehandelt |
| `INTERNAL_ERROR` | 1011 | Serverfehler |
| `SERVICE_RESTART` | 1012 | Server startet neu |
| `TRY_AGAIN_LATER` | 1013 | Server überlastet |
| `BAD_GATEWAY` | 1014 | Gateway-Fehler |
| `TLS_HANDSHAKE` | 1015 | TLS-Handshake fehlgeschlagen |

```lua
local _, close_err = client:close(websocket.CLOSE_CODES.NORMAL, "Done")
if close_err then return nil, close_err end
```

## Beispiele

### Echtzeit-Chat

```lua
local json = require("json")

local function connect_chat(room_id, token, on_message)
    local client, err = websocket.connect("wss://chat.example.com/ws", {
        headers = {["Authorization"] = "Bearer " .. token}
    })
    if err then
        return nil, err
    end

    -- Join room. Runtime v0.3.32a does not expose transport send failures.
    local join_payload, encode_err = json.encode({
        type = "join",
        room = room_id
    })
    if encode_err then
        client:close()
        return nil, encode_err
    end
    client:send(join_payload)

    -- Message loop
    local ch, channel_err = client:channel()
    if channel_err then
        client:close()
        return nil, channel_err
    end
    while true do
        local msg, ok = ch:receive()
        if not ok then break end

        local data, decode_err = json.decode(msg.data)
        if decode_err then
            client:close()
            return nil, decode_err
        end
        on_message(data)
    end

    local _, close_err = client:close()
    if close_err then return nil, close_err end
    return true
end
```

### Preis-Stream mit Keep-Alive

```lua
local json = require("json")
local time = require("time")

local client, err = websocket.connect("wss://stream.example.com/prices")
if err then
    return nil, err
end

local subscribe_payload, encode_err = json.encode({
    action = "subscribe",
    symbols = {"BTC-USD", "ETH-USD"}
})
if encode_err then
    client:close()
    return nil, encode_err
end
client:send(subscribe_payload)

local ch, channel_err = client:channel()
if channel_err then
    client:close()
    return nil, channel_err
end

local heartbeat, heartbeat_err = time.after("30s")
if heartbeat_err then
    client:close()
    return nil, heartbeat_err
end

while true do
    local r = channel.select {
        ch:case_receive(),
        heartbeat:case_receive()
    }

    if r.channel == heartbeat then
        client:ping()
        heartbeat, heartbeat_err = time.after("30s")
        if heartbeat_err then
            client:close()
            return nil, heartbeat_err
        end
    elseif not r.ok then
        break  -- Connection closed
    else
        local price, decode_err = json.decode(r.value.data)
        if decode_err then
            client:close()
            return nil, decode_err
        end
        update_price(price.symbol, price.value)
    end
end

local _, close_err = client:close()
if close_err then return nil, close_err end
```

## Berechtigungen

WebSocket-Verbindungen unterliegen der Sicherheitsrichtlinienauswertung.

### Sicherheitsaktionen

| Aktion | Ressource | Beschreibung |
|--------|----------|-------------|
| `websocket.connect` | - | WebSocket-Verbindungen erlauben/verweigern |
| `websocket.connect.url` | URL | Verbindungen zu bestimmten URLs erlauben/verweigern |

Siehe [Sicherheitsmodell](system/security.md) zur Richtlinienkonfiguration.

## Fehler

| Bedingung | Art | Wiederholbar |
|-----------|------|-----------|
| Verbindungen deaktiviert | `errors.PERMISSION_DENIED` | nein |
| URL nicht erlaubt | `errors.PERMISSION_DENIED` | nein |
| Kein Kontext | `errors.INTERNAL` | nein |
| Verbindung fehlgeschlagen | `errors.INTERNAL` | ja |
| Ungültige Verbindungs-ID | `errors.INTERNAL` | nein |
| Abonnement fehlgeschlagen | `errors.INTERNAL` | ja |
| Fehlender Prozesskontext beim Abonnement | `errors.INTERNAL` | nein |
| Schließen fehlgeschlagen | `errors.INTERNAL` | nein |

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

Eine leere URL, ein nicht tabellarischer Optionswert, ungültige Argumenttypen sowie ein fehlender Ausführungskontext oder Prozess-PID beim Anfordern des Empfangs-Channels lösen Lua-Fehler aus. Sie werden nicht als strukturierte Fehler zurückgegeben. Runtime `v0.3.32a` stellt Transportfehler beim Senden oder Ping für Lua-Aufrufer nicht bereit.

Siehe [Fehlerbehandlung](lua/core/errors.md) für die Arbeit mit Fehlern.
Fügen Sie `websocket` zur Liste `modules:` des ausführbaren Eintrags hinzu, bevor Sie es per `require` laden. Das Global `channel` ist immer verfügbar; JSON- und Timeout-Rezepte erfordern außerdem `json` und `time`.

Nachrichtenobjekte im Empfangs-Channel verwenden nur `"text"` und `"binary"`. Der Transport verarbeitet Ping- und Pong-Frames; ein Terminalereignis schließt den Channel, statt ein Objekt vom Typ `"close"` zu erzeugen.
