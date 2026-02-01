# Channels and Coroutines
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>


Go-style channels for inter-coroutine communication. Create buffered or unbuffered channels, send and receive values, and coordinate between concurrent processes using select statements.

The `channel` global is always available.

## Creating Channels

Unbuffered channels (size 0) require both sender and receiver to be ready before transfer completes. Buffered channels allow sends to complete immediately while space is available:

```lua
-- Unbuffered: synchronizes sender and receiver
local sync_ch = channel.new()

-- Buffered: queue up to 10 messages
local work_queue = channel.new(10)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `size` | integer | Buffer capacity (default: 0 for unbuffered) |

**Returns:** `channel`

## Sending Values

Send a value to the channel. Blocks until a receiver is ready (unbuffered) or buffer space is available (buffered):

```lua
-- Send work to a worker pool
local jobs = channel.new(100)
for i, task in ipairs(tasks) do
    jobs:send(task)  -- Blocks if buffer full
end
jobs:close()  -- Signal no more work
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `value` | any | Value to send |

**Returns:** `boolean`

Raises error if channel is closed.

## Receiving Values

Receive a value from the channel. Blocks until a value is available or the channel is closed:

```lua
-- Worker consuming from job queue
while true do
    local job, ok = work:receive()
    if not ok then
        break  -- Channel closed, no more work
    end
    process(job)
end
```

**Returns:** `any, boolean`

- `value, true` - Received a value
- `nil, false` - Channel closed and empty

## Closing Channels

Close the channel. Pending senders get an error, pending receivers get `nil, false`. Raises error if already closed:

```lua
local results = channel.new(10)

-- Producer fills results
for _, item in ipairs(data) do
    results:send(process(item))
end
results:close()  -- Signal completion
```

## Selecting from Multiple Channels

Wait on multiple channel operations simultaneously. Essential for handling multiple event sources, implementing timeouts, and building responsive systems:

```lua
local result = channel.select(cases)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `cases` | table | Array of select cases |
| `default` | boolean | If true, returns immediately when no case ready |

**Returns:** `table` with fields: `channel`, `value`, `ok`, `default`

### Timeout Pattern

Wait for result with timeout using `time.after()`.

```lua
local time = require("time")

local result_ch = worker:response()
local timeout = time.after("5s")

local r = channel.select {
    result_ch:case_receive(),
    timeout:case_receive()
}

if r.channel == timeout then
    return nil, errors.new("TIMEOUT", "Operation timed out")
end
return r.value
```

### Fan-in Pattern

Merge multiple sources into one handler.

```lua
local events = process.events()
local inbox = process.inbox()
local shutdown = channel.new()

while true do
    local r = channel.select {
        events:case_receive(),
        inbox:case_receive(),
        shutdown:case_receive()
    }

    if r.channel == shutdown then
        break
    elseif r.channel == events then
        handle_event(r.value)
    else
        handle_message(r.value)
    end
end
```

### Non-blocking Check

Check if data is available without blocking.

```lua
local r = channel.select {
    ch:case_receive(),
    default = true
}

if r.default then
    -- Nothing available, do something else
else
    process(r.value)
end
```

## Creating Select Cases

Create cases for use with `channel.select`:

```lua
-- Send case - completes when channel can accept value
ch:case_send(value)

-- Receive case - completes when value available
ch:case_receive()
```

## Worker Pool Pattern

```lua
local work = channel.new(100)
local results = channel.new(100)

-- Spawn workers
for i = 1, num_workers do
    process.spawn("app.workers:processor", "app:processes", work, results)
end

-- Feed work
for _, item in ipairs(items) do
    work:send(item)
end
work:close()

-- Collect results
local processed = {}
while #processed < #items do
    local result, ok = results:receive()
    if not ok then break end
    table.insert(processed, result)
end
```

## Errors

| Condition | Kind | Retryable |
|-----------|------|-----------|
| Send on closed channel | runtime error | no |
| Close of closed channel | runtime error | no |
| Invalid case in select | runtime error | no |

## See Also

- [Process Management](lua/core/process.md) - Process spawning and communication
- [Message Queue](lua/storage/queue.md) - Queue-based messaging
- [Functions](lua/core/funcs.md) - Function invocation
