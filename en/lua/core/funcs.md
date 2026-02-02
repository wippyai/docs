# Function Invocation
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

The primary way to call other functions in Wippy. Execute registered functions synchronously or asynchronously across processes, with full support for context propagation, security credentials, and timeouts. This module is central to building distributed applications where components need to communicate.

## Loading

```lua
local funcs = require("funcs")
```

## call

Calls a registered function synchronously. Use this when you need an immediate result and can wait for it.

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

The target string follows the pattern `namespace:name` where namespace identifies the module and name identifies the specific function.

## async

Starts an async function call and returns immediately with a Future. Use this for long-running operations where you don't want to block, or when you want to run multiple operations in parallel.

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

## new

Creates a new Executor for building function calls with custom context. Use this when you need to propagate request context, set security credentials, or configure timeouts.

```lua
local exec = funcs.new()
```

**Returns:** `Executor, error`

## Executor

Builder for function calls with custom context options. Methods return new Executor instances (immutable chaining), so you can reuse a base configuration.

### with_context

Adds context values that will be available to the called function. Use this to propagate request-scoped data like trace IDs, user sessions, or feature flags.

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

### with_actor

Sets the security actor for authorization checks in the called function. Use this when calling a function on behalf of a specific user.

```lua
local security = require("security")
local actor = security.actor()  -- Get current user's actor

-- Call admin function with user's credentials
local exec = funcs.new():with_actor(actor)
local result, err = exec:call("app.admin:delete_record", record_id)
if err and err:kind() == "PERMISSION_DENIED" then
    return nil, errors.new("PERMISSION_DENIED", "User cannot delete records")
end
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `actor` | Actor | Security actor (from security module) |

**Returns:** `Executor, error`

### with_scope

Sets the security scope for called functions. Scopes define the permissions available for the call.

```lua
local security = require("security")
local scope = security.new_scope()

local exec = funcs.new():with_scope(scope)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `scope` | Scope | Security scope (from security module) |

**Returns:** `Executor, error`

### with_options

Sets call options like timeout and priority. Use this for operations that need time limits.

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

**Returns:** `Executor, error`

### call / async

Executor versions of call and async that use the configured context.

```lua
-- Build reusable executor with context
local exec = funcs.new()
    :with_context({trace_id = "abc-123"})
    :with_options({timeout = 10000})

-- Make multiple calls with same context
local users, _ = exec:call("app.api:list_users")
local posts, _ = exec:call("app.api:list_posts")
```

## Future

Returned by `async()` calls. Represents an in-progress async operation.

### response / channel

Returns the underlying channel for receiving the result.

```lua
local future, _ = funcs.async("app.api:slow_operation", data)
local ch = future:response()  -- or future:channel()

local result = channel.select {
    ch:case_receive(),
    timeout:case_receive()
}
```

**Returns:** `Channel`

### is_complete

Non-blocking check if the future has completed.

```lua
while not future:is_complete() do
    -- do other work
    time.sleep("100ms")
end
local result, err = future:result()
```

**Returns:** `boolean`

### is_canceled

Returns true if `cancel()` was called on this future.

```lua
if future:is_canceled() then
    print("Operation was canceled")
end
```

**Returns:** `boolean`

### result

Returns the cached result if complete, or nil if still pending.

```lua
local value, err = future:result()
if err then
    print("Failed:", err:message())
elseif value then
    print("Got:", value:data())
end
```

**Returns:** `Payload|nil, error|nil`

### error

Returns the error if the future failed.

```lua
local err, has_error = future:error()
if has_error then
    print("Error kind:", err:kind())
end
```

**Returns:** `error|nil, boolean`

### cancel

Cancels the async operation.

```lua
future:cancel()
```

## Parallel Operations

Run multiple operations concurrently using async and channel.select.

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
