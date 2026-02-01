# Sistema
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="permissions"/>

Consultar informacion del sistema en tiempo de ejecucion incluyendo uso de memoria, estadisticas de recoleccion de basura, detalles de CPU y metadatos de proceso.

## Carga

```lua
local system = require("system")
```

## Apagado

Activar apagado del sistema con codigo de salida. Util para aplicaciones de terminal; llamar desde actores en ejecucion terminara todo el sistema:

```lua
local ok, err = system.exit(0)
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `code` | integer | Codigo de salida (0 = exito), predeterminado 0 |

**Devuelve:** `boolean, error`

## Listar Modulos

Obtener todos los modulos Lua cargados con metadatos:

```lua
local mods, err = system.modules()
```

**Devuelve:** `table[], error`

Cada tabla de modulo contiene:

| Campo | Tipo | Descripcion |
|-------|------|-------------|
| `name` | string | Nombre del modulo |
| `description` | string | Descripcion del modulo |
| `class` | string[] | Tags de clasificacion del modulo |

## Estadisticas de Memoria

Obtener estadisticas detalladas de memoria:

```lua
local stats, err = system.memory.stats()
```

**Devuelve:** `table, error`

La tabla de stats contiene:

| Campo | Tipo | Descripcion |
|-------|------|-------------|
| `alloc` | number | Bytes asignados y en uso |
| `total_alloc` | number | Bytes asignados acumulativos |
| `sys` | number | Bytes obtenidos del sistema |
| `heap_alloc` | number | Bytes asignados en heap |
| `heap_sys` | number | Bytes obtenidos para heap del sistema |
| `heap_idle` | number | Bytes en spans inactivos |
| `heap_in_use` | number | Bytes en spans activos |
| `heap_released` | number | Bytes liberados al OS |
| `heap_objects` | number | Numero de objetos de heap asignados |
| `stack_in_use` | number | Bytes usados por asignador de stack |
| `stack_sys` | number | Bytes obtenidos para stack del sistema |
| `mspan_in_use` | number | Bytes de estructuras mspan en uso |
| `mspan_sys` | number | Bytes obtenidos para mspan del sistema |
| `num_gc` | number | Numero de ciclos GC completados |
| `next_gc` | number | Tamano objetivo de heap para proximo GC |

## Asignacion Actual

Obtener bytes actualmente asignados:

```lua
local bytes, err = system.memory.allocated()
```

**Devuelve:** `number, error`

## Objetos de Heap

Obtener numero de objetos de heap asignados:

```lua
local count, err = system.memory.heap_objects()
```

**Devuelve:** `number, error`

## Limite de Memoria

Establecer limite de memoria (devuelve valor anterior):

```lua
local prev, err = system.memory.set_limit(1024 * 1024 * 100)
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `limit` | integer | Limite de memoria en bytes, -1 para ilimitado |

**Devuelve:** `number, error`

Obtener limite de memoria actual:

```lua
local limit, err = system.memory.get_limit()
```

**Devuelve:** `number, error`

## Forzar GC

Forzar recoleccion de basura:

```lua
local ok, err = system.gc.collect()
```

**Devuelve:** `boolean, error`

## Porcentaje Objetivo de GC

Establecer porcentaje objetivo de GC (devuelve valor anterior). Un valor de 100 significa que GC se activa cuando el heap se duplica:

```lua
local prev, err = system.gc.set_percent(200)
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `percent` | integer | Porcentaje objetivo de GC |

**Devuelve:** `number, error`

Obtener porcentaje objetivo de GC actual:

```lua
local percent, err = system.gc.get_percent()
```

**Devuelve:** `number, error`

## Conteo de Goroutines

Obtener numero de goroutines activas:

```lua
local count, err = system.runtime.goroutines()
```

**Devuelve:** `number, error`

## GOMAXPROCS

Obtener o establecer valor de GOMAXPROCS:

```lua
-- Obtener valor actual
local current, err = system.runtime.max_procs()

-- Establecer nuevo valor
local prev, err = system.runtime.max_procs(4)
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `n` | integer | Si se proporciona, establece GOMAXPROCS (debe ser > 0) |

**Devuelve:** `number, error`

## Conteo de CPU

Obtener numero de CPUs logicas:

```lua
local cpus, err = system.runtime.cpu_count()
```

**Devuelve:** `number, error`

## ID de Proceso

Obtener ID de proceso actual:

```lua
local pid, err = system.process.pid()
```

**Devuelve:** `number, error`

## Hostname

Obtener hostname del sistema:

```lua
local hostname, err = system.process.hostname()
```

**Devuelve:** `string, error`

## Estado de Servicio

Obtener estado para un servicio supervisado especifico:

```lua
local state, err = system.supervisor.state("namespace:service")
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `service_id` | string | ID de servicio (ej., "namespace:service") |

**Devuelve:** `table, error`

La tabla de estado contiene:

| Campo | Tipo | Descripcion |
|-------|------|-------------|
| `id` | string | ID de servicio |
| `status` | string | Estado actual |
| `desired` | string | Estado deseado |
| `retry_count` | number | Numero de reintentos |
| `last_update` | number | Marca de tiempo de ultima actualizacion (nanosegundos) |
| `started_at` | number | Marca de tiempo de inicio (nanosegundos) |
| `details` | string | Detalles opcionales (formateados) |

## Todos los Estados de Servicio

Obtener estados para todos los servicios supervisados:

```lua
local states, err = system.supervisor.states()
```

**Devuelve:** `table[], error`

Cada tabla de estado tiene el mismo formato que `system.supervisor.state()`.

## Permisos

Las operaciones de sistema estan sujetas a evaluacion de politica de seguridad.

| Accion | Recurso | Descripcion |
|--------|---------|-------------|
| `system.read` | `memory` | Leer estadisticas de memoria |
| `system.read` | `memory_limit` | Leer limite de memoria |
| `system.control` | `memory_limit` | Establecer limite de memoria |
| `system.read` | `gc_percent` | Leer porcentaje de GC |
| `system.gc` | `gc` | Forzar recoleccion de basura |
| `system.gc` | `gc_percent` | Establecer porcentaje de GC |
| `system.read` | `goroutines` | Leer conteo de goroutines |
| `system.read` | `gomaxprocs` | Leer GOMAXPROCS |
| `system.control` | `gomaxprocs` | Establecer GOMAXPROCS |
| `system.read` | `cpu` | Leer conteo de CPU |
| `system.read` | `pid` | Leer ID de proceso |
| `system.read` | `hostname` | Leer hostname |
| `system.read` | `modules` | Listar modulos cargados |
| `system.read` | `supervisor` | Leer estado del supervisor |
| `system.exit` | - | Activar apagado del sistema |

## Errores

| Condicion | Tipo | Reintentable |
|-----------|------|--------------|
| Permiso denegado | `errors.PERMISSION_DENIED` | no |
| Argumento invalido | `errors.INVALID` | no |
| Argumento requerido faltante | `errors.INVALID` | no |
| Gestor de codigo no disponible | `errors.INTERNAL` | no |
| Informacion de servicio no disponible | `errors.INTERNAL` | no |
| Error de OS obteniendo hostname | `errors.INTERNAL` | no |

Consulte [Manejo de Errores](lua-errors.md) para trabajar con errores.
