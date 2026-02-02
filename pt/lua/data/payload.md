# Codificação de Payload
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

Converta dados entre formatos incluindo JSON, MessagePack e binario. Manipule payloads tipados para comunicação entre serviços e passagem de dados em workflows.

## Carregamento

Namespace global. Nenhum require necessario.

```lua
payload.new(...)  -- acesso direto
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

## Criando Payloads

Criar um novo payload de um valor Lua:

```lua
-- De tabela
local p = payload.new({
    user_id = 123,
    name = "Alice",
    roles = {"admin", "user"}
})

-- De string
local str_p = payload.new("Hello, World!")

-- De numero
local num_p = payload.new(42.5)

-- De boolean
local bool_p = payload.new(true)

-- De nil
local nil_p = payload.new(nil)

-- De erro
local err_p = payload.new(errors.new("something failed"))
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `value` | any | Valor Lua (string, numero, boolean, tabela, nil ou erro) |

**Retorna:** `Payload, nil`

## Obtendo Formato

Obter o formato do payload:

```lua
local p = payload.new({name = "test"})
local format = p:get_format()  -- "lua/any"

local str_p = payload.new("hello")
local format2 = str_p:get_format()  -- "lua/any"

local err_p = payload.new(errors.new("failed"))
local format3 = err_p:get_format()  -- "golang/error"
```

**Retorna:** `string, nil` - uma das constantes `payload.format.*`

## Extraindo Dados

Extrair o valor Lua do payload (transcodifica se necessario):

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

**Retorna:** `any, error`

## Transcodificando Payloads

Transcodificar payload para um formato diferente:

```lua
local p = payload.new({
    name = "test",
    value = 123
})

-- Converter para JSON
local json_p, err = p:transcode(payload.format.JSON)
if err then
    return nil, err
end
print(json_p:get_format())  -- "json/plain"

-- Converter para MessagePack (binario compacto)
local msgpack_p, err = p:transcode(payload.format.MSGPACK)
if err then
    return nil, err
end

-- Converter para YAML
local yaml_p, err = p:transcode(payload.format.YAML)
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `format` | string | Formato alvo de `payload.format.*` |

**Retorna:** `Payload, error`

## Resultados Assincronos

Payloads sao comumente recebidos de chamadas de função assíncronas:

```lua
local funcs = require("funcs")

local future, err = funcs.async("app.process:compute", input_data)
if err then
    return nil, err
end

-- Aguardar resultado
local ch = future:response()
local result_payload, ok = ch:receive()
if not ok then
    return nil, errors.new("channel closed")
end

-- Extrair dados do payload
local result, err = result_payload:data()
if err then
    return nil, err
end

print(result.computed_value)
```

## Erros

| Condição | Tipo | Retentável |
|----------|------|------------|
| Falha de transcodificação | `errors.INTERNAL` | não |
| Resultado não e valor Lua valido | `errors.INTERNAL` | não |

Veja [Error Handling](lua-errors.md) para trabalhar com erros.

