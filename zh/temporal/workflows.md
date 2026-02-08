# Workflows

Workflow 是持久化函数，用于编排 activity 并在故障和重启后保持状态。使用 `workflow.lua` 条目类型定义。

## 定义

```yaml
- name: order_workflow
  kind: workflow.lua
  source: file://order_workflow.lua
  method: main
  modules:
    - funcs
    - time
    - workflow
  meta:
    temporal:
      workflow:
        worker: app:worker
```

### 元数据字段

| 字段 | 必填 | 描述 |
|-------|----------|-------------|
| `worker` | 是 | 对 `temporal.worker` 条目的引用 |
| `name` | 否 | 自定义 workflow 类型名称（默认为条目 ID） |

## 基本实现

```lua
local funcs = require("funcs")
local time = require("time")

local function main(order)
    local payment, err = funcs.call("app:charge_payment", {
        amount = order.total,
        customer = order.customer_id
    })
    if err then
        return {status = "failed", error = tostring(err)}
    end

    time.sleep("1h")

    local shipment, err = funcs.call("app:ship_order", {
        order_id = order.id,
        address = order.shipping_address
    })
    if err then
        funcs.call("app:refund_payment", payment.id)
        return {status = "failed", error = tostring(err)}
    end

    return {
        status = "completed",
        payment_id = payment.id,
        tracking = shipment.tracking_number
    }
end

return { main = main }
```

## Workflow 模块

`workflow` 模块提供 workflow 特定的操作。

### workflow.info()

获取 workflow 执行信息：

```lua
local workflow = require("workflow")

local info = workflow.info()
print(info.workflow_id)    -- Workflow execution ID
print(info.run_id)         -- Current run ID
print(info.workflow_type)  -- Workflow type name
print(info.task_queue)     -- Task queue name
print(info.namespace)      -- Temporal namespace
print(info.attempt)        -- Current attempt number
print(info.history_length) -- Number of history events
print(info.history_size)   -- History size in bytes
```

### workflow.exec()

同步执行子 workflow 并等待其结果：

```lua
local result, err = workflow.exec("app:child_workflow", input_data)
if err then
    return nil, err
end
```

需要等待结果时，这是运行子 workflow 的最简单方式。

### workflow.version()

使用确定性版本控制处理代码变更：

```lua
local version = workflow.version("payment-v2", 1, 2)

if version == 1 then
    result = funcs.call("app:old_payment", input)
else
    result = funcs.call("app:new_payment", input)
end
```

参数：
- `change_id` - 此变更的唯一标识符
- `min_supported` - 最低支持版本
- `max_supported` - 最高（当前）版本

版本号在每次 workflow 执行中具有确定性。正在执行的 workflow 继续使用其已记录的版本，而新 workflow 使用 `max_supported`。

### workflow.attrs()

更新搜索属性和备注：

```lua
workflow.attrs({
    search = {
        status = "processing",
        customer_id = order.customer_id,
        order_total = order.total
    },
    memo = {
        notes = "Priority customer",
        source = "web"
    }
})
```

搜索属性是可索引的，可通过 Temporal 可见性 API 进行查询。备注是附加到 workflow 的任意非索引数据。

### workflow.history_length() / workflow.history_size()

监控 workflow 历史增长：

```lua
local length = workflow.history_length()
local size = workflow.history_size()

if length > 10000 then
    -- Consider continue-as-new to reset history
end
```

## 启动 Workflow

### 基本启动

使用 `process.spawn()` 从任意代码启动 workflow：

```lua
local pid, err = process.spawn(
    "app:order_workflow",    -- workflow entry
    "app:worker",            -- temporal worker
    {order_id = "123"}       -- input
)
```

host 参数指定 temporal worker（而非进程主机）。Workflow 在 Temporal 基础设施上持久运行。

### 带监控启动

监控 workflow 以在其完成时接收 EXIT 事件：

