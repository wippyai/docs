# Modelo de Seguranca

O Wippy implementa controle de acesso baseado em atributos. Toda requisicao carrega um ator (quem) e um escopo (quais politicas se aplicam). Politicas avaliam acesso baseado na acao, recurso e metadados tanto do ator quanto do recurso.

```
Ator + Escopo ──► Avaliacao de Politica ──► Permitir/Negar
     │                   │
  Identidade          Condicoes
  Metadados      (ator, recurso, acao)
```

## Tipos de Entradas

| Tipo | Descricao |
|------|-----------|
| `security.policy` | Politica declarativa com condicoes |
| `security.policy.expr` | Politica baseada em expressao |
| `security.token_store` | Armazenamento e validacao de tokens |

## Atores

Um ator representa quem esta executando uma acao.

```lua
local security = require("security")

-- Cria ator com metadados
local actor = security.new_actor("user:123", {
    role = "admin",
    team = "backend",
    department = "engineering",
    clearance = 3
})

-- Acessa propriedades do ator
local id = actor:id()        -- "user:123"
local meta = actor:meta()    -- {role="admin", ...}
```

### Ator no Contexto

```lua
-- Obtem ator atual do contexto
local actor = security.actor()
if not actor then
    return nil, errors.new("UNAUTHORIZED", "Sem ator no contexto")
end
```

## Politicas

Politicas definem regras de acesso com acoes, recursos, condicoes e efeitos.

### Politica Declarativa

```yaml
# src/security/_index.yaml
version: "1.0"
namespace: app.security

entries:
  # Acesso total de admin
  - name: admin_policy
    kind: security.policy
    policy:
      actions: "*"
      resources: "*"
      effect: allow
      conditions:
        - field: actor.meta.role
          operator: eq
          value: admin
    groups:
      - admin

  # Acesso somente leitura
  - name: readonly_policy
    kind: security.policy
    policy:
      actions:
        - "*.read"
        - "*.get"
        - "*.list"
      resources: "*"
      effect: allow
    groups:
      - default

  # Acesso do proprietario do recurso
  - name: owner_policy
    kind: security.policy
    policy:
      actions:
        - read
        - write
        - delete
      resources: "document:*"
      effect: allow
      conditions:
        - field: meta.owner
          operator: eq
          value_from: actor.id
    groups:
      - default

  # Nega confidencial sem autorizacao
  - name: deny_confidential
    kind: security.policy
    policy:
      actions: "*"
      resources: "document:*"
      effect: deny
      conditions:
        - field: meta.classification
          operator: eq
          value: confidential
        - field: actor.meta.clearance
          operator: lt
          value: 3
    groups:
      - security
```

### Estrutura da Politica

```yaml
policy:
  actions: "*" | "action" | ["action1", "action2"]
  resources: "*" | "resource" | ["res1", "res2"]
  effect: allow | deny
  conditions:  # Opcional
    - field: "field.path"
      operator: "eq"
      value: "static_value"
      # OU
      value_from: "other.field.path"
```

### Politica Baseada em Expressao

Para logica complexa, use politicas de expressao:

```yaml
- name: flexible_access
  kind: security.policy.expr
  policy:
    actions:
      - read
      - write
    resources: "file:*"
    effect: allow
    expression: |
      (actor.meta.role == "editor" && action == "write") ||
      (action == "read" && meta.public == true) ||
      actor.id == meta.owner
  groups:
    - editors
```

## Condicoes

Condicoes permitem avaliacao dinamica de politicas baseada em ator, acao, recurso e metadados.

### Caminhos de Campo

| Caminho | Descricao |
|---------|-----------|
| `actor.id` | Identificador unico do ator |
| `actor.meta.*` | Metadados do ator (suporta aninhamento) |
| `action` | A acao sendo executada |
| `resource` | O identificador do recurso |
| `meta.*` | Metadados do recurso |

### Operadores

| Operador | Descricao | Exemplo |
|----------|-----------|---------|
| `eq` | Igual | `actor.meta.role eq "admin"` |
| `ne` | Diferente | `meta.status ne "deleted"` |
| `lt` | Menor que | `meta.priority lt 5` |
| `gt` | Maior que | `actor.meta.clearance gt 2` |
| `lte` | Menor ou igual | `meta.size lte 1000` |
| `gte` | Maior ou igual | `actor.meta.level gte 3` |
| `in` | Valor em array | `action in ["read", "write"]` |
| `nin` | Valor nao em array | `meta.status nin ["deleted", "archived"]` |
| `exists` | Campo existe | `meta.owner exists true` |
| `nexists` | Campo nao existe | `meta.deleted nexists true` |
| `contains` | String contem | `resource contains "sensitive"` |
| `ncontains` | String nao contem | `resource ncontains "public"` |
| `matches` | Correspondencia regex | `resource matches "^doc:.*"` |
| `nmatches` | Nao corresponde regex | `actor.id nmatches "^system:.*"` |

