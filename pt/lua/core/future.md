# Futures
<secondary-label ref="function"/>
<secondary-label ref="process"/>

Resultados de operacoes assincronas. Futures sao retornados por `funcs.async()` e chamadas async de contract.

## Carregamento

Nao e um modulo carregavel. Futures sao criados por operacoes assincronas:

```lua
local funcs = require("funcs")
local future, err = funcs.async("app.compute:task", data)
```

## Channel de Resposta

Obter channel para receber resultado:

```lua
local ch = future:response()
local payload, ok = ch:receive()
if ok then
    local result = payload:data()
end
```

`channel()` e um alias para `response()`.

## Verificacao de Conclusao

Verificacao nao-bloqueante se future completou:

```lua
if future:is_complete() then
    local result, err = future:result()
end
```

## Verificacao de Cancelamento

Verificar se `cancel()` foi chamado:

```lua
if future:is_canceled() then
    print("Operation was canceled")
end
```

## Obtendo Resultado

Obter resultado em cache (nao-bloqueante):

```lua
local val, err = future:result()
```

**Retorna:**
- Nao completo: `nil, nil`
- Cancelado: `nil, error` (tipo `CANCELED`)
- Erro: `nil, error`
- Sucesso: `Payload, nil` ou `table, nil` (multiplos payloads)

## Obtendo Erro

Obter erro se future falhou:

```lua
local err, has_error = future:error()
if has_error then
    print("Failed:", err:message())
end
```

**Retorna:** `error, boolean`

## Cancelando

Cancelar operacao assincrona (best-effort):

```lua
future:cancel()
```

A operacao ainda pode completar se ja estiver em andamento.

## Padrao de Timeout

```lua
local future = funcs.async("app.compute:slow", data)
local timeout = time.after("5s")

local r = channel.select {
    future:channel():case_receive(),
    timeout:case_receive()
}

if r.channel == timeout then
    future:cancel()
    return nil, errors.new("TIMEOUT", "Operation timed out")
end

return r.value:data()
```

## Primeiro a Completar

```lua
local f1 = funcs.async("app.cache:get", key)
local f2 = funcs.async("app.db:get", key)

local r = channel.select {
    f1:channel():case_receive(),
    f2:channel():case_receive()
}

-- Cancelar o mais lento
if r.channel == f1:channel() then
    f2:cancel()
else
    f1:cancel()
end

return r.value:data()
```

## Erros

| Condicao | Tipo |
|----------|------|
| Operacao cancelada | `CANCELED` |
| Operacao async falhou | varia |
