---
title: "WebSocket-Relay"
description: "Die WebSocket-Relay-Middleware stuft HTTP-Verbindungen auf WebSocket hoch und leitet Nachrichten an einen Zielprozess weiter."
---

# WebSocket-Relay

Die Middleware `websocket_relay` stuft eine HTTP-Verbindung auf WebSocket hoch und leitet WebSocket-Nachrichten an einen Zielprozess weiter.

**Klassifikation: Protokollreferenz mit Teilrezepten zur Integration.** Die Blöcke setzen einen HTTP-Server, Router, Prozess-Host, Zielprozess und Sicherheitskontext voraus. Nachrichten-Handler der Anwendung und die Bereinigung des Client-Zustands bleiben Aufgabe der Anwendung.

## Funktionsweise

1. HTTP-Handler setzt `X-WS-Relay`-Header mit Zielprozess-PID
2. Middleware stuft die Verbindung auf WebSocket hoch
3. Relay bindet an den Zielprozess und überwacht ihn
4. Nachrichten fließen bidirektional zwischen Client und Prozess

## Prozess-Semantik

WebSocket-Verbindungen sind vollständige Prozesse mit eigener PID. Sie integrieren sich in das Prozesssystem:

- **Adressierbar** - Jeder Prozess kann Nachrichten an eine WebSocket-PID senden
- **Überwachbar** - Prozesse können WebSocket-Verbindungen auf Exit-Events überwachen
- **Verlinkbar** - WebSocket-Verbindungen können mit anderen Prozessen verlinkt werden
- **EXIT-Events** - Wenn Verbindung schließt, erhalten Monitore Exit-Benachrichtigungen

```lua
-- Monitor a WebSocket connection from another process
local _, monitor_err = process.monitor(websocket_pid)
if monitor_err then return nil, monitor_err end

-- Send a message to the WebSocket client from any process.
-- The relay wraps it as {topic, data} JSON; the topic name is arbitrary.
local _, send_err = process.send(websocket_pid, "update", "hello")
if send_err then return nil, send_err end
```

<tip>
Das Relay überwacht den Zielprozess. Wenn das Ziel beendet wird, schließt sich die WebSocket-Verbindung automatisch und der Client erhält einen Close-Frame.
</tip>

## Verbindungstransfer

Verbindungen können durch Senden einer Steuernachricht an einen anderen Prozess übertragen werden:

```lua
local _, transfer_err = process.send(websocket_pid, "ws.control", {
    target_pid = new_process_pid,
    message_topic = "ws.message"
})
if transfer_err then return nil, transfer_err end
```

## Konfiguration

Als Post-Match-Middleware auf einem Router hinzufügen:

```yaml
- name: ws_router
  kind: http.router
  meta:
    server: gateway
  prefix: /ws
  post_middleware:
    - websocket_relay
  post_options:
    wsrelay.allowed.origins: "https://app.example.com"
```

| Option | Beschreibung |
|--------|--------------|
| `wsrelay.allowed.origins` | Kommaseparierte erlaubte Origins |

<note>
Wenn keine Origins konfiguriert sind, sind nur Same-Origin-Anfragen erlaubt.
</note>

## Handler-Setup

Der HTTP-Handler startet einen Prozess und konfiguriert das Relay:

```lua
local http = require("http")
local json = require("json")

local function handler()
    local req, req_err = http.request()
    if req_err then return nil, req_err end
    local res, res_err = http.response()
    if res_err then return nil, res_err end

    local user_id, query_err = req:query("user_id")
    if query_err then return nil, query_err end

    -- Spawn handler process
    local pid, spawn_err = process.spawn("app.ws:handler", "app:processes")
    if spawn_err then return nil, spawn_err end

    -- Configure relay
    local relay_config, encode_err = json.encode({
        target_pid = tostring(pid),
        message_topic = "ws.message",
        heartbeat_interval = "30s",
        metadata = {
            user_id = user_id
        }
    })
    if encode_err then
        local _, terminate_err = process.terminate(pid)
        return nil, terminate_err or encode_err
    end

    local header_err = res:set_header("X-WS-Relay", relay_config)
    if header_err then
        local _, terminate_err = process.terminate(pid)
        return nil, terminate_err or header_err
    end
end
```

### Relay-Konfigurationsfelder

