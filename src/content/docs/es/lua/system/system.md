---
title: "Sistema"
---

# Sistema
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="permissions"/>

Consultar información del sistema en tiempo de ejecución incluyendo uso de memoria, estadísticas de recolección de basura, detalles de CPU y metadatos de proceso.

## Carga

```lua
local system = require("system")
```

## Apagado

Desencadenar el apagado del sistema con código de salida. Útil para aplicaciones de terminal; llamar desde actores en ejecución terminará todo el sistema:

```lua
local ok, err = system.exit(0)
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `code` | integer | Código de salida (0 = éxito), por defecto 0 |

**Devuelve:** `boolean, error`

## Listar Módulos

Obtener todos los módulos Lua cargados con metadatos:

```lua
local mods, err = system.modules()
```

**Devuelve:** `table[], error`

Cada tabla de módulo contiene:

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `name` | string | Nombre del módulo |
| `description` | string | Descripción del módulo |
| `class` | string[] | Etiquetas de clasificación del módulo |

## Estadísticas de Memoria

Obtener estadísticas detalladas de memoria:

```lua
local stats, err = system.memory.stats()
```

**Devuelve:** `table, error`

La tabla de estadísticas contiene:

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `alloc` | number | Bytes asignados y en uso |
| `total_alloc` | number | Bytes asignados acumulativos |
| `sys` | number | Bytes obtenidos del sistema |
| `heap_alloc` | number | Bytes asignados en el heap |
| `heap_sys` | number | Bytes obtenidos para el heap del sistema |
| `heap_idle` | number | Bytes en spans inactivos |
| `heap_in_use` | number | Bytes en spans no inactivos |
| `heap_released` | number | Bytes liberados al SO |
| `heap_objects` | number | Número de objetos de heap asignados |
| `stack_in_use` | number | Bytes usados por el asignador de pila |
| `stack_sys` | number | Bytes obtenidos para la pila del sistema |
| `mspan_in_use` | number | Bytes de estructuras mspan en uso |
| `mspan_sys` | number | Bytes obtenidos para mspan del sistema |
| `num_gc` | number | Número de ciclos GC completados |
| `next_gc` | number | Tamaño objetivo del heap para el próximo GC |

## Asignación Actual

Obtener los bytes actualmente asignados:

```lua
local bytes, err = system.memory.allocated()
```

**Devuelve:** `number, error`

## Objetos del Heap

Obtener el número de objetos de heap asignados:

```lua
local count, err = system.memory.heap_objects()
```

**Devuelve:** `number, error`

## Límite de Memoria

Establecer el límite de memoria (devuelve el valor anterior):

```lua
local prev, err = system.memory.set_limit(1024 * 1024 * 100)
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `limit` | integer | Límite de memoria en bytes, -1 para ilimitado |

**Devuelve:** `number, error`

Obtener el límite de memoria actual:

```lua
local limit, err = system.memory.get_limit()
```

**Devuelve:** `number, error`

## Forzar GC

Forzar la recolección de basura:

```lua
local ok, err = system.gc.collect()
```

**Devuelve:** `boolean, error`

## Porcentaje Objetivo del GC

Establecer el porcentaje objetivo del GC (devuelve el valor anterior). Un valor de 100 significa que el GC se activa cuando el heap se duplica:

```lua
local prev, err = system.gc.set_percent(200)
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `percent` | integer | Porcentaje objetivo del GC |

**Devuelve:** `number, error`

Obtener el porcentaje objetivo del GC actual:

```lua
local percent, err = system.gc.get_percent()
```

**Devuelve:** `number, error`

## Recuento de Goroutines

Obtener el número de goroutines activas:

```lua
local count, err = system.runtime.goroutines()
```

**Devuelve:** `number, error`

## GOMAXPROCS

Obtener o establecer el valor de GOMAXPROCS:

```lua
-- Obtener valor actual
local current, err = system.runtime.max_procs()

-- Establecer nuevo valor
local prev, err = system.runtime.max_procs(4)
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `n` | integer | Si se proporciona, establece GOMAXPROCS (debe ser > 0) |

**Devuelve:** `number, error`

## Recuento de CPUs

Obtener el número de CPUs lógicas:

```lua
local cpus, err = system.runtime.cpu_count()
```

**Devuelve:** `number, error`

## ID de Proceso

Obtener el ID del proceso actual:

```lua
local pid, err = system.process.pid()
```

**Devuelve:** `number, error`

## Hostname

Obtener el hostname del sistema:

```lua
local hostname, err = system.process.hostname()
```

**Devuelve:** `string, error`

## Directorio de Trabajo

Obtener el directorio de trabajo actual del runtime:

```lua
local dir, err = system.process.cwd()
```

**Devuelve:** `string, error`

## Hosts de Proceso

Listar todos los hosts de proceso con estadísticas de workers y colas:

```lua
local hosts, err = system.hosts.list()
```

**Devuelve:** `table[], error`

