---
title: "System"
---

# System
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="permissions"/>

Query runtime system information including memory usage, garbage collection stats, CPU details, and process metadata.

## Loading

```lua
local system = require("system")
```

## Shutdown

Trigger system shutdown with exit code. Useful for terminal apps; calling from running actors will terminate the entire system:

```lua
local ok, err = system.exit(0)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `code` | integer | Exit code (0 = success), defaults to 0 |

**Returns:** `boolean, error`

## Listing Modules

Get all loaded Lua modules with metadata:

```lua
local mods, err = system.modules()
```

**Returns:** `table[], error`

Each module table contains:

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Module name |
| `description` | string | Module description |
| `class` | string[] | Module classification tags |

## Memory Statistics

Get detailed memory statistics:

```lua
local stats, err = system.memory.stats()
```

**Returns:** `table, error`

Stats table contains:

| Field | Type | Description |
|-------|------|-------------|
| `alloc` | number | Bytes allocated and in use |
| `total_alloc` | number | Cumulative bytes allocated |
| `sys` | number | Bytes obtained from system |
| `heap_alloc` | number | Bytes allocated on heap |
| `heap_sys` | number | Bytes obtained for heap from system |
| `heap_idle` | number | Bytes in idle spans |
| `heap_in_use` | number | Bytes in non-idle spans |
| `heap_released` | number | Bytes released to OS |
| `heap_objects` | number | Number of allocated heap objects |
| `stack_in_use` | number | Bytes used by stack allocator |
| `stack_sys` | number | Bytes obtained for stack from system |
| `mspan_in_use` | number | Bytes of mspan structures in use |
| `mspan_sys` | number | Bytes obtained for mspan from system |
| `num_gc` | number | Number of completed GC cycles |
| `next_gc` | number | Target heap size for next GC |

## Current Allocation

Get bytes currently allocated:

```lua
local bytes, err = system.memory.allocated()
```

**Returns:** `number, error`

## Heap Objects

Get number of allocated heap objects:

```lua
local count, err = system.memory.heap_objects()
```

**Returns:** `number, error`

## Memory Limit

Set memory limit (returns previous value):

```lua
local prev, err = system.memory.set_limit(1024 * 1024 * 100)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `limit` | integer | Memory limit in bytes, -1 for unlimited |

**Returns:** `number, error`

Get current memory limit:

```lua
local limit, err = system.memory.get_limit()
```

**Returns:** `number, error`

## Force GC

Force garbage collection:

```lua
local ok, err = system.gc.collect()
```

**Returns:** `boolean, error`

## GC Target Percentage

Set GC target percentage (returns previous value). A value of 100 means GC triggers when heap doubles:

```lua
local prev, err = system.gc.set_percent(200)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `percent` | integer | GC target percentage |

**Returns:** `number, error`

Get current GC target percentage:

```lua
local percent, err = system.gc.get_percent()
```

**Returns:** `number, error`

## Goroutine Count

Get number of active goroutines:

```lua
local count, err = system.runtime.goroutines()
```

**Returns:** `number, error`

## GOMAXPROCS

Get or set GOMAXPROCS value:

```lua
-- Get current value
local current, err = system.runtime.max_procs()

-- Set new value
local prev, err = system.runtime.max_procs(4)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `n` | integer | If provided, sets GOMAXPROCS (must be > 0) |

**Returns:** `number, error`

## CPU Count

Get number of logical CPUs:

```lua
local cpus, err = system.runtime.cpu_count()
```

**Returns:** `number, error`

## Process ID

Get current process ID:

```lua
local pid, err = system.process.pid()
```

**Returns:** `number, error`

## Hostname

Get system hostname:

```lua
local hostname, err = system.process.hostname()
```

**Returns:** `string, error`

## Working Directory

Get the runtime's current working directory:

```lua
local dir, err = system.process.cwd()
```

**Returns:** `string, error`

## Process Hosts

List all process hosts with worker and queue statistics:

```lua
local hosts, err = system.hosts.list()
```

**Returns:** `table[], error`

