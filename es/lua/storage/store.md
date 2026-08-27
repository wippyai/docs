---
title: "Almacén clave-valor"
description: "Almacena y recupera valores con expiración opcional y escrituras condicionales."
---

# Almacén clave-valor
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>
<secondary-label ref="permissions"/>

El módulo `store` proporciona almacenamiento clave-valor con TTL opcionales. Puede contener datos en caché, sesiones y otro estado temporal.

Esta página es una referencia de API. Sus fragmentos presuponen un almacén configurado, los permisos indicados abajo y valores proporcionados por la aplicación, como `owner` o `new_value`. Los fragmentos posteriores a la adquisición usan un handle `cache` existente y activo; no son funciones independientes.

Para configurar el almacén, consulta [Almacén](../../system/store.md).

## Carga

```lua
local store = require("store")
```

## Adquisición de un almacén

Adquiere un recurso de almacén por su ID de registro:

```lua
local cache, err = store.get("app:cache")
if err then
    return nil, err
end

local _, set_err = cache:set("user:123", {name = "Alice"}, 3600)
if set_err then
    cache:release()
    return nil, set_err
end

local user, get_err = cache:get("user:123")

cache:release()
if get_err then return nil, get_err end
return user
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `id` | string | ID del recurso de almacén |

**Devuelve:** `Store, error`

## Almacenamiento de valores

Almacena un valor con un TTL opcional:

```lua
-- Simple set
local _, err = cache:set("user:123:name", "Alice")
if err then return nil, err end

-- Set with TTL (expires in 300 seconds)
local ok, ttl_err = cache:set("session:abc", {user_id = 123, role = "admin"}, 300)
if ttl_err then return nil, ttl_err end
return ok
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `key` | string | Clave |
| `value` | any | Valor (tablas, cadenas, números, booleanos) |
| `ttl` | number | TTL en segundos (opcional; 0 = sin expiración) |

**Devuelve:** `boolean, error`

## Recuperación de valores

Recupera un valor por su clave:

```lua
local errors = require("errors")

local user, err = cache:get("user:123")
if err then
    if err:kind() == errors.NOT_FOUND then
        return nil -- key missing or expired
    end
    return nil, err
end
return user
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `key` | string | Clave a recuperar |

**Devuelve:** `any, error`

El método devuelve `nil` y un error `errors.NOT_FOUND` cuando la clave no existe o ha expirado.

## Comprobación de existencia

Comprueba si una clave existe sin recuperar su valor:

```lua
local errors = require("errors")

local exists, err = cache:has("lock:" .. resource_id)
if err then return nil, err end
if exists then
    return nil, errors.new({
        message = "Resource is locked",
        kind = errors.CONFLICT
    })
end
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `key` | string | Clave a verificar |

**Devuelve:** `boolean, error`

## Eliminación de claves

Elimina una clave del almacén:

```lua
local deleted, err = cache:delete("session:" .. session_id)
if err then return nil, err end
return deleted
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `key` | string | Clave a eliminar |

**Devuelve:** `boolean, error`

El método devuelve `true` cuando elimina la clave y `false` cuando la clave no existe.

## Lectura de Metadatos de Entrada

`entry` devuelve el valor junto con su `version` — una cadena opaca usada para concurrencia optimista:

```lua
local e, err = cache:entry("user:123")
if err then return nil, err end
if e then
    print(e.key, e.value, e.version)
end
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `key` | string | Clave a leer |

**Devuelve:** `Entry, error` — `{key: string, value: any, version: string}`

## Listado de Claves

Lista entradas en orden determinista de claves, con paginación:

```lua
local page, err = cache:list({ prefix = "session:", limit = 100 })
if err then return nil, err end
for _, e in ipairs(page.items) do
    print(e.key, e.value)
end

-- next page
if page.has_more then
    local next_page, next_err = cache:list({ prefix = "session:", after = page.cursor })
    if next_err then return nil, next_err end
    page = next_page
end
```

| Opción | Tipo | Descripción |
|--------|------|-------------|
| `prefix` | string | Solo claves con este prefijo |
| `after` | string | Continuar después de este cursor (de una página anterior) |
| `limit` | integer | Máximo de elementos por página |

**Devuelve:** `Page, error` — `{items: Entry[], cursor: string, has_more: boolean}`

## Escrituras Condicionales

`put` escribe un valor y devuelve su nueva `Entry`. Las opciones habilitan concurrencia optimista:

```lua
local errors = require("errors")

-- create only if the key does not exist
local e, err = cache:put("lock:job-1", owner, { only_if_absent = true })
if err and err:kind() == errors.ALREADY_EXISTS then
    -- someone else holds it
elseif err then
    return nil, err
end

-- compare-and-set: write only if the version still matches
local cur, read_err = cache:entry("config")
if read_err then return nil, read_err end
local e2, err2 = cache:put("config", new_value, { if_version = cur.version })
if err2 and err2:kind() == errors.CONFLICT then
    -- a concurrent writer changed it; re-read and retry
elseif err2 then
    return nil, err2
end
```