### Exemplos de Condicoes

```yaml
# Corresponde role do ator
conditions:
  - field: actor.meta.role
    operator: eq
    value: admin

# Compara campos
conditions:
  - field: meta.owner
    operator: eq
    value_from: actor.id

# Comparacao numerica
conditions:
  - field: actor.meta.clearance
    operator: gte
    value: 3

# Pertencimento a array
conditions:
  - field: actor.meta.role
    operator: in
    value:
      - admin
      - moderator

# Correspondencia de padrao
conditions:
  - field: resource
    operator: matches
    value: "^api:/v[0-9]+/admin/.*"

# Multiplas condicoes (AND)
conditions:
  - field: actor.meta.department
    operator: eq
    value: engineering
  - field: meta.environment
    operator: eq
    value: production
```

## Escopos

Escopos combinam multiplas politicas em um contexto de seguranca.

```lua
local security = require("security")

-- Obtem politicas
local admin_policy = security.policy("app.security:admin_policy")
local readonly_policy = security.policy("app.security:readonly_policy")

-- Cria escopo com politicas
local scope = security.new_scope()
scope = scope:with(admin_policy)
scope = scope:with(readonly_policy)

-- Escopos sao imutaveis - :with() retorna novo escopo
```

### Escopos Nomeados (Grupos de Politicas)

Carrega todas as politicas de um grupo:

```lua
-- Carrega escopo com todas as politicas do grupo
local scope, err = security.named_scope("app.security:admin")
```

Politicas sao atribuidas a grupos via campo `groups`:

```yaml
- name: admin_policy
  kind: security.policy
  policy:
    # ...
  groups:
    - admin      # Esta politica esta no grupo "admin"
    - default    # Pode estar em multiplos grupos
```

### Operacoes de Escopo

```lua
-- Adiciona politica
local new_scope = scope:with(policy)

-- Remove politica
local new_scope = scope:without("app.security:temp_policy")

-- Verifica se politica esta no escopo
local has = scope:contains("app.security:admin_policy")

-- Obtem todas as politicas
local policies = scope:policies()
```

## Avaliacao de Politicas

### Fluxo de Avaliacao

```
1. Verifica cada politica no escopo
2. Se QUALQUER politica retorna Deny → Resultado e Deny
3. Se pelo menos um Allow e nenhum Deny → Resultado e Allow
4. Nenhuma politica aplicavel → Resultado e Undefined
```

### Resultados de Avaliacao

| Resultado | Significado |
|-----------|-------------|
| `allow` | Acesso concedido |
| `deny` | Acesso explicitamente negado |
| `undefined` | Nenhuma politica correspondeu |

```lua
-- Avalia diretamente
local result = scope:evaluate(actor, "read", "document:123", {
    owner = "user:456",
    classification = "internal"
})

if result == "deny" then
    return nil, errors.new("FORBIDDEN", "Acesso negado")
elseif result == "undefined" then
    -- Nenhuma politica correspondeu - depende do modo estrito
end
```

### Verificacao Rapida de Permissao

```lua
-- Verifica contra ator e escopo do contexto atual
local allowed = security.can("read", "document:123", {
    owner = "user:456"
})

if not allowed then
    return nil, errors.new("FORBIDDEN", "Acesso negado")
end
```

## Token Stores

Token stores fornecem criacao, validacao e revogacao seguras de tokens.

### Configuracao

```yaml
# src/auth/_index.yaml
version: "1.0"
namespace: app.auth

entries:
  # Registra variavel de ambiente
  - name: os_env
    kind: env.storage.os

  - name: AUTH_SECRET_KEY
    kind: env.variable
    variable: AUTH_SECRET_KEY
    storage: app.auth:os_env

  # Store de apoio para tokens
  - name: token_data
    kind: store.memory
    lifecycle:
      auto_start: true

  # Token store
  - name: tokens
    kind: security.token_store
    store: app.auth:token_data
    token_length: 32
    default_expiration: "24h"
    token_key_env: "AUTH_SECRET_KEY"
```

### Opcoes do Token Store

| Opcao | Padrao | Descricao |
|-------|--------|-----------|
| `store` | obrigatorio | Referencia do store chave-valor de apoio |
| `token_length` | 32 | Tamanho do token em bytes (256 bits) |
| `default_expiration` | 24h | TTL padrao do token |
| `token_key` | nenhum | Chave de assinatura HMAC-SHA256 (valor direto) |
| `token_key_env` | nenhum | Nome da variavel de ambiente para chave de assinatura |

Use `token_key_env` em producao para evitar embutir segredos em entradas. Veja [Sistema de Ambiente](system-env.md) para registrar variaveis de ambiente.

### Criando Tokens