Each host table contains:

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Host registry ID |
| `workers` | number | Worker pool size |
| `processes` | number | Active processes on this host |
| `executed` | number | Total steps executed |
| `stolen` | number | Steps stolen from other hosts |
| `queue_depth` | number | Pending items in the host queue |

List processes running on a specific host:

```lua
local procs, err = system.hosts.processes("app:host")
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `host_id` | string | Host registry ID |

**Returns:** `table[], error`

Each process table contains:

| Field | Type | Description |
|-------|------|-------------|
| `pid` | string | Process ID |
| `host` | string | Host ID |
| `source` | string | Source entry ID |
| `state` | string | Process state |
| `steps` | number | Steps executed |
| `started_at` | number | Start timestamp (nanoseconds) |
| `parent` | string | Parent PID (omitted if none) |
| `actor_id` | string | Actor ID (omitted if none) |
| `stats` | table | Process-specific stats (optional) |

## Service State

Get state for a specific supervised service:

```lua
local state, err = system.supervisor.state("namespace:service")
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `service_id` | string | Service ID (e.g., "namespace:service") |

**Returns:** `table, error`

State table contains:

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Service ID |
| `status` | string | Current status |
| `desired` | string | Desired status |
| `retry_count` | number | Number of retries |
| `last_update` | number | Last update timestamp (nanoseconds) |
| `started_at` | number | Start timestamp (nanoseconds) |
| `details` | string | Optional details (formatted) |

## All Service States

Get states for all supervised services:

```lua
local states, err = system.supervisor.states()
```

**Returns:** `table[], error`

Each state table has the same format as `system.supervisor.state()`.

## Cluster primitives

The `system.node`, `system.cluster`, `system.raft`, and `system.lock` sub-tables expose the clustering layer. They are most useful when [clustering is enabled](guides/cluster.md); on a standalone node they degrade predictably — `system.raft.*` reports "raft not available", `system.cluster` reports just the local node, and `system.lock` requires the global registry that clustering provides.

All read calls are local and cheap: they report this node's view of committed state, never blocking on the network.

### Node identity

`system.node` reports this node's own identity in the cluster.

```lua
local id, err = system.node.id()      -- this node's ID
local addr, err = system.node.addr()  -- advertised network address
local role, err = system.node.role()  -- "leader" | "voter" | "standby" | "non-member"
```

| Function | Returns | Notes |
|----------|---------|-------|
| `system.node.id()` | `string, error` | Node ID from the relay context |
| `system.node.addr()` | `string, error` | Advertised address (e.g. `10.0.0.1:7946`); errors if membership is unavailable |
| `system.node.role()` | `string, error` | Raft role of this node; returns `"non-member"` (no error) when Raft is not running |

**Permission:** `system.read` on `node`.

### Cluster membership

`system.cluster` reports the cluster-wide view: who the members are and who leads.

```lua
local members, err = system.cluster.members()  -- array of node tables
local leader, err = system.cluster.leader()    -- leader node ID, or "" if unknown
local n, err = system.cluster.size()           -- count of visible members
```

`system.cluster.members()` returns an array of node tables. The local node is included once and sorts first.

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Node ID |
| `is_local` | boolean | True for the calling node |
| `addr` | string | Advertised address (omitted when unknown) |
| `meta` | table | String-to-string gossip metadata (omitted when none) |

| Function | Returns | Notes |
|----------|---------|-------|
| `system.cluster.members()` | `table[], error` | Errors if no membership information is reachable |
| `system.cluster.leader()` | `string, error` | Current Raft leader's ID; `""` (no error) when the leader is unknown or Raft is absent |
| `system.cluster.size()` | `number, error` | Count of visible members; `0` when no membership info is available |

**Permission:** `system.read` on `cluster`.

### Raft state

`system.raft` reads this node's local view of the Raft consensus core. Every function returns `nil, error` ("raft not available") when Raft is not running on this node.

```lua
local leader, err = system.raft.is_leader()      -- boolean
local member, err = system.raft.is_member()      -- boolean: voter or standby
local role, err = system.raft.role()             -- same values as system.node.role()
local term, err = system.raft.term()             -- current Raft term
local idx, err = system.raft.commit_index()      -- highest committed log index
local stats, err = system.raft.stats()           -- raw stats map (string -> string)
```

