# Security 模型

Wippy 实现基于属性的访问控制。每个请求携带一个 actor（谁）和一个 scope（应用哪些策略）。策略根据 action、resource 以及来自 actor 和 resource 的元数据评估访问权限。

```
Actor + Scope ──► Policy Evaluation ──► Allow/Deny
     │                   │
  Identity          Conditions
  Metadata      (actor, resource, action)
```

## Entry 类型

| Kind | 描述 |
|------|------|
| `security.policy` | 带条件的声明式策略 |
| `security.policy.expr` | 基于表达式的策略 |
| `security.token_store` | Token 存储和验证 |

## Actors

Actor 表示执行操作的主体。

```lua
local security = require("security")

-- Create actor with metadata
local actor = security.new_actor("user:123", {
    role = "admin",
    team = "backend",
    department = "engineering",
    clearance = 3
})

-- Access actor properties
local id = actor:id()        -- "user:123"
local meta = actor:meta()    -- {role="admin", ...}
```

### 上下文中的 Actor

```lua
-- Get current actor from context
local actor = security.actor()
if not actor then
    return nil, errors.new("UNAUTHORIZED", "No actor in context")
end
```

## Policies

策略定义访问规则，包含 actions、resources、conditions 和 effects。

### 声明式策略

```yaml
# src/security/_index.yaml
version: "1.0"
namespace: app.security

entries:
  # Admin full access
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

  # Read-only access
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

  # Resource owner access
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

  # Deny confidential without clearance
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

### 策略结构

```yaml
policy:
  actions: "*" | "action" | ["action1", "action2"]
  resources: "*" | "resource" | ["res1", "res2"]
  effect: allow | deny
  conditions:  # Optional
    - field: "field.path"
      operator: "eq"
      value: "static_value"
      # OR
      value_from: "other.field.path"
```

### 基于表达式的策略

对于复杂逻辑，使用表达式策略：

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

## Conditions

条件允许基于 actor、action、resource 和元数据进行动态策略评估。

### 字段路径

| 路径 | 描述 |
|------|------|
| `actor.id` | Actor 的唯一标识符 |
| `actor.meta.*` | Actor 元数据（支持嵌套） |
| `action` | 正在执行的操作 |
| `resource` | 资源标识符 |
| `meta.*` | 资源元数据 |

### 运算符

| 运算符 | 描述 | 示例 |
|--------|------|------|
| `eq` | 等于 | `actor.meta.role eq "admin"` |
| `ne` | 不等于 | `meta.status ne "deleted"` |
| `lt` | 小于 | `meta.priority lt 5` |
| `gt` | 大于 | `actor.meta.clearance gt 2` |
| `lte` | 小于等于 | `meta.size lte 1000` |
| `gte` | 大于等于 | `actor.meta.level gte 3` |
| `in` | 值在数组中 | `action in ["read", "write"]` |
| `nin` | 值不在数组中 | `meta.status nin ["deleted", "archived"]` |
| `exists` | 字段存在 | `meta.owner exists true` |
| `nexists` | 字段不存在 | `meta.deleted nexists true` |
| `contains` | 字符串包含 | `resource contains "sensitive"` |
| `ncontains` | 字符串不包含 | `resource ncontains "public"` |
| `matches` | 正则匹配 | `resource matches "^doc:.*"` |
| `nmatches` | 正则不匹配 | `actor.id nmatches "^system:.*"` |

### 条件示例

```yaml
# Match actor role
conditions:
  - field: actor.meta.role
    operator: eq
    value: admin

# Compare fields
conditions:
  - field: meta.owner
    operator: eq
    value_from: actor.id

# Numeric comparison
conditions:
  - field: actor.meta.clearance
    operator: gte
    value: 3

# Array membership
conditions:
  - field: actor.meta.role
    operator: in
    value:
      - admin
      - moderator

# Pattern matching
conditions:
  - field: resource
    operator: matches
    value: "^api:/v[0-9]+/admin/.*"

# Multiple conditions (AND)
conditions:
  - field: actor.meta.department
    operator: eq
    value: engineering
  - field: meta.environment
    operator: eq
    value: production
```

## Scopes

Scope 将多个策略组合成一个安全上下文。

```lua
local security = require("security")

-- Get policies
local admin_policy = security.policy("app.security:admin_policy")
local readonly_policy = security.policy("app.security:readonly_policy")

-- Create scope with policies
local scope = security.new_scope()
scope = scope:with(admin_policy)
scope = scope:with(readonly_policy)

-- Scopes are immutable - :with() returns new scope
```

### 命名 Scope（策略组）

从组加载所有策略：

```lua
-- Load scope with all policies in group
local scope, err = security.named_scope("app.security:admin")
```

策略通过 `groups` 字段分配到组：

```yaml
- name: admin_policy
  kind: security.policy
  policy:
    # ...
  groups:
    - admin      # This policy is in "admin" group
    - default    # Can be in multiple groups
```

### Scope 操作

```lua
-- Add policy
local new_scope = scope:with(policy)

-- Remove policy
local new_scope = scope:without("app.security:temp_policy")

-- Check if policy is in scope
local has = scope:contains("app.security:admin_policy")

-- Get all policies
local policies = scope:policies()
```

## 策略评估

### 评估流程

```
1. Check each policy in scope
2. If ANY policy returns Deny → Result is Deny
3. If at least one Allow and no Deny → Result is Allow
4. No applicable policies → Result is Undefined
```

### 评估结果

| 结果 | 含义 |
|------|------|
| `allow` | 访问已授权 |
| `deny` | 访问被明确拒绝 |
| `undefined` | 没有策略匹配 |

```lua
-- Evaluate directly
local result = scope:evaluate(actor, "read", "document:123", {
    owner = "user:456",
    classification = "internal"
})

