# Message Queue
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>
<secondary-label ref="permissions"/>

Publish and consume messages from distributed queues. Supports multiple backends including RabbitMQ and other AMQP-compatible brokers.

For queue configuration, see [Queue](system-queue.md).

## Loading

```lua
local queue = require("queue")
```

## Publishing Messages

Send messages to a queue by ID:

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

Headers enable routing, priority, and tracing:

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

Within a queue consumer, access the current message:

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

Only available when processing queue messages in consumer context.

## Message Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `id()` | `string, error` | Unique message identifier |
| `header(key)` | `any, error` | Single header value (nil if missing) |
| `headers()` | `table, error` | All message headers |

## Consumer Pattern

Queue consumers are defined as entry points that receive the payload directly:

```yaml
entries:
  - kind: queue.consumer
    id: email_worker
    queue: app:emails
    method: handle_email
```

```lua
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

Queue operations are subject to security policy evaluation.

| Action | Resource | Description |
|--------|----------|-------------|
| `queue.publish` | - | General permission to publish messages |
| `queue.publish.queue` | Queue ID | Publish to specific queue |

Both permissions are checked: first the general permission, then the queue-specific one.

## Errors

| Condition | Kind | Retryable |
|-----------|------|-----------|
| Queue ID empty | `errors.INVALID` | no |
| Message data empty | `errors.INVALID` | no |
| No delivery context | `errors.INVALID` | no |
| Permission denied | `errors.PERMISSION_DENIED` | no |
| Publish failed | `errors.INTERNAL` | yes |

See [Error Handling](lua/core/errors.md) for working with errors.

## See Also

- [Queue Configuration](system/queue.md) - Queue drivers and entry definitions
- [Queue Consumers Guide](guides/queue-consumers.md) - Consumer patterns and worker pools
- [Process Management](lua/core/process.md) - Process spawning and communication
- [Channels](lua/core/channel.md) - Inter-process communication patterns
- [Functions](lua/core/funcs.md) - Async function invocation
