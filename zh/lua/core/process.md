# 进程管理
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>
<secondary-label ref="permissions"/>

启动、监控子进程并与之通信。实现带消息传递、监督和生命周期管理的 Actor 模型模式。

全局变量 `process` 始终可用——无需 `require()`，也不需要列在 `modules:` 中。

## 进程信息

获取当前帧 ID 或进程 ID：

```lua
local frame_id = process.id()  -- 调用链标识符
local pid = process.pid()       -- 进程 ID
```

## 发送消息

通过 PID 或注册名称向进程发送消息：

```lua
local ok, err = process.send(destination, topic, ...)
```

| 参数 | 类型 | 描述 |
|------|------|------|
| `destination` | string | PID 或注册名称 |
| `topic` | string | 主题名称（不能以 `@` 开头） |
| `...` | any | 负载值 |

**权限:** 目标 PID 上的 `process.send`

## 启动进程

```lua
-- 基本启动
local pid, err = process.spawn(id, host, ...)

-- 带监控（接收 EXIT 事件）
local pid, err = process.spawn_monitored(id, host, ...)

-- 带链接（异常退出时接收 LINK_DOWN）
local pid, err = process.spawn_linked(id, host, ...)

-- 同时链接和监控
local pid, err = process.spawn_linked_monitored(id, host, ...)
```

| 参数 | 类型 | 描述 |
|------|------|------|
| `id` | string | 进程源 ID（如 `"app.workers:handler"`） |
| `host` | string | 主机 ID（如 `"app:processes"`） |
| `...` | any | 传递给启动进程的参数 |

**权限:**
- 进程 id 上的 `process.spawn`
- 主机 id 上的 `process.host`
- 进程 id 上的 `process.spawn.monitored`（用于监控变体）
- 进程 id 上的 `process.spawn.linked`（用于链接变体）

## 进程控制

```lua
-- 强制终止进程
local ok, err = process.terminate(destination)

-- 请求优雅取消，可附带可选原因
local ok, err = process.cancel(destination, "shutting down")
```

| 参数 | 类型 | 描述 |
|------|------|------|
| `destination` | string | PID 或注册名称 |
| `reason` | string | 传递给目标的可选原因 |

**权限:** 目标 PID 上的 `process.terminate`、`process.cancel`

## 监控和链接

监控或链接到现有进程：

```lua
-- 监控：目标退出时接收 EXIT 事件
local ok, err = process.monitor(destination)
local ok, err = process.unmonitor(destination)

-- 链接：双向，异常退出时接收 LINK_DOWN
local ok, err = process.link(destination)
local ok, err = process.unlink(destination)
```

**权限:** 目标 PID 上的 `process.monitor`、`process.unmonitor`、`process.link`、`process.unlink`

## 进程选项

```lua
local options = process.get_options()
local ok, err = process.set_options({trap_links = true})
```

| 字段 | 类型 | 描述 |
|------|------|------|
| `trap_links` | boolean | LINK_DOWN 事件是否传递到事件通道 |

## 收件箱和事件

获取接收消息和生命周期事件的通道：

```lua
local inbox = process.inbox()    -- 来自 @inbox 主题的消息对象
local events = process.events()  -- 来自 @events 主题的生命周期事件
```

### 事件类型

| 常量 | 描述 |
|------|------|
| `process.event.CANCEL` | 请求取消 |
| `process.event.EXIT` | 被监控进程退出 |
| `process.event.LINK_DOWN` | 链接进程异常终止 |

### 事件字段

| 字段 | 类型 | 描述 |
|------|------|------|
| `kind` | string | 事件类型常量 |
| `from` | string | 源 PID |
| `result` | table | EXIT 时：`{value: any}` 或 `{error: string}` |
| `reason` | string | CANCEL 时：进程被取消的原因 |

## 主题订阅

订阅自定义主题：

```lua
local ch = process.listen(topic, options)
process.unlisten(ch)
```

| 参数 | 类型 | 描述 |
|------|------|------|
| `topic` | string | 主题名称（不能以 `@` 开头） |
| `options.message` | boolean | 若为 true，接收 Message 对象；若为 false，接收原始负载 |

## 消息对象

