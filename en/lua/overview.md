# Lua Runtime

Wippy's primary compute runtime optimized for I/O-bound and business logic workloads. Code runs in isolated processes that communicate through message passing—no shared memory, no locks.

Wippy is designed as a polyglot runtime. While Lua is the primary language, future versions will support additional languages through WebAssembly and Temporal integration for compute-intensive or specialized workloads.

## Processes

Your Lua code runs inside **processes**—isolated execution contexts managed by the scheduler. Each process:

- Has its own memory space
- Yields on blocking operations (I/O, channels)
- Can be monitored and supervised
- Scales to thousands per machine

<note>
A typical Lua process has a baseline memory overhead of ~13 KB.
</note>

```lua
local pid = process.spawn("app.workers:handler", "app:processes")
process.send(pid, "task", {data = "work"})
```

See [Process Management](lua-process.md) for spawning, linking, and supervision.

## Channels

Go-style channels for communication:

```lua
local ch = channel.new()        -- unbuffered
local buffered = channel.new(10)

ch:send(value)                  -- blocks until received
local val, ok = ch:receive()    -- blocks until ready
```

See [Channels](lua-channel.md) for select and patterns.

## Coroutines

Within a process, spawn lightweight coroutines:

```lua
coroutine.spawn(function()
    local data = fetch_data()
    ch:send(data)
end)

do_other_work()  -- continues immediately
```

Spawned coroutines are scheduler-managed—no manual yield/resume.

## Select

Handle multiple event sources:

```lua
local r = channel.select {
    inbox:case_receive(),
    events:case_receive(),
    timeout:case_receive()
}

if r.channel == timeout then
    -- timed out
elseif r.channel == events then
    handle_event(r.value)
else
    handle_message(r.value)
end
```

## Globals

These are always available without require:

- `process` - process management and messaging
- `channel` - Go-style channels
- `os` - time and system functions
- `coroutine` - lightweight concurrency

## Modules

```lua
local json = require("json")
local sql = require("sql")
local http = require("http_client")
```

Available modules depend on entry configuration. See [Entry Definitions](lua-entries.md).

## External Libraries

Wippy uses Lua 5.3 syntax with a [gradual type system](lua-types.md) inspired by Luau. Types are first-class runtime values—callable for validation, passable as arguments, and introspectable—replacing the need for schema libraries like Zod or Pydantic.

External Lua libraries (LuaRocks, etc.) are not supported. The runtime provides its own module system with built-in extensions for I/O, networking, and system integration.

For custom extensions, see [Modules](internal-modules.md) in the internals documentation.

## Error Handling

Functions return `result, error` pairs:

```lua
local data, err = json.decode(input)
if err then
    return nil, errors.wrap(err, "decode failed")
end
```

See [Error Handling](lua-errors.md) for patterns.

## What's Next

- [Entry Definitions](lua-entries.md) - Configure entry points
- [Channels](lua-channel.md) - Channel patterns
- [Process Management](lua-process.md) - Spawning and supervision
- [Functions](lua-funcs.md) - Cross-process calls
