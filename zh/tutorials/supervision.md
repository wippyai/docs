# 进程监管

监控和链接进程以构建容错系统。

## 监控 vs 链接

**监控**提供单向观察：
- 父进程监控子进程
- 子进程退出，父进程收到 EXIT 事件
- 父进程继续运行

**链接**创建双向命运共享：
- 父进程和子进程被链接
- 任一进程失败，两者都终止
- 除非设置了 `trap_links=true`

```
监控（单向）                      链接（双向）
┌──────────┐                      ┌──────────┐
│   父     │                      │   父     │
│  监控    │                      │  链接    │
└────┬─────┘                      └────┬─────┘
     │ EXIT 事件                       │ LINK_DOWN
     │ （父继续运行）                  │ （两者都死亡）
┌────▼─────┐                      ┌────▼─────┐
│   子     │                      │   子     │
│  退出    │                      │  退出    │
└──────────┘                      └──────────┘
```

## 进程监控

### 带监控的生成

使用 `process.spawn_monitored()` 一次调用完成生成和监控：

```lua
local function main()
    local events_ch = process.events()

    -- 生成 worker 并开始监控
    local worker_pid, err = process.spawn_monitored(
        "app.workers:task_worker",
        "app:processes"
    )
    if err then
        return nil, "spawn failed: " .. tostring(err)
    end

    -- 等待 worker 完成
    local event = events_ch:receive()

    if event.kind == process.event.EXIT then
        print("Worker exited:", event.from)
        if event.result then
            print("Result:", event.result.value)
        end
        if event.result and event.result.error then
            print("Error:", event.result.error)
        end
    end
end
```

### 监控现有进程

调用 `process.monitor()` 开始监控已运行的进程：

```lua
local function main()
    local time = require("time")
    local events_ch = process.events()

    -- 不带监控的生成
    local worker_pid, err = process.spawn(
        "app.workers:long_worker",
        "app:processes"
    )
    if err then
        return nil, "spawn failed: " .. tostring(err)
    end

    -- 稍后开始监控
    local ok, monitor_err = process.monitor(worker_pid)
    if monitor_err then
        return nil, "monitor failed: " .. tostring(monitor_err)
    end

    -- 取消 worker
    time.sleep("5ms")
    process.cancel(worker_pid, "100ms")

    -- 接收 EXIT 事件
    local event = events_ch:receive()
    if event.kind == process.event.EXIT then
        print("Worker terminated:", event.from)
    end
end
```

### 停止监控

使用 `process.unmonitor()` 停止接收 EXIT 事件：

```lua
local function main()
    local time = require("time")
    local events_ch = process.events()

    -- 生成并监控
    local worker_pid, err = process.spawn_monitored(
        "app.workers:long_worker",
        "app:processes"
    )

    time.sleep("5ms")

    -- 停止监控
    local ok, unmon_err = process.unmonitor(worker_pid)
    if unmon_err then
        return nil, "unmonitor failed: " .. tostring(unmon_err)
    end

    -- 取消 worker
    process.cancel(worker_pid, "100ms")

    -- 不会收到 EXIT 事件（我们取消了监控）
    local timeout = time.after("200ms")
    local result = channel.select {
        events_ch:case_receive(),
        timeout:case_receive(),
    }

    if result.channel == events_ch then
        return nil, "should not receive event after unmonitor"
    end
end
```

## 进程链接

### 显式链接

使用 `process.link()` 创建双向链接：

```lua
-- 链接到目标进程的 Worker
local function worker_main()
    local time = require("time")
    local events_ch = process.events()
    local inbox_ch = process.inbox()

    -- 启用 trap_links 以接收 LINK_DOWN 事件
    process.set_options({ trap_links = true })

    -- 从发送者接收目标 PID
    local msg = inbox_ch:receive()
    local target_pid = msg:payload():data()
    local sender = msg:from()

    -- 创建双向链接
    local ok, err = process.link(target_pid)
    if err then
        return nil, "link failed: " .. tostring(err)
    end

    -- 通知发送者我们已链接
    process.send(sender, "linked", process.pid())

    -- 等待目标退出时的 LINK_DOWN
    local timeout = time.after("3s")
    local result = channel.select {
        events_ch:case_receive(),
        timeout:case_receive(),
    }

    if result.channel == events_ch then
        local event = result.value
        if event.kind == process.event.LINK_DOWN then
            return "LINK_DOWN_RECEIVED"
        end
    end

    return nil, "no LINK_DOWN received"
end
```

