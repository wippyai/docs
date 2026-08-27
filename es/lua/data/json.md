---
title: "Codificación JSON"
description: "Codifica valores Lua como JSON, decodifica cadenas JSON y valida valores o cadenas con JSON Schema."
---

# Codificación JSON
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>
<secondary-label ref="encoding"/>

El módulo `json` codifica valores Lua como JSON, decodifica cadenas JSON y valida datos con JSON Schema.

Esta es una referencia de API. Los ejemplos de expresiones breves muestran valores devueltos correctamente; los ejemplos que consumen el resultado capturan el segundo valor opcional `error`.

## Carga

```lua
local json = require("json")
```

Añade `json` a la lista `modules:` de la entrada ejecutable antes de requerirlo.

## Codificación

### `encode`

Codifica un valor Lua como una cadena JSON:

```lua
-- Simple values
json.encode("hello")        -- '"hello"'
json.encode(42)             -- '42'
json.encode(true)           -- 'true'
json.encode(nil)            -- 'null'

-- Arrays (sequential numeric keys)
json.encode({1, 2, 3})      -- '[1,2,3]'
json.encode({"a", "b"})     -- '["a","b"]'

-- Objects (string keys)
local user = {name = "Alice", age = 30}
json.encode(user)           -- JSON object with name="Alice" and age=30; member order is unspecified

-- Nested structures
local order = {
    id = "ord-123",
    items = {
        {sku = "ABC", qty = 2},
        {sku = "XYZ", qty = 1}
    },
    total = 99.50
}
json.encode(order)
-- Structurally equivalent JSON; object-member order is unspecified
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `value` | any | Valor Lua a codificar |

**Devuelve:** `string, error`

La codificación sigue estas reglas:
- `nil` se convierte en `null`
- Las tablas vacías se convierten en `[]` (o en `{}` si se crean con claves de cadena)
- Tablas con claves 1-indexadas secuenciales se convierten en arrays
- Tablas con claves string se convierten en objetos
- Las claves numéricas y de cadena mezcladas generan un error
- Los arrays dispersos (con huecos en los índices) generan un error
- Los números Inf/NaN se convierten en `null`
- Referencias de tabla recursivas causan error
- La profundidad máxima de anidamiento es de 128 niveles

## Decodificación

### `decode`

Decodifica una cadena JSON en un valor Lua:

```lua
-- Parse object
local user, err = json.decode('{"name":"Bob","active":true}')
if err then
    return nil, err
end
print(user.name)    -- "Bob"
print(user.active)  -- true

-- Parse array
local items, items_err = json.decode('[10, 20, 30]')
if items_err then return nil, items_err end
print(items[1])     -- 10
print(#items)       -- 3

-- Parse nested data
local response, response_err = json.decode([[
{
    "status": "ok",
    "data": {
        "users": [
            {"id": 1, "name": "Alice"},
            {"id": 2, "name": "Bob"}
        ]
    }
}
]])
if response_err then return nil, response_err end
print(response.data.users[1].name)  -- "Alice"

-- Handle errors
local data, err = json.decode("not valid json")
if err then
    print(err:kind())     -- "INTERNAL"
    print(err:message())  -- parse error details
end
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `str` | string | Cadena JSON que se decodificará |

**Devuelve:** `any, error`

## Validación de esquemas

### `validate`

Valida un valor Lua con un JSON Schema:

```lua
-- Define a schema
local user_schema = {
    type = "object",
    properties = {
        name = {type = "string", minLength = 1},
        email = {type = "string", format = "email"},
        age = {type = "integer", minimum = 0, maximum = 150}
    },
    required = {"name", "email"}
}

-- Valid data passes
local valid, err = json.validate(user_schema, {
    name = "Alice",
    email = "alice@example.com",
    age = 30
})
if err then return nil, err end
print(valid)  -- true

-- Invalid data fails with details
local valid, err = json.validate(user_schema, {
    name = "",
    email = "not-an-email"
})
if not valid then
    print(err:message())  -- validation error details
end

-- Schema can also be a JSON string
local schema_json = '{"type":"number","minimum":0}'
local valid, schema_err = json.validate(schema_json, 42)
if schema_err then return nil, schema_err end
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `schema` | table or string | Definición de JSON Schema |
| `data` | any | Valor a validar |

**Devuelve:** `boolean, error`

Los esquemas se almacenan en caché por hash de contenido para mejorar el rendimiento.

### `validate_string`

Valida una cadena JSON con un esquema sin devolver primero un valor decodificado:

```lua
local schema = {
    type = "object",
    properties = {
        action = {type = "string", enum = {"create", "update", "delete"}}
    },
    required = {"action"}
}

-- Validate raw JSON from request body
local body = '{"action":"create","data":{}}'
local valid, err = json.validate_string(schema, body)
if not valid then
    return nil, errors.new({
        message = "Invalid request: " .. err:message(),
        kind = errors.INVALID
    })
end

-- Now safe to decode
local request, decode_err = json.decode(body)
if decode_err then return nil, decode_err end
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `schema` | table or string | Definición de JSON Schema |
| `json_str` | string | Cadena JSON que se validará |

**Devuelve:** `boolean, error`

## Errores

| Condición | Clase | Reintentable |
|-----------|------|--------------|
| Referencia de tabla recursiva | `errors.INTERNAL` | no |
| Array disperso (huecos en los índices) | `errors.INTERNAL` | no |
| Tipos de clave mixtos en tabla | `errors.INTERNAL` | no |
| Anidamiento excede 128 niveles | `errors.INTERNAL` | no |
| Sintaxis JSON no válida | `errors.INTERNAL` | no |
| Error al compilar el esquema | `errors.INVALID` | no |
| Error de validación | `errors.INVALID` | no |

Consulta [Manejo de errores](../core/errors.md) para trabajar con errores.
