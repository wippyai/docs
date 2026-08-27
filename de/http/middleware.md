---
title: "HTTP-Middleware"
description: "Middleware verarbeitet HTTP-Anfragen vor und nach der Routen-Behandlung."
---

# HTTP-Middleware

HTTP-Middleware läuft in einer von zwei Router-Ketten: bevor Endpunktmetadaten angefügt werden oder nachdem die Route ihre Parameter und Endpunkt-ID bereitgestellt hat.

**Klassifikation: Middleware-Referenz.** Jeder YAML-Block ist ein Router-Fragment. Er setzt voraus, dass die genannte Middleware registriert ist und alle referenzierten Token-Store-, Dateisystem-, Endpunkt-, Actor- und Richtlinieneinträge vorhanden sind.

## Wie Middleware funktioniert

Jede Middleware erhält eine Options-Map und gibt einen Handler-Wrapper zurück:

```yaml
middleware:
  - cors
  - ratelimit
options:
  cors.allow.origins: "https://example.com"
  ratelimit.requests: "100"
```

Optionen verwenden Punkt-Notation: `middleware_name.option.name`. Legacy-Unterstrich-Format wird für Abwärtskompatibilität unterstützt.

## Pre-Handler und Post-Match

<tip>
<b>Pre-Handler</b>-Middleware läuft, nachdem der Server eine Route ausgewählt hat, aber bevor Routenmetadaten angefügt werden — für Belange wie CORS und Komprimierung.
<b>Post-Match</b>-Middleware läuft, nachdem Routenmetadaten angefügt wurden — für Autorisierung, die die Endpunkt-ID benötigt.
Keine der beiden Ketten läuft für eine nicht abgeglichene Anfrage.
</tip>

```yaml
middleware:        # Before endpoint metadata
  - cors
  - compress
options:
  cors.allow.origins: "*"

post_middleware:   # Post-match
  - endpoint_firewall
post_options:
  endpoint_firewall.action: "access"
```

---

## Verfügbare Middleware

### CORS {#cors}

<note>Pre-Handler</note>

Cross-Origin Resource Sharing für Browser-Anfragen.

```yaml
middleware:
  - cors
options:
  cors.allow.origins: "https://app.example.com"
  cors.allow.credentials: "true"
```

| Option | Standard | Beschreibung |
|--------|----------|--------------|
| `cors.allow.origins` | `*` | Erlaubte Origins (kommasepariert, unterstützt `*.example.com`) |
| `cors.allow.methods` | `GET,POST,PUT,DELETE,OPTIONS,PATCH` | Erlaubte Methoden |
| `cors.allow.headers` | `Origin,Content-Type,Accept,Authorization,X-Requested-With` | Erlaubte Request-Header |
| `cors.expose.headers` | - | Dem Client exponierte Header |
| `cors.allow.credentials` | `false` | Cookies/Auth erlauben |
| `cors.max.age` | `86400` | Preflight-Cache (Sekunden) |
| `cors.allow.private.network` | `false` | Privater Netzwerkzugriff |

OPTIONS-Preflight-Anfragen werden automatisch behandelt.

---

### Rate-Limiting {#ratelimit}

<note>Pre-Handler</note>

Token-Bucket-Rate-Limiting mit Per-Key-Tracking.

```yaml
middleware:
  - ratelimit
options:
  ratelimit.requests: "100"
  ratelimit.window: "1m"
  ratelimit.key: "ip"
```

| Option | Standard | Beschreibung |
|--------|----------|--------------|
| `ratelimit.requests` | `100` | Anfragen pro Fenster |
| `ratelimit.window` | `1m` | Zeitfenster |
| `ratelimit.burst` | `20` | Burst-Kapazität |
| `ratelimit.key` | `ip` | Schlüssel-Strategie |
| `ratelimit.cleanup_interval` | `5m` | Bereinigungs-Frequenz |
| `ratelimit.entry_ttl` | `10m` | Eintrags-Ablauf |
| `ratelimit.max_entries` | `100000` | Max verfolgte Schlüssel |

**Schlüssel-Strategien:** `ip`, `header:X-API-Key`, `query:api_key`

Gibt `429 Too Many Requests` mit den Headern `X-RateLimit-Limit` und `X-RateLimit-Window` zurück.

---

### Komprimierung {#compress}

<note>Pre-Handler</note>

Gzip-Komprimierung für Responses.

```yaml
middleware:
  - compress
options:
  compress.level: "default"
  compress.min.length: "1024"
```

| Option | Standard | Beschreibung |
|--------|----------|--------------|
| `compress.level` | `default` | `fastest`, `default` oder `best` |
| `compress.min.length` | `1024` | Minimale Response-Größe (Bytes) |

Komprimiert nur wenn Client `Accept-Encoding: gzip` sendet.

---

### Real IP {#real_ip}

<note>Pre-Handler</note>

Client-IP aus Proxy-Headern extrahieren.

```yaml
middleware:
  - real_ip
options:
  real_ip.trusted.subnets: "10.0.0.0/8,172.16.0.0/12"
```

| Option | Standard | Beschreibung |
|--------|----------|--------------|
| `real_ip.trusted.subnets` | Loopback-, private RFC-1918-, IPv4-Link-Local-, CGNAT-, IPv6-ULA- und IPv6-Link-Local-Bereiche | Vertrauenswürdige Proxy-CIDRs |
| `real_ip.trust_all` | `false` | Allen Quellen vertrauen (unsicher) |

**Header-Priorität:** `True-Client-IP` > `X-Real-IP` > `X-Forwarded-For`

---

