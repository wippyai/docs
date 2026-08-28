---
title: "HTTP-Server"
description: "Der HTTP-Server (http.service) lauscht auf einem Port und hostet Router, Endpunkte und statische Datei-Handler."
---

# HTTP-Server

Ein `http.service` besitzt einen Listener und hostet Router, Endpunkte und Handler für statische Dateien.

**Klassifikation: Server-Konfigurationsreferenz.** Blöcke sind Registry-Teilfragmente, sofern sie nicht jeden referenzierten Netzwerk-, Umgebungs-, Dateisystem-, Router-, Zertifikat-, Actor- und Richtlinieneintrag definieren.

## Konfiguration

```yaml
- name: gateway
  kind: http.service
  addr: ":8080"
  timeouts:
    read: "5s"
    write: "30s"
    idle: "60s"
  host:
    buffer_size: 1024
    worker_count: 4
  lifecycle:
    auto_start: true
    security:
      actor:
        id: "http-gateway"
      policies:
        - app:http_policy
```

| Feld | Typ | Standard | Beschreibung |
|------|-----|----------|--------------|
| `addr` | string | erforderlich | Lausch-Adresse (`:8080`, `0.0.0.0:443`) |
| `timeouts.read` | duration | - | Request-Lese-Timeout |
| `timeouts.write` | duration | - | Response-Schreib-Timeout |
| `timeouts.idle` | duration | - | Keep-Alive-Verbindungs-Timeout |
| `host.buffer_size` | int | 1024 | Nachrichten-Relay-Puffergröße |
| `host.worker_count` | int | NumCPU | Nachrichten-Relay-Worker |
| `network` | Registry-ID | - | Listener über ein [Netzwerk-Overlay](system/network.md) binden, etwa Tailscale oder I2P |
| `tls` | object | - | TLS-Terminierung (siehe [TLS](#tls)) |

## Timeouts

Konfigurieren Sie Timeouts, um Ressourcenerschöpfung zu verhindern:

```yaml
timeouts:
  read: "10s"    # Max time to read the entire request (headers + body)
  write: "60s"   # Max time to write response
  idle: "120s"   # Keep-alive timeout
```

- `read` — Für APIs kurz (5–10 Sekunden), für Uploads länger
- `write` — An die erwartete Dauer der Response-Erzeugung anpassen
- `idle` — Verbindungswiederverwendung gegen Ressourcenverbrauch abwägen

<note>
Dauer-Format: <code>30s</code>, <code>1m</code>, <code>2h15m</code>. <code>0</code> zum Deaktivieren verwenden.
</note>

## Host-Konfiguration

Der `host`-Abschnitt konfiguriert das interne Nachrichten-Relay des Servers, das von Komponenten wie WebSocket-Relay verwendet wird:

```yaml
host:
  buffer_size: 2048
  worker_count: 8
```

| Feld | Standard | Beschreibung |
|------|----------|--------------|
| `buffer_size` | 1024 | Nachrichtenwarteschlangen-Kapazität pro Worker |
| `worker_count` | NumCPU | Parallele Nachrichtenverarbeitungs-Goroutinen |

<tip>
Erhöhen Sie diese Werte für Hochdurchsatz-WebSocket-Anwendungen. Das Nachrichten-Relay behandelt asynchrone Zustellung zwischen HTTP-Komponenten und Prozessen.
</tip>

## Sicherheit

HTTP-Server können einen Standard-Sicherheitskontext über die Lebenszyklus-Konfiguration anwenden:

```yaml
lifecycle:
  auto_start: true
  security:
    actor:
      id: "gateway-service"
    policies:
      - app:http_access_policy
```

Dies setzt einen Basis-Actor und Richtlinien für alle Anfragen. Bei authentifizierten Anfragen überschreibt die [token_auth-Middleware](http/middleware.md) den Actor anhand des validierten Tokens und ermöglicht damit benutzerspezifische Sicherheitsrichtlinien.

## Lebenszyklus

Server werden vom Supervisor verwaltet:

```yaml
lifecycle:
  auto_start: true
  start_timeout: 30s
  stop_timeout: 60s
  requires:
    - app:database
```

| Feld | Beschreibung |
|------|--------------|
| `auto_start` | Beim Anwendungsstart starten |
| `start_timeout` | Max Wartezeit für Server-Start |
| `stop_timeout` | Max Zeit für kontrolliertes Herunterfahren |
| `requires` | Starten, nachdem diese Einträge bereit sind (`depends_on` ist die veraltete Schreibweise) |

## Komponenten verbinden

Router und statische Handler referenzieren den Server über Metadaten:

```yaml
entries:
  - name: gateway
    kind: http.service
    addr: ":8080"

  - name: api
    kind: http.router
    meta:
      server: gateway
    prefix: /api

  - name: static
    kind: http.static
    meta:
      server: gateway
    path: /
    fs: app:public
```

## Mehrere Server

Separate Server für verschiedene Zwecke betreiben:

```yaml
entries:
  # Public API
  - name: public
    kind: http.service
    addr: ":8080"
    lifecycle:
      auto_start: true

  # Admin (localhost only)
  - name: admin
    kind: http.service
    addr: "127.0.0.1:9090"
    lifecycle:
      auto_start: true
```

## TLS

Der Server kann TLS direkt terminieren. Setzen Sie `tls.mode` auf `manual` (eigenes Zertifikat bereitstellen) oder `auto` (Zertifikat wird von einem Overlay-Netzwerktreiber bereitgestellt, z. B. `network.tailscale`). Reine Clearnet-Listener unterstützen `auto` nicht. Lassen Sie `tls` weg oder den Modus leer, um reines HTTP auszuführen.

Im Modus `auto` darf der Server weder `cert` noch `key` angeben — der Netzwerktreiber stellt sie bereit.

### Manuelles Zertifikat

Unter `mode: manual` enthalten `cert` und `key` PEM-Inhalt. Stellen Sie diesen Inhalt auf genau eine der folgenden Arten pro Feld bereit und mischen Sie die Formen nicht:

1. **Inline-PEM** — Die wörtliche PEM-Zeichenkette.
2. **`file://`-Referenz** — Ein manifestrelativer Pfad, der beim Laden traversal-sicher aufgelöst und eingebettet wird.
3. **Referenz auf die Umgebungs-Registry** — Den PEM-Inhalt beim Dekodieren über einen `${env:NAME}`-Platzhalter aus einer registrierten [Umgebungsvariablen](system/env.md) abrufen.

```yaml
- name: api
  kind: http.service
  addr: ":443"
  tls:
    mode: manual
    cert: file://./certs/server.pem
    key:  file://./certs/server.key
```

```yaml
- name: api
  kind: http.service
  addr: ":443"
  tls:
    mode: manual
    cert: ${env:app.env:tls_cert}
    key:  ${env:app.env:tls_key}
```

Der Platzhalter `${env:NAME}` löst `NAME` über die [Umgebungs-Registry](../system/env.md) auf — entweder den öffentlichen Namen einer registrierten Variablen oder ihre Eintrags-ID, beispielsweise `app.env:tls_cert`. Er bezeichnet keine rohe Betriebssystem-Umgebungsvariable; ein Betriebssystemwert ist nur erreichbar, wenn unter diesem Namen eine auf `env.storage.os` basierende Variable registriert ist. Mit `${env:NAME|default}` kann ein Standardwert angegeben werden.

<note>
Die veralteten Begleitfelder <code>cert_env</code> und <code>key_env</code> werden weiterhin auf dieselbe Weise über die Umgebungs-Registry aufgelöst. Bevorzugen Sie den oben gezeigten Platzhalter <code>${env:NAME}</code>.
</note>

| Feld | Beschreibung |
|------|--------------|
| `mode` | `""` (aus), `auto` oder `manual` |
| `cert` / `key` | PEM-Inhalt — inline, als `file://`-Referenz oder als `${env:NAME}`-Platzhalter |

### Mutual TLS (mTLS)

Unter `mode: manual` kann der Server zusätzlich Client-Zertifikate verifizieren:

```yaml
tls:
  mode: manual
  cert: ${env:app.env:tls_cert}
  key:  ${env:app.env:tls_key}
  client_ca: file://./certs/clients-ca.pem
  client_auth: require_and_verify
```

`client_ca` akzeptiert dieselben drei Formen wie `cert` und `key`: Inline-PEM, `file://` oder `${env:NAME}`. Das veraltete Begleitfeld `client_ca_env` sollte ebenfalls durch `client_ca: ${env:NAME}` ersetzt werden.

| Feld | Beschreibung |
|------|--------------|
| `client_auth` | `request`, `require_any`, `verify_if_given`, `require_and_verify` |
| `client_ca` | PEM-Bundle vertrauenswürdiger Client-CAs — inline, als `file://`-Referenz oder als `${env:NAME}`-Platzhalter |

`verify_if_given` und `require_and_verify` benötigen eine CA. `request` und `require_any` akzeptieren jedes Client-Zertifikat ohne CA-Verifizierung.

## Siehe auch

- [Routing](http/router.md) – Router und Endpunkte
- [Statische Dateien](http/static.md) – Bereitstellung statischer Dateien
- [Middleware](http/middleware.md) – Verfügbare Middleware
- [Sicherheit](system/security.md) – Sicherheitsrichtlinien
- [WebSocket-Relay](http/websocket-relay.md) – WebSocket-Nachrichten
