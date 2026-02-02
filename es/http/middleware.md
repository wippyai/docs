# Middleware HTTP

El middleware procesa solicitudes HTTP antes y después del manejo de rutas.

## Cómo Funciona el Middleware

El middleware envuelve manejadores HTTP para agregar lógica de procesamiento. Cada middleware recibe un mapa de opciones y retorna un wrapper de manejador:

```yaml
middleware:
  - cors
  - ratelimit
options:
  cors.allow.origins: "https://example.com"
  ratelimit.requests: "100"
```

Las opciones usan notación de punto: `nombre_middleware.opcion.nombre`. El formato heredado con guion bajo es soportado para compatibilidad hacia atrás.

## Pre-Match vs Post-Match

<tip>
<b>Pre-match</b> se ejecuta antes del matching de rutas—para concerns transversales como CORS y compresión.
<b>Post-match</b> se ejecuta después de que la ruta es matcheada—para autorización que necesita info de ruta.
</tip>

```yaml
middleware:        # Pre-match
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

<note>Pre-match</note>

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
| `cors.allow.headers` | `Origin,Content-Type,Accept,Authorization,X-Requested-With` | Headers de solicitud permitidos |
| `cors.expose.headers` | - | Headers expuestos al cliente |
| `cors.allow.credentials` | `false` | Permitir cookies/auth |
| `cors.max.age` | `86400` | Caché de preflight (segundos) |
| `cors.allow.private.network` | `false` | Acceso a red privada |

Las solicitudes preflight OPTIONS son manejadas automáticamente.

---

### Rate Limiting {#ratelimit}

<note>Pre-match</note>

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

Retorna `429 Too Many Requests` con headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`.

---

### Compresión {#compress}

<note>Pre-match</note>

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

<note>Pre-match</note>

Extrae IP del cliente de headers de proxy.

```yaml
middleware:
  - real_ip
options:
  real_ip.trusted.subnets: "10.0.0.0/8,172.16.0.0/12"
```

| Opción | Por Defecto | Descripción |
|--------|-------------|-------------|
| `real_ip.trusted.subnets` | Redes privadas | CIDRs de proxy confiables |
| `real_ip.trust_all` | `false` | Confiar en todas las fuentes (inseguro) |

**Prioridad de header:** `True-Client-IP` > `X-Real-IP` > `X-Forwarded-For`

---

### Token Auth {#token_auth}

<note>Pre-match</note>

Autenticación basada en token. Ver [Seguridad](system/security.md) para configuración de almacén de tokens.

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

<note>Pre-match</note>

Métricas HTTP estilo Prometheus. Sin opciones de configuración.

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

Autorización basada en endpoint matcheado. Requiere actor de `token_auth`.

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

<note>Pre-match</note>

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

Retransmite conexiones WebSocket a procesos. Ver [WebSocket Relay](http/websocket-relay.md).

```yaml
post_middleware:
  - websocket_relay
post_options:
  wsrelay.allowed.origins: "https://app.example.com"
```

---

## Orden de Middleware

El middleware se ejecuta en el orden listado. Secuencia recomendada:

```yaml
middleware:
  - real_ip       # 1. Extraer IP real primero
  - cors          # 2. Manejar preflight CORS
  - compress      # 3. Configurar compresión de respuesta
  - ratelimit     # 4. Verificar límites de tasa
  - metrics       # 5. Registrar métricas
  - token_auth    # 6. Autenticar solicitudes

post_middleware:
  - endpoint_firewall  # Autorizar después de match de ruta
```

## Ver También

- [Routing](http/router.md) - Configuración de router
- [Seguridad](system/security.md) - Almacenes de tokens y políticas
- [WebSocket Relay](http/websocket-relay.md) - Manejo de WebSocket
- [Terminal](system/terminal.md) - Servicio de terminal