### 带链接的生成

使用 `process.spawn_linked()` 一次调用完成生成和链接：

```lua
local function parent_main()
    -- 启用 trap_links 以处理子进程死亡
    process.set_options({ trap_links = true })

    local events_ch = process.events()

    -- 生成并链接到子进程
    local child_pid, err = process.spawn_linked(
        "app.workers:child_worker",
        "app:processes"
    )
    if err then
        return nil, "spawn_linked failed: " .. tostring(err)
    end

    -- 如果子进程死亡，我们收到 LINK_DOWN
    local event = events_ch:receive()
    if event.kind == process.event.LINK_DOWN then
        print("Child died:", event.from)
    end
end
```

## Trap Links

默认情况下，当链接的进程失败时，当前进程也会失败。设置 `trap_links=true` 以接收 LINK_DOWN 事件代替。

### 默认行为（trap_links=false）

不使用 `trap_links`，链接进程失败会终止当前进程：

```lua
local function worker_main()
    local events_ch = process.events()

    -- trap_links 默认为 false
    local opts = process.get_options()
    print("trap_links:", opts.trap_links)  -- false

    -- 生成将失败的链接 worker
    local child_pid, err = process.spawn_linked(
        "app.workers:error_worker",
        "app:processes"
    )

    -- 当子进程出错时，此进程终止
    -- 我们永远不会到达这里
    local event = events_ch:receive()
end
```

### 使用 trap_links=true

启用 `trap_links` 以接收 LINK_DOWN 事件并存活：

```lua
local function worker_main()
    -- 启用 trap_links
    process.set_options({ trap_links = true })

    local events_ch = process.events()

    -- 生成将失败的链接 worker
    local child_pid, err = process.spawn_linked(
        "app.workers:error_worker",
        "app:processes"
    )

    -- 等待 LINK_DOWN 事件
    local event = events_ch:receive()

    if event.kind == process.event.LINK_DOWN then
        print("Child failed, handling gracefully")
        return "LINK_DOWN_RECEIVED"
    end
end
```

## 取消

### 发送取消信号

使用 `process.cancel()` 优雅地终止进程：

```lua
local function main()
    local time = require("time")
    local events_ch = process.events()

    -- 生成并监控 worker
    local worker_pid, err = process.spawn_monitored(
        "app.workers:long_worker",
        "app:processes"
    )

    time.sleep("5ms")

    -- 取消，给予 100ms 超时进行清理
    local ok, cancel_err = process.cancel(worker_pid, "100ms")
    if cancel_err then
        return nil, "cancel failed: " .. tostring(cancel_err)
    end

    -- 等待 EXIT 事件
    local event = events_ch:receive()
    if event.kind == process.event.EXIT then
        print("Worker cancelled:", event.from)
    end
end
```

### 处理取消

Worker 通过 `process.events()` 接收 CANCEL 事件：

```lua
local function worker_main()
    local events_ch = process.events()
    local inbox_ch = process.inbox()

    while true do
        local result = channel.select {
            inbox_ch:case_receive(),
            events_ch:case_receive(),
        }

        if result.channel == events_ch then
            local event = result.value
            if event.kind == process.event.CANCEL then
                -- 清理资源
                cleanup()
                return "cancelled gracefully"
            end
        else
            -- 处理收件箱消息
            handle_message(result.value)
        end
    end
end
```

## 监管拓扑

### 星形拓扑

父进程与多个子进程链接：

