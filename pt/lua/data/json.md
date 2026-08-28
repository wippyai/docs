---
title: "Codificação JSON"
description: "Codifique valores Lua como JSON, decodifique strings JSON e valide valores ou strings com JSON Schema."
---

# Codificação JSON
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>
<secondary-label ref="encoding"/>

Codifique tabelas Lua para JSON e decodifique strings JSON para valores Lua. Inclui validação JSON Schema para verificação de dados e aplicação de contratos de API.

Esta é uma referência de API. Exemplos de expressões curtas mostram valores de retorno bem-sucedidos; exemplos que consomem o resultado capturam o segundo retorno opcional `error`.

## Carregamento

```lua
local json = require("json")
```

Adicione `json` à lista `modules:` da entrada executável antes de carregá-lo.

## Codificação

### `encode`

Codifica um valor Lua em uma string JSON.

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

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `value` | any | Valor Lua para codificar |

**Retorna:** `string, error`

Regras de codificação:
- `nil` se torna `null`
- Tabelas vazias se tornam `[]` (ou `{}` se criadas com chaves string)
- Tabelas com chaves sequenciais baseadas em 1 se tornam arrays
- Tabelas com chaves string se tornam objetos
- Chaves mistas numericas e string causam erro
- Arrays esparsos (gaps nos indices) causam erro
- Numeros Inf/NaN se tornam `null`
- Referências recursivas de tabela causam erro
- Profundidade maxima de aninhamento e 128 niveis

## Decodificação

### `decode`

Decodifica uma string JSON em um valor Lua.

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

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `str` | string | String JSON para decodificar |

**Retorna:** `any, error`

## Validação de Schema

### `validate`

Valida um valor Lua contra um JSON Schema. Use para aplicar contratos de API ou validar entrada do usuário.

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

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `schema` | table ou string | Definição de JSON Schema |
| `data` | any | Valor para validar |

**Retorna:** `boolean, error`

Schemas sao cacheados por hash de conteudo para performance.

### `validate_string`

Valida uma string JSON contra um schema sem decodificar primeiro. Util quando voce precisa validar antes do parse.

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

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `schema` | table ou string | Definição de JSON Schema |
| `json_str` | string | String JSON para validar |

**Retorna:** `boolean, error`

## Erros

| Condição | Tipo | Retentável |
|----------|------|------------|
| Referência recursiva de tabela | `errors.INTERNAL` | não |
| Array esparso (gaps nos indices) | `errors.INTERNAL` | não |
| Tipos de chave mistos na tabela | `errors.INTERNAL` | não |
| Aninhamento excede 128 niveis | `errors.INTERNAL` | não |
| Sintaxe JSON invalida | `errors.INTERNAL` | não |
| Compilação de schema falhou | `errors.INVALID` | não |
| Validação falhou | `errors.INVALID` | não |

Veja [Tratamento de Erros](lua/core/errors.md) para trabalhar com erros.
