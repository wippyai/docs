# Workflows

Workflows are durable functions that orchestrate activities and maintain state across failures and restarts.

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
        -- Compensate on failure
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

The `workflow` module provides workflow-specific operations:

```lua
local workflow = require("workflow")

-- Get execution information
local info = workflow.info()
print(info.workflow_id)
print(info.run_id)
print(info.task_queue)
print(info.attempt)
print(info.start_time)
```

### Versioning

Handle code changes safely with versioning:

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
- `change_id` - Identifier for this change
- `min_version` - Minimum supported version
- `max_version` - Maximum (current) version

### History Monitoring

Monitor workflow history size:

```lua
local length = workflow.history_length()  -- Number of events
local size = workflow.history_size()      -- Size in bytes

if length > 10000 then
    -- Consider continue-as-new for long-running workflows
end
```

### Search Attributes and Memo

Update searchable attributes and memo:

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

## Signals

Send data to running workflows:

**Sending signals:**

```lua
-- From any process
process.send(workflow_pid, "approve", {
    approved_by = "admin",
    comment = "Looks good"
})

process.send(workflow_pid, "cancel", {
    reason = "Customer request"
})
```

**Receiving signals in workflow:**

```lua
local function main(order)
    local inbox = process.inbox()

    -- Wait for approval
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

    -- Continue with approved order
    return process_order(order)
end
```

### Non-blocking Signal Check

```lua
local msg = inbox:try_receive()
if msg then
    -- Handle message
else
    -- No message available
end
```

### Signal with Timeout

```lua
local msg = inbox:receive_timeout("30s")
if msg then
    -- Handle message
else
    -- Timeout expired
end
```

## Child Workflows

Spawn and coordinate child workflows:

```lua
local function main(order)
    -- Spawn child workflow
    local payment_pid = process.spawn(
        "app:payment_workflow",
        "app:worker",
        {order_id = order.id, amount = order.total}
    )

    local shipping_pid = process.spawn(
        "app:shipping_workflow",
        "app:worker",
        {order_id = order.id, address = order.address}
    )

    -- Wait for both to complete
    local results = {}
    local events = process.events()

    for event in events:iter() do
        if event.type == "EXIT" then
            if event.pid == payment_pid then
                results.payment = event.result
            elseif event.pid == shipping_pid then
                results.shipping = event.result
            end
        end

        if results.payment and results.shipping then
            break
        end
    end

    return {
        status = "completed",
        payment = results.payment,
        shipping = results.shipping
    }
end
```

## Timers

Durable timers that survive restarts:

```lua
local time = require("time")

-- Sleep for duration
time.sleep("24h")
time.sleep("5m")
time.sleep("30s")

-- Sleep until specific time
time.sleep_until(deadline_timestamp)
```

### Timer with Signal Race

Wait for either a timer or signal:

```lua
local function wait_for_payment(timeout)
    local inbox = process.inbox()
    local deadline = time.now():add(timeout)

    while time.now() < deadline do
        local msg = inbox:receive_timeout("1m")
        if msg and msg:topic() == "payment_received" then
            return msg:payload():data()
        end
    end

    return nil, errors.new("TIMEOUT", "payment not received")
end
```

## Determinism

Workflow code must be deterministic. The same inputs must produce the same sequence of commands.

### Do

```lua
-- Use deterministic time
local start = workflow.info().start_time

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

### Moving Non-Deterministic Code to Activities

```lua
-- Activity definition
- name: generate_id
  kind: function.lua
  source: file://utils.lua
  method: generate_id
  meta:
    temporal:
      activity:
        worker: app:worker
        local: true  -- Fast local activity

-- utils.lua
local uuid = require("uuid")
local function generate_id()
    return uuid.v4()
end
return { generate_id = generate_id }

-- In workflow
local id = funcs.call("app:generate_id")
```

## Error Handling

### Activity Errors

```lua
local result, err = funcs.call("app:risky_activity", input)

if err then
    -- Log error
    funcs.call("app:log_error", {
        workflow_id = workflow.info().workflow_id,
        error = tostring(err),
        input = input
    })

    -- Compensate
    funcs.call("app:rollback", {transaction_id = tx_id})

    return {status = "failed", error = tostring(err)}
end
```

### Compensation Pattern (Saga)

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

## Complete Example

**Entry definitions:**

```yaml
version: "1.0"
namespace: app

entries:
  - name: temporal_client
    kind: temporal.client
    address: "localhost:7233"
    namespace: "default"
    lifecycle:
      auto_start: true

  - name: worker
    kind: temporal.worker
    client: app:temporal_client
    task_queue: "orders"
    lifecycle:
      auto_start: true
      depends_on:
        - app:temporal_client

  - name: order_workflow
    kind: workflow.lua
    source: file://order_workflow.lua
    method: main
    modules:
      - funcs
      - time
      - workflow
      - errors
    meta:
      temporal:
        workflow:
          worker: app:worker

  - name: validate_order
    kind: function.lua
    source: file://order.lua
    method: validate
    modules:
      - errors
    meta:
      temporal:
        activity:
          worker: app:worker
          local: true

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
      - json
    meta:
      temporal:
        activity:
          worker: app:worker
```

**order_workflow.lua:**

```lua
local funcs = require("funcs")
local time = require("time")
local workflow = require("workflow")
local errors = require("errors")

local function main(order)
    -- Update search attributes
    workflow.attrs({
        search = {status = "validating", customer_id = order.customer_id}
    })

    -- Validate order (local activity)
    local valid, err = funcs.call("app:validate_order", order)
    if err then
        workflow.attrs({search = {status = "rejected"}})
        return {status = "rejected", error = tostring(err)}
    end

    -- Charge payment
    workflow.attrs({search = {status = "charging"}})
    local payment, err = funcs.call("app:charge_payment", {
        amount = order.total,
        customer = order.customer_id
    })
    if err then
        workflow.attrs({search = {status = "payment_failed"}})
        return {status = "payment_failed", error = tostring(err)}
    end

    -- Wait for fulfillment window
    workflow.attrs({search = {status = "awaiting_fulfillment"}})
    time.sleep("1h")

    -- Ship order
    workflow.attrs({search = {status = "shipping"}})
    local shipment, err = funcs.call("app:ship_order", {
        order_id = order.id,
        address = order.shipping_address
    })
    if err then
        -- Refund on shipping failure
        funcs.call("app:refund_payment", payment.id)
        workflow.attrs({search = {status = "shipping_failed"}})
        return {status = "shipping_failed", error = tostring(err)}
    end

    workflow.attrs({search = {status = "completed"}})
    return {
        status = "completed",
        payment_id = payment.id,
        tracking = shipment.tracking_number
    }
end

return { main = main }
```

## See Also

- [Overview](temporal/overview.md) - Configuration
- [Activities](temporal/activities.md) - Activity definitions
- [Process](lua/core/process.md) - Process management
- [Functions](lua/core/funcs.md) - Function calls
