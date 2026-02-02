# Echo Service

Build a distributed echo service demonstrating processes, channels, coroutines, message passing, and supervision.

## Overview

This tutorial creates a CLI client that sends messages to a relay service, which spawns workers to process each message. It demonstrates:

- **Process spawning** - Creating child processes dynamically
- **Message passing** - Communication between processes via send/receive
- **Channels and select** - Multiplexing multiple event sources
- **Coroutines** - Concurrent execution within a process
- **Process registration** - Finding processes by name
- **Monitoring** - Tracking child process lifecycle

## Architecture

```mermaid
flowchart TB
    subgraph terminal["terminal.host"]
        CLI["CLI Process"]
    end

    subgraph processes["process.host"]
        Relay["Relay Process<br/>(+ stats coroutine)"]
        W1["Worker 1"]
        W2["Worker 2"]
        W3["Worker N"]
    end

    CLI -->|"send('relay', 'echo', msg)"| Relay
    Relay -->|"spawn_monitored(worker)"| W1
    Relay -->|"spawn_monitored(...)"| W2
    Relay -->|"spawn_monitored(...)"| W3
    W1 -->|"send(sender, 'echo_response')"| CLI
    W2 -->|"send(...)"| CLI
    W3 -->|"send(...)"| CLI
```

## Project Structure

```
echo-service/
├── wippy.lock
└── src/
    ├── _index.yaml
    ├── cli.lua
    ├── relay.lua
    └── worker.lua
```

## Entry Definitions

Create `src/_index.yaml`:

```yaml
version: "1.0"
namespace: app

entries:
  - name: terminal
    kind: terminal.host
    lifecycle:
      auto_start: true

  - name: processes
    kind: process.host
    lifecycle:
      auto_start: true

  - name: cli
    kind: process.lua
    source: file://cli.lua
    method: main
    modules:
      - io
      - process
      - time
      - channel

  - name: relay
    kind: process.lua
    source: file://relay.lua
    method: main
    modules:
      - process
      - logger
      - channel
      - time

  - name: relay-service
    kind: process.service
    process: app:relay
    host: app:processes
    lifecycle:
      auto_start: true

  - name: worker
    kind: process.lua
    source: file://worker.lua
    method: main
    modules:
      - process
      - time
```

## The Relay Process

The relay registers itself, handles messages, spawns workers, and runs a stats coroutine.

Create `src/relay.lua`:

```lua
local logger = require("logger")
local time = require("time")

local stats = {
    messages = 0,
    workers_spawned = 0
}

local function stats_reporter()
    while true do
        time.sleep("5s")
        logger:info("stats", {
            messages = stats.messages,
            workers_spawned = stats.workers_spawned
        })
    end
end

local function main()
    local inbox = process.inbox()
    local events = process.events()

    process.registry.register("relay")
    logger:info("relay started", {pid = process.pid()})

    coroutine.spawn(stats_reporter)

    while true do
        local r = channel.select {
            inbox:case_receive(),
            events:case_receive()
        }

        if r.channel == events then
            local event = r.value
            if event.kind == process.event.EXIT then
                logger:info("worker exited", {
                    from = event.from,
                    result = event.result
                })
            end
        else
            local msg = r.value
            if msg:topic() == "echo" then
                local echo = msg:payload():data()
                stats.messages = stats.messages + 1

                local worker_pid, err = process.spawn_monitored(
                    "app:worker",
                    "app:processes",
                    echo.sender,
                    echo.data
                )

                if err then
                    logger:error("spawn failed", {error = err})
                else
                    stats.workers_spawned = stats.workers_spawned + 1
                end
            end
        end
    end
end

return { main = main }
```

### Key Patterns {id="relay-key-patterns"}

**Coroutine Spawning**

```lua
coroutine.spawn(stats_reporter)
```

Creates a concurrent coroutine sharing memory with the main function. Coroutines yield at I/O operations like `time.sleep`.

**Channel Select**

```lua
local r = channel.select {
    inbox:case_receive(),
    events:case_receive()
}
```

Waits on multiple channels. `r.channel` identifies which fired, `r.value` contains the data.

**Payload Extraction**

```lua
local echo = msg:payload():data()
```

Messages have `msg:topic()` for the topic string and `msg:payload():data()` for the payload.

**Spawn with Monitoring**

```lua
local worker_pid, err = process.spawn_monitored("app:worker", "app:processes", ...)
```

Combines spawn and monitor. When the worker exits, we receive an EXIT event.

## The Worker Process

Workers receive arguments directly and send responses to the sender.

Create `src/worker.lua`:

```lua
local time = require("time")

local function main(sender_pid, data)
    time.sleep("100ms")

    local response = {
        data = string.upper(data),
        worker = process.pid()
    }

    process.send(sender_pid, "echo_response", response)

    return 0
end

return { main = main }
```

## The CLI Process

The CLI sends messages by registered name and waits for responses with timeout.

Create `src/cli.lua`:

```lua
local io = require("io")
local time = require("time")

local reset = "\027[0m"
local function dim(s) return "\027[2m" .. s .. reset end
local function green(s) return "\027[32m" .. s .. reset end
local function yellow(s) return "\027[33m" .. s .. reset end
local function cyan(s) return "\027[36m" .. s .. reset end

local function main()
    local inbox = process.inbox()

    -- Wait for relay to register
    time.sleep("200ms")

    io.print(cyan("Echo Client"))
    io.print(dim("Type messages to echo. Ctrl+C to exit.\n"))

    while true do
        io.write(yellow("> "))
        local input = io.readline()

        if not input or #input == 0 then
            break
        end

        local msg = {
            sender = process.pid(),
            data = input
        }
        local ok, err = process.send("relay", "echo", msg)
        if err then
            io.print(dim("  error: relay not available"))
        else
            local timeout = time.after("2s")
            local r = channel.select {
                inbox:case_receive(),
                timeout:case_receive()
            }

            if r.channel == timeout then
                io.print(dim("  timeout"))
            else
                local msg = r.value
                if msg:topic() == "echo_response" then
                    local resp = msg:payload():data()
                    io.print(green("  " .. resp.data))
                    io.print(dim("  from worker: " .. resp.worker))
                end
            end
        end
    end

    io.print("\nGoodbye!")
    return 0
end

return { main = main }
```

### Key Patterns {id="cli-key-patterns"}

**Send by Name**

```lua
process.send("relay", "echo", msg)
```

`process.send` accepts registered names directly. Returns error if not found.

**Timeout Pattern**

```lua
local timeout = time.after("2s")
local r = channel.select {
    inbox:case_receive(),
    timeout:case_receive()
}
if r.channel == timeout then
    -- timed out
end
```

## Running

```bash
wippy init
wippy run -x app:terminal/app:cli
```

Example output:

```
Echo Client
Type messages to echo. Ctrl+C to exit.

> hello world
  HELLO WORLD
  from worker: {app:processes|0x00004}
```

## Concepts Summary

| Concept | API |
|---------|-----|
| Process spawning | `process.spawn_monitored(entry, host, ...)` |
| Message passing | `process.send(dest, topic, data)` |
| Inbox | `process.inbox()` |
| Events | `process.events()` |
| Registration | `process.registry.register(name)` |
| Channel select | `channel.select {...}` |
| Timeout | `time.after(duration)` |
| Coroutines | `coroutine.spawn(fn)` |

## Next Steps

- [Process Management](lua/core/process.md)
- [Channels](lua/core/channel.md)
- [Time and Duration](lua/core/time.md)
