# Channels and Concurrency

Go-style channels for concurrent programming within processes.

## Creating Channels

Channels are communication pipes for coroutines. Create with `channel.new(capacity)`:

```lua
local ch = channel.new(1)  -- buffered channel, capacity 1
```

### Buffered Channels

Buffered channels allow sends without blocking until buffer is full:

```lua
local ch = channel.new(3)  -- buffer holds 3 items

-- Send without blocking
ch:send(1)
ch:send(2)
ch:send(3)

-- Receive in FIFO order
local v1, ok1 = ch:receive()  -- 1, true
local v2, ok2 = ch:receive()  -- 2, true
local v3, ok3 = ch:receive()  -- 3, true
```

### Unbuffered Channels

Unbuffered channels (capacity 0) synchronize sender and receiver:

```lua
local ch = channel.new(0)  -- unbuffered
local done = channel.new(1)

coroutine.spawn(function()
    ch:send("from spawn")  -- blocks until receiver ready
    done:send(true)
end)

local val = ch:receive()  -- receives "from spawn"
local completed = done:receive()
```

## Channel Select

`channel.select` waits on multiple channels, returns the first ready operation:

```lua
local ch1 = channel.new(1)
local ch2 = channel.new(1)

ch1:send("ch1_value")

local result = channel.select{
    ch1:case_receive(),
    ch2:case_receive()
}

-- result is a table with: channel, value, ok
result.channel == ch1  -- true
result.value           -- "ch1_value"
result.ok              -- true
```

### Select with Send

Use `case_send` to attempt non-blocking sends:

```lua
local ch = channel.new(1)

local result = channel.select{
    ch:case_send("sent")
}

result.ok  -- true (send succeeded)

local v = ch:receive()  -- "sent"
```

## Producer-Consumer Pattern

Single producer, single consumer:

```lua
local ch = channel.new(5)
local done = channel.new(1)
local consumed = 0

-- Consumer
coroutine.spawn(function()
    while true do
        local v, ok = ch:receive()
        if not ok then break end
        consumed = consumed + 1
    end
    done:send(consumed)
end)

-- Producer
for i = 1, 10 do
    ch:send(i)
end
ch:close()

local total = done:receive()  -- 10
```

### Ping-Pong Pattern

Synchronize two coroutines:

```lua
local ping = channel.new(0)
local pong = channel.new(0)
local rounds_done = channel.new(1)

coroutine.spawn(function()
    for i = 1, 5 do
        ping:receive()
        pong:send("pong")
    end
    rounds_done:send(true)
end)

for i = 1, 5 do
    ping:send("ping")
    pong:receive()
end

local completed = rounds_done:receive()
```

## Fan-Out Pattern

One producer, multiple consumers:

```lua
local work = channel.new(10)
local results = channel.new(10)

-- Spawn 3 workers
for w = 1, 3 do
    coroutine.spawn(function()
        while true do
            local job, ok = work:receive()
            if not ok then break end
            results:send(job * 2)
        end
    end)
end

-- Send work
for i = 1, 6 do
    work:send(i)
end
work:close()

-- Collect results
local sum = 0
for i = 1, 6 do
    local r = results:receive()
    sum = sum + r
end
-- sum = (1+2+3+4+5+6)*2 = 42
```

## Fan-In Pattern

Multiple producers, single consumer:

```lua
local output = channel.new(10)
local producer_count = 4
local items_per_producer = 5

-- Spawn producers
for p = 1, producer_count do
    coroutine.spawn(function()
        for i = 1, items_per_producer do
            output:send({producer = p, item = i})
        end
    end)
end

-- Collect all messages
local received = {}
for i = 1, producer_count * items_per_producer do
    local msg = output:receive()
    table.insert(received, msg)
end

-- Verify all producers sent their items
local counts = {}
for _, msg in ipairs(received) do
    counts[msg.producer] = (counts[msg.producer] or 0) + 1
end
```

## Closing Channels

Close channels to signal completion. Receivers get `ok = false` when channel is closed and empty:

```lua
local ch = channel.new(5)
local done = channel.new(1)

coroutine.spawn(function()
    local count = 0
    while true do
        local v, ok = ch:receive()
        if not ok then break end  -- channel closed
        count = count + 1
    end
    done:send(count)
end)

for i = 1, 10 do
    ch:send(i)
end
ch:close()  -- signal no more values

local total = done:receive()
```

## Channel Methods

Available operations:

- `channel.new(capacity)` - Create channel with buffer size
- `ch:send(value)` - Send value (blocks if buffer full)
- `ch:receive()` - Receive value, returns `value, ok`
- `ch:close()` - Close channel
- `ch:case_send(value)` - Create send case for select
- `ch:case_receive()` - Create receive case for select
- `channel.select{cases...}` - Wait on multiple operations

## Next Steps

- [Channel Module Reference](lua-channel.md) - Complete API documentation
- [Processes](processes.md) - Inter-process communication
