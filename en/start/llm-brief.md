---
title: "LLM Brief"
description: "Core Wippy concepts, project structure, APIs, and conventions for agents that generate Wippy code."
---

# LLM Brief

Use this brief as the starting context when generating code for a Wippy project.

## What Wippy Is

Wippy is a single-binary application runtime built on the actor model. It runs Lua code in isolated processes that communicate through messages rather than shared memory. Its three compute models are functions (stateless and request-scoped), processes (long-lived actors with state), and workflows (durable actors backed by Temporal). Registry-backed behavior can be added or updated without redeploying the runtime.

## Mental Model

Everything in Wippy is a **registry entry**. An entry has an ID (`namespace:name`), a kind that determines its behavior, metadata, and data. YAML files are one way to declare entries, but the registry is the runtime source of truth. Entries can also be created, updated, or deleted while the system is running.

Kinds determine what an entry does:

- `function.lua` — stateless callable function
- `process.lua` — long-running actor
- `workflow.lua` — durable workflow (Temporal)
- `http.service` — HTTP server
- `http.router` — route group with middleware
- `http.endpoint` — HTTP handler
- `db.sql.postgres` / `mysql` / `sqlite` — database connection
- `store.memory` / `store.sql` — key-value store
- `queue.queue` — message queue
- `process.host` — process execution host
- `process.service` — supervised process
- `contract.definition` / `contract.binding` — typed service interfaces
- `registry.entry` — configuration data

## Project Structure

```
myapp/
├── .wippy.yaml              # Runtime configuration
├── wippy.lock               # Source directories
└── src/
    ├── _index.yaml          # Entry definitions (namespace: app)
    ├── api/
    │   ├── _index.yaml      # namespace: app.api
    │   └── handler.lua
    └── workers/
        ├── _index.yaml      # namespace: app.workers
        └── task.lua
```

Entry definitions live in `_index.yaml` files:

```yaml
version: "1.0"
namespace: app.api

entries:
  - name: get_user
    kind: function.lua
    source: file://handler.lua
    method: get_user
    modules: [sql, json]

  - name: get_user.endpoint
    kind: http.endpoint
    meta:
      router: app:api_router
    method: GET
    path: /users/{id}
    func: app.api:get_user
```

## Writing Functions

Functions are stateless: they receive arguments, perform work, and return results. They inherit the caller's context and are canceled when the caller is canceled.

```lua
local sql = require("sql")
local json = require("json")
local http = require("http")

local function get_user(id)
    local db, err = sql.get("app:main_db")
    if err then return nil, err end

    local rows, err = db:query("SELECT * FROM users WHERE id = $1", id)
    if err then return nil, err end
    if #rows == 0 then return nil, errors.new({kind = errors.NOT_FOUND, message = "user not found"}) end

    return rows[1]
end

return get_user
```

For HTTP handlers, use the `http` module:

```lua
local http = require("http")
local json = require("json")

local function handler()
    local req = http.request()
    local res = http.response()

    local id = req:param("id")
    local user, err = funcs.call("app.api:get_user", id)
    if err then
        res:set_status(404)
        res:write_json({error = err:message()})
        return
    end

    res:write_json(user)
end

return handler
```

## Writing Processes

Processes are actors. Each process has a PID, receives messages through an inbox, and can maintain state across messages. Processes yield while waiting for I/O so other processes can run.

```lua
local function worker(initial_config)
    local inbox = process.inbox()
    local events = process.events()

    while true do
        local r = channel.select {
            inbox:case_receive(),
            events:case_receive()
        }

        if r.channel == events then
            local ev = r.value
            if ev.type == process.event.CANCEL then
                break
            end
        elseif r.channel == inbox then
            local msg = r.value
            local topic = msg:topic()
            local data = msg:payload():data()
            handle_message(topic, data)
        end
    end
end

return worker
```

Spawn processes from other code:

```lua
local pid = process.spawn("app.workers:task", "app:process_host", config)
process.send(pid, "work", {item_id = 123})
```

## Writing Workflows

Workflows persist execution history so they can resume after crashes or restarts. Workflow code uses normal Lua syntax, while the runtime records function results, sleeps, and random values for deterministic replay.

```lua
local function order_flow(order)
    local inventory = funcs.call("app:reserve_inventory", order.items)
    if not inventory then
        return nil, errors.new("out of stock")
    end

    local payment = funcs.call("app:charge_payment", order.total)
    if not payment then
        funcs.call("app:release_inventory", inventory.id)
        return nil, errors.new("payment failed")
    end

    -- Wait for approval signal (can block for days)
    local msg = process.inbox():receive()
    if not msg:payload():data().approved then
        funcs.call("app:refund_payment", payment.id)
        funcs.call("app:release_inventory", inventory.id)
        return nil, errors.new("rejected")
    end

    return funcs.call("app:fulfill_order", order.id)
end

return order_flow
```

## Key APIs

### Calling Functions

```lua
local funcs = require("funcs")

-- Synchronous
local result, err = funcs.call("namespace:function_name", arg1, arg2)

-- Asynchronous (returns Future)
local future = funcs.async("namespace:function_name", arg1)
local result, err = future:result()

-- With context
local exec = funcs.new():with_context({user_id = "123"})
exec:call("namespace:function_name")
```

### Process Communication

