# Contracts
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>
<secondary-label ref="permissions"/>

Invoke services through typed contracts. Call remote APIs, workflows, and functions with schema validation and async execution support.

## Loading

```lua
local contract = require("contract")
```

## Opening a Binding

Open a binding directly by ID:

```lua
local greeter, err = contract.open("app.services:greeter")
if err then
    return nil, err
end

local result, err = greeter:say_hello("Alice")
```

With scope context or query parameters:

```lua
-- With scope table
local svc, err = contract.open("app.services:user", {
    tenant_id = "acme",
    region = "us-east"
})

-- With query parameters (auto-converted: "true"→bool, numbers→int/float)
local api, err = contract.open("app.services:api?debug=true&timeout=5000")
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `binding_id` | string | Binding ID, supports query params |
| `scope` | table | Context values (optional, overrides query params) |

**Returns:** `Instance, error`

## Getting a Contract

Retrieve contract definition for introspection:

```lua
local c, err = contract.get("app.services:greeter")

print(c:id())  -- "app.services:greeter"

local methods = c:methods()
for _, m in ipairs(methods) do
    print(m.name, m.description)
end

local method, err = c:method("say_hello")
```

### Method Definition

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Method name |
| `description` | string | Method description |
| `input_schemas` | table[] | Input schema definitions |
| `output_schemas` | table[] | Output schema definitions |

## Finding Implementations

List all bindings that implement a contract:

```lua
local bindings, err = contract.find_implementations("app.services:greeter")

for _, binding_id in ipairs(bindings) do
    print(binding_id)
end
```

Or via contract object:

```lua
local c, err = contract.get("app.services:greeter")
local bindings, err = c:implementations()
```

## Checking Implementation

Check if instance implements a contract:

```lua
if contract.is(instance, "app.services:greeter") then
    instance:say_hello("World")
end
```

## Calling Methods

Sync call - blocks until complete:

```lua
local calc, err = contract.open("app.services:calculator")

local sum, err = calc:add(10, 20)
local product, err = calc:multiply(5, 6)
```

## Async Calls

Add `_async` suffix for async execution:

```lua
local processor, err = contract.open("app.services:processor")

local future, err = processor:process_async(large_dataset)

-- Do other work...

-- Wait for result
local ch = future:response()
local payload, ok = ch:receive()
if ok then
    local result = payload:data()
end
```

See [Futures](lua-future.md) for future methods.

## Opening via Contract

Open binding through contract object:

```lua
local c, err = contract.get("app.services:user")

-- Default binding
local instance, err = c:open()

-- Specific binding
local instance, err = c:open("app.services:user_impl")

-- With scope
local instance, err = c:open(nil, {user_id = 123})
local instance, err = c:open("app.services:user_impl", {user_id = 123})
```

## Adding Context

Create wrapper with pre-configured context:

```lua
local c, err = contract.get("app.services:user")

local wrapped = c:with_context({
    request_id = ctx.get("request_id"),
    user_id = current_user.id
})

local instance, err = wrapped:open()
```

## Security Context

Set actor and scope for authorization:

```lua
local security = require("security")
local c, err = contract.get("app.services:admin")

local secured = c:with_actor(security.actor()):with_scope(security.scope())

local admin, err = secured:open()
```

## Permissions

| Permission | Resource | Functions |
|------------|----------|-----------|
| `contract.get` | contract id | `get()` |
| `contract.open` | binding id | `open()`, `Contract:open()` |
| `contract.implementations` | contract id | `find_implementations()`, `Contract:implementations()` |
| `contract.call` | method name | sync and async method calls |
| `contract.context` | "context" | `Contract:with_context()` |
| `contract.security` | "security" | `Contract:with_actor()`, `Contract:with_scope()` |

## Errors

| Condition | Kind |
|-----------|------|
| Invalid binding ID format | `errors.INVALID` |
| Contract not found | `errors.NOT_FOUND` |
| Binding not found | `errors.NOT_FOUND` |
| Method not found | `errors.NOT_FOUND` |
| No default binding | `errors.NOT_FOUND` |
| Permission denied | `errors.PERMISSION_DENIED` |
| Call failed | `errors.INTERNAL` |
