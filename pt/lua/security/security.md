# Segurança & Controle de Acesso
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="permissions"/>

Gerencie actors de autenticação, escopos de autorização e políticas de acesso.

## Carregamento

```lua
local security = require("security")
```

## actor

Retorna o actor de segurança atual do contexto de execução.

```lua
local actor = security.actor()
if actor then
    local id = actor:id()
    local meta = actor:meta()

    logger:info("Request de", {
        user_id = id,
        role = meta.role
    })
end
```

**Retorna:** `Actor|nil`

## scope

Retorna o escopo de segurança atual do contexto de execução.

```lua
local scope = security.scope()
if scope then
    local policies = scope:policies()
    for _, policy in ipairs(policies) do
        print("Política ativa:", policy:id())
    end
end
```

**Retorna:** `Scope|nil`

## can

Verifica se o contexto atual permite uma ação em um recurso.

```lua
-- Verificar permissão de leitura
if not security.can("read", "user:" .. user_id) then
    return nil, errors.new("PERMISSION_DENIED", "Não pode ler dados do usuário")
end

-- Verificar permissão de escrita
if not security.can("write", "order:" .. order_id) then
    return nil, errors.new("PERMISSION_DENIED", "Não pode modificar pedido")
end

-- Verificar com metadados
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

## new_actor

Cria um novo actor com ID e metadados.

```lua
-- Criar actor de usuário
local actor = security.new_actor("user:" .. user.id, {
    role = user.role,
    department = user.department,
    email = user.email
})

-- Criar actor de servico
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

## new_scope

Cria um novo escopo customizado.

```lua
-- Escopo vazio
local scope = security.new_scope()

-- Escopo com políticas
local read_policy = security.policy("app:read-only")
local scope = security.new_scope({read_policy})

-- Construir escopo incrementalmente
local scope = security.new_scope()
local policy1 = security.policy("app:read")
local policy2 = security.policy("app:write")
scope = scope:with(policy1):with(policy2)
```

**Retorna:** `Scope`

## policy

Obtem uma política do registry.

```lua
local policy, err = security.policy("app:admin-access")
if err then
    return nil, err
end

-- Avaliar política
local result = policy:evaluate(actor, "delete", "user:123")
if result == "allow" then
    -- permitido
elseif result == "deny" then
    -- proibido
else
    -- undefined, verificar outras políticas
end
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `id` | string | ID da política "namespace:nome" |

**Retorna:** `Policy, error`

## named_scope

Obtem um grupo de políticas pre-definido.

```lua
-- Obter escopo admin
local admin_scope, err = security.named_scope("app:admin")
if err then
    return nil, err
end

-- Usar para operações elevadas
local result = admin_scope:evaluate(actor, "delete", "user:123")
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `id` | string | ID do grupo de políticas |

**Retorna:** `Scope, error`

## token_store

Obtem um token store para gerenciar tokens de autenticação.

```lua
local store, err = security.token_store("app:tokens")
if err then
    return nil, err
end

-- Usar store...
store:close()
```

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

### with / without

Adiciona ou remove políticas do escopo.

```lua
local scope = security.new_scope()

-- Adicionar política
local write_policy = security.policy("app:write")
scope = scope:with(write_policy)

-- Remover política
scope = scope:without("app:read-only")
```

### evaluate

Avalia todas as políticas no escopo.

```lua
local result = scope:evaluate(actor, "read", "document:123")
-- "allow", "deny", ou "undefined"

if result ~= "allow" then
    return nil, errors.new("PERMISSION_DENIED", "Acesso negado")
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

### create

Criar token de autenticação.

```lua
local actor = security.new_actor("user:123", {role = "user"})
local scope = security.named_scope("app:default")

local token, err = store:create(actor, scope, {
    expiration = "24h",  -- ou milissegundos
    meta = {
        login_ip = request_ip,
        user_agent = user_agent
    }
})
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `actor` | Actor | Actor para o token |
| `scope` | Scope | Escopo de permissões |
| `options.expiration` | string/number | String de duração ou ms |
| `options.meta` | table | Metadados do token |

**Retorna:** `string, error`

### validate

Validar token e obter actor/scope.

```lua
local actor, scope, err = store:validate(token)
if err then
    return nil, errors.new("UNAUTHENTICATED", "Token inválido")
end
```

**Retorna:** `Actor, Scope, error`

### revoke

Invalidar um token.

```lua
local ok, err = store:revoke(token)
```

**Retorna:** `boolean, error`

### close

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
| `security.actor.create` | ID do Actor | Criar actors |
| `security.token_store.get` | ID da Store | Acessar token stores |
| `security.token.validate` | ID da Store | Validar tokens |
| `security.token.create` | ID da Store | Criar tokens |
| `security.token.revoke` | ID da Store | Revogar tokens |

Veja [Security Model](system-security.md) para configuração de políticas.

## Erros

| Condição | Tipo | Retentável |
|----------|------|------------|
| Sem contexto | `errors.INTERNAL` | não |
| ID de token store vazio | `errors.INVALID` | não |
| Permissão negada | `errors.INVALID` | não |
| Política não encontrada | `errors.INTERNAL` | não |
| Token store não encontrado | `errors.INTERNAL` | não |
| Token store fechado | `errors.INTERNAL` | não |
| Formato de expiração inválido | `errors.INVALID` | não |
| Validação de token falhou | `errors.INTERNAL` | não |

```lua
local store, err = security.token_store("app:tokens")
if err then
    if errors.is(err, errors.INVALID) then
        print("Requisição invalida:", err:message())
    end
    return nil, err
end
```

Veja [Error Handling](lua-errors.md) para trabalhar com erros.

## Veja Também

- [Security Model](system-security.md) - Configuração de actors, políticas, escopos
- [HTTP Middleware](http-middleware.md) - Endpoint e resource firewall
