---
title: "Referencia de Configuración"
description: "Wippy se configura mediante archivos .wippy.yaml. Todas las opciones tienen valores por defecto razonables."
---

# Referencia de Configuración

Wippy se configura mediante archivos `.wippy.yaml`. Todas las opciones tienen valores por defecto razonables.

Cualquier valor a continuación puede sobrescribirse en el arranque con `wippy run --set section.path=value` (repetible, tiene prioridad sobre el archivo). Para sobrescribir *entradas* individuales del registro en lugar de estas secciones de configuración, usa la sección `override:` o `-o` — consulta [Sobrescribir entradas](guides/entry-kinds.md#overriding-entries).

## Composición de Configuración :id=config-composition

`--config` es repetible; los archivos se componen de izquierda a derecha usando el mismo esquema:

```bash
wippy run --config .wippy.yaml --config .wippy.local.yaml
```

- Los archivos posteriores sobrescriben los valores coincidentes y conservan todo lo demás.
- Cada archivo nombrado explícitamente debe existir. Sin `--config`, el `.wippy.yaml` por defecto es opcional.
- El primer archivo ancla el directorio usado para resolver rutas relativas.
- Los nombres de archivo no tienen significado reservado; nada aparte del archivo por defecto se descubre automáticamente.

La configuración se aplica en orden: composición de archivos, luego las selecciones de `--profile`, luego las sobrescrituras de `--set`. Para aplicaciones ejecutadas desde packs, los valores por defecto de runtime empaquetados se sitúan por debajo de todos estos (ver [Publicar valores por defecto del runtime](guides/publishing.md#publishing-runtime-defaults)).

## Perfiles :id=profiles

Un archivo de configuración puede declarar overlays con nombre bajo `profiles:`. Cada cuerpo de perfil refleja las secciones normales de configuración; seleccionarlo con `--profile <name>` superpone esos valores sobre la configuración base fusionada:

```yaml
version: "1.0"

vars:
  port: 8085

override:
  app:db:kind: db.sql.sqlite

disable:
  namespaces: ["legacy.**"]

profiles:
  pg:
    vars:
      port: 18085
    override:
      app:db:kind: db.sql.postgres
    disable:
      namespaces.add: ["experimental.**"]
```

```bash
wippy run --profile pg
```

- `--profile` es repetible; los perfiles se componen de izquierda a derecha, después de la composición de archivos y antes de `--set`. Un nombre desconocido es un error.
- Los valores se fusionan por hoja (el último en escribir gana). La propia sección `profiles:` se elimina de la configuración resuelta.
- La sección `disable` admite operaciones de lista dentro de perfiles — `namespaces.add`, `namespaces.remove`, `entries.add`, `entries.remove` — de modo que un perfil puede ajustar la lista base en lugar de reemplazarla.
- Las referencias `${name}` se interpolan desde la sección `vars:` fusionada. Las referencias a variables de entorno del SO no están permitidas dentro de las vars de perfil; usa `${env:NAME}` en la configuración base, resuelta al cargar el archivo.

`wippy run`, `test` y `pack` aceptan `--profile`; `install`, `update`, `lint` y `registry` también lo aceptan para perfiles de workspace (junto con `--set`). Las aplicaciones pueden distribuir perfiles dentro de packs — ver [Publicar Perfiles](guides/publishing.md#publishing-profiles).

## Logger

Controla el codificador del logger zap. Los flags de CLI (`-v`, `-c`, `-s`) sobrescriben el nivel/salida; la única opción controlada por yaml es la codificación.

| Campo | Tipo | Por defecto | Descripción |
|-------|------|---------|-------------|
| `encoding` | string | console | Codificador: `console` (humanizado) o `json` (estructurado) |

```yaml
logger:
  encoding: json
```

## Gestor de Registros

Controla el enrutamiento de registros del runtime. La salida en consola se configura mediante [flags de CLI](guides/cli.md) (`-v`, `-c`, `-s`).

| Campo | Tipo | Por defecto | Descripción |
|-------|------|---------|-------------|
| `propagate_downstream` | bool | true | Enviar registros a la salida de consola/archivo |
| `stream_to_events` | bool | false | Publicar registros al bus de eventos para acceso programático |
| `min_level` | int | -1 | Nivel mínimo: -1=debug, 0=info, 1=warn, 2=error |

```yaml
logmanager:
  propagate_downstream: true
  stream_to_events: false
  min_level: 0
```

Ver: [Módulo Logger](lua/system/logger.md)

## Profiler

Servidor HTTP de pprof de Go para perfilado de CPU/memoria. Habilitarlo con el flag `-p` o mediante configuración.

| Campo | Tipo | Por defecto | Descripción |
|-------|------|---------|-------------|
| `enabled` | bool | false | Iniciar servidor de perfilado |
| `address` | string | localhost:6060 | Dirección de escucha |
| `read_timeout` | duration | 15s | Tiempo de espera de lectura HTTP |
| `write_timeout` | duration | 15s | Tiempo de espera de escritura HTTP |
| `idle_timeout` | duration | 60s | Tiempo de espera de keep-alive |

```yaml
profiler:
  enabled: true
  address: "localhost:6060"
```

Acceso en `http://localhost:6060/debug/pprof/`

## Seguridad

Comportamiento de seguridad global. Las políticas individuales se definen como [entradas security.policy](guides/entry-kinds.md).

| Campo | Tipo | Por defecto | Descripción |
|-------|------|---------|-------------|
| `strict_mode` | bool | false | Denegar acceso cuando el contexto de seguridad está incompleto |

```yaml
security:
  strict_mode: true
```

Ver: [Sistema de Seguridad](system/security.md), [Módulo de Seguridad](lua/security/security.md)

## Registro :id=registry

Almacenamiento de entradas e historial de versiones. El registro almacena todas las entradas de configuración.

| Campo | Tipo | Por defecto | Descripción |
|-------|------|---------|-------------|
| `enable_history` | bool | true | Rastrear versiones de entradas |
| `history_type` | string | memory | Almacenamiento: `memory`, `sqlite`, `postgres`, `nil` |
| `history_path` | string | .wippy/registry.db | Ruta del archivo SQLite (se usa con `history_type: sqlite`) |
| `history_dsn` | string | | DSN de Postgres (se usa con `history_type: postgres`) |
| `history_schema` | string | | Nombre de esquema de Postgres (se usa con `history_type: postgres`) |

```yaml
registry:
  history_type: sqlite
  history_path: /var/lib/wippy/registry.db
```

```yaml
registry:
  history_type: postgres
  history_dsn: ${env:WIPPY_REGISTRY_HISTORY_DSN}
  history_schema: wippy_registry
```

Ver: [Concepto de Registro](concepts/registry.md), [Módulo de Registro](lua/core/registry.md)

## Relay

Enrutamiento de mensajes entre procesos a través de nodos.

| Campo | Tipo | Por defecto | Descripción |
|-------|------|---------|-------------|
| `node_name` | string | ID derivado por instancia | Identificador de este nodo relay (predeterminado: UUIDv5 de machine-id/hostname + directorio de trabajo; se puede sobrescribir con `WIPPY_NODE_ID` / `WIPPY_RELAY_NODE_NAME`) |

```yaml
relay:
  node_name: worker-1
```

Ver: [Modelo de Procesos](concepts/process-model.md)

## Supervisor

Gestión del ciclo de vida de servicios. Controla el buzón de control interno del supervisor utilizado para despachar eventos de ciclo de vida.

| Campo | Tipo | Por defecto | Descripción |
|-------|------|---------|-------------|
| `host.buffer_size` | int | 1024 | Capacidad del buzón de control interno |
| `host.worker_count` | int | 16 | Workers del despachador concurrentes |

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

Caché de la VM de Lua y evaluación de expresiones.

| Campo | Tipo | Por defecto | Descripción |
|-------|------|---------|-------------|
| `proto_cache_size` | int | 60000 | Caché de prototipos compilados |
| `main_cache_size` | int | 10000 | Caché del chunk principal |
| `cache.enabled` | bool | false | Persistir caché de bytecode/verificación de tipos en disco |
| `cache.dir` | string | `.wippy/cache/lua` | Ruta del directorio de caché |
| `cache.mode` | string | `readwrite` | Modo de caché: `readwrite` (predeterminado), `readonly`, `off` |
| `cache.compile.enabled` | bool | true | Persistir bytecode compilado (cuando `cache.enabled`) |
| `cache.typecheck.enabled` | bool | true | Persistir resultados de comprobación de tipos (cuando `cache.enabled`) |
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

| Campo | Tipo | Por defecto | Descripción |
|-------|------|---------|-------------|
| `query_cache_size` | int | 1000 | Resultados de consulta en caché |
| `regex_cache_size` | int | 100 | Patrones de regex compilados |

```yaml
finder:
  query_cache_size: 2000
```

## OpenTelemetry

Exportación de trazas distribuidas y métricas via OTLP.

| Campo | Tipo | Por defecto | Descripción |
|-------|------|---------|-------------|
| `enabled` | bool | false | Habilitar OTEL |
| `endpoint` | string | localhost:4318 | Endpoint OTLP |
| `protocol` | string | http/protobuf | Protocolo: grpc, http/protobuf |
| `service_name` | string | wippy-runtime | Identificador del servicio |
| `service_version` | string | | Etiqueta de versión del servicio |
| `insecure` | bool | true | Permitir conexión OTLP en texto plano |
| `sample_rate` | float | 1.0 | Muestreo de trazas (0.0-1.0) |
| `propagators` | string[] | `[tracecontext, baggage]` | Propagadores de contexto |
| `traces_enabled` | bool | true | Exportar trazas |
| `metrics_enabled` | bool | false | Exportar métricas |
| `http.enabled` | bool | true | Trazar solicitudes HTTP |
| `http.extract_headers` | bool | true | Extraer contexto de traza de cabeceras entrantes |
| `http.inject_headers` | bool | true | Inyectar contexto de traza en cabeceras salientes |
| `process.enabled` | bool | true | Trazar ciclo de vida de procesos |
| `process.trace_lifecycle` | bool | true | Emitir spans para spawn/terminate |
| `interceptor.enabled` | bool | true | Trazar llamadas a funciones |
| `interceptor.order` | int | 100 | Prioridad del interceptor |
| `queue.enabled` | bool | true | Trazar publicación/consumo de colas |
| `temporal.enabled` | bool | false | Trazar workflows de Temporal |

```yaml
otel:
  enabled: true
  endpoint: "http://jaeger:4318"
  traces_enabled: true
  process:
    trace_lifecycle: true
```

Las variables de entorno estándar de OTEL (`OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_SERVICE_NAME`, `OTEL_TRACES_SAMPLER_ARG`, `OTEL_PROPAGATORS`, `OTEL_SDK_DISABLED`) sobrescriben los campos correspondientes.

Ver: [Guía de Observabilidad](guides/observability.md)

## Apagado

Comportamiento de apagado controlado.

| Campo | Tipo | Por defecto | Descripción |
|-------|------|---------|-------------|
| `timeout` | duration | 30s | Tiempo máximo de espera para que los componentes se detengan |

```yaml
shutdown:
  timeout: 60s
```

## Métricas

Buffer interno de recolección de métricas.

| Campo | Tipo | Por defecto | Descripción |
|-------|------|---------|-------------|
| `buffer.size` | int | 10000 | Capacidad del buffer de métricas |
| `interceptor.enabled` | bool | false | Rastrear automáticamente llamadas a funciones |

```yaml
metrics:
  buffer:
    size: 20000
  interceptor:
    enabled: true
```

Ver: [Módulo de Métricas](lua/system/metrics.md), [Guía de Observabilidad](guides/observability.md)

## Prometheus

Endpoint de métricas de Prometheus.

| Campo | Tipo | Por defecto | Descripción |
|-------|------|---------|-------------|
| `enabled` | bool | false | Iniciar servidor de métricas |
| `address` | string | | Dirección de escucha; debe establecerse explícitamente cuando `enabled: true`, de lo contrario el servidor de métricas no se inicia |

```yaml
prometheus:
  enabled: true
  address: "0.0.0.0:9090"
```

Expone el endpoint `/metrics` para el scraping de Prometheus.

Ver: [Guía de Observabilidad](guides/observability.md)

## Cluster

Clustering multi-nodo: membresía por gossip más un núcleo de consenso Raft acotado. Ver la [Guía de Cluster](guides/cluster.md) para la arquitectura y el modelo operativo; esta sección es la referencia de claves de configuración.

### Nivel superior

| Campo | Tipo | Por defecto | Descripción |
|-------|------|---------|-------------|
| `enabled` | bool | false | Habilitar clustering |
| `name` | string | hostname | Nombre del nodo; debe ser único en el cluster |
| `failure_domain` | string | | Etiqueta de zona/rack; anunciada en gossip para que los votantes se distribuyan entre dominios |

### Membresía (gossip)

Gossip SWIM via memberlist. Usado para descubrimiento de nodos, detección de fallos y diseminación de metadatos.

| Campo | Tipo | Por defecto | Descripción |
|-------|------|---------|-------------|
| `membership.bind_addr` | string | 0.0.0.0 | Dirección de enlace para gossip |
| `membership.bind_port` | int | 7946 | Puerto de enlace para gossip (TCP+UDP) |
| `membership.advertise_addr` | string | | Dirección que los peers usan para llegar a este nodo (NAT/k8s) |
| `membership.join_addrs` | string | | Pares de semilla `host:port` separados por coma |
| `membership.secret_key` | string | | Clave de cifrado para gossip codificada en Base64 (en línea) |
| `membership.secret_file` | string | | Ruta al archivo que contiene la clave de cifrado para gossip |
| `membership.gossip_interval` | duration | 500ms | Periodo de diseminación de gossip |
| `membership.push_pull_interval` | duration | 5s | Periodo de sincronización de estado completo |
| `membership.dead_node_reclaim_time` | duration | 30s | Cuándo puede reclamarse el nombre/dirección de un nodo muerto |
| `membership.probe_interval` | duration | 1s | Ciclo de sondeo de detección de fallos |
| `membership.probe_timeout` | duration | 200ms | Espera de ack por sondeo |
| `membership.tcp_timeout` | duration | 1s | Timeout del sondeo TCP de respaldo |
| `membership.suspicion_mult` | int | 3 | Multiplicador del timeout de sospecha |

Las cuatro claves de sondeo heredan los valores por defecto de red local de memberlist cuando no están definidas; auméntalas para enlaces de alta latencia (ej. `probe_interval: 2s`, `probe_timeout: 500ms`, `suspicion_mult: 5`).

### Internodo (transporte)

Malla TCP que transporta el tráfico de relay y Raft entre nodos. Raft viaja por esta malla mediante request/reply internodo; no hay un puerto Raft separado.

Cada nodo del cluster necesita su propia identidad privada internodo y un mapa de claves públicas de confianza. Configura exactamente una fuente de clave privada. Tanto los valores inline como los archivos de clave deben contener una semilla de 32 bytes o una clave de 64 bytes codificada en base64; los valores de confianza son claves públicas codificadas en base64.

| Campo | Tipo | Por defecto | Descripción |
|-------|------|---------|-------------|
| `internode.bind_addr` | string | 0.0.0.0 | Dirección de enlace de la malla |
| `internode.bind_port` | int | 0 | Puerto de la malla (0 = automático: 7950-7959, luego efímero) |
| `internode.auto_port` | bool | true | Descubrir el puerto real en el arranque, fijarlo y anunciarlo en gossip |
| `internode.advertise_addr` | string | | Endpoint de relay adicional (IP o nombre DNS) publicado para peers actualizados — para alcanzabilidad con NAT o balanceadores de carga |
| `internode.advertise_port` | int | 0 | Puerto para `advertise_addr` (0 = puerto de enlace; requiere `advertise_addr`) |
| `internode.identity_key` | string | | Semilla o clave privada Ed25519 codificada en base64; obligatoria salvo que se establezca `identity_key_file` |
| `internode.identity_key_file` | string | | Archivo que contiene una semilla o clave privada Ed25519 codificada en base64; obligatorio salvo que se establezca `identity_key` |
| `internode.trusted_peer_keys` | map | | Mapa de nombre de nodo a clave pública Ed25519 codificada en base64; debe incluir el nodo local y todos los peers |

`advertise_addr`/`advertise_port` publican un endpoint aditivo en los metadatos del nodo mientras el endpoint de enlace sigue anunciándose sin cambios, de modo que los clusters con versiones mixtas mantienen la conectividad durante una actualización progresiva.

### Raft (consenso)

Raft acotado. El estado de Raft es durable en disco por defecto, almacenado bajo `raft.data_dir` (por defecto `~/.wippy/store`); un nodo reiniciado aún se une al quórum desde sus peers. Las entradas [`store.kv.raft`](system/store.md#cluster-kv-stores) se replican a través de él. El bootstrap es dirigido por gossip (estilo Consul/Nomad `bootstrap_expect`).

| Campo | Tipo | Por defecto | Descripción |
|-------|------|---------|-------------|
| `raft.data_dir` | string | `~/.wippy/store` | Directorio para el estado de Raft durable en disco y los snapshots durables de CRDT (bajo `<data_dir>/_sys/`). Sin disco solo cuando no se resuelve ninguna ruta (sin directorio home y ninguna establecida) |
| `raft.enabled` | bool | true | Ejecutar un nodo Raft; `false` convierte este nodo en un cliente solo-gossip |
| `raft.role` | string | server | `server` ejecuta un nodo Raft; `client` es solo-gossip |
| `raft.eligible` | bool | true | Si este nodo puede ser seleccionado como votante |
| `raft.priority` | int | 100 | Prioridad de selección de votante (valor menor es preferido) |
| `raft.bootstrap_expect` | int | 1 | Tamaño inicial del quórum: `0`=unirse a uno existente, `1`=nodo único, `N`=esperar N peers elegibles para formar quórum |
| `raft.max_voters` | int | 5 | Límite de votantes (debe ser impar); hasta `max_standbys` nodos elegibles adicionales se convierten en standbys y el resto permanece como clients |
| `raft.max_standbys` | int | 4 | Miembros no votantes mantenidos en espera para promoción; los nodos más allá de voters+standbys no son miembros Raft |
| `raft.reconcile_debounce` | duration | 2s | Ventana de consolidación tras un evento de gossip antes de que se ejecute el reconciliador de votantes |
| `raft.reconcile_timeout` | duration | 2s | Límite por pasada de reconciliación |
| `raft.heartbeat_timeout` | duration | 3s | Tiempo de espera inactivo del seguidor antes de iniciar una elección |
| `raft.election_timeout` | duration | 3s | Tiempo de espera de elección del candidato (limitado a >= heartbeat) |
| `raft.commit_timeout` | duration | 500ms | Cadencia de heartbeat del líder inactivo |
| `raft.snapshot_threshold` | uint64 | 8192 | Entradas de log desde el último snapshot antes de crear uno nuevo |
| `raft.snapshot_interval` | duration | 2m | Intervalo de verificación de snapshots |
| `raft.snapshot_retain` | int | 3 | Snapshots retenidos |
| `raft.trailing_logs` | uint64 | 10240 | Entradas de log retenidas tras un snapshot |
| `raft.max_append_entries` | int | 16 | Máximo de entradas por RPC AppendEntries |
| `raft.leader_probe_interval` | duration | 3s | Cadencia de sonda de alcanzabilidad del líder del registro global |
| `raft.leader_probe_grace` | int | 3 | Fallos consecutivos de sonda antes de declarar al líder inalcanzable |

Nodo único (desarrollo) — clustering activado, se bootstrapea inmediatamente:

```yaml
cluster:
  enabled: true
  name: dev
  internode:
    identity_key: "${env:DEV_PRIVATE_KEY}"
    trusted_peer_keys:
      dev: "${env:DEV_PUBLIC_KEY}"
  raft:
    bootstrap_expect: 1
```

Cluster de votación de tres nodos — cada nodo lista los otros como semillas y espera a los tres antes de formar quórum:

```yaml
cluster:
  enabled: true
  name: node-1
  failure_domain: us-east-1a
  membership:
    bind_port: 7946
    join_addrs: "node-2:7946,node-3:7946"
    secret_file: /etc/wippy/cluster.key
  internode:
    identity_key_file: /etc/wippy/node-1.identity
    trusted_peer_keys:
      node-1: "${env:NODE_1_PUBLIC_KEY}"
      node-2: "${env:NODE_2_PUBLIC_KEY}"
      node-3: "${env:NODE_3_PUBLIC_KEY}"
  raft:
    bootstrap_expect: 3
    max_voters: 5
```

Cliente solo-gossip — se une al cluster para naming/mensajería pero nunca ejecuta Raft:

```yaml
cluster:
  enabled: true
  name: edge-7
  membership:
    join_addrs: "node-1:7946,node-2:7946"
  internode:
    identity_key_file: /etc/wippy/edge-7.identity
    trusted_peer_keys:
      node-1: "${env:NODE_1_PUBLIC_KEY}"
      node-2: "${env:NODE_2_PUBLIC_KEY}"
      edge-7: "${env:EDGE_7_PUBLIC_KEY}"
  raft:
    role: client
```

## LSP

Servidor del Protocolo de Servidor de Lenguaje para integraciones con editores.

| Campo | Tipo | Por defecto | Descripción |
|-------|------|---------|-------------|
| `enabled` | bool | false | Habilitar el servidor TCP |
| `address` | string | :7777 | Dirección de escucha TCP |
| `http_enabled` | bool | false | Habilitar el transporte HTTP |
| `http_address` | string | :7778 | Dirección de escucha HTTP |
| `http_path` | string | /lsp | Ruta del endpoint HTTP |
| `http_allow_origin` | string | * | Origen permitido por CORS |
| `max_message_bytes` | int | 8388608 | Tamaño máximo de mensaje entrante |

```yaml
lsp:
  enabled: true
  address: ":7777"
  http_enabled: true
```

Ver: [Guía de LSP](guides/lsp.md)

## Servicio de Red

Gestor de red superpuesta (drivers SOCKS5, I2P, Tailscale).

| Campo | Tipo | Por defecto | Descripción |
|-------|------|---------|-------------|
| `state_dir` | string | .wippy/net | Directorio de almacenamiento del estado del driver |
| `default_network` | string | | ID de red por defecto aplicado cuando las entradas omiten `network` |

```yaml
network_service:
  state_dir: /var/lib/wippy/net
  default_network: app:tailscale
```

Ver: [Redes Superpuestas](system/network.md)

## Despachador HTTP

Ajuste del pool de clientes HTTP compartido utilizado por funciones despachadas HTTP y solicitudes salientes.

| Campo | Tipo | Por defecto | Descripción |
|-------|------|---------|-------------|
| `dispatcher.http.timeout` | duration | 0 (ninguno) | Tiempo de espera por solicitud |
| `dispatcher.http.max_idle_conns` | int | 0 (stdlib) | Máximo de conexiones inactivas en todos los hosts |
| `dispatcher.http.max_idle_per_host` | int | 0 (stdlib) | Máximo de conexiones inactivas por host |
| `dispatcher.http.idle_conn_timeout` | duration | 0 (stdlib) | Tiempo de espera de conexión inactiva |
| `dispatcher.http.max_clients` | int | 0 (ilimitado) | Máximo de clientes distintos en el pool |

```yaml
dispatcher:
  http:
    timeout: 30s
    max_idle_per_host: 32
```

## Módulos

Cliente del registro de módulos usado por `wippy install`/`update`.

| Campo | Tipo | Por defecto | Descripción |
|-------|------|---------|-------------|
| `registry_url` | string | https://hub.wippy.ai | Endpoint del registro |

```yaml
modules:
  registry_url: https://internal-registry.example.com
```

## Extensiones

Extensiones de plugin nativo de Go cargadas al inicio (solo Unix).

| Campo | Tipo | Por defecto | Descripción |
|-------|------|---------|-------------|
| `enabled` | bool | true | Cargar extensiones |
| `paths` | string[] | | Rutas de archivos de plugin (relativas al directorio de configuración) |

```yaml
extensions:
  enabled: true
  paths:
    - ./extensions/myplugin.so
```

## Variables de Entorno

| Variable | Descripción |
|----------|-------------|
| `GOMEMLIMIT` | Límite de memoria de fallback cuando no se establece el flag `--memory-limit` (precedencia: flag `--memory-limit` > `GOMEMLIMIT` > valor predeterminado de 1G) |

## Ver También

- [Referencia de CLI](guides/cli.md) - Opciones de línea de comandos
- [Guía de Cluster](guides/cluster.md) - Arquitectura y operaciones de clustering
- [Tipos de Entrada](guides/entry-kinds.md) - Todos los tipos de entrada
- [Guía de Observabilidad](guides/observability.md) - Registro, métricas, trazas
