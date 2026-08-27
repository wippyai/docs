---
title: "Codificação de Payload"
description: "Crie payloads tipados, inspecione seu formato, extraia valores e transcodifique entre representações compatíveis."
---

# Codificação de Payload
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

Converta dados entre formatos incluindo JSON, MessagePack e binario. Manipule payloads tipados para comunicação entre serviços e passagem de dados em workflows.

Esta é uma referência de API com receitas parciais de transporte. Valores como `p` e `input_data`, assim como a entrada assíncrona de destino, são fornecidos pela aplicação.

## Carregamento

Namespace global. Nenhum require necessario.

```lua
payload.new(...)  -- direct access
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

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `value` | any | Valor Lua (string, numero, boolean, tabela, nil ou erro) |

**Retorna:** `Payload`

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

**Retorna:** `string` - uma das constantes `payload.format.*`

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

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `format` | string | Formato alvo de `payload.format.*` |

**Retorna:** `Payload, error`

## Unmarshalling

Forçar a decodificação de um payload para um valor Lua, independentemente do formato de origem:

```lua
local data, err = p:unmarshal()
if err then
    return nil, err
end
```

Tanto `data()` quanto `unmarshal()` retornam o valor Lua existente ou transcodificam um payload não Lua para o formato Lua. `unmarshal()` é mais estrito quando um transcoder produz um resultado inválido: ele retorna um erro `errors.INTERNAL`, enquanto `data()` retorna `nil`.

**Retorna:** `any, error`

## Resultados Assincronos

Payloads sao comumente recebidos de chamadas de função assíncronas:

Este exemplo pressupõe que `app.process:compute` retorne exatamente um valor. Sem resultados, `future:result()` retorna `nil`; com vários resultados, retorna uma tabela Lua em vez de um único `Payload`, portanto o chamador precisa tratar essas formas separadamente.

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

## Erros

| Condição | Tipo | Retentável |
|----------|------|------------|
| Falha de transcodificação | `errors.INTERNAL` | não |
| Resultado não e valor Lua valido | `errors.INTERNAL` | não |

Veja [Tratamento de Erros](../core/errors.md) para trabalhar com erros.
