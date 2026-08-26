---
title: "Function Invocation"
description: "Call registered functions synchronously or asynchronously and propagate request, security, and call options."
---

# Function Invocation
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

The `funcs` module calls registered functions synchronously or asynchronously. An executor can propagate request context, security identity, and implementation-specific call options.

## Loading

```lua
local funcs = require("funcs")
```

## `call`

Calls a registered function synchronously and waits for its result.

```lua
local result, err = funcs.call("app.api:get_user", user_id)
if err then
    return nil, err
end
print(result.name)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `target` | string | Function ID in format "namespace:name" |
| `...args` | any | Arguments passed to the function |

**Returns:** `result, error`

The target uses the `namespace:name` format.

## `async`

Starts a function call and returns a `Future` immediately. Futures allow other work to continue while the call runs and support multiple concurrent calls.

```lua
-- Start heavy computation without blocking
local future, err = funcs.async("app.process:analyze_data", large_dataset)
if err then
    return nil, err
end

-- Do other work while computation runs...

-- Wait for result when ready
local ch = future:response()
local payload, ok = ch:receive()
if ok then
    local result = payload:data()
end
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `target` | string | Function ID in format "namespace:name" |
| `...args` | any | Arguments passed to the function |

**Returns:** `Future, error`

## `new`

Creates an `Executor` for calls that need custom context, security identity, or call options.

```lua
local exec = funcs.new()
```

**Returns:** `Executor`

## Executor

An executor stores call context and options. Its configuration methods return new executor instances, allowing a base configuration to be reused.

### `with_context`

Adds request-scoped values that will be available to the called function, such as trace IDs, session data, or feature flags.

```lua
-- Propagate request context to downstream services
local exec = funcs.new():with_context({
    request_id = ctx.get("request_id"),
    feature_flags = {dark_mode = true}
})

local user, err = exec:call("app.api:get_user", user_id)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `values` | table | Key-value pairs to add to context |

**Returns:** `Executor, error`

### `with_actor`

Sets the security actor used for authorization checks in the called function.

```lua
local security = require("security")
local actor = security.actor()  -- Get current user's actor

-- Call admin function with user's credentials
local exec = funcs.new():with_actor(actor)
local result, err = exec:call("app.admin:delete_record", record_id)
if err and err:kind() == errors.PERMISSION_DENIED then
    return nil, errors.new({
        message = "User cannot delete records",
        kind = errors.PERMISSION_DENIED
    })
end
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `actor` | Actor | Security actor (from security module) |

**Returns:** `Executor, error`

### `with_scope`

Sets the security scope for called functions. The scope defines the permissions available to the call.

```lua
local security = require("security")
local scope = security.new_scope()

local exec = funcs.new():with_scope(scope)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `scope` | Scope | Security scope (from security module) |

**Returns:** `Executor, error`

### `with_options`

Sets call options. Implementations may define their own options; the runtime also recognizes `network` for selecting an outbound network.

```lua
-- Set a 5 second timeout for external API call
local exec = funcs.new():with_options({timeout = 5000})
local result, err = exec:call("app.external:fetch_data", query)
if err then
    -- Handle timeout or other error
end
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `options` | table | Implementation-specific options |

The runtime-defined option is:

| Recognized option | Type | Description |
|-------------------|------|-------------|
| `network` | string | Registry ID of the outbound `network.*` entry |

**Returns:** `Executor, error`

Selecting a network requires `network.select` permission on that network ID.

### `call` and `async`

The executor versions of `call` and `async` use its configured context and options.

```lua
-- Build reusable executor with context
local exec = funcs.new()
    :with_context({trace_id = "abc-123"})
    :with_options({timeout = 10000})

-- Make multiple calls with same context
local users, _ = exec:call("app.api:list_users")
local posts, _ = exec:call("app.api:list_posts")
```

## Future Invocation Summary

`async()` returns a future representing an in-progress invocation. The methods below cover the caller-facing steps for receiving, inspecting, or canceling that invocation. See [Future](lua/core/future.md) for the Future object reference.

### `response` and `channel`

Returns the channel used to receive the result.

```lua
local future, _ = funcs.async("app.api:slow_operation", data)
local ch = future:response()  -- or future:channel()

local result = channel.select {
    ch:case_receive(),
    timeout:case_receive()
}
```

**Returns:** `Channel`

### `is_complete`

Checks whether the future has completed without blocking.

```lua
while not future:is_complete() do
    -- do other work
    time.sleep("100ms")
end
local result, err = future:result()
```

**Returns:** `boolean`

### `is_canceled`

Returns `true` if `cancel()` was called on the future.

```lua
if future:is_canceled() then
    print("Operation was canceled")
end
```

**Returns:** `boolean`

### `result`

Returns the cached result when complete or `nil` while the operation is pending.

```lua
local value, err = future:result()
if err then
    print("Failed:", err:message())
elseif value then
    print("Got:", value:data())
end
```

**Returns:** `Payload|nil, error|nil`

### `error`

Returns the operation error when the future has failed.

```lua
local err, has_error = future:error()
if has_error then
    print("Error kind:", err:kind())
end
```

**Returns:** `error|nil, boolean`

### `cancel`

Requests cancellation of the asynchronous operation.

```lua
future:cancel()
```

**Returns:** `boolean, error`

## Parallel Operations

Combine `async` with `channel.select` to run and collect multiple calls concurrently.

```lua
-- Start multiple operations in parallel
local f1, _ = funcs.async("app.api:get_user", user_id)
local f2, _ = funcs.async("app.api:get_orders", user_id)
local f3, _ = funcs.async("app.api:get_preferences", user_id)

-- Wait for all to complete using channels
local user_ch = f1:channel()
local orders_ch = f2:channel()
local prefs_ch = f3:channel()

local results = {}
for i = 1, 3 do
    local r = channel.select {
        user_ch:case_receive(),
        orders_ch:case_receive(),
        prefs_ch:case_receive()
    }
    if r.channel == user_ch then
        results.user = r.value:data()
    elseif r.channel == orders_ch then
        results.orders = r.value:data()
    else
        results.prefs = r.value:data()
    end
end
```

## Permissions

Function operations are subject to security policy evaluation.

| Action | Resource | Description |
|--------|----------|-------------|
| `funcs.call` | Function ID | Call a specific function |
| `funcs.context` | `context` | Use `with_context()` to set custom context |
| `funcs.security` | `security` | Use `with_actor()` or `with_scope()` |
| `network.select` | Network ID | Select an outbound network with `with_options()` |

## Errors

| Condition | Kind | Retryable |
|-----------|------|-----------|
| Target empty | `errors.INVALID` | no |
| Namespace missing | `errors.INVALID` | no |
| Name missing | `errors.INVALID` | no |
| Permission denied | `errors.PERMISSION_DENIED` | no |
| Subscribe failed | `errors.INTERNAL` | no |
| Function error | varies | varies |

See [Error Handling](lua/core/errors.md) for working with errors.