| Opción | Tipo | Descripción |
|--------|------|-------------|
| `ttl` | number | TTL en segundos |
| `only_if_absent` | boolean | Escribir solo si la clave no existe |
| `if_version` | string | Escribir solo si la versión actual coincide |

`only_if_absent` e `if_version` son mutuamente exclusivos.

**Devuelve:** `Entry, error`

<warning>
Las escrituras condicionales requieren un almacén cuyo <code>info().conditional_put</code> sea true (los almacenes memory y <code>store.kv.raft</code>). En <code>store.kv.crdt</code> y <code>store.sql</code> devuelven un error <code>errors.INVALID</code> — usa <code>store.kv.raft</code> cuando necesites escrituras condicionales.
</warning>

## Capacidades del Store

`info` reporta el backend y lo que soporta, de modo que el código puede adaptarse al almacén que esté vinculado:

```lua
local info, err = cache:info()
if err then return nil, err end
-- info.backend      -> one of store.backend.* (e.g. "kv.raft")
-- info.consistency  -> one of store.consistency.* (e.g. "linearizable")
-- info.durable / info.list / info.versioned / info.conditional_put / info.ttl  (booleans)
```

**Devuelve:** `Info, error` — `{id, backend, consistency, durable, list, versioned, conditional_put, ttl}`

### Constantes

| Constante | Valores |
|----------|--------|
| `store.backend` | `MEMORY`, `SQL`, `KV_RAFT`, `KV_CRDT`, `UNKNOWN` |
| `store.consistency` | `LINEARIZABLE`, `EVENTUAL`, `LOCAL`, `UNKNOWN` |

```lua
local info, err = cache:info()
if err then return nil, err end
if info.consistency == store.consistency.LINEARIZABLE then
    -- safe to use compare-and-set
end
```

## Métodos de Store

| Método | Devuelve | Descripción |
|--------|----------|-------------|
| `get(key)` | `any, error` | Recuperar valor por clave |
| `entry(key)` | `Entry, error` | Recuperar valor con metadatos de versión |
| `set(key, value, ttl?)` | `boolean, error` | Almacenar valor con TTL opcional |
| `put(key, value, opts?)` | `Entry, error` | Escritura condicional/versionada, devuelve la nueva entrada |
| `list(opts?)` | `Page, error` | Listado paginado en orden de claves |
| `has(key)` | `boolean, error` | Verificar si clave existe |
| `delete(key)` | `boolean, error` | Eliminar clave |
| `info()` | `Info, error` | Backend, consistencia y banderas de capacidad |
| `release()` | `boolean` | Devolver el almacén al pool |

## Permisos

La evaluación de políticas de seguridad se aplica a las operaciones del almacén.

| Acción | Recurso | Atributos | Descripción |
|--------|---------|-----------|-------------|
| `store.get` | ID de Store | - | Adquirir un recurso de almacén |
| `store.info` | ID de Store | - | Inspeccionar las capacidades del almacén |
| `store.key.get` | ID de Store | `key` | Leer el valor de una clave (también `entry`) |
| `store.key.set` | ID de Store | `key` | Escribir el valor de una clave (también `put`) |
| `store.key.delete` | ID de Store | `key` | Eliminar una clave |
| `store.key.has` | ID de Store | `key` | Verificar existencia de clave |
| `store.key.list` | ID de Store | `prefix` | Listar entradas |

Las denegaciones de permisos de `store.get`, `get`, `set`, `delete` y `has` generan un error Lua. Los métodos `info`, `entry`, `list` y `put`, en cambio, devuelven un error `errors.PERMISSION_DENIED`. Concede las acciones necesarias antes de llamar a código que no pueda tolerar una denegación generada.

## Errores

Los fallos de entrada, búsqueda, backend y capacidades se devuelven como errores estructurados (usa `err:kind()`). Las denegaciones de permisos siguen el comportamiento dividido descrito arriba.

| Condición | Clase | Reintentable |
|-----------|------|--------------|
| ID de recurso vacío | `errors.INVALID` | no |
| Registro de recursos no disponible | `errors.NOT_FOUND` | no |
| Fallo al adquirir el recurso, incluido un recurso inexistente | `errors.INTERNAL` | no |
| Almacén liberado | `errors.INVALID` | no |
| Permiso denegado por `info`, `entry`, `list` o `put` | `errors.PERMISSION_DENIED` | no |
| Permiso denegado por `store.get`, `get`, `set`, `delete` o `has` | error Lua generado | no aplicable |
| `only_if_absent` y la clave existe | `errors.ALREADY_EXISTS` | no |
| Discrepancia de `if_version` | `errors.CONFLICT` | sí |
| Escritura condicional en un almacén sin soporte | `errors.INVALID` | no |

Consulta [Manejo de errores](../core/errors.md) para trabajar con errores.
