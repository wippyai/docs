---
title: "Codificação YAML"
description: "Codifique tabelas Lua como YAML e decodifique documentos YAML em valores Lua."
---

# Codificação YAML
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>
<secondary-label ref="encoding"/>

Parse de documentos YAML para tabelas Lua e serialização de valores Lua para strings YAML.

## Carregamento

```lua
local yaml = require("yaml")
```

## Codificação

### Codificar Valor

Codifica uma tabela Lua para formato YAML.

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

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `data` | table | Tabela Lua para codificar |
| `options` | table? | Opções de codificação opcionais |

#### Opções

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `field_order` | string[] | Ordenação customizada de campos - campos aparecem nesta ordem |
| `sort_unordered` | boolean | Ordenar campos não em `field_order` alfabeticamente |

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

**Retorna:** `string, error`

## Decodificação

### Decodificar String

Parse de uma string YAML para uma tabela Lua.

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

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `data` | string | String YAML para parse |

**Retorna:** `any, error` - Retorna tabela, array, string, numero ou boolean dependendo do conteudo YAML

## Erros

| Condição | Tipo | Retentável |
|----------|------|------------|
| Entrada não e tabela (encode) | `errors.INVALID` | não |
| Entrada não e string (decode) | `errors.INVALID` | não |
| String vazia (decode) | `errors.INVALID` | não |
| Sintaxe YAML invalida | `errors.INTERNAL` | não |

Veja [Tratamento de Erros](../core/errors.md) para trabalhar com erros.