Cada tabla de host contiene:

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | string | ID de registro del host |
| `workers` | number | Tamaño del pool de workers |
| `processes` | number | Procesos activos en este host |
| `executed` | number | Total de pasos ejecutados |
| `stolen` | number | Pasos robados de otros hosts |
| `queue_depth` | number | Elementos pendientes en la cola del host |

Listar procesos ejecutándose en un host específico:

```lua
local procs, err = system.hosts.processes("app:host")
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `host_id` | string | ID de registro del host |

**Devuelve:** `table[], error`

Cada tabla de proceso contiene:

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `pid` | string | ID del proceso |
| `host` | string | ID del host |
| `source` | string | ID de entrada de origen |
| `state` | string | Estado del proceso |
| `steps` | number | Pasos ejecutados |
| `started_at` | number | Timestamp de inicio (nanosegundos) |
| `parent` | string | PID padre (omitido si no hay) |
| `actor_id` | string | ID del actor (omitido si no hay) |
| `stats` | table | Estadísticas específicas del proceso (opcional) |

## Estado del Servicio

Obtener el estado de un servicio supervisado específico:

```lua
local state, err = system.supervisor.state("namespace:service")
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `service_id` | string | ID del servicio (ej., "namespace:service") |

**Devuelve:** `table, error`

La tabla de estado contiene:

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | string | ID del servicio |
| `status` | string | Estado actual |
| `desired` | string | Estado deseado |
| `retry_count` | number | Número de reintentos |
| `last_update` | number | Timestamp de última actualización (nanosegundos) |
| `started_at` | number | Timestamp de inicio (nanosegundos) |
| `details` | string | Detalles opcionales (formateados) |

## Todos los Estados de Servicios

Obtener los estados de todos los servicios supervisados:

```lua
local states, err = system.supervisor.states()
```

**Devuelve:** `table[], error`

Cada tabla de estado tiene el mismo formato que `system.supervisor.state()`.

## Primitivas del Cluster

Las sub-tablas `system.node`, `system.cluster`, `system.raft` y `system.lock` exponen la capa de clustering. Son más útiles cuando el [clustering está habilitado](guides/cluster.md); en un nodo independiente degradan de forma predecible — `system.raft.*` reporta "raft not available", `system.cluster` reporta solo el nodo local, y `system.lock` requiere el registro global que proporciona el clustering.

Todas las llamadas de lectura son locales y baratas: reportan la vista de este nodo del estado confirmado, sin bloquear nunca en la red.

### Identidad del nodo

`system.node` reporta la propia identidad de este nodo en el cluster.

```lua
local id, err = system.node.id()      -- ID de este nodo
local addr, err = system.node.addr()  -- dirección de red anunciada
local role, err = system.node.role()  -- "leader" | "voter" | "standby" | "non-member"
```

| Función | Devuelve | Notas |
|---------|---------|-------|
| `system.node.id()` | `string, error` | ID del nodo desde el contexto de relay |
| `system.node.addr()` | `string, error` | Dirección anunciada (ej. `10.0.0.1:7946`); error si la membresía no está disponible |
| `system.node.role()` | `string, error` | Rol Raft de este nodo; devuelve `"non-member"` (sin error) cuando Raft no está ejecutándose |

**Permiso:** `system.read` sobre `node`.

### Membresía del cluster

`system.cluster` reporta la vista a nivel de cluster: quiénes son los miembros y quién lidera.

```lua
local members, err = system.cluster.members()  -- array de tablas de nodo
local leader, err = system.cluster.leader()    -- ID del nodo líder, o "" si desconocido
local n, err = system.cluster.size()           -- recuento de miembros visibles
```

`system.cluster.members()` devuelve un array de tablas de nodo. El nodo local se incluye una vez y aparece primero.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | string | ID del nodo |
| `is_local` | boolean | True para el nodo que llama |
| `addr` | string | Dirección anunciada (omitida cuando se desconoce) |
| `meta` | table | Metadatos de gossip string-a-string (omitidos cuando no hay) |

| Función | Devuelve | Notas |
|---------|---------|-------|
| `system.cluster.members()` | `table[], error` | Error si no se puede alcanzar información de membresía |
| `system.cluster.leader()` | `string, error` | ID del líder Raft actual; `""` (sin error) cuando el líder es desconocido o Raft está ausente |
| `system.cluster.size()` | `number, error` | Recuento de miembros visibles; `0` cuando no hay info de membresía disponible |

**Permiso:** `system.read` sobre `cluster`.

### Estado de Raft

`system.raft` lee la vista local de este nodo del núcleo de consenso Raft. Cada función devuelve `nil, error` ("raft not available") cuando Raft no está ejecutándose en este nodo.

```lua
local leader, err = system.raft.is_leader()      -- boolean
local member, err = system.raft.is_member()      -- boolean: voter o standby
local role, err = system.raft.role()             -- mismos valores que system.node.role()
local term, err = system.raft.term()             -- término Raft actual
local idx, err = system.raft.commit_index()      -- índice de log confirmado más alto
local stats, err = system.raft.stats()           -- mapa de estadísticas raw (string -> string)
```