```lua
-- 父 worker 生成链接回父进程的子进程
local function star_parent_main()
    local time = require("time")
    local events_ch = process.events()
    local child_count = 10

    -- 启用 trap_links 以观察子进程死亡
    process.set_options({ trap_links = true })

    local children = {}

    -- 生成子进程
    for i = 1, child_count do
        local child_pid, err = process.spawn(
            "app.workers:linker_child",
            "app:processes"
        )
        if err then
            error("spawn child failed: " .. tostring(err))
        end

        -- 向子进程发送父 PID
        process.send(child_pid, "inbox", process.pid())
        children[child_pid] = true
    end

    -- 等待所有子进程确认链接
    for i = 1, child_count do
        local msg = process.inbox():receive()
        if msg:topic() ~= "linked" then
            error("expected linked confirmation")
        end
    end

    -- 触发失败 - 所有子进程应收到 LINK_DOWN
    error("PARENT_STAR_FAILURE")
end
```

链接到父进程的子 worker：

```lua
local function linker_child_main()
    local events_ch = process.events()
    local inbox_ch = process.inbox()

    -- 接收父 PID
    local msg = inbox_ch:receive()
    local parent_pid = msg:payload():data()

    -- 链接到父进程
    process.link(parent_pid)

    -- 确认链接
    process.send(parent_pid, "linked", process.pid())

    -- 等待父进程死亡时的 LINK_DOWN
    local event = events_ch:receive()
    if event.kind == process.event.LINK_DOWN then
        return "parent_died"
    end
end
```

### 链式拓扑

线性链，每个节点链接到其父节点：

```lua
-- 链根：A -> B -> C -> D -> E
local function chain_root_main()
    local time = require("time")

    -- 生成第一个子进程
    local child_pid, err = process.spawn_linked(
        "app.workers:chain_node",
        "app:processes",
        4  -- 剩余深度
    )
    if err then
        error("spawn failed: " .. tostring(err))
    end

    -- 等待链构建完成
    time.sleep("100ms")

    -- 触发级联 - 所有链接的进程都会死亡
    error("CHAIN_ROOT_FAILURE")
end
```

链节点生成下一个节点并链接：

```lua
local function chain_node_main(depth)
    local time = require("time")

    if depth > 0 then
        -- 生成链中的下一个
        local child_pid, err = process.spawn_linked(
            "app.workers:chain_node",
            "app:processes",
            depth - 1
        )
        if err then
            error("spawn failed: " .. tostring(err))
        end
    end

    -- 等待父进程死亡（通过 LINK_DOWN 触发我们的死亡）
    time.sleep("5s")
end
```

## 带监管的 Worker 池

### 配置

```yaml
# src/_index.yaml
version: "1.0"
namespace: app

entries:
  - name: processes
    kind: process.host
    host:
      workers: 16
    lifecycle:
      auto_start: true
```

```yaml
# src/supervisor/_index.yaml
version: "1.0"
namespace: app.supervisor

entries:
  - name: pool
    kind: process.lua
    source: file://pool.lua
    method: main
    modules:
      - time
    lifecycle:
      auto_start: true
```

### Supervisor 实现

```lua
-- src/supervisor/pool.lua
local function main(worker_count)
    local time = require("time")
    worker_count = worker_count or 4

    -- 启用 trap_links 以处理 worker 死亡
    process.set_options({ trap_links = true })

    local events_ch = process.events()
    local workers = {}

    local function start_worker(id)
        local pid, err = process.spawn_linked(
            "app.workers:task_worker",
            "app:processes",
            id
        )
        if err then
            print("Failed to start worker " .. id .. ": " .. tostring(err))
            return nil
        end

        workers[pid] = {id = id, started_at = os.time()}
        print("Worker " .. id .. " started: " .. pid)
        return pid
    end

    -- 启动初始池
    for i = 1, worker_count do
        start_worker(i)
    end

    print("Supervisor started with " .. worker_count .. " workers")

    -- 监管循环
    while true do
        local timeout = time.after("60s")
        local result = channel.select {
            events_ch:case_receive(),
            timeout:case_receive(),
        }

        if result.channel == timeout then
            -- 定期健康检查
            local count = 0
            for _ in pairs(workers) do count = count + 1 end
            print("Health check: " .. count .. " active workers")

        elseif result.channel == events_ch then
            local event = result.value

            if event.kind == process.event.LINK_DOWN then
                local dead_worker = workers[event.from]
                if dead_worker then
                    workers[event.from] = nil
                    local uptime = os.time() - dead_worker.started_at
                    print("Worker " .. dead_worker.id .. " died after " .. uptime .. "s, restarting")

                    -- 重启前短暂延迟
                    time.sleep("100ms")
                    start_worker(dead_worker.id)
                end
            end
        end
    end
end

return { main = main }
```