| Function | Returns | Notes |
|----------|---------|-------|
| `system.raft.is_leader()` | `boolean, error` | True iff this node is the current leader |
| `system.raft.is_member()` | `boolean, error` | True iff this node is a voter or standby in the committed configuration |
| `system.raft.role()` | `string, error` | `"leader"` / `"voter"` / `"standby"` / `"non-member"` |
| `system.raft.term()` | `number, error` | Current term; `0` if unavailable from stats |
| `system.raft.commit_index()` | `number, error` | Highest committed log index on this node |
| `system.raft.stats()` | `table, error` | Full raw stats map; keys and values are strings |

**Permission:** `system.read` on `raft`, except `system.raft.stats()` which requires `system.read` on `raft_stats`.

### Distributed locks

`system.lock` provides cluster-wide mutual exclusion. A lock is a globally unique name owned by the calling process. It is built on the Strong name scope, so at most one holder can exist across the cluster, and the lock auto-releases when the holder process exits or its node leaves — there is no stuck lock to clean up.

```lua
local ok, err = system.lock.acquire("orders.migration")
if ok then
  -- critical section: only one holder cluster-wide
  system.lock.release("orders.migration")
end
```

Acquire is fail-fast: if the lock is already held it returns `false` immediately rather than blocking, so callers implement their own retry and backoff. Only the current holder can release; releasing a lock you do not hold is a safe no-op.

| Function | Returns | Outcomes |
|----------|---------|----------|
| `system.lock.acquire(name)` | `boolean, error` | `true, nil` acquired; `false, error` already held (kind `errors.ALREADY_EXISTS`); `nil, error` on failure |
| `system.lock.release(name)` | `boolean, error` | `true, nil` released; `false, nil` not held or held by another process; `nil, error` on failure |

| Parameter | Type | Description |
|-----------|------|-------------|
| `name` | string | Cluster-wide lock name |

**Permission:** `system.lock` on the lock `name` (so policy can restrict which names a caller may lock).

## Permissions

System operations are subject to security policy evaluation.

| Action | Resource | Description |
|--------|----------|-------------|
| `system.read` | `memory` | Read memory statistics |
| `system.read` | `memory_limit` | Read memory limit |
| `system.control` | `memory_limit` | Set memory limit |
| `system.read` | `gc_percent` | Read GC percentage |
| `system.gc` | `gc` | Force garbage collection |
| `system.gc` | `gc_percent` | Set GC percentage |
| `system.read` | `goroutines` | Read goroutine count |
| `system.read` | `gomaxprocs` | Read GOMAXPROCS |
| `system.control` | `gomaxprocs` | Set GOMAXPROCS |
| `system.read` | `cpu` | Read CPU count |
| `system.read` | `pid` | Read process ID |
| `system.read` | `hostname` | Read hostname |
| `system.read` | `cwd` | Read working directory |
| `system.read` | `hosts` | List hosts / host processes |
| `system.read` | `modules` | List loaded modules |
| `system.read` | `supervisor` | Read supervisor state |
| `system.read` | `node` | Read this node's identity |
| `system.read` | `cluster` | Read cluster membership and leader |
| `system.read` | `raft` | Read Raft state |
| `system.read` | `raft_stats` | Read the raw Raft stats map |
| `system.lock` | `<lock name>` | Acquire or release a distributed lock |
| `system.exit` | - | Trigger system shutdown |

## Errors

| Condition | Kind | Retryable |
|-----------|------|-----------|
| Permission denied | `errors.INVALID` | no |
| Invalid argument | `errors.INVALID` | no |
| Missing required argument | `errors.INVALID` | no |
| Code manager unavailable | `errors.INTERNAL` | no |
| Service info unavailable | `errors.INTERNAL` | no |
| OS error (hostname, cwd) | `errors.INTERNAL` | no |
| Raft not running on this node | `errors.INTERNAL` | no |
| Membership unavailable | `errors.INTERNAL` | no |
| Lock already held | `errors.ALREADY_EXISTS` | no |

See [Error Handling](lua/core/errors.md) for working with errors.
