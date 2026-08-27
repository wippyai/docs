---
title: "Server-Sent Events"
description: "Kurzlebige Handler-Ereignisse oder langlebige prozessgestützte Ereignisse über Server-Sent Events streamen."
---

# Server-Sent Events

Die SSE-Middleware streamt Ereignisse vom Server an HTTP-Clients über das [Server-Sent-Events](https://html.spec.whatwg.org/multipage/server-sent-events.html)-Protokoll.

Zwei Mechanismen stehen zur Verfügung: **direktes Streaming** aus einem HTTP-Handler und **prozessgestützter Relay** über die `sse_relay`-Middleware.

**Klassifikation: Protokollreferenz mit Teilrezepten zur Integration.** Die Relay-Blöcke setzen voraus, dass HTTP-Server, Router, Prozess-Host, Zielprozess und Sicherheitskontext bereits vorhanden sind. Anwendungs-Callbacks und Client-Verhalten liegen außerhalb dieser Ausschnitte.

## Direktes Streaming

Verwenden Sie `res:write_event()`, um SSE-Ereignisse direkt aus einem HTTP-Handler zu senden. Die Response wechselt beim ersten Aufruf automatisch in den SSE-Modus und setzt die passenden Header.

```lua
local http = require("http")

local function handler()
    local res, res_err = http.response()
    if res_err then return nil, res_err end

    local err = res:write_event({name = "status", data = {state = "started"}})
    if err then return nil, err end
    err = res:write_event({name = "progress", data = {percent = 50}})
    if err then return nil, err end
    err = res:write_event({name = "status", data = {state = "complete"}})
    if err then return nil, err end
    return true
end
```

Jedes Ereignis benötigt ein `name`- und ein `data`-Feld. Der `data`-Wert wird automatisch als JSON kodiert.

<tip>
Direktes Streaming eignet sich für kurzlebige Request-Response-Abläufe wie Fortschrittsaktualisierungen. Verwenden Sie für langlebige Verbindungen, die von Hintergrundprozessen verwaltet werden, den SSE-Relay.
</tip>

## SSE-Relay

Die SSE-Relay-Middleware erstellt langlebige, von Prozessen gestützte SSE-Streams. Sie folgt demselben Relay-Muster wie der [WebSocket-Relay](./websocket-relay.md).

### Funktionsweise

1. Der HTTP-Handler setzt den `X-SSE-Relay`-Header mit einer JSON-Relay-Konfiguration
2. Die Middleware fängt die Antwort ab und erstellt eine SSE-Sitzung
3. Die Sitzung registriert sich als Prozess mit eigener PID
4. An die Sitzungs-PID gesendete Nachrichten werden als SSE-Ereignisse an den Client weitergeleitet

## Prozesssemantik

SSE-Streams sind vollwertige Prozesse mit eigener PID. Sie integrieren sich in das Prozesssystem:

- **Adressierbar** — Jeder Prozess kann Nachrichten an eine Stream-PID senden
- **Überwachbar** — Prozesse können SSE-Streams auf Exit-Ereignisse überwachen
- **Verlinkbar** — SSE-Streams können mit anderen Prozessen verlinkt werden
- **EXIT-Ereignisse** — Wenn ein Stream geschlossen wird, erhalten Monitore Exit-Benachrichtigungen

```lua
-- Send event to SSE client from any process
local _, send_err = process.send(stream_pid, "sse.message", {event = "update", value = 42})
if send_err then return nil, send_err end

-- Monitor an SSE stream
local _, monitor_err = process.monitor(stream_pid)
if monitor_err then return nil, monitor_err end
```

<tip>
Der Relay überwacht den Zielprozess. Wenn das Ziel beendet wird, schließt sich der SSE-Stream automatisch und der Client erhält ein <code>done</code>-Ereignis.
</tip>

## Konfiguration

Als Post-Match-Middleware auf einem Router hinzufügen:

```yaml
- name: sse_router
  kind: http.router
  meta:
    server: gateway
  prefix: /sse
  post_middleware:
    - sse_relay
  post_options:
    sserelay.allowed.origins: "https://app.example.com"
```

| Option | Beschreibung |
|--------|-------------|
| `sserelay.allowed.origins` | Kommagetrennte erlaubte Origins (unterstützt Wildcards) |

<note>
Wenn keine Origins konfiguriert sind, sind nur Same-Origin-Anfragen erlaubt.
</note>

## Handler-Setup

Der HTTP-Handler erzeugt einen Prozess und konfiguriert den Relay:

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
    local pid, spawn_err = process.spawn("app.sse:handler", "app:processes")
    if spawn_err then return nil, spawn_err end

    -- Configure relay
    local relay_config, encode_err = json.encode({
        target_pid = tostring(pid),
        message_topic = "sse.message",
        heartbeat_interval = "30s",
        metadata = {
            user_id = user_id
        }
    })
    if encode_err then
        local _, terminate_err = process.terminate(pid)
        return nil, terminate_err or encode_err
    end

    local header_err = res:set_header("X-SSE-Relay", relay_config)
    if header_err then
        local _, terminate_err = process.terminate(pid)
        return nil, terminate_err or header_err
    end
end
```

### Felder der Relay-Konfiguration

| Feld | Typ | Standard | Beschreibung |
|-------|------|---------|-------------|
| `target_pid` | string | — | Prozess-PID, die Nachrichten empfangen soll (für Detached-Modus weglassen) |
| `message_topic` | string | `sse.message` | Topic-Filter für weitergeleitete Ereignisse |
| `heartbeat_interval` | duration | `30s` | Heartbeat-Frequenz (z. B. `30s`, `1m`) |
| `idle_timeout` | duration | — | Stream nach Inaktivität schließen |
| `hard_timeout` | duration | — | Stream nach absoluter Dauer schließen |
| `metadata` | object | — | An Join/Leave/Heartbeat-Nachrichten angehängt |

## Managed- vs. Detached-Modus

### Managed-Modus

Wenn `target_pid` gesetzt ist, läuft der Relay im Managed-Modus:

- Überwacht den Zielprozess
- Sendet `sse.join` beim Verbinden und `sse.leave` beim Trennen
- Schließt den Stream automatisch, wenn das Ziel beendet wird

### Detached-Modus

Wenn `target_pid` weggelassen wird, startet der Relay im Detached-Modus:

- Sendet ein `ready`-Ereignis an den Client mit `stream_pid` und `message_topic`
- Es wird zunächst kein Prozess überwacht
- Ein Prozess kann sich später durch Senden einer `sse.control`-Nachricht anhängen

Richten Sie den Detached-Modus in einem Handler ein, der `json` importiert und das Response-Objekt als `res` abgerufen hat, und prüfen Sie beide Operationen:

```lua
-- Detached setup: no target_pid
local relay_config, encode_err = json.encode({
    heartbeat_interval = "30s"
})
if encode_err then return nil, encode_err end

local header_err = res:set_header("X-SSE-Relay", relay_config)
if header_err then return nil, header_err end
```

Der Client erhält ein `ready`-Ereignis:

```json
{"stream_pid": "{n1@app:processes|sse-1}", "message_topic": "sse.message"}
```

## Nachrichten-Topics

Der Relay verwendet diese Topics für die Kommunikation zwischen Stream und Zielprozess:

| Topic | Richtung | Wann | Payload |
|-------|-----------|------|---------|
| `sse.join` | Stream → Ziel | Client verbindet sich | `client_pid`, `metadata` |
| `sse.message` | Ziel → Stream | Standard-Ereignis-Topic | Wird als SSE-Ereignis weitergeleitet |
| `sse.heartbeat` | Stream → Ziel | Periodisch (falls konfiguriert) | `client_pid`, `uptime`, `message_count`, `metadata` |
| `sse.leave` | Stream → Ziel | Client trennt Verbindung | `client_pid`, `metadata` |
| `sse.control` | beliebig → Stream | Steuerbefehl | Felder der Relay-Konfiguration |
| `sse.close` | beliebig → Stream | Erzwungenes Schließen | Optionaler Grund-String |

## Empfang im Zielprozess

```lua
local function handler()
    local inbox = process.inbox()

    while true do
        local msg, ok = inbox:receive()
        if not ok then break end

        local topic = msg:topic()
        local data, payload_err = msg:payload():data()
        if payload_err then return nil, payload_err end

        if topic == "sse.join" then
            local client_pid = data.client_pid

        elseif topic == "sse.heartbeat" then
            -- Periodic health check

        elseif topic == "sse.leave" then
            -- Release application state associated with data.client_pid.
        end
    end
end
```

## Ereignisse senden

Senden Sie Ereignisse an den Client, indem Sie Nachrichten an die Stream-PID schicken:

```lua
-- Send on the default message topic
local _, send_err = process.send(stream_pid, "sse.message", {
    event = "update",
    value = 42
})
if send_err then return nil, send_err end

-- Force close the stream
local _, close_err = process.send(stream_pid, "sse.close", "session expired")
if close_err then return nil, close_err end
```

Ereignisse, die auf dem konfigurierten `message_topic` gesendet werden, werden als SSE-Ereignisse an den Client weitergeleitet. Der Topic-Name wird zum SSE-Ereignisnamen.

## Verbindungsübergabe

Senden Sie eine Steuernachricht, um Zielprozess, Topic-Filter oder Timeouts dynamisch zu ändern:

```lua
local _, transfer_err = process.send(stream_pid, "sse.control", {
    target_pid = tostring(new_pid),
    message_topic = "custom.topic",
    idle_timeout = "5m"
})
if transfer_err then return nil, transfer_err end
```

Wenn sich das Ziel ändert, überwacht der Relay zunächst das neue Ziel und sendet ihm `sse.join`. Anschließend beendet er die Überwachung des alten Ziels und sendet ihm `sse.leave`. Setzen Sie `target_pid` auf eine leere Zeichenkette, um die Verbindung ohne erneutes Anhängen zu lösen.

## Siehe auch

- [Middleware](./middleware.md) — Middleware-Konfiguration
- [WebSocket-Relay](./websocket-relay.md) — WebSocket-Äquivalent
- [Prozess](../lua/core/process.md) — Prozessnachrichten
