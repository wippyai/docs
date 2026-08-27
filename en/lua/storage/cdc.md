---
title: "CDC"
description: "Subscribe to PostgreSQL change data capture streams and receive row-level events."
---

# CDC
<secondary-label ref="storage"/>
<secondary-label ref="stream"/>
<secondary-label ref="nondeterministic"/>

The `cdc` module subscribes to PostgreSQL change data capture streams from [`db.cdc.postgres`](system/cdc.md) sources. It lists configured sources, opens streams, and delivers row-level change events through channels.

## Loading

```lua
local cdc = require("cdc")
```

## `list_sources`

List the configured CDC sources:

```lua
local sources, err = cdc.list_sources()
for _, s in ipairs(sources) do
    print(s.name, s.slot, s.streaming)
end
```

Each source is a table: `name`, `slot`, `publication`, `tables`, `streaming`, `failover`, `temporary`, `snapshot`. See [CDC sources](system/cdc.md#source-info).

**Returns:** `table, error`

## `source`

Retrieve one source by its registry entry ID or replication slot name:

```lua
local info, err = cdc.source("app:pg_cdc")
if info == nil then
    -- no such source
end
```

**Returns:** `table, error` (source info, or `nil` if not found)

## `stream`

Open a change stream on a source. The returned `cdc.Stream` exposes a channel that delivers change events:

```lua
local stream, err = cdc.stream("app:pg_cdc", {
    tables = { "public.users", "public.orders" },
    ops    = { "insert", "update" },
    buffer = 128,
})
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `name` | string | Source registry ID or replication slot name |
| `opts.tables` | []string | Filter to these tables (omit for all configured tables) |
| `opts.ops` | []string | Filter to these operations: `insert`, `update`, `delete`, `truncate` |
| `opts.buffer` | int | Source subscription buffer size (1-65536; default: 128) |

**Returns:** `Stream, error`

The Lua delivery channel has a separate fixed capacity of 64. The `buffer` option controls the PostgreSQL source subscription, not that channel.

## Stream Methods

### `channel`

Return the channel that receives change events. The first call subscribes to the source and yields; subsequent calls return the same channel. `:receive()` blocks until the next change arrives or returns `nil` when the stream ends:

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

### `close`

Stop the subscription and release the stream. The method is idempotent, and the runtime also closes the stream at the end of the task scope. `release` is an alias for `close`.

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
| Source not found when opening a stream | `errors.NOT_FOUND` |
| Source inspector or process context unavailable | `errors.INTERNAL` |

See [Error Handling](lua/core/errors.md) for working with errors.

## See Also

- [Change Data Capture](system/cdc.md) - `db.cdc.postgres` source configuration
- [Channel](lua/core/channel.md) - Channel semantics
- [Database](system/database.md) - SQL database services
