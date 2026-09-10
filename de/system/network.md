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
| `auth_key` | string | Tailnet-Auth-Key — inline oder `${env:NAME}`, aufgelöst über die [Env-Registry](system/env.md) |
| `state_dir` | string | Überschreibung des tsnet-State-Verzeichnisses |
| `control_url` | string | Alternativer Koordinationsserver |
| `ephemeral` | bool | Als ephemeren Tailnet-Knoten registrieren |

`auth_key` ist erforderlich (direkt oder über `${env:NAME}` angeben). Die Legacy-Direktive `auth_key_env` löst sich genauso auf, ist aber veraltet; bevorzugen Sie `auth_key: ${env:NAME}`.

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

Das `http_client`-Modul akzeptiert dieselbe Overlay-Auswahl in den Per-Call-Optionen unter dem Schlüssel `overlay_network`.

## Vererbung

Die Overlay-Auswahl wird durch den Aufrufstapel weitergegeben. Eine über `funcs.new():with_options({network=...})` aufgerufene Funktion verwendet das Overlay für innere Dials, verschachtelte Aufrufe und erzeugte Prozesse, sofern nicht eine neue Grenze ein anderes Overlay auswählt. Eine leere `network`-Option bedeutet „keine Überschreibung“; sie löscht weder ein geerbtes Overlay noch den Anwendungsstandard.

Bei einem Funktionsaufruf überschreiben Laufzeitoptionen die `meta.options` des Funktionseintrags, bevor das Netzwerk ausgewählt wird. An einer neuen Funktions- oder Prozessgrenze wird zuerst ein nicht leeres `options.network` ausgewählt. Fehlt es, wird das konfigurierte `network_service.default_network` gewählt; ist auch dieses nicht vorhanden, bleibt die geerbte Frame-Auswahl bestehen. Eine ausgewählte ID muss bereits registriert sein. Eine unbekannte ID lässt den Aufruf oder Spawn fehlschlagen, statt auf das Host-Netzwerk zurückzufallen.

Die Ambient-Vererbung umgeht die eigenen `network.select`-Deny-Regeln des Nachkommen. Nur die explizite Auswahl an einer Lua-Grenze wird überprüft.

## App-Konfiguration

Overlay-Treiber lesen app-weite Einstellungen aus einem `network_service:`-Block in `.wippy.yaml`:

```yaml
network_service:
  state_dir: .wippy/net          # Basisverzeichnis für Treiber-State (Tailscale-Schlüssel etc.)
  default_network: app.net:tailnet  # Overlay, das verwendet wird, wenn kein Aufruf eines setzt
```

| Feld | Standard | Beschreibung |
|------|----------|--------------|
| `state_dir` | `.wippy/net` | Verzeichnis für Treiber-State. Relative Pfade werden gegen das Boot-Config-Verzeichnis aufgelöst. |
| `default_network` | — | Registry-ID eines Overlays, das auf jede Aufgabe oder jeden Prozess angewendet wird, der sein eigenes Netzwerk nicht über Optionen festlegt. |

## Rohe Verbindungsaufbauten

Die Overlay-Auswahl ist nicht auf Lua-Kanten beschränkt. Verbindungsaufbauten über den Runtime-Netzwerkdienst — den WASM-[`socket`-Host](wasm/hosts.md#socket) und den `wasi:sockets`-Dispatcher — lesen das Overlay vom Frame und routen darüber, gleich ob es von `with_options`, von `meta.options.network` am Entry oder von `network_service.default_network` gesetzt wurde.

Das Private-IP-Gate verhält sich auf diesem Pfad anders. Ein direkter Verbindungsaufbau löst das Ziel auf und prüft jede resultierende Adresse gegen `socket.private_ip`. Mit ausgewähltem Overlay wird nur eine literale IP-Adresse im Ziel geprüft; Hostnamen werden dem Overlay zur Auflösung übergeben, der lokale Resolver wird also nie befragt und auf das, was er zurückgegeben hätte, findet keine Prüfung statt.

Ist ein Overlay ausgewählt, der Kontext trägt aber keine Netzwerk-Registry, schlägt der Verbindungsaufbau mit `network "<id>" selected without a network registry` fehl.

## Overlays aktualisieren

Overlay-Einträge werden bei einer Registry-Aktualisierung ersetzt. Der Treiber erstellt den Ersatz, bevor er darauf umschaltet; schlägt die Erstellung fehl, läuft das bestehende Overlay weiter. Ein erfolgreicher Austausch ist für neue Lookups atomar, anschließend wird der vorherige Dienst geschlossen. Bereits mit dem vorherigen Dienst ausgeführte Arbeit kann daher dessen Schließung beobachten.

## Berechtigungen

| Aktion | Ressource | Beschreibung |
|--------|----------|-------------|
| `network.select` | Netzwerk-Registry-ID | Explizite Overlay-Auswahl bei `funcs.call`, `process.spawn`, `http_client` |
| `network.bind` | Netzwerk-Registry-ID | Binden eines `http.service`-Listeners über ein Overlay (das Feld `network:`) |
| `socket.connect` | `host:port` | Jeder ausgehende Verbindungsaufbau über den Netzwerkdienst |
| `socket.listen` | `host:port` | Binden eines TCP-Listeners oder eines UDP-Sockets über den Netzwerkdienst |
| `socket.resolve` | Hostname | DNS-Auflösung über den Netzwerkdienst |
| `socket.private_ip` | IP-Adresse | Erreichen einer Loopback-, privaten, Link-Local- oder unspezifizierten Adresse |

Verweigern Sie `network.select` für einen Scope, um Code innerhalb davon daran zu hindern, explizit ein Overlay zu wählen. Geerbte Overlays sind nicht betroffen — sie wurden beim Aufrufer autorisiert. `network.bind` wird geprüft, wenn ein Server mit einem `network:`-Overlay seinen Listener startet.

Die `socket.*`-Berechtigungen werden vom Netzwerkdienst selbst geprüft. `socket.connect`, `socket.listen` und `socket.resolve` werden vor jedem Overlay-Routing geprüft und gelten damit gleichermaßen für Clearnet- und Overlay-Verkehr; `socket.private_ip` verengt sich auf literale Adressen, sobald ein Overlay ausgewählt ist, wie unter [Rohe Verbindungsaufbauten](system/network.md#rohe-verbindungsaufbauten) beschrieben.

## Siehe auch

- [Sicherheit](system/security.md) - Richtlinien und Actors
- [HTTP-Service](http/server.md) - Server-Binding
- [HTTP-Client](lua/http/client.md) - Overlay-Auswahl pro Aufruf
- [Host-Funktionen](wasm/hosts.md) - WASM-Socket-Imports
