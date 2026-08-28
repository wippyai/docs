---
title: "Segurança & Controle de Acesso"
description: "Inspecione o actor e scope atuais, avalie políticas e gerencie tokens de autenticação."
---

# Segurança & Controle de Acesso
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="permissions"/>

O módulo `security` expõe actors de autenticação, scopes de autorização, políticas e token stores. Esta página é uma referência de API com receitas parciais de autorização. IDs de registry, actors, metadados de requisição, valores de tokens, objetos da aplicação como `user` e `doc` e callbacks como `show_admin_features` vêm da aplicação; os exemplos não formam um deployment completo de autenticação.

O Wippy usa o modo de segurança estrito por padrão. A entrada executável deve habilitar `security`, ter um actor e um scope e autorizar exatamente as operações chamadas. Em particular, criar ou alterar scopes exige `security.actor.create` ou `security.scope.create`; consultas ao registro exigem `security.policy.get` ou `security.policy_group.get`; operações com tokens exigem `security.token_store.get` e a permissão específica da operação. `new_actor`, `new_scope`, `scope:with`, `scope:without` e a obtenção negada de `token_store` lançam erro Lua em vez de retornar um `error` estruturado. Conceda esses pré-requisitos no contexto de segurança da entrada. Veja [Modelo de Segurança](system/security.md) para configurar.

## Carregamento

```lua
local security = require("security")
```

## `actor`

Retorna o actor de segurança atual do contexto de execução.

```lua
local actor = security.actor()
if actor then
    local id = actor:id()
    local meta = actor:meta()
    -- Use only the fields required for authorization or application logic.
    local role = meta.role
end
```

Os metadados do actor podem conter identificadores ou dados pessoais. Não registre a tabela completa de metadados nem copie segredos para ela.

**Retorna:** `Actor|nil`

## `scope`

Retorna o escopo de segurança atual do contexto de execução.

```lua
local scope = security.scope()
if scope then
    local policies = scope:policies()
    for _, policy in ipairs(policies) do
        print("Active policy:", policy:id())
    end
end
```

**Retorna:** `Scope|nil`

## `can`

Verifica se o contexto atual permite uma ação em um recurso.

```lua
-- Check read permission
if not security.can("read", "user:" .. user_id) then
    return nil, errors.new({
        message = "Cannot read user data",
        kind = errors.PERMISSION_DENIED
    })
end

-- Check write permission
if not security.can("write", "order:" .. order_id) then
    return nil, errors.new({
        message = "Cannot modify order",
        kind = errors.PERMISSION_DENIED
    })
end

-- Check with metadata
local allowed = security.can("delete", "document:" .. doc_id, {
    owner_id = doc.owner_id,
    department = doc.department
})
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `action` | string | Ação a verificar |
| `resource` | string | Identificador do recurso |
| `meta` | table | Metadados adicionais (opcional) |

**Retorna:** `boolean`

## `new_actor`

Cria um novo actor com ID e metadados.

```lua
-- Create user actor
local actor = security.new_actor("user:" .. user.id, {
    role = user.role,
    department = user.department,
    email = user.email
})

-- Create service actor
local service_actor = security.new_actor("service:payment-processor", {
    type = "service",
    version = "1.0.0"
})
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `id` | string | Identificador único do actor |
| `meta` | table | Pares chave-valor de metadados |

**Retorna:** `Actor`

## `new_scope`

Cria um novo escopo customizado.

```lua
-- Empty scope
local scope = security.new_scope()

-- Scope with policies
local read_policy, read_err = security.policy("app:read-only")
if read_err then
    return nil, read_err
end
local scope = security.new_scope({read_policy})

-- Build scope incrementally
local scope = security.new_scope()
local policy1, policy1_err = security.policy("app:read")
if policy1_err then
    return nil, policy1_err
end
local policy2, policy2_err = security.policy("app:write")
if policy2_err then
    return nil, policy2_err
end
scope = scope:with(policy1):with(policy2)
```

Cada alternativa acima é um padrão de construção isolado. `new_scope` e `scope:with` podem gerar erro quando faltar contexto ou houver negação de permissão; elas não retornam `nil, error` nessas verificações.

**Retorna:** `Scope`

## `policy`

Obtem uma política do registry.

```lua
local policy, err = security.policy("app:admin-access")
if err then
    return nil, err
end

-- Evaluate policy
local result = policy:evaluate(actor, "delete", "user:123")
if result == "allow" then
    -- permitted
elseif result == "deny" then
    -- forbidden
else
    -- undefined, check other policies
end
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `id` | string | ID da política "namespace:nome" |

**Retorna:** `Policy, error`

## `named_scope`

Obtem um grupo de políticas pre-definido.

```lua
-- Get admin scope
local admin_scope, err = security.named_scope("app:admin")
if err then
    return nil, err
end

-- Use for elevated operations
local result = admin_scope:evaluate(actor, "delete", "user:123")
```

Carregar um scope não eleva o contexto de execução atual. A chamada produz um valor para avaliação explícita ou para uma API que aceite um scope; o chamador ainda precisa de permissão para executar a operação protegida.

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `id` | string | ID do grupo de políticas |

**Retorna:** `Scope, error`

## `token_store`

Obtem um token store para gerenciar tokens de autenticação.

```lua
local store, err = security.token_store("app:tokens")
if err then
    return nil, err
end

