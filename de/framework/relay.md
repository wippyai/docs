---
title: "Relay"
description: "Wippy-Relay-Hubs, WebSocket-Clients, präfixbasierte Plugins, Benutzerisolierung und Verbindungslebenszyklen konfigurieren."
---

# Relay

Das Modul `wippy/relay` leitet WebSocket-Verbindungen über einen zentralen Hub und
benutzerspezifische Hubs. Die Benutzer-Hubs verwalten Clientverbindungen und verteilen
Nachrichten an Plugins anhand von Präfixen.

Diese Seite ist ein Teilrezept zur Integration und eine Protokollreferenz, keine
eigenständige WebSocket-Anwendung. Die Konfigurations- und Pluginblöcke setzen ein
bestehendes Wippy-Projekt, einen echten Sicherheits-Scope am konfigurierten
`user_security_scope` und einen mit dem Relay verbundenen HTTP-WebSocket-Endpunkt
gemäß [WebSocket-Relay](http/websocket-relay.md) voraus. Protokoll-Payloads und
Lifecycle-Blöcke sind Referenzformen.

## Architektur

```
Central Hub
├── User Hub (alice)
│   ├── Plugin: session_
│   ├── Plugin: ai_
│   ├── WebSocket Client 1
│   └── WebSocket Client 2
├── User Hub (bob)
│   ├── Plugin: session_
│   └── WebSocket Client 1
└── ...
```

Der zentrale Hub läuft als Service. Wenn sich ein WebSocket-Client verbindet, sucht
oder erstellt er einen Hub für den Benutzer. Dieser Benutzer-Hub verwaltet den
Verbindungslebenszyklus und leitet Nachrichten anhand des Befehlspräfixes weiter.

## Einrichtung

Fügen Sie das Modul zum Projekt hinzu:

```bash
wippy add wippy/relay
wippy install
```

Deklarieren Sie die Abhängigkeit mit den erforderlichen Parametern:

```yaml
version: "1.0"
namespace: app

entries:
  - name: os_env
    kind: env.storage.os

  - name: processes
    kind: process.host
    lifecycle:
      auto_start: true

  - name: dep.relay
    kind: ns.dependency
    component: wippy/relay
    version: "*"
    parameters:
      - name: application_host
        value: app:processes
      - name: env_storage
        value: app:os_env
      - name: user_security_scope
        value: app.security:user_scope
```

### Konfigurationsparameter

| Parameter | Erforderlich | Standard | Beschreibung |
|-----------|----------|---------|-------------|
| `application_host` | ja | — | Process Host für Relay-Prozesse |
| `env_storage` | nein | intern | Speicher für Umgebungsvariablen |
| `user_security_scope` | ja | — | Sicherheits-Scope für User-Hubs |
| `max_connections_per_user` | nein | `5` | WebSocket-Verbindungen pro Benutzer |
| `queue_multiplier` | nein | `100` | Nachrichten-Queue = Verbindungen × Multiplikator |
| `user_hub_inactivity_timeout` | nein | `7200s` | Idle-Zeit vor Hub-Bereinigung |

## Client-Verbindungsablauf

1. WebSocket-Client verbindet sich mit `user_id` in den Metadaten
2. Zentraler Hub validiert die Verbindung und prüft die Limits pro Benutzer
3. Zentraler Hub erstellt oder wiederverwendet einen User-Hub für den Benutzer
4. User-Hub sendet eine `welcome`-Nachricht an den Client:

```json
{
    "user_id": "alice",
    "client_count": 1,
    "plugins": [
        { "prefix": "session_", "process_id": "...", "status": "running" },
        { "prefix": "ai_", "process_id": "...", "status": "pending" }
    ]
}
```

Plugin-`status` ist einer von `"not_started"` (registriert, nie gestartet), `"pending"` (Start in Arbeit), `"running"`, `"failed"` oder `"stopped"`.

## Nachrichten-Routing

Clients senden JSON-Nachrichten mit einem `type`-Feld. Der User-Hub vergleicht den Typ-Präfix mit registrierten Plugins und routet die Nachricht:

```json
{ "type": "session_get_state", "data": { "key": "value" } }
```

Der Präfix `session_` passt zum Session-Plugin. Der Hub entfernt den Präfix und sendet die Nachricht mit dem reduzierten Typ als Topic an den Plugin-Prozess:

```lua
-- process topic: "get_state"
-- payload:
{
    conn_pid = client_pid,
    type = "session_get_state",  -- original full type preserved
    data = { key = "value" },
    request_id = "...",
    session_id = "..."
}
```

Plugins antworten, indem sie Nachrichten zurück an `conn_pid` senden.

## Plugins

Plugins sind `process.lua`-Einträge mit `meta.type: relay.plugin`:

```yaml
entries:
  - name: session_plugin
    kind: process.lua
    meta:
      type: relay.plugin
      command_prefix: session_
      auto_start: true
    source: file://session_plugin.lua
    modules: [json, time, logger]
    method: run
```

### Plugin-Metadaten

