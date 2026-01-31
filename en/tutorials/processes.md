# Processes and Messaging

Spawn isolated processes and communicate via message passing.

## Overview

Processes provide isolated execution units that communicate through message passing. Each process has its own inbox and can subscribe to specific message topics.

Key concepts:
- Spawn processes with `process.spawn()` and variants
- Send messages to PIDs or registered names via topics
- Receive messages using `process.listen()` or `process.inbox()`
- Monitor process lifecycle with events
- Link processes for coordinated failure handling

## Spawning Processes

Spawn a new process from an entry reference.

```lua
local pid, err = process.spawn("app.test.process:echo_worker", "app:processes", "hello")
if err then
    return false, "spawn failed: " .. err
end

-- pid is a string identifier for the spawned process
print("Started worker:", pid)
```

Parameters:
- Entry reference (e.g., `"app.test.process:echo_worker"`)
- Host reference (e.g., `"app:processes"`)
- Optional arguments passed to worker's main function

### Getting Your Own PID

```lua
local my_pid = process.pid()
-- Returns string PID of current process
```

## Message Passing

Messages use a topic-based routing system. Send messages to PIDs with a topic, then receive via topic subscription or inbox.

### Sending Messages

```lua
-- Send to process by PID
local sent, err = process.send(worker_pid, "messages", "hello from parent")
if err then
    return false, "send failed: " .. err
end

-- send returns (bool, error)
```

### Receiving via Topic Subscription

Subscribe to specific topics using `process.listen()`:

```lua
-- Worker that listens for messages on "messages" topic
local function main()
    local ch = process.listen("messages")

    local msg = ch:receive()
    if msg then
        -- msg is the payload directly
        print("Received:", msg)
        return true
    end

    return false
end

return { main = main }
```

### Receiving via Inbox

Inbox receives messages that don't match any topic listener:

```lua
local function main()
    local inbox_ch = process.inbox()
    local specific_ch = process.listen("specific_topic")

    while true do
        local result = channel.select({
            specific_ch:case_receive(),
            inbox_ch:case_receive()
        })

        if result.channel == specific_ch then
            -- Messages to "specific_topic" arrive here
            local payload = result.value
        elseif result.channel == inbox_ch then
            -- Messages to any OTHER topic arrive here
            local msg = result.value
            print("Inbox got:", msg.topic, msg.payload)
        end
    end
end
```

### Message Mode for Sender Info

Use `{ message = true }` to access sender PID and topic:

```lua
-- Worker that echoes messages back to sender
local function main()
    local ch = process.listen("echo", { message = true })

    local msg = ch:receive()
    if msg then
        local sender = msg:from()
        local payload = msg:payload()

        if sender then
            process.send(sender, "reply", payload)
        end
        return true
    end

    return false
end

return { main = main }
```

## Monitoring Processes

Monitor processes to receive EXIT events when they terminate.

### Spawn with Monitoring

```lua
local events_ch = process.events()

local worker_pid, err = process.spawn_monitored(
    "app.test.process:events_exit_worker",
    "app:processes"
)
if err then
    return false, "spawn failed: " .. err
end

-- Wait for EXIT event
local timeout = time.after("3s")
local result = channel.select {
    events_ch:case_receive(),
    timeout:case_receive(),
}

if result.channel == timeout then
    return false, "timeout waiting for EXIT event"
end

local event = result.value
if event.kind == process.event.EXIT then
    print("Worker exited:", event.from)
    if event.error then
        print("Exit error:", event.error)
    end
    -- Access return value via event.result
end
```

### Explicit Monitoring

Monitor an already running process:

```lua
local events_ch = process.events()

-- Spawn without monitoring
local worker_pid, err = process.spawn("app.test.process:long_worker", "app:processes")
if err then
    return false, "spawn failed: " .. err
end

-- Add monitoring explicitly
local ok, monitor_err = process.monitor(worker_pid)
if monitor_err then
    return false, "monitor failed: " .. monitor_err
end

-- Now will receive EXIT events for this worker
```

Stop monitoring:

```lua
local ok, err = process.unmonitor(worker_pid)
```

## Process Linking

Link processes for coordinated lifecycle management. Linked processes receive LINK_DOWN events when linked processes fail.

### Spawn Linked Process

```lua
-- Child terminates if parent crashes (unless trap_links is set)
local pid, err = process.spawn_linked("app.test.process:child_worker", "app:processes")
if err then
    return false, "spawn_linked failed: " .. err
end
```

### Explicit Linking

```lua
-- Link to existing process
local ok, err = process.link(target_pid)
if err then
    return false, "link failed: " .. err
end

-- Unlink
local ok, err = process.unlink(target_pid)
```

### Handling LINK_DOWN Events

By default, LINK_DOWN causes the process to fail. Enable `trap_links` to receive it as an event:

