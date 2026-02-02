# Codificacao YAML
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>
<secondary-label ref="encoding"/>

Parse de documentos YAML para tabelas Lua e serializacao de valores Lua para strings YAML.

## Carregamento

```lua
local yaml = require("yaml")
```

## Codificacao

### Codificar Valor

Codifica uma tabela Lua para formato YAML.

```lua
-- Chave-valor simples
local config = {
    name = "myapp",
    port = 8080,
    debug = true
}
local out = yaml.encode(config)
-- name: myapp
-- port: 8080
-- debug: true

-- Arrays se tornam listas YAML
local items = {"apple", "banana", "cherry"}
yaml.encode(items)
-- - apple
-- - banana
-- - cherry

-- Estruturas aninhadas
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
| `options` | table? | Opcoes de codificacao opcionais |

#### Opcoes

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `field_order` | string[] | Ordenacao customizada de campos - campos aparecem nesta ordem |
| `sort_unordered` | boolean | Ordenar campos não em `field_order` alfabeticamente |

```lua
-- Controlar ordem dos campos na saida
local entry = {
    zebra = 1,
    alpha = 2,
    name = "test",
    kind = "demo"
}

-- Campos aparecem na ordem especificada, restantes ordenados alfabeticamente
local result = yaml.encode(entry, {
    field_order = {"name", "kind"},
    sort_unordered = true
})
-- name: test
-- kind: demo
-- alpha: 2
-- zebra: 1

-- Apenas ordenar todos os campos alfabeticamente
yaml.encode(entry, {sort_unordered = true})
-- alpha: 2
-- kind: demo
-- name: test
-- zebra: 1
```

**Retorna:** `string, error`

## Decodificacao

### Decodificar String

Parse de uma string YAML para uma tabela Lua.

```lua
-- Parse de configuracao
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

-- Parse de conteudo de arquivo
local content = fs.read("config.yaml")
local settings, err = yaml.decode(content)
if err then
    return nil, errors.wrap(err, "invalid config file")
end

-- Tratar tipos mistos
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

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `data` | string | String YAML para parse |

**Retorna:** `any, error` - Retorna tabela, array, string, numero ou boolean dependendo do conteudo YAML

## Erros

| Condição | Tipo | Retentavel |
|----------|------|------------|
| Entrada não e tabela (encode) | `errors.INVALID` | não |
| Entrada não e string (decode) | `errors.INVALID` | não |
| String vazia (decode) | `errors.INVALID` | não |
| Sintaxe YAML invalida | `errors.INTERNAL` | não |

Veja [Error Handling](lua-errors.md) para trabalhar com erros.
