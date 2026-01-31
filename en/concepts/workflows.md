# Workflows

Workflows are durable, long-running operations that survive crashes and restarts. They provide reliability guarantees for critical business processes like payments, order fulfillment, and multi-step approvals.

## Why Workflows?

Functions are ephemeral - if the host crashes, in-flight work is lost. Workflows persist their state:

| Aspect | Functions | Workflows |
|--------|-----------|-----------|
| State | In memory | Persisted |
| Crash | Lost work | Resumes |
| Duration | Seconds to minutes | Hours to months |
| Completion | Best effort | Guaranteed |

## How Workflows Work

Workflow code looks like regular Lua code:

```lua
local funcs = require("funcs")
local time = require("time")

local result = funcs.call("app.api:charge_card", payment)
time.sleep("24h")
local status = funcs.call("app.api:check_status", result.id)

if status == "failed" then
    funcs.call("app.api:refund", result.id)
end
```

The workflow engine intercepts calls and records results. If the process crashes, execution replays from history - same code, same results.

<note>
Wippy handles determinism automatically. Operations like <code>funcs.call()</code>, <code>time.sleep()</code>, <code>uuid.v4()</code>, and <code>time.now()</code> are intercepted and their results recorded. On replay, recorded values are returned instead of re-executing.
</note>

## Workflow Patterns

### Saga Pattern

Compensate on failure:

```lua
local funcs = require("funcs")

local inventory = funcs.call("app.inventory:reserve", items)
if inventory.error then
    return nil, inventory.error
end

local payment = funcs.call("app.payments:charge", amount)
if payment.error then
    funcs.call("app.inventory:release", inventory.id)
    return nil, payment.error
end

local shipping = funcs.call("app.shipping:create", order)
if shipping.error then
    funcs.call("app.payments:refund", payment.id)
    funcs.call("app.inventory:release", inventory.id)
    return nil, shipping.error
end

return {inventory = inventory, payment = payment, shipping = shipping}
```

### Waiting for Signals

Wait for external events (approval decisions, webhooks, user actions):

```lua
local funcs = require("funcs")

funcs.call("app.approvals:submit", request)

local inbox = process.inbox()
local msg = inbox:receive()  -- blocks until signal arrives

if msg.approved then
    funcs.call("app.orders:fulfill", request.order_id)
else
    funcs.call("app.notifications:send_rejection", request)
end
```

## When to Use What

| Use Case | Choose |
|----------|--------|
| HTTP request handling | Functions |
| Data transformation | Functions |
| Background jobs | Processes |
| User session state | Processes |
| Real-time messaging | Processes |
| Payment processing | Workflows |
| Order fulfillment | Workflows |
| Multi-day approvals | Workflows |

## Starting Workflows

Workflows are spawned the same way as processes - using `process.spawn()` with a different host:

```lua
-- Spawn workflow on temporal worker
local pid = process.spawn("app.workflows:order_processor", "app:temporal_worker", order_data)

-- Send signals to workflow
process.send(pid, "update", {status = "approved"})
```

From the caller's perspective, the API is identical. The difference is the host: workflows run on a `temporal.worker` instead of a `process.host`.

<tip>
When a workflow spawns children via <code>process.spawn()</code>, they become child workflows on the same provider, maintaining durability guarantees.
</tip>

## Failure and Supervision

Processes can run as supervised services using `process.service`:

```yaml
# Process definition
- name: session_handler
  kind: process.lua
  source: file://session_handler.lua
  method: main

# Supervised service wrapping the process
- name: session_manager
  kind: process.service
  process: app:session_handler
  host: app:processes
  lifecycle:
    auto_start: true
    restart:
      max_attempts: 10
```

Workflows don't use supervision trees - they're automatically managed by the workflow provider (Temporal). The provider handles persistence, retries, and recovery.

Processes can monitor workflows via events, but workflows cannot monitor processes:

```lua
local events = process.events()
local pid = process.spawn("app.workflows:order", "app:temporal_worker", data)

for event in events:iter() do
    if event.pid == pid and event.type == "EXIT" then
        -- workflow completed or failed
        break
    end
end
```

## Configuration

Process definition (spawned dynamically):

```yaml
- name: order_processor
  kind: workflow.lua
  source: file://order_processor.lua
  method: main
  modules:
    - funcs
    - time
```

Workflow provider:

```yaml
- name: temporal_worker
  kind: temporal.worker
  client: app:temporal_client
  task_queue: "orders"
  lifecycle:
    auto_start: true
```

See [Temporal](https://temporal.io) for production workflow infrastructure.

## See Also

- [Functions](concept-functions.md) - Stateless request handling
- [Process Model](concept-process-model.md) - Stateful background work
- [Supervision](guide-supervision.md) - Process restart policies
