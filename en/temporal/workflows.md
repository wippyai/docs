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
| `name` | No | Custom workflow name (defaults to entry ID) |

## Basic Implementation

```lua
local funcs = require("funcs")
local time = require("time")

local function main(order)
    -- Call activity
    local payment, err = funcs.call("app:charge_payment", {
        amount = order.total,
        customer = order.customer_id
    })
    if err then
        return {status = "failed", error = tostring(err)}
    end

    -- Durable sleep (survives restarts)
    time.sleep("1h")

    -- Another activity
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

### workflow.version()

Handle code changes with deterministic versioning:

```lua
local version = workflow.version("payment-v2", 1, 2)

if version == 1 then
    -- Old behavior (for existing executions)
    result = funcs.call("app:old_payment", input)
else
    -- New behavior (version 2)
    result = funcs.call("app:new_payment", input)
end
```

Parameters:
- `change_id` - Unique identifier for this change
- `min_supported` - Minimum supported version
- `max_supported` - Maximum (current) version

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

### workflow.history_length()

Get the number of events in workflow history:

```lua
local length = workflow.history_length()
if length > 10000 then
    -- Consider continue-as-new
end
```

### workflow.history_size()

Get workflow history size in bytes:

```lua
local size = workflow.history_size()
```

### workflow.call()

Execute a child workflow:

```lua
local result, err = workflow.call("app:child_workflow", input_data)
```

## Signals

Send data to running workflows using the process inbox.

**Sending signals:**

```lua
process.send(workflow_pid, "approve", {
    approved_by = "admin",
    comment = "Looks good"
})
```

**Receiving signals in workflow:**

```lua
local function main(order)
    local inbox = process.inbox()

    while true do
        local msg = inbox:receive()
        local topic = msg:topic()

        if topic == "approve" then
            local data = msg:payload():data()
            break
        elseif topic == "cancel" then
            local data = msg:payload():data()
            return {status = "cancelled", reason = data.reason}
        end
    end

    return process_order(order)
end
```

## Timers

Durable timers survive restarts:

```lua
local time = require("time")

time.sleep("24h")
time.sleep("5m")
time.sleep("30s")
```

## Determinism

Workflow code must be deterministic. The same inputs must produce the same sequence of commands.

### Do

```lua
-- Use workflow info for current time context
local info = workflow.info()

-- Use durable sleep
time.sleep("1h")

-- Use activities for I/O
local data = funcs.call("app:fetch_data", id)

-- Use versioning for code changes
local v = workflow.version("change-1", 1, 2)
```

### Don't

```lua
-- Don't use wall clock time
local now = os.time()  -- Non-deterministic

-- Don't use random directly
local r = math.random()  -- Non-deterministic

-- Don't do I/O in workflow code
local file = io.open("data.txt")  -- Non-deterministic

-- Don't use global mutable state
counter = counter + 1  -- Non-deterministic across replays
```

## Error Handling

```lua
local function main(order)
    local result, err = funcs.call("app:risky_activity", order)

    if err then
        -- Log and compensate
        funcs.call("app:send_alert", {
            error = tostring(err),
            order_id = order.id
        })

        return {status = "failed", error = tostring(err)}
    end

    return {status = "completed", result = result}
end
```

## Compensation Pattern (Saga)

```lua
local function main(order)
    local compensations = {}

    -- Step 1: Reserve inventory
    local reservation, err = funcs.call("app:reserve_inventory", order.items)
    if err then
        return {status = "failed", step = "inventory", error = tostring(err)}
    end
    table.insert(compensations, 1, {
        action = "app:release_inventory",
        args = reservation.id
    })

    -- Step 2: Charge payment
    local payment, err = funcs.call("app:charge_payment", order.payment)
    if err then
        run_compensations(compensations)
        return {status = "failed", step = "payment", error = tostring(err)}
    end
    table.insert(compensations, 1, {
        action = "app:refund_payment",
        args = payment.id
    })

    -- Step 3: Ship order
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

## Spawning Workflows

Start workflows from any code:

```lua
local pid, err = process.spawn(
    "app:order_workflow",    -- workflow entry
    "app:worker",            -- temporal worker
    {order_id = "123"}       -- input
)
```

From HTTP handlers:

```lua
local function handler()
    local req = http.request()
    local order = json.decode(req:body())

    local pid, err = process.spawn(
        "app:order_workflow",
        "app:worker",
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

## See Also

- [Overview](temporal/overview.md) - Configuration
- [Activities](temporal/activities.md) - Activity definitions
- [Process](lua/core/process.md) - Process management
- [Functions](lua/core/funcs.md) - Function calls