```lua
local pid, err = process.spawn_monitored(
    "app:order_workflow",
    "app:worker",
    {order_id = "123"}
)

local events = process.events()
local event = events:receive()

if event.kind == process.event.EXIT then
    local result = event.result.value
    local error = event.result.error
end
```

### 带名称启动

为 workflow 分配名称以实现幂等启动：

```lua
local spawner = process
    .with_options({})
    :with_name("order-" .. order.id)

local pid, err = spawner:spawn_monitored(
    "app:order_workflow",
    "app:worker",
    {order_id = order.id}
)
```

提供名称后，Temporal 使用该名称来去重 workflow 启动。若在 workflow 运行期间使用相同名称启动，默认返回现有 workflow 的 PID。

### 带显式 Workflow ID 启动

设置特定的 Temporal workflow ID：

```lua
local spawner = process
    .with_options({
        ["temporal.workflow.id"] = "order-" .. order.id,
    })

local pid, err = spawner:spawn_monitored(
    "app:order_workflow",
    "app:worker",
    order
)
```

### ID 冲突策略

控制当使用已存在的 ID 启动 workflow 时的行为：

```lua
-- Fail if workflow already exists
local spawner = process
    .with_options({
        ["temporal.workflow.id"] = "order-123",
        ["temporal.workflow.id_conflict_policy"] = "fail",
    })

local pid, err = spawner:spawn("app:order_workflow", "app:worker", order)
if err then
    -- Workflow already running with this ID
end
```

```lua
-- Error when already started (alternative approach)
local spawner = process
    .with_options({
        ["temporal.workflow.id"] = "order-123",
        ["temporal.workflow.execution_error_when_already_started"] = true,
    })

local pid, err = spawner:spawn("app:order_workflow", "app:worker", order)
```

```lua
-- Reuse existing (default behavior with explicit ID)
local spawner = process
    .with_options({
        ["temporal.workflow.id"] = "order-123",
    })

local pid, err = spawner:spawn("app:order_workflow", "app:worker", order)
-- Returns existing workflow PID if already running
```

| 策略 | 行为 |
|--------|----------|
| `"use_existing"` | 返回现有 workflow 的 PID（使用显式 ID 时的默认行为） |
| `"fail"` | 如果 workflow 已存在则返回错误 |
| `"terminate_existing"` | 终止现有 workflow 并启动新的 |

### Workflow 启动选项

通过 `with_options()` 传递 Temporal workflow 选项：

```lua
local spawner = process.with_options({
    ["temporal.workflow.id"] = "order-123",
    ["temporal.workflow.execution_timeout"] = "24h",
    ["temporal.workflow.run_timeout"] = "1h",
    ["temporal.workflow.task_timeout"] = "30s",
    ["temporal.workflow.id_conflict_policy"] = "fail",
    ["temporal.workflow.retry_policy"] = {
        initial_interval = 1000,
        backoff_coefficient = 2.0,
        maximum_interval = 300000,
        maximum_attempts = 3,
    },
    ["temporal.workflow.cron_schedule"] = "0 */6 * * *",
    ["temporal.workflow.search_attributes"] = {
        customer_id = "cust-123"
    },
    ["temporal.workflow.memo"] = {
        source = "api"
    },
    ["temporal.workflow.start_delay"] = "5m",
    ["temporal.workflow.parent_close_policy"] = "terminate",
})
```

#### 完整选项参考

