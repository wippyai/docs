# Functions

Functions are synchronous, stateless entry points. You call them, they execute, they return a result. When a function runs, it inherits the caller's context—if the caller cancels, the function cancels too. This makes functions ideal for HTTP handlers, API endpoints, and any operation that should complete within a request lifecycle.

## Calling Functions

Call functions synchronously with `funcs.call()`:

```lua
local funcs = require("funcs")
local result, err = funcs.call("app.api:get_user", user_id)
```

For non-blocking execution, use `funcs.async()`:

```lua
local future = funcs.async("app.process:analyze", data)

local ch = future:response()
local result, ok = ch:receive()
```

See the [funcs module](lua/core/funcs.md) for the complete API.

## Context Propagation

Each call creates a frame with its own context scope. Child functions inherit parent context without explicit passing:

```lua
local ctx = require("ctx")

local trace_id = ctx.get("trace_id")
local user_id = ctx.get("user_id")
```

Add context when calling:

```lua
local exec = funcs.new()
    :with_context({trace_id = "abc-123"})
    :call("app.api:process", data)
```

Security context propagates the same way. Called functions see the caller's actor and can check permissions. See the [security module](lua/security/security.md) for access control APIs.

## Registry Definition

At the registry level, a function entry looks like this:

```yaml
- name: get_user
  kind: function.lua
  source: file://handlers/user.lua
  method: get
  pool:
    type: lazy
    max_size: 16
```

Functions can be invoked by other runtime components—HTTP handlers, queue consumers, scheduled jobs—and are subject to permission checks based on the caller's security context.

## Pools

Functions run on pools that manage execution. The pool type determines scaling behavior.

**Inline** runs in the caller's goroutine. No concurrency, zero allocation overhead. Used for embedded contexts.

**Static** maintains a fixed number of workers. Requests queue when all workers are busy. Predictable resource usage.

```yaml
pool:
  type: static
  workers: 8
  buffer: 512
```

**Lazy** starts empty and creates workers on demand. Idle workers get destroyed after a timeout. Efficient for variable traffic.

```yaml
pool:
  type: lazy
  max_size: 32
```

**Adaptive** scales automatically based on throughput. The controller measures performance and adjusts worker count to optimize for the current load.

```yaml
pool:
  type: adaptive
  max_size: 256
```

<tip>
If you don't specify a pool type, the runtime selects one based on your configuration. Set `workers` for static, `max_size` for lazy, or explicitly set `type` for full control.
</tip>

## Interceptors

Function calls pass through an interceptor chain. Interceptors handle cross-cutting concerns without touching business logic.

```yaml
- name: my_function
  kind: function.lua
  source: file://handler.lua
  method: main
  meta:
    options:
      retry:
        max_attempts: 3
        initial_delay: 100
        backoff_factor: 2.0
```

Built-in interceptors include retry with exponential backoff. You can add custom interceptors for logging, metrics, tracing, authorization, circuit breaking, or request transformation.

The chain runs before and after each call. Each interceptor can modify the request, short-circuit execution, or wrap the response.

## Contracts

Functions can expose their input/output schemas as contracts. Contracts define method signatures that enable runtime validation and documentation generation.

```lua
local contract = require("contract")
local email = contract.get("app.email:sender")
email:send({to = "user@example.com", subject = "Hello"})
```

This abstraction lets you swap implementations without changing calling code—useful for testing, multi-tenant deployments, or gradual migrations.

## Functions vs Processes

Functions inherit caller context and tie to caller lifecycle. When the caller cancels, functions cancel. This enables edge execution—running directly in HTTP handlers and queue consumers.

Processes run independently with host context. They outlive their creator and communicate through messages. Use processes for background work; use functions for request-scoped operations.
