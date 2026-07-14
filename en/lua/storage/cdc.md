---
title: "CDC"
description: "<secondary-label ref='storage'/ <secondary-label ref='stream'/ <secondary-label ref='nondeterministic'/"
---

# CDC
<secondary-label ref="storage"/>
<secondary-label ref="stream"/>
<secondary-label ref="nondeterministic"/>

Subscribe to Postgres Change Data Capture streams from [`db.cdc.postgres`](system/cdc.md) sources. List configured sources, open a stream, and receive row-level change events over a channel.

## Loading

```lua
local cdc = require("cdc")
```

## list_sources

List all configured CDC sources:

```lua
local sources, err = cdc.list_sources()
for _, s in ipairs(sources) do
    print(s.name, s.slot, s.streaming)
end
```

Each source is a table: `name`, `slot`, `publication`, `tables`, `streaming`, `failover`, `temporary`, `snapshot`. See [CDC sources](system/cdc.md#source-info).

**Returns:** `table, error`

## source

Get a single source by name (its entry ID):

```lua
local info, err = cdc.source("app:pg_cdc")
if info == nil then
    -- no such source
end
```

**Returns:** `table, error` (source info, or `nil` if not found)

## stream

Open a change stream on a source. Returns a `cdc.Stream` whose channel delivers change events:

```lua
local stream, err = cdc.stream("app:pg_cdc", {
    tables = { "public.users", "public.orders" },
    ops    = { "insert", "update" },
    buffer = 128,
})
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `name` | string | Source name (entry ID) |
| `opts.tables` | []string | Filter to these tables (omit for all configured tables) |
| `opts.ops` | []string | Filter to these operations: `insert`, `update`, `delete`, `truncate` |
| `opts.buffer` | int | Channel buffer size (1-65536) |

**Returns:** `Stream, error`

## Stream Methods

### channel

Return the channel that receives change events. The first call subscribes to the source (yields); subsequent calls return the same channel. `:receive()` blocks until the next change arrives, or returns `nil` when the stream ends:

```lua
local stream = cdc.stream("app:pg_cdc")
local ch = stream:channel()

while true do
    local change = ch:receive()
    if change == nil then break end   -- stream closed

    if change.op == "insert" then
        handle_new_user(change.table, change.after)
    elseif change.op == "update" then
        handle_update(change.table, change.before, change.after)
    elseif change.op == "delete" then
        handle_delete(change.table, change.before)
    end
end
```

`receive` is an alias for `channel`.

### close

Stop the subscription and release the stream. Idempotent; also auto-closed at task scope. `release` is an alias for `close`.

```lua
stream:close()
```

## Change Event

Each message received on the channel is a change table:

| Field | Description |
|-------|-------------|
| `op` | Operation: `insert`, `update`, `delete`, `truncate`, or `r` (snapshot read) |
| `schema` | Table schema |
| `table` | Table name |
| `relation` | `schema.table` |
| `before` | Row state before the change (`update`, `delete`; absent for `insert`) |
| `after` | Row state after the change (`insert`, `update`, `r`; absent for `delete`) |
| `source` | Source name |
| `lsn` | Log sequence number of the change |
| `commit_lsn` | LSN of the committing transaction (when applicable) |
| `xid` | Transaction ID (when applicable) |

`before` and `after` are row maps keyed by column name.

## Errors

| Condition | Kind |
|-----------|------|
| No context / no process PID | `errors.INTERNAL` |
| Source name required | `errors.INVALID` |
| Invalid buffer size | `errors.INVALID` |
| Source not found | `errors.INTERNAL` |

See [Error Handling](lua/core/errors.md) for working with errors.

## See Also

- [Change Data Capture](system/cdc.md) - `db.cdc.postgres` source configuration
- [Channel](lua/core/channel.md) - Channel semantics
- [Database](system/database.md) - SQL database services