if result == "deny" then
    return nil, errors.new("FORBIDDEN", "Access denied")
elseif result == "undefined" then
    -- No policy matched - depends on strict mode
end
```

### 快速权限检查

```lua
-- Check against current context's actor and scope
local allowed = security.can("read", "document:123", {
    owner = "user:456"
})

if not allowed then
    return nil, errors.new("FORBIDDEN", "Access denied")
end
```

## Token Stores

Token store 提供安全的 token 创建、验证和撤销。

### 配置

```yaml
# src/auth/_index.yaml
version: "1.0"
namespace: app.auth

entries:
  # Register environment variable
  - name: os_env
    kind: env.storage.os

  - name: AUTH_SECRET_KEY
    kind: env.variable
    variable: AUTH_SECRET_KEY
    storage: app.auth:os_env

  # Backing store for tokens
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

### Token Store 选项

| 选项 | 默认值 | 描述 |
|------|--------|------|
| `store` | required | 后端键值存储引用 |
| `token_length` | 32 | Token 大小（字节，256 位） |
| `default_expiration` | 24h | 默认 token TTL |
| `token_key` | none | HMAC-SHA256 签名密钥（直接值） |
| `token_key_env` | none | 签名密钥的环境变量名 |

在生产环境中使用 `token_key_env` 以避免在 entry 中嵌入密钥。参见 [Environment 系统](system/env.md) 了解环境变量注册。

### 创建 Token

```lua
local security = require("security")

-- Get token store
local store, err = security.token_store("app.auth:tokens")
if err then
    return nil, err
end

-- Create actor and scope
local actor = security.new_actor("user:123", {
    role = "user",
    email = "user@example.com"
})

local scope, _ = security.named_scope("app.security:default")

-- Create token
local token, err = store:create(actor, scope, {
    expiration = "7d",  -- Override default expiration
    meta = {
        device = "mobile",
        ip = "192.168.1.1"
    }
})

if err then
    return nil, err
end

-- Token format: base64_token.hmac_signature (if token_key set)
-- Example: "dGVzdHRva2VuMTIz.a1b2c3d4e5f6"
```

### 验证 Token

```lua
-- Validate token
local actor, scope, err = store:validate(token)
if err then
    return nil, errors.new("UNAUTHORIZED", "Invalid token")
end

-- Actor and scope are reconstructed from stored data
print(actor:id())  -- "user:123"
```

### 撤销 Token

```lua
-- Revoke single token
local ok, err = store:revoke(token)

-- Close store when done
store:close()
```

## 上下文传播

安全上下文通过函数调用传播。

### 设置上下文

```lua
local funcs = require("funcs")

-- Call function with security context
local result, err = funcs.new()
    :with_actor(actor)
    :with_scope(scope)
    :call("app.api:protected_endpoint", data)
```

### 上下文继承

| 组件 | 继承 |
|------|------|
| Actor | 是 - 传递给子调用 |
| Scope | 是 - 传递给子调用 |
| Strict mode | 否 - 应用全局 |

函数继承调用者的安全上下文。新生成的进程从头开始。

## 服务级别安全

为服务配置默认安全设置：

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

## Strict 模式

启用 strict 模式，在缺少安全上下文时拒绝访问：

```yaml
# wippy.yaml
security:
  strict_mode: true
```

| 模式 | 缺少上下文 | 行为 |
|------|------------|------|
| Normal | 无 actor/scope | 允许（宽松） |
| Strict | 无 actor/scope | 拒绝（安全默认） |

## 认证流程

HTTP 处理器中的 Token 验证：

```lua
local http = require("http")
local security = require("security")

local function protected_handler()
    local req = http.request()
    local res = http.response()

    -- Extract and validate token
    local auth = req:header("Authorization")
    if not auth then
        return res:set_status(401):write_json({error = "Missing authorization"})
    end

    local token = auth:gsub("^Bearer%s+", "")
    local store, _ = security.token_store("app.auth:tokens")
    local actor, scope, err = store:validate(token)
    if err then
        return res:set_status(401):write_json({error = "Invalid token"})
    end

    -- Check permission
    if not security.can("api.users.read", "users") then
        return res:set_status(403):write_json({error = "Forbidden"})
    end

    res:write_json({user = actor:id()})
end

return { handler = protected_handler }
```

登录时创建 Token：

```lua
local actor = security.new_actor("user:" .. user.id, {role = user.role})
local scope, _ = security.named_scope("app.security:" .. user.role)

local store, _ = security.token_store("app.auth:tokens")
local token, err = store:create(actor, scope, {expiration = "24h"})
```

## 最佳实践

1. **最小权限** - 授予最小必需权限
2. **默认拒绝** - 使用显式允许策略，启用 strict 模式
3. **使用策略组** - 按角色/功能组织策略
4. **签名 Token** - 生产环境始终设置 `token_key_env`
5. **短期过期** - 对敏感操作使用较短的 token 生命周期
6. **基于上下文的条件** - 使用动态条件而非静态策略
7. **审计敏感操作** - 记录安全相关操作

## Security 模块参考

| 函数 | 描述 |
|------|------|
| `security.actor()` | 从上下文获取当前 actor |
| `security.scope()` | 从上下文获取当前 scope |
| `security.can(action, resource, meta?)` | 检查权限 |
| `security.new_actor(id, meta?)` | 创建新 actor |
| `security.new_scope(policies?)` | 创建空或预设的 scope |
| `security.policy(id)` | 通过 ID 获取策略 |
| `security.named_scope(group_id)` | 获取包含所有组策略的 scope |
| `security.token_store(id)` | 获取 token store |
