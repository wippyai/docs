# Servidor HTTP

El servidor HTTP (`http.service`) escucha en un puerto y aloja routers, endpoints y manejadores de archivos estaticos.

## Configuracion

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

| Campo | Tipo | Por Defecto | Descripcion |
|-------|------|---------|-------------|
| `addr` | string | requerido | Direccion de escucha (`:8080`, `0.0.0.0:443`) |
| `timeouts.read` | duration | - | Timeout de lectura de solicitud |
| `timeouts.write` | duration | - | Timeout de escritura de respuesta |
| `timeouts.idle` | duration | - | Timeout de conexion keep-alive |
| `host.buffer_size` | int | 1024 | Tamano de buffer del relay de mensajes |
| `host.worker_count` | int | NumCPU | Workers del relay de mensajes |

## Timeouts

Configure timeouts para prevenir agotamiento de recursos:

```yaml
timeouts:
  read: "10s"    # Tiempo maximo para leer headers de solicitud
  write: "60s"   # Tiempo maximo para escribir respuesta
  idle: "120s"   # Timeout de keep-alive
```

- `read` - Corto (5-10s) para APIs, mas largo para uploads
- `write` - Coincidir con tiempo esperado de generacion de respuesta
- `idle` - Balancear reutilizacion de conexion vs uso de recursos

<note>
Formato de duracion: <code>30s</code>, <code>1m</code>, <code>2h15m</code>. Use <code>0</code> para deshabilitar.
</note>

## Configuracion del Host

La seccion `host` configura el relay interno de mensajes del servidor usado por componentes como WebSocket relay:

```yaml
host:
  buffer_size: 2048
  worker_count: 8
```

| Campo | Por Defecto | Descripcion |
|-------|---------|-------------|
| `buffer_size` | 1024 | Capacidad de cola de mensajes por worker |
| `worker_count` | NumCPU | Goroutines de procesamiento paralelo de mensajes |

<tip>
Incremente estos valores para aplicaciones WebSocket de alto throughput. El relay de mensajes maneja la entrega asincrona entre componentes HTTP y procesos.
</tip>

## Seguridad

Los servidores HTTP pueden tener un contexto de seguridad por defecto aplicado a traves de la configuracion de ciclo de vida:

```yaml
lifecycle:
  auto_start: true
  security:
    actor:
      id: "gateway-service"
    policies:
      - app:http_access_policy
```

Esto establece un actor y politicas base para todas las solicitudes. Para solicitudes autenticadas, el [middleware token_auth](http-middleware.md) sobrescribe el actor basado en el token validado, permitiendo politicas de seguridad por usuario.

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

| Campo | Descripcion |
|-------|-------------|
| `auto_start` | Iniciar cuando la aplicacion inicia |
| `start_timeout` | Tiempo maximo para esperar que el servidor inicie |
| `stop_timeout` | Tiempo maximo para apagado graceful |
| `depends_on` | Iniciar despues de que estas entradas esten listas |

## Conectando Componentes

Routers y manejadores estaticos referencian el servidor via metadatos:

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

## Multiples Servidores

Ejecute servidores separados para diferentes propositos:

```yaml
entries:
  # API Publica
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
La terminacion TLS tipicamente es manejada por un proxy reverso (Nginx, Caddy, balanceador de carga). Configure su proxy para reenviar al servidor HTTP de Wippy.
</warning>

## Ver Tambien

- [Routing](http-router.md) - Routers y endpoints
- [Archivos Estaticos](http-static.md) - Servicio de archivos estaticos
- [Middleware](http-middleware.md) - Middleware disponible
- [Seguridad](system-security.md) - Politicas de seguridad
- [WebSocket Relay](http-websocket-relay.md) - Mensajeria WebSocket
