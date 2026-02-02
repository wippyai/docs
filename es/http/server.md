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

| Campo | Tipo | Por Defecto | Descripción |
|-------|------|---------|-------------|
| `addr` | string | requerido | Dirección de escucha (`:8080`, `0.0.0.0:443`) |
| `timeouts.read` | duration | - | Timeout de lectura de solicitud |
| `timeouts.write` | duration | - | Timeout de escritura de respuesta |
| `timeouts.idle` | duration | - | Timeout de conexión keep-alive |
| `host.buffer_size` | int | 1024 | Tamaño de buffer del relay de mensajes |
| `host.worker_count` | int | NumCPU | Workers del relay de mensajes |

## Timeouts

Configure timeouts para prevenir agotamiento de recursos:

```yaml
timeouts:
  read: "10s"    # Tiempo máximo para leer headers de solicitud
  write: "60s"   # Tiempo máximo para escribir respuesta
  idle: "120s"   # Timeout de keep-alive
```

- `read` - Corto (5-10s) para APIs, más largo para uploads
- `write` - Coincidir con tiempo esperado de generación de respuesta
- `idle` - Balancear reutilización de conexión vs uso de recursos

<note>
Formato de duración: <code>30s</code>, <code>1m</code>, <code>2h15m</code>. Use <code>0</code> para deshabilitar.
</note>

## Configuración del Host

La sección `host` configura el relay interno de mensajes del servidor usado por componentes como WebSocket relay:

```yaml
host:
  buffer_size: 2048
  worker_count: 8
```

| Campo | Por Defecto | Descripción |
|-------|---------|-------------|
| `buffer_size` | 1024 | Capacidad de cola de mensajes por worker |
| `worker_count` | NumCPU | Goroutines de procesamiento paralelo de mensajes |

<tip>
Incremente estos valores para aplicaciones WebSocket de alto throughput. El relay de mensajes maneja la entrega asíncrona entre componentes HTTP y procesos.
</tip>

## Seguridad

Los servidores HTTP pueden tener un contexto de seguridad por defecto aplicado a través de la configuración de ciclo de vida:

```yaml
lifecycle:
  auto_start: true
  security:
    actor:
      id: "gateway-service"
    policies:
      - app:http_access_policy
```

Esto establece un actor y políticas base para todas las solicitudes. Para solicitudes autenticadas, el [middleware token_auth](http/middleware.md) sobrescribe el actor basado en el token validado, permitiendo políticas de seguridad por usuario.

## Ciclo de Vida

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
| `auto_start` | Iniciar cuando la aplicación inicia |
| `start_timeout` | Tiempo máximo para esperar que el servidor inicie |
| `stop_timeout` | Tiempo máximo para apagado graceful |
| `depends_on` | Iniciar después de que estas entradas estén listas |

## Conectando Componentes

Routers y manejadores estáticos referencian el servidor vía metadatos:

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

Ejecute servidores separados para diferentes propósitos:

```yaml
entries:
  # API Pública
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

<warning>
La terminación TLS típicamente es manejada por un proxy reverso (Nginx, Caddy, balanceador de carga). Configure su proxy para reenviar al servidor HTTP de Wippy.
</warning>

## Ver También

- [Routing](http/router.md) - Routers y endpoints
- [Archivos Estáticos](http/static.md) - Servicio de archivos estáticos
- [Middleware](http/middleware.md) - Middleware disponible
- [Seguridad](system/security.md) - Políticas de seguridad
- [WebSocket Relay](http/websocket-relay.md) - Mensajería WebSocket
