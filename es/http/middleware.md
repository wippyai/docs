---
title: "Middleware HTTP"
description: "El middleware procesa solicitudes HTTP antes y después del manejo de rutas."
---

# Middleware HTTP

El middleware HTTP se ejecuta en una de dos cadenas del router: antes de adjuntar los metadatos del endpoint o después de que la ruta proporcione sus parámetros y el ID del endpoint.

**Clasificación: referencia de middleware.** Cada bloque YAML es un fragmento de router; presupone que el middleware indicado está registrado y que existen todas las entradas referenciadas de almacén de tokens, sistema de archivos, endpoint, actor y política.

## Cómo Funciona el Middleware

Cada middleware recibe un mapa de opciones y devuelve un wrapper de handler:

```yaml
middleware:
  - cors
  - ratelimit
options:
  cors.allow.origins: "https://example.com"
  ratelimit.requests: "100"
```

Las opciones usan notación de punto: `middleware_name.option.name`. El formato heredado con guion bajo se admite por compatibilidad con versiones anteriores.

## Pre-handler y post-match

<tip>
El middleware <b>pre-handler</b> se ejecuta después de que el servidor selecciona una ruta, pero antes de adjuntar sus metadatos, para cuestiones como CORS y compresión.
El middleware <b>post-match</b> se ejecuta después de adjuntar los metadatos de ruta, para autorizaciones que necesitan el ID del endpoint.
Ninguna cadena se ejecuta para una solicitud sin coincidencia.
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

## Middleware Disponible

### CORS {#cors}

<note>Pre-handler</note>

Cross-Origin Resource Sharing para solicitudes de navegador.

```yaml
middleware:
  - cors
options:
  cors.allow.origins: "https://app.example.com"
  cors.allow.credentials: "true"
```

| Opción | Por Defecto | Descripción |
|--------|-------------|-------------|
| `cors.allow.origins` | `*` | Orígenes permitidos (separados por coma, soporta `*.example.com`) |
| `cors.allow.methods` | `GET,POST,PUT,DELETE,OPTIONS,PATCH` | Métodos permitidos |
| `cors.allow.headers` | `Origin,Content-Type,Accept,Authorization,X-Requested-With` | Cabeceras de solicitud permitidas |
| `cors.expose.headers` | - | Cabeceras expuestas al cliente |
| `cors.allow.credentials` | `false` | Permitir cookies/auth |
| `cors.max.age` | `86400` | Caché de preflight (segundos) |
| `cors.allow.private.network` | `false` | Acceso a red privada |

Las solicitudes preflight OPTIONS son manejadas automáticamente.

---

### Rate Limiting {#ratelimit}

<note>Pre-handler</note>

Limitación de tasa con token bucket y tracking por clave.

```yaml
middleware:
  - ratelimit
options:
  ratelimit.requests: "100"
  ratelimit.window: "1m"
  ratelimit.key: "ip"
```

| Opción | Por Defecto | Descripción |
|--------|-------------|-------------|
| `ratelimit.requests` | `100` | Solicitudes por ventana |
| `ratelimit.window` | `1m` | Ventana de tiempo |
| `ratelimit.burst` | `20` | Capacidad de ráfaga |
| `ratelimit.key` | `ip` | Estrategia de clave |
| `ratelimit.cleanup_interval` | `5m` | Frecuencia de limpieza |
| `ratelimit.entry_ttl` | `10m` | Expiración de entrada |
| `ratelimit.max_entries` | `100000` | Claves máximas rastreadas |

**Estrategias de clave:** `ip`, `header:X-API-Key`, `query:api_key`

Devuelve `429 Too Many Requests` con las cabeceras `X-RateLimit-Limit` y `X-RateLimit-Window`.

---

### Compresión {#compress}

<note>Pre-handler</note>

Compresión Gzip para respuestas.

```yaml
middleware:
  - compress
options:
  compress.level: "default"
  compress.min.length: "1024"
```

| Opción | Por Defecto | Descripción |
|--------|-------------|-------------|
| `compress.level` | `default` | `fastest`, `default`, o `best` |
| `compress.min.length` | `1024` | Tamaño mínimo de respuesta (bytes) |

Solo comprime cuando el cliente envía `Accept-Encoding: gzip`.

---

### Real IP {#real_ip}

<note>Pre-handler</note>

Extrae IP del cliente de headers de proxy.

```yaml
middleware:
  - real_ip
options:
  real_ip.trusted.subnets: "10.0.0.0/8,172.16.0.0/12"
```

| Opción | Por Defecto | Descripción |
|--------|-------------|-------------|
| `real_ip.trusted.subnets` | Loopback, redes privadas RFC 1918, link-local IPv4, CGNAT, ULA IPv6 y rangos link-local IPv6 | CIDR de proxies de confianza |
| `real_ip.trust_all` | `false` | Confiar en todas las fuentes (inseguro) |

