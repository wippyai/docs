---
title: "Servidor HTTP"
description: "El servidor HTTP (http.service) escucha en un puerto y aloja routers, endpoints y manejadores de archivos estáticos."
---

# Servidor HTTP

Un `http.service` posee un listener y aloja routers, endpoints y handlers de archivos estáticos.

**Clasificación: referencia de configuración de servidor.** Los bloques son fragmentos parciales de registro salvo que definan cada red, entorno, sistema de archivos, router, certificado, actor y entrada de política referenciados.

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
| `network` | ID de Registro | - | Vincula el listener a través de una [red superpuesta](system/network.md) (p. ej., Tailscale o I2P) |
| `tls` | object | - | Terminación TLS (ver [TLS](#tls)) |

## Timeouts

Configure timeouts para prevenir el agotamiento de recursos:

```yaml
timeouts:
  read: "10s"    # Max time to read the entire request (headers + body)
  write: "60s"   # Max time to write response
  idle: "120s"   # Keep-alive timeout
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

Esto establece un actor y políticas de base para todas las solicitudes. Para las solicitudes autenticadas, el [middleware token_auth](http/middleware.md) sustituye el actor según el token validado, lo que permite políticas de seguridad por usuario.

## Lifecycle

Los servidores son gestionados por el supervisor:

```yaml
lifecycle:
  auto_start: true
  start_timeout: 30s
  stop_timeout: 60s
  requires:
    - app:database
```

| Campo | Descripción |
|-------|-------------|
| `auto_start` | Iniciar cuando arranca la aplicación |
| `start_timeout` | Tiempo máximo de espera para que el servidor inicie |
| `stop_timeout` | Tiempo máximo para el apagado ordenado |
| `requires` | Iniciar después de que estas entradas estén listas (`depends_on` es la forma heredada) |

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

El servidor puede terminar TLS directamente. Configure `tls.mode` como `manual` (provea su propio certificado) o `auto` (certificado proporcionado por un driver de red overlay, ej. `network.tailscale`). Los listeners planos de clearnet no soportan `auto`. Omita `tls` o deje el mode vacío para ejecutar HTTP plano.

En modo `auto`, el servidor no debe especificar `cert` ni `key`: el controlador de red los proporciona.

### Certificado manual

Con `mode: manual`, `cert` y `key` contienen datos PEM. Proporcione ese contenido de una de estas tres formas (elija una por campo y no las mezcle):

1. **PEM en línea** — la cadena PEM literal.
2. **Referencia `file://`** — ruta relativa al manifiesto, resuelta e insertada al cargar de forma segura frente a traversal.
3. **Referencia al registro de entorno** — obtiene el PEM de una [variable de entorno](system/env.md) registrada al decodificar, mediante un marcador `${env:NAME}`.

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

El marcador `${env:NAME}` resuelve `NAME` mediante el [registro de entorno](../system/env.md): el nombre público de una variable registrada o su ID de entrada (por ejemplo, `app.env:tls_cert`). No es una variable de entorno sin procesar del sistema operativo; solo se puede acceder a un valor del sistema operativo cuando se registra una variable respaldada por `env.storage.os` con ese nombre. Se puede proporcionar un valor predeterminado con `${env:NAME|default}`.

<note>
Los campos complementarios heredados <code>cert_env</code> y <code>key_env</code> siguen resolviéndose del mismo modo mediante el registro de entorno, pero están <b>obsoletos</b>; prefiere el marcador <code>${env:NAME}</code> mostrado arriba.
</note>

| Campo | Descripción |
|-------|-------------|
| `mode` | `""` (off), `auto`, o `manual` |
| `cert` / `key` | Contenido PEM: inline, referencia `file://` o marcador `${env:NAME}` |

### Mutual TLS (mTLS)

Bajo `mode: manual` el servidor puede además verificar certificados de cliente:

```yaml
tls:
  mode: manual
  cert: ${env:app.env:tls_cert}
  key:  ${env:app.env:tls_key}
  client_ca: file://./certs/clients-ca.pem
  client_auth: require_and_verify
```

| Campo | Descripción |
|-------|-------------|
| `client_auth` | `request`, `require_any`, `verify_if_given`, `require_and_verify` |
| `client_ca` | Bundle PEM de CAs de cliente de confianza (inline, `file://` o `${env:NAME}`) |

`client_ca` acepta las mismas tres formas que `cert` y `key` (PEM inline, `file://` o `${env:NAME}`). El campo complementario heredado `client_ca_env` también está obsoleto en favor de `client_ca: ${env:NAME}`.

`verify_if_given` y `require_and_verify` requieren una CA. `request` y `require_any` aceptan cualquier certificado de cliente sin verificación de CA.

## Véase también

- [Enrutamiento](http/router.md) - Routers y endpoints
- [Archivos estáticos](http/static.md) - Servicio de archivos estáticos
- [Middleware](http/middleware.md) - Middleware disponible
- [Seguridad](system/security.md) - Políticas de seguridad
- [Relay WebSocket](http/websocket-relay.md) - Mensajería WebSocket
