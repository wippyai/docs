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
| `system.read` | `modules` | List loaded modules |
| `system.read` | `supervisor` | Read supervisor state |
| `system.exit` | - | Trigger system shutdown |

## Errors

| Condition | Kind | Retryable |
|-----------|------|-----------|
| Permission denied | `errors.PERMISSION_DENIED` | no |
| Invalid argument | `errors.INVALID` | no |
| Missing required argument | `errors.INVALID` | no |
| Code manager unavailable | `errors.INTERNAL` | no |
| Service info unavailable | `errors.INTERNAL` | no |
| OS error getting hostname | `errors.INTERNAL` | no |

See [Error Handling](lua/core/errors.md) for working with errors.
