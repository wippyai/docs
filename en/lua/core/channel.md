---
title: "Channels and Coroutines"
description: "Create buffered and unbuffered channels, exchange values, select across operations, and coordinate concurrent work."
---

# Channels and Coroutines
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

Channels exchange values between concurrent tasks. They can be buffered or unbuffered and can be combined with `channel.select` to coordinate multiple operations.

The `channel` global is always available.

## Creating Channels

An unbuffered channel (size 0) requires a sender and receiver to be ready before a transfer completes. A buffered channel allows sends to complete while buffer space is available.

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

Sending blocks until a receiver is ready on an unbuffered channel or until buffer space is available on a buffered channel.

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

Sending to a closed channel raises an error.

## Receiving Values

Receiving blocks until a value is available or the channel is closed.

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

- `value, true` — a value was received
- `nil, false` — the channel is closed and empty

## Closing Channels

Closing a channel causes pending senders to receive an error and pending receivers to receive `nil, false`. Closing an already closed channel is a no-op.

```lua
local results = channel.new(10)

-- Producer fills results
for _, item in ipairs(data) do
    results:send(process(item))
end
results:close()  -- Signal completion
```

## Selecting from Multiple Channels

`channel.select` waits on multiple channel operations at the same time. It can coordinate event sources, timeouts, and non-blocking checks.

```lua
local result = channel.select(cases)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `cases` | table | Array of select cases |
| `default` | boolean | If true, returns immediately when no case ready |

**Returns:** `table`

- For a channel case: `{channel, value, ok}` — `channel` is the case's channel, `value` is the received/sent value, `ok` is false for a closed-channel receive.
- For the default branch (when no case is ready and `default = true`): `{default = true, ok = true}`.

### Timeout Pattern

Use `time.after()` to add a timeout to a channel wait.

```lua
local time = require("time")

local result_ch = worker:response()
local timeout, err = time.after("5s")
if err then
    return nil, err
end

local r = channel.select {
    result_ch:case_receive(),
    timeout:case_receive()
}

if r.channel == timeout then
    return nil, errors.new({
        message = "Operation timed out",
        kind = errors.TIMEOUT
    })
end
return r.value
```

### Fan-in Pattern

Handle values from multiple sources in one loop.

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

### Non-Blocking Check

Use a default case to check for available data without blocking.

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

Create send and receive cases for `channel.select`:

```lua
-- Send case - completes when channel can accept value
ch:case_send(value)

-- Receive case - completes when value available
ch:case_receive()
```

Values in the cases table that are not send or receive cases are ignored. Make sure the table contains at least one valid case unless it also has a default branch.

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
| Send on closed channel | runtime error | n/a |

## See Also

- [Process Management](lua/core/process.md) - Process spawning and communication
- [Message Queue](lua/storage/queue.md) - Queue-based messaging
- [Functions](lua/core/funcs.md) - Function invocation
