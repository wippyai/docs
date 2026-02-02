# Key-Value Store
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>
<secondary-label ref="permissions"/>

Fast key-value storage with TTL support. Ideal for caching, sessions, and temporary state.

For store configuration, see [Store](system/store.md).

## Loading

```lua
local store = require("store")
```

## Acquiring a Store

Get a store resource by registry ID:

```lua
local cache, err = store.get("app:cache")
if err then
    return nil, err
end

cache:set("user:123", {name = "Alice"}, 3600)
local user = cache:get("user:123")

cache:release()
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Store resource ID |

**Returns:** `Store, error`

## Storing Values

Store a value with optional TTL:

```lua
local cache = store.get("app:cache")

-- Simple set
cache:set("user:123:name", "Alice")

-- Set with TTL (expires in 300 seconds)
cache:set("session:abc", {user_id = 123, role = "admin"}, 300)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `key` | string | Key |
| `value` | any | Value (tables, strings, numbers, booleans) |
| `ttl` | number | TTL in seconds (optional, 0 = no expiry) |

**Returns:** `boolean, error`

## Retrieving Values

Get a value by key:

```lua
local user = cache:get("user:123")
if not user then
    -- Key not found or expired
end
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `key` | string | Key to retrieve |

**Returns:** `any, error`

Returns `nil` if key doesn't exist.

## Checking Existence

Check if a key exists without retrieving:

```lua
if cache:has("lock:" .. resource_id) then
    return nil, errors.new("CONFLICT", "Resource is locked")
end
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `key` | string | Key to check |

**Returns:** `boolean, error`

## Deleting Keys

Remove a key from the store:

```lua
cache:delete("session:" .. session_id)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `key` | string | Key to delete |

**Returns:** `boolean, error`

Returns `true` if deleted, `false` if key didn't exist.

## Store Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `get(key)` | `any, error` | Retrieve value by key |
| `set(key, value, ttl?)` | `boolean, error` | Store value with optional TTL |
| `has(key)` | `boolean, error` | Check if key exists |
| `delete(key)` | `boolean, error` | Remove key |
| `release()` | `boolean` | Release store back to pool |

## Permissions

Store operations are subject to security policy evaluation.

| Action | Resource | Attributes | Description |
|--------|----------|------------|-------------|
| `store.get` | Store ID | - | Acquire a store resource |
| `store.key.get` | Store ID | `key` | Read a key value |
| `store.key.set` | Store ID | `key` | Write a key value |
| `store.key.delete` | Store ID | `key` | Delete a key |
| `store.key.has` | Store ID | `key` | Check key existence |

## Errors

| Condition | Kind | Retryable |
|-----------|------|-----------|
| Empty resource ID | `errors.INVALID` | no |
| Resource not found | `errors.NOT_FOUND` | no |
| Store released | `errors.INVALID` | no |
| Permission denied | `errors.PERMISSION_DENIED` | no |

See [Error Handling](lua/core/errors.md) for working with errors.
