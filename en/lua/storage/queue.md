---
title: "Message Queue"
description: "Publish messages and process deliveries from configured queues."
---

# Message Queue
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>
<secondary-label ref="permissions"/>

The `queue` module publishes messages and processes deliveries from configured distributed queues, including RabbitMQ and other AMQP-compatible brokers.

For queue configuration, see [Queue](system/queue.md).

## Loading

```lua
local queue = require("queue")
```

## Publishing Messages

Publish a message to a queue by ID:

```lua
local ok, err = queue.publish("app:tasks", {
    action = "send_email",
    user_id = 456,
    template = "welcome"
})
if err then
    return nil, err
end
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `queue_id` | string | Queue identifier (format: "namespace:name") |
| `data` | any | Message data (tables, strings, numbers, booleans) |
| `headers` | table | Optional message headers |

**Returns:** `boolean, error`

### Message Headers

Headers carry routing, priority, and tracing metadata:

```lua
queue.publish("app:notifications", {
    type = "order_shipped",
    order_id = order.id
}, {
    priority = "high",
    correlation_id = request_id
})
```

## Accessing Delivery Context

Access the current delivery from within a queue consumer:

```lua
local msg, err = queue.message()
if err then
    return nil, err
end

local msg_id = msg:id()
local priority = msg:header("priority")
local all_headers = msg:headers()
```

**Returns:** `Message, error`

This function is available only while a queue consumer is processing a message.

## Message Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `id()` | `string, error` | Unique message identifier |
| `header(key)` | `any, error` | Single header value (nil if missing) |
| `headers()` | `table, error` | All message headers |
| `ack()` | `boolean, error` | Acknowledge processing (single-shot) |
| `nack()` | `boolean, error` | Signal failure for redelivery or dead-letter (single-shot) |

The runtime auto-acks on handler success and auto-nacks on handler error. Call `ack`/`nack` only to settle early.

## Queue Info

```lua
local stats, err = queue.info("app:tasks")
-- stats may contain: message_count, consumer_count, ready (driver-dependent)
```

**Returns:** `table, error`

## Consumer Pattern

A `queue.consumer` entry binds a queue to the handler referenced by `func`. The handler receives the message payload directly:

```yaml
entries:
  - kind: queue.consumer
    id: email_worker
    queue: app:emails
    func: app:email_handler
```

```lua
-- app:email_handler
function handle_email(payload)
    local msg = queue.message()

    logger:info("Processing", {
        message_id = msg:id(),
        to = payload.to
    })

    local ok, err = email.send(payload.to, payload.template, payload.data)
    if err then
        return nil, err  -- Message will be requeued or dead-lettered
    end
end
```

## Permissions

Security policy evaluation applies to queue operations.

| Action | Resource | Description |
|--------|----------|-------------|
| `queue.publish` | - | General permission to publish messages |
| `queue.publish.queue` | Queue ID | Publish to specific queue |

The runtime checks the general permission first and the queue-specific permission second.

## Errors

| Condition | Kind | Retryable |
|-----------|------|-----------|
| Queue ID empty | `errors.INVALID` | no |
| Message data empty | `errors.INVALID` | no |
| No delivery context | `errors.INVALID` | no |
| Publish not allowed | `errors.INVALID` | no |
| Publish failed | `errors.INTERNAL` | no |

See [Error Handling](lua/core/errors.md) for working with errors.

## See Also

- [Queue Configuration](system/queue.md) - Queue drivers and entry definitions
- [Queue Consumers Guide](guides/queue-consumers.md) - Consumer patterns and worker pools
- [Process Management](lua/core/process.md) - Process spawning and communication
- [Channels](lua/core/channel.md) - Inter-process communication patterns
- [Functions](lua/core/funcs.md) - Async function invocation
