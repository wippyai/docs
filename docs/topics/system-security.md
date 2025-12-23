# Security Model

Wippy implements attribute-based access control. Every request carries an actor (who) and a scope (what policies apply). Policies evaluate access based on the action, resource, and metadata from both actor and resource.

```
Actor + Scope ──► Policy Evaluation ──► Allow/Deny
     │                   │
  Identity          Conditions
  Metadata      (actor, resource, action)
```

## Entry Kinds

| Kind | Description |
|------|-------------|
| `security.policy` | Declarative policy with conditions |
| `security.policy.expr` | Expression-based policy |
| `security.token_store` | Token storage and validation |

## Actors

An actor represents who is performing an action.

```lua
local security = require("security")

-- Create actor with metadata
local actor = security.new_actor("user:123", {
    role = "admin",
    team = "backend",
    department = "engineering",
    clearance = 3
})

-- Access actor properties
local id = actor:id()        -- "user:123"
local meta = actor:meta()    -- {role="admin", ...}
```

### Actor in Context

```lua
-- Get current actor from context
local actor = security.actor()
if not actor then
    return nil, errors.new("UNAUTHORIZED", "No actor in context")
end
```

## Policies

Policies define access rules with actions, resources, conditions, and effects.

### Declarative Policy

```yaml
# src/security/_index.yaml
version: "1.0"
namespace: app.security

entries:
  # Admin full access
  - name: admin_policy
    kind: security.policy
    policy:
      actions: "*"
      resources: "*"
      effect: allow
      conditions:
        - field: actor.meta.role
          operator: eq
          value: admin
    groups:
      - admin

  # Read-only access
  - name: readonly_policy
    kind: security.policy
    policy:
      actions:
        - "*.read"
        - "*.get"
        - "*.list"
      resources: "*"
      effect: allow
    groups:
      - default

  # Resource owner access
  - name: owner_policy
    kind: security.policy
    policy:
      actions:
        - read
        - write
        - delete
      resources: "document:*"
      effect: allow
      conditions:
        - field: meta.owner
          operator: eq
          value_from: actor.id
    groups:
      - default

  # Deny confidential without clearance
  - name: deny_confidential
    kind: security.policy
    policy:
      actions: "*"
      resources: "document:*"
      effect: deny
      conditions:
        - field: meta.classification
          operator: eq
          value: confidential
        - field: actor.meta.clearance
          operator: lt
          value: 3
    groups:
      - security
```

### Policy Structure

```yaml
policy:
  actions: "*" | "action" | ["action1", "action2"]
  resources: "*" | "resource" | ["res1", "res2"]
  effect: allow | deny
  conditions:  # Optional
    - field: "field.path"
      operator: "eq"
      value: "static_value"
      # OR
      value_from: "other.field.path"
```

### Expression-Based Policy

For complex logic, use expression policies:

```yaml
- name: flexible_access
  kind: security.policy.expr
  policy:
    actions:
      - read
      - write
    resources: "file:*"
    effect: allow
    expression: |
      (actor.meta.role == "editor" && action == "write") ||
      (action == "read" && meta.public == true) ||
      actor.id == meta.owner
  groups:
    - editors
```

## Conditions

Conditions allow dynamic policy evaluation based on actor, action, resource, and metadata.

### Field Paths

| Path | Description |
|------|-------------|
| `actor.id` | Actor's unique identifier |
| `actor.meta.*` | Actor metadata (supports nesting) |
| `action` | The action being performed |
| `resource` | The resource identifier |
| `meta.*` | Resource metadata |

### Operators

| Operator | Description | Example |
|----------|-------------|---------|
| `eq` | Equals | `actor.meta.role eq "admin"` |
| `ne` | Not equals | `meta.status ne "deleted"` |
| `lt` | Less than | `meta.priority lt 5` |
| `gt` | Greater than | `actor.meta.clearance gt 2` |
| `lte` | Less than or equal | `meta.size lte 1000` |
| `gte` | Greater than or equal | `actor.meta.level gte 3` |
| `in` | Value in array | `action in ["read", "write"]` |
| `nin` | Value not in array | `meta.status nin ["deleted", "archived"]` |
| `exists` | Field exists | `meta.owner exists true` |
| `nexists` | Field not exists | `meta.deleted nexists true` |
| `contains` | String contains | `resource contains "sensitive"` |
| `ncontains` | String not contains | `resource ncontains "public"` |
| `matches` | Regex match | `resource matches "^doc:.*"` |
| `nmatches` | Regex not match | `actor.id nmatches "^system:.*"` |

