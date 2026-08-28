---
title: "Codificación YAML"
description: "Codifica tablas Lua como YAML y decodifica documentos YAML en valores Lua."
---

# Codificación YAML
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>
<secondary-label ref="encoding"/>

El módulo `yaml` serializa tablas Lua como YAML y analiza documentos YAML para convertirlos en valores Lua.

Esta es una referencia de API. Las expresiones que solo producen salida ilustran una codificación correcta; los ejemplos que consumen un valor capturan el segundo valor opcional `error`.

## Carga

```lua
local yaml = require("yaml")
```

Añade `yaml` a la lista `modules:` de la entrada ejecutable antes de requerirlo.

## Codificación

### `encode`

Codifica una tabla Lua como YAML:

```lua
-- Simple key-value
local config = {
    name = "myapp",
    port = 8080,
    debug = true
}
local out, err = yaml.encode(config)
if err then return nil, err end
-- YAML mapping containing name, port, and debug.

-- Arrays become YAML lists
local items = {"apple", "banana", "cherry"}
yaml.encode(items)
-- - apple
-- - banana
-- - cherry

-- Nested structures
local server = {
    http = {
        address = ":8080",
        timeout = "30s"
    },
    database = {
        host = "localhost",
        port = 5432
    }
}
yaml.encode(server)
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `data` | table | Tabla Lua a codificar |
| `options` | table? | Opciones de codificación opcionales |

#### Opciones

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `field_order` | string[] | Orden personalizado; los campos indicados aparecen en este orden |
| `sort_unordered` | boolean | Ordena alfabéticamente los campos que no están en `field_order` |

```lua
-- Control field order in output
local entry = {
    zebra = 1,
    alpha = 2,
    name = "test",
    kind = "demo"
}

-- Fields appear in specified order, remaining sorted alphabetically
local result, encode_err = yaml.encode(entry, {
    field_order = {"name", "kind"},
    sort_unordered = true
})
if encode_err then return nil, encode_err end
-- name: test
-- kind: demo
-- alpha: 2
-- zebra: 1

-- Just sort all fields alphabetically
yaml.encode(entry, {sort_unordered = true})
-- alpha: 2
-- kind: demo
-- name: test
-- zebra: 1
```

**Devuelve:** `string, error`

## Decodificación

### `decode`

Analiza una cadena YAML y la convierte en un valor Lua:

```lua
-- Parse configuration
local config, err = yaml.decode([[
server:
  host: localhost
  port: 8080
features:
  - auth
  - logging
  - metrics
]])
if err then
    return nil, err
end

print(config.server.host)     -- "localhost"
print(config.server.port)     -- 8080
print(config.features[1])     -- "auth"

-- Parse from file content
local fs = require("fs")
local config_fs = assert(fs.get("app:config"))
local content = assert(config_fs:readfile("config.yaml"))
local settings, err = yaml.decode(content)
if err then
    return nil, errors.wrap(err, "invalid config file")
end

-- Handle mixed types
local data, data_err = yaml.decode([[
name: test
count: 42
ratio: 3.14
enabled: true
tags:
  - lua
  - wippy
]])
if data_err then return nil, data_err end
print(type(data.count))    -- "number"
print(type(data.enabled))  -- "boolean"
print(type(data.tags))     -- "table"
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `data` | string | Cadena YAML que se analizará |

**Devuelve:** `any, error` — el tipo del valor depende del contenido YAML

## Errores

| Condición | Clase | Reintentable |
|-----------|------|--------------|
| La entrada no es una tabla (encode) | `errors.INVALID` | no |
| La entrada no es una cadena (decode) | `errors.INVALID` | no |
| Cadena vacía (decode) | `errors.INVALID` | no |
| Sintaxis YAML no válida | `errors.INTERNAL` | no |

Consulta [Manejo de errores](lua/core/errors.md) para trabajar con errores.
