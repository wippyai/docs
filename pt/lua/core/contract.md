# Contracts
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>
<secondary-label ref="permissions"/>

Invoque servicos atraves de contracts tipados. Chame APIs remotas, workflows e funcoes com validacao de schema e suporte a execucao assincrona.

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

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `binding_id` | string | ID do binding, suporta parametros de query |
| `scope` | table | Valores de contexto (opcional, sobrescreve parametros de query) |

**Retorna:** `Instance, error`

## Obtendo um Contract

Recuperar definicao de contract para introspeccao:

```lua
local c, err = contract.get("app.services:greeter")

print(c:id())  -- "app.services:greeter"

local methods = c:methods()
for _, m in ipairs(methods) do
    print(m.name, m.description)
end

local method, err = c:method("say_hello")
```

### Definicao de Method

| Campo | Tipo | Descricao |
|-------|------|-----------|
| `name` | string | Nome do metodo |
| `description` | string | Descricao do metodo |
| `input_schemas` | table[] | Definicoes de schema de entrada |
| `output_schemas` | table[] | Definicoes de schema de saida |

## Encontrando Implementacoes

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

## Verificando Implementacao

Verificar se instancia implementa um contract:

```lua
if contract.is(instance, "app.services:greeter") then
    instance:say_hello("World")
end
```

## Chamando Metodos

Chamada sincrona - bloqueia ate completar:

```lua
local calc, err = contract.open("app.services:calculator")

local sum, err = calc:add(10, 20)
local product, err = calc:multiply(5, 6)
```

## Chamadas Assincronas

Adicione sufixo `_async` para execucao assincrona:

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

Veja [Futures](lua-future.md) para metodos de future.

## Abrindo via Contract

Abrir binding atraves de objeto contract:

```lua
local c, err = contract.get("app.services:user")

-- Binding padrao
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

## Contexto de Seguranca

Definir ator e escopo para autorizacao:

```lua
local security = require("security")
local c, err = contract.get("app.services:admin")

local secured = c:with_actor(security.actor()):with_scope(security.scope())

local admin, err = secured:open()
```

## Permissoes

| Permissao | Recurso | Funcoes |
|-----------|---------|---------|
| `contract.get` | id do contract | `get()` |
| `contract.open` | id do binding | `open()`, `Contract:open()` |
| `contract.implementations` | id do contract | `find_implementations()`, `Contract:implementations()` |
| `contract.call` | nome do metodo | chamadas de metodo sync e async |
| `contract.context` | "context" | `Contract:with_context()` |
| `contract.security` | "security" | `Contract:with_actor()`, `Contract:with_scope()` |

## Erros

| Condicao | Tipo |
|----------|------|
| Formato de ID de binding invalido | `errors.INVALID` |
| Contract nao encontrado | `errors.NOT_FOUND` |
| Binding nao encontrado | `errors.NOT_FOUND` |
| Metodo nao encontrado | `errors.NOT_FOUND` |
| Sem binding padrao | `errors.NOT_FOUND` |
| Permissao negada | `errors.PERMISSION_DENIED` |
| Chamada falhou | `errors.INTERNAL` |
