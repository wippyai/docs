# Temporal Integration

Run durable workflows with Temporal.io.

## Overview

Wippy integrates with Temporal for:
- Durable workflow execution
- Activity orchestration
- Automatic replay and recovery
- Long-running processes that survive restarts

## Configuration

### Worker Entry

Define a Temporal worker:

```yaml
- name: worker
  kind: temporal.worker
  task_queue: my-app-queue
  workflows: true
  activities: true
  lifecycle:
    auto_start: true
```

### Connection

Configure in `.wippy.yaml`:

```yaml
temporal:
  address: localhost:7233
  namespace: default
```

Or via environment:
- `TEMPORAL_ADDRESS`
- `TEMPORAL_NAMESPACE`
- `TEMPORAL_API_KEY` (for Temporal Cloud)

## Workflows

### Definition

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

### Implementation

```lua
local funcs = require("funcs")
local time = require("time")

local function main(order)
    -- Call activity
    local payment, err = funcs.call("app:charge_payment", order.total)
    if err then
        return nil, err
    end

    -- Durable sleep (survives restarts)
    time.sleep("24h")

    -- Another activity
    local shipment = funcs.call("app:ship_order", order.id)

    return {
        payment_id = payment.id,
        tracking = shipment.tracking
    }
end

return { main = main }
```

### Workflow API

```lua
local workflow = require("workflow")

-- Get execution info
local info = workflow.info()
print(info.workflow_id)
print(info.run_id)

-- Deterministic versioning for code changes
local version = workflow.version("change-id", 1, 2)
if version == 2 then
    -- New code path
end

-- Monitor history size
local length = workflow.history_length()
local size = workflow.history_size()

-- Set search attributes and memo
workflow.attrs({
    search = {status = "processing"},
    memo = {customer_id = "123"}
})
```

## Activities

### Definition

```yaml
- name: charge_payment
  kind: function.lua
  source: file://payment.lua
  method: charge
  modules:
    - http_client
    - json
  meta:
    temporal:
      activity:
        worker: app:worker
```

### Local Activities

For fast, in-process execution:

```yaml
meta:
  temporal:
    activity:
      worker: app:worker
      local: true
```

### Calling Activities

```lua
local funcs = require("funcs")

-- Simple call
local result, err = funcs.call("app:charge_payment", amount)

-- With options
local executor = funcs.new()
executor = executor:with_options({
    task_queue = "payment-queue",
    start_to_close_timeout = "30s",
    retry_policy = {
        max_attempts = 3,
        initial_interval = "1s"
    }
})

local result, err = executor:call("app:charge_payment", amount)
```

## Spawning Workflows

Start workflows from anywhere:

```lua
local pid, err = process.spawn(
    "app:order_workflow",      -- workflow entry
    "temporal:my-app-queue",   -- host (temporal:task_queue)
    order_data                 -- input
)
```

From HTTP handlers:

```lua
local function handler()
    local req = http.request()
    local order = json.decode(req:body())

    local pid, err = process.spawn(
        "app:order_workflow",
        "temporal:orders",
        order
    )

    if err then
        return http.response():status(500):json({error = tostring(err)})
    end

    return http.response():json({
        workflow_id = tostring(pid),
        status = "started"
    })
end
```

## Signals

Send signals to running workflows:

```lua
process.send(workflow_pid, "approve", {approved_by = "admin"})
```

Receive in workflow:

```lua
local inbox = process.inbox()

while true do
    local msg = inbox:receive()
    if msg:topic() == "approve" then
        local data = msg:payload():data()
        -- Handle approval
        break
    end
end
```

## Child Workflows

Spawn child workflows:

```lua
local function main(order)
    -- Spawn child workflow
    local child_pid = process.spawn(
        "app:payment_workflow",
        "temporal:payments",
        {order_id = order.id, amount = order.total}
    )

    -- Wait for completion
    local events = process.events()
    for event in events:iter() do
        if event.pid == child_pid and event.type == "EXIT" then
            if event.reason == "normal" then
                -- Child completed successfully
            else
                -- Child failed
            end
            break
        end
    end
end
```

## Error Handling

```lua
local function main(input)
    local result, err = funcs.call("app:risky_activity", input)

    if err then
        -- Log and compensate
        funcs.call("app:send_alert", {
            error = tostring(err),
            input = input
        })
        return nil, err
    end

    return result
end
```

### Retry Policies

Configure in activity options:

```lua
executor:with_options({
    retry_policy = {
        max_attempts = 5,
        initial_interval = "1s",
        backoff_coefficient = 2.0,
        max_interval = "1m"
    }
})
```

## Determinism

Workflow code must be deterministic. Use:

- `time.sleep()` instead of `os.sleep()`
- `workflow.version()` for code changes
- `funcs.call()` for non-deterministic operations

Avoid:
- Direct I/O operations
- Random values (use activity)
- Current time (use `workflow.info().start_time`)

## Example: Order Processing

**Entry definitions:**

```yaml
version: "1.0"
namespace: app

entries:
  - name: worker
    kind: temporal.worker
    task_queue: orders
    workflows: true
    activities: true
    lifecycle:
      auto_start: true

  - name: order_workflow
    kind: workflow.lua
    source: file://order_workflow.lua
    method: main
    modules:
      - funcs
      - time
    meta:
      temporal:
        workflow:
          worker: app:worker

  - name: charge_payment
    kind: function.lua
    source: file://payment.lua
    method: charge
    modules:
      - http_client
      - json
    meta:
      temporal:
        activity:
          worker: app:worker

  - name: ship_order
    kind: function.lua
    source: file://shipping.lua
    method: ship
    modules:
      - http_client
    meta:
      temporal:
        activity:
          worker: app:worker
```

**order_workflow.lua:**

```lua
local funcs = require("funcs")
local time = require("time")

local function main(order)
    -- Charge payment
    local payment, err = funcs.call("app:charge_payment", {
        amount = order.total,
        customer = order.customer_id
    })
    if err then
        return {status = "failed", error = tostring(err)}
    end

    -- Wait for fulfillment window
    time.sleep("1h")

    -- Ship order
    local shipment, err = funcs.call("app:ship_order", {
        order_id = order.id,
        address = order.shipping_address
    })
    if err then
        -- Refund on shipping failure
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

## See Also

- [Workflows](concepts/workflows.md) - Workflow concepts
- [Functions](lua/core/funcs.md) - Function calls
- [Process](lua/core/process.md) - Process management
