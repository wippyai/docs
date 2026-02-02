# Entry Registry
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="permissions"/>

Query and modify registered entries. Access metadata, snapshots, and version history.

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

## Get Entry

```lua
local entry, err = registry.get("app.lib:assert")
```

**Permission:** `registry.get` on entry ID

## Find Entries

```lua
local entries, err = registry.find({kind = "function.lua"})
local entries, err = registry.find({kind = "http.endpoint", namespace = "app.api"})
```

Filter fields match against entry metadata.

## Parse ID

```lua
local id = registry.parse_id("app.lib:assert")
-- id.ns = "app.lib", id.name = "assert"
```

## Snapshots

Point-in-time view of the registry:

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

## Versions

```lua
local version, err = registry.current_version()
local versions, err = registry.versions()

print(version:id())       -- numeric ID
print(version:string())   -- display string
local prev = version:previous()  -- previous version or nil
```

## History

```lua
local hist, err = registry.history()
local versions, err = hist:versions()
local version, err = hist:get_version(5)
local snap, err = hist:snapshot_at(version)
```

## Changesets

Build and apply modifications:

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

Roll back or forward to a specific version:

```lua
local prev = current_version:previous()
local ok, err = registry.apply_version(prev)
```

**Permission:** `registry.apply_version`

## Build Delta

Compute operations to transition between states:

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

## Errors

| Condition | Kind |
|-----------|------|
| Entry not found | `errors.NOT_FOUND` |
| Version not found | `errors.NOT_FOUND` |
| Permission denied | `errors.PERMISSION_DENIED` |
| Invalid parameter | `errors.INVALID` |
| No changes to apply | `errors.INVALID` |
| Registry not available | `errors.INTERNAL` |

See [Error Handling](lua/core/errors.md) for working with errors.