| 选项 | 类型 | 描述 |
|--------|------|-------------|
| `temporal.workflow.id` | string | 显式 workflow 执行 ID |
| `temporal.workflow.task_queue` | string | 覆盖任务队列 |
| `temporal.workflow.execution_timeout` | duration | workflow 总执行超时 |
| `temporal.workflow.run_timeout` | duration | 单次运行超时 |
| `temporal.workflow.task_timeout` | duration | Workflow 任务处理超时 |
| `temporal.workflow.id_conflict_policy` | string | `use_existing`、`fail`、`terminate_existing` |
| `temporal.workflow.id_reuse_policy` | string | `allow_duplicate`、`allow_duplicate_failed_only`、`reject_duplicate` |
| `temporal.workflow.execution_error_when_already_started` | boolean | 如果 workflow 已在运行则报错 |
| `temporal.workflow.retry_policy` | table | 重试策略（见下文） |
| `temporal.workflow.cron_schedule` | string | 用于周期性 workflow 的 cron 表达式 |
| `temporal.workflow.memo` | table | 非索引 workflow 元数据 |
| `temporal.workflow.search_attributes` | table | 可索引的可查询属性 |
| `temporal.workflow.enable_eager_start` | boolean | 立即开始执行 |
| `temporal.workflow.start_delay` | duration | Workflow 启动前的延迟 |
| `temporal.workflow.parent_close_policy` | string | 父关闭时子 workflow 的行为 |
| `temporal.workflow.wait_for_cancellation` | boolean | 等待取消完成 |
| `temporal.workflow.namespace` | string | Temporal 命名空间覆盖 |

Duration 值可使用字符串（`"5s"`、`"10m"`、`"1h"`）或以毫秒为单位的数字。

#### 父关闭策略

控制当父 workflow 关闭时子 workflow 的行为：

| 策略 | 行为 |
|--------|----------|
| `"terminate"` | 终止子 workflow |
| `"abandon"` | 让子 workflow 独立继续运行 |
| `"request_cancel"` | 向子 workflow 发送取消请求 |

### 启动消息

在 workflow 启动后立即排队发送信号。消息在任何外部信号之前投递：

```lua
local spawner = process
    .with_options({})
    :with_name("counter-workflow")
    :with_message("increment", {amount = 2})
    :with_message("increment", {amount = 1})
    :with_message("increment", {amount = 4})

local pid, err = spawner:spawn_monitored(
    "app:counter_workflow",
    "app:worker",
    {initial = 0}
)
```

启动消息在 `use_existing` 冲突策略下特别有用。当第二次启动指向已存在的 workflow 时，启动消息仍会被投递：

```lua
-- First spawn starts the workflow with initial messages
local first = process
    .with_options({})
    :with_name("my-counter")
    :with_message("increment", {amount = 3})

local pid, err = first:spawn("app:counter_workflow", "app:worker", {initial = 0})

-- Second spawn reuses existing workflow and delivers new messages
local second = process
    .with_options({})
    :with_name("my-counter")
    :with_message("increment", {amount = 2})

local pid2, err = second:spawn("app:counter_workflow", "app:worker", {initial = 999})
-- pid2 == pid (same workflow), input {initial = 999} is ignored
-- But the increment message with amount=2 is delivered
```

### 上下文传播

传递可在 workflow 及其 activity 内部访问的上下文值：

```lua
local spawner = process.with_context({
    user_id = "user-1",
    tenant = "tenant-1",
    request_id = "req-abc",
})

local pid, err = spawner:spawn_monitored(
    "app:order_workflow",
    "app:worker",
    order
)
```

在 workflow 内部（或其调用的任何 activity 中），通过 `ctx` 模块读取上下文：

```lua
local ctx = require("ctx")

local user_id = ctx.get("user_id")       -- "user-1"
local tenant = ctx.get("tenant")         -- "tenant-1"
local all = ctx.all()                    -- {user_id="user-1", tenant="tenant-1", request_id="req-abc"}
```

### 从 HTTP 处理器启动

```lua
local function handler()
    local req = http.request()
    local order = json.decode(req:body())

    local spawner = process
        .with_context({request_id = req:header("X-Request-ID")})
        :with_options({
            ["temporal.workflow.id"] = "order-" .. order.id,
            ["temporal.workflow.id_conflict_policy"] = "fail",
        })

    local pid, err = spawner:spawn(
        "app:order_workflow",
        "app:worker",
        order
    )

    if err then
        return http.response():status(409):json({error = tostring(err)})
    end

    return http.response():status(202):json({
        workflow_id = tostring(pid),
        status = "started"
    })
end
```

