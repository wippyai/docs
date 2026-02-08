# Workflows

Workflows are durable functions that orchestrate activities and maintain state across failures and restarts. They're defined using the `workflow.lua` entry kind.

## Definition

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

### Metadata Fields

| Field | Required | Description |
|-------|----------|-------------|
| `worker` | Yes | Reference to `temporal.worker` entry |
| `name` | No | Custom workflow type name (defaults to entry ID) |

## Basic Implementation

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

## Workflow Module

The `workflow` module provides workflow-specific operations.

### workflow.info()

Get workflow execution information:

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

Execute a child workflow synchronously and wait for its result:

```lua
local result, err = workflow.exec("app:child_workflow", input_data)
if err then
    return nil, err
end
```

This is the simplest way to run child workflows when you need to wait for the result inline.

### workflow.version()

Handle code changes with deterministic versioning:

```lua
local version = workflow.version("payment-v2", 1, 2)

if version == 1 then
    result = funcs.call("app:old_payment", input)
else
    result = funcs.call("app:new_payment", input)
end
```

Parameters:
- `change_id` - Unique identifier for this change
- `min_supported` - Minimum supported version
- `max_supported` - Maximum (current) version

The version number is deterministic per workflow execution. Existing in-flight workflows continue using their recorded version, while new workflows use `max_supported`.

### workflow.attrs()

Update search attributes and memo:

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

Search attributes are indexed and queryable via Temporal visibility APIs. Memo is arbitrary non-indexed data attached to the workflow.

### workflow.history_length() / workflow.history_size()

Monitor workflow history growth:

```lua
local length = workflow.history_length()
local size = workflow.history_size()

if length > 10000 then
    -- Consider continue-as-new to reset history
end
```

## Starting Workflows

### Basic Spawn

Start a workflow from any code using `process.spawn()`:

```lua
local pid, err = process.spawn(
    "app:order_workflow",    -- workflow entry
    "app:worker",            -- temporal worker
    {order_id = "123"}       -- input
)
```

The host parameter is the temporal worker (not a process host). The workflow runs durably on Temporal infrastructure.

### Spawn with Monitoring

Monitor workflows to receive EXIT events when they complete:

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

### Spawn with Name

Assign a name to a workflow for idempotent starts:

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

When a name is provided, Temporal uses it to deduplicate workflow starts. Spawning with the same name while a workflow is running returns the existing workflow's PID by default.

### Spawn with Explicit Workflow ID

Set a specific Temporal workflow ID:

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

### ID Conflict Policies

Control behavior when spawning a workflow with an ID that already exists:

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

| Policy | Behavior |
|--------|----------|
| `"use_existing"` | Return existing workflow PID (default with explicit ID) |
| `"fail"` | Return error if workflow exists |
| `"terminate_existing"` | Terminate existing and start new |

### Workflow Start Options

Pass Temporal workflow options via `with_options()`:

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

#### Full Options Reference

| Option | Type | Description |
|--------|------|-------------|
| `temporal.workflow.id` | string | Explicit workflow execution ID |
| `temporal.workflow.task_queue` | string | Override task queue |
| `temporal.workflow.execution_timeout` | duration | Total workflow execution timeout |
| `temporal.workflow.run_timeout` | duration | Single run timeout |
| `temporal.workflow.task_timeout` | duration | Workflow task processing timeout |
| `temporal.workflow.id_conflict_policy` | string | `use_existing`, `fail`, `terminate_existing` |
| `temporal.workflow.id_reuse_policy` | string | `allow_duplicate`, `allow_duplicate_failed_only`, `reject_duplicate` |
| `temporal.workflow.execution_error_when_already_started` | boolean | Error if workflow already running |
| `temporal.workflow.retry_policy` | table | Retry policy (see below) |
| `temporal.workflow.cron_schedule` | string | Cron expression for recurring workflows |
| `temporal.workflow.memo` | table | Non-indexed workflow metadata |
| `temporal.workflow.search_attributes` | table | Indexed queryable attributes |
| `temporal.workflow.enable_eager_start` | boolean | Start execution immediately |
| `temporal.workflow.start_delay` | duration | Delay before workflow starts |
| `temporal.workflow.parent_close_policy` | string | Child behavior on parent close |
| `temporal.workflow.wait_for_cancellation` | boolean | Wait for cancellation to finish |
| `temporal.workflow.namespace` | string | Temporal namespace override |

Duration values accept strings (`"5s"`, `"10m"`, `"1h"`) or milliseconds as numbers.

#### Parent Close Policy

Controls what happens to child workflows when the parent closes:

| Policy | Behavior |
|--------|----------|
| `"terminate"` | Terminate child workflow |
| `"abandon"` | Let child continue independently |
| `"request_cancel"` | Send cancellation request to child |

