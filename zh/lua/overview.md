# Lua 运行时

Wippy 的主要计算运行时，针对 I/O 密集型和业务逻辑工作负载进行了优化。代码运行在隔离的进程中，通过消息传递进行通信——无共享内存，无锁。

Wippy 被设计为多语言运行时。虽然 Lua 是主要语言，但未来版本将通过 WebAssembly 和 Temporal 集成支持其他语言，用于计算密集型或专用工作负载。

## 进程

你的 Lua 代码运行在**进程**中——由调度器管理的隔离执行上下文。每个进程：

- 拥有自己的内存空间
- 在阻塞操作时让出（I/O、通道）
- 可以被监控和监管
- 可扩展到每台机器数千个

<note>
典型的 Lua 进程基础内存开销约为 13 KB。
</note>

```lua
local pid = process.spawn("app.workers:handler", "app:processes")
process.send(pid, "task", {data = "work"})
```

参见 [进程管理](lua/core/process.md) 了解生成、链接和监管。

## 通道

Go 风格的通道用于通信：

```lua
local ch = channel.new()        -- 无缓冲
local buffered = channel.new(10)

ch:send(value)                  -- 阻塞直到被接收
local val, ok = ch:receive()    -- 阻塞直到就绪
```

参见 [通道](lua/core/channel.md) 了解 select 和模式。

## 协程

在进程内生成轻量级协程：

```lua
coroutine.spawn(function()
    local data = fetch_data()
    ch:send(data)
end)

do_other_work()  -- 立即继续
```

生成的协程由调度器管理——无需手动 yield/resume。

## Select

处理多个事件源：

```lua
local r = channel.select {
    inbox:case_receive(),
    events:case_receive(),
    timeout:case_receive()
}

if r.channel == timeout then
    -- 超时
elseif r.channel == events then
    handle_event(r.value)
else
    handle_message(r.value)
end
```

## 全局变量

这些总是可用的，无需 require：

- `process` — 进程管理和消息传递
- `channel` — Go 风格的通道
- `os` — 时间和系统函数
- `coroutine` — 轻量级并发

## 模块

```lua
local json = require("json")
local sql = require("sql")
local http = require("http_client")
```

可用模块取决于记录配置。参见 [记录定义](lua/entries.md)。

## 外部库

Wippy 使用 Lua 5.3 语法，带有受 Luau 启发的[渐进类型系统](lua/types.md)。类型是一等运行时值——可调用以进行验证，可作为参数传递，可内省——取代了对 Zod 或 Pydantic 等模式库的需求。

不支持外部 Lua 库（LuaRocks 等）。运行时提供自己的模块系统，带有用于 I/O、网络和系统集成的内置扩展。

对于自定义扩展，参见内部文档中的 [模块](internals/modules.md)。

## 错误处理

函数返回 `result, error` 对：

```lua
local data, err = json.decode(input)
if err then
    return nil, errors.wrap(err, "decode failed")
end
```

参见 [错误处理](lua/core/errors.md) 了解模式。

## 下一步

- [记录定义](lua/entries.md) — 配置入口点
- [通道](lua/core/channel.md) — 通道模式
- [进程管理](lua/core/process.md) — 生成和监管
- [函数](lua/core/funcs.md) — 跨进程调用
