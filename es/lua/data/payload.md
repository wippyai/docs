---
title: "Codificación de payloads"
description: "Crea payloads tipados, inspecciona su formato, extrae valores y transcodifica entre representaciones compatibles."
---

# Codificación de payloads
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

Los payloads transportan valores tipados entre funciones, procesos, servicios y workflows. Pueden inspeccionarse, extraerse o transcodificarse entre formatos compatibles.

Esta es una referencia de API con recetas parciales de transporte. Valores como `p`, `input_data` y la entrada asíncrona de destino proceden de la aplicación circundante.

## Carga

`payload` es un namespace global y no requiere `require()`.

```lua
payload.new(...)  -- direct access
```

## Constantes de formato

Las constantes siguientes identifican los formatos de payload:

```lua
payload.format.JSON     -- "json/plain"
payload.format.YAML     -- "yaml/plain"
payload.format.STRING   -- "text/plain"
payload.format.BYTES    -- "application/octet-stream"
payload.format.MSGPACK  -- "application/msgpack"
payload.format.LUA      -- "lua/any"
payload.format.GOLANG   -- "golang/any"
payload.format.ERROR    -- "golang/error"
```

## Creación de payloads

Crea un payload a partir de un valor Lua:

```lua
-- From table
local p = payload.new({
    user_id = 123,
    name = "Alice",
    roles = {"admin", "user"}
})

-- From string
local str_p = payload.new("Hello, World!")

-- From number
local num_p = payload.new(42.5)

-- From boolean
local bool_p = payload.new(true)

-- From nil
local nil_p = payload.new(nil)

-- From error
local err_p = payload.new(errors.new("something failed"))
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `value` | any | Valor Lua (string, number, boolean, table, nil o error) |

**Devuelve:** `Payload`

## Obtención del formato

Lee el identificador de formato del payload:

```lua
local p = payload.new({name = "test"})
local format = p:get_format()  -- "lua/any"

local str_p = payload.new("hello")
local format2 = str_p:get_format()  -- "lua/any"

local err_p = payload.new(errors.new("failed"))
local format3 = err_p:get_format()  -- "golang/error"
```

**Devuelve:** `string` — una de las constantes `payload.format.*`

## Extracción de datos

Extrae el valor Lua del payload y lo transcodifica cuando sea necesario:

```lua
local p = payload.new({
    items = {1, 2, 3},
    total = 100
})

local data, err = p:data()
if err then
    return nil, err
end

print(data.total)        -- 100
print(data.items[1])     -- 1
```

**Devuelve:** `any, error`

## Transcodificación de payloads

Transcodifica un payload a otro formato compatible:

```lua
local p = payload.new({
    name = "test",
    value = 123
})

-- Convert to JSON
local json_p, err = p:transcode(payload.format.JSON)
if err then
    return nil, err
end
print(json_p:get_format())  -- "json/plain"

-- Convert to MessagePack (compact binary)
local msgpack_p, err = p:transcode(payload.format.MSGPACK)
if err then
    return nil, err
end

-- Convert to YAML
local yaml_p, yaml_err = p:transcode(payload.format.YAML)
if yaml_err then
    return nil, yaml_err
end
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `format` | string | Formato objetivo de `payload.format.*` |

**Devuelve:** `Payload, error`

## Unmarshalling

Decodifica un payload como un valor Lua, independientemente de su formato de origen:

```lua
local data, err = p:unmarshal()
if err then
    return nil, err
end
```

Tanto `data()` como `unmarshal()` devuelven el valor Lua existente o transcodifican un payload que no sea Lua al formato Lua. `unmarshal()` es más estricto cuando un transcodificador produce un resultado no válido: devuelve un error `errors.INTERNAL`, mientras que `data()` devuelve `nil`.

**Devuelve:** `any, error`

## Resultados asíncronos

Las llamadas asíncronas a funciones devuelven sus valores en payloads:

Este ejemplo presupone que `app.process:compute` devuelve exactamente un valor. Si no hay resultado, `future:result()` devuelve `nil`; si hay varios resultados, devuelve una tabla Lua en lugar de un único `Payload`, por lo que los llamadores deben manejar esas formas por separado.

```lua
local funcs = require("funcs")

local future, err = funcs.async("app.process:compute", input_data)
if err then
    return nil, err
end

-- Wait for result
local ch = future:response()
local _, ok = ch:receive()
if not ok then
    return nil, errors.new("channel closed")
end

local result_payload, result_err = future:result()
if result_err then
    return nil, result_err
end
if result_payload == nil then
    return nil, errors.new("compute returned no result")
end

-- Extract data from payload
local result, err = result_payload:data()
if err then
    return nil, err
end

print(result.computed_value)
```

## Errores

| Condición | Clase | Reintentable |
|-----------|------|--------------|
| Fallo de transcodificación | `errors.INTERNAL` | no |
| El resultado no es un valor Lua válido | `errors.INTERNAL` | no |

Consulta [Manejo de errores](lua/core/errors.md) para trabajar con errores.
