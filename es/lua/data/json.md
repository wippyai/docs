# Codificacion JSON
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>
<secondary-label ref="encoding"/>

Codificar tablas Lua a JSON y decodificar strings JSON a valores Lua. Incluye validacion de JSON Schema para verificacion de datos y cumplimiento de contratos API.

## Carga

```lua
local json = require("json")
```

## Codificacion

### Codificar Valor

Codifica un valor Lua a un string JSON.

```lua
-- Valores simples
json.encode("hello")        -- '"hello"'
json.encode(42)             -- '42'
json.encode(true)           -- 'true'
json.encode(nil)            -- 'null'

-- Arrays (claves numericas secuenciales)
json.encode({1, 2, 3})      -- '[1,2,3]'
json.encode({"a", "b"})     -- '["a","b"]'

-- Objetos (claves string)
local user = {name = "Alice", age = 30}
json.encode(user)           -- '{"name":"Alice","age":30}'

-- Estructuras anidadas
local order = {
    id = "ord-123",
    items = {
        {sku = "ABC", qty = 2},
        {sku = "XYZ", qty = 1}
    },
    total = 99.50
}
json.encode(order)
-- '{"id":"ord-123","items":[{"sku":"ABC","qty":2},{"sku":"XYZ","qty":1}],"total":99.5}'
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `value` | any | Valor Lua a codificar |

**Devuelve:** `string, error`

Reglas de codificacion:
- `nil` se convierte en `null`
- Tablas vacias se convierten en `[]` (o `{}` si se crean con claves string)
- Tablas con claves 1-indexadas secuenciales se convierten en arrays
- Tablas con claves string se convierten en objetos
- Claves numericas y string mixtas causan error
- Arrays dispersos (huecos en indices) causan error
- Numeros Inf/NaN se convierten en `null`
- Referencias de tabla recursivas causan error
- Profundidad maxima de anidamiento es 128 niveles

## Decodificacion

### Decodificar String

Decodifica un string JSON a un valor Lua.

```lua
-- Parsear objeto
local user, err = json.decode('{"name":"Bob","active":true}')
if err then
    return nil, err
end
print(user.name)    -- "Bob"
print(user.active)  -- true

-- Parsear array
local items = json.decode('[10, 20, 30]')
print(items[1])     -- 10
print(#items)       -- 3

-- Parsear datos anidados
local response = json.decode([[
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
print(response.data.users[1].name)  -- "Alice"

-- Manejar errores
local data, err = json.decode("not valid json")
if err then
    print(err:kind())     -- "INTERNAL"
    print(err:message())  -- detalles de error de parseo
end
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `str` | string | String JSON a decodificar |

**Devuelve:** `any, error`

## Validacion de Schema

### Validar Valor

Valida un valor Lua contra un JSON Schema. Use esto para hacer cumplir contratos API o validar entrada de usuario.

```lua
-- Definir un schema
local user_schema = {
    type = "object",
    properties = {
        name = {type = "string", minLength = 1},
        email = {type = "string", format = "email"},
        age = {type = "integer", minimum = 0, maximum = 150}
    },
    required = {"name", "email"}
}

-- Datos validos pasan
local valid, err = json.validate(user_schema, {
    name = "Alice",
    email = "alice@example.com",
    age = 30
})
print(valid)  -- true

-- Datos invalidos fallan con detalles
local valid, err = json.validate(user_schema, {
    name = "",
    email = "not-an-email"
})
if not valid then
    print(err:message())  -- detalles de error de validacion
end

-- Schema tambien puede ser string JSON
local schema_json = '{"type":"number","minimum":0}'
local valid = json.validate(schema_json, 42)
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `schema` | table o string | Definicion de JSON Schema |
| `data` | any | Valor a validar |

**Devuelve:** `boolean, error`

Los schemas se cachean por hash de contenido para rendimiento.

### Validar String JSON

Valida un string JSON contra un schema sin decodificar primero. Util cuando necesita validar antes de parsear.

```lua
local schema = {
    type = "object",
    properties = {
        action = {type = "string", enum = {"create", "update", "delete"}}
    },
    required = {"action"}
}

-- Validar JSON crudo desde cuerpo de solicitud
local body = '{"action":"create","data":{}}'
local valid, err = json.validate_string(schema, body)
if not valid then
    return nil, errors.new("INVALID", "Invalid request: " .. err:message())
end

-- Ahora seguro decodificar
local request = json.decode(body)
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `schema` | table o string | Definicion de JSON Schema |
| `json_str` | string | String JSON a validar |

**Devuelve:** `boolean, error`

## Errores

| Condicion | Tipo | Reintentable |
|-----------|------|--------------|
| Referencia de tabla recursiva | `errors.INTERNAL` | no |
| Array disperso (huecos en indices) | `errors.INTERNAL` | no |
| Tipos de clave mixtos en tabla | `errors.INTERNAL` | no |
| Anidamiento excede 128 niveles | `errors.INTERNAL` | no |
| Sintaxis JSON invalida | `errors.INTERNAL` | no |
| Compilacion de schema fallida | `errors.INVALID` | no |
| Validacion fallida | `errors.INVALID` | no |

Consulte [Manejo de Errores](lua-errors.md) para trabajar con errores.