### Startup Messages

Queue signals to send to a workflow immediately after it starts. Messages are delivered before any external signals:

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

Startup messages are especially useful with `use_existing` conflict policy. When a second spawn resolves to an existing workflow, the startup messages are still delivered:

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

### Context Propagation

Pass context values that are accessible inside the workflow and its activities:

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

Inside the workflow (or any activity it calls), read context via the `ctx` module:

```lua
local ctx = require("ctx")

local user_id = ctx.get("user_id")       -- "user-1"
local tenant = ctx.get("tenant")         -- "tenant-1"
local all = ctx.all()                    -- {user_id="user-1", tenant="tenant-1", request_id="req-abc"}
```

### From HTTP Handlers

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

## Signals

Workflows receive signals via the process messaging system. Signals are durable - they survive workflow replays.

### Inbox Pattern

Receive all messages through the process inbox:

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

### Topic-Based Subscription

Subscribe to specific topics using `process.listen()`:

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

By default, `process.listen()` returns raw payload data. Use `{message = true}` to receive Message objects with sender information:

```lua
local ch = process.listen("request", {message = true})
local msg = ch:receive()
local sender = msg:from()
local data = msg:payload():data()
```

### Multiple Signal Handlers

Use `coroutine.spawn()` to handle different signal types concurrently:

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

### Signal Acknowledgment

Implement request-reply patterns by sending responses back to the sender:

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

### Cross-Workflow Signaling

Workflows can send signals to other workflows using their PID:

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

## Child Workflows

### Synchronous Child (workflow.exec)

Execute a child workflow and wait for the result:

```lua
local result, err = workflow.exec("app:child_workflow", input_data)
if err then
    return nil, err
end
```

### Asynchronous Child (process.spawn)

Spawn a child workflow without blocking, then wait for its completion via events:

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

### Error Propagation from Children

When a child workflow returns an error, it appears in the EXIT event:

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

### Executing Workflows Synchronously (process.exec)

Run a workflow and wait for its result in one call:

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

## Monitoring and Linking

### Post-Start Monitoring

Monitor a workflow after it has already started:

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

### Post-Start Linking

Link to a running workflow to receive LINK_DOWN on abnormal termination:

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

LINK_DOWN events require `trap_links = true` in process options. Without it, a linked process termination propagates the failure.

### Unmonitor / Unlink

Remove monitoring or linking:

```lua
process.unmonitor(pid)  -- stop receiving EXIT events
process.unlink(pid)     -- remove bidirectional link
```

After unmonitoring or unlinking, events for that process are no longer delivered.

## Termination and Cancellation

### Terminate

Force-terminate a running workflow:

```lua
local ok, err = process.terminate(workflow_pid)
```

Monitored callers receive an EXIT event with an error.

### Cancel

Request graceful cancellation with an optional deadline:

```lua
local ok, err = process.cancel(workflow_pid, "5s")
```

## Concurrent Work

Use `coroutine.spawn()` and channels for parallel work inside workflows:

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

All channel operations and sleeps inside coroutines are replay-safe.

## Timers

Durable timers survive restarts:

```lua
local time = require("time")

time.sleep("24h")
time.sleep("5m")
time.sleep("30s")
time.sleep(100 * time.MILLISECOND)
```

Track elapsed time:

```lua
local start = time.now()
time.sleep("1s")
local elapsed = time.now():sub(start):milliseconds()
```

## Determinism

Workflow code must be deterministic. The same inputs must produce the same sequence of commands.

### Replay-Safe Operations

These operations are automatically intercepted and their results recorded. On replay, recorded values are returned:

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

### Non-Deterministic (Avoid)

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

## Error Handling

### Activity Errors

Activity errors carry structured metadata:

```lua
local result, err = funcs.call("app:risky_activity", order)
if err then
    print(err:kind())       -- error classification (e.g. "NOT_FOUND", "INTERNAL")
    print(err:retryable())  -- whether the error is retryable
    print(err:message())    -- human-readable error message
end
```

### Activity Failure Modes

Configure retry behavior for activity calls:

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

### Child Workflow Errors

Errors from child workflows (via `process.exec` or EXIT events) carry the same metadata:

```lua
local result, err = process.exec("app:error_workflow", "app:worker")
if err then
    print(err:kind())       -- e.g. "NOT_FOUND"
    print(err:retryable())  -- false
    print(err:message())    -- error details
end
```

## Compensation Pattern (Saga)

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

## See Also

- [Overview](temporal/overview.md) - Client and worker configuration
- [Activities](temporal/activities.md) - Activity definitions and options
- [Process](lua/core/process.md) - Process management API
- [Functions](lua/core/funcs.md) - Function invocation
- [Channels](lua/core/channel.md) - Channel operations
