---
title: "Almacen Clave-Valor"
description: "<secondary-label ref='function'/ <secondary-label ref='process'/ <secondary-label ref='io'/ <secondary-label ref='permissions'/"
---

# Almacen Clave-Valor
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>
<secondary-label ref="permissions"/>

Almacenamiento clave-valor rapido con soporte de TTL. Ideal para cache, sesiones y estado temporal.

Para configuración del almacen, consulte [Almacen](system/store.md).

## Carga

```lua
local store = require("store")
```

## Adquirir un Almacen

Obtener un recurso de almacen por ID de registro:

```lua
local cache, err = store.get("app:cache")
if err then
    return nil, err
end

cache:set("user:123", {name = "Alice"}, 3600)
local user = cache:get("user:123")

cache:release()
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `id` | string | ID de recurso del almacen |

**Devuelve:** `Store, error`

## Almacenar Valores

Almacenar un valor con TTL opcional:

```lua
local cache = store.get("app:cache")

-- Set simple
cache:set("user:123:name", "Alice")

-- Set con TTL (expira en 300 segundos)
cache:set("session:abc", {user_id = 123, role = "admin"}, 300)
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `key` | string | Clave |
| `value` | any | Valor (tablas, strings, numeros, booleanos) |
| `ttl` | number | TTL en segundos (opcional, 0 = sin expiracion) |

**Devuelve:** `boolean, error`

## Recuperar Valores

Obtener un valor por clave:

```lua
local user = cache:get("user:123")
if not user then
    -- Clave no encontrada o expirada
end
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `key` | string | Clave a recuperar |

**Devuelve:** `any, error`

Devuelve `nil` si la clave no existe.

## Verificar Existencia

Verificar si una clave existe sin recuperar:

```lua
if cache:has("lock:" .. resource_id) then
    return nil, errors.new("CONFLICT", "Resource is locked")
end
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `key` | string | Clave a verificar |

**Devuelve:** `boolean, error`

## Eliminar Claves

Eliminar una clave del almacen:

```lua
cache:delete("session:" .. session_id)
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `key` | string | Clave a eliminar |

**Devuelve:** `boolean, error`

Devuelve `true` si se elimino, `false` si la clave no existia.

## Lectura de Metadatos de Entrada

`entry` devuelve el valor junto con su `version` — una cadena opaca usada para concurrencia optimista:

```lua
local e, err = cache:entry("user:123")
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
for _, e in ipairs(page.items) do
    print(e.key, e.value)
end

-- siguiente página
if page.has_more then
    page = cache:list({ prefix = "session:", after = page.cursor })
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
-- crear solo si la clave no existe
local e, err = cache:put("lock:job-1", owner, { only_if_absent = true })
if err and err:kind() == "ALREADY_EXISTS" then
    -- otro la tiene
end

-- compare-and-set: escribir solo si la versión aún coincide
local cur = cache:entry("config")
local e2, err2 = cache:put("config", new_value, { if_version = cur.version })
if err2 and err2:kind() == "CONFLICT" then
    -- un escritor concurrente la cambió; volver a leer y reintentar
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
local info = cache:info()
-- info.backend      -> uno de store.backend.* (p. ej. "kv.raft")
-- info.consistency  -> uno de store.consistency.* (p. ej. "linearizable")
-- info.durable / info.list / info.versioned / info.conditional_put / info.ttl  (booleanos)
```

**Devuelve:** `Info, error` — `{id, backend, consistency, durable, list, versioned, conditional_put, ttl}`

### Constantes

| Constante | Valores |
|----------|--------|
| `store.backend` | `MEMORY`, `SQL`, `KV_RAFT`, `KV_CRDT`, `UNKNOWN` |
| `store.consistency` | `LINEARIZABLE`, `EVENTUAL`, `LOCAL`, `UNKNOWN` |

```lua
if cache:info().consistency == store.consistency.LINEARIZABLE then
    -- seguro usar compare-and-set
end
```

## Metodos de Store

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
| `release()` | `boolean` | Liberar almacen de vuelta al pool |

## Permisos

Las operaciones de almacen estan sujetas a evaluacion de politica de seguridad.

| Accion | Recurso | Atributos | Descripción |
|--------|---------|-----------|-------------|
| `store.get` | ID de Store | - | Adquirir un recurso de almacen |
| `store.key.get` | ID de Store | `key` | Leer valor de una clave |
| `store.key.set` | ID de Store | `key` | Escribir valor de una clave |
| `store.key.delete` | ID de Store | `key` | Eliminar una clave |
| `store.key.has` | ID de Store | `key` | Verificar existencia de clave |

## Errores

`store.get()` y todos los métodos del manejador de store (`get`, `set`, `has`, `delete`) devuelven errores estructurados (usa `err:kind()`).

| Condición | Tipo | Reintentable |
|-----------|------|--------------|
| ID de recurso vacio | `errors.INVALID` | no |
| Recurso no encontrado | `errors.NOT_FOUND` | no |
| Almacen liberado | `errors.INVALID` | no |
| Permiso denegado | `errors.PERMISSION_DENIED` | no |
| `only_if_absent` y la clave existe | `errors.ALREADY_EXISTS` | no |
| Discrepancia de `if_version` | `errors.CONFLICT` | sí |
| Escritura condicional en un almacén sin soporte | `errors.INVALID` | no |

Consulte [Manejo de Errores](lua/core/errors.md) para trabajar con errores.
