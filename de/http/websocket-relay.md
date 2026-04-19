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

-- Nachricht an WebSocket-Client von jedem Prozess senden.
-- Das Relay verpackt sie als {topic, data} JSON; der Topic-Name ist beliebig.
process.send(websocket_pid, "update", "hallo")
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
| `ws.join` | Client verbindet | JSON `{client_pid, metadata}` |
| `ws.message` (oder Ihr `message_topic`) | Client sendet Nachricht | Rohes Client-Payload (Text-Frame -> string, Binär-Frame -> bytes); die Quell-PID des Relay-Pakets ist die Client-PID |
| `ws.heartbeat` | Periodisch (wenn konfiguriert) | JSON `{client_pid, uptime, message_count, metadata}` |
| `ws.leave` | Client trennt | JSON `{client_pid, metadata}` |

## Nachrichten empfangen

```lua
local json = require("json")

local function handler()
    local inbox = process.inbox()

    while true do
        local msg, ok = inbox:receive()
        if not ok then break end

        local topic = msg:topic()
        local from = msg:from()                -- Client-Verbindungs-PID

        if topic == "ws.join" then
            -- Client verbunden -- Payload ist {client_pid, metadata}
            local data = msg:payload():data()
            local client_pid = data.client_pid

        elseif topic == "ws.message" then
            -- Rohe Client-Nachricht; from() ist die Client-PID
            local body = msg:payload():data()  -- string oder bytes
            handle_message(from, json.decode(body))

        elseif topic == "ws.leave" then
            -- Client getrennt -- Payload ist {client_pid, metadata}
            cleanup(from)
        end
    end
end
```

## An Client senden

Nachrichten mit der Client-PID zurücksenden. Jeder Topic, den Sie wählen, wird als `{topic, data}` JSON verpackt und an den WebSocket weitergeleitet. Der Frame-Typ wird durch das Payload-Format bestimmt: Strings werden zu Text-Frames, Bytes zu Binär-Frames (base64-kodiert innerhalb des JSON-Wrappers).

```lua
-- Strukturierte Nachricht senden (beliebiger Topic-Name)
process.send(client_pid, "update", json.encode({event = "update", value = 42}))

-- Binär senden
process.send(client_pid, "data", binary_content)

-- Verbindung schließen (Payload ist der Schließgrund-String)
process.send(client_pid, "ws.close", "Sitzung beendet")
```

Die reservierten Topics von Server -> Client sind `ws.control` (Relay-Rekonfiguration) und `ws.close` (Verbindung schließen).

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
        process.send(pid, "broadcast", data)
    end
end
```

<tip>
Für komplexe Multi-Raum-Szenarien starten Sie einen separaten Handler-Prozess pro Raum oder verwenden Sie einen zentralen Manager-Prozess, der Raum-Mitgliedschaften verfolgt.
</tip>

## Siehe auch

- [Middleware](http/middleware.md) - Middleware-Konfiguration
- [Prozess](lua/core/process.md) - Prozess-Messaging
- [WebSocket-Client](lua/http/websocket.md) - Ausgehende WebSocket-Verbindungen
