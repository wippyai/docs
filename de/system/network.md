---
title: "Netzwerk-Overlays"
description: "Leiten Sie ausgehende Verbindungen und Listener über SOCKS5-, Tor-, Tailscale- oder I2P-Overlays."
---

# Netzwerk-Overlays

Netzwerk-Overlay-Einträge leiten ausgehende Verbindungen oder Listener über SOCKS5, Tor, Tailscale oder I2P. Ein ausgewähltes Overlay wird über Funktions-, Prozess- und HTTP-Grenzen hinweg weitergegeben.

Diese Seite ist eine Konfigurationsreferenz. Die YAML-Blöcke sind Entry- oder Anwendungskonfigurationsfragmente und setzen voraus, dass der externe Proxy, das Tailnet oder der I2P-SAM-Dienst bereits existiert.

## Entry-Kinds

| Art | Beschreibung |
|------|-------------|
| `network.socks5` | Generischer SOCKS5-Proxy (deckt auch den SOCKS5-Listener von Tor ab) |
| `network.tailscale` | Tailscale-tsnet-Overlay-Knoten |
| `network.i2p` | I2P-SAM-v3-Bridge |

## SOCKS5

```yaml
- name: proxy
  kind: network.socks5
  host: 127.0.0.1
  port: 1080
  username: "optional"
  password: "optional"
  isolate_streams: false
```

| Feld | Typ | Beschreibung |
|-------|------|-------------|
| `host` | string | Proxy-Host |
| `port` | int | Proxy-Port (1-65535) |
| `username` | string | Optionale SOCKS5-Authentifizierung |
| `password` | string | Optionale SOCKS5-Authentifizierung |
| `isolate_streams` | bool | Pro-Verbindung zufällige Credentials (Tor-Stream-Isolation) |

`host` und `port` sind erforderlich. `isolate_streams` ist standardmäßig `false`. Wenn Isolation aktiviert ist, erzeugt die Runtime für jeden Dial einen neuen Benutzernamen und ein neues Passwort, statt die konfigurierten Zugangsdaten zu verwenden.

## Tailscale

```yaml
- name: tailnet
  kind: network.tailscale
  hostname: "wippy-node"
  auth_key: ${env:TS_AUTHKEY}
  ephemeral: false
  control_url: ""
```

| Feld | Typ | Beschreibung |
|-------|------|-------------|
| `hostname` | string | tsnet-Knotenname (wird im knotenspezifischen State-Verzeichnis verwendet) |
| `auth_key` | string | Tailnet-Auth-Key — inline oder als `${env:NAME}`, aufgelöst über die [Env-Registry](./env.md) |
| `state_dir` | string | Überschreibung des tsnet-State-Verzeichnisses |
| `control_url` | string | Alternativer Koordinationsserver |
| `ephemeral` | bool | Als ephemeren Tailnet-Knoten registrieren |

`auth_key` ist erforderlich; geben Sie ihn direkt oder über `${env:NAME}` an. Die veraltete Direktive `auth_key_env` wird auf dieselbe Weise aufgelöst; verwenden Sie stattdessen `auth_key: ${env:NAME}`.

Der tsnet-Hostname ist standardmäßig `wippy`. Wenn `state_dir` fehlt, verwendet die Runtime `<network_service.state_dir>/tailscale/<node>`, wobei `<node>` der konfigurierte Hostname oder, falls keiner konfiguriert ist, der Registry-Entry-Name ist.

## I2P

```yaml
- name: i2p_bridge
  kind: network.i2p
  host: 127.0.0.1
  port: 7656
  session_name: "wippy"
```

| Feld | Typ | Beschreibung |
|-------|------|-------------|
| `host` | string | SAM-v3-Bridge-Host |
| `port` | int | SAM-v3-Bridge-Port |
| `session_name` | string | Optionaler Session-Identifier |

`host` und `port` sind erforderlich. `session_name` ist standardmäßig `wippy` und dient als Präfix für die SAM-Session-IDs jedes Dials und Listeners.

## Overlay auswählen

### Auf `http.service`

Binden Sie den Server-Listener über ein Overlay (Tailscale, I2P):

```yaml
- name: gateway
  kind: http.service
  addr: ":8080"
  network: app.net:tailnet
```

SOCKS5 unterstützt kein eingehendes Listening — verwenden Sie es nur für ausgehende Verbindungen.

### Aus Lua

Leiten Sie eine aufgerufene Funktion oder einen erzeugten Prozess mit `with_options` über ein Overlay:

