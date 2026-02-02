# Security & Access Control
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="permissions"/>

Manage authentication actors, authorization scopes, and access policies.

## Loading

```lua
local security = require("security")
```

## actor

Returns the current security actor from the execution context.

```lua
local actor = security.actor()
if actor then
    local id = actor:id()
    local meta = actor:meta()

    logger:info("Request from", {
        user_id = id,
        role = meta.role
    })
end
```

**Returns:** `Actor|nil`

## scope

Returns the current security scope from the execution context.

```lua
local scope = security.scope()
if scope then
    local policies = scope:policies()
    for _, policy in ipairs(policies) do
        print("Active policy:", policy:id())
    end
end
```

**Returns:** `Scope|nil`

## can

Checks if the current context allows an action on a resource.

```lua
-- Check read permission
if not security.can("read", "user:" .. user_id) then
    return nil, errors.new("PERMISSION_DENIED", "Cannot read user data")
end

-- Check write permission
if not security.can("write", "order:" .. order_id) then
    return nil, errors.new("PERMISSION_DENIED", "Cannot modify order")
end

-- Check with metadata
local allowed = security.can("delete", "document:" .. doc_id, {
    owner_id = doc.owner_id,
    department = doc.department
})
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `action` | string | Action to check |
| `resource` | string | Resource identifier |
| `meta` | table | Additional metadata (optional) |

**Returns:** `boolean`

## new_actor

Creates a new actor with ID and metadata.

```lua
-- Create user actor
local actor = security.new_actor("user:" .. user.id, {
    role = user.role,
    department = user.department,
    email = user.email
})

-- Create service actor
local service_actor = security.new_actor("service:payment-processor", {
    type = "service",
    version = "1.0.0"
})
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Unique actor identifier |
| `meta` | table | Metadata key-value pairs |

**Returns:** `Actor`

## new_scope

Creates a new custom scope.

```lua
-- Empty scope
local scope = security.new_scope()

-- Scope with policies
local read_policy = security.policy("app:read-only")
local scope = security.new_scope({read_policy})

-- Build scope incrementally
local scope = security.new_scope()
local policy1 = security.policy("app:read")
local policy2 = security.policy("app:write")
scope = scope:with(policy1):with(policy2)
```

**Returns:** `Scope`

## policy

Retrieves a policy from the registry.

```lua
local policy, err = security.policy("app:admin-access")
if err then
    return nil, err
end

-- Evaluate policy
local result = policy:evaluate(actor, "delete", "user:123")
if result == "allow" then
    -- permitted
elseif result == "deny" then
    -- forbidden
else
    -- undefined, check other policies
end
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Policy ID "namespace:name" |

**Returns:** `Policy, error`

## named_scope

Retrieves a pre-defined policy group.

```lua
-- Get admin scope
local admin_scope, err = security.named_scope("app:admin")
if err then
    return nil, err
end

-- Use for elevated operations
local result = admin_scope:evaluate(actor, "delete", "user:123")
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Policy group ID |

**Returns:** `Scope, error`

## token_store

Acquires a token store for managing authentication tokens.

```lua
local store, err = security.token_store("app:tokens")
if err then
    return nil, err
end

-- Use store...
store:close()
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Token store ID "namespace:name" |

**Returns:** `TokenStore, error`

## Actor Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `actor:id()` | string | Actor identifier |
| `actor:meta()` | table | Actor metadata |

## Scope Methods

### with / without

Add or remove policies from scope.

```lua
local scope = security.new_scope()

-- Add policy
local write_policy = security.policy("app:write")
scope = scope:with(write_policy)

-- Remove policy
scope = scope:without("app:read-only")
```

### evaluate

Evaluate all policies in scope.

```lua
local result = scope:evaluate(actor, "read", "document:123")
-- "allow", "deny", or "undefined"

if result ~= "allow" then
    return nil, errors.new("PERMISSION_DENIED", "Access denied")
end
```

### contains

Check if scope contains a policy.

```lua
if scope:contains("app:admin") then
    show_admin_features()
end
```

### policies

Returns all policies in scope.

```lua
local policies = scope:policies()
for _, policy in ipairs(policies) do
    print(policy:id())
end
```

**Returns:** `Policy[]`

## Policy Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `policy:id()` | string | Policy identifier |
| `policy:evaluate(actor, action, resource, meta?)` | string | `"allow"`, `"deny"`, or `"undefined"` |

## TokenStore Methods

### create

Create authentication token.

```lua
local actor = security.new_actor("user:123", {role = "user"})
local scope = security.named_scope("app:default")

local token, err = store:create(actor, scope, {
    expiration = "24h",  -- or milliseconds
    meta = {
        login_ip = request_ip,
        user_agent = user_agent
    }
})
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `actor` | Actor | Actor for the token |
| `scope` | Scope | Permissions scope |
| `options.expiration` | string/number | Duration string or ms |
| `options.meta` | table | Token metadata |

**Returns:** `string, error`

### validate

Validate token and get actor/scope.

```lua
local actor, scope, err = store:validate(token)
if err then
    return nil, errors.new("UNAUTHENTICATED", "Invalid token")
end
```

**Returns:** `Actor, Scope, error`

### revoke

Invalidate a token.

```lua
local ok, err = store:revoke(token)
```

**Returns:** `boolean, error`

### close

Release the token store resource.

```lua
store:close()
```

**Returns:** `boolean`

## Permissions

Security operations are subject to security policy evaluation.

### Security Actions

| Action | Resource | Description |
|--------|----------|-------------|
| `security.policy.get` | Policy ID | Access policy definitions |
| `security.policy_group.get` | Group ID | Access named scopes |
| `security.scope.create` | `custom` | Create custom scopes |
| `security.actor.create` | Actor ID | Create actors |
| `security.token_store.get` | Store ID | Access token stores |
| `security.token.validate` | Store ID | Validate tokens |
| `security.token.create` | Store ID | Create tokens |
| `security.token.revoke` | Store ID | Revoke tokens |

See [Security Model](system/security.md) for policy configuration.

## Errors

| Condition | Kind | Retryable |
|-----------|------|-----------|
| No context | `errors.INTERNAL` | no |
| Empty token store ID | `errors.INVALID` | no |
| Permission denied | `errors.INVALID` | no |
| Policy not found | `errors.INTERNAL` | no |
| Token store not found | `errors.INTERNAL` | no |
| Token store closed | `errors.INTERNAL` | no |
| Invalid expiration format | `errors.INVALID` | no |
| Token validation failed | `errors.INTERNAL` | no |

```lua
local store, err = security.token_store("app:tokens")
if err then
    if errors.is(err, errors.INVALID) then
        print("Invalid request:", err:message())
    end
    return nil, err
end
```

See [Error Handling](lua/core/errors.md) for working with errors.

## See Also

- [Security Model](system/security.md) - Actors, policies, scopes configuration
- [HTTP Middleware](http/middleware.md) - Endpoint and resource firewall
