# Grupos de Proceso
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="permissions"/>

Unir procesos en grupos con nombre y difundir a todos los miembros en el cluster. Modelado sobre `pg` de Erlang/OTP: los grupos son dinámicos, un proceso puede pertenecer a muchos grupos, y la membresía se rastrea en todo el cluster a través de gossip.

Para el tipo de entrada de ámbito y su configuración, ver [Grupos de Proceso](system/process-groups.md). Para el modelo de clustering más amplio, ver la [Guía de Cluster](guides/cluster.md).

## Carga

```lua
local pg = require("pg")
```

## Abrir un Ámbito

Un grupo de proceso reside dentro de un **ámbito** — una entrada de registro `pg.scope`. Abrirlo para obtener una instancia sobre la que operar:

```lua
local group, err = pg.open("app:pg")
if err then
    return nil, err
end
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `id` | string | ID de entrada del ámbito (formato: `"namespace:name"`) |

**Devuelve:** `pg.Instance, error`

**Permiso:** `pg.open` sobre el `id` del ámbito

La instancia se libera automáticamente cuando el proceso sale; llamar `release()` para liberarla antes. Todas las demás operaciones son métodos de la instancia, llamados con `:`.

## Unirse y Salir

```lua
local ok, err = group:join("workers")           -- un solo grupo
local ok, err = group:join({"workers", "all"})  -- lote
local ok, err = group:leave("workers")
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `group` | string \| string[] | Nombre de grupo, o una lista de nombres para una operación por lote |

**Devuelve:** `boolean, error`

Un proceso puede unirse al mismo grupo más de una vez; debe salir el mismo número de veces para abandonarlo completamente (semántica multi-join). `leave` es de mejor esfuerzo en un lote y devuelve error solo cuando el proceso no era miembro de ninguno de los grupos nombrados.

**Permisos:** `pg.join` / `pg.leave` sobre cada nombre de grupo

## Listar Miembros

```lua
local members, err = group:get_members("workers")        -- todos los nodos
local local_members, err = group:get_local_members("workers")  -- solo este nodo
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `group` | string | Nombre de grupo |

**Devuelve:** `string[], error` — un array de strings de PID (vacío para un grupo desconocido)

**Permisos:** `pg.get_members` / `pg.get_local_members` sobre el nombre de grupo

## Listar Grupos

```lua
local groups, err = group:which_groups()         -- todos los grupos en el cluster
local local_groups, err = group:which_local_groups()  -- grupos con un miembro local
```

**Devuelve:** `string[], error` — nombres de grupos que actualmente tienen al menos un miembro

**Permisos:** `pg.which_groups` / `pg.which_local_groups`

## Difusión

Enviar un mensaje a todos los miembros de un grupo. Cada miembro lo recibe bajo `topic` del proceso que llama — manejarlo con `process.listen(topic)`.

```lua
local ok, err = group:broadcast("workers", "task", {id = 42})   -- todos los nodos
local ok, err = group:broadcast_local("workers", "task", {id = 42})  -- solo este nodo
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `group` | string | Grupo destino |
| `topic` | string | Tema del mensaje |
| `...` | any | Cero o más valores de payload |

**Devuelve:** `boolean, error`

**Permisos:** `pg.broadcast` / `pg.broadcast_local` sobre el nombre de grupo

## Monitorear un Grupo

`monitor` se suscribe a eventos de unión/salida para un grupo y devuelve los miembros actuales atómicamente — ningún cambio de membresía puede deslizarse entre la instantánea y la suscripción.

```lua
local sub, members, err = group:monitor("workers")
if err then
    return nil, err
end

for _, pid in ipairs(members) do
    -- miembros actuales en el momento de la suscripción
end

local ch = sub:channel()
local event = ch:receive()  -- {kind = "member.joined" | "member.left", path = "workers", data = {...}}

sub:close()  -- desuscribirse; sub:close({flush = true}) vacía los eventos encolados primero
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `group` | string | Grupo a observar |

**Devuelve:** `pg.Subscription, string[], error` — la suscripción y una instantánea de los miembros actuales

**Permiso:** `pg.monitor` sobre el nombre de grupo

## Observar Todos los Grupos

`events` se suscribe a cambios de membresía en todos los grupos del ámbito y devuelve una instantánea de todos los grupos con sus miembros.

```lua
local sub, snapshot, err = group:events()
-- snapshot: { ["workers"] = {pid, ...}, ["all"] = {pid, ...} }

local event = sub:channel():receive()
sub:close()
```

**Devuelve:** `pg.Subscription, table, error`

**Permiso:** `pg.events`

### Campos del Evento

Los eventos entregados en un canal de suscripción contienen:

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `system` | string | Siempre `"pg"` |
| `kind` | string | `"member.joined"` o `"member.left"` |
| `path` | string | El nombre del grupo |
| `data` | table | `{Group = string, PIDs = string[]}` — los miembros afectados |

Los canales de suscripción tienen buffer (capacidad 64); si un consumidor lento llena el buffer, los eventos posteriores para esa suscripción se descartan.

## Liberar

```lua
group:release()
```

Libera la instancia inmediatamente. Idempotente; tras la liberación, cada método devuelve un error. La limpieza también se ejecuta automáticamente cuando el proceso sale.

**Devuelve:** `boolean`

## Permisos

| Permiso | Método | Recurso |
|---------|--------|---------|
| `pg.open` | `pg.open()` | id del ámbito |
| `pg.join` | `join()` | nombre de grupo |
| `pg.leave` | `leave()` | nombre de grupo |
| `pg.get_members` | `get_members()` | nombre de grupo |
| `pg.get_local_members` | `get_local_members()` | nombre de grupo |
| `pg.which_groups` | `which_groups()` | (ámbito) |
| `pg.which_local_groups` | `which_local_groups()` | (ámbito) |
| `pg.broadcast` | `broadcast()` | nombre de grupo |
| `pg.broadcast_local` | `broadcast_local()` | nombre de grupo |
| `pg.monitor` | `monitor()` | nombre de grupo |
| `pg.events` | `events()` | (ámbito) |

## Errores

| Condición | Tipo |
|-----------|------|
| Permiso denegado | `errors.PERMISSION_DENIED` |
| Argumento faltante o vacío | `errors.INVALID` |
| Ámbito no encontrado | `errors.NOT_FOUND` |
| Salir de un grupo sin membresía | `errors.INVALID` |
| Instancia liberada | `errors.INVALID` |

Consulte [Manejo de Errores](lua/core/errors.md) para trabajar con errores.

## Ver También

- [Grupos de Proceso](system/process-groups.md) - Tipo de entrada de ámbito y configuración
- [Cluster](guides/cluster.md) - Membresía y el modelo de clustering
- [Gestión de Procesos](lua/core/process.md) - Lanzamiento y mensajería de procesos individuales