```lua
local funcs = require("funcs")

local caller, err = funcs.new():with_options({ network = "app.net:proxy" })
if err then return nil, err end
local result, call_err = caller:call("app.api:fetch_data")
if call_err then return nil, call_err end
```

```lua
local process = require("process")

local pid, err = process.with_options({ network = "app.net:tailnet" })
    :spawn_monitored("app.workers:probe", "app:processes")
if err then return nil, err end
```

Das Erstellen des Process-Spawners mit benutzerdefinierten Optionen erfordert außerdem `process.context` für `context`. Eine Verweigerung löst einen Lua-Fehler aus, bevor der Spawner zurückgegeben wird; `network.select` wird anschließend separat für die ausgewählte Netzwerk-ID geprüft.

Das `http_client`-Modul akzeptiert dieselbe Overlay-Auswahl in den Optionen eines einzelnen Aufrufs unter dem Schlüssel `overlay_network`.

## Vererbung

Die Overlay-Auswahl wird durch den Aufrufstapel weitergegeben. Eine über `funcs.new():with_options({network=...})` aufgerufene Funktion verwendet das Overlay für innere Dials, verschachtelte Aufrufe und erzeugte Prozesse, sofern nicht eine neue Grenze ein anderes Overlay auswählt. Eine leere `network`-Option bedeutet „keine Überschreibung“; sie löscht weder ein geerbtes Overlay noch den Anwendungsstandard.

Bei einem Funktionsaufruf überschreiben Laufzeitoptionen die `meta.options` des Funktionseintrags, bevor das Netzwerk ausgewählt wird. An einer neuen Funktions- oder Prozessgrenze wird zuerst ein nicht leeres `options.network` ausgewählt. Fehlt es, wird das konfigurierte `network_service.default_network` gewählt; ist auch dieses nicht vorhanden, bleibt die geerbte Frame-Auswahl bestehen. Eine ausgewählte ID muss bereits registriert sein. Eine unbekannte ID lässt den Aufruf oder Spawn fehlschlagen, statt auf das Host-Netzwerk zurückzufallen.

Die Ambient-Vererbung umgeht die eigenen `network.select`-Deny-Regeln des Nachkommen. Nur die explizite Auswahl an einer Lua-Grenze wird überprüft.

## App-Konfiguration

Overlay-Treiber lesen app-weite Einstellungen aus einem `network_service:`-Block in `.wippy.yaml`:

```yaml
network_service:
  state_dir: .wippy/net          # base dir for driver state (Tailscale keys, etc.)
  default_network: app.net:tailnet  # overlay applied when no call sets one
```

| Feld | Standard | Beschreibung |
|------|----------|--------------|
| `state_dir` | `.wippy/net` | Verzeichnis für den Treiberzustand. Relative Pfade werden gegen das Verzeichnis der Boot-Konfiguration aufgelöst. |
| `default_network` | — | Registry-ID eines Overlays für alle Tasks oder Prozesse, die nicht über Optionen ihr eigenes Netzwerk festlegen. |

## Overlays aktualisieren

Overlay-Einträge werden bei einer Registry-Aktualisierung ersetzt. Der Treiber erstellt den Ersatz, bevor er darauf umschaltet; schlägt die Erstellung fehl, läuft das bestehende Overlay weiter. Ein erfolgreicher Austausch ist für neue Lookups atomar, anschließend wird der vorherige Dienst geschlossen. Bereits mit dem vorherigen Dienst ausgeführte Arbeit kann daher dessen Schließung beobachten.

## Berechtigungen

| Aktion | Ressource | Beschreibung |
|--------|----------|-------------|
| `network.select` | Netzwerk-Registry-ID | Explizite Overlay-Auswahl bei `funcs.call`, `process.spawn`, `http_client` |
| `network.bind` | Netzwerk-Registry-ID | Binden eines `http.service`-Listeners über ein Overlay (das Feld `network:`) |
| `process.context` | `context` | Erstellen eines Process-Spawners mit `process.with_options(...)` |

Verweigern Sie `network.select` für einen Scope, um Code innerhalb davon daran zu hindern, explizit ein Overlay zu wählen. Geerbte Overlays sind nicht betroffen — sie wurden beim Aufrufer autorisiert. `network.bind` wird geprüft, wenn ein Server mit einem `network:`-Overlay seinen Listener startet.

## Siehe auch

- [Sicherheit](system/security.md) - Richtlinien und Actors
- [HTTP-Service](http/server.md) - Server-Binding
- [HTTP-Client](lua/http/client.md) - Overlay-Auswahl pro Aufruf
