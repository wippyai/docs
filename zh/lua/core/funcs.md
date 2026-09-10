---
title: "函数调用"
description: "在 Wippy 中调用其他函数的主要方式。跨进程同步或异步执行已注册的函数，完全支持上下文传播、安全凭证和超时。此模块是构建需要组件间通信的分布式应用的核心。"
---

# 函数调用
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

在 Wippy 中调用其他函数的主要方式。跨进程同步或异步执行已注册的函数，完全支持上下文传播、安全凭证和超时。此模块是构建需要组件间通信的分布式应用的核心。

## 加载

```lua
local funcs = require("funcs")
```

## call

同步调用已注册的函数。当需要立即获取结果并可以等待时使用。

```lua
local result, err = funcs.call("app.api:get_user", user_id)
if err then
    return nil, err
end
print(result.name)
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `target` | string | 函数 ID，格式为 "namespace:name" |
| `...args` | any | 传递给函数的参数 |

**返回:** `result, error`

目标字符串遵循 `namespace:name` 模式，namespace 标识模块，name 标识具体函数。

## async

启动异步函数调用并立即返回 Future。用于不想阻塞的长时间运行操作，或想并行运行多个操作时。

```lua
-- 启动耗时计算而不阻塞
local future, err = funcs.async("app.process:analyze_data", large_dataset)
if err then
    return nil, err
end

-- 计算运行期间做其他工作...

-- 准备好时等待结果
local ch = future:response()
local payload, ok = ch:receive()
if ok then
    local result = payload:data()
end
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `target` | string | 函数 ID，格式为 "namespace:name" |
| `...args` | any | 传递给函数的参数 |

**返回:** `Future, error`

## new

创建带自定义上下文的 Executor 用于构建函数调用。当需要传播请求上下文、设置安全凭证或配置超时时使用。

```lua
local exec = funcs.new()
```

**返回:** `Executor`

## Executor

带自定义上下文选项的函数调用构建器。方法返回新的 Executor 实例（不可变链式调用），因此可以复用基础配置。

### with_context

添加将对被调用函数可用的上下文值。用于传播请求作用域数据，如跟踪 ID、用户会话或功能标志。

```lua
-- 向下游服务传播请求上下文
local exec = funcs.new():with_context({
    request_id = ctx.get("request_id"),
    feature_flags = {dark_mode = true}
})

local user, err = exec:call("app.api:get_user", user_id)
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `values` | table | 要添加到上下文的键值对 |

**返回:** `Executor, error`

### with_actor

设置被调用函数中授权检查的安全 actor。代表特定用户调用函数时使用。

```lua
local security = require("security")
local actor = security.actor()  -- 获取当前用户的 actor

-- 用用户凭证调用管理函数
local exec = funcs.new():with_actor(actor)
local result, err = exec:call("app.admin:delete_record", record_id)
if err and err:kind() == errors.PERMISSION_DENIED then
    return nil, errors.new({kind = errors.PERMISSION_DENIED, message = "User cannot delete records"})
end
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `actor` | Actor | 安全 actor（来自 security 模块） |

**返回:** `Executor, error`

### with_scope

设置被调用函数的安全作用域。作用域定义调用可用的权限。

```lua
local security = require("security")
local scope = security.new_scope()

local exec = funcs.new():with_scope(scope)
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `scope` | Scope | 安全作用域（来自 security 模块） |

**返回:** `Executor, error`

### with_options

设置调用选项，例如重试策略或叠加网络。这些选项会合并到目标函数条目的预设选项之上。

```lua
-- 以指数退避最多重试 5 次瞬时失败
local exec = funcs.new():with_options({
    retry = { max_attempts = 5, initial_delay = 100 }
})
local result, err = exec:call("app.external:fetch_data", query)
if err then
    -- 所有尝试都失败了，或者该错误不可重试
end
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `options` | table | 调用选项 |