### Condition Examples

```yaml
# Match actor role
conditions:
  - field: actor.meta.role
    operator: eq
    value: admin

# Compare fields
conditions:
  - field: meta.owner
    operator: eq
    value_from: actor.id

# Numeric comparison
conditions:
  - field: actor.meta.clearance
    operator: gte
    value: 3

# Array membership
conditions:
  - field: actor.meta.role
    operator: in
    value:
      - admin
      - moderator

# Pattern matching
conditions:
  - field: resource
    operator: matches
    value: "^api:/v[0-9]+/admin/.*"

# Multiple conditions (AND)
conditions:
  - field: actor.meta.department
    operator: eq
    value: engineering
  - field: meta.environment
    operator: eq
    value: production
```

## Scopes

Scopes combine multiple policies into a security context.

```lua
local security = require("security")

-- Get policies
local admin_policy = security.policy("app.security:admin_policy")
local readonly_policy = security.policy("app.security:readonly_policy")

-- Create scope with policies
local scope = security.new_scope()
scope = scope:with(admin_policy)
scope = scope:with(readonly_policy)

-- Scopes are immutable - :with() returns new scope
```

### Named Scopes (Policy Groups)

Load all policies from a group:

```lua
-- Load scope with all policies in group
local scope, err = security.named_scope("app.security:admin")
```

Policies are assigned to groups via the `groups` field:

```yaml
- name: admin_policy
  kind: security.policy
  policy:
    # ...
  groups:
    - admin      # This policy is in "admin" group
    - default    # Can be in multiple groups
```

### Scope Operations

```lua
-- Add policy
local new_scope = scope:with(policy)

-- Remove policy
local new_scope = scope:without("app.security:temp_policy")

-- Check if policy is in scope
local has = scope:contains("app.security:admin_policy")

-- Get all policies
local policies = scope:policies()
```

## Policy Evaluation

### Evaluation Flow

```
1. Check each policy in scope
2. If ANY policy returns Deny → Result is Deny
3. If at least one Allow and no Deny → Result is Allow
4. No applicable policies → Result is Undefined
```

### Evaluation Results

| Result | Meaning |
|--------|---------|
| `allow` | Access granted |
| `deny` | Access explicitly denied |
| `undefined` | No policy matched |

```lua
-- Evaluate directly
local result = scope:evaluate(actor, "read", "document:123", {
    owner = "user:456",
    classification = "internal"
})

if result == "deny" then
    return nil, errors.new("FORBIDDEN", "Access denied")
elseif result == "undefined" then
    -- No policy matched - depends on strict mode
end
```

### Quick Permission Check

```lua
-- Check against current context's actor and scope
local allowed = security.can("read", "document:123", {
    owner = "user:456"
})

if not allowed then
    return nil, errors.new("FORBIDDEN", "Access denied")
end
```

## Token Stores

Token stores provide secure token creation, validation, and revocation.

### Configuration

```yaml
# src/auth/_index.yaml
version: "1.0"
namespace: app.auth

entries:
  # Register environment variable
  - name: os_env
    kind: env.storage.os

  - name: AUTH_SECRET_KEY
    kind: env.variable
    variable: AUTH_SECRET_KEY
    storage: app.auth:os_env

  # Backing store for tokens
  - name: token_data
    kind: store.memory
    lifecycle:
      auto_start: true

  # Token store
  - name: tokens
    kind: security.token_store
    store: app.auth:token_data
    token_length: 32
    default_expiration: "24h"
    token_key_env: "AUTH_SECRET_KEY"
```

### Token Store Options

| Option | Default | Description |
|--------|---------|-------------|
| `store` | required | Backing key-value store reference |
| `token_length` | 32 | Token size in bytes (256 bits) |
| `default_expiration` | 24h | Default token TTL |
| `token_key` | none | HMAC-SHA256 signing key (direct value) |
| `token_key_env` | none | Environment variable name for signing key |

Use `token_key_env` in production to avoid embedding secrets in entries. See [Environment System](system-env.md) for registering environment variables.

### Creating Tokens