| Función | Devuelve | Notas |
|---------|---------|-------|
| `system.raft.is_leader()` | `boolean, error` | True si y solo si este nodo es el líder actual |
| `system.raft.is_member()` | `boolean, error` | True si este nodo es un voter o standby en la configuración confirmada |
| `system.raft.role()` | `string, error` | `"leader"` / `"voter"` / `"standby"` / `"non-member"` |
| `system.raft.term()` | `number, error` | Término actual; `0` si no disponible desde las estadísticas |
| `system.raft.commit_index()` | `number, error` | Índice de log confirmado más alto en este nodo |
| `system.raft.stats()` | `table, error` | Mapa de estadísticas raw completo; claves y valores son strings |

**Permiso:** `system.read` sobre `raft`, excepto `system.raft.stats()` que requiere `system.read` sobre `raft_stats`.

### Bloqueos distribuidos

`system.lock` proporciona exclusión mutua a nivel de cluster. Un bloqueo es un nombre globalmente único propiedad del proceso que llama. Está construido sobre el ámbito de nombre Strong, por lo que puede existir como máximo un titular en todo el cluster, y el bloqueo se libera automáticamente cuando el proceso titular sale o su nodo se va — no hay bloqueo atascado que limpiar.

```lua
local ok, err = system.lock.acquire("orders.migration")
if ok then
  -- sección crítica: solo un titular en todo el cluster
  system.lock.release("orders.migration")
end
```

Acquire es fail-fast: si el bloqueo ya está tomado devuelve `false` inmediatamente en lugar de bloquear, por lo que los callers implementan su propio retry y backoff. Solo el titular actual puede liberar; liberar un bloqueo que no se posee es un no-op seguro.

| Función | Devuelve | Resultados |
|---------|---------|------------|
| `system.lock.acquire(name)` | `boolean, error` | `true, nil` adquirido; `false, error` ya tomado (tipo `errors.ALREADY_EXISTS`); `nil, error` en fallo |
| `system.lock.release(name)` | `boolean, error` | `true, nil` liberado; `false, nil` no poseído o poseído por otro proceso; `nil, error` en fallo |

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `name` | string | Nombre del bloqueo a nivel de cluster |

**Permiso:** `system.lock` sobre el `name` del bloqueo (de modo que la política puede restringir qué nombres puede bloquear un caller).

## Permisos

Las operaciones del sistema están sujetas a evaluación de política de seguridad.

| Acción | Recurso | Descripción |
|--------|---------|-------------|
| `system.read` | `memory` | Leer estadísticas de memoria |
| `system.read` | `memory_limit` | Leer límite de memoria |
| `system.control` | `memory_limit` | Establecer límite de memoria |
| `system.read` | `gc_percent` | Leer porcentaje del GC |
| `system.gc` | `gc` | Forzar recolección de basura |
| `system.gc` | `gc_percent` | Establecer porcentaje del GC |
| `system.read` | `goroutines` | Leer recuento de goroutines |
| `system.read` | `gomaxprocs` | Leer GOMAXPROCS |
| `system.control` | `gomaxprocs` | Establecer GOMAXPROCS |
| `system.read` | `cpu` | Leer recuento de CPUs |
| `system.read` | `pid` | Leer ID del proceso |
| `system.read` | `hostname` | Leer hostname |
| `system.read` | `cwd` | Leer directorio de trabajo |
| `system.read` | `hosts` | Listar hosts / procesos del host |
| `system.read` | `modules` | Listar módulos cargados |
| `system.read` | `supervisor` | Leer estado del supervisor |
| `system.read` | `node` | Leer identidad de este nodo |
| `system.read` | `cluster` | Leer membresía del cluster y líder |
| `system.read` | `raft` | Leer estado de Raft |
| `system.read` | `raft_stats` | Leer el mapa de estadísticas raw de Raft |
| `system.lock` | `<nombre del bloqueo>` | Adquirir o liberar un bloqueo distribuido |
| `system.exit` | - | Desencadenar apagado del sistema |

## Errores

| Condición | Tipo | Reintentable |
|-----------|------|--------------|
| Permiso denegado | `errors.INVALID` | no |
| Argumento inválido | `errors.INVALID` | no |
| Argumento requerido faltante | `errors.INVALID` | no |
| Gestor de código no disponible | `errors.INTERNAL` | no |
| Info de servicio no disponible | `errors.INTERNAL` | no |
| Error del SO (hostname, cwd) | `errors.INTERNAL` | no |
| Raft no ejecutándose en este nodo | `errors.INTERNAL` | no |
| Membresía no disponible | `errors.INTERNAL` | no |
| Bloqueo ya tomado | `errors.ALREADY_EXISTS` | no |

Consulte [Manejo de Errores](lua/core/errors.md) para trabajar con errores.
