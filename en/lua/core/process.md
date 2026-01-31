# Process Management
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>
<secondary-label ref="permissions"/>

Spawn, monitor, and communicate with child processes. Implements actor-model patterns with message passing, supervision, and lifecycle management.

## Loading

```lua
local process = require("process")
```

## Process Information

Get the current frame ID or process ID:

```lua
local frame_id = process.id()  -- Call chain identifier
local pid = process.pid()       -- Process ID
```

## Sending Messages

Send message(s) to a process by PID or registered name:

```lua
local ok, err = process.send(destination, topic, ...)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `destination` | string | PID or registered name |
| `topic` | string | Topic name (cannot start with `@`) |
| `...` | any | Payload values |

**Permission:** `process.send` on target PID

## Spawning Processes

```lua
-- Basic spawn
local pid, err = process.spawn(id, host, ...)

-- With monitoring (receive EXIT events)
local pid, err = process.spawn_monitored(id, host, ...)

-- With linking (receive LINK_DOWN on abnormal exit)
local pid, err = process.spawn_linked(id, host, ...)

-- Both linked and monitored
local pid, err = process.spawn_linked_monitored(id, host, ...)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Process source ID (e.g., `"app.workers:handler"`) |
| `host` | string | Host ID (e.g., `"app:processes"`) |
| `...` | any | Arguments passed to spawned process |

**Permissions:**
- `process.spawn` on process id
- `process.host` on host id
- `process.spawn.monitored` on process id (for monitored variants)
- `process.spawn.linked` on process id (for linked variants)

## Process Control

```lua
-- Forcefully terminate a process
local ok, err = process.terminate(destination)

-- Request graceful cancellation with optional deadline
local ok, err = process.cancel(destination, "5s")
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `destination` | string | PID or registered name |
| `deadline` | string\|integer | Duration string or milliseconds |

**Permissions:** `process.terminate`, `process.cancel` on target PID

## Monitoring and Linking

Monitor or link to an existing process:

```lua
-- Monitoring: receive EXIT events when target exits
local ok, err = process.monitor(destination)
local ok, err = process.unmonitor(destination)

-- Linking: bidirectional, receive LINK_DOWN on abnormal exit
local ok, err = process.link(destination)
local ok, err = process.unlink(destination)
```

**Permissions:** `process.monitor`, `process.unmonitor`, `process.link`, `process.unlink` on target PID

## Process Options

```lua
local options = process.get_options()
local ok, err = process.set_options({trap_links = true})
```

| Field | Type | Description |
|-------|------|-------------|
| `trap_links` | boolean | Whether LINK_DOWN events are delivered to events channel |

## Inbox and Events

Get channels for receiving messages and lifecycle events:

```lua
local inbox = process.inbox()    -- Message objects from @inbox topic
local events = process.events()  -- Lifecycle events from @events topic
```

### Event Types

| Constant | Description |
|----------|-------------|
| `process.event.CANCEL` | Cancellation requested |
| `process.event.EXIT` | Monitored process exited |
| `process.event.LINK_DOWN` | Linked process terminated abnormally |

### Event Fields

| Field | Type | Description |
|-------|------|-------------|
| `kind` | string | Event type constant |
| `from` | string | Source PID |
| `result` | table | For EXIT: `{value: any}` or `{error: string}` |
| `deadline` | string | For CANCEL: deadline timestamp |

## Topic Subscription

Subscribe to custom topics:

```lua
local ch = process.listen(topic, options)
process.unlisten(ch)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `topic` | string | Topic name (cannot start with `@`) |
| `options.message` | boolean | If true, receive Message objects; if false, raw payloads |

## Message Objects

When receiving from inbox or with `{message = true}`:

```lua
local msg = inbox:receive()

msg:topic()    -- string: topic name
msg:from()     -- string|nil: sender PID
msg:payload()  -- any: payload data
```

## Synchronous Call

Spawn a process, wait for its result, and return:

```lua
local result, err = process.call(id, host, ...)
```

**Permissions:** `process.call` on process id, `process.host` on host id

