---
title: "Futures"
description: "Receba, inspecione e cancele resultados de chamadas assíncronas de funções e contratos."
---

# Futures
<secondary-label ref="function"/>
<secondary-label ref="process"/>

Resultados de operações assíncronas. Futures sao retornados por `funcs.async()` e chamadas async de contract.

## Carregamento

Não e um módulo carregavel. Futures sao criados por operações assíncronas:

```lua
local funcs = require("funcs")
local future, err = funcs.async("app.compute:task", data)
if err then
    return nil, err
end
```

## Channel de Resposta

Obter channel para receber resultado:

```lua
local ch = future:response()
local _, open = ch:receive()
if not open then
    return nil, errors.new("future response channel closed")
end

local payload, err = future:result()
if err then
    return nil, err
end
local result, data_err = payload:data()
if data_err then return nil, data_err end
```

`channel()` e um alias para `response()`.

O valor do channel é o payload, a tabela de payloads ou o erro da operação. Depois que o channel estiver pronto, `result()` oferece uma interface consistente para sucesso ou erro e retorna o valor em cache mesmo após o channel ser drenado.

## Verificação de Conclusao

Verificação não-bloqueante se future completou:

```lua
if future:is_complete() then
    local result, err = future:result()
end
```

## Verificação de Cancelamento

Verificar se o future foi cancelado:

```lua
if future:is_canceled() then
    print("Operation was canceled")
end
```

## Obtendo Resultado

Obter resultado em cache (não-bloqueante):

```lua
local val, err = future:result()
```

**Retorna:**
- Não completo: `nil, nil`
- Cancelado: `nil, error` (tipo `CANCELED`)
- Erro: `nil, error`
- Sucesso: `Payload, nil` ou `table, nil` (multiplos payloads)

## Obtendo Erro

Quando a operação falha, `error()` retorna um wrapper `INTERNAL` não retentável. Use `result()` quando for necessário preservar o tipo e a retentabilidade originais do erro da função chamada.

Obter erro se future falhou:

```lua
local err, has_error = future:error()
if has_error then
    print("Failed:", err:message())
end
```

**Retorna:** `error, boolean`

## Cancelando

Cancelar operação assíncrona (best-effort):

```lua
local canceled, err = future:cancel()
```

A operação ainda pode completar se ja estiver em andamento.

**Retorna:** `boolean, error`

<warning>
No runtime v0.3.32a, futures de funções e contratos compartilham um único callback de cancelamento global ao processo. Quando os dois providers estão carregados, <code>cancel()</code> e <code>is_canceled()</code> não formam um contrato estável entre providers. Não use o cancelamento para garantir a correção da aplicação; aplique um timeout local e ignore resultados tardios até que o runtime separe o cancelamento dos providers.
</warning>

## Padrão de Timeout

```lua
local time = require("time")

local future, err = funcs.async("app.compute:slow", data)
if err then
    return nil, err
end

local timeout, err = time.after("5s")
if err then
    return nil, err
end

local r = channel.select {
    future:channel():case_receive(),
    timeout:case_receive()
}

if r.channel == timeout then
    -- The operation may still complete; this caller ignores the late result.
    return nil, errors.new({
        message = "Operation timed out",
        kind = errors.TIMEOUT
    })
end

local payload, result_err = future:result()
if result_err then
    return nil, result_err
end
local value, data_err = payload:data()
if data_err then return nil, data_err end
return value
```

## Primeiro a Completar

```lua
local f1, err = funcs.async("app.cache:get", key)
if err then
    return nil, err
end
local f2, err = funcs.async("app.db:get", key)
if err then
    return nil, err
end

local ch1 = f1:channel()
local ch2 = f2:channel()

local r = channel.select {
    ch1:case_receive(),
    ch2:case_receive()
}

-- The slower operation may still complete; this caller ignores its result.
local winner
if r.channel == ch1 then
    winner = f1
else
    winner = f2
end

local payload, result_err = winner:result()
if result_err then
    return nil, result_err
end
local value, data_err = payload:data()
if data_err then return nil, data_err end
return value
```

## Erros

| Condição | Tipo | Retentável |
|----------|------|------------|
| Operação cancelada por `result()` | `errors.CANCELED` | não |
| Falha da operação retornada por `result()` | varia | preservado do erro da função |
| Falha da operação retornada por `error()` | `errors.INTERNAL` | não |
| Falha no despacho do cancelamento | `errors.INTERNAL` | não |
