# Netzwerk-Overlays

Leite ausgehenden Verkehr weiter und binde Listener über Overlay-Netzwerke an (SOCKS5-Proxies, Tor, Tailscale-Mesh, I2P). Die Overlay-Auswahl erfolgt opt-in pro Aufruf und wird über Funktions-, Prozess- und HTTP-Grenzen hinweg vererbt.

## Entry-Kinds

| Kind | Beschreibung |
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

## Tailscale

```yaml
- name: tailnet
  kind: network.tailscale
  hostname: "wippy-node"
  auth_key_env: "TS_AUTHKEY"
  ephemeral: false
  control_url: ""
```

| Feld | Typ | Beschreibung |
|-------|------|-------------|
| `hostname` | string | tsnet-Knotenname (wird im knotenspezifischen State-Verzeichnis verwendet) |
| `auth_key` | string | Inline-Tailnet-Auth-Key |
| `auth_key_env` | string | Name der Env-Variable mit dem Auth-Key (wird über die Env-Registry aufgelöst) |
| `state_dir` | string | Überschreibung des tsnet-State-Verzeichnisses |
| `control_url` | string | Alternativer Koordinationsserver |
| `ephemeral` | bool | Als ephemeren Tailnet-Knoten registrieren |

Entweder `auth_key` oder `auth_key_env` ist erforderlich.

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

## Overlay auswählen

### Auf http.service

Binde den Server-Listener über ein Overlay (Tailscale, I2P):

```yaml
- name: gateway
  kind: http.service
  addr: ":8080"
  network: app.net:tailnet
```

SOCKS5 unterstützt kein eingehendes Listening — verwende es nur für ausgehende Verbindungen.

### Aus Lua

Leite eine aufgerufene Funktion oder einen erzeugten Prozess über ein Overlay mittels `with_options`:

```lua
local funcs = require("funcs")

local result, err = funcs.new()
    :with_options({ network = "app.net:proxy" })
    :call("app.api:fetch_data")
```

```lua
local pid, err = process.with_options({ network = "app.net:tailnet" })
    :spawn_monitored("app.workers:probe", "app:processes")
```

Das `httpclient`-Modul akzeptiert denselben Schlüssel in den Per-Call-Optionen.

## Vererbung

Die Overlay-Auswahl fließt durch den Call-Stack. Eine Funktion, die über `funcs.new():with_options({network=...})` aufgerufen wird, sieht das Overlay bei jeder inneren Verbindung, jedem verschachtelten `funcs.call` und jedem `process.spawn`, den sie ausführt — bis ein Nachkomme explizit ein anderes Overlay auswählt oder es löscht.

Die Ambient-Vererbung umgeht die eigenen `network.select`-Deny-Regeln des Nachkommen. Nur die explizite Auswahl an einer Lua-Grenze wird überprüft.

## Berechtigungen

| Aktion | Ressource | Beschreibung |
|--------|----------|-------------|
| `network.select` | Netzwerk-Registry-ID | Explizite Overlay-Auswahl bei `funcs.call`, `process.spawn`, `http_client` |

Verweigere `network.select` für einen Scope, um Code innerhalb davon daran zu hindern, explizit ein Overlay zu wählen. Geerbte Overlays sind nicht betroffen — sie wurden beim Aufrufer autorisiert.

## Siehe auch

- [Sicherheit](system/security.md) - Richtlinien und Akteure
- [HTTP-Service](http/server.md) - Server-Binding
- [HTTP-Client](lua/http/client.md) - Overlay-Auswahl pro Aufruf
