---
title: "Servidor HTTP"
description: "El servidor HTTP (http.service) escucha en un puerto y aloja routers, endpoints y manejadores de archivos estáticos."
---

# Servidor HTTP

El servidor HTTP (`http.service`) escucha en un puerto y aloja routers, endpoints y manejadores de archivos estáticos.

## Configuración

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

| Campo | Tipo | Predeterminado | Descripción |
|-------|------|----------------|-------------|
| `addr` | string | requerido | Dirección de escucha (`:8080`, `0.0.0.0:443`) |
| `timeouts.read` | duration | - | Timeout de lectura de solicitud |
| `timeouts.write` | duration | - | Timeout de escritura de respuesta |
| `timeouts.idle` | duration | - | Timeout de conexión keep-alive |
| `host.buffer_size` | int | 1024 | Tamaño del buffer del relay de mensajes |
| `host.worker_count` | int | NumCPU | Workers del relay de mensajes |
| `network` | ID de Registro | - | Vincula el listener a través de una [red overlay](system/network.md) (ej. Tailscale, I2P) |
| `tls` | object | - | Terminación TLS (ver [TLS](#tls)) |

## Timeouts

Configure timeouts para prevenir el agotamiento de recursos:

```yaml
timeouts:
  read: "10s"    # Tiempo máximo para leer headers de solicitud
  write: "60s"   # Tiempo máximo para escribir respuesta
  idle: "120s"   # Timeout keep-alive
```

- `read` - Corto (5-10s) para APIs, mayor para uploads
- `write` - Debe coincidir con el tiempo esperado de generación de respuesta
- `idle` - Balance entre reutilización de conexiones y uso de recursos

<note>
Formato de duración: <code>30s</code>, <code>1m</code>, <code>2h15m</code>. Use <code>0</code> para deshabilitar.
</note>

## Configuración de Host

La sección `host` configura el relay interno de mensajes del servidor, usado por componentes como WebSocket relay:

```yaml
host:
  buffer_size: 2048
  worker_count: 8
```

| Campo | Predeterminado | Descripción |
|-------|----------------|-------------|
| `buffer_size` | 1024 | Capacidad de cola de mensajes por worker |
| `worker_count` | NumCPU | Goroutines paralelas de procesamiento de mensajes |

<tip>
Incremente estos valores para aplicaciones WebSocket de alto throughput. El relay de mensajes maneja la entrega asíncrona entre componentes HTTP y procesos.
</tip>

## Seguridad

Los servidores HTTP pueden tener un contexto de seguridad predeterminado aplicado mediante la configuración de lifecycle:

```yaml
lifecycle:
  auto_start: true
  security:
    actor:
      id: "gateway-service"
    policies:
      - app:http_access_policy
```

Esto establece un actor y políticas base para todas las solicitudes. Para solicitudes autenticadas, el [middleware token_auth](http/middleware.md) sobrescribe el actor basándose en el token validado, permitiendo políticas de seguridad por usuario.

## Lifecycle

Los servidores son gestionados por el supervisor:

```yaml
lifecycle:
  auto_start: true
  start_timeout: 30s
  stop_timeout: 60s
  depends_on:
    - app:database
```

| Campo | Descripción |
|-------|-------------|
| `auto_start` | Iniciar cuando arranca la aplicación |
| `start_timeout` | Tiempo máximo de espera para que el servidor inicie |
| `stop_timeout` | Tiempo máximo para shutdown graceful |
| `depends_on` | Iniciar después de que estas entradas estén listas |

## Conectando Componentes

Los routers y handlers estáticos referencian al servidor via metadatos:

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

## Múltiples Servidores

Ejecute servidores separados para distintos propósitos:

```yaml
entries:
  # API pública
  - name: public
    kind: http.service
    addr: ":8080"
    lifecycle:
      auto_start: true

  # Admin (solo localhost)
  - name: admin
    kind: http.service
    addr: "127.0.0.1:9090"
    lifecycle:
      auto_start: true
```

## TLS

El servidor puede terminar TLS directamente. Configure `tls.mode` como `manual` (provea su propio certificado) o `auto` (certificado proporcionado por un driver de red overlay, ej. `network.tailscale`). Los listeners planos de clearnet no soportan `auto`. Omita `tls` o deje el mode vacío para ejecutar HTTP plano.

En modo `auto` el servidor no debe especificar `cert`/`key`/`cert_env`/`key_env` — el driver de red los provee.

### Certificado manual

Proporcione cert y key inline/cargado desde archivo o via variables de entorno (nunca ambos):

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

| Campo | Descripción |
|-------|-------------|
| `mode` | `""` (off), `auto`, o `manual` |
| `cert` / `key` | Contenido PEM (típicamente cargado via `file://`) |
| `cert_env` / `key_env` | Nombres de variables de entorno resueltas via el [registro env](system/env.md) |

### Mutual TLS (mTLS)

Bajo `mode: manual` el servidor puede además verificar certificados de cliente:

```yaml
tls:
  mode: manual
  cert_env: TLS_SERVER_CERT
  key_env:  TLS_SERVER_KEY
  client_ca: file://./certs/clients-ca.pem
  client_auth: require_and_verify
```

| Campo | Descripción |
|-------|-------------|
| `client_auth` | `request`, `require_any`, `verify_if_given`, `require_and_verify` |
| `client_ca` | Bundle PEM de CAs de cliente confiables |
| `client_ca_env` | Variable de entorno con el bundle de CA (mutuamente excluyente con `client_ca`) |

`verify_if_given` y `require_and_verify` requieren una CA. `request` y `require_any` aceptan cualquier certificado de cliente sin verificación de CA.

## Ver También

- [Routing](http/router.md) - Routers y endpoints
- [Archivos Estáticos](http/static.md) - Servicio de archivos estáticos
- [Middleware](http/middleware.md) - Middleware disponible
- [Seguridad](system/security.md) - Políticas de seguridad
- [WebSocket Relay](http/websocket-relay.md) - Mensajería WebSocket
