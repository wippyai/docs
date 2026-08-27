---
title: "Contracts"
description: "Abra bindings de serviços tipados, inspecione contratos, chame implementações e propague contexto de chamada ou segurança."
---

# Contracts
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>
<secondary-label ref="permissions"/>

O módulo `contract` abre bindings de serviços tipados para APIs remotas, workflows e funções, com validação de schema, chamadas assíncronas e propagação do contexto. Esta página é uma referência de API; IDs e valores como `current_user` pertencem à aplicação.

## Carregamento

```lua
local contract = require("contract")
```

## Abrindo um Binding

Abrir um binding diretamente por ID:

```lua
local greeter, err = contract.open("app.services:greeter")
if err then
    return nil, err
end

local result, err = greeter:say_hello("Alice")
if err then
    return nil, err
end
```

Com contexto de escopo ou parametros de query:

```lua
-- With scope table
local svc, err = contract.open("app.services:user", {
    tenant_id = "acme",
    region = "us-east"
})

-- With query parameters (auto-converted: "true"→bool, numbers→int/float)
local api, err = contract.open("app.services:api?debug=true&timeout=5000")

-- With call options (third argument)
local inst, err = contract.open("app.services:flaky", nil, {
    retry = { max_attempts = 5, initial_delay = 100 }
})
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `binding_id` | string | ID do binding, suporta parametros de query |
| `scope` | table | Valores de contexto (opcional, sobrescreve parametros de query) |
| `options` | table | Opções de chamada (opcional) — ex. `retry.max_attempts`, `retry.initial_delay` |

**Retorna:** `Instance, error`

## Obtendo um Contract

Recuperar definição de contract para introspecção:

```lua
local c, err = contract.get("app.services:greeter")
if err then
    return nil, err
end

print(c:id())  -- "app.services:greeter"

local methods = c:methods()
for _, m in ipairs(methods) do
    print(m.name, m.description)
end

local method, err = c:method("say_hello")
if err then
    return nil, err
end
```

### Definição de Method

Cada elemento do schema contém uma string `format` e pode incluir um valor `definition`.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `name` | string | Nome do método |
| `description` | string | Descrição do método |
| `input_schemas` | table[] | Definições de schema de entrada |
| `output_schemas` | table[] | Definições de schema de saída |

## Encontrando Implementações

Listar todos os bindings que implementam um contract:

```lua
local bindings, err = contract.find_implementations("app.services:greeter")
if err then
    return nil, err
end

for _, binding_id in ipairs(bindings) do
    print(binding_id)
end
```

Ou via objeto contract:

```lua
local c, err = contract.get("app.services:greeter")
if err then
    return nil, err
end
local bindings, err = c:implementations()
if err then
    return nil, err
end
```

## Verificando Implementação

Verificar se instância implementa um contract:

```lua
if contract.is(instance, "app.services:greeter") then
    instance:say_hello("World")
end
```

## Chamando Métodos

Chamada síncrona - bloqueia até completar:

```lua
local calc, err = contract.open("app.services:calculator")
if err then
    return nil, err
end

local sum, err = calc:add(10, 20)
if err then
    return nil, err
end
local product, err = calc:multiply(5, 6)
if err then
    return nil, err
end
```

## Chamadas Assíncronas

Adicione sufixo `_async` para execução assíncrona:

```lua
local processor, err = contract.open("app.services:processor")
if err then
    return nil, err
end

local future, err = processor:process_async(large_dataset)
if err then
    return nil, err
end

-- Do other work...

-- Wait for result
local ch = future:response()
local _, open = ch:receive()
if not open then
    return nil, errors.new("future response channel closed")
end

local payload, result_err = future:result()
if result_err then return nil, result_err end
local result, data_err = payload:data()
if data_err then return nil, data_err end
```

Veja [Futures](./future.md) para os métodos de future.

## Abrindo via Contract

Abra um binding por um objeto contract. As chamadas abaixo são alternativas; verifique o erro retornado por `contract.get()` e pela chamada `open()` escolhida antes de usar a instância.

Abrir binding através de objeto contract:

```lua
local c, err = contract.get("app.services:user")
if err then
    return nil, err
end

-- Default binding
local instance, err = c:open()

-- Specific binding
local instance, err = c:open("app.services:user_impl")

-- With scope
local instance, err = c:open(nil, {user_id = 123})
local instance, err = c:open("app.services:user_impl", {user_id = 123})
```

## Adicionando Contexto

Criar wrapper com contexto pre-configurado:

```lua
local ctx = require("ctx")
local c, err = contract.get("app.services:user")
if err then return nil, err end

local request_id, ctx_err = ctx.get("request_id")
if ctx_err then return nil, ctx_err end

local wrapped, err = c:with_context({
    request_id = request_id,
    user_id = current_user.id
})
if err then return nil, err end

local instance, err = wrapped:open()
```

## Opções de Chamada

Configure retry e outro comportamento de chamada via `with_options`:

```lua
local c, err = contract.get("app.services:flaky")
if err then return nil, err end

local configured = c:with_options({
    retry = { max_attempts = 5, initial_delay = 100 }
})
local inst, err = configured:open("app.services:flaky_impl")
if err then return nil, err end

local result, err = inst:call()
```

As opções aplicam-se a cada chamada de método na instância retornada. Apenas erros passíveis de retry disparam retries; erros não passíveis de retry aparecem imediatamente. Encadeável com `with_context`, `with_actor`, `with_scope`.

| Opção | Tipo | Descrição |
|--------|------|-----------|
| `retry.max_attempts` | int | Tentativas máximas incluindo a primeira (1 desativa retry) |
| `retry.initial_delay` | int/duration | Atraso antes do primeiro retry (ms ou string de duração) |

## Contexto de Segurança

Definir ator e escopo para autorização:

```lua
local security = require("security")
local c, err = contract.get("app.services:admin")
if err then return nil, err end

local secured, err = c:with_actor(security.actor())
if err then return nil, err end

secured, err = secured:with_scope(security.scope())
if err then return nil, err end

local admin, err = secured:open()
if err then return nil, err end
```

Sem `with_actor`/`with_scope` explícitos, um contract aberto herda o ator e o escopo ambientes do chamador. Quando definidos, eles se propagam às funções de implementação vinculadas — cada chamada de método na instância executa sob essa identidade.

## Permissões

| Permissão | Recurso | Funções |
|-----------|---------|---------|
| `contract.get` | id do contract | `get()` |
| `contract.open` | id do binding | `open()`, `Contract:open()` |
| `contract.implementations` | id do contract | `find_implementations()`, `Contract:implementations()` |
| `contract.call` | nome do método | chamadas de método sync e async |
| `contract.context` | "context" | `Contract:with_context()` |
| `contract.security` | "security" | `Contract:with_actor()`, `Contract:with_scope()` |

## Erros

| Condição | Tipo |
|----------|------|
| Formato de ID de binding inválido | `errors.INVALID` |
| Contract não encontrado | `errors.NOT_FOUND` |
| Binding não encontrado | `errors.NOT_FOUND` |
| Método não encontrado | `errors.NOT_FOUND` |
| Sem binding padrão | `errors.NOT_FOUND` |
| Permissão negada | `errors.PERMISSION_DENIED` |
| Falha no dispatcher do contract ou na conversão da resposta | `errors.INTERNAL` |
| A implementação retornou um erro | Preserva o tipo do erro da implementação |
