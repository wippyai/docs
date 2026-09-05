---
title: "CDC"
description: "<secondary-label ref='storage'/ <secondary-label ref='stream'/ <secondary-label ref='nondeterministic'/"
---

# CDC
<secondary-label ref="storage"/>
<secondary-label ref="stream"/>
<secondary-label ref="nondeterministic"/>

Suscríbase a streams de Change Data Capture desde fuentes [`db.cdc.postgres`](system/cdc.md) y [`db.cdc.sqlite`](system/cdc.md). Liste las fuentes configuradas, abra un stream y reciba eventos de cambio a nivel de fila a través de un canal. La API es neutral respecto al driver: ambos kinds retornan la misma información de fuente y los mismos eventos de cambio, y difieren solo en las [capacidades](system/cdc.md#capabilities) que publican.

## Carga

```lua
local cdc = require("cdc")
```

## list_sources

Liste las fuentes CDC configuradas que el llamante tiene permitido ver:

```lua
local sources, err = cdc.list_sources()
for _, s in ipairs(sources) do
    print(s.id, s.kind, s.state, s.capabilities.before_images)
end
```

Las fuentes sobre las que el llamante no tiene `cdc.source` se omiten en lugar de reportarse como error.

**Retorna:** `table, error`

## source

Obtenga una sola fuente por nombre (su ID de entrada):

```lua
local info, err = cdc.source("app:pg_cdc")
if info == nil then
    -- no existe tal fuente
end
```

**Retorna:** `table, error` (información de la fuente, o `nil` si no se encuentra)

## stream

Abra un stream de cambios sobre una fuente. Retorna un `cdc.Stream` cuyo canal entrega eventos de cambio:

```lua
local stream, err = cdc.stream("app:pg_cdc", {
    tables = { "public.users", "public.orders" },
    ops    = { "insert", "update" },
    buffer = 128,
})
```

| Parámetro | Tipo | Por defecto | Descripción |
|-----------|------|---------|-------------|
| `name` | string | requerido | Nombre de la fuente (ID de entrada) |
| `opts.tables` | []string | - | Filtrar a estas tablas (omitir para todas las tablas capturadas) |
| `opts.ops` | []string | - | Filtrar a estas operaciones: `insert`, `update`, `delete`, `truncate` |
| `opts.buffer` | int | 64 | Capacidad de elementos del backlog (1-65536) |
| `opts.max_bytes` | int | 1048576 | Presupuesto de bytes del backlog para este suscriptor (1 MiB) |
| `opts.snapshot` | bool | por defecto de la entrada | Solicitar el traspaso snapshot/live para este stream |
| `opts.after` | string | - | Cursor opaco de reanudación tomado del `cursor` de un evento anterior |

Las claves de opción desconocidas se rechazan con `errors.INVALID`. Los nombres de tabla se comparan sin distinguir mayúsculas contra la relación cualificada y contra el nombre de tabla desnudo. Las filas del snapshot se filtran solo por `tables`; `ops` se aplica a los cambios en vivo.

Un stream recibe un snapshot cuando `opts.snapshot` es true o cuando el campo `snapshot` de la entrada de la fuente está establecido; las filas del snapshot llegan primero con `op = "snapshot"`, y después el stream continúa hacia los cambios en vivo sin hueco. `opts.after` solo lo respetan los drivers cuya capacidad `capture_resume` está establecida — todos los drivers que se distribuyen hoy retornan `errors.INVALID` ("cdc operation is not supported by this source") para él.

Los filtros solo restringen la entrega. El acceso a una fuente lo concede el permiso `cdc.subscribe`, nunca un filtro.

**Retorna:** `Stream, error`

## Métodos de Stream

### channel

Retorna el canal que recibe los eventos de cambio. La primera llamada se suscribe a la fuente (cede el control); las llamadas siguientes retornan el mismo canal. `:receive()` bloquea hasta que llega el siguiente cambio, o retorna `nil` cuando el stream termina:

```lua
local stream = cdc.stream("app:pg_cdc")
local ch = stream:channel()

while true do
    local change = ch:receive()
    if change == nil then break end   -- stream cerrado

    if change.op == "snapshot" then
        seed_row(change.table, change.after)
    elseif change.op == "insert" then
        handle_new_user(change.table, change.after)
    elseif change.op == "update" then
        handle_update(change.table, change.before, change.after)
    elseif change.op == "delete" then
        handle_delete(change.table, change.before)
    end
end
```

El stream es perezoso: constrúyalo y luego llame a `channel()` antes de generar las escrituras que debe observar. Esto es observación en vivo, no reproducción de cambios hechos antes de la suscripción.

Cuando una fuente termina un stream con un fallo, el canal entrega un valor de error antes de cerrarse. `receive` es un alias de `channel`.

### close

Detiene la suscripción y libera el stream. Idempotente; también se cierra automáticamente al alcance de la tarea. `release` es un alias de `close`.

```lua
stream:close()
```

## Evento de Cambio

Cada mensaje recibido en el canal es una tabla de cambio:

| Campo | Descripción |
|-------|-------------|
| `op` | Operación: `insert`, `update`, `delete`, `snapshot` o `truncate` |
| `schema` | Esquema de la tabla |
| `table` | Nombre de la tabla |
| `relation` | Nombre cualificado de la relación |
| `before` | Estado de la fila antes del cambio (`update`, `delete`; requiere la capacidad `before_images`) |
| `after` | Estado de la fila después del cambio (`insert`, `update`, `snapshot`; ausente para `delete`) |
| `source` | ID de entrada de la fuente |
| `source_id` | ID de entrada de la fuente, como ID de registry |
| `generation` | Generación de la fuente que produjo el evento |
| `cursor` | Posición opaca por evento dentro de la fuente |
| `transaction` | Identificador de transacción, cuando el driver reporta uno |
| `lsn` | Número de secuencia de log del cambio (`db.cdc.postgres`) |
| `commit_lsn` | LSN de la transacción que confirma (cuando aplica) |
| `xid` | ID de transacción (cuando aplica) |
| `unchanged` | Columnas cuyo valor no fue transmitido (valores TOAST sin cambios) |
| `error` | Descripción de error reportada por el driver que viaja en el evento |

`before` y `after` son mapas de fila indexados por nombre de columna.

## Información de la Fuente

`cdc.source` y cada entrada de `cdc.list_sources` retornan el mismo registro:

| Campo | Descripción |
|-------|-------------|
| `id` | ID de entrada |
| `kind` | `db.cdc.postgres` o `db.cdc.sqlite` |
| `name` | Nombre de la fuente (el ID de entrada) |
| `state` | `unknown`, `starting`, `running`, `faulted` o `stopped` |
| `generation` | Generación actual de la fuente |
| `epoch` | Mismo valor que `generation` |
| `engine` | Nombre del motor, cuando el driver reporta uno |
| `db_resource` | ID de entrada del recurso SQL observado (`db.cdc.sqlite`) |
| `slot` | Nombre del slot de replicación (`db.cdc.postgres`) |
| `publication` | Publicación de Postgres, cuando está configurada |
| `tables` | Tablas capturadas, cuando están configuradas |
| `streaming` | Si la fuente está actualmente en ejecución |
| `failover` | Modo de slot de failover (`db.cdc.postgres`) |
| `temporary` | Slot temporal (`db.cdc.postgres`) |
| `snapshot` | Valor por defecto de snapshot a nivel de entrada |
| `faulted` | Si la fuente está en estado `faulted` |
| `error` | Último error de la fuente, cuando hay uno registrado |
| `admission` | `active`, `snapshots`, `reserved_bytes`, `rejected` |
| `capabilities` | `snapshot`, `capture_resume`, `replayable`, `captures_external_writes`, `before_images`, `coalesced` |

Ramifique según `capabilities` en lugar de según `kind`:

```lua
local info = cdc.source("app:changes")
if not info.capabilities.before_images then
    -- los eventos delete no llevan imagen de fila; mantenga su propio último estado conocido
end
```

Consulte [Fuentes CDC](system/cdc.md#source-info) para la semántica de los campos.

## Permisos

| Acción | Recurso | Descripción |
|--------|----------|-------------|
| `cdc.source` | ID de entrada de la fuente | `cdc.source`; también filtra `cdc.list_sources` |
| `cdc.subscribe` | ID de entrada de la fuente | `cdc.stream`, comprobado de nuevo cuando se establece la suscripción |

Una acción denegada retorna `errors.PERMISSION_DENIED`.

## Errores

| Condición | Kind |
|-----------|------|
| Sin contexto / sin PID de proceso | `errors.INTERNAL` |
| Se requiere el nombre de la fuente | `errors.INVALID` |
| Opción de stream inválida o desconocida | `errors.INVALID` |
| `after` sobre una fuente sin `capture_resume` | `errors.INVALID` |
| Fuente no registrada | `errors.NOT_FOUND` |
| Fuente no iniciada o siendo reemplazada | `errors.UNAVAILABLE` |
| Capacidad de suscripción agotada | `errors.UNAVAILABLE` |
| Permiso denegado | `errors.PERMISSION_DENIED` |

Consulte [Manejo de Errores](lua/core/errors.md) para trabajar con errores.

## Vea También

- [Change Data Capture](system/cdc.md) - Configuración y capacidades de las fuentes
- [Canal](lua/core/channel.md) - Semántica de los canales
- [Base de Datos](system/database.md) - Servicios de bases de datos SQL
