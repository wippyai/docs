---
title: "Netzwerk-Overlays"
description: "Ausgehende HTTP-Aufrufe und gestartete Prozesse über SOCKS5 routen, mit einem Tailscale-Teilrezept."
---

# Netzwerk-Overlays

Konfigurieren Sie ein SOCKS5-Overlay für ausgehende HTTP-Aufrufe und lernen Sie anschließend Vererbung, eingehende Listener, Anwendungsstandards und Berechtigungen kennen.

**Klassifizierung:** Ausführbares SOCKS5-Tutorial mit einem Tailscale-Teilrezept.
Die direkte/Tor-Prüfung ist vollständig, sobald ein externer Tor-Listener verfügbar
ist. Der Tailscale-Abschnitt erklärt die Wippy-Verdrahtung, überlässt die Einrichtung
des Kontos aber bewusst Tailscale. Verwenden Sie für I2P die unten verlinkte Referenz des Netzwerksystems.

## Überblick

Wippy stellt Overlay-Netzwerke als Registry-Einträge dar. Code kann ein Overlay für
einen Aufruf auswählen; diese Auswahl wird an verschachtelte Aufrufe weitergegeben,
bis ein Nachkomme sie überschreibt.

Wippy unterstützt drei Arten von Overlay-Einträgen:

- `network.socks5` — generischer SOCKS5-Proxy (auch Tors SOCKS5-Listener)
- `network.tailscale` — tsnet-Overlay-Knoten
- `network.i2p` — I2P SAM v3-Bridge

## Voraussetzungen

- Wippy-Runtime `v0.3.32a`.
- `curl` und ausgehender HTTPS-Zugriff auf `api.ipify.org`.
- Ein Tor-Daemon, der SOCKS5 unter `127.0.0.1:9050` bereitstellt. Installieren Sie
  ein unterstütztes Paket von der [Download-Seite des Tor Project](https://www.torproject.org/download/tor/),
  starten Sie es und prüfen Sie den Listener, bevor Sie Wippy ausführen:

  ```bash
  curl --socks5-hostname 127.0.0.1:9050 https://api.ipify.org?format=json
  ```

  Eine erfolgreiche Prüfung gibt JSON mit einer IP-Adresse zurück. Tor Browser
  verwendet häufig Port 9150. Wenn Sie bewusst diesen Listener verwenden, ändern
  Sie den Registry-Eintrag und den Prüfbefehl gemeinsam.
- Ein leeres Arbeitsverzeichnis:

  ```bash
  mkdir netdemo
  cd netdemo
  mkdir src
  ```

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
  - name: probe_policy
    kind: security.policy
    policy:
      actions:
        - http_client.request
        - network.select
      resources: "*"
      effect: allow

  - name: processes
    kind: process.host
    lifecycle:
      auto_start: true

  - name: terminal
    kind: terminal.host
    lifecycle:
      auto_start: true

  # SOCKS5 proxy entry (Tor exposes one at 127.0.0.1:9050 by default)
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
        security:
          actor:
            id: app:probe
          policies:
            - app:probe_policy
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

Die Option `overlay_network` wählt das Overlay für diesen HTTP-Aufruf. Ohne sie
verwendet der Verbindungsaufbau den Prozessstandard: `network_service.default_network`
aus `.wippy.yaml` oder eine direkte Verbindung, wenn kein Standard gesetzt ist.

## Schritt 3: Ausführen

```bash
wippy init
wippy run probe
```

Mit lokal laufendem Tor:

```
direct IP: <your public IP>
tor IP:    <Tor exit IP>
```

Wenn Tor nicht läuft, meldet die Zeile `tor IP` einen Verbindungsfehler — das SOCKS5-Overlay fällt nicht stillschweigend auf eine direkte Verbindung zurück.

## Vererbung

Die Overlay-Auswahl fließt durch verschachtelte Aufrufe. Wenn Sie das Overlay an einer `funcs.call`- oder `process.spawn`-Grenze setzen, verwenden innere HTTP-, Funktions- und Prozessaufrufe es, bis eine explizite Überschreibung erfolgt:

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

Tailscale kann auch HTTP-Listener annehmen. Hängen Sie das Overlay an den `http.service` statt an den Client:

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

## Fehlerbehebung und Bereinigung

- `connection refused` für `127.0.0.1:9050` bedeutet, dass Tor nicht am konfigurierten
  Port lauscht. Prüfen Sie Tor mit dem `curl`-Befehl aus den Voraussetzungen, bevor
  Sie Wippy untersuchen.
- Wenn die direkte Anfrage fehlschlägt, die geroutete aber erfolgreich ist, beeinflussen
  meist lokale DNS-, Proxy- oder Firewall-Regeln den direkten Pfad. Beide Aufrufe sind unabhängig.
- `access denied` beim gerouteten Aufruf bedeutet, dass dem Sicherheitskontext des
  Befehls `network.select` für `app:tor` fehlt. Lassen Sie `app:probe_policy` unter
  `meta.command.security` eingebunden.
- Der SOCKS5-Treiber fällt nie auf eine direkte Verbindung zurück. Entfernen Sie den
  Fehler nicht, nur damit die Demo weiterläuft.
- Der Wippy-Befehl endet selbstständig. Beenden Sie den Tor-Daemon nur, wenn Sie ihn
  ausschließlich für dieses Tutorial gestartet haben. Das SOCKS5-Beispiel erzeugt
  keinen dauerhaften Netzwerkzustand. Ein Tailscale-Eintrag kann Node-Zustand unter
  `.wippy/net/tailscale/` speichern; entfernen Sie `.wippy/net` nur nach dem Beenden
  von Wippy und nur, wenn Sie diese lokale Tailnet-Identität verwerfen möchten.

## Nächste Schritte

- [Netzwerksystem](../system/network.md) — Referenz der Eintragsarten
- [HTTP-Client](../lua/http/client.md) — Overlay-Optionen pro Aufruf
- [Sicherheitsmodell](../system/security.md) — Policies und Scopes
- [Authentifizierung](auth.md) — Token-basierte Sicherheit
