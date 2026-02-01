# 进程管理
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>
<secondary-label ref="permissions"/>

启动、监控子进程并与之通信。实现带消息传递、监督和生命周期管理的 Actor 模型模式。

`process` 全局变量始终可用。

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
|-----------|------|-------------|
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
|-----------|------|-------------|
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

-- 请求优雅取消，可选截止时间
local ok, err = process.cancel(destination, "5s")
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `destination` | string | PID 或注册名称 |
| `deadline` | string\|integer | 时长字符串或毫秒数 |

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
|-------|------|-------------|
| `trap_links` | boolean | LINK_DOWN 事件是否传递到事件通道 |

## 收件箱和事件

获取接收消息和生命周期事件的通道：

```lua
local inbox = process.inbox()    -- 来自 @inbox 主题的消息对象
local events = process.events()  -- 来自 @events 主题的生命周期事件
```

### 事件类型

| 常量 | 描述 |
|----------|-------------|
| `process.event.CANCEL` | 请求取消 |
| `process.event.EXIT` | 被监控进程退出 |
| `process.event.LINK_DOWN` | 链接进程异常终止 |

### 事件字段

| 字段 | 类型 | 描述 |
|-------|------|-------------|
| `kind` | string | 事件类型常量 |
| `from` | string | 源 PID |
| `result` | table | EXIT 时: `{value: any}` 或 `{error: string}` |
| `deadline` | string | CANCEL 时: 截止时间戳 |

## 主题订阅

订阅自定义主题：

```lua
local ch = process.listen(topic, options)
process.unlisten(ch)
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `topic` | string | 主题名称（不能以 `@` 开头） |
| `options.message` | boolean | 若为 true，接收 Message 对象；若为 false，接收原始负载 |

## 消息对象

从收件箱接收或使用 `{message = true}` 时：

```lua
local msg = inbox:receive()

msg:topic()    -- string: 主题名称
msg:from()     -- string|nil: 发送方 PID
msg:payload()  -- any: 负载数据
```

## 同步调用

启动进程，等待其结果并返回：

```lua
local result, err = process.call(id, host, ...)
```

**权限:** 进程 id 上的 `process.call`，主机 id 上的 `process.host`

## 进程升级

升级当前进程到新定义同时保留 PID：

```lua
-- 升级到新版本，传递状态
process.upgrade(source, ...)

-- 保持相同定义，用新状态重新运行
process.upgrade(nil, preserved_state)
```

## 上下文启动器

创建带自定义上下文的子进程启动器：

```lua
local spawner = process.with_context({request_id = "123"})
```

**权限:** "context" 上的 `process.context`

### SpawnBuilder 方法

SpawnBuilder 是不可变的 - 每个方法返回新实例：

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

按名称注册和查找进程：

```lua
local ok, err = process.registry.register(name, pid)  -- pid 默认为自己
local pid, err = process.registry.lookup(name)
local ok = process.registry.unregister(name)
```

**权限:** 名称上的 `process.registry.register`、`process.registry.unregister`

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
|------------|-----------|----------|
| `process.spawn` | `spawn*()` | 进程 id |
| `process.spawn.monitored` | `spawn_monitored()`、`spawn_linked_monitored()` | 进程 id |
| `process.spawn.linked` | `spawn_linked()`、`spawn_linked_monitored()` | 进程 id |
| `process.host` | `spawn*()`、`call()` | 主机 id |
| `process.send` | `send()` | 目标 PID |
| `process.call` | `call()` | 进程 id |
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

### 多重权限

某些操作需要多个权限：

| 操作 | 所需权限 |
|-----------|---------------------|
| `spawn()` | `process.spawn` + `process.host` |
| `spawn_monitored()` | `process.spawn` + `process.spawn.monitored` + `process.host` |
| `spawn_linked()` | `process.spawn` + `process.spawn.linked` + `process.host` |
| `spawn_linked_monitored()` | `process.spawn` + `process.spawn.monitored` + `process.spawn.linked` + `process.host` |
| `call()` | `process.call` + `process.host` |
| 使用自定义 actor/scope 启动 | spawn 权限 + `process.security` |

## 错误

| 条件 | 类型 |
|-----------|------|
| 未找到上下文 | `errors.INVALID` |
| 未找到帧上下文 | `errors.INVALID` |
| 缺少必需参数 | `errors.INVALID` |
| 保留主题前缀 (`@`) | `errors.INVALID` |
| 无效时长格式 | `errors.INVALID` |
| 名称未注册 | `errors.NOT_FOUND` |
| 权限被拒绝 | `errors.PERMISSION_DENIED` |
| 名称已注册 | `errors.ALREADY_EXISTS` |

参见 [错误处理](lua/core/errors.md) 了解错误处理方法。

## 参见

- [通道](lua/core/channel.md) - 进程间通信
- [消息队列](lua/storage/queue.md) - 基于队列的消息传递
- [函数调用](lua/core/funcs.md) - 函数调用
- [监督](guides/supervision.md) - 进程生命周期管理
