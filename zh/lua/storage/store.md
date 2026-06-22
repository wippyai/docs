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

## 读取 Entry 元数据

`entry` 返回值及其 `version`——一个用于乐观并发控制的不透明字符串：

```lua
local e, err = cache:entry("user:123")
if e then
    print(e.key, e.value, e.version)
end
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `key` | string | 要读取的键 |

**返回:** `Entry, error` — `{key: string, value: any, version: string}`

## 列出键

按确定的键顺序列出条目，支持分页：

```lua
local page, err = cache:list({ prefix = "session:", limit = 100 })
for _, e in ipairs(page.items) do
    print(e.key, e.value)
end

-- next page
if page.has_more then
    page = cache:list({ prefix = "session:", after = page.cursor })
end
```

| 选项 | 类型 | 描述 |
|--------|------|-------------|
| `prefix` | string | 仅匹配带此前缀的键 |
| `after` | string | 从此游标之后继续（来自上一页） |
| `limit` | integer | 每页最大条目数 |

**返回:** `Page, error` — `{items: Entry[], cursor: string, has_more: boolean}`

## 条件写入

`put` 写入一个值并返回其新的 `Entry`。选项可启用乐观并发控制：

```lua
-- create only if the key does not exist
local e, err = cache:put("lock:job-1", owner, { only_if_absent = true })
if err and err:kind() == "ALREADY_EXISTS" then
    -- someone else holds it
end

-- compare-and-set: write only if the version still matches
local cur = cache:entry("config")
local e2, err2 = cache:put("config", new_value, { if_version = cur.version })
if err2 and err2:kind() == "CONFLICT" then
    -- a concurrent writer changed it; re-read and retry
end
```

| 选项 | 类型 | 描述 |
|--------|------|-------------|
| `ttl` | number | TTL（秒） |
| `only_if_absent` | boolean | 仅当键不存在时写入 |
| `if_version` | string | 仅当当前版本匹配时写入 |

`only_if_absent` 和 `if_version` 互斥。

**返回:** `Entry, error`

<warning>
条件写入要求存储的 <code>info().conditional_put</code> 为 true（内存存储和 <code>store.kv.raft</code> 存储）。在 <code>store.kv.crdt</code> 和 <code>store.sql</code> 上，它们返回 <code>errors.INVALID</code> 错误——需要条件写入时请使用 <code>store.kv.raft</code>。
</warning>

## 存储能力

`info` 报告后端及其支持的功能，使代码可以适配所绑定的任何存储：

```lua
local info = cache:info()
-- info.backend      -> one of store.backend.* (e.g. "kv.raft")
-- info.consistency  -> one of store.consistency.* (e.g. "linearizable")
-- info.durable / info.list / info.versioned / info.conditional_put / info.ttl  (booleans)
```

**返回:** `Info, error` — `{id, backend, consistency, durable, list, versioned, conditional_put, ttl}`

### 常量

| 常量 | 取值 |
|----------|--------|
| `store.backend` | `MEMORY`、`SQL`、`KV_RAFT`、`KV_CRDT`、`UNKNOWN` |
| `store.consistency` | `LINEARIZABLE`、`EVENTUAL`、`LOCAL`、`UNKNOWN` |

```lua
if cache:info().consistency == store.consistency.LINEARIZABLE then
    -- safe to use compare-and-set
end
```

## 存储方法

| 方法 | 返回 | 描述 |
|--------|---------|-------------|
| `get(key)` | `any, error` | 通过键获取值 |
| `entry(key)` | `Entry, error` | 获取值及版本元数据 |
| `set(key, value, ttl?)` | `boolean, error` | 存储值并可选设置 TTL |
| `put(key, value, opts?)` | `Entry, error` | 条件/版本化写入，返回新条目 |
| `list(opts?)` | `Page, error` | 按键顺序分页列出 |
| `has(key)` | `boolean, error` | 检查键是否存在 |
| `delete(key)` | `boolean, error` | 删除键 |
| `info()` | `Info, error` | 后端、一致性及能力标志 |
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

`store.get()` 以及存储句柄上的所有方法（`get`、`set`、`has`、`delete`）都返回结构化错误（使用 `err:kind()`）。

| 条件 | 类型 | 可重试 |
|-----------|------|-----------|
| 资源 ID 为空 | `errors.INVALID` | 否 |
| 资源未找到 | `errors.NOT_FOUND` | 否 |
| 存储已释放 | `errors.INVALID` | 否 |
| 权限被拒绝 | `errors.PERMISSION_DENIED` | 否 |
| `only_if_absent` 且键已存在 | `errors.ALREADY_EXISTS` | 否 |
| `if_version` 不匹配 | `errors.CONFLICT` | 是 |
| 在不支持的存储上进行条件写入 | `errors.INVALID` | 否 |

错误处理请参阅 [错误处理](lua/core/errors.md)。
