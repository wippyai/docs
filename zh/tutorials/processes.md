# 进程和消息传递

生成隔离的进程并通过消息传递进行通信。

## 概述

进程提供通过消息传递进行通信的隔离执行单元。每个进程都有自己的收件箱，可以订阅特定的消息主题。

关键概念：
- 使用 `process.spawn()` 及其变体生成进程
- 通过主题向 PID 或注册名称发送消息
- 使用 `process.listen()` 或 `process.inbox()` 接收消息
- 通过事件监控进程生命周期
- 链接进程以协调故障处理

## 生成进程

从条目引用生成新进程。

```lua
local pid, err = process.spawn("app.test.process:echo_worker", "app:processes", "hello")
if err then
    return false, "spawn failed: " .. err
end

-- pid 是生成进程的字符串标识符
print("Started worker:", pid)
```

参数：
- 条目引用（如 `"app.test.process:echo_worker"`）
- 宿主引用（如 `"app:processes"`）
- 传递给 worker main 函数的可选参数

### 获取自己的 PID

```lua
local my_pid = process.pid()
-- 返回当前进程的字符串 PID
```

## 消息传递

消息使用基于主题的路由系统。通过主题向 PID 发送消息，然后通过主题订阅或收件箱接收。

### 发送消息

```lua
-- 通过 PID 发送到进程
local sent, err = process.send(worker_pid, "messages", "hello from parent")
if err then
    return false, "send failed: " .. err
end

-- send 返回 (bool, error)
```

### 通过主题订阅接收

使用 `process.listen()` 订阅特定主题：

```lua
-- 监听 "messages" 主题消息的 Worker
local function main()
    local ch = process.listen("messages")

    local msg = ch:receive()
    if msg then
        -- msg 直接是负载
        print("Received:", msg)
        return true
    end

    return false
end

return { main = main }
```

### 通过收件箱接收

收件箱接收不匹配任何主题监听器的消息：

```lua
local function main()
    local inbox_ch = process.inbox()
    local specific_ch = process.listen("specific_topic")

    while true do
        local result = channel.select({
            specific_ch:case_receive(),
            inbox_ch:case_receive()
        })

        if result.channel == specific_ch then
            -- 发送到 "specific_topic" 的消息到达这里
            local payload = result.value
        elseif result.channel == inbox_ch then
            -- 发送到任何其他主题的消息到达这里
            local msg = result.value
            print("Inbox got:", msg.topic, msg.payload)
        end
    end
end
```

### 消息模式获取发送者信息

使用 `{ message = true }` 访问发送者 PID 和主题：

```lua
-- 将消息回传给发送者的 Worker
local function main()
    local ch = process.listen("echo", { message = true })

    local msg = ch:receive()
    if msg then
        local sender = msg:from()
        local payload = msg:payload()

        if sender then
            process.send(sender, "reply", payload)
        end
        return true
    end

    return false
end

return { main = main }
```

## 监控进程

监控进程以在其终止时接收 EXIT 事件。

### 带监控的生成

```lua
local events_ch = process.events()

local worker_pid, err = process.spawn_monitored(
    "app.test.process:events_exit_worker",
    "app:processes"
)
if err then
    return false, "spawn failed: " .. err
end

-- 等待 EXIT 事件
local timeout = time.after("3s")
local result = channel.select {
    events_ch:case_receive(),
    timeout:case_receive(),
}

if result.channel == timeout then
    return false, "timeout waiting for EXIT event"
end

local event = result.value
if event.kind == process.event.EXIT then
    print("Worker exited:", event.from)
    if event.error then
        print("Exit error:", event.error)
    end
    -- 通过 event.result 访问返回值
end
```

### 显式监控

监控已经运行的进程：

```lua
local events_ch = process.events()

-- 不带监控的生成
local worker_pid, err = process.spawn("app.test.process:long_worker", "app:processes")
if err then
    return false, "spawn failed: " .. err
end

-- 显式添加监控
local ok, monitor_err = process.monitor(worker_pid)
if monitor_err then
    return false, "monitor failed: " .. monitor_err
end

-- 现在将接收此 worker 的 EXIT 事件
```

停止监控：

```lua
local ok, err = process.unmonitor(worker_pid)
```

## 进程链接

链接进程以协调生命周期管理。当链接的进程失败时，链接的进程会收到 LINK_DOWN 事件。

### 生成链接的进程

```lua
-- 如果父进程崩溃，子进程终止（除非设置了 trap_links）
local pid, err = process.spawn_linked("app.test.process:child_worker", "app:processes")
if err then
    return false, "spawn_linked failed: " .. err
end
```

### 显式链接

```lua
-- 链接到现有进程
local ok, err = process.link(target_pid)
if err then
    return false, "link failed: " .. err
end

-- 取消链接
local ok, err = process.unlink(target_pid)
```

### 处理 LINK_DOWN 事件

默认情况下，LINK_DOWN 导致进程失败。启用 `trap_links` 将其作为事件接收：

