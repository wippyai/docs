# Actor

The `wippy/actor` module provides a message-passing concurrency library that turns a Lua process into a topic-routed actor. Handlers are looked up by message topic, and the library multiplexes the process inbox, system events, internal async results, and any extra channels through a single `channel.select` loop.

## Setup

```bash
wippy add wippy/actor
wippy install
```

Declare the library as a dependency and import it where needed:

```yaml
- name: dep.actor
  kind: ns.dependency
  component: wippy/actor
  version: "*"

- name: counter_process
  kind: process.lua
  source: file://counter.lua
  method: main
  modules:
    - time
  imports:
    actor: wippy.actor:actor
```

## Basic Usage

```lua
local actor = require("actor")

local initial_state = { counter = 0 }

local handlers = {
    increment = function(state, payload, topic, from)
        state.counter = state.counter + (payload.amount or 1)
    end,

    get_count = function(state, payload, topic, from)
        process.send(from, "count_result", { count = state.counter })
    end,

    stop = function(state)
        return actor.exit({ final_count = state.counter })
    end,
}

local function main()
    return actor.new(initial_state, handlers):run()
end

return { main = main }
```

`actor.new(state, handlers)` returns an actor instance. `run()` drives the select loop until a handler returns `actor.exit(...)` or the process is cancelled.

## Handlers

Every key in the `handlers` table whose name does not start with `__` is a topic handler. Handlers receive `(state, payload, topic, from)`.

### Special Handlers

| Name | When it runs |
|------|--------------|
| `__init` | Once, before the select loop starts |
| `__default` | Topic without a matching handler |
| `__on_event` | Any process event (including cancel) |
| `__on_cancel` | Process cancel event (called after `__on_event`) |
| `__on_internal_message` | Result delivered by `state.async` |

## Control Flow

### Exit

```lua
return actor.exit({ reason = "done", data = state.data })
```

Stops the loop and resolves `run()` with the value.

### Chain

```lua
return actor.next("process", payload)
```

Re-dispatches the current message under a new topic. If `payload` is `nil`, the previous payload carries over. Useful for validation → processing pipelines without nested `if`.

## State Methods

`actor.new` attaches helpers to the state table. They are available inside any handler.

| Method | Description |
|--------|-------------|
| `state.add_handler(topic, fn)` | Register a handler at runtime |
| `state.remove_handler(topic)` | Remove a previously added handler |
| `state.register_channel(ch, fn)` | Multiplex an extra channel into the loop; `fn(state, value, ok, channel_id)` runs on each receive |
| `state.unregister_channel(ch)` | Stop listening on the channel |
| `state.async(fn)` | Run `fn` on a new coroutine; if it returns `actor.next(...)`, the result is delivered back to the actor |
| `state.wait(topic, timeout_ms)` | Blocking wait for a topic listener with timeout; returns `(value, err)` |
| `state.next(topic, payload)` | Alias for `actor.next` |

## Events and Cancellation

The loop automatically receives process events. Override `__on_event` (or the more specific `__on_cancel`) to react:

```lua
__on_cancel = function(state, event, kind, from)
    return actor.exit({ reason = "cancelled", items = state.items })
end,
```

Without a custom handler, a cancel event still terminates the actor — via the default event wiring — but no custom cleanup runs.

## Complete Example

```lua
local actor = require("actor")

local handlers = {
    __init = function(state)
        state.items = {}
        state.async(function() return actor.next("ready", {}) end)
    end,

    ready = function(state)
        process.send(state.parent, "actor_ready", { pid = process.pid() })
    end,

    subscribe = function(state, _, _, from)
        state.subscriber = from
    end,

    add_item = function(state, payload)
        table.insert(state.items, payload.item)
        return actor.next("notify_change", {})
    end,

    notify_change = function(state)
        if state.subscriber then
            process.send(state.subscriber, "items_changed", { count = #state.items })
        end
    end,

    get_items = function(state, _, _, from)
        process.send(from, "items_list", { items = state.items })
    end,

    __on_cancel = function(state)
        return actor.exit({ items = state.items })
    end,
}

local function main()
    return actor.new({ parent = process.parent() }, handlers):run()
end

return { main = main }
```

## See Also

- [Process](../lua/core/process.md) - Inbox, events, send/spawn primitives
- [Channels](../lua/core/channel.md) - Channel and select primitives used internally
- [Framework Overview](overview.md) - Framework module usage
