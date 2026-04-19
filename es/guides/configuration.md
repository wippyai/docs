# Referencia de Configuración

Wippy se configura mediante archivos `.wippy.yaml`. Todas las opciones tienen valores por defecto sensatos.

## Gestor de Logs

Controla el enrutamiento de logs del runtime. La salida de consola se configura vía [flags CLI](guides/cli.md) (`-v`, `-c`, `-s`).

| Campo | Tipo | Por Defecto | Descripción |
|-------|------|---------|-------------|
| `propagate_downstream` | bool | true | Enviar logs a salida de consola/archivo |
| `stream_to_events` | bool | false | Publicar logs al bus de eventos para acceso programático |
| `min_level` | int | -1 | Nivel mínimo: -1=debug, 0=info, 1=warn, 2=error |

```yaml
logmanager:
  propagate_downstream: true
  stream_to_events: false
  min_level: 0
```

Ver: [Módulo Logger](lua/system/logger.md)

## Profiler

Servidor HTTP de pprof de Go para perfilado de CPU/memoria. Habilitar con flag `-p` o configuración.

| Campo | Tipo | Por Defecto | Descripción |
|-------|------|---------|-------------|
| `enabled` | bool | false | Iniciar servidor de profiler |
| `address` | string | localhost:6060 | Dirección de escucha |
| `read_timeout` | duration | 15s | Timeout de lectura HTTP |
| `write_timeout` | duration | 15s | Timeout de escritura HTTP |
| `idle_timeout` | duration | 60s | Timeout de keep-alive |

```yaml
profiler:
  enabled: true
  address: "localhost:6060"
```

Acceder en `http://localhost:6060/debug/pprof/`

## Seguridad

Comportamiento de seguridad global. Las políticas individuales se definen como [entradas security.policy](guides/entry-kinds.md).

| Campo | Tipo | Por Defecto | Descripción |
|-------|------|---------|-------------|
| `strict_mode` | bool | false | Denegar acceso cuando el contexto de seguridad está incompleto |

```yaml
security:
  strict_mode: true
```

Ver: [Sistema de Seguridad](system/security.md), [Módulo Security](lua/security/security.md)

## Registro

Almacenamiento de entradas e historial de versiones. El registro contiene todas las entradas de configuración.

| Campo | Tipo | Por Defecto | Descripción |
|-------|------|---------|-------------|
| `enable_history` | bool | true | Rastrear versiones de entradas |
| `history_type` | string | memory | Almacenamiento: memory, sqlite, nil |
| `history_path` | string | .wippy/registry.db | Ruta del archivo SQLite |

```yaml
registry:
  history_type: sqlite
  history_path: /var/lib/wippy/registry.db
```

Ver: [Concepto de Registro](concepts/registry.md), [Módulo Registry](lua/core/registry.md)

## Relay

Enrutamiento de mensajes entre procesos a través de nodos.

| Campo | Tipo | Por Defecto | Descripción |
|-------|------|---------|-------------|
| `node_name` | string | local | Identificador para este nodo relay |

```yaml
relay:
  node_name: worker-1
```

Ver: [Modelo de Procesos](concepts/process-model.md)

## Supervisor

Gestión del ciclo de vida de servicios. Controla el buzón de control interno del supervisor usado para despachar eventos del ciclo de vida.

| Campo | Tipo | Por Defecto | Descripción |
|-------|------|---------|-------------|
| `host.buffer_size` | int | 1024 | Capacidad del buzón de control interno |
| `host.worker_count` | int | 16 | Workers despachadores concurrentes |

```yaml
supervisor:
  host:
    buffer_size: 2048
    worker_count: 32
```

Ver: [Guía de Supervisión](guides/supervision.md)

<note>
Los workers y colas por `process.host` se configuran en la propia entrada (`workers`, `queue_size`, `local_queue_size`), no en esta sección global. Ver el tipo de entrada [Process Host](system/process-host.md).
</note>

## Runtime de Lua

Caché de VM Lua y evaluación de expresiones.

| Campo | Tipo | Por Defecto | Descripción |
|-------|------|---------|-------------|
| `proto_cache_size` | int | 60000 | Caché de prototipos compilados |
| `main_cache_size` | int | 10000 | Caché de chunks principales |
| `cache.enabled` | bool | false | Persistir caché de bytecode/typecheck compilado en disco |
| `cache.dir` | string | (directorio de caché del sistema) | Ruta del directorio de caché |
| `cache.mode` | string | `read_write` | Modo de caché: `read_write`, `read_only`, `write_only` |
| `type_system.enabled` | bool | false | Habilitar verificación estática de tipos |
| `type_system.strict` | bool | false | Tratar advertencias de tipos como errores |

```yaml
lua:
  proto_cache_size: 60000
  cache:
    enabled: true
    dir: .cache/lua
  type_system:
    enabled: true
```

Ver: [Visión General de Lua](lua/overview.md)

## Finder

Caché de búsqueda del registro. Usado internamente para búsquedas de entradas.

| Campo | Tipo | Por Defecto | Descripción |
|-------|------|---------|-------------|
| `query_cache_size` | int | 1000 | Resultados de consultas cacheados |
| `regex_cache_size` | int | 100 | Patrones regex compilados |

```yaml
finder:
  query_cache_size: 2000
```

## OpenTelemetry

Trazado distribuido y exportación de métricas vía OTLP.

