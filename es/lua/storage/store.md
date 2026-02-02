# Almacen Clave-Valor
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>
<secondary-label ref="permissions"/>

Almacenamiento clave-valor rapido con soporte de TTL. Ideal para cache, sesiones y estado temporal.

Para configuración del almacen, consulte [Almacen](system-store.md).

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

## Metodos de Store

| Método | Devuelve | Descripción |
|--------|----------|-------------|
| `get(key)` | `any, error` | Recuperar valor por clave |
| `set(key, value, ttl?)` | `boolean, error` | Almacenar valor con TTL opcional |
| `has(key)` | `boolean, error` | Verificar si clave existe |
| `delete(key)` | `boolean, error` | Eliminar clave |
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

| Condición | Tipo | Reintentable |
|-----------|------|--------------|
| ID de recurso vacio | `errors.INVALID` | no |
| Recurso no encontrado | `errors.NOT_FOUND` | no |
| Almacen liberado | `errors.INVALID` | no |
| Permiso denegado | `errors.PERMISSION_DENIED` | no |

Consulte [Manejo de Errores](lua-errors.md) para trabajar con errores.