## 进程配置

### Worker 定义

```yaml
# src/workers/_index.yaml
version: "1.0"
namespace: app.workers

entries:
  - name: task_worker
    kind: process.lua
    source: file://task_worker.lua
    method: main
    modules:
      - time
```

### Worker 实现

```lua
-- src/workers/task_worker.lua
local function main(worker_id)
    local time = require("time")
    local events_ch = process.events()
    local inbox_ch = process.inbox()

    print("Task worker " .. worker_id .. " started")

    while true do
        local timeout = time.after("5s")
        local result = channel.select {
            inbox_ch:case_receive(),
            events_ch:case_receive(),
            timeout:case_receive(),
        }

        if result.channel == events_ch then
            local event = result.value
            if event.kind == process.event.CANCEL then
                print("Worker " .. worker_id .. " cancelled")
                return "cancelled"
            elseif event.kind == process.event.LINK_DOWN then
                print("Worker " .. worker_id .. " linked process died")
                return nil, "linked_process_died"
            end

        elseif result.channel == inbox_ch then
            local msg = result.value
            local topic = msg:topic()
            local payload = msg:payload():data()

            if topic == "work" then
                print("Worker " .. worker_id .. " processing: " .. payload)
                time.sleep("100ms")
                process.send(msg:from(), "result", "completed: " .. payload)
            end

        elseif result.channel == timeout then
            -- 空闲超时
            print("Worker " .. worker_id .. " idle")
        end
    end
end

return { main = main }
```

## 进程宿主配置

进程宿主控制多少个 OS 线程执行进程：

```yaml
# src/_index.yaml
version: "1.0"
namespace: app

entries:
  - name: processes
    kind: process.host
    host:
      workers: 16  # OS 线程数
    lifecycle:
      auto_start: true
```

Workers 设置：
- 控制 CPU 密集型工作的并行度
- 通常设置为 CPU 核心数
- 所有进程共享此线程池

## 关键概念

**监控**（单向观察）：
- 使用 `process.spawn_monitored()` 或 `process.monitor()`
- 当被监控进程终止时接收 EXIT 事件
- 子进程退出后父进程继续运行

**链接**（双向命运共享）：
- 使用 `process.spawn_linked()` 或 `process.link()`
- 默认：任一进程失败，两者都终止
- 使用 `trap_links=true`：接收 LINK_DOWN 事件代替

**取消**：
- 使用 `process.cancel(pid, timeout)` 进行优雅关闭
- Worker 通过 `process.events()` 接收 CANCEL 事件
- 有超时时长用于在强制终止前进行清理

## 事件类型

| 事件 | 触发条件 | 所需设置 |
|------|----------|----------|
| `EXIT` | 被监控进程退出 | `spawn_monitored()` 或 `monitor()` |
| `LINK_DOWN` | 链接的进程失败 | `spawn_linked()` 或 `link()` 并启用 `trap_links=true` |
| `CANCEL` | 调用了 `process.cancel()` | 无（始终投递） |

## 下一步

- [进程](tutorials/processes.md) - 进程基础
- [通道](tutorials/channels.md) - 消息传递模式
- [进程模块](lua/core/process.md) - API 参考
