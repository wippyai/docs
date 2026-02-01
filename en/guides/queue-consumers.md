# Queue Consumers

Queue consumers process messages from queues using worker pools.

## Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      Consumer                                │
│                                                              │
│  ┌─────────┐    ┌──────────────────┐    ┌───────────────┐  │
│  │  Queue  │───►│ Delivery Channel │───►│ Worker Pool   │  │
│  │ Driver  │    │ (prefetch=10)    │    │ (concurrency) │  │
│  └─────────┘    └──────────────────┘    └───────┬───────┘  │
│                                                  │          │
│                                          ┌──────┴──────┐   │
│                                          │  Function   │   │
│                                          │  Handler    │   │
│                                          └──────┬──────┘   │
│                                                  │          │
│                                          ┌──────┴──────┐   │
│                                          │  Ack/Nack   │   │
│                                          └─────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Configuration

| Option | Default | Max | Description |
|--------|---------|-----|-------------|
| `queue` | Required | - | Queue registry ID |
| `func` | Required | - | Handler function registry ID |
| `concurrency` | 1 | 1000 | Worker count |
| `prefetch` | 10 | 10000 | Message buffer size |

## Entry Definition

```yaml
- name: order_consumer
  kind: queue.consumer
  queue: app:orders
  func: app:process_order
  concurrency: 5
  prefetch: 20
  lifecycle:
    auto_start: true
    depends_on:
      - app:orders
```

## Handler Function

The handler function receives the message body:

```lua
-- process_order.lua
local json = require("json")

local function handler(body)
    local order = json.decode(body)

    -- Process the order
    local result, err = process_order(order)
    if err then
        -- Return error to trigger Nack (requeue)
        return nil, err
    end

    -- Success triggers Ack
    return result
end

return handler
```

```yaml
- name: process_order
  kind: function.lua
  source: file://process_order.lua
  modules:
    - json
```

## Acknowledgment

| Result | Action | Effect |
|--------|--------|--------|
| Success | Ack | Message removed from queue |
| Error | Nack | Message requeued (driver-dependent) |

## Worker Pool

- Workers run as concurrent goroutines
- Each worker processes one message at a time
- Messages distributed round-robin from delivery channel
- Prefetch buffer allows driver to deliver ahead

### Example

```
concurrency: 3
prefetch: 10

Flow:
1. Driver delivers up to 10 messages to buffer
2. 3 workers pull from buffer concurrently
3. As workers finish, buffer refills
4. Backpressure when all workers busy and buffer full
```

## Graceful Shutdown

On stop:
1. Stop accepting new deliveries
2. Cancel worker contexts
3. Wait for in-flight messages (with timeout)
4. Return timeout error if workers don't finish

## Queue Declaration

```yaml
# Queue driver (memory for dev/test)
- name: queue_driver
  kind: queue.driver.memory
  lifecycle:
    auto_start: true

# Queue definition
- name: orders
  kind: queue.queue
  driver: app:queue_driver
  options:
    queue_name: orders      # Override name (default: entry name)
    max_length: 10000       # Maximum queue size
    durable: true           # Survive restarts
```

| Option | Description |
|--------|-------------|
| `queue_name` | Override queue name (default: entry ID name) |
| `max_length` | Maximum queue size |
| `durable` | Survive restarts (driver-dependent) |

## Memory Driver

Built-in in-memory queue for development/testing:

- Kind: `queue.driver.memory`
- Messages stored in memory
- Nack requeues message to front of queue
- No persistence across restarts

## See Also

- [Message Queue](lua/storage/queue.md) - Queue module reference
- [Queue Configuration](system/queue.md) - Queue drivers and entry definitions
- [Supervision Trees](guides/supervision.md) - Consumer lifecycle
- [Process Management](lua/core/process.md) - Process spawning and communication
