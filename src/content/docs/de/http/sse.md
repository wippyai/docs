---
title: "Server-Sent Events"
description: "Die SSE-Middleware streamt Ereignisse vom Server an HTTP-Clients über das Server-Sent-Events-Protokoll."
---

# Server-Sent Events

Die SSE-Middleware streamt Ereignisse vom Server an HTTP-Clients über das [Server-Sent-Events](https://html.spec.whatwg.org/multipage/server-sent-events.html)-Protokoll.

Zwei Mechanismen stehen zur Verfügung: **direktes Streaming** aus einem HTTP-Handler und **prozessgestützter Relay** über die `sse_relay`-Middleware.

## Direktes Streaming

Verwende `res:write_event()`, um SSE-Ereignisse direkt aus einem HTTP-Handler zu senden. Die Antwort wechselt beim ersten Aufruf automatisch in den SSE-Modus und setzt die passenden Header.

```lua
local http = require("http")

local function handler()
    local res = http.response()

    res:write_event({name = "status", data = {state = "started"}})
    res:write_event({name = "progress", data = {percent = 50}})
    res:write_event({name = "status", data = {state = "complete"}})
end
```

Jedes Ereignis benötigt ein `name`- und ein `data`-Feld. Der `data`-Wert wird automatisch als JSON kodiert.

<tip>
Direktes Streaming eignet sich für kurzlebige Request-Response-Abläufe wie Fortschrittsaktualisierungen. Für langlebige Verbindungen, die von Hintergrundprozessen verwaltet werden, verwende den SSE-Relay.
</tip>

## SSE-Relay

Die SSE-Relay-Middleware erstellt langlebige SSE-Streams, die durch Prozesse gestützt werden. Sie folgt demselben Relay-Muster wie [WebSocket-Relay](http/websocket-relay.md).

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
-- Ereignis aus jedem Prozess an SSE-Client senden
process.send(stream_pid, "sse.message", {event = "update", value = 42})

-- Einen SSE-Stream überwachen
process.monitor(stream_pid)
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
    local res = http.response()

    -- Handler-Prozess erzeugen
    local pid = process.spawn("app.sse:handler", "app:processes")

    -- Relay konfigurieren
    res:set_header("X-SSE-Relay", json.encode({
        target_pid = tostring(pid),
        message_topic = "sse.message",
        heartbeat_interval = "30s",
        metadata = {
            user_id = http.request():query("user_id")
        }
    }))
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

```lua
-- Detached-Setup: kein target_pid
res:set_header("X-SSE-Relay", json.encode({
    heartbeat_interval = "30s"
}))
```

Der Client erhält ein `ready`-Ereignis:

```json
{"stream_pid": "sse@node/abc123", "message_topic": "sse.message"}
```

## Nachrichten-Topics

Der Relay verwendet diese Topics für die Kommunikation zwischen Stream und Zielprozess:

| Topic | Richtung | Wann | Payload |
|-------|-----------|------|---------|
| `sse.join` | Stream → Ziel | Client verbindet sich | `client_pid`, `metadata` |
| `sse.message` | Ziel → Stream | Standard-Ereignis-Topic | Wird als SSE-Ereignis weitergeleitet |
| `sse.heartbeat` | Stream → Ziel | Periodisch (falls konfiguriert) | `client_pid`, `uptime`, `message_count` |
| `sse.leave` | Stream → Ziel | Client trennt Verbindung | `client_pid`, `metadata` |
| `sse.control` | beliebig → Stream | Steuerbefehl | Felder der Relay-Konfiguration |
| `sse.close` | beliebig → Stream | Erzwungenes Schließen | Optionaler Grund-String |

## Empfang im Zielprozess

```lua
local json = require("json")

local function handler()
    local inbox = process.inbox()

    while true do
        local msg, ok = inbox:receive()
        if not ok then break end

        local topic = msg:topic()
        local data = msg:payload():data()

        if topic == "sse.join" then
            local client_pid = data.client_pid

        elseif topic == "sse.heartbeat" then
            -- Periodische Statusprüfung

        elseif topic == "sse.leave" then
            cleanup(data.client_pid)
        end
    end
end
```

## Ereignisse senden

Sende Ereignisse an den Client, indem du Nachrichten an die Stream-PID schickst:

```lua
-- Auf dem Standard-Nachrichten-Topic senden
process.send(stream_pid, "sse.message", {
    event = "update",
    value = 42
})

-- Stream erzwungen schließen
process.send(stream_pid, "sse.close", "session expired")
```

Ereignisse, die auf dem konfigurierten `message_topic` gesendet werden, werden als SSE-Ereignisse an den Client weitergeleitet. Der Topic-Name wird zum SSE-Ereignisnamen.

## Verbindungsübergabe

Sende eine Steuernachricht, um den Zielprozess, den Topic-Filter oder die Timeouts dynamisch zu ändern:

```lua
process.send(stream_pid, "sse.control", {
    target_pid = tostring(new_pid),
    message_topic = "custom.topic",
    idle_timeout = "5m"
})
```

Wenn sich das Ziel ändert, sendet der Relay `sse.leave` an das alte Ziel und `sse.join` an das neue. Setze `target_pid` auf einen leeren String, um abzukoppeln, ohne erneut anzukoppeln.

## Siehe auch

- [Middleware](http/middleware.md) — Middleware-Konfiguration
- [WebSocket-Relay](http/websocket-relay.md) — WebSocket-Äquivalent
- [Process](lua/core/process.md) — Prozess-Messaging
