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

Dies setzt einen Basis-Actor und Richtlinien für alle Anfragen. Für authentifizierte Anfragen überschreibt die [token_auth-Middleware](http-middleware.md) den Actor basierend auf dem validierten Token, was benutzerspezifische Sicherheitsrichtlinien ermöglicht.

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

<warning>
TLS-Terminierung wird typischerweise von einem Reverse-Proxy (Nginx, Caddy, Load-Balancer) behandelt. Konfigurieren Sie Ihren Proxy zur Weiterleitung an Wippys HTTP-Server.
</warning>

## Siehe auch

- [Routing](http-router.md) - Router und Endpunkte
- [Statische Dateien](http-static.md) - Statische Datei-Bereitstellung
- [Middleware](http-middleware.md) - Verfügbare Middleware
- [Sicherheit](system-security.md) - Sicherheitsrichtlinien
- [WebSocket-Relay](http-websocket-relay.md) - WebSocket-Messaging
