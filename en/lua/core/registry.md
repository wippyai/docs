---
title: "Entry Registry"
description: "Read registry entries and metadata, inspect versions and snapshots, and apply changesets."
---

# Entry Registry
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="permissions"/>

The `registry` module reads and modifies entries and provides access to snapshots and version history. This page is an API reference; mutation examples use illustrative IDs and require policies that authorize those exact resources and entry kinds.

## Loading

```lua
local registry = require("registry")
```

## Entry Structure

```lua
{
    id = "app.lib:assert",     -- string: "namespace:name"
    kind = "function.lua",     -- string: entry type
    meta = {type = "test"},    -- table: searchable metadata
    data = {...}               -- any: entry payload
}
```

## Get an Entry

```lua
local entry, err = registry.get("app.lib:assert")
```

**Permission:** `registry.get` on entry ID

## Find Entries

```lua
local entries, err = registry.find({[".kind"] = "function.lua"})
local entries, err = registry.find({[".kind"] = "http.endpoint", [".ns"] = "app.api"})
```

The root selectors are `.kind`, `.name`, `.ns`, and `.id`; their values support glob matching. Metadata filters use a `meta.` prefix, for example `{["meta.type"] = "test"}`.

## Parse ID

```lua
local id = registry.parse_id("app.lib:assert")
-- id.ns = "app.lib", id.name = "assert"
```

## Snapshots

A snapshot is a point-in-time view of the registry:

```lua
local snap, err = registry.snapshot()           -- current state
local snap, err = registry.snapshot_at(5)       -- at version 5
```

### Snapshot Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `snap:entries()` | `Entry[], error` | All accessible entries |
| `snap:get(id)` | `Entry, error` | Single entry by ID |
| `snap:find(filter)` | `Entry[]` | Filter entries |
| `snap:namespace(ns)` | `Entry[]` | Entries in namespace |
| `snap:version()` | `Version` | Snapshot version |
| `snap:changes()` | `Changes` | Create changeset |

## Process-Local Overlays

`registry.overlay(owner_id)` opens a process-local overlay for a logical owner. It returns a normal snapshot of the effective registry; create a changeset from that snapshot and apply it in the same way as a durable change:

```lua
local snap, err = registry.overlay("controllers:customer-db")
if err then
    return nil, err
end

local changes = snap:changes()
changes:create({
    id = "runtime.data_sources:customer-db",
    kind = "db.sql.postgres",
    data = {host = "db.example.com", database = "customer"}
})

local current_version, err = changes:apply()
```

Overlay changes affect the registry topology and resources in this process but do not create durable history versions. `changes:apply()` therefore returns the unchanged current durable version. An overlay survives normal history commits and version selection; it is cleared by a cold boot or explicit registry state load and then reconciled by its owner.

Overlay snapshots use generation-based optimistic concurrency. Applying changes from a stale snapshot fails atomically with retryable `errors.CONFLICT`; reopen the overlay and rebuild the changeset. A changeset can contain at most one operation for each entry ID. Owner IDs are trimmed to their canonical identity. The owner is registry state rather than entry metadata, and expansion-directive-owned entry kinds cannot be changed through an overlay.

Regular `registry.get`, `find`, and `snapshot` calls see the composed effective registry and continue to require `registry.get` for each entry; the owner-level overlay permission does not replace read authorization.

## Versions

```lua
local version, err = registry.current_version()
local versions, err = registry.versions()

print(version:id())       -- numeric ID
print(version:string())   -- display string
local prev = version:previous()  -- previous version or nil
local next = version:next()      -- next version or nil
```

## History

```lua
local hist, err = registry.history()
local versions, err = hist:versions()
local version, err = hist:get_version(5)
local snap, err = hist:snapshot_at(version)
```

## Changesets

Build a changeset from create, update, and delete operations, then apply it:

```lua
local snap, err = registry.snapshot()
local changes = snap:changes()

changes:create({
    id = "test:new_entry",
    kind = "test.kind",
    meta = {type = "test"},
    data = {config = "value"}
})

changes:update({
    id = "test:existing",
    kind = "test.kind",
    meta = {updated = true},
    data = {new_value = true}
})

changes:delete("test:old_entry")

local new_version, err = changes:apply()
```

**Permission:** `registry.apply` for `changes:apply()`

### Changes Methods

| Method | Description |
|--------|-------------|
| `changes:create(entry)` | Add create operation |
| `changes:update(entry)` | Add update operation |
| `changes:delete(id)` | Add delete operation (string or `{ns, name}`) |
| `changes:ops()` | Get pending operations |
| `changes:apply()` | Apply changes, returns new Version |

## Apply Version

Apply a specific version to move the registry backward or forward:

```lua
local prev = current_version:previous()
local ok, err = registry.apply_version(prev)
```

**Permission:** `registry.apply_version`

## Build Delta

Compute the operations required to transition between two entry sets:

```lua
local from = {{id = "test:a", kind = "test", meta = {}, data = {}}}
local to = {{id = "test:b", kind = "test", meta = {}, data = {}}}

local ops, err = registry.build_delta(from, to)
for _, op in ipairs(ops) do
    print(op.kind, op.entry.id)  -- "entry.create", "entry.update", "entry.delete"
end
```

## Permissions

| Permission | Resource | Description |
|------------|----------|-------------|
| `registry.get` | entry ID | Read entry (also filters find/entries results) |
| `registry.apply` | - | Apply changeset |
| `registry.apply_version` | - | Apply/rollback version |
| `registry.overlay.get` | owner ID | Open an owner's overlay |
| `registry.overlay.apply` | owner ID | Apply an overlay changeset |
| `registry.overlay.create.<kind>` | entry ID | Create an entry of the specified kind in an overlay |
| `registry.overlay.update.<kind>` | entry ID | Update an entry of the specified kind in an overlay |
| `registry.overlay.delete.<kind>` | entry ID | Delete an entry of the specified kind from an overlay |

## Errors

| Condition | Kind |
|-----------|------|
| Entry not found | `errors.NOT_FOUND` |
| Version not found | `errors.NOT_FOUND` |
| Permission denied | `errors.PERMISSION_DENIED` |
| Invalid parameter | `errors.INVALID` |
| No changes to apply | `errors.INVALID` |
| Empty overlay owner or directive-owned kind | `errors.INVALID` |
| Stale overlay snapshot | `errors.CONFLICT` (retryable) |
| Registry not available | `errors.INTERNAL` |

See [Error Handling](./errors.md) for working with errors.