| Feld | Typ | Standard | Beschreibung |
|------|-----|----------|--------------|
| `target_pid` | string | erforderlich | Prozess-PID zum Empfangen von Nachrichten |
| `message_topic` | string | `ws.message` | Topic für Client-Nachrichten |
| `heartbeat_interval` | duration | `30s` | Heartbeat-Frequenz, beispielsweise `30s` |
| `metadata` | object | - | An Join-, Leave- und Heartbeat-Benachrichtigungen angefügt |

## Nachrichten-Topics

Das Relay sendet diese Nachrichten an den Zielprozess:

| Topic | Wann | Payload |
|-------|------|---------|
| `ws.join` | Client verbindet | JSON `{client_pid, metadata}` |
| `ws.message` (oder Ihr `message_topic`) | Client sendet Nachricht | Roher Client-Payload (Text-Frame → Format String, Binär-Frame → Format Bytes); `payload:data()` gibt für beide Formate eine Lua-Zeichenkette zurück, und die Quell-PID ist die Client-PID |
| `ws.heartbeat` | Periodisch (standardmäßig alle 30 Sekunden; über `heartbeat_interval` änderbar) | JSON `{client_pid, uptime, message_count, metadata}` |
| `ws.leave` | Client trennt | JSON `{client_pid, metadata}` |

## Nachrichten empfangen

```lua
local function handler()
    local inbox = process.inbox()

    while true do
        local msg, ok = inbox:receive()
        if not ok then break end

        local topic = msg:topic()
        local from = msg:from()                -- client connection PID

        if topic == "ws.join" then
            -- Client connected — payload is {client_pid, metadata}
            local data, payload_err = msg:payload():data()
            if payload_err then return nil, payload_err end
            local client_pid = data.client_pid

        elseif topic == "ws.message" then
            -- Raw client message; from() is the client PID
            local incoming = msg:payload()
            local frame_format = incoming:get_format()     -- "text/plain" or "application/octet-stream"
            local body, payload_err = incoming:data()      -- Lua string in either case
            if payload_err then return nil, payload_err end
            -- Decode or dispatch `body` according to `frame_format` and the
            -- application's protocol.

        elseif topic == "ws.leave" then
            -- Client disconnected — payload is {client_pid, metadata}
            -- Release application state associated with `from`.
        end
    end
end
```

## An Client senden

Senden Sie Nachrichten anhand der Client-PID zurück. Jeder gewählte Topic wird als JSON `{topic, data}` verpackt und an den WebSocket weitergeleitet. Jede Server-zu-Client-Nachricht wird als einzelner WebSocket-Text-Frame mit diesem Wrapper gesendet. Tabellen bleiben JSON-Objekte in `data`, Zeichenketten bleiben Zeichenketten. Payloads, die den Relay im Bytes-Format erreichen, werden in `data` Base64-kodiert; sie werden nicht als separate Binär-Frames gesendet. Lua-`process.send` exportiert seine Argumente als Lua-formatierte Payloads, sodass eine Lua-Zeichenkette den Bytes-Zweig nicht verwendet.

```lua
-- Send a structured message (any topic name)
local _, send_err = process.send(client_pid, "update", {event = "update", value = 42})
if send_err then return nil, send_err end

-- Close connection (payload is the close reason string)
local _, close_err = process.send(client_pid, "ws.close", "Session ended")
if close_err then return nil, close_err end
```

Die reservierten Topics vom Server zum Client sind `ws.control` für die Relay-Neukonfiguration und `ws.close` zum Schließen der Verbindung.

## Broadcasting

Verfolgen Sie Client-PIDs, um Nachrichten an mehrere Clients zu senden:

```lua
local clients = {}

-- On join
clients[client_pid] = true

-- On leave
clients[client_pid] = nil

-- Broadcast
local function broadcast(message)
    for pid, _ in pairs(clients) do
        local _, send_err = process.send(pid, "broadcast", message)
        if send_err then return nil, send_err end
    end
    return true
end
```

<tip>
Für komplexe Multi-Raum-Szenarien starten Sie einen separaten Handler-Prozess pro Raum oder verwenden Sie einen zentralen Manager-Prozess, der Raum-Mitgliedschaften verfolgt.
</tip>

## Siehe auch

- [Middleware](http/middleware.md) – Middleware-Konfiguration
- [Prozess](lua/core/process.md) – Prozessnachrichten
- [WebSocket-Client](lua/http/websocket.md) – Ausgehende WebSocket-Verbindungen
