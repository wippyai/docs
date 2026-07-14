---
title: "HTTP-Server"
---

# HTTP-Server

Der HTTP-Server (`http.service`) lauscht auf einem Port und hostet Router, Endpunkte und statische Datei-Handler.

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
| `network` | Registry-ID | - | Listener über ein [Netzwerk-Overlay](system/network.md) binden (z. B. Tailscale, I2P) |
| `tls` | object | - | TLS-Terminierung (siehe [TLS](#tls)) |

## Timeouts

Konfigurieren Sie Timeouts um Ressourcenerschöpfung zu verhindern:

```yaml
timeouts:
  read: "10s"    # Max Zeit zum Lesen von Request-Headern
  write: "60s"   # Max Zeit zum Schreiben der Response
  idle: "120s"   # Keep-Alive-Timeout
```

- `read` - Kurz (5-10s) für APIs, länger für Uploads
- `write` - Entsprechend der erwarteten Response-Generierungszeit anpassen
- `idle` - Balance zwischen Verbindungswiederverwendung und Ressourcennutzung

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

Dies setzt einen Basis-Actor und Richtlinien für alle Anfragen. Für authentifizierte Anfragen überschreibt die [token_auth-Middleware](http/middleware.md) den Actor basierend auf dem validierten Token, was benutzerspezifische Sicherheitsrichtlinien ermöglicht.

## Lebenszyklus

Server werden vom Supervisor verwaltet:

```yaml
lifecycle:
  auto_start: true
  start_timeout: 30s
  stop_timeout: 60s
  depends_on:
    - app:database
```

| Feld | Beschreibung |
|------|--------------|
| `auto_start` | Beim Anwendungsstart starten |
| `start_timeout` | Max Wartezeit für Server-Start |
| `stop_timeout` | Max Zeit für kontrolliertes Herunterfahren |
| `depends_on` | Nach diesen Einträgen starten |

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
  # Öffentliche API
  - name: public
    kind: http.service
    addr: ":8080"
    lifecycle:
      auto_start: true

  # Admin (nur localhost)
  - name: admin
    kind: http.service
    addr: "127.0.0.1:9090"
    lifecycle:
      auto_start: true
```

## TLS

Der Server kann TLS direkt terminieren. Setzen Sie `tls.mode` auf `manual` (eigenes Zertifikat bereitstellen) oder `auto` (Zertifikat wird von einem Overlay-Netzwerktreiber bereitgestellt, z. B. `network.tailscale`). Reine Clearnet-Listener unterstützen `auto` nicht. Lassen Sie `tls` weg oder den Modus leer, um reines HTTP auszuführen.

Im `auto`-Modus darf der Server `cert`/`key`/`cert_env`/`key_env` nicht angeben — der Netzwerktreiber stellt sie bereit.

### Manuelles Zertifikat

Stellen Sie Zertifikat und Schlüssel entweder inline/aus einer Datei oder über Umgebungsvariablen bereit (niemals beides):

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
    cert_env: TLS_SERVER_CERT
    key_env:  TLS_SERVER_KEY
```

| Feld | Beschreibung |
|------|--------------|
| `mode` | `""` (aus), `auto` oder `manual` |
| `cert` / `key` | PEM-Inhalt (typischerweise via `file://` geladen) |
| `cert_env` / `key_env` | Namen von Umgebungsvariablen, aufgelöst über die [env-Registry](system/env.md) |

### Mutual TLS (mTLS)

Unter `mode: manual` kann der Server zusätzlich Client-Zertifikate verifizieren:

```yaml
tls:
  mode: manual
  cert_env: TLS_SERVER_CERT
  key_env:  TLS_SERVER_KEY
  client_ca: file://./certs/clients-ca.pem
  client_auth: require_and_verify
```

| Feld | Beschreibung |
|------|--------------|
| `client_auth` | `request`, `require_any`, `verify_if_given`, `require_and_verify` |
| `client_ca` | PEM-Bundle vertrauenswürdiger Client-CAs |
| `client_ca_env` | Umgebungsvariable mit dem CA-Bundle (gegenseitig ausschließend mit `client_ca`) |

`verify_if_given` und `require_and_verify` benötigen eine CA. `request` und `require_any` akzeptieren jedes Client-Zertifikat ohne CA-Verifizierung.

## Siehe auch

- [Routing](http/router.md) - Router und Endpunkte
- [Statische Dateien](http/static.md) - Statische Datei-Bereitstellung
- [Middleware](http/middleware.md) - Verfügbare Middleware
- [Sicherheit](system/security.md) - Sicherheitsrichtlinien
- [WebSocket-Relay](http/websocket-relay.md) - WebSocket-Messaging
