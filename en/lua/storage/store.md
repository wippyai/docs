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

Returns `nil` and an `errors.NOT_FOUND` error if the key doesn't exist or has expired.

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

## Reading Entry Metadata

`entry` returns the value together with its `version` — an opaque string used for optimistic concurrency:

```lua
local e, err = cache:entry("user:123")
if e then
    print(e.key, e.value, e.version)
end
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `key` | string | Key to read |

**Returns:** `Entry, error` — `{key: string, value: any, version: string}`

## Listing Keys

List entries in deterministic key order, with paging:

```lua
local page, err = cache:list({ prefix = "session:", limit = 100 })
for _, e in ipairs(page.items) do
    print(e.key, e.value)
end

-- next page
if page.has_more then
    page = cache:list({ prefix = "session:", after = page.cursor })
end
```

| Option | Type | Description |
|--------|------|-------------|
| `prefix` | string | Only keys with this prefix |
| `after` | string | Continue after this cursor (from a previous page) |
| `limit` | integer | Max items per page |

**Returns:** `Page, error` — `{items: Entry[], cursor: string, has_more: boolean}`

## Conditional Writes

`put` writes a value and returns its new `Entry`. Options enable optimistic concurrency:

```lua
-- create only if the key does not exist
local e, err = cache:put("lock:job-1", owner, { only_if_absent = true })
if err and err:kind() == errors.ALREADY_EXISTS then
    -- someone else holds it
end

-- compare-and-set: write only if the version still matches
local cur = cache:entry("config")
local e2, err2 = cache:put("config", new_value, { if_version = cur.version })
if err2 and err2:kind() == errors.CONFLICT then
    -- a concurrent writer changed it; re-read and retry
end
```

| Option | Type | Description |
|--------|------|-------------|
| `ttl` | number | TTL in seconds |
| `only_if_absent` | boolean | Write only if the key does not exist |
| `if_version` | string | Write only if the current version matches |

`only_if_absent` and `if_version` are mutually exclusive.

**Returns:** `Entry, error`

<warning>
Conditional writes require a store whose <code>info().conditional_put</code> is true (the memory and <code>store.kv.raft</code> stores). On <code>store.kv.crdt</code> and <code>store.sql</code> they return an <code>errors.INVALID</code> error — use <code>store.kv.raft</code> when you need conditional writes.
</warning>

## Store Capabilities

`info` reports the backend and what it supports, so code can adapt to whichever store is bound:

```lua
local info = cache:info()
-- info.backend      -> one of store.backend.* (e.g. "kv.raft")
-- info.consistency  -> one of store.consistency.* (e.g. "linearizable")
-- info.durable / info.list / info.versioned / info.conditional_put / info.ttl  (booleans)
```

**Returns:** `Info, error` — `{id, backend, consistency, durable, list, versioned, conditional_put, ttl}`

### Constants

| Constant | Values |
|----------|--------|
| `store.backend` | `MEMORY`, `SQL`, `KV_RAFT`, `KV_CRDT`, `UNKNOWN` |
| `store.consistency` | `LINEARIZABLE`, `EVENTUAL`, `LOCAL`, `UNKNOWN` |

```lua
if cache:info().consistency == store.consistency.LINEARIZABLE then
    -- safe to use compare-and-set
end
```

## Store Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `get(key)` | `any, error` | Retrieve value by key |
| `entry(key)` | `Entry, error` | Retrieve value with version metadata |
| `set(key, value, ttl?)` | `boolean, error` | Store value with optional TTL |
| `put(key, value, opts?)` | `Entry, error` | Conditional/versioned write, returns the new entry |
| `list(opts?)` | `Page, error` | Paged listing in key order |
| `has(key)` | `boolean, error` | Check if key exists |
| `delete(key)` | `boolean, error` | Remove key |
| `info()` | `Info, error` | Backend, consistency, and capability flags |
| `release()` | `boolean` | Release store back to pool |

## Permissions

Store operations are subject to security policy evaluation.

| Action | Resource | Attributes | Description |
|--------|----------|------------|-------------|
| `store.get` | Store ID | - | Acquire a store resource |
| `store.info` | Store ID | - | Inspect store capabilities |
| `store.key.get` | Store ID | `key` | Read a key value (also `entry`) |
| `store.key.set` | Store ID | `key` | Write a key value (also `put`) |
| `store.key.delete` | Store ID | `key` | Delete a key |
| `store.key.has` | Store ID | `key` | Check key existence |
| `store.key.list` | Store ID | `prefix` | List entries |

## Errors

`store.get()` and all methods on the store handle (`get`, `entry`, `set`, `put`, `list`, `has`, `delete`, `info`) return structured errors (use `err:kind()`).

| Condition | Kind | Retryable |
|-----------|------|-----------|
| Empty resource ID | `errors.INVALID` | no |
| Resource not found | `errors.NOT_FOUND` | no |
| Store released | `errors.INVALID` | no |
| Permission denied | `errors.PERMISSION_DENIED` | no |
| `only_if_absent` and key exists | `errors.ALREADY_EXISTS` | no |
| `if_version` mismatch | `errors.CONFLICT` | yes |
| Conditional write on a store without support | `errors.INVALID` | no |

See [Error Handling](lua/core/errors.md) for working with errors.