```lua
local security = require("security")

-- Get token store
local store, err = security.token_store("app.auth:tokens")
if err then
    return nil, err
end

-- Create actor and scope
local actor = security.new_actor("user:123", {
    role = "user",
    email = "user@example.com"
})

local scope, _ = security.named_scope("app.security:default")

-- Create token
local token, err = store:create(actor, scope, {
    expiration = "7d",  -- Override default expiration
    meta = {
        device = "mobile",
        ip = "192.168.1.1"
    }
})

if err then
    return nil, err
end

-- Token format: base64_token.hmac_signature (if token_key set)
-- Example: "dGVzdHRva2VuMTIz.a1b2c3d4e5f6"
```

### Validating Tokens

```lua
-- Validate token
local actor, scope, err = store:validate(token)
if err then
    return nil, errors.new("UNAUTHORIZED", "Invalid token")
end

-- Actor and scope are reconstructed from stored data
print(actor:id())  -- "user:123"
```

### Revoking Tokens

```lua
-- Revoke single token
local ok, err = store:revoke(token)

-- Close store when done
store:close()
```

## Context Flow

Security context propagates through function calls.

### Setting Context

```lua
local funcs = require("funcs")

-- Call function with security context
local result, err = funcs.new()
    :with_actor(actor)
    :with_scope(scope)
    :call("app.api:protected_endpoint", data)
```

### Context Inheritance

| Component | Inherits |
|-----------|----------|
| Actor | Yes - passes to child calls |
| Scope | Yes - passes to child calls |
| Strict mode | No - application-wide |

Functions inherit caller's security context. Spawned processes start fresh.

## Service-Level Security

Configure default security for services:

```yaml
- name: worker_service
  kind: process.lua
  source: file://worker.lua
  lifecycle:
    auto_start: true
    security:
      actor:
        id: "service:worker"
        meta:
          role: worker
          service: true
      policies:
        - app.security:worker_policy
      groups:
        - workers
```

## Strict Mode

Enable strict mode to deny access when security context is missing:

```yaml
# wippy.yaml
security:
  strict_mode: true
```

| Mode | Missing Context | Behavior |
|------|-----------------|----------|
| Normal | No actor/scope | Allow (permissive) |
| Strict | No actor/scope | Deny (secure default) |

## Authentication Flow

Token validation in an HTTP handler:

```lua
local http = require("http")
local security = require("security")

local function protected_handler()
    local req = http.request()
    local res = http.response()

    -- Extract and validate token
    local auth = req:header("Authorization")
    if not auth then
        return res:set_status(401):write_json({error = "Missing authorization"})
    end

    local token = auth:gsub("^Bearer%s+", "")
    local store, _ = security.token_store("app.auth:tokens")
    local actor, scope, err = store:validate(token)
    if err then
        return res:set_status(401):write_json({error = "Invalid token"})
    end

    -- Check permission
    if not security.can("api.users.read", "users") then
        return res:set_status(403):write_json({error = "Forbidden"})
    end

    res:write_json({user = actor:id()})
end

return { handler = protected_handler }
```

Token creation during login:

```lua
local actor = security.new_actor("user:" .. user.id, {role = user.role})
local scope, _ = security.named_scope("app.security:" .. user.role)

local store, _ = security.token_store("app.auth:tokens")
local token, err = store:create(actor, scope, {expiration = "24h"})
```

## Best Practices

1. **Least privilege** - Grant minimum required permissions
2. **Deny by default** - Use explicit allow policies, enable strict mode
3. **Use policy groups** - Organize policies by role/function
4. **Sign tokens** - Always set `token_key_env` in production
5. **Short expiration** - Use shorter token lifetimes for sensitive operations
6. **Condition on context** - Use dynamic conditions over static policies
7. **Audit sensitive actions** - Log security-relevant operations

## Security Module Reference

| Function | Description |
|----------|-------------|
| `security.actor()` | Get current actor from context |
| `security.scope()` | Get current scope from context |
| `security.can(action, resource, meta?)` | Check permission |
| `security.new_actor(id, meta?)` | Create new actor |
| `security.new_scope(policies?)` | Create empty or seeded scope |
| `security.policy(id)` | Get policy by ID |
| `security.named_scope(group_id)` | Get scope with all group policies |
| `security.token_store(id)` | Get token store |
