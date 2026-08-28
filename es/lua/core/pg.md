---
title: "Grupos de procesos"
description: "Administra grupos de procesos en todo el clúster, sus miembros, las difusiones y las suscripciones a cambios de membresía."
---

# Grupos de procesos
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="permissions"/>

Los grupos de procesos organizan procesos bajo nombres dinámicos y difunden mensajes a sus miembros en todo el clúster. Un proceso puede unirse a varios grupos y la membresía en todo el clúster es eventualmente consistente.

Esta es una referencia de API. Sus fragmentos presuponen un `pg.scope` existente, una entrada ejecutable que se ejecuta con contexto de proceso y políticas que autorizan las operaciones documentadas. Los bloques muestran llamadas individuales o flujos parciales de suscripción, no una aplicación independiente.

Para el tipo de entrada de ámbito y su configuración, consulta [Grupos de procesos](system/process-groups.md). Para el modelo de clustering general, consulta la [Guía del clúster](guides/cluster.md).

## Carga

```lua
local pg = require("pg")
```

Añade `pg` a la lista `modules:` de la entrada ejecutable antes de requerirlo.

## Apertura de un ámbito

Un grupo de procesos pertenece a un **ámbito**, representado por una entrada de registro `pg.scope`. Abre el ámbito para obtener una instancia sobre la que realizar operaciones de grupo:

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

La instancia se libera automáticamente durante la limpieza del frame de ejecución. Llama a `release()` para liberarla antes. Las demás operaciones son métodos de la instancia y usan la sintaxis `:`.

## Unión y salida

Las llamadas siguientes son formas independientes; elige la unión individual o por lotes que necesite la aplicación y acompáñala de las operaciones de salida correspondientes.

```lua
local ok, err = group:join("workers")           -- single group
if err then return nil, err end
```

```lua
local ok, err = group:join({"workers", "all"})  -- batch
if err then return nil, err end
```

```lua
local ok, err = group:leave("workers")
if err then return nil, err end
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `group` | string \| string[] | Nombre de grupo, o una lista de nombres para una operación por lote |

**Devuelve:** `boolean, error`

Un proceso puede unirse al mismo grupo varias veces y debe salir el mismo número de veces para abandonarlo por completo. En un lote, `leave` es de mejor esfuerzo y solo devuelve un error cuando el proceso no era miembro de ninguno de los grupos indicados.

**Permisos:** `pg.join` / `pg.leave` sobre cada nombre de grupo

## Listado de miembros

```lua
local members, err = group:get_members("workers")        -- all nodes
if err then return nil, err end

local local_members, err = group:get_local_members("workers")  -- this node only
if err then return nil, err end
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `group` | string | Nombre de grupo |

**Devuelve:** `string[], error` — un array de strings de PID (vacío para un grupo desconocido)

**Permisos:** `pg.get_members` / `pg.get_local_members` sobre el nombre de grupo

## Listado de grupos

```lua
local groups, err = group:which_groups()         -- all groups in the cluster
if err then return nil, err end

local local_groups, err = group:which_local_groups()  -- groups with a local member
if err then return nil, err end
```

**Devuelve:** `string[], error` — nombres de grupos que actualmente tienen al menos un miembro

**Permisos:** `pg.which_groups` / `pg.which_local_groups`

## Difusión

La difusión envía un mensaje desde el proceso llamador a todos los miembros del grupo bajo `topic`. Los miembros lo reciben con `process.listen(topic)`.

```lua
local ok, err = group:broadcast("workers", "task", {id = 42})   -- all nodes
if err then return nil, err end

ok, err = group:broadcast_local("workers", "task", {id = 42})  -- this node only
if err then return nil, err end
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `group` | string | Grupo destino |
| `topic` | string | Tema del mensaje |
| `...` | any | Cero o más valores de payload |

**Devuelve:** `boolean, error`

**Permisos:** `pg.broadcast` / `pg.broadcast_local` sobre el nombre de grupo

## Monitorización de un grupo

`monitor` se suscribe a eventos de unión y salida de un grupo y devuelve una instantánea atómica de sus miembros actuales. No puede producirse un cambio de membresía entre la instantánea y la configuración de la suscripción sin que se observe.

```lua
local sub, members, err = group:monitor("workers")
if err then
    return nil, err
