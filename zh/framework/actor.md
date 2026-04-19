# Actor

`wippy/actor` 模块提供一个基于消息传递的并发库，将 Lua 进程转变为按主题路由的 actor。处理器通过消息主题查找，该库通过单个 `channel.select` 循环对进程收件箱、系统事件、内部异步结果以及任何额外通道进行多路复用。

## 配置

```bash
wippy add wippy/actor
wippy install
```

将该库声明为依赖并在需要的地方导入：

```yaml
- name: dep.actor
  kind: ns.dependency
  component: wippy/actor
  version: "*"

- name: counter_process
  kind: process.lua
  source: file://counter.lua
  method: main
  modules:
    - time
  imports:
    actor: wippy.actor:actor
```

## 基本用法

```lua
local actor = require("actor")

local initial_state = { counter = 0 }

local handlers = {
    increment = function(state, payload, topic, from)
        state.counter = state.counter + (payload.amount or 1)
    end,

    get_count = function(state, payload, topic, from)
        process.send(from, "count_result", { count = state.counter })
    end,

    stop = function(state)
        return actor.exit({ final_count = state.counter })
    end,
}

local function main()
    return actor.new(initial_state, handlers):run()
end

return { main = main }
```

`actor.new(state, handlers)` 返回一个 actor 实例。`run()` 驱动 select 循环，直到某个处理器返回 `actor.exit(...)` 或进程被取消。

## 处理器

`handlers` 表中所有名称不以 `__` 开头的键都是主题处理器。处理器接收 `(state, payload, topic, from)`。

### 特殊处理器

| 名称 | 运行时机 |
|------|--------------|
| `__init` | 在 select 循环开始前运行一次 |
| `__default` | 没有匹配处理器的主题 |
| `__on_event` | 任何进程事件（包括取消） |
| `__on_cancel` | 进程取消事件（在 `__on_event` 之后调用） |
| `__on_internal_message` | `state.async` 传递的结果 |

## 控制流

### Exit

```lua
return actor.exit({ reason = "done", data = state.data })
```

停止循环并用该值解析 `run()`。

### Chain

```lua
return actor.next("process", payload)
```

以新主题重新分发当前消息。如果 `payload` 为 `nil`，则沿用先前的 payload。适用于无需嵌套 `if` 的验证 -> 处理管道。

## 状态方法

`actor.new` 将辅助方法附加到 state 表上。它们在任意处理器中均可用。

| 方法 | 描述 |
|--------|-------------|
| `state.add_handler(topic, fn)` | 在运行时注册处理器 |
| `state.remove_handler(topic)` | 移除先前添加的处理器 |
| `state.register_channel(ch, fn)` | 将额外通道多路复用到循环中；每次接收时运行 `fn(state, value, ok, channel_id)` |
| `state.unregister_channel(ch)` | 停止监听该通道 |
| `state.async(fn)` | 在新协程中运行 `fn`；如果它返回 `actor.next(...)`，结果会回传给 actor |
| `state.wait(topic, timeout_ms)` | 带超时的阻塞等待主题监听；返回 `(value, err)` |
| `state.next(topic, payload)` | `actor.next` 的别名 |

## 事件与取消

循环会自动接收进程事件。重写 `__on_event`（或更具体的 `__on_cancel`）来做出响应：

```lua
__on_cancel = function(state, event, kind, from)
    return actor.exit({ reason = "cancelled", items = state.items })
end,
```

没有自定义处理器时，取消事件仍会终止 actor -- 通过默认的事件绑定 -- 但不会运行自定义清理。

## 完整示例

```lua
local actor = require("actor")

local handlers = {
    __init = function(state)
        state.items = {}
        state.async(function() return actor.next("ready", {}) end)
    end,

    ready = function(state)
        process.send(state.parent, "actor_ready", { pid = process.pid() })
    end,

    subscribe = function(state, _, _, from)
        state.subscriber = from
    end,

    add_item = function(state, payload)
        table.insert(state.items, payload.item)
        return actor.next("notify_change", {})
    end,

    notify_change = function(state)
        if state.subscriber then
            process.send(state.subscriber, "items_changed", { count = #state.items })
        end
    end,

    get_items = function(state, _, _, from)
        process.send(from, "items_list", { items = state.items })
    end,

    __on_cancel = function(state)
        return actor.exit({ items = state.items })
    end,
}

local function main()
    return actor.new({ parent = process.parent() }, handlers):run()
end

return { main = main }
```

## 参见

- [Process](../lua/core/process.md) - 收件箱、事件、send/spawn 原语
- [Channels](../lua/core/channel.md) - 内部使用的通道和 select 原语
- [框架概述](overview.md) - 框架模块使用