## Process Upgrade

Upgrade the current process to a new definition while preserving PID:

```lua
-- Upgrade to new version, passing state
process.upgrade(source, ...)

-- Keep same definition, re-run with new state
process.upgrade(nil, preserved_state)
```

## Context Spawner

Create a spawner with custom context for child processes:

```lua
local spawner = process.with_context({request_id = "123"})
```

**Permission:** `process.context` on "context"

### SpawnBuilder Methods

SpawnBuilder is immutable - each method returns a new instance:

```lua
spawner:with_context(values)      -- Add context values
spawner:with_actor(actor)         -- Set security actor
spawner:with_scope(scope)         -- Set security scope
spawner:with_name(name)           -- Set process name
spawner:with_message(topic, ...)  -- Queue message to send after spawn
```

**Permission:** `process.security` on "security" for `:with_actor()` and `:with_scope()`

### Spawner Spawn Methods

```lua
spawner:spawn(id, host, ...)
spawner:spawn_monitored(id, host, ...)
spawner:spawn_linked(id, host, ...)
spawner:spawn_linked_monitored(id, host, ...)
```

Same permissions as module-level spawn functions.

## Name Registry

Register and lookup processes by name:

```lua
local ok, err = process.registry.register(name, pid)  -- pid defaults to self
local pid, err = process.registry.lookup(name)
local ok = process.registry.unregister(name)
```

**Permissions:** `process.registry.register`, `process.registry.unregister` on name

## Permissions

Permissions control what a calling process can do. All checks use the caller's security context (actor) against the target resource.

### Policy Evaluation

Policies can allow/deny based on:
- **Actor**: The security principal making the request
- **Action**: The operation being performed (e.g., `process.send`)
- **Resource**: The target (PID, process id, host id, or name)
- **Attributes**: Additional context including `pid` (caller's process ID)

### Permission Reference

| Permission | Functions | Resource |
|------------|-----------|----------|
| `process.spawn` | `spawn*()` | process id |
| `process.spawn.monitored` | `spawn_monitored()`, `spawn_linked_monitored()` | process id |
| `process.spawn.linked` | `spawn_linked()`, `spawn_linked_monitored()` | process id |
| `process.host` | `spawn*()`, `call()` | host id |
| `process.send` | `send()` | target PID |
| `process.call` | `call()` | process id |
| `process.terminate` | `terminate()` | target PID |
| `process.cancel` | `cancel()` | target PID |
| `process.monitor` | `monitor()` | target PID |
| `process.unmonitor` | `unmonitor()` | target PID |
| `process.link` | `link()` | target PID |
| `process.unlink` | `unlink()` | target PID |
| `process.context` | `with_context()` | "context" |
| `process.security` | `:with_actor()`, `:with_scope()` | "security" |
| `process.registry.register` | `registry.register()` | name |
| `process.registry.unregister` | `registry.unregister()` | name |

### Multiple Permissions

Some operations require multiple permissions:

| Operation | Required Permissions |
|-----------|---------------------|
| `spawn()` | `process.spawn` + `process.host` |
| `spawn_monitored()` | `process.spawn` + `process.spawn.monitored` + `process.host` |
| `spawn_linked()` | `process.spawn` + `process.spawn.linked` + `process.host` |
| `spawn_linked_monitored()` | `process.spawn` + `process.spawn.monitored` + `process.spawn.linked` + `process.host` |
| `call()` | `process.call` + `process.host` |
| spawn with custom actor/scope | spawn permissions + `process.security` |

## Errors

| Condition | Kind |
|-----------|------|
| No context found | `errors.INVALID` |
| Frame context not found | `errors.INVALID` |
| Missing required arguments | `errors.INVALID` |
| Reserved topic prefix (`@`) | `errors.INVALID` |
| Invalid duration format | `errors.INVALID` |
| Name not registered | `errors.NOT_FOUND` |
| Permission denied | `errors.PERMISSION_DENIED` |
| Name already registered | `errors.ALREADY_EXISTS` |

See [Error Handling](lua-errors.md) for working with errors.