从收件箱接收或使用 `{message = true}` 时：

```lua
local msg = inbox:receive()

msg:topic()            -- string: 主题名称
msg:from()             -- string|nil: 发送方 PID
msg:payload()          -- Payload: 包装器（调用 :data() 提取）
msg:payload():data()   -- any: 实际负载值
```

## 同步调用

启动进程，等待其结果并返回：

```lua
local result, err = process.exec(id, host, ...)
```

**权限:** 进程 id 上的 `process.exec`，主机 id 上的 `process.host`

## 进程升级

升级当前进程到新定义同时保留 PID：

```lua
-- 升级到新版本，传递状态
process.upgrade(id, ...)

-- 保持相同定义，用新状态重新运行
process.upgrade(nil, preserved_state)
```

## 上下文启动器

创建带自定义上下文的子进程启动器：

```lua
local spawner = process.with_context({request_id = "123"})
```

**权限:** "context" 上的 `process.context`

### 带选项的启动器

`process.with_options(options)` 创建一个携带启动时选项（如网络选择器）而非上下文值的启动器：

```lua
local spawner = process.with_options({network = "app:tor_proxy"})
```

| 选项 | 类型 | 描述 |
|------|------|------|
| `network` | string | 用于子进程出站连接的 `network.*` 条目的注册表 ID |

**权限:** "context" 上的 `process.context`；选择网络还需要在该网络 ID 上的 `network.select`。

### SpawnBuilder 方法

SpawnBuilder 是不可变的——每个方法返回新实例：

```lua
spawner:with_context(values)      -- 添加上下文值
spawner:with_actor(actor)         -- 设置安全 actor
spawner:with_scope(scope)         -- 设置安全作用域
spawner:with_name(name)           -- 设置进程名称
spawner:with_message(topic, ...)  -- 排队启动后发送的消息
```

**权限:** 对 `:with_actor()` 和 `:with_scope()`，需要 "security" 上的 `process.security`

### 启动器的 Spawn 方法

```lua
spawner:spawn(id, host, ...)
spawner:spawn_monitored(id, host, ...)
spawner:spawn_linked(id, host, ...)
spawner:spawn_linked_monitored(id, host, ...)
```

与模块级 spawn 函数权限相同。

## 名称注册表

以名称注册进程，通过名称而非 PID 访问它。任何接受 `destination` 参数的函数（`send`、`terminate`、`cancel`、`monitor`、`link` 等）都可以接受注册名称代替 PID。

```lua
local ok, err = process.registry.register(name)               -- 自身，本地作用域
local pid, err = process.registry.lookup(name)
local ok, err = process.registry.unregister(name)
```

### 作用域

