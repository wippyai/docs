---
title: "Errors"
description: "Crie, encapsule, inspecione e classifique erros estruturados em entradas Lua."
---

# Errors
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

Tratamento de erros estruturados com categorização e metadados de retry. Tabela global `errors` disponível sem require.

## Criando Erros

```lua
-- Simple message (kind defaults to UNKNOWN)
local err = errors.new("something went wrong")

-- With kind, retryable, and details
local err = errors.new({
    message = "user not found",
    kind = errors.NOT_FOUND,
    retryable = false,
    details = {user_id = 123}
})
```

`errors.new` aceita uma mensagem string ou uma tabela com pelo menos um campo `message`. A forma `(kind, message)` não é suportada.

## Encapsulando Erros

Adicionar contexto preservando tipo, retryable e detalhes:

```lua
local data, err = db:query("SELECT * FROM users")
if err then
    return nil, errors.wrap(err, "failed to load users")
end
```

## Métodos de Erro

| Método | Retorna | Descrição |
|--------|---------|-----------|
| `err:kind()` | string | Categoria do erro |
| `err:message()` | string | Mensagem de erro |
| `err:retryable()` | boolean/nil | Se operação pode ser retentada |
| `err:details()` | table/nil | Metadados estruturados |
| `err:stack()` | string | Stack trace Lua |
| `tostring(err)` | string | Representação completa |

## Verificando Tipo

```lua
if errors.is(err, errors.INVALID) then
    -- handle invalid input
end

-- Or compare directly
if err:kind() == errors.NOT_FOUND then
    -- handle missing resource
end
```

## Tipos de Erro

| Constante | Caso de Uso |
|-----------|-------------|
| `errors.NOT_FOUND` | Recurso não existe |
| `errors.ALREADY_EXISTS` | Recurso já existe |
| `errors.INVALID` | Entrada ou argumentos inválidos |
| `errors.PERMISSION_DENIED` | Acesso negado |
| `errors.UNAVAILABLE` | Serviço temporariamente fora |
| `errors.INTERNAL` | Erro interno |
| `errors.CANCELED` | Operação foi cancelada |
| `errors.CONFLICT` | Conflito de estado de recurso |
| `errors.TIMEOUT` | Operação expirou |
| `errors.RATE_LIMITED` | Muitas requisições |
| `errors.UNKNOWN` | Erro não específicado |

## Call Stack

Obter call stack estruturado:

```lua
local stack = errors.call_stack(err)
if stack then
    print("Thread:", stack.thread)
    for _, frame in ipairs(stack.frames) do
        print(frame.source .. ":" .. frame.line, frame.name)
    end
end
```

## Erros Retentáveis

A possibilidade de repetir uma operação é um metadado do erro, não uma propriedade garantida pelo tipo. Verifique o valor retornado por `err:retryable()` em vez de inferi-lo de `err:kind()`. Um resultado `nil` significa que o erro não informa se a repetição é apropriada.

```lua
if err:retryable() then
    -- safe to retry
end
```

## Detalhes de Erro

```lua
local err = errors.new({
    message = "validation failed",
    kind = errors.INVALID,
    details = {
        errors = {
            {field = "email", message = "invalid format"},
            {field = "age", message = "must be positive"}
        }
    }
})

local details = err:details()
for _, e in ipairs(details.errors) do
    print(e.field, e.message)
end
```