end

for _, pid in ipairs(members) do
    -- current members at subscription time
end

local ch = sub:channel()
local event, open = ch:receive()  -- {kind = "member.joined" | "member.left", path = "workers", data = {...}}
if not open then
    return nil, errors.new("Process-group subscription closed")
end

sub:close()  -- unsubscribe; sub:close({flush = true}) drains queued events first
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `group` | string | Grupo a observar |

**Devuelve:** `pg.Subscription, string[], error` — la suscripción y una instantánea de los miembros actuales

**Permiso:** `pg.monitor` sobre el nombre de grupo

## Observación de todos los grupos

`events` se suscribe a cambios de membresía en todos los grupos del ámbito y devuelve una instantánea que asigna cada grupo a sus miembros.

```lua
local sub, snapshot, err = group:events()
if err then
    return nil, err
end
-- snapshot: { ["workers"] = {pid, ...}, ["all"] = {pid, ...} }

local event, open = sub:channel():receive()
if not open then
    return nil, errors.new("Process-group subscription closed")
end
sub:close()
```

**Devuelve:** `pg.Subscription, table, error`

**Permiso:** `pg.events`

### Campos de los eventos

Los eventos entregados en un canal de suscripción contienen:

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `system` | string | Siempre `"pg"` |
| `kind` | string | `"member.joined"` o `"member.left"` |
| `path` | string | El nombre del grupo |
| `data` | table | `{Group = string, PIDs = string[]}` — los miembros afectados |

Los canales de suscripción tienen búfer (capacidad 64). Si un consumidor lento llena el búfer, los eventos posteriores se conservan en orden en el buzón del proceso y se entregan cuando el consumidor vacía el canal; la suscripción se detiene en lugar de descartar eventos.

## Liberar

```lua
group:release()
```

`release` libera inmediatamente la instancia y es idempotente. Después de liberarla, cualquier otra operación de grupo devuelve un error. La limpieza también se ejecuta automáticamente al finalizar el frame de ejecución.

**Devuelve:** `boolean`

## Permisos

| Permiso | Método | Recurso |
|---------|--------|---------|
| `pg.open` | `pg.open()` | id del ámbito |
| `pg.join` | `join()` | nombre de grupo |
| `pg.leave` | `leave()` | nombre de grupo |
| `pg.get_members` | `get_members()` | nombre de grupo |
| `pg.get_local_members` | `get_local_members()` | nombre de grupo |
| `pg.which_groups` | `which_groups()` | - |
| `pg.which_local_groups` | `which_local_groups()` | - |
| `pg.broadcast` | `broadcast()` | nombre de grupo |
| `pg.broadcast_local` | `broadcast_local()` | nombre de grupo |
| `pg.monitor` | `monitor()` | nombre de grupo |
| `pg.events` | `events()` | - |

## Errores

| Condición | Clase |
|-----------|------|
| Permiso denegado | `errors.PERMISSION_DENIED` |
| Argumento faltante o vacío | `errors.INVALID` |
| Ámbito no encontrado | `errors.INTERNAL` |
| Salida de un grupo sin membresía | `errors.NOT_FOUND` |
| Instancia liberada | `errors.INVALID` |
| Se alcanzó el límite de grupos/miembros o de la cola de acciones | `errors.RATE_LIMITED` (reintentable) |
| Servicio detenido, contrapresión o circuito abierto | `errors.UNAVAILABLE` |
| La difusión agotó el tiempo de espera | `errors.TIMEOUT` (reintentable) |

Consulta [Manejo de errores](lua/core/errors.md) para trabajar con errores.

## Véase también

- [Grupos de procesos](system/process-groups.md) - Tipo de entrada de ámbito y configuración
- [Clúster](guides/cluster.md) - Membresía, nombres y modelo de clustering
- [Gestión de procesos](lua/core/process.md) - Creación y mensajería de procesos individuales
