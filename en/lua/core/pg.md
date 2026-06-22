# Process Groups
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="permissions"/>

Join processes into named groups and broadcast to every member across the cluster. Modeled on Erlang/OTP `pg`: groups are dynamic, a process can belong to many groups, and membership is tracked cluster-wide and is eventually consistent.

For the scope entry kind and its configuration, see [Process Groups](system/process-groups.md). For the broader clustering model, see the [Cluster Guide](guides/cluster.md).

## Loading

```lua
local pg = require("pg")
```

## Opening a Scope

A process group lives inside a **scope** — a `pg.scope` registry entry. Open it to get an instance you operate on:

```lua
local group, err = pg.open("app:pg")
if err then
    return nil, err
end
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Scope entry ID (format: `"namespace:name"`) |

**Returns:** `pg.Instance, error`

**Permission:** `pg.open` on the scope `id`

The instance is released automatically when the process exits; call `release()` to free it earlier. All other operations are methods on the instance, called with `:`.

## Joining and Leaving

```lua
local ok, err = group:join("workers")           -- single group
local ok, err = group:join({"workers", "all"})  -- batch
local ok, err = group:leave("workers")
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `group` | string \| string[] | Group name, or a list of names for a batch operation |

**Returns:** `boolean, error`

A process may join the same group more than once; it must leave the same number of times to fully depart (multi-join semantics). `leave` is best-effort across a batch and returns an error only when the process was a member of none of the named groups.

**Permissions:** `pg.join` / `pg.leave` on each group name

## Listing Members

```lua
local members, err = group:get_members("workers")        -- all nodes
local local_members, err = group:get_local_members("workers")  -- this node only
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `group` | string | Group name |

**Returns:** `string[], error` — an array of PID strings (empty for an unknown group)

**Permissions:** `pg.get_members` / `pg.get_local_members` on the group name

## Listing Groups

```lua
local groups, err = group:which_groups()         -- all groups in the cluster
local local_groups, err = group:which_local_groups()  -- groups with a local member
```

**Returns:** `string[], error` — group names that currently have at least one member

**Permissions:** `pg.which_groups` / `pg.which_local_groups`

## Broadcasting

Send a message to every member of a group. Each member receives it under `topic` from the calling process — handle it with `process.listen(topic)`.

```lua
local ok, err = group:broadcast("workers", "task", {id = 42})   -- all nodes
local ok, err = group:broadcast_local("workers", "task", {id = 42})  -- this node only
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `group` | string | Target group |
| `topic` | string | Message topic |
| `...` | any | Zero or more payload values |

**Returns:** `boolean, error`

**Permissions:** `pg.broadcast` / `pg.broadcast_local` on the group name

## Monitoring a Group

`monitor` subscribes to join/leave events for one group and returns the current members atomically — no membership change can slip between the snapshot and the subscription.

```lua
local sub, members, err = group:monitor("workers")
if err then
    return nil, err
end

for _, pid in ipairs(members) do
    -- current members at subscription time
end

local ch = sub:channel()
local event = ch:receive()  -- {kind = "member.joined" | "member.left", path = "workers", data = {...}}

sub:close()  -- unsubscribe; sub:close({flush = true}) drains queued events first
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `group` | string | Group to watch |

**Returns:** `pg.Subscription, string[], error` — the subscription and a snapshot of current members

**Permission:** `pg.monitor` on the group name

## Watching All Groups

`events` subscribes to membership changes across every group in the scope and returns a snapshot of all groups to their members.

```lua
local sub, snapshot, err = group:events()
-- snapshot: { ["workers"] = {pid, ...}, ["all"] = {pid, ...} }

local event = sub:channel():receive()
sub:close()
```

**Returns:** `pg.Subscription, table, error`

**Permission:** `pg.events`

### Event Fields

Events delivered on a subscription channel carry:

| Field | Type | Description |
|-------|------|-------------|
| `system` | string | Always `"pg"` |
| `kind` | string | `"member.joined"` or `"member.left"` |
| `path` | string | The group name |
| `data` | table | `{Group = string, PIDs = string[]}` — the affected members |

Subscription channels are buffered (capacity 64). If a slow consumer fills the buffer, further events are retained in the process mailbox in order and delivered once the consumer drains the channel (the subscription stalls rather than dropping events).

## Releasing

```lua
group:release()
```

Frees the instance immediately. Idempotent; after release, every method returns an error. Cleanup also runs automatically when the process exits.

**Returns:** `boolean`

## Permissions

| Permission | Method | Resource |
|------------|--------|----------|
| `pg.open` | `pg.open()` | scope id |
| `pg.join` | `join()` | group name |
| `pg.leave` | `leave()` | group name |
| `pg.get_members` | `get_members()` | group name |
| `pg.get_local_members` | `get_local_members()` | group name |
| `pg.which_groups` | `which_groups()` | (scope) |
| `pg.which_local_groups` | `which_local_groups()` | (scope) |
| `pg.broadcast` | `broadcast()` | group name |
| `pg.broadcast_local` | `broadcast_local()` | group name |
| `pg.monitor` | `monitor()` | group name |
| `pg.events` | `events()` | (scope) |

## Errors

| Condition | Kind |
|-----------|------|
| Permission denied | `errors.PERMISSION_DENIED` |
| Missing or empty argument | `errors.INVALID` |
| Scope not found | `errors.INTERNAL` |
| Leave a group with no membership | `errors.INVALID` |
| Instance released | `errors.INVALID` |

See [Error Handling](lua/core/errors.md) for working with errors.

## See Also

- [Process Groups](system/process-groups.md) - Scope entry kind and configuration
- [Cluster](guides/cluster.md) - Membership, naming, and the clustering model
- [Process Management](lua/core/process.md) - Spawning and messaging individual processes