| Campo | Tipo | Por Defecto | Descripción |
|-------|------|---------|-------------|
| `enabled` | bool | false | Habilitar OTEL |
| `endpoint` | string | localhost:4318 | Endpoint OTLP |
| `protocol` | string | http/protobuf | Protocolo: grpc, http/protobuf |
| `service_name` | string | wippy | Identificador de servicio |
| `sample_rate` | float | 1.0 | Muestreo de trazas (0.0-1.0) |
| `traces_enabled` | bool | false | Exportar trazas |
| `metrics_enabled` | bool | false | Exportar métricas |
| `http.enabled` | bool | true | Trazar solicitudes HTTP |
| `process.enabled` | bool | true | Trazar ciclo de vida de procesos |
| `interceptor.enabled` | bool | false | Trazar llamadas de funciones |

```yaml
otel:
  enabled: true
  endpoint: "http://jaeger:4318"
  traces_enabled: true
  process:
    trace_lifecycle: true
```

Ver: [Guía de Observabilidad](guides/observability.md)

## Shutdown

Comportamiento de apagado graceful.

| Campo | Tipo | Por Defecto | Descripción |
|-------|------|---------|-------------|
| `timeout` | duration | 30s | Espera máxima para que los componentes se detengan |

```yaml
shutdown:
  timeout: 60s
```

## Métricas

Buffer de recolección de métricas internas.

| Campo | Tipo | Por Defecto | Descripción |
|-------|------|---------|-------------|
| `buffer.size` | int | 10000 | Capacidad del buffer de métricas |
| `interceptor.enabled` | bool | false | Auto-rastrear llamadas de funciones |

```yaml
metrics:
  buffer:
    size: 20000
  interceptor:
    enabled: true
```

Ver: [Módulo Metrics](lua/system/metrics.md), [Guía de Observabilidad](guides/observability.md)

## Prometheus

Endpoint de métricas Prometheus.

| Campo | Tipo | Por Defecto | Descripción |
|-------|------|---------|-------------|
| `enabled` | bool | false | Iniciar servidor de métricas |
| `address` | string | localhost:9090 | Dirección de escucha |

```yaml
prometheus:
  enabled: true
  address: "0.0.0.0:9090"
```

Expone endpoint `/metrics` para scraping de Prometheus.

Ver: [Guía de Observabilidad](guides/observability.md)

## Cluster

Clustering multi-nodo con descubrimiento por gossip.

| Campo | Tipo | Por Defecto | Descripción |
|-------|------|---------|-------------|
| `enabled` | bool | false | Habilitar clustering |
| `name` | string | hostname | Identificador de nodo |
| `internode.bind_addr` | string | 0.0.0.0 | Dirección de bind inter-nodo |
| `internode.bind_port` | int | 0 | Puerto (0=auto 7950-7959) |
| `membership.bind_port` | int | 7946 | Puerto de gossip |
| `membership.join_addrs` | string | | Nodos semilla (separados por coma) |
| `membership.secret_key` | string | | Clave de encriptación (base64) |
| `membership.secret_file` | string | | Ruta del archivo de clave |
| `membership.advertise_addr` | string | | Dirección pública para NAT |

```yaml
cluster:
  enabled: true
  name: node-1
  membership:
    bind_port: 7946
    join_addrs: "10.0.0.1:7946,10.0.0.2:7946"
    secret_file: /etc/wippy/cluster.key
```

## LSP

Servidor del Language Server Protocol para integraciones con editores.

| Campo | Tipo | Por Defecto | Descripción |
|-------|------|---------|-------------|
| `enabled` | bool | false | Habilitar el servidor TCP |
| `address` | string | :7777 | Dirección de escucha TCP |
| `http_enabled` | bool | false | Habilitar el transporte HTTP |
| `http_address` | string | :7778 | Dirección de escucha HTTP |
| `http_path` | string | /lsp | Ruta del endpoint HTTP |
| `http_allow_origin` | string | * | Origen permitido por CORS |
| `max_message_bytes` | int | 8388608 | Tamaño máximo del mensaje entrante |

```yaml
lsp:
  enabled: true
  address: ":7777"
  http_enabled: true
```

Ver: [Guía LSP](guides/lsp.md)

## Servicio de Red

Gestor de redes overlay (drivers SOCKS5, I2P, Tailscale).

| Campo | Tipo | Por Defecto | Descripción |
|-------|------|---------|-------------|
| `state_dir` | string | .wippy/net | Directorio de almacenamiento de estado del driver |
| `default_network` | string | | ID de red por defecto aplicado cuando las entradas omiten `network` |

```yaml
network_service:
  state_dir: /var/lib/wippy/net
  default_network: app:tailscale
```

Ver: [Overlays de Red](system/network.md)

## Módulos

Cliente del registro de módulos usado por `wippy install`/`update`.

| Campo | Tipo | Por Defecto | Descripción |
|-------|------|---------|-------------|
| `registry_url` | string | https://hub.wippy.ai | Endpoint del registro |

```yaml
modules:
  registry_url: https://internal-registry.example.com
```

## Extensiones

Extensiones nativas de plugins Go cargadas al arrancar (solo Unix).

| Campo | Tipo | Por Defecto | Descripción |
|-------|------|---------|-------------|
| `enabled` | bool | true | Cargar extensiones |
| `paths` | string[] | | Rutas de archivos de plugins (relativas al directorio de configuración) |

```yaml
extensions:
  enabled: true
  paths:
    - ./extensions/myplugin.so
```

## Variables de Entorno

| Variable | Descripción |
|----------|-------------|
| `GOMEMLIMIT` | Límite de memoria (sobrescribe flag `--memory-limit`) |

## Ver También

- [Referencia CLI](guides/cli.md) - Opciones de línea de comandos
- [Tipos de Entrada](guides/entry-kinds.md) - Todos los tipos de entrada
- [Guía de Observabilidad](guides/observability.md) - Logging, métricas, tracing