| 选项 | 类型 | 描述 |
|--------|------|-------------|
| `retry.max_attempts` | int | 包含首次在内的最大尝试次数（设为 1 则禁用重试） |
| `retry.initial_delay` | int/duration | 首次重试前的延迟（毫秒或 duration 字符串），默认 `100` |
| `retry.max_delay` | int/duration | 退避延迟的上限（毫秒或 duration 字符串），默认 `10s` |
| `retry.backoff_factor` | number | 每次尝试后应用于延迟的乘数，默认 `2.0` |
| `retry.jitter` | number | 应用于每次延迟的随机抖动比例，默认 `0.1` |
| `retry.retry_kinds` | string[] | 仅重试这些类型的错误；默认除 `Invalid`、`PermissionDenied` 和 `Internal` 之外的所有类型都会重试 |
| `retry.skip_kinds` | string[] | 绝不重试这些类型的错误 |
| `network` | string | 用于路由该调用出站流量的叠加网络的注册表 ID；需要 `network.select` 权限 |

只有可重试的错误才会触发重试；不可重试的错误会立即返回。Temporal 活动选项在[活动](temporal/activities.md)中描述。

**返回:** `Executor, error`

### call / async

使用配置的上下文的 Executor 版本的 call 和 async。

```lua
-- 构建带上下文的可复用 executor
local exec = funcs.new()
    :with_context({trace_id = "abc-123"})
    :with_options({retry = {max_attempts = 3}})

-- 使用相同上下文进行多次调用
local users, _ = exec:call("app.api:list_users")
local posts, _ = exec:call("app.api:list_posts")
```

## Future

由 `async()` 调用返回。表示进行中的异步操作。

### response / channel

返回用于接收结果的底层通道。

```lua
local future, _ = funcs.async("app.api:slow_operation", data)
local ch = future:response()  -- 或 future:channel()

local result = channel.select {
    ch:case_receive(),
    timeout:case_receive()
}
```

**返回:** `Channel`

### is_complete

非阻塞检查 future 是否已完成。

```lua
while not future:is_complete() do
    -- 做其他工作
    time.sleep("100ms")
end
local result, err = future:result()
```

**返回:** `boolean`

### is_canceled

返回是否对此 future 调用了 `cancel()`。

```lua
if future:is_canceled() then
    print("Operation was canceled")
end
```

**返回:** `boolean`

### result

返回缓存的结果（若已完成），或仍在等待时返回 nil。

```lua
local value, err = future:result()
if err then
    print("Failed:", err:message())
elseif value then
    print("Got:", value:data())
end
```

**返回:** `Payload|nil, error|nil`

### error

返回 future 失败时的错误。

```lua
local err, has_error = future:error()
if has_error then
    print("Error kind:", err:kind())
end
```

**返回:** `error|nil, boolean`

### cancel

取消异步操作。

```lua
future:cancel()
```

**返回:** `boolean, error`

## 并行操作

使用 async 和 channel.select 并发运行多个操作。

```lua
-- 并行启动多个操作
local f1, _ = funcs.async("app.api:get_user", user_id)
local f2, _ = funcs.async("app.api:get_orders", user_id)
local f3, _ = funcs.async("app.api:get_preferences", user_id)

-- 使用通道等待全部完成
local user_ch = f1:channel()
local orders_ch = f2:channel()
local prefs_ch = f3:channel()

local results = {}
for i = 1, 3 do
    local r = channel.select {
        user_ch:case_receive(),
        orders_ch:case_receive(),
        prefs_ch:case_receive()
    }
    if r.channel == user_ch then
        results.user = r.value:data()
    elseif r.channel == orders_ch then
        results.orders = r.value:data()
    else
        results.prefs = r.value:data()
    end
end
```

## 权限

函数操作受安全策略评估约束。

| 动作 | 资源 | 描述 |
|--------|----------|-------------|
| `funcs.call` | 函数 ID | 调用特定函数 |
| `funcs.context` | `context` | 使用 `with_context()` 设置自定义上下文 |
| `funcs.security` | `security` | 使用 `with_actor()` 或 `with_scope()` |
| `network.select` | 网络 ID | 使用 `with_options({network = ...})` 选择叠加网络 |

## 错误

| 条件 | 类型 | 可重试 |
|-----------|------|-----------|
| 目标为空 | `errors.INVALID` | 否 |
| 缺少命名空间 | `errors.INVALID` | 否 |
| 缺少名称 | `errors.INVALID` | 否 |
| 权限被拒绝 | `errors.PERMISSION_DENIED` | 否 |
| 在进程之外使用 async | `errors.INTERNAL` | 否 |
| 订阅失败 | `errors.INTERNAL` | 否 |
| 函数错误 | 各异 | 各异 |

参见 [错误处理](lua/core/errors.md) 了解错误处理方法。