```lua
local function main()
    -- Enable trap_links to receive LINK_DOWN events instead of crashing
    local ok, err = process.set_options({ trap_links = true })
    if not ok then
        return false, "set_options failed: " .. err
    end

    -- Verify trap_links is enabled
    local opts = process.get_options()
    if not opts.trap_links then
        return false, "trap_links should be true"
    end

    local events_ch = process.events()

    -- Spawn a linked process that will fail
    local error_pid, err2 = process.spawn_linked(
        "app.test.process:error_exit_worker",
        "app:processes"
    )
    if err2 then
        return false, "spawn error worker failed: " .. err2
    end

    -- Wait for LINK_DOWN event
    local timeout = time.after("2s")
    local result = channel.select {
        events_ch:case_receive(),
        timeout:case_receive(),
    }

    if result.channel == timeout then
        return false, "timeout waiting for LINK_DOWN"
    end

    local event = result.value
    if event.kind == process.event.LINK_DOWN then
        print("Linked process died:", event.from)
        -- Handle gracefully instead of crashing
        return true
    end

    return false, "expected LINK_DOWN, got: " .. tostring(event.kind)
end

return { main = main }
```

## Process Registry

Register names for processes to enable name-based lookups and messaging.

### Registering Names

```lua
local function main()
    local test_name = "my_service_" .. tostring(os.time())

    -- Register current process with a name
    local ok, err = process.registry.register(test_name)
    if err then
        return false, "register failed: " .. err
    end

    -- Lookup the registered name
    local pid, lookup_err = process.registry.lookup(test_name)
    if lookup_err then
        return false, "lookup failed: " .. lookup_err
    end

    -- Verify it resolves to our PID
    if pid ~= process.pid() then
        return false, "lookup returned wrong pid"
    end

    return true
end

return { main = main }
```

### Unregistering Names

```lua
-- Unregister explicitly
local unregistered = process.registry.unregister(test_name)
if not unregistered then
    print("Name was not registered")
end

-- Lookup after unregister returns nil + error
local pid, err = process.registry.lookup(test_name)
-- pid will be nil, err will be non-nil
```

Names are automatically released when the process exits.

## Complete Example: Monitored Worker Pool

This example shows a parent process spawning multiple monitored workers and tracking their completion.

```lua
-- Parent process
local time = require("time")

local function main()
    local events_ch = process.events()

    -- Track spawned workers
    local workers = {}
    local worker_count = 5

    -- Spawn multiple monitored workers
    for i = 1, worker_count do
        local worker_pid, err = process.spawn_monitored(
            "app.test.process:task_worker",
            "app:processes",
            { task_id = i, value = i * 10 }
        )

        if err then
            return false, "spawn worker " .. i .. " failed: " .. err
        end

        workers[worker_pid] = { task_id = i, started = os.time() }
    end

    -- Wait for all workers to complete
    local completed = 0
    local timeout = time.after("10s")

    while completed < worker_count do
        local result = channel.select {
            events_ch:case_receive(),
            timeout:case_receive(),
        }

        if result.channel == timeout then
            return false, "timeout waiting for workers"
        end

        local event = result.value
        if event.kind == process.event.EXIT then
            local worker = workers[event.from]
            if worker then
                if event.error then
                    print("Worker " .. worker.task_id .. " failed:", event.error)
                else
                    print("Worker " .. worker.task_id .. " completed:", event.result)
                end
                completed = completed + 1
            end
        end
    end

    return true
end

return { main = main }
```

Worker process:

```lua
-- task_worker.lua
local time = require("time")

local function main(task)
    -- Simulate work
    time.sleep("100ms")

    -- Process task
    local result = task.value * 2

    return result
end

return { main = main }
```

## Summary

Process spawning:
- `process.spawn()` - Basic spawn, returns PID
- `process.spawn_monitored()` - Spawn with automatic monitoring
- `process.spawn_linked()` - Spawn with lifecycle coupling
- `process.pid()` - Get current process PID

Messaging:
- `process.send(pid, topic, payload)` - Send message to PID
- `process.listen(topic)` - Subscribe to topic, receive payloads
- `process.listen(topic, { message = true })` - Receive full message with `:from()`, `:payload()`, `:topic()`
- `process.inbox()` - Receive messages not matched by listeners

Monitoring:
- `process.events()` - Channel for EXIT and LINK_DOWN events
- `process.monitor(pid)` - Monitor existing process
- `process.unmonitor(pid)` - Stop monitoring

Linking:
- `process.link(pid)` - Link to process
- `process.unlink(pid)` - Unlink from process
- `process.set_options({ trap_links = true })` - Receive LINK_DOWN as event instead of crashing
- `process.get_options()` - Get current process options

Registry:
- `process.registry.register(name)` - Register name for current process
- `process.registry.lookup(name)` - Find PID by name
- `process.registry.unregister(name)` - Remove name registration

## See Also

- [Process Module Reference](lua-process.md) - Full API documentation
- [Channels](channels.md) - Channel operations for message handling
