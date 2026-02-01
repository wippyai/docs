# WebSocket-Relay

Die WebSocket-Relay-Middleware aktualisiert HTTP-Verbindungen zu WebSocket und leitet Nachrichten an einen Zielprozess weiter.

## Funktionsweise

1. HTTP-Handler setzt `X-WS-Relay`-Header mit Zielprozess-PID
2. Middleware aktualisiert Verbindung zu WebSocket
3. Relay bindet an den Zielprozess und überwacht ihn
4. Nachrichten fließen bidirektional zwischen Client und Prozess

<warning>
Die WebSocket-Verbindung ist an den Zielprozess gebunden. Wenn der Prozess beendet wird, schließt sich die Verbindung automatisch.
</warning>

## Prozess-Semantik

WebSocket-Verbindungen sind vollständige Prozesse mit eigener PID. Sie integrieren sich in das Prozesssystem:

- **Adressierbar** - Jeder Prozess kann Nachrichten an eine WebSocket-PID senden
- **Überwachbar** - Prozesse können WebSocket-Verbindungen auf Exit-Events überwachen
- **Verlinkbar** - WebSocket-Verbindungen können mit anderen Prozessen verlinkt werden
- **EXIT-Events** - Wenn Verbindung schließt, erhalten Monitore Exit-Benachrichtigungen

```lua
-- WebSocket-Verbindung von einem anderen Prozess überwachen
process.monitor(websocket_pid)

-- Nachricht an WebSocket-Client von jedem Prozess senden
process.send(websocket_pid, "ws.send", {type = "text", data = "hallo"})
```

<tip>
Das Relay überwacht den Zielprozess. Wenn das Ziel beendet wird, schließt sich die WebSocket-Verbindung automatisch und der Client erhält einen Close-Frame.
</tip>

## Verbindungstransfer

Verbindungen können an einen anderen Prozess übertragen werden indem eine Steuerungsnachricht gesendet wird:

```lua
process.send(websocket_pid, "ws.control", {
    target_pid = new_process_pid,
    message_topic = "ws.message"
})
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
Wenn keine Origins konfiguriert, sind nur Same-Origin-Anfragen erlaubt.
</note>

## Handler-Setup

Der HTTP-Handler startet einen Prozess und konfiguriert das Relay:

```lua
local http = require("http")
local json = require("json")

local function handler()
    local req = http.request()
    local res = http.response()

    -- Handler-Prozess starten
    local pid = process.spawn("app.ws:handler", "app:processes")

    -- Relay konfigurieren
    res:header("X-WS-Relay", json.encode({
        target_pid = tostring(pid),
        message_topic = "ws.message",
        heartbeat_interval = "30s",
        metadata = {
            user_id = req:query("user_id")
        }
    }))
end
```

### Relay-Konfigurationsfelder

| Feld | Typ | Standard | Beschreibung |
|------|-----|----------|--------------|
| `target_pid` | string | erforderlich | Prozess-PID zum Empfangen von Nachrichten |
| `message_topic` | string | `ws.message` | Topic für Client-Nachrichten |
| `heartbeat_interval` | duration | - | Heartbeat-Frequenz (z.B. `30s`) |
| `metadata` | object | - | An alle Nachrichten angehängt |

## Nachrichten-Topics

Das Relay sendet diese Nachrichten an den Zielprozess:

| Topic | Wann | Payload |
|-------|------|---------|
| `ws.join` | Client verbindet | `client_pid`, `metadata` |
| `ws.message` | Client sendet Nachricht | `client_pid`, `type`, `data`, `metadata` |
| `ws.heartbeat` | Periodisch (wenn konfiguriert) | `client_pid`, `uptime`, `message_count` |
| `ws.leave` | Client trennt | `client_pid`, `reason`, `metadata` |

## Nachrichten empfangen

```lua
local json = require("json")

local function handler()
    local inbox = process.inbox()

    while true do
        local msg, ok = inbox:receive()
        if not ok then break end

        local topic = msg:topic()
        local data = msg:payload():data()

        if topic == "ws.join" then
            -- Client verbunden
            local client_pid = data.client_pid

        elseif topic == "ws.message" then
            -- Client-Nachricht behandeln
            local content = json.decode(data.data)
            handle_message(data.client_pid, content)

        elseif topic == "ws.leave" then
            -- Client getrennt
            cleanup(data.client_pid)
        end
    end
end
```

## An Client senden

Nachrichten mit der Client-PID zurücksenden:

```lua
-- Textnachricht senden
process.send(client_pid, "ws.send", {
    type = "text",
    data = json.encode({event = "update", value = 42})
})

-- Binär senden
process.send(client_pid, "ws.send", {
    type = "binary",
    data = binary_content
})

-- Verbindung schließen
process.send(client_pid, "ws.close", {
    code = 1000,
    reason = "Sitzung beendet"
})
```

## Broadcasting

Client-PIDs verfolgen um an mehrere Clients zu broadcasten:

```lua
local clients = {}

-- Bei Join
clients[client_pid] = true

-- Bei Leave
clients[client_pid] = nil

-- Broadcast
local function broadcast(message)
    local data = json.encode(message)
    for pid, _ in pairs(clients) do
        process.send(pid, "ws.send", {type = "text", data = data})
    end
end
```

<tip>
Für komplexe Multi-Raum-Szenarien starten Sie einen separaten Handler-Prozess pro Raum oder verwenden Sie einen zentralen Manager-Prozess, der Raum-Mitgliedschaften verfolgt.
</tip>

## Siehe auch

- [Middleware](http-middleware.md) - Middleware-Konfiguration
- [Prozess](lua-process.md) - Prozess-Messaging
- [WebSocket-Client](lua-websocket.md) - Ausgehende WebSocket-Verbindungen
