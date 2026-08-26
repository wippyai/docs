---
title: "Event Bus"
description: "Publish and observe best-effort runtime and application events."
---

# Event Bus
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="permissions"/>

The event bus publishes runtime and application activity for monitoring, logging, metrics, and reactive side effects.

<note>
The event bus is a best-effort publish/subscribe channel, not a reliable transport. Do not depend on it for business-critical delivery. Use process messaging (`process.send`), channels, or the [message queue](lua/storage/queue.md) when delivery is part of application correctness.
</note>

## Loading

```lua
local events = require("events")
```

## Subscribing to Events

Subscribe to one system or a system pattern, with an optional event-kind filter:

```lua
-- Subscribe to all order events
local sub, err = events.subscribe("orders.*")
if err then
    return nil, err
end

-- Subscribe to specific event kind
local sub = events.subscribe("users", "user.created")

-- Subscribe to all events from a system
local sub = events.subscribe("payments")

-- Process events
local ch = sub:channel()
while true do
    local evt, ok = ch:receive()
    if not ok then break end

    logger:info("Received event", {
        system = evt.system,
        kind = evt.kind,
        path = evt.path
    })
    handle_event(evt)
end
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `system` | string | System pattern (supports wildcards like "test.*") |
| `kind` | string | Event kind filter (optional) |

**Returns:** `Subscription, error`

## Publishing Events

Publish an event to the event bus:

```lua
-- Send order created event
local ok, err = events.send("orders", "order.created", "/orders/123", {
    order_id = "123",
    customer_id = "456",
    total = 99.99
})
if err then
    return nil, err
end

-- Send user event
events.send("users", "user.registered", "/users/" .. user.id, {
    user_id = user.id,
    email = user.email,
    created_at = time.now():format("2006-01-02T15:04:05Z07:00")
})

-- Send payment event
events.send("payments", "payment.completed", "/payments/" .. payment.id, {
    payment_id = payment.id,
    order_id = payment.order_id,
    amount = payment.amount,
    method = payment.method
})

-- Send without data
events.send("system", "heartbeat", "/health")
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `system` | string | System identifier |
| `kind` | string | Event kind/type |
| `path` | string | Event path for routing |
| `data` | any | Event payload (optional) |

**Returns:** `boolean, error`

## Subscription Methods

### Receive Channel

Use the subscription channel to receive events:

```lua
local ch = sub:channel()

local evt, ok = ch:receive()
if ok then
    print("System:", evt.system)
    print("Kind:", evt.kind)
    print("Path:", evt.path)
    print("Data:", json.encode(evt.data))
end
```

Each event contains `system`, `kind`, `path`, and `data` fields.

### Close a Subscription

Close the subscription to unsubscribe and close its channel:

```lua
sub:close()
```

## Permissions

| Action | Resource | Description |
|--------|----------|-------------|
| `events.subscribe` | system | Subscribe to events from a system |
| `events.send` | system | Send events to a system |

## Errors

| Condition | Kind | Retryable |
|-----------|------|-----------|
| Empty system | `errors.INVALID` | no |
| Empty kind | `errors.INVALID` | no |
| Empty path | `errors.INVALID` | no |
| Policy denied | `errors.INVALID` | no |

See [Error Handling](lua/core/errors.md) for working with errors.