## 信号

Workflow 通过进程消息系统接收信号。信号具有持久性，在 workflow replay 后仍会保留。

### Inbox 模式

通过进程 inbox 接收所有消息：

```lua
local function main(order)
    local inbox = process.inbox()

    while true do
        local msg = inbox:receive()
        local topic = msg:topic()
        local data = msg:payload():data()

        if topic == "approve" then
            break
        elseif topic == "cancel" then
            return {status = "cancelled", reason = data.reason}
        end
    end

    return process_order(order)
end
```

### 基于主题的订阅

使用 `process.listen()` 订阅特定主题：

```lua
local function main(input)
    local results = {}
    local job_ch = process.listen("add_job")
    local exit_ch = process.listen("exit")

    while true do
        local result = channel.select{
            job_ch:case_receive(),
            exit_ch:case_receive()
        }

        if result.channel == exit_ch then
            break
        elseif result.channel == job_ch then
            local job_data = result.value
            local activity_result, err = funcs.call(
                "app:echo_activity",
                {job_id = job_data.id, data = job_data}
            )
            table.insert(results, {
                job_id = job_data.id,
                result = activity_result
            })
        end
    end

    return {total_jobs = #results, results = results}
end
```

默认情况下，`process.listen()` 返回原始有效负载数据。使用 `{message = true}` 接收带有发送者信息的 Message 对象：

```lua
local ch = process.listen("request", {message = true})
local msg = ch:receive()
local sender = msg:from()
local data = msg:payload():data()
```

### 多信号处理器

使用 `coroutine.spawn()` 并发处理不同的信号类型：

```lua
local function main(input)
    local counter = input.initial or 0
    local done = false

    coroutine.spawn(function()
        local ch = process.listen("increment", {message = true})
        while not done do
            local msg, ok = ch:receive()
            if not ok then break end

            local data = msg:payload():data()
            local reply_to = msg:from()

            if type(data) ~= "table" or type(data.amount) ~= "number" then
                process.send(reply_to, "nak", "amount must be a number")
            else
                process.send(reply_to, "ack")
                counter = counter + data.amount
                process.send(reply_to, "ok", {value = counter})
            end
        end
    end)

    coroutine.spawn(function()
        local ch = process.listen("decrement", {message = true})
        while not done do
            local msg, ok = ch:receive()
            if not ok then break end

            local data = msg:payload():data()
            local reply_to = msg:from()

            if counter - data.amount < 0 then
                process.send(reply_to, "nak", "would result in negative value")
            else
                process.send(reply_to, "ack")
                counter = counter - data.amount
                process.send(reply_to, "ok", {value = counter})
            end
        end
    end)

    -- Main coroutine waits for finish signal
    local finish_ch = process.listen("finish", {message = true})
    local msg = finish_ch:receive()
    process.send(msg:from(), "ack")
    process.send(msg:from(), "ok", {message = "finishing"})
    done = true

    return {final_counter = counter}
end
```

### 信号确认

通过向发送者回复响应来实现请求-回复模式：

```lua
-- Workflow side
local ch = process.listen("get_status", {message = true})
local msg = ch:receive()
process.send(msg:from(), "status_response", {status = "processing", progress = 75})
```

```lua
-- Caller side
local response_ch = process.listen("status_response")
process.send(workflow_pid, "get_status", {})

local timeout = time.after("5s")
local result = channel.select{
    response_ch:case_receive(),
    timeout:case_receive()
}

if result.channel == response_ch then
    local status = result.value
end
```

### 跨 Workflow 信号传递

Workflow 可以使用 PID 向其他 workflow 发送信号：

```lua
-- Sender workflow
local function main(input)
    local target_pid = input.target
    local ok, err = process.send(target_pid, "cross_host_ping", {data = "hello"})
    if err then
        return {ok = false, error = tostring(err)}
    end

    local response_ch = process.listen("cross_host_pong")
    local response = response_ch:receive()
    return {ok = true, received = response}
end
```