```lua
-- Send message (fire-and-forget)
process.send(pid, "topic", data)

-- Receive messages
local inbox = process.inbox()
local msg, ok = inbox:receive()
local topic = msg:topic()
local data = msg:payload():data()

-- Monitor another process (receive EXIT on death)
process.monitor(pid)

-- Link processes (bidirectional failure notification)
process.spawn_linked("namespace:name", "host")
```

### Channels

Go-style channels for coroutine communication:

```lua
local ch = channel.new(10)  -- buffered
ch:send(value)
local val, ok = ch:receive()

-- Select on multiple channels
local r = channel.select {
    ch1:case_receive(),
    ch2:case_receive(),
    timeout:case_receive()
}
```

### Error Handling

Functions return `result, error` pairs. Errors are typed objects:

```lua
local result, err = some_operation()
if err then
    if errors.is(err, errors.NOT_FOUND) then
        -- handle not found
    end
    return nil, errors.wrap(err, "context message")
end
```

Error kinds: `UNKNOWN`, `INVALID`, `NOT_FOUND`, `ALREADY_EXISTS`, `PERMISSION_DENIED`, `TIMEOUT`, `CANCELED`, `UNAVAILABLE`, `INTERNAL`, `CONFLICT`, `RATE_LIMITED`.

### Data Access

```lua
-- SQL
local sql = require("sql")
local db = sql.get("app:main_db")
local rows, err = db:query("SELECT * FROM users WHERE active = $1", true)
db:execute("INSERT INTO users (name) VALUES ($1)", name)

-- Key-value store
local store = require("store")
local cache = store.get("app:cache")
cache:set("key", value, 3600)  -- TTL in seconds
local val = cache:get("key")

-- Queue
local queue = require("queue")
queue.publish("app:tasks", {task = "process", id = 123})

-- Filesystem
local fs = require("fs")
local vol = fs.get("app:storage")
local data = vol:readfile("path/to/file.txt")
vol:writefile("output.txt", content)
```

### HTTP Client

```lua
local http_client = require("http_client")

local resp, err = http_client.get("https://api.example.com/data", {
    headers = {Authorization = "Bearer token"},
    timeout = "10s"
})
local body = resp.body
```

### Security

```lua
local security = require("security")

local actor = security.actor()       -- who is calling
local scope = security.scope()       -- what permissions apply
local allowed = security.can("read", "resource:users")

-- Token management
local ts = security.token_store("app:tokens")
local token = ts:create(actor, scope, {expiration = "24h"})
local validated_actor, validated_scope = ts:validate(token)
```

### Time

```lua
local time = require("time")

time.sleep("5s")
local now = time.now()
local timeout = time.after("30s")  -- channel that fires once
local ticker = time.ticker("10s")  -- repeating channel
```

### Registry

```lua
local registry = require("registry")

local entry = registry.get("app.api:get_user")
local tests = registry.find({["meta.type"] = "test"})

-- Create entries at runtime
local snap = registry.snapshot()
local changes = snap:changes()
changes:create({id = "app:new_func", kind = "function.lua", data = {...}})
changes:apply()
```

### Events

```lua
local events = require("events")

-- Publish
events.send("orders", "order.created", "/orders/123", {order_id = "123"})

-- Subscribe (wildcards supported)
local sub = events.subscribe("orders.*")
local ch = sub:channel()
local evt = ch:receive()
```

## Module Access Control

Each entry declares which modules it can `require()`. Modules not listed are unavailable to that entry. This includes `os.execute`, `io.open`, `debug.*`, and `package.*` unless they are explicitly granted. The runtime controls access at the module level rather than by scanning source code.

```yaml
modules: [sql, json, http, time, funcs, store]
```

This is also how workflow determinism works — workflow entries only receive deterministic modules. The runtime intercepts `time.now()`, `uuid.v4()`, and other non-deterministic calls at the module level, recording results for replay.

## Framework Modules

Framework capabilities are distributed as dependencies:

- **wippy/llm** — LLM integration (OpenAI, Anthropic, Google). `llm.generate()`, structured output, embeddings, streaming.
- **wippy/agent** — Agent framework with tool use, delegation, traits, memory. Agents defined as registry entries.
- **wippy/test** — BDD testing. `describe/it` blocks, assertions, mocking.
- **wippy/dataflow** — DAG-based workflow orchestration. Function, agent, cycle, parallel nodes.
- **wippy/relay** — WebSocket relay with central hub, per-user hubs, plugin routing.
- **wippy/views** — Page and component system with template rendering.
- **wippy/facade** — Frontend iframe facade with authentication bridging.

## Conventions

- Entry IDs use `namespace:name` format
- Names use dots for semantic separation, underscores for words: `get_user.endpoint`
- Functions return `result, error` — always check the error
- Processes communicate via message passing, never shared state
- Use `channel.select` to multiplex multiple event sources
- Supervision trees handle failures — design for "let it crash"
- Context (trace IDs, user info, security) propagates automatically through function calls
- Workflows must not use non-deterministic operations directly — the runtime handles this for `funcs.call`, `time.sleep`, `uuid.v4`, `time.now`

## Documentation

Full documentation is available at [wippy.ai/docs](https://wippy.ai/docs). LLM-friendly endpoints:

- Browse structure: `https://wippy.ai/llm/toc`
- Search: `https://wippy.ai/llm/search?q=query`
- Fetch page: `https://wippy.ai/llm/path/en/<path>`
- Batch fetch: `https://wippy.ai/llm/context?paths=path1,path2`
