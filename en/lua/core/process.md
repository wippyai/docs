---
title: "Process Management"
description: "<secondary-label ref='function'/ <secondary-label ref='process'/ <secondary-label ref='workflow'/ <secondary-label ref='permissions'/"
---

# Process Management
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>
<secondary-label ref="permissions"/>

Spawn, monitor, and communicate with child processes. Implements actor-model patterns with message passing, supervision, and lifecycle management.

The `process` global is always available — it does not require `require()` and does not need to be listed in `modules:`.

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

-- Request graceful cancellation with an optional reason
local ok, err = process.cancel(destination, "shutting down")
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `destination` | string | PID or registered name |
| `reason` | string | Optional reason delivered to the target |

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
| `result` | table | For EXIT/LINK_DOWN: a {value, error} record; the process return value is at `result.value` and any error at `result.error` |
| `reason` | string | For CANCEL: why the process is being cancelled |

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

msg:topic()            -- string: topic name
msg:from()             -- string|nil: sender PID
msg:payload()          -- Payload: wrapper (call :data() to extract)
msg:payload():data()   -- any: actual payload value
```

## Synchronous Call

Spawn a process, wait for its result, and return:

```lua
local result, err = process.exec(id, host, ...)
```

**Permissions:** `process.exec` on process id, `process.host` on host id

## Process Upgrade

Upgrade the current process to a new definition while preserving PID:

```lua
-- Upgrade to new version, passing state
process.upgrade(id, ...)

-- Keep same definition, re-run with new state
process.upgrade(nil, preserved_state)
```

## Context Spawner

Create a spawner with custom context for child processes:

```lua
local spawner = process.with_context({request_id = "123"})
```

**Permission:** `process.context` on "context"

### Spawner with Options

`process.with_options(options)` creates a spawner that carries spawn-time options (e.g., a network selector) instead of context values:

```lua
local spawner = process.with_options({network = "app:tor_proxy"})
```

| Option | Type | Description |
|--------|------|-------------|
| `network` | string | Registry ID of a `network.*` entry to use for the child's outbound connections |

**Permission:** `process.context` on "context"; selecting a network additionally requires `network.select` on that network ID.

### SpawnBuilder Methods

SpawnBuilder is immutable - each method returns a new instance:

```lua
spawner:with_context(values)      -- Add context values
spawner:with_actor(actor)         -- Set security actor
spawner:with_scope(scope)         -- Set security scope
spawner:with_name(name)           -- Set process name
spawner:with_message(topic, ...)  -- Queue message to send after spawn
spawner:with_options(options)     -- Merge spawn-time options (e.g. network)
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

Register a process under a name and reach it by that name instead of its PID. Any function that takes a `destination` (`send`, `terminate`, `cancel`, `monitor`, `link`, ...) accepts a registered name in place of a PID.

```lua
local ok, err = process.registry.register(name)               -- self, local scope
local pid, err = process.registry.lookup(name)
local ok, err = process.registry.unregister(name)
```

### Scope

The optional `scope` argument selects the consistency guarantee of the name. It defaults to `LOCAL`. The four scopes and their guarantees are described in the [Cluster Guide](guides/cluster.md#naming-and-name-scopes); in short:

| Constant | Visibility | Guarantee |
|----------|------------|-----------|
| `process.registry.LOCAL` | this node only | Instant, node-local |
| `process.registry.EVENTUAL` | cluster-wide | Eventually consistent (gossip) |
| `process.registry.CONSISTENT` | cluster-wide | Linearizable singleton (Raft) |
| `process.registry.STRONG` | cluster-wide | Consistent + every live node acknowledges |

On a standalone node only `LOCAL` is meaningful; the cluster scopes require [clustering](guides/cluster.md).

### register

```lua
local ok, err = process.registry.register(name, pid, scope)
```

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `name` | string | yes | | Name to register |
| `pid` | string | no | self | PID to register; defaults to the calling process |
| `scope` | number | no | `LOCAL` | One of the scope constants above |

Returns `true` on success, or `nil, error` on failure. Conflicts (name already registered to a different PID under a cluster scope) return `errors.ALREADY_EXISTS`. Registering the same name to the same PID is idempotent. A `STRONG` registration blocks until every live node acknowledges or the reservation deadline expires; on timeout it returns an error.

Registering on behalf of a different PID additionally requires the `process.registry.foreign` permission on the target PID.

### lookup

```lua
local pid, err = process.registry.lookup(name)
```

Returns the registered PID string, or `nil, error` with kind `errors.NOT_FOUND` when the name is not registered.

### unregister

```lua
local ok, err = process.registry.unregister(name, scope)
```

`scope` defaults to `LOCAL` and must match the scope the name was registered under. For `CONSISTENT` and `STRONG`, the owning process is the one allowed to unregister; unregistering a name owned by another PID returns `false`. Names also release automatically when the owning process exits (and, for cluster scopes, when its node leaves), so explicit unregister is for early release.

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
| `process.host` | `spawn*()`, `exec()` | host id |
| `process.send` | `send()` | target PID |
| `process.exec` | `exec()` | process id |
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
| `process.registry.foreign` | `registry.register()` | target PID |

Cluster name scopes are authorized by scope-suffixed variants of these actions (`process.registry.register.eventual`, `.consistent`, `.strong`, and the matching `unregister` actions), so a policy can grant local naming separately from cluster-wide naming.

### Multiple Permissions

Some operations require multiple permissions:

| Operation | Required Permissions |
|-----------|---------------------|
| `spawn()` | `process.spawn` + `process.host` |
| `spawn_monitored()` | `process.spawn` + `process.spawn.monitored` + `process.host` |
| `spawn_linked()` | `process.spawn` + `process.spawn.linked` + `process.host` |
| `spawn_linked_monitored()` | `process.spawn` + `process.spawn.monitored` + `process.spawn.linked` + `process.host` |
| `exec()` | `process.exec` + `process.host` |
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

See [Error Handling](lua/core/errors.md) for working with errors.

## See Also

- [Channels](lua/core/channel.md) - Inter-process communication
- [Message Queue](lua/storage/queue.md) - Queue-based messaging
- [Functions](lua/core/funcs.md) - Function invocation
- [Supervision](guides/supervision.md) - Process lifecycle management
- [Cluster](guides/cluster.md) - Name scopes and cluster-wide naming