## 子 Workflow

### 同步子 Workflow (workflow.exec)

执行子 workflow 并等待结果：

```lua
local result, err = workflow.exec("app:child_workflow", input_data)
if err then
    return nil, err
end
```

### 异步子 Workflow (process.spawn)

非阻塞方式启动子 workflow，然后通过事件等待其完成：

```lua
local events_ch = process.events()

local child_pid, err = process.spawn(
    "app:child_workflow",
    "app:worker",
    {message = "hello from parent"}
)
if err then
    return {status = "spawn_failed", error = tostring(err)}
end

-- Wait for child EXIT event
local event = events_ch:receive()

if event.kind == process.event.EXIT then
    local child_result = event.result.value
    local child_error = event.result.error
end
```

### 子 Workflow 错误传播

当子 workflow 返回错误时，错误会出现在 EXIT 事件中：

```lua
local events_ch = process.events()
local child_pid, err = process.spawn(
    "app:error_child_workflow",
    "app:worker"
)

local event = events_ch:receive()
if event.result.error then
    local child_err = event.result.error
    -- Error objects have kind(), retryable(), message() methods
    print(child_err:kind())       -- e.g. "NOT_FOUND"
    print(child_err:retryable())  -- false
    print(child_err:message())    -- error message text
end
```

### 同步执行 Workflow (process.exec)

一次调用即可运行 workflow 并等待其结果：

```lua
local result, err = process.exec(
    "app:hello_workflow",
    "app:worker",
    {name = "world"}
)
if err then
    return nil, err
end
-- result contains the workflow return value
```

## 监控与链接

### 启动后监控

在 workflow 已启动后对其进行监控：

```lua
local pid, err = process.spawn(
    "app:long_workflow",
    "app:worker",
    {iterations = 100}
)

-- Monitor later
local ok, err = process.monitor(pid)

local events_ch = process.events()
local event = events_ch:receive()  -- EXIT when workflow completes
```

### 启动后链接

链接到运行中的 workflow 以在异常终止时接收 LINK_DOWN：

```lua
local ok, err = process.set_options({trap_links = true})

local pid, err = process.spawn(
    "app:long_workflow",
    "app:worker",
    {iterations = 100}
)

-- Link after workflow has started
time.sleep("200ms")
local ok, err = process.link(pid)

-- If workflow is terminated, receive LINK_DOWN
process.terminate(pid)

local events_ch = process.events()
local event = events_ch:receive()
-- event.kind == process.event.LINK_DOWN
```

LINK_DOWN 事件需要在进程选项中设置 `trap_links = true`。如果没有设置，链接进程的终止会传播该故障。

### 取消监控 / 取消链接

移除监控或链接：

```lua
process.unmonitor(pid)  -- stop receiving EXIT events
process.unlink(pid)     -- remove bidirectional link
```

取消监控或取消链接后，该进程的事件将不再投递。

## 终止与取消

### 终止

强制终止运行中的 workflow：

```lua
local ok, err = process.terminate(workflow_pid)
```

被监控的调用者会收到带有错误的 EXIT 事件。

### 取消

请求优雅取消，可选设置截止时间：

```lua
local ok, err = process.cancel(workflow_pid, "5s")
```

## 并发工作

使用 `coroutine.spawn()` 和 channel 在 workflow 内部进行并行工作：

```lua
local function main(input)
    local worker_count = input.workers or 3
    local job_count = input.jobs or 6

    local work_queue = channel.new(10)
    local results = channel.new(10)

    for w = 1, worker_count do
        coroutine.spawn(function()
            while true do
                local job, ok = work_queue:receive()
                if not ok then break end
                time.sleep(10 * time.MILLISECOND)
                results:send({worker = w, job = job, result = job * 2})
            end
        end)
    end

    for j = 1, job_count do
        work_queue:send(j)
    end
    work_queue:close()

    local total = 0
    local processed = {}
    for _ = 1, job_count do
        local r = results:receive()
        total = total + r.result
        table.insert(processed, r)
    end

    return {total = total, processed = processed}
end
```