-- Use store...
return store:close()
```

O chamador é responsável pelo token store adquirido até chamar `close()`. Feche-o depois da operação final em todos os caminhos de sucesso ou erro verificados; fechamentos repetidos são seguros. Uma negação de permissão durante a aquisição gera um erro Lua, enquanto falhas de lookup e de recurso retornam `nil, error`.

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `id` | string | ID do token store "namespace:nome" |

**Retorna:** `TokenStore, error`

## Métodos do Actor

| Método | Retorna | Descrição |
|--------|---------|-----------|
| `actor:id()` | string | Identificador do actor |
| `actor:meta()` | table | Metadados do actor |

## Métodos do Scope

### `with` / `without`

Adiciona ou remove políticas do escopo.

```lua
local scope = security.new_scope()

-- Add policy
local write_policy, err = security.policy("app:write")
if err then
    return nil, err
end
scope = scope:with(write_policy)

-- Remove policy
scope = scope:without("app:read-only")
```

`with` e `without` retornam novos valores de scope imutáveis e geram erro quando `security.scope.create` não é permitido para o recurso `with` ou `without`.

### evaluate

Avalia todas as políticas no escopo.

```lua
local result = scope:evaluate(actor, "read", "document:123")
-- "allow", "deny", or "undefined"

if result ~= "allow" then
    return nil, errors.new({
        message = "Access denied",
        kind = errors.PERMISSION_DENIED
    })
end
```

### contains

Verifica se o escopo contem uma política.

```lua
if scope:contains("app:admin") then
    show_admin_features()
end
```

### policies

Retorna todas as políticas no escopo.

```lua
local policies = scope:policies()
for _, policy in ipairs(policies) do
    print(policy:id())
end
```

**Retorna:** `Policy[]`

## Métodos da Policy

| Método | Retorna | Descrição |
|--------|---------|-----------|
| `policy:id()` | string | Identificador da política |
| `policy:evaluate(actor, action, resource, meta?)` | string | `"allow"`, `"deny"`, ou `"undefined"` |

## Métodos do TokenStore

### `create`

Criar token de autenticação.

```lua
local actor = security.new_actor("user:123", {role = "user"})
local scope, scope_err = security.named_scope("app:default")
if scope_err then
    return nil, scope_err
end
local store, store_err = security.token_store("app:tokens")
if store_err then
    return nil, store_err
end

local token, err = store:create(actor, scope, {
    expiration = "24h",  -- or milliseconds
    meta = {
        login_ip = request_ip,
        user_agent = user_agent
    }
})
store:close()
if err then
    return nil, err
end
return token
```

`request_ip` e `user_agent` são valores de requisição fornecidos pela aplicação. Armazene apenas os metadados necessários às decisões de segurança, aplique limites de retenção e nunca registre nem persista o bearer token retornado fora do credential store previsto.

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `actor` | Actor | Actor para o token |
| `scope` | Scope | Escopo de permissões |
| `options.expiration` | string/number | String de duração ou ms |
| `options.meta` | table | Metadados do token |

**Retorna:** `string, error`

### `validate`

Validar token e obter actor/scope.

```lua
local actor, scope, err = store:validate(token)
store:close()
if err then
    return nil, err
end
```

Aqui e abaixo, `store` é um handle ativo com proprietário e `token` é uma credencial bearer não confiável fornecida pelo chamador. Não registre o token, inclusive em erros de validação ou revogação.

**Retorna:** `Actor, Scope, error`

### `revoke`

Invalidar um token.

```lua
local ok, err = store:revoke(token)
store:close()
if err then
    return nil, err
end
```

**Retorna:** `boolean, error`

### `close`

Liberar o recurso do token store.

```lua
store:close()
```

**Retorna:** `boolean`

## Permissões

Operações de segurança estao sujeitas a avaliação de política de segurança.

### Acoes de Segurança

| Ação | Recurso | Descrição |
|------|---------|-----------|
| `security.policy.get` | ID da Policy | Acessar definicoes de política |
| `security.policy_group.get` | ID do Grupo | Acessar escopos nomeados |
| `security.scope.create` | `custom` | Criar escopos customizados |
| `security.scope.create` | `with` | Adicionar uma política com `scope:with` |
| `security.scope.create` | `without` | Remover uma política com `scope:without` |
| `security.actor.create` | ID do Actor | Criar actors |
| `security.token_store.get` | ID da Store | Acessar token stores |
| `security.token.validate` | ID da Store | Validar tokens |
| `security.token.create` | ID da Store | Criar tokens |
| `security.token.revoke` | ID da Store | Revogar tokens |

Veja [Modelo de Segurança](system/security.md) para configurar as políticas.

## Erros

| Condição | Tipo | Retentável |
|----------|------|------------|
| Sem contexto | `errors.INTERNAL` | não |
| ID de token store vazio | `errors.INVALID` | não |
| Permissão negada em policy, named scope ou operação de token | `errors.INVALID` | não |
| Construção de actor/scope, alteração de scope ou aquisição de token store negada | gera erro Lua | não |
| Política não encontrada | `errors.INTERNAL` | não |
| Token store não encontrado | `errors.INTERNAL` | não |
| Token store fechado | `errors.INTERNAL` | não |
| Formato de expiração inválido | `errors.INVALID` | não |
| Validação de token falhou | `errors.INTERNAL` | não |

```lua
local store, err = security.token_store("app:tokens")
if err then
    if errors.is(err, errors.INVALID) then
        print("Invalid request:", err:message())
    end
    return nil, err
end
store:close()
```

Veja [Tratamento de Erros](lua/core/errors.md) para trabalhar com erros.

## Veja Também

- [Modelo de Segurança](../../system/security.md) - Configuração de actors, políticas e scopes
- [Middleware HTTP](http/middleware.md) - Firewall de endpoint e recurso
