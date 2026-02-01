# Codificacao JSON
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>
<secondary-label ref="encoding"/>

Codifique tabelas Lua para JSON e decodifique strings JSON para valores Lua. Inclui validacao JSON Schema para verificacao de dados e aplicacao de contratos de API.

## Carregamento

```lua
local json = require("json")
```

## Codificacao

### Codificar Valor

Codifica um valor Lua em uma string JSON.

```lua
-- Valores simples
json.encode("hello")        -- '"hello"'
json.encode(42)             -- '42'
json.encode(true)           -- 'true'
json.encode(nil)            -- 'null'

-- Arrays (chaves numericas sequenciais)
json.encode({1, 2, 3})      -- '[1,2,3]'
json.encode({"a", "b"})     -- '["a","b"]'

-- Objetos (chaves string)
local user = {name = "Alice", age = 30}
json.encode(user)           -- '{"name":"Alice","age":30}'

-- Estruturas aninhadas
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

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `value` | any | Valor Lua para codificar |

**Retorna:** `string, error`

Regras de codificacao:
- `nil` se torna `null`
- Tabelas vazias se tornam `[]` (ou `{}` se criadas com chaves string)
- Tabelas com chaves sequenciais baseadas em 1 se tornam arrays
- Tabelas com chaves string se tornam objetos
- Chaves mistas numericas e string causam erro
- Arrays esparsos (gaps nos indices) causam erro
- Numeros Inf/NaN se tornam `null`
- Referencias recursivas de tabela causam erro
- Profundidade maxima de aninhamento e 128 niveis

## Decodificacao

### Decodificar String

Decodifica uma string JSON em um valor Lua.

```lua
-- Parse de objeto
local user, err = json.decode('{"name":"Bob","active":true}')
if err then
    return nil, err
end
print(user.name)    -- "Bob"
print(user.active)  -- true

-- Parse de array
local items = json.decode('[10, 20, 30]')
print(items[1])     -- 10
print(#items)       -- 3

-- Parse de dados aninhados
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

-- Tratar erros
local data, err = json.decode("not valid json")
if err then
    print(err:kind())     -- "INTERNAL"
    print(err:message())  -- detalhes do erro de parse
end
```

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `str` | string | String JSON para decodificar |

**Retorna:** `any, error`

## Validacao de Schema

### Validar Valor

Valida um valor Lua contra um JSON Schema. Use para aplicar contratos de API ou validar entrada do usuario.

```lua
-- Definir um schema
local user_schema = {
    type = "object",
    properties = {
        name = {type = "string", minLength = 1},
        email = {type = "string", format = "email"},
        age = {type = "integer", minimum = 0, maximum = 150}
    },
    required = {"name", "email"}
}

-- Dados validos passam
local valid, err = json.validate(user_schema, {
    name = "Alice",
    email = "alice@example.com",
    age = 30
})
print(valid)  -- true

-- Dados invalidos falham com detalhes
local valid, err = json.validate(user_schema, {
    name = "",
    email = "not-an-email"
})
if not valid then
    print(err:message())  -- detalhes do erro de validacao
end

-- Schema tambem pode ser uma string JSON
local schema_json = '{"type":"number","minimum":0}'
local valid = json.validate(schema_json, 42)
```

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `schema` | table ou string | Definicao de JSON Schema |
| `data` | any | Valor para validar |

**Retorna:** `boolean, error`

Schemas sao cacheados por hash de conteudo para performance.

### Validar String JSON

Valida uma string JSON contra um schema sem decodificar primeiro. Util quando voce precisa validar antes do parse.

```lua
local schema = {
    type = "object",
    properties = {
        action = {type = "string", enum = {"create", "update", "delete"}}
    },
    required = {"action"}
}

-- Validar JSON raw do corpo da requisicao
local body = '{"action":"create","data":{}}'
local valid, err = json.validate_string(schema, body)
if not valid then
    return nil, errors.new("INVALID", "Invalid request: " .. err:message())
end

-- Agora seguro para decodificar
local request = json.decode(body)
```

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `schema` | table ou string | Definicao de JSON Schema |
| `json_str` | string | String JSON para validar |

**Retorna:** `boolean, error`

## Erros

| Condicao | Tipo | Retentavel |
|----------|------|------------|
| Referencia recursiva de tabela | `errors.INTERNAL` | nao |
| Array esparso (gaps nos indices) | `errors.INTERNAL` | nao |
| Tipos de chave mistos na tabela | `errors.INTERNAL` | nao |
| Aninhamento excede 128 niveis | `errors.INTERNAL` | nao |
| Sintaxe JSON invalida | `errors.INTERNAL` | nao |
| Compilacao de schema falhou | `errors.INVALID` | nao |
| Validacao falhou | `errors.INVALID` | nao |

Veja [Error Handling](lua-errors.md) para trabalhar com erros.