```lua
local security = require("security")

-- Obtem token store
local store, err = security.token_store("app.auth:tokens")
if err then
    return nil, err
end

-- Cria ator e escopo
local actor = security.new_actor("user:123", {
    role = "user",
    email = "user@example.com"
})

local scope, _ = security.named_scope("app.security:default")

-- Cria token
local token, err = store:create(actor, scope, {
    expiration = "7d",  -- Sobrescreve expiracao padrao
    meta = {
        device = "mobile",
        ip = "192.168.1.1"
    }
})

if err then
    return nil, err
end

-- Formato do token: base64_token.hmac_signature (se token_key definido)
-- Exemplo: "dGVzdHRva2VuMTIz.a1b2c3d4e5f6"
```

### Validando Tokens

```lua
-- Valida token
local actor, scope, err = store:validate(token)
if err then
    return nil, errors.new("UNAUTHORIZED", "Token invalido")
end

-- Ator e escopo sao reconstruidos dos dados armazenados
print(actor:id())  -- "user:123"
```

### Revogando Tokens

```lua
-- Revoga token unico
local ok, err = store:revoke(token)

-- Fecha store quando terminar
store:close()
```

## Fluxo de Contexto

O contexto de seguranca se propaga atraves de chamadas de funcao.

### Definindo Contexto

```lua
local funcs = require("funcs")

-- Chama funcao com contexto de seguranca
local result, err = funcs.new()
    :with_actor(actor)
    :with_scope(scope)
    :call("app.api:protected_endpoint", data)
```

### Heranca de Contexto

| Componente | Herda |
|------------|-------|
| Ator | Sim - passa para chamadas filhas |
| Escopo | Sim - passa para chamadas filhas |
| Modo estrito | Nao - aplicacao-wide |

Funcoes herdam contexto de seguranca do chamador. Processos criados iniciam do zero.

## Seguranca em Nivel de Servico

Configure seguranca padrao para servicos:

```yaml
- name: worker_service
  kind: process.lua
  source: file://worker.lua
  lifecycle:
    auto_start: true
    security:
      actor:
        id: "service:worker"
        meta:
          role: worker
          service: true
      policies:
        - app.security:worker_policy
      groups:
        - workers
```

## Modo Estrito

Habilite modo estrito para negar acesso quando contexto de seguranca esta ausente:

```yaml
# wippy.yaml
security:
  strict_mode: true
```

| Modo | Contexto Ausente | Comportamento |
|------|------------------|---------------|
| Normal | Sem ator/escopo | Permite (permissivo) |
| Estrito | Sem ator/escopo | Nega (padrao seguro) |

## Fluxo de Autenticacao

Validacao de token em um handler HTTP:

```lua
local http = require("http")
local security = require("security")

local function protected_handler()
    local req = http.request()
    local res = http.response()

    -- Extrai e valida token
    local auth = req:header("Authorization")
    if not auth then
        return res:set_status(401):write_json({error = "Autorizacao ausente"})
    end

    local token = auth:gsub("^Bearer%s+", "")
    local store, _ = security.token_store("app.auth:tokens")
    local actor, scope, err = store:validate(token)
    if err then
        return res:set_status(401):write_json({error = "Token invalido"})
    end

    -- Verifica permissao
    if not security.can("api.users.read", "users") then
        return res:set_status(403):write_json({error = "Proibido"})
    end

    res:write_json({user = actor:id()})
end

return { handler = protected_handler }
```

Criacao de token durante login:

```lua
local actor = security.new_actor("user:" .. user.id, {role = user.role})
local scope, _ = security.named_scope("app.security:" .. user.role)

local store, _ = security.token_store("app.auth:tokens")
local token, err = store:create(actor, scope, {expiration = "24h"})
```

## Boas Praticas

1. **Menor privilegio** - Conceda permissoes minimas necessarias
2. **Negue por padrao** - Use politicas de allow explicitas, habilite modo estrito
3. **Use grupos de politicas** - Organize politicas por role/funcao
4. **Assine tokens** - Sempre defina `token_key_env` em producao
5. **Expiracao curta** - Use tempos de vida de token mais curtos para operacoes sensiveis
6. **Condicione no contexto** - Use condicoes dinamicas sobre politicas estaticas
7. **Audite acoes sensiveis** - Registre operacoes relevantes para seguranca

## Referencia do Modulo Security

| Funcao | Descricao |
|--------|-----------|
| `security.actor()` | Obtem ator atual do contexto |
| `security.scope()` | Obtem escopo atual do contexto |
| `security.can(action, resource, meta?)` | Verifica permissao |
| `security.new_actor(id, meta?)` | Cria novo ator |
| `security.new_scope(policies?)` | Cria escopo vazio ou semeado |
| `security.policy(id)` | Obtem politica por ID |
| `security.named_scope(group_id)` | Obtem escopo com todas as politicas do grupo |
| `security.token_store(id)` | Obtem token store |
