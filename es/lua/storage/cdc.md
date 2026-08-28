---
title: "CDC"
description: "Suscríbase a flujos de captura de cambios de PostgreSQL y reciba eventos por fila."
---

# CDC
<secondary-label ref="storage"/>
<secondary-label ref="stream"/>
<secondary-label ref="nondeterministic"/>

El módulo `cdc` se suscribe a flujos de captura de cambios de PostgreSQL procedentes de fuentes [`db.cdc.postgres`](../../system/cdc.md). Enumera las fuentes configuradas, abre flujos y entrega eventos de cambio por fila mediante canales.

Esta página es una referencia de API con una receta parcial de suscripción. Sus fragmentos requieren una fuente CDC configurada y en ejecución; abrir el canal de entrega requiere además un contexto de proceso en ejecución. Los callbacks de aplicación como `handle_new_user` son marcadores que debe proporcionar quien llama.

## Carga

```lua
local cdc = require("cdc")
```

## `list_sources`

Enumera las fuentes CDC configuradas:

```lua
local sources, err = cdc.list_sources()
if err then return nil, err end
for _, s in ipairs(sources) do
    print(s.name, s.slot, s.streaming)
end
```

Cada fuente es una tabla con `name`, `slot`, `publication`, `tables`, `streaming`, `failover`, `temporary` y `snapshot`. Consulte [Fuentes CDC](../../system/cdc.md#información-de-la-fuente).

**Devuelve:** `table, error`

## `source`

Obtiene una fuente por su ID de entrada del registro o por el nombre del slot de replicación:

```lua
local info, err = cdc.source("app:pg_cdc")
if err then return nil, err end
if info == nil then
    -- no such source
end
```

**Devuelve:** `table, error` (información de la fuente o `nil` si no se encuentra)

## `stream`

Abre un flujo de cambios de una fuente. El `cdc.Stream` devuelto expone un canal que entrega eventos de cambio:

```lua
local stream, err = cdc.stream("app:pg_cdc", {
    tables = { "public.users", "public.orders" },
    ops    = { "insert", "update" },
    buffer = 128,
})
if err then return nil, err end

-- The caller owns stream until close(), release(), or task cleanup.
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `name` | string | ID de la fuente en el registro o nombre del slot de replicación |
| `opts.tables` | []string | Limita el flujo a estas tablas (omítalo para todas las tablas configuradas) |
| `opts.ops` | []string | Limita el flujo a estas operaciones: `insert`, `update`, `delete`, `truncate`, `snapshot` |
| `opts.buffer` | int | Tamaño del búfer de suscripción de la fuente (1-65536; predeterminado: 128) |

**Devuelve:** `Stream, error`

El canal de entrega de Lua tiene una capacidad fija independiente de 64. La opción `buffer` controla la suscripción a la fuente PostgreSQL, no ese canal.

## Métodos de Stream

### `channel`

Devuelve el canal que recibe los eventos de cambio. La primera llamada se suscribe a la fuente y cede la ejecución; las siguientes devuelven el mismo canal. La primera llamada puede devolver un error de suscripción. `:receive()` del canal devuelve `value, true` para un cambio o `nil, false` cuando termina el flujo:

```lua
local stream, stream_err = cdc.stream("app:pg_cdc")
if stream_err then return nil, stream_err end
local ch, subscribe_err = stream:channel()
if subscribe_err then
    stream:close()
    return nil, subscribe_err
end

while true do
    local change, ok = ch:receive()
    if not ok then break end

    if change.op == "insert" then
        handle_new_user(change.table, change.after)
    elseif change.op == "update" then
        handle_update(change.table, change.before, change.after)
    elseif change.op == "delete" then
        handle_delete(change.table, change.before)
    end
end

local _, close_err = stream:close()
if close_err then return nil, close_err end
```

`receive` es un alias de `channel`.

### `close`

Detiene la suscripción y libera el flujo. El método es idempotente y el runtime también cierra el flujo al terminar el ámbito de la tarea. `release` es un alias de `close`.

```lua
local _, err = stream:close()
if err then return nil, err end
```

## Evento de cambio

Cada mensaje recibido en el canal es una tabla de cambio:

| Campo | Descripción |
|-------|-------------|
| `op` | Operación: `insert`, `update`, `delete`, `truncate` o `snapshot` |
| `schema` | Esquema de la tabla |
| `table` | Nombre de la tabla |
| `relation` | `schema.table` |
| `before` | Estado de la fila antes del cambio (`update`, `delete`; ausente para `insert`) |
| `after` | Estado de la fila después del cambio (`insert`, `update`, `snapshot`; ausente para `delete`) |
| `source` | Nombre de la fuente |
| `lsn` | Log sequence number del cambio |
| `commit_lsn` | LSN de la transacción que hace commit (cuando corresponda) |
| `xid` | ID de la transacción (cuando corresponda) |

`before` y `after` son mapas de fila cuyas claves son nombres de columnas.

## Errores

| Condición | Tipo |
|-----------|------|
| No hay contexto Lua al crear un flujo | `errors.INTERNAL` |
| No hay PID de proceso al suscribirse por primera vez | error Lua lanzado |
| Se requiere el nombre de la fuente | `errors.INVALID` |
| Tamaño de búfer no válido | `errors.INVALID` |
| No se encuentra la fuente en la primera llamada a `channel()` / `receive()` | `errors.NOT_FOUND` |
| El inspector de fuentes no está disponible para `list_sources()` / `source()` | `errors.INTERNAL` |
| El enlace con el proceso deja de estar disponible después de la suscripción | `errors.INTERNAL` |
| La suscripción falla en la primera llamada a `channel()` / `receive()` | error estructurado dependiente de la fuente |

Consulte [Gestión de errores](../core/errors.md) para trabajar con errores.

## Véase también

- [Captura de cambios de datos](../../system/cdc.md) - Configuración de una fuente `db.cdc.postgres`
- [Canal](../core/channel.md) - Semántica de los canales
- [Base de datos](../../system/database.md) - Servicios de bases de datos SQL
