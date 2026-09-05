---
title: "HTTP-Server"
description: "Der HTTP-Server (http.service) lauscht auf einem Port und hostet Router, Endpunkte und statische Datei-Handler."
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
  read: "10s"    # Max Zeit zum Lesen der gesamten Anfrage (Header + Body)
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

Im `auto`-Modus darf der Server `cert`/`key` nicht angeben — der Netzwerktreiber stellt sie bereit.

### Manuelles Zertifikat

Unter `mode: manual` tragen `cert` und `key` PEM-Inhalt. Stelle diesen Inhalt auf eine von drei Arten bereit (pro Feld genau eine Variante, niemals gemischt):

1. **Inline-PEM** — der wörtliche PEM-String.
2. **`file://`-Referenz** — manifest-relativer Pfad, der beim Laden aufgelöst und inline eingefügt wird (traversal-sicher).
3. **Referenz auf die Env-Registry** — hole das PEM beim Dekodieren aus einer registrierten [Umgebungsvariable](system/env.md) über einen `${env:NAME}`-Platzhalter.

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

Der Platzhalter `${env:NAME}` löst `NAME` über die [Umgebungs-Registry](system/env.md) auf — den öffentlichen Namen einer registrierten Variable oder deren Entry-ID (z. B. `app.env:tls_cert`). Es handelt sich nicht um eine rohe Betriebssystem-Umgebungsvariable; ein Betriebssystemwert ist nur erreichbar, wenn unter diesem Namen eine von `env.storage.os` gestützte Variable registriert ist. Ein Standardwert lässt sich mit `${env:NAME|default}` angeben.

<note>
Die alten Begleitfelder <code>cert_env</code> / <code>key_env</code> werden weiterhin auf dieselbe Weise über die Umgebungs-Registry aufgelöst, sind aber <b>veraltet</b> — bevorzuge den oben gezeigten Platzhalter <code>${env:NAME}</code>.
</note>

| Feld | Beschreibung |
|------|--------------|
| `mode` | `""` (aus), `auto` oder `manual` |
| `cert` / `key` | PEM-Inhalt — inline, `file://`-Referenz oder `${env:NAME}`-Platzhalter |

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

`client_ca` akzeptiert dieselben drei Formen wie `cert`/`key` (Inline-PEM, `file://` oder `${env:NAME}`). Das alte Begleitfeld `client_ca_env` ist ebenfalls veraltet zugunsten von `client_ca: ${env:NAME}`.

| Feld | Beschreibung |
|------|--------------|
| `client_auth` | `request`, `require_any`, `verify_if_given`, `require_and_verify` |
| `client_ca` | PEM-Bundle vertrauenswürdiger Client-CAs (inline, `file://` oder `${env:NAME}`) |

`verify_if_given` und `require_and_verify` benötigen eine CA. `request` und `require_any` akzeptieren jedes Client-Zertifikat ohne CA-Verifizierung.

## Siehe auch

- [Routing](http/router.md) - Router und Endpunkte
- [Statische Dateien](http/static.md) - Statische Datei-Bereitstellung
- [Middleware](http/middleware.md) - Verfügbare Middleware
- [Sicherheit](system/security.md) - Sicherheitsrichtlinien
- [WebSocket-Relay](http/websocket-relay.md) - WebSocket-Messaging
