# Contracts
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>
<secondary-label ref="permissions"/>

Invoque serviços através de contracts tipados. Chame APIs remotas, workflows e funções com validação de schema e suporte a execução assíncrona.

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
```

Com contexto de escopo ou parametros de query:

```lua
-- Com tabela de escopo
local svc, err = contract.open("app.services:user", {
    tenant_id = "acme",
    region = "us-east"
})

-- Com parametros de query (auto-convertido: "true"->bool, numeros->int/float)
local api, err = contract.open("app.services:api?debug=true&timeout=5000")
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `binding_id` | string | ID do binding, suporta parametros de query |
| `scope` | table | Valores de contexto (opcional, sobrescreve parametros de query) |

**Retorna:** `Instance, error`

## Obtendo um Contract

Recuperar definição de contract para introspecção:

```lua
local c, err = contract.get("app.services:greeter")

print(c:id())  -- "app.services:greeter"

local methods = c:methods()
for _, m in ipairs(methods) do
    print(m.name, m.description)
end

local method, err = c:method("say_hello")
```

### Definição de Method

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

for _, binding_id in ipairs(bindings) do
    print(binding_id)
end
```

Ou via objeto contract:

```lua
local c, err = contract.get("app.services:greeter")
local bindings, err = c:implementations()
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

local sum, err = calc:add(10, 20)
local product, err = calc:multiply(5, 6)
```

## Chamadas Assíncronas

Adicione sufixo `_async` para execução assíncrona:

```lua
local processor, err = contract.open("app.services:processor")

local future, err = processor:process_async(large_dataset)

-- Fazer outro trabalho...

-- Aguardar resultado
local ch = future:response()
local payload, ok = ch:receive()
if ok then
    local result = payload:data()
end
```

Veja [Futures](lua/core/future.md) para métodos de future.

## Abrindo via Contract

Abrir binding através de objeto contract:

```lua
local c, err = contract.get("app.services:user")

-- Binding padrão
local instance, err = c:open()

-- Binding especifico
local instance, err = c:open("app.services:user_impl")

-- Com escopo
local instance, err = c:open(nil, {user_id = 123})
local instance, err = c:open("app.services:user_impl", {user_id = 123})
```

## Adicionando Contexto

Criar wrapper com contexto pre-configurado:

```lua
local c, err = contract.get("app.services:user")

local wrapped = c:with_context({
    request_id = ctx.get("request_id"),
    user_id = current_user.id
})

local instance, err = wrapped:open()
```

## Contexto de Segurança

Definir ator e escopo para autorização:

```lua
local security = require("security")
local c, err = contract.get("app.services:admin")

local secured = c:with_actor(security.actor()):with_scope(security.scope())

local admin, err = secured:open()
```

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
| Chamada falhou | `errors.INTERNAL` |