可选的 `scope` 参数选择名称的一致性保障。默认为 `LOCAL`。四种作用域及其保障在[集群指南](guides/cluster.md#命名与名称作用域)中有详细说明；简要说明：

| 常量 | 可见性 | 保障 |
|------|--------|------|
| `process.registry.LOCAL` | 仅此节点 | 即时，节点本地 |
| `process.registry.EVENTUAL` | 集群范围 | 最终一致（gossip） |
| `process.registry.CONSISTENT` | 集群范围 | 线性化单例（Raft） |
| `process.registry.STRONG` | 集群范围 | 一致 + 所有存活节点确认 |

在独立节点上只有 `LOCAL` 有意义；集群作用域需要[启用集群](guides/cluster.md)。

### register

```lua
local ok, err = process.registry.register(name, scope, pid)
```

| 参数 | 类型 | 必填 | 默认值 | 描述 |
|------|------|------|--------|------|
| `name` | string | 是 | | 要注册的名称 |
| `scope` | number | 否 | `LOCAL` | 上述作用域常量之一 |
| `pid` | string | 否 | 自身 | 要注册的 PID；默认为调用进程 |

成功返回 `true`，失败返回 `nil, error`。冲突（名称在集群作用域下已注册给不同 PID）返回 `errors.ALREADY_EXISTS`。将同一名称注册给同一 PID 是幂等的。`STRONG` 注册会阻塞，直到所有存活节点确认或预留截止时间到期；超时返回错误。

代表不同 PID 注册时，还需要在目标 PID 上的 `process.registry.foreign` 权限。

### lookup

```lua
local pid, err = process.registry.lookup(name)
```

返回已注册的 PID 字符串，或在名称未注册时返回 `nil, error`（类型为 `errors.NOT_FOUND`）。

### unregister

```lua
local ok, err = process.registry.unregister(name, scope)
```

`scope` 默认为 `LOCAL`，必须与注册时使用的作用域匹配。对于 `CONSISTENT` 和 `STRONG`，拥有进程才能注销；注销另一个 PID 拥有的名称返回 `false`。当拥有进程退出时（以及对于集群作用域，当其节点离开时），名称也会自动释放，因此显式注销仅用于提前释放。

## 权限

权限控制调用进程可以做什么。所有检查使用调用方的安全上下文（actor）针对目标资源。

### 策略评估

策略可基于以下内容允许/拒绝：
- **Actor**: 发起请求的安全主体
- **Action**: 正在执行的操作（如 `process.send`）
- **Resource**: 目标（PID、进程 id、主机 id 或名称）
- **Attributes**: 附加上下文，包括 `pid`（调用方的进程 ID）

### 权限参考

| 权限 | 函数 | 资源 |
|------|------|------|
| `process.spawn` | `spawn*()` | 进程 id |
| `process.spawn.monitored` | `spawn_monitored()`、`spawn_linked_monitored()` | 进程 id |
| `process.spawn.linked` | `spawn_linked()`、`spawn_linked_monitored()` | 进程 id |
| `process.host` | `spawn*()`、`exec()` | 主机 id |
| `process.send` | `send()` | 目标 PID |
| `process.exec` | `exec()` | 进程 id |
| `process.terminate` | `terminate()` | 目标 PID |
| `process.cancel` | `cancel()` | 目标 PID |
| `process.monitor` | `monitor()` | 目标 PID |
| `process.unmonitor` | `unmonitor()` | 目标 PID |
| `process.link` | `link()` | 目标 PID |
| `process.unlink` | `unlink()` | 目标 PID |
| `process.context` | `with_context()` | "context" |
| `process.security` | `:with_actor()`、`:with_scope()` | "security" |
| `process.registry.register` | `registry.register()` | 名称 |
| `process.registry.unregister` | `registry.unregister()` | 名称 |
| `process.registry.foreign` | `registry.register()` | 目标 PID |

集群名称作用域通过这些操作的作用域后缀变体授权（`process.registry.register.eventual`、`.consistent`、`.strong` 以及对应的 `unregister` 操作），策略可以单独授予本地命名和集群范围命名权限。

### 多重权限

某些操作需要多个权限：

| 操作 | 所需权限 |
|------|---------|
| `spawn()` | `process.spawn` + `process.host` |
| `spawn_monitored()` | `process.spawn` + `process.spawn.monitored` + `process.host` |
| `spawn_linked()` | `process.spawn` + `process.spawn.linked` + `process.host` |
| `spawn_linked_monitored()` | `process.spawn` + `process.spawn.monitored` + `process.spawn.linked` + `process.host` |
| `exec()` | `process.exec` + `process.host` |
| 使用自定义 actor/scope 启动 | spawn 权限 + `process.security` |

## 错误

| 条件 | 类型 |
|------|------|
| 未找到上下文 | `errors.INVALID` |
| 未找到帧上下文 | `errors.INVALID` |
| 缺少必需参数 | `errors.INVALID` |
| 保留主题前缀（`@`） | `errors.INVALID` |
| 无效时长格式 | `errors.INVALID` |
| 名称未注册 | `errors.NOT_FOUND` |
| 权限被拒绝 | `errors.PERMISSION_DENIED` |
| 名称已注册 | `errors.ALREADY_EXISTS` |

错误处理参见[错误处理](lua/core/errors.md)。

## 另请参阅

- [通道](lua/core/channel.md) - 进程间通信
- [消息队列](lua/storage/queue.md) - 基于队列的消息传递
- [函数调用](lua/core/funcs.md) - 函数调用
- [监督](guides/supervision.md) - 进程生命周期管理
- [集群](guides/cluster.md) - 名称作用域与集群范围命名
