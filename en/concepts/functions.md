---
title: "Functions"
description: "How to define and call stateless functions, propagate context, configure pools, and apply interceptors."
---

# Functions

Functions are stateless entry points that execute a call and return a result. A function inherits its caller's context and is canceled when the caller is canceled. Use functions for HTTP handlers, API endpoints, and other operations that complete within a request lifecycle.

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

See the [funcs module](lua/core/funcs.md) for function invocation and executor options.

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

**Inline** runs in the caller's goroutine without a worker pool. It is used for embedded contexts.

**Static** maintains a fixed number of workers. Requests queue when all workers are busy, which keeps worker concurrency fixed.

```yaml
pool:
  type: static
  workers: 8
  buffer: 512
```

**Lazy** starts without workers and creates them on demand. Idle workers are removed after a timeout.

```yaml
pool:
  type: lazy
  max_size: 32
```

**Adaptive** adjusts the worker count based on measured throughput and current load.

```yaml
pool:
  type: adaptive
  max_size: 256
```

<tip>
If you don't specify a pool type, the runtime selects one based on your configuration. Set `workers` for a static pool, `max_size` for a lazy pool, or set `type` to select the pool explicitly.
</tip>

## Interceptors

Function calls pass through an interceptor chain. Interceptors can handle cross-cutting concerns separately from the function implementation.

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
local sender = contract.get("app.email:sender")
local email = sender:open("app.email:sender_impl")
email:send({to = "user@example.com", subject = "Hello"})
```

Contracts allow callers to use an interface while selecting an implementation separately. This supports testing, multi-tenant deployments, and gradual migrations.

## Functions vs Processes

Functions inherit the caller's context and lifecycle. When the caller is canceled, its function calls are canceled as well. This suits execution within HTTP handlers and queue consumers.

Processes run independently with host context. They outlive their creator and communicate through messages. Use processes for background work; use functions for request-scoped operations.
