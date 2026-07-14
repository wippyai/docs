---
title: "Relay"
---

# Relay

Das Modul `wippy/relay` bietet eine WebSocket-Relay-Infrastruktur mit zweistufiger Hub-Architektur. Ein zentraler Hub verwaltet benutzerspezifische Hubs, die wiederum WebSocket-Client-Verbindungen verwalten und Nachrichten an Plugins routen.

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

Der zentrale Hub läuft als Dienst. Wenn ein WebSocket-Client eine Verbindung herstellt, sucht oder erstellt der zentrale Hub einen User-Hub für diesen Benutzer. Der User-Hub verwaltet die Lebensdauer des Clients und routet Nachrichten basierend auf Befehls-Präfixen an Plugins.

## Setup

Modul zum Projekt hinzufügen:

```bash
wippy add wippy/relay
wippy install
```

Abhängigkeit mit erforderlichen Parametern deklarieren:

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

Plugins werden vom User-Hub erzeugt. Beim Start empfängt das Plugin:

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

Plugins erhalten 1 automatischen Neustart bei einem Absturz. Nach einem zweiten Absturz wird das Plugin als `"failed"` markiert und nicht neu gestartet.

### Plugin-Implementierung

Plugins empfangen Nachrichten in ihrer Prozess-Inbox. Jede Nachricht hat ein Topic (der entfernte Befehlspräfix) und ein Payload, das die ursprünglichen Nachrichtendaten zusammen mit `conn_pid` enthält, um Antworten an den Client zurückzusenden.

```lua
local json = require("json")

local function handle_message(topic, payload)
    if topic == "get_state" then
        process.send(payload.conn_pid, "ws.message", json.encode({
            type = "session_state",
            data = { status = "active" }
        }))
    end
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
                -- erster Client verbunden
            elseif topic == "shutdown" then
                -- letzter Client getrennt
            else
                handle_message(topic, payload)
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

Der Relay sendet strukturierte Fehlermeldungen an Clients:

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

User-Hubs werden bei Bedarf erstellt, sobald sich der erste Client für einen Benutzer verbindet. Der Hub wird mit dem Sicherheitsaktor und Scope des Benutzers erzeugt.

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
| `ws.control` | Central → User Hub | Routing-Steuerung |
| `hub.activity_update` | User Hub → Central | Aktualisierung der Client-Anzahl |

## Siehe auch

- [WebSocket-Relay](http/websocket-relay.md) - Konfiguration des HTTP-WebSocket-Endpunkts
- [Prozessmodell](concepts/process-model.md) - Prozesslebenszyklus und Messaging
- [Sicherheit](system/security.md) - Sicherheitsaktoren und Scopes
- [Framework-Übersicht](framework/overview.md) - Verwendung des Framework-Moduls
