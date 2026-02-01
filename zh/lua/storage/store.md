# 键值存储
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>
<secondary-label ref="permissions"/>

支持 TTL 的快速键值存储。适用于缓存、会话和临时状态。

存储配置请参阅 [存储](system/store.md)。

## 加载

```lua
local store = require("store")
```

## 获取存储

通过注册表 ID 获取存储资源：

```lua
local cache, err = store.get("app:cache")
if err then
    return nil, err
end

cache:set("user:123", {name = "Alice"}, 3600)
local user = cache:get("user:123")

cache:release()
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `id` | string | 存储资源 ID |

**返回:** `Store, error`

## 存储值

存储值并可选设置 TTL：

```lua
local cache = store.get("app:cache")

-- 简单设置
cache:set("user:123:name", "Alice")

-- 设置 TTL（300 秒后过期）
cache:set("session:abc", {user_id = 123, role = "admin"}, 300)
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `key` | string | 键 |
| `value` | any | 值（表、字符串、数字、布尔值） |
| `ttl` | number | TTL 秒数（可选，0 = 永不过期） |

**返回:** `boolean, error`

## 获取值

通过键获取值：

```lua
local user = cache:get("user:123")
if not user then
    -- 键不存在或已过期
end
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `key` | string | 要获取的键 |

**返回:** `any, error`

如果键不存在则返回 `nil`。

## 检查存在

检查键是否存在而不获取值：

```lua
if cache:has("lock:" .. resource_id) then
    return nil, errors.new("CONFLICT", "Resource is locked")
end
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `key` | string | 要检查的键 |

**返回:** `boolean, error`

## 删除键

从存储中删除键：

```lua
cache:delete("session:" .. session_id)
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `key` | string | 要删除的键 |

**返回:** `boolean, error`

如果删除成功返回 `true`，如果键不存在返回 `false`。

## 存储方法

| 方法 | 返回 | 描述 |
|--------|---------|-------------|
| `get(key)` | `any, error` | 通过键获取值 |
| `set(key, value, ttl?)` | `boolean, error` | 存储值并可选设置 TTL |
| `has(key)` | `boolean, error` | 检查键是否存在 |
| `delete(key)` | `boolean, error` | 删除键 |
| `release()` | `boolean` | 将存储释放回池 |

## 权限

存储操作受安全策略评估约束。

| 操作 | 资源 | 属性 | 描述 |
|--------|----------|------------|-------------|
| `store.get` | 存储 ID | - | 获取存储资源 |
| `store.key.get` | 存储 ID | `key` | 读取键值 |
| `store.key.set` | 存储 ID | `key` | 写入键值 |
| `store.key.delete` | 存储 ID | `key` | 删除键 |
| `store.key.has` | 存储 ID | `key` | 检查键是否存在 |

## 错误

| 条件 | 类型 | 可重试 |
|-----------|------|-----------|
| 资源 ID 为空 | `errors.INVALID` | 否 |
| 资源未找到 | `errors.NOT_FOUND` | 否 |
| 存储已释放 | `errors.INVALID` | 否 |
| 权限被拒绝 | `errors.PERMISSION_DENIED` | 否 |

错误处理请参阅 [错误处理](lua/core/errors.md)。
