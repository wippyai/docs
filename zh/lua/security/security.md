# 安全与访问控制
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="permissions"/>

管理认证主体、授权范围和访问策略。

## 加载

```lua
local security = require("security")
```

## actor

返回执行上下文中的当前安全主体。

```lua
local actor = security.actor()
if actor then
    local id = actor:id()
    local meta = actor:meta()

    logger:info("Request from", {
        user_id = id,
        role = meta.role
    })
end
```

**返回值:** `Actor|nil`

## scope

返回执行上下文中的当前安全范围。

```lua
local scope = security.scope()
if scope then
    local policies = scope:policies()
    for _, policy in ipairs(policies) do
        print("Active policy:", policy:id())
    end
end
```

**返回值:** `Scope|nil`

## can

检查当前上下文是否允许对资源执行某个操作。

```lua
-- 检查读取权限
if not security.can("read", "user:" .. user_id) then
    return nil, errors.new("PERMISSION_DENIED", "Cannot read user data")
end

-- 检查写入权限
if not security.can("write", "order:" .. order_id) then
    return nil, errors.new("PERMISSION_DENIED", "Cannot modify order")
end

-- 带元数据检查
local allowed = security.can("delete", "document:" .. doc_id, {
    owner_id = doc.owner_id,
    department = doc.department
})
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `action` | string | 要检查的操作 |
| `resource` | string | 资源标识符 |
| `meta` | table | 附加元数据（可选） |

**返回值:** `boolean`

## new_actor

使用 ID 和元数据创建新主体。

```lua
-- 创建用户主体
local actor = security.new_actor("user:" .. user.id, {
    role = user.role,
    department = user.department,
    email = user.email
})

-- 创建服务主体
local service_actor = security.new_actor("service:payment-processor", {
    type = "service",
    version = "1.0.0"
})
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `id` | string | 唯一主体标识符 |
| `meta` | table | 元数据键值对 |

**返回值:** `Actor`

## new_scope

创建新的自定义范围。

```lua
-- 空范围
local scope = security.new_scope()

-- 带策略的范围
local read_policy = security.policy("app:read-only")
local scope = security.new_scope({read_policy})

-- 增量构建范围
local scope = security.new_scope()
local policy1 = security.policy("app:read")
local policy2 = security.policy("app:write")
scope = scope:with(policy1):with(policy2)
```

**返回值:** `Scope`

## policy

从注册表中获取策略。

```lua
local policy, err = security.policy("app:admin-access")
if err then
    return nil, err
end

-- 评估策略
local result = policy:evaluate(actor, "delete", "user:123")
if result == "allow" then
    -- 允许
elseif result == "deny" then
    -- 禁止
else
    -- 未定义，检查其他策略
end
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `id` | string | 策略 ID "namespace:name" |

**返回值:** `Policy, error`

## named_scope

获取预定义的策略组。

```lua
-- 获取管理员范围
local admin_scope, err = security.named_scope("app:admin")
if err then
    return nil, err
end

-- 用于提升权限的操作
local result = admin_scope:evaluate(actor, "delete", "user:123")
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `id` | string | 策略组 ID |

**返回值:** `Scope, error`

## token_store

获取用于管理认证令牌的令牌存储。

```lua
local store, err = security.token_store("app:tokens")
if err then
    return nil, err
end

-- 使用存储...
store:close()
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `id` | string | 令牌存储 ID "namespace:name" |

**返回值:** `TokenStore, error`

## Actor 方法

| 方法 | 返回值 | 描述 |
|--------|---------|-------------|
| `actor:id()` | string | 主体标识符 |
| `actor:meta()` | table | 主体元数据 |

## Scope 方法

### with / without

向范围添加或移除策略。

```lua
local scope = security.new_scope()

-- 添加策略
local write_policy = security.policy("app:write")
scope = scope:with(write_policy)

-- 移除策略
scope = scope:without("app:read-only")
```

### evaluate

评估范围内的所有策略。

```lua
local result = scope:evaluate(actor, "read", "document:123")
-- "allow", "deny", 或 "undefined"

if result ~= "allow" then
    return nil, errors.new("PERMISSION_DENIED", "Access denied")
end
```

### contains

检查范围是否包含某个策略。

```lua
if scope:contains("app:admin") then
    show_admin_features()
end
```

### policies

返回范围内的所有策略。

```lua
local policies = scope:policies()
for _, policy in ipairs(policies) do
    print(policy:id())
end
```

**返回值:** `Policy[]`

## Policy 方法

| 方法 | 返回值 | 描述 |
|--------|---------|-------------|
| `policy:id()` | string | 策略标识符 |
| `policy:evaluate(actor, action, resource, meta?)` | string | `"allow"`, `"deny"`, 或 `"undefined"` |

## TokenStore 方法

### create

创建认证令牌。

```lua
local actor = security.new_actor("user:123", {role = "user"})
local scope = security.named_scope("app:default")

local token, err = store:create(actor, scope, {
    expiration = "24h",  -- 或毫秒
    meta = {
        login_ip = request_ip,
        user_agent = user_agent
    }
})
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `actor` | Actor | 令牌的主体 |
| `scope` | Scope | 权限范围 |
| `options.expiration` | string/number | 持续时间字符串或毫秒 |
| `options.meta` | table | 令牌元数据 |

**返回值:** `string, error`

### validate

验证令牌并获取主体/范围。

```lua
local actor, scope, err = store:validate(token)
if err then
    return nil, errors.new("UNAUTHENTICATED", "Invalid token")
end
```

**返回值:** `Actor, Scope, error`

### revoke

使令牌失效。

```lua
local ok, err = store:revoke(token)
```

**返回值:** `boolean, error`

### close

释放令牌存储资源。

```lua
store:close()
```

**返回值:** `boolean`

## 权限

安全操作受安全策略评估约束。

### 安全操作

| 操作 | 资源 | 描述 |
|--------|----------|-------------|
| `security.policy.get` | Policy ID | 访问策略定义 |
| `security.policy_group.get` | Group ID | 访问命名范围 |
| `security.scope.create` | `custom` | 创建自定义范围 |
| `security.actor.create` | Actor ID | 创建主体 |
| `security.token_store.get` | Store ID | 访问令牌存储 |
| `security.token.validate` | Store ID | 验证令牌 |
| `security.token.create` | Store ID | 创建令牌 |
| `security.token.revoke` | Store ID | 撤销令牌 |

关于策略配置，请参见 [安全模型](system/security.md)。

## 错误

| 条件 | 类型 | 可重试 |
|-----------|------|-----------|
| 无上下文 | `errors.INTERNAL` | 否 |
| 令牌存储 ID 为空 | `errors.INVALID` | 否 |
| 权限被拒绝 | `errors.INVALID` | 否 |
| 策略未找到 | `errors.INTERNAL` | 否 |
| 令牌存储未找到 | `errors.INTERNAL` | 否 |
| 令牌存储已关闭 | `errors.INTERNAL` | 否 |
| 无效的过期格式 | `errors.INVALID` | 否 |
| 令牌验证失败 | `errors.INTERNAL` | 否 |

```lua
local store, err = security.token_store("app:tokens")
if err then
    if errors.is(err, errors.INVALID) then
        print("Invalid request:", err:message())
    end
    return nil, err
end
```

参见 [错误处理](lua/core/errors.md) 了解如何处理错误。

## 参见

- [安全模型](system/security.md) - 主体、策略、范围配置
- [HTTP 中间件](http/middleware.md) - 端点和资源防火墙