| Feld | Typ | Beschreibung |
|-------|------|-------------|
| `meta.type` | string | Muss `relay.plugin` sein |
| `meta.command_prefix` | string | Nachrichten-Typ-Präfix, den dieses Plugin verarbeitet |
| `meta.auto_start` | boolean | Starten, wenn der User-Hub initialisiert wird |
| `meta.default_host` | string | Process Host überschreiben |

### Plugin-Lebenszyklus

Der Benutzer-Hub startet jedes Plugin mit den folgenden Argumenten:

```lua
function run(args)
    local user_id = args.user_id
    local user_metadata = args.user_metadata
    local user_hub_pid = args.user_hub_pid
    local config = args.config
end
```

Das `session_`-Plugin empfängt Lebenszyklus-Nachrichten:

| Nachricht | Wann |
|---------|------|
| `"resume"` | Erster Client verbindet sich mit dem User-Hub |
| `"shutdown"` | Letzter Client trennt sich vom User-Hub |

Plugins erhalten nach einem Absturz einen automatischen Neustart. Nach dem zweiten
Absturz wird das Plugin als `"failed"` markiert und nicht erneut gestartet.

### Plugin-Implementierung

Plugins empfangen Nachrichten über ihre Prozess-Inbox. Jede Nachricht besitzt ein aus
dem Befehlstyp abgeleitetes Topic und einen Payload mit den ursprünglichen Daten sowie
`conn_pid` für Antworten.

```lua
local json = require("json")

local function handle_message(topic, payload)
    if topic == "get_state" then
        if not payload.conn_pid then
            return nil, "Relay message is missing conn_pid"
        end

        local encoded, encode_err = json.encode({
            type = "session_state",
            data = { status = "active" }
        })
        if encode_err then
            return nil, encode_err
        end

        local sent, send_err = process.send(payload.conn_pid, "ws.message", encoded)
        if not sent then
            return nil, send_err or "Relay response was not sent"
        end
    end

    return true
end

local function run(args)
    local user_id = args.user_id
    local inbox = process.inbox()
    local events = process.events()

    while true do
        local result = channel.select({
            inbox:case_receive(),
            events:case_receive()
        })
        if not result.ok then break end

        if result.channel == inbox then
            local msg = result.value
            local topic = msg:topic()
            local payload = msg:payload():data()

            if topic == "resume" then
                -- first client connected
            elseif topic == "shutdown" then
                -- last client disconnected
            else
                local ok, err = handle_message(topic, payload)
                if not ok then
                    error("Failed to handle relay message: " .. tostring(err))
                end
            end
        elseif result.channel == events then
            local event = result.value
            if event.kind == process.event.CANCEL then
                break
            end
        end
    end
end

return { run = run }
```

## Fehlerbehandlung

Das Relay meldet Clientfehler mit den folgenden Codes:

| Fehlercode | Beschreibung |
|------------|-------------|
| `max_connections_reached` | Benutzer am Verbindungslimit |
| `missing_user_id` | Keine user_id in den Verbindungsmetadaten |
| `hub_creation_failed` | Erzeugung des User-Hubs fehlgeschlagen |
| `invalid_json` | Fehler beim Dekodieren der Nachricht |
| `unknown_command` | Nachricht ohne Type-Feld |
| `plugin_not_found` | Kein Plugin passt zum Befehlspräfix |
| `plugin_failed` | Plugin nicht verfügbar oder abgestürzt |

## Hub-Lebenszyklus

### User-Hub-Erstellung

Die erste Clientverbindung eines Benutzers erstellt dessen Hub. Er läuft mit dem
Sicherheitsakteur und Scope des Benutzers.

### Garbage Collection

Der zentrale Hub prüft regelmäßig auf inaktive User-Hubs. Ein Hub ohne verbundene Clients für länger als `user_hub_inactivity_timeout` (Standard: 2 Stunden) wird mit einem 10-Sekunden-Cancel-Timeout sauber beendet.

Das GC-Prüfintervall wird automatisch abgeleitet: `inactivity_timeout / 2.5`.

### Sicherheit

Der zentrale Hub läuft unter seiner eigenen Sicherheitsgruppe (`wippy.relay.security:root`) mit vollem Zugriff. Jeder User-Hub wird mit dem konfigurierten `user_security_scope` erzeugt, wodurch Operationen auf Benutzerebene isoliert werden.

## Interne Topics

| Topic | Richtung | Beschreibung |
|-------|-----------|-------------|
| `ws.join` | Client → Central/User Hub | Verbindungsanfrage |
| `ws.leave` | Client → Central/User Hub | Verbindungstrennung |
| `ws.message` | Client → User Hub | WebSocket-Nachricht |
| `ws.cancel` | Central → User Hub | Sauberes Herunterfahren |
| `ws.control` | Central → Client | Leitet die Ziel-PID der Clientverbindung auf den Benutzer-Hub um |
| `hub.activity_update` | User Hub → Central | Aktualisierung der Client-Anzahl |

## Siehe auch

- [WebSocket-Relay](../http/websocket-relay.md) — Konfiguration des HTTP-WebSocket-Endpunkts
- [Prozessmodell](concepts/process-model.md) — Prozesslebenszyklus und Messaging
- [Sicherheit](system/security.md) — Sicherheitsakteure und Scopes
- [Framework-Übersicht](framework/overview.md) — Framework-Module installieren und importieren