```lua
local function main()
    -- 启用 trap_links 以接收 LINK_DOWN 事件而不是崩溃
    local ok, err = process.set_options({ trap_links = true })
    if not ok then
        return false, "set_options failed: " .. err
    end

    -- 验证 trap_links 已启用
    local opts = process.get_options()
    if not opts.trap_links then
        return false, "trap_links should be true"
    end

    local events_ch = process.events()

    -- 生成将失败的链接进程
    local error_pid, err2 = process.spawn_linked(
        "app.test.process:error_exit_worker",
        "app:processes"
    )
    if err2 then
        return false, "spawn error worker failed: " .. err2
    end

    -- 等待 LINK_DOWN 事件
    local timeout = time.after("2s")
    local result = channel.select {
        events_ch:case_receive(),
        timeout:case_receive(),
    }

    if result.channel == timeout then
        return false, "timeout waiting for LINK_DOWN"
    end

    local event = result.value
    if event.kind == process.event.LINK_DOWN then
        print("Linked process died:", event.from)
        -- 优雅处理而不是崩溃
        return true
    end

    return false, "expected LINK_DOWN, got: " .. tostring(event.kind)
end

return { main = main }
```

## 进程注册表

为进程注册名称以启用基于名称的查找和消息传递。

### 注册名称

```lua
local function main()
    local test_name = "my_service_" .. tostring(os.time())

    -- 为当前进程注册名称
    local ok, err = process.registry.register(test_name)
    if err then
        return false, "register failed: " .. err
    end

    -- 查找注册的名称
    local pid, lookup_err = process.registry.lookup(test_name)
    if lookup_err then
        return false, "lookup failed: " .. lookup_err
    end

    -- 验证它解析到我们的 PID
    if pid ~= process.pid() then
        return false, "lookup returned wrong pid"
    end

    return true
end

return { main = main }
```

### 取消注册名称

```lua
-- 显式取消注册
local unregistered = process.registry.unregister(test_name)
if not unregistered then
    print("Name was not registered")
end

-- 取消注册后查找返回 nil + error
local pid, err = process.registry.lookup(test_name)
-- pid 将是 nil，err 将是非 nil
```

名称在进程退出时自动释放。

## 完整示例：受监控的 Worker 池

此示例展示父进程生成多个受监控的 worker 并跟踪其完成情况。

```lua
-- 父进程
local time = require("time")

local function main()
    local events_ch = process.events()

    -- 跟踪生成的 worker
    local workers = {}
    local worker_count = 5

    -- 生成多个受监控的 worker
    for i = 1, worker_count do
        local worker_pid, err = process.spawn_monitored(
            "app.test.process:task_worker",
            "app:processes",
            { task_id = i, value = i * 10 }
        )

        if err then
            return false, "spawn worker " .. i .. " failed: " .. err
        end

        workers[worker_pid] = { task_id = i, started = os.time() }
    end

    -- 等待所有 worker 完成
    local completed = 0
    local timeout = time.after("10s")

    while completed < worker_count do
        local result = channel.select {
            events_ch:case_receive(),
            timeout:case_receive(),
        }

        if result.channel == timeout then
            return false, "timeout waiting for workers"
        end

        local event = result.value
        if event.kind == process.event.EXIT then
            local worker = workers[event.from]
            if worker then
                if event.error then
                    print("Worker " .. worker.task_id .. " failed:", event.error)
                else
                    print("Worker " .. worker.task_id .. " completed:", event.result)
                end
                completed = completed + 1
            end
        end
    end

    return true
end

return { main = main }
```

Worker 进程：

```lua
-- task_worker.lua
local time = require("time")

local function main(task)
    -- 模拟工作
    time.sleep("100ms")

    -- 处理任务
    local result = task.value * 2

    return result
end

return { main = main }
```

## 总结

进程生成：
- `process.spawn()` - 基本生成，返回 PID
- `process.spawn_monitored()` - 带自动监控的生成
- `process.spawn_linked()` - 带生命周期耦合的生成
- `process.pid()` - 获取当前进程 PID

消息传递：
- `process.send(pid, topic, payload)` - 向 PID 发送消息
- `process.listen(topic)` - 订阅主题，接收负载
- `process.listen(topic, { message = true })` - 接收带 `:from()`、`:payload()`、`:topic()` 的完整消息
- `process.inbox()` - 接收不匹配监听器的消息

监控：
- `process.events()` - EXIT 和 LINK_DOWN 事件的通道
- `process.monitor(pid)` - 监控现有进程
- `process.unmonitor(pid)` - 停止监控

链接：
- `process.link(pid)` - 链接到进程
- `process.unlink(pid)` - 取消与进程的链接
- `process.set_options({ trap_links = true })` - 将 LINK_DOWN 作为事件接收而不是崩溃
- `process.get_options()` - 获取当前进程选项

注册表：
- `process.registry.register(name)` - 为当前进程注册名称
- `process.registry.lookup(name)` - 按名称查找 PID
- `process.registry.unregister(name)` - 移除名称注册

## 另请参阅

- [进程模块参考](lua/core/process.md) - 完整 API 文档
- [通道](tutorials/channels.md) - 消息处理的通道操作
