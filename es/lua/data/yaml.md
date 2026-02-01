# Codificacion YAML
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>
<secondary-label ref="encoding"/>

Parsear documentos YAML a tablas Lua y serializar valores Lua a strings YAML.

## Carga

```lua
local yaml = require("yaml")
```

## Codificacion

### Codificar Valor

Codifica una tabla Lua a formato YAML.

```lua
-- Clave-valor simple
local config = {
    name = "myapp",
    port = 8080,
    debug = true
}
local out = yaml.encode(config)
-- name: myapp
-- port: 8080
-- debug: true

-- Arrays se convierten en listas YAML
local items = {"apple", "banana", "cherry"}
yaml.encode(items)
-- - apple
-- - banana
-- - cherry

-- Estructuras anidadas
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

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `data` | table | Tabla Lua a codificar |
| `options` | table? | Opciones de codificacion opcionales |

#### Opciones

| Campo | Tipo | Descripcion |
|-------|------|-------------|
| `field_order` | string[] | Orden de campos personalizado - campos aparecen en este orden |
| `sort_unordered` | boolean | Ordenar campos no en `field_order` alfabeticamente |

```lua
-- Controlar orden de campos en salida
local entry = {
    zebra = 1,
    alpha = 2,
    name = "test",
    kind = "demo"
}

-- Campos aparecen en orden especificado, restantes ordenados alfabeticamente
local result = yaml.encode(entry, {
    field_order = {"name", "kind"},
    sort_unordered = true
})
-- name: test
-- kind: demo
-- alpha: 2
-- zebra: 1

-- Solo ordenar todos los campos alfabeticamente
yaml.encode(entry, {sort_unordered = true})
-- alpha: 2
-- kind: demo
-- name: test
-- zebra: 1
```

**Devuelve:** `string, error`

## Decodificacion

### Decodificar String

Parsea un string YAML a una tabla Lua.

```lua
-- Parsear configuracion
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

-- Parsear desde contenido de archivo
local content = fs.read("config.yaml")
local settings, err = yaml.decode(content)
if err then
    return nil, errors.wrap(err, "invalid config file")
end

-- Manejar tipos mixtos
local data = yaml.decode([[
name: test
count: 42
ratio: 3.14
enabled: true
tags:
  - lua
  - wippy
]])
print(type(data.count))    -- "number"
print(type(data.enabled))  -- "boolean"
print(type(data.tags))     -- "table"
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `data` | string | String YAML a parsear |

**Devuelve:** `any, error` - Devuelve table, array, string, number o boolean dependiendo del contenido YAML

## Errores

| Condicion | Tipo | Reintentable |
|-----------|------|--------------|
| Entrada no es tabla (encode) | `errors.INVALID` | no |
| Entrada no es string (decode) | `errors.INVALID` | no |
| String vacio (decode) | `errors.INVALID` | no |
| Sintaxis YAML invalida | `errors.INTERNAL` | no |

Consulte [Manejo de Errores](lua-errors.md) para trabajar con errores.