### Token-Auth {#token_auth}

<note>Pre-Handler</note>

Token-basierte Authentifizierung. Informationen zur Token-Store-Konfiguration finden Sie unter [Sicherheit](../system/security.md).

```yaml
middleware:
  - token_auth
options:
  token_auth.store: "app:tokens"
```

| Option | Standard | Beschreibung |
|--------|----------|--------------|
| `token_auth.store` | erforderlich | Token-Store-Registry-ID |
| `token_auth.header.name` | `Authorization` | Header-Name |
| `token_auth.header.prefix` | `Bearer ` | Header-Präfix |
| `token_auth.query.param` | `x-auth-token` | Query-Parameter-Fallback |
| `token_auth.cookie.name` | `x-auth-token` | Cookie-Fallback |

Setzt Actor und Sicherheits-Scope im Kontext für nachgelagerte Middleware. Blockiert keine Anfragen - Autorisierung erfolgt in Firewall-Middleware.

---

### Metriken {#metrics}

<note>Pre-Handler</note>

HTTP-Metriken im Prometheus-Stil. Diese Middleware wird nur registriert, wenn ein Metrik-Collector verfügbar ist, und besitzt keine Konfigurationsoptionen.

```yaml
middleware:
  - metrics
```

| Metrik | Typ | Beschreibung |
|--------|-----|--------------|
| `wippy_http_requests_total` | Counter | Gesamte Anfragen |
| `wippy_http_request_duration_seconds` | Histogram | Request-Latenz |
| `wippy_http_requests_in_flight` | Gauge | Gleichzeitige Anfragen |

---

### Endpoint-Firewall {#endpoint_firewall}

<warning>Post-Match</warning>

Autorisierung anhand des abgeglichenen Endpunkts. Sie erfordert einen Actor und Sicherheits-Scope im Request-Kontext; `token_auth` ist eine Möglichkeit, beide bereitzustellen.

```yaml
post_middleware:
  - endpoint_firewall
post_options:
  endpoint_firewall.action: "access"
```

| Option | Standard | Beschreibung |
|--------|----------|--------------|
| `endpoint_firewall.action` | `access` | Zu prüfende Berechtigungs-Aktion |

Gibt `401 Unauthorized` (kein Actor) oder `403 Forbidden` (Berechtigung verweigert) zurück.

---

### Resource-Firewall {#resource_firewall}

<warning>Post-Match</warning>

Bestimmte Ressourcen nach ID schützen. Nützlich auf Router-Ebene.

```yaml
post_middleware:
  - resource_firewall
post_options:
  resource_firewall.action: "admin"
  resource_firewall.target: "app:admin-panel"
```

| Option | Standard | Beschreibung |
|--------|----------|--------------|
| `resource_firewall.action` | `access` | Berechtigungs-Aktion |
| `resource_firewall.target` | erforderlich | Ressourcen-Registry-ID |

---

### Sendfile {#sendfile}

<note>Pre-Handler</note>

Dateien über `X-Sendfile`-Header von Handlern bereitstellen.

```yaml
middleware:
  - sendfile
options:
  sendfile.fs: "app:downloads"
```

Handler setzt Header um Datei-Bereitstellung auszulösen:

| Header | Beschreibung |
|--------|--------------|
| `X-Sendfile` | Dateipfad innerhalb des Dateisystems |
| `X-File-Name` | Download-Dateiname |

Unterstützt Range-Requests für fortsetzbare Downloads.

---

### WebSocket-Relay {#websocket_relay}

<warning>Post-Match</warning>

WebSocket-Verbindungen an Prozesse weiterleiten. Siehe [WebSocket-Relay](./websocket-relay.md).

```yaml
post_middleware:
  - websocket_relay
post_options:
  wsrelay.allowed.origins: "https://app.example.com"
```

---

### SSE-Relay {#sse_relay}

<warning>Post-match</warning>

Server-Sent Events von Prozessen streamen. Siehe [Server-Sent Events](./sse.md).

```yaml
post_middleware:
  - sse_relay
post_options:
  sserelay.allowed.origins: "https://app.example.com"
```

---

### OpenTelemetry {#otel}

<note>Pre-Handler</note>

Zeichnet OpenTelemetry-Spans und -Metriken für eingehende Anfragen auf. Wird automatisch registriert, wenn OTel aktiviert ist; andernfalls ist sie wirkungslos.

```yaml
middleware:
  - otel
```

Nimmt keine Optionen entgegen. Funktioniert zusammen mit der `metrics`-Middleware; aktivieren Sie beide, wenn Sie Prometheus-Counter und OTel-Traces benötigen.

---

## Middleware-Reihenfolge

Bei Anfragen läuft Middleware in der aufgeführten Reihenfolge; die Response-Verarbeitung wird in umgekehrter Reihenfolge abgewickelt. Empfohlene Sequenz:

```yaml
middleware:
  - real_ip       # 1. Extract real IP first
  - cors          # 2. Handle CORS preflight
  - compress      # 3. Set up response compression
  - ratelimit     # 4. Check rate limits
  - metrics       # 5. Record metrics
  - token_auth    # 6. Authenticate requests

post_middleware:
  - endpoint_firewall  # Authorize after route match
```

## Siehe auch

- [Routing](./router.md) – Router-Konfiguration
- [Sicherheit](../system/security.md) – Token-Stores und Richtlinien
- [WebSocket-Relay](./websocket-relay.md) – WebSocket-Verarbeitung
- [Server-Sent Events](./sse.md) – SSE-Streaming
- [Terminal](../system/terminal.md) – Terminaldienst