**Prioridad de header:** `True-Client-IP` > `X-Real-IP` > `X-Forwarded-For`

---

### Token Auth {#token_auth}

<note>Pre-handler</note>

Autenticación basada en token. Consulte [Seguridad](../system/security.md) para configurar el almacén de tokens.

```yaml
middleware:
  - token_auth
options:
  token_auth.store: "app:tokens"
```

| Opción | Por Defecto | Descripción |
|--------|-------------|-------------|
| `token_auth.store` | requerido | ID de registro del almacén de tokens |
| `token_auth.header.name` | `Authorization` | Nombre de header |
| `token_auth.header.prefix` | `Bearer ` | Prefijo de header |
| `token_auth.query.param` | `x-auth-token` | Parámetro de query fallback |
| `token_auth.cookie.name` | `x-auth-token` | Cookie fallback |

Establece actor y scope de seguridad en contexto para middleware downstream. No bloquea solicitudes—la autorización ocurre en middleware firewall.

---

### Metrics {#metrics}

<note>Pre-handler</note>

Métricas HTTP estilo Prometheus. Este middleware solo se registra cuando hay disponible un recolector de métricas y no admite opciones de configuración.

```yaml
middleware:
  - metrics
```

| Métrica | Tipo | Descripción |
|---------|------|-------------|
| `wippy_http_requests_total` | Counter | Total de solicitudes |
| `wippy_http_request_duration_seconds` | Histogram | Latencia de solicitud |
| `wippy_http_requests_in_flight` | Gauge | Solicitudes concurrentes |

---

### Endpoint Firewall {#endpoint_firewall}

<warning>Post-match</warning>

Autorización basada en el endpoint coincidente. Requiere un actor y un scope de seguridad en el contexto de la solicitud; `token_auth` es una forma de proporcionarlos.

```yaml
post_middleware:
  - endpoint_firewall
post_options:
  endpoint_firewall.action: "access"
```

| Opción | Por Defecto | Descripción |
|--------|-------------|-------------|
| `endpoint_firewall.action` | `access` | Acción de permiso a verificar |

Retorna `401 Unauthorized` (sin actor) o `403 Forbidden` (permiso denegado).

---

### Resource Firewall {#resource_firewall}

<warning>Post-match</warning>

Proteger recursos específicos por ID. Útil a nivel de router.

```yaml
post_middleware:
  - resource_firewall
post_options:
  resource_firewall.action: "admin"
  resource_firewall.target: "app:admin-panel"
```

| Opción | Por Defecto | Descripción |
|--------|-------------|-------------|
| `resource_firewall.action` | `access` | Acción de permiso |
| `resource_firewall.target` | requerido | ID de registro del recurso |

---

### Sendfile {#sendfile}

<note>Pre-handler</note>

Servir archivos vía header `X-Sendfile` desde handlers.

```yaml
middleware:
  - sendfile
options:
  sendfile.fs: "app:downloads"
```

El handler establece headers para activar el servicio de archivos:

| Header | Descripción |
|--------|-------------|
| `X-Sendfile` | Ruta del archivo dentro del filesystem |
| `X-File-Name` | Nombre de archivo para descarga |

Soporta solicitudes de rango para descargas reanudables.

---

### WebSocket Relay {#websocket_relay}

<warning>Post-match</warning>

Retransmite conexiones WebSocket a procesos. Consulte [WebSocket Relay](./websocket-relay.md).

```yaml
post_middleware:
  - websocket_relay
post_options:
  wsrelay.allowed.origins: "https://app.example.com"
```

---

### SSE Relay {#sse_relay}

<warning>Post-match</warning>

Transmite Server-Sent Events desde procesos. Consulte [Server-Sent Events](./sse.md).

```yaml
post_middleware:
  - sse_relay
post_options:
  sserelay.allowed.origins: "https://app.example.com"
```

---

### OpenTelemetry {#otel}

<note>Pre-handler</note>

Registra spans y métricas OpenTelemetry para solicitudes entrantes. Se registra automáticamente cuando OTel está habilitado; de lo contrario actúa como no-op.

```yaml
middleware:
  - otel
```

No acepta opciones. Funciona junto al middleware `metrics`; habilita ambos cuando necesites contadores Prometheus y trazas OTel.

---

## Orden de Middleware

En las solicitudes, el middleware se ejecuta en el orden indicado; el procesamiento de la respuesta se desenrolla en orden inverso. Secuencia recomendada:

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

## Véase también

- [Enrutamiento](./router.md) - Configuración del router
- [Seguridad](../system/security.md) - Almacenes de tokens y políticas
- [Relay WebSocket](./websocket-relay.md) - Manejo de WebSocket
- [Server-Sent Events](./sse.md) - Streaming SSE
- [Terminal](../system/terminal.md) - Servicio de terminal