coroutine 中的所有 channel 操作和休眠都是 replay 安全的。

## 定时器

持久化定时器在重启后仍然有效：

```lua
local time = require("time")

time.sleep("24h")
time.sleep("5m")
time.sleep("30s")
time.sleep(100 * time.MILLISECOND)
```

跟踪经过的时间：

```lua
local start = time.now()
time.sleep("1s")
local elapsed = time.now():sub(start):milliseconds()
```

## 确定性

Workflow 代码必须是确定性的。相同的输入必须产生相同的命令序列。

### Replay 安全操作

这些操作会自动被拦截，其结果会被记录。在 replay 时，返回已记录的值：

```lua
-- Activity calls
local data = funcs.call("app:fetch_data", id)

-- Durable sleep
time.sleep("1h")

-- Current time
local now = time.now()

-- UUID generation
local id = uuid.v4()

-- Crypto operations
local bytes = crypto.random_bytes(32)

-- Child workflows
local result = workflow.exec("app:child", input)

-- Versioning
local v = workflow.version("change-1", 1, 2)
```

### 非确定性操作（应避免）

```lua
-- Don't use wall clock time
local now = os.time()              -- non-deterministic

-- Don't use random directly
local r = math.random()            -- non-deterministic

-- Don't do I/O in workflow code
local file = io.open("data.txt")   -- non-deterministic

-- Don't use global mutable state
counter = counter + 1               -- non-deterministic across replays
```

## 错误处理

### Activity 错误

Activity 错误携带结构化元数据：

```lua
local result, err = funcs.call("app:risky_activity", order)
if err then
    print(err:kind())       -- error classification (e.g. "NOT_FOUND", "INTERNAL")
    print(err:retryable())  -- whether the error is retryable
    print(err:message())    -- human-readable error message
end
```

### Activity 故障模式

为 activity 调用配置重试行为：

```lua
local executor = funcs.new():with_options({
    ["activity.retry_policy"] = {
        maximum_attempts = 1,
    }
})

local result, err = executor:call("app:unreliable_activity", input)
if err then
    local kind = err:kind()         -- "INTERNAL" for runtime errors
    local retryable = err:retryable()
end
```

### 子 Workflow 错误

来自子 workflow 的错误（通过 `process.exec` 或 EXIT 事件）携带相同的元数据：

```lua
local result, err = process.exec("app:error_workflow", "app:worker")
if err then
    print(err:kind())       -- e.g. "NOT_FOUND"
    print(err:retryable())  -- false
    print(err:message())    -- error details
end
```

## 补偿模式 (Saga)

```lua
local function main(order)
    local compensations = {}

    local reservation, err = funcs.call("app:reserve_inventory", order.items)
    if err then
        return {status = "failed", step = "inventory", error = tostring(err)}
    end
    table.insert(compensations, 1, {
        action = "app:release_inventory",
        args = reservation.id
    })

    local payment, err = funcs.call("app:charge_payment", order.payment)
    if err then
        run_compensations(compensations)
        return {status = "failed", step = "payment", error = tostring(err)}
    end
    table.insert(compensations, 1, {
        action = "app:refund_payment",
        args = payment.id
    })

    local shipment, err = funcs.call("app:ship_order", order.shipping)
    if err then
        run_compensations(compensations)
        return {status = "failed", step = "shipping", error = tostring(err)}
    end

    return {status = "completed", tracking = shipment.tracking}
end

local function run_compensations(compensations)
    for _, comp in ipairs(compensations) do
        funcs.call(comp.action, comp.args)
    end
end
```

## 另请参阅

- [Overview](temporal/overview.md) - 客户端和 worker 配置
- [Activities](temporal/activities.md) - Activity 定义和选项
- [Process](lua/core/process.md) - 进程管理 API
- [Functions](lua/core/funcs.md) - 函数调用
- [Channels](lua/core/channel.md) - Channel 操作
