---
title: "Sistema"
description: "Inspecciona el estado del runtime, proceso, host, supervisor y clúster, y controla ajustes seleccionados del runtime."
---

# Sistema
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="permissions"/>

El módulo `system` informa del estado del runtime, memoria, proceso, host, supervisor y clúster. También expone controles seleccionados del runtime.

Esta es una referencia de API. La mayoría de fragmentos muestran una operación aislada; controles como el apagado, los ajustes del runtime y los locks distribuidos requieren autorización explícita de políticas y un tratamiento de errores específico de la aplicación.

## Carga

```lua
local system = require("system")
```

## Apagado

Solicita el apagado del sistema con un código de salida. Llamar a esta función desde cualquier proceso o actor termina todo el sistema:

```lua
local ok, err = system.exit(0)
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `code` | integer | Código de salida (0 = éxito), por defecto 0 |

**Devuelve:** `boolean, error`

## Listar Módulos

Lista los módulos Lua cargados y sus metadatos:

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

## Cargar fuentes de despliegue

`system.source.load()` reconstruye la línea base normalizada del registro a partir de la generación actual de fuentes de despliegue. Los owners y las entradas proceden de la misma generación, incluso durante instalación, actualización, desinstalación, reemplazo y rollback dinámicos.

```lua
local sources, err = system.source.load()
if err then
    return nil, err
end

for _, owner in ipairs(sources.owners) do
    print(owner)
end

for _, entry in ipairs(sources.entries) do
    print(entry.id)
end
```

**Devuelve:** `table, error`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `owners` | string[] | Identificadores estables de owners de fuentes; el owner de la aplicación es `application` |
| `entries` | table[] | Entradas del registro decodificadas de la línea base normalizada de fuentes |

Las entradas de normalización de módulos empaquetados no reclaman ownership y no se exponen rutas del sistema de archivos. La carga requiere `system.read` sobre `sources`. Los fallos del registro de fuentes, carga o conversión devuelven un `errors.INTERNAL` no reintentable; la denegación de permisos devuelve `errors.PERMISSION_DENIED`.

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

Obtener o establecer el valor de GOMAXPROCS mediante el selector `gomaxprocs`:

```lua
-- Get current value
local current, err = system.runtime.max_procs()

-- Set new value
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

## Primitivas del clúster

Las subtablas `system.node`, `system.cluster`, `system.raft` y `system.lock` exponen la capa de clustering. Cuando el [clustering no está habilitado](../../guides/cluster.md), `system.raft.*` informa de "raft not available", `system.cluster` solo informa del nodo local y `system.lock` no está disponible porque requiere el registro global.

Las llamadas de lectura informan de la vista local del estado confirmado de este nodo y no bloquean en la red.

### Identidad del nodo

`system.node` reporta la propia identidad de este nodo en el cluster.

```lua
local id, err = system.node.id()      -- this node's ID
local addr, err = system.node.addr()  -- advertised network address
local role, err = system.node.role()  -- "leader" | "voter" | "standby" | "non-member"
```

| Función | Devuelve | Notas |
|---------|---------|-------|
| `system.node.id()` | `string, error` | ID del nodo desde el contexto de relay |
| `system.node.addr()` | `string, error` | Dirección anunciada (ej. `10.0.0.1:7946`); error si la membresía no está disponible |
| `system.node.role()` | `string, error` | Rol Raft de este nodo; devuelve `"non-member"` (sin error) cuando Raft no está ejecutándose |

**Permiso:** `system.read` sobre `node`.

### Membresía del cluster

`system.cluster` informa de los miembros del clúster y del líder actual.

```lua
local members, err = system.cluster.members()  -- array of node tables
local leader, err = system.cluster.leader()    -- leader node ID, or "" if unknown
local n, err = system.cluster.size()           -- count of visible members
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
local member, err = system.raft.is_member()      -- boolean: voter or standby
local role, err = system.raft.role()             -- same values as system.node.role()
local term, err = system.raft.term()             -- current Raft term
local idx, err = system.raft.commit_index()      -- highest committed log index
local stats, err = system.raft.stats()           -- raw stats map (string -> string)
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

`system.lock` proporciona exclusión mutua en todo el clúster. Un lock tiene un nombre globalmente único y pertenece al proceso que llama. Usa el ámbito de nombres Strong, por lo que solo puede existir un holder en todo el clúster. El lock se libera automáticamente cuando el proceso holder termina o su nodo abandona el clúster.

```lua
local ok, err = system.lock.acquire("orders.migration")
if not ok then
  -- err has kind errors.ALREADY_EXISTS when another process holds the lock.
  -- Apply the caller's retry and backoff policy for that case if needed.
  return nil, err
end

-- critical section: only one holder cluster-wide
local released, release_err = system.lock.release("orders.migration")
if release_err then
  return nil, release_err
end
return released
```

La adquisición es fail-fast: cuando el lock ya está tomado, la llamada devuelve `false` inmediatamente en lugar de bloquear. Los callers proporcionan las políticas de retry y backoff necesarias. Solo el holder actual puede liberar un lock; un intento de liberación por otro proceso es un no-op.

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
| `system.read` | `sources` | Cargar fuentes de despliegue normalizadas |
| `system.read` | `supervisor` | Leer estado del supervisor |
| `system.read` | `node` | Leer identidad de este nodo |
| `system.read` | `cluster` | Leer membresía del cluster y líder |
| `system.read` | `raft` | Leer estado de Raft |
| `system.read` | `raft_stats` | Leer el mapa de estadísticas raw de Raft |
| `system.lock` | `<lock name>` | Adquirir o liberar un bloqueo distribuido |
| `system.exit` | - | Desencadenar apagado del sistema |

## Errores

| Condición | Tipo | Reintentable |
|-----------|------|--------------|
| Permiso denegado (carga de fuentes de despliegue) | `errors.PERMISSION_DENIED` | no |
| Permiso denegado (operaciones distintas de fuentes, salvo locks distribuidos) | `errors.INVALID` | no |
| Permiso denegado (adquirir/liberar lock distribuido) | `errors.PERMISSION_DENIED` | no |
| Argumento inválido | `errors.INVALID` | no |
| Argumento requerido faltante | `errors.INVALID` | no |
| Gestor de código no disponible | `errors.INTERNAL` | no |
| Info de servicio no disponible | `errors.INTERNAL` | no |
| Error del SO (hostname, cwd) | `errors.INTERNAL` | no |
| Raft no ejecutándose en este nodo | `errors.INTERNAL` | no |
| Membresía no disponible | `errors.INTERNAL` | no |
| Bloqueo ya tomado | `errors.ALREADY_EXISTS` | no |

Consulte [Manejo de Errores](../core/errors.md) para trabajar con errores.
