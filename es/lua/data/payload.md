# Codificacion de Payload
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

Convertir datos entre formatos incluyendo JSON, MessagePack y binario. Manejar payloads tipados para comunicacion entre servicios y paso de datos en flujos de trabajo.

## Carga

Namespace global. No se necesita require.

```lua
payload.new(...)  -- acceso directo
```

## Constantes de Formato

Identificadores de formato para tipos de payload:

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

## Crear Payloads

Crear un nuevo payload desde un valor Lua:

```lua
-- Desde tabla
local p = payload.new({
    user_id = 123,
    name = "Alice",
    roles = {"admin", "user"}
})

-- Desde string
local str_p = payload.new("Hello, World!")

-- Desde numero
local num_p = payload.new(42.5)

-- Desde boolean
local bool_p = payload.new(true)

-- Desde nil
local nil_p = payload.new(nil)

-- Desde error
local err_p = payload.new(errors.new("something failed"))
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `value` | any | Valor Lua (string, number, boolean, table, nil o error) |

**Devuelve:** `Payload, nil`

## Obtener Formato

Obtener el formato del payload:

```lua
local p = payload.new({name = "test"})
local format = p:get_format()  -- "lua/any"

local str_p = payload.new("hello")
local format2 = str_p:get_format()  -- "lua/any"

local err_p = payload.new(errors.new("failed"))
local format3 = err_p:get_format()  -- "golang/error"
```

**Devuelve:** `string, nil` - una de las constantes `payload.format.*`

## Extraer Datos

Extraer el valor Lua del payload (transcodifica si es necesario):

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

## Transcodificar Payloads

Transcodificar payload a un formato diferente:

```lua
local p = payload.new({
    name = "test",
    value = 123
})

-- Convertir a JSON
local json_p, err = p:transcode(payload.format.JSON)
if err then
    return nil, err
end
print(json_p:get_format())  -- "json/plain"

-- Convertir a MessagePack (binario compacto)
local msgpack_p, err = p:transcode(payload.format.MSGPACK)
if err then
    return nil, err
end

-- Convertir a YAML
local yaml_p, err = p:transcode(payload.format.YAML)
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `format` | string | Formato objetivo de `payload.format.*` |

**Devuelve:** `Payload, error`

## Resultados Async

Los payloads se reciben comunmente de llamadas de funcion async:

```lua
local funcs = require("funcs")

local future, err = funcs.async("app.process:compute", input_data)
if err then
    return nil, err
end

-- Esperar resultado
local ch = future:response()
local result_payload, ok = ch:receive()
if not ok then
    return nil, errors.new("channel closed")
end

-- Extraer datos del payload
local result, err = result_payload:data()
if err then
    return nil, err
end

print(result.computed_value)
```

## Errores

| Condicion | Tipo | Reintentable |
|-----------|------|--------------|
| Fallo de transcodificacion | `errors.INTERNAL` | no |
| Resultado no es valor Lua valido | `errors.INTERNAL` | no |

Consulte [Manejo de Errores](lua-errors.md) para trabajar con errores.
