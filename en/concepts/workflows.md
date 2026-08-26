---
title: "Workflows"
description: "How Wippy persists long-running workflows, replays execution, receives signals, and recovers from failures."
---

# Workflows

Workflows persist the state of long-running operations so execution can recover after crashes and restarts. They suit processes such as payments, order fulfillment, and multi-step approvals.

## Why Use Workflows

Functions keep in-flight state in memory, while workflows persist execution state:

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

The workflow engine intercepts calls and records their results. After a crash, it replays execution from the recorded history.

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

Workflows use `process.spawn()` with a workflow host:

```lua
-- Spawn workflow on temporal worker
local pid = process.spawn("app.workflows:order_processor", "app:temporal_worker", order_data)

-- Send signals to workflow
process.send(pid, "update", {status = "approved"})
```

The caller uses the same spawn API. The host determines whether the entry runs on a `temporal.worker` or a `process.host`.

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

Workflows do not use process supervision trees. The workflow provider manages their persistence, retries, and recovery.

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

- [Functions](concepts/functions.md) — Stateless request handling
- [Process Model](concepts/process-model.md) — Stateful background work
- [Supervision](guides/supervision.md) — Process restart policies
