# Netzwerk-Overlays

Leite ausgehende HTTP-Anfragen und gestartete Prozesse durch SOCKS5-, Tailscale- oder I2P-Overlays.

## Überblick

Wippy unterstützt Overlay-Netzwerke, die den Datenverkehr von Funktionen, Prozessen und HTTP-Clients transparent transportieren. Jedes Overlay ist ein Registry-Eintrag; Code wählt es pro Aufruf, und die Auswahl wird an innere Aufrufe vererbt, bis ein Nachkomme sie explizit überschreibt.

Unterstützte Overlays:

- `network.socks5` — generischer SOCKS5-Proxy (auch Tors SOCKS5-Listener)
- `network.tailscale` — tsnet-Overlay-Knoten
- `network.i2p` — I2P SAM v3-Bridge

## Projektstruktur

```
netdemo/
├── wippy.lock
└── src/
    ├── _index.yaml
    └── probe.lua
```

## Schritt 1: Overlay definieren

Erstelle `src/_index.yaml`:

```yaml
version: "1.0"
namespace: app

entries:
  - name: processes
    kind: process.host
    lifecycle:
      auto_start: true

  - name: terminal
    kind: terminal.host
    lifecycle:
      auto_start: true

  # SOCKS5-Proxy-Eintrag (Tor stellt standardmäßig einen auf 127.0.0.1:9050 bereit)
  - name: tor
    kind: network.socks5
    host: 127.0.0.1
    port: 9050
    isolate_streams: true

  - name: probe
    kind: process.lua
    meta:
      command:
        name: probe
        short: Check outbound IP through overlays
    source: file://probe.lua
    method: main
    modules:
      - io
      - http_client
      - json
```

`isolate_streams: true` veranlasst den SOCKS5-Treiber, pro Verbindung zufällige Zugangsdaten zu generieren, damit Tor für jeden Verbindungsaufbau einen neuen Schaltkreis öffnet.

## Schritt 2: Ausgehende Aufrufe routen

Erstelle `src/probe.lua`:

```lua
local io = require("io")
local http_client = require("http_client")
local json = require("json")

local function fetch_ip(overlay)
    local options = { timeout = "15s" }
    if overlay then
        options.overlay_network = overlay
    end

    local resp, err = http_client.get("https://api.ipify.org?format=json", options)
    if err then
        return nil, tostring(err)
    end
    if resp.status_code ~= 200 then
        return nil, "HTTP " .. resp.status_code
    end

    local body = json.decode(resp.body or "")
    return body and body.ip, nil
end

local function main()
    local direct, d_err = fetch_ip(nil)
    if d_err then
        io.print("direct failed: " .. d_err)
    else
        io.print("direct IP: " .. direct)
    end

    local routed, r_err = fetch_ip("app:tor")
    if r_err then
        io.print("tor failed: " .. r_err)
    else
        io.print("tor IP:    " .. routed)
    end

    return 0
end

return { main = main }
```

Die Option `overlay_network` bei `http_client` wählt das Overlay nur für diesen Aufruf. Ohne sie läuft der Verbindungsaufbau über den Prozessstandard (entweder `network_service.default_network` in `.wippy.yaml` oder direkt).

## Schritt 3: Ausführen

```bash
wippy init
wippy run probe
```

Mit lokal laufendem Tor:

```
direct IP: 203.0.113.42
tor IP:    185.220.101.61
```

Wenn Tor nicht läuft, meldet die Zeile `tor IP` einen Verbindungsfehler — das SOCKS5-Overlay fällt nicht stillschweigend auf eine direkte Verbindung zurück.

## Vererbung

Die Overlay-Auswahl fließt durch verschachtelte Aufrufe. Das Overlay einmal an einem `funcs.call`- oder `process.spawn`-Übergang setzen, und jeder innere HTTP-Aufruf, verschachtelte `funcs.call` und `process.spawn` darunter verwendet es, bis eine explizite Überschreibung erfolgt:

```lua
local funcs = require("funcs")

local result, err = funcs.new()
    :with_options({ network = "app:tor" })
    :call("app:scrape_site", url)
```

```lua
local pid, err = process.with_options({ network = "app:tor" })
    :spawn_monitored("app.workers:probe", "app:processes")
```

Die verschachtelte Funktion oder der gestartete Prozess verwendet das Overlay bei jedem ausgehenden Verbindungsaufbau, ohne es explizit weiterzureichen.

## Einen Listener binden

Overlays, die eingehenden Datenverkehr unterstützen (Tailscale, I2P), können auch HTTP-Listener akzeptieren. Das Overlay an den `http.service` statt an den Client anhängen:

```yaml
  - name: tailnet
    kind: network.tailscale
    hostname: wippy-node
    auth_key_env: TS_AUTHKEY
    ephemeral: true

  - name: gateway
    kind: http.service
    addr: ":8080"
    network: app:tailnet
    lifecycle:
      auto_start: true
```

Der Server bindet sich an das Tailnet-Interface; Clients erreichen ihn über die Tailscale-Adresse. SOCKS5 ist nur ausgehend — die Zuweisung an `http.service` wird abgelehnt.

## Anwendungsweiter Standard

Einen Standard-Overlay in `.wippy.yaml` setzen, damit jeder Aufruf ihn verwendet, sofern nicht überschrieben:

```yaml
network_service:
  state_dir: .wippy/net
  default_network: app:tor
```

Explizite Auswahl mit `network = nil` hebt den Standard für diesen Aufruf auf.

## Berechtigungen

Die Aktion `network.select` steuert die explizite Overlay-Auswahl. Sie in einem Scope verweigern, um zu verhindern, dass Code ein Overlay wählt:

```yaml
  - name: deny_network
    kind: security.policy
    policy:
      actions: "network.select"
      resources: "*"
      effect: deny
    groups:
      - untrusted
```

Vererbte Overlays umgehen diese Prüfung — sie wurden am Aufruf-Übergang des Callers autorisiert. Nur explizite Neuauswahl an einer Lua-Grenze wird geprüft.

## Nächste Schritte

- [Netzwerk-System](system/network.md) - Entry-Kind-Referenz
- [HTTP-Client](lua/http/client.md) - Pro-Aufruf-Overlay-Optionen
- [Sicherheitsmodell](system/security.md) - Policies und Scopes
- [Authentifizierung](tutorials/auth.md) - Token-basierte Sicherheit
