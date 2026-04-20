# Lua Entry Kinds

Configuration for Lua-based entries: functions, processes, workflows, and libraries.

## Entry Kinds

| Kind | Description |
|------|-------------|
| `function.lua` | Stateless function, runs on demand |
| `process.lua` | Long-running actor with state |
| `workflow.lua` | Durable workflow (Temporal) |
| `library.lua` | Shared code imported by other entries |
| `module.lua` | Module surface (multi-method library) |

Each kind has a precompiled bytecode counterpart (`function.lua.bc`, `library.lua.bc`, `process.lua.bc`, `workflow.lua.bc`) produced by `wippy pack --bytecode`. Authors write `.lua` entries; the bytecode kinds are emitted automatically when packing.

## Common Fields

All Lua entries share these fields:

| Field | Required | Description |
|-------|----------|-------------|
| `name` | yes | Unique name within namespace |
| `kind` | yes | One of the Lua kinds above |
| `source` | yes | Lua file path (`file://path.lua`) |
| `method` | function/process/workflow | Function to export (libraries don't use it) |
| `modules` | no | Allowed modules for `require()` |
| `imports` | no | Other entries as local modules |
| `meta` | no | Searchable metadata |

## function.lua

Stateless function called on demand. Each invocation is independent.

```yaml
- name: handler
  kind: function.lua
  source: file://handler.lua
  method: main
  modules:
    - http
    - json
```

Use for: HTTP handlers, data transformations, utilities.

## process.lua

Long-running actor that maintains state across messages. Communicates via message passing.

```yaml
- name: worker
  kind: process.lua
  source: file://worker.lua
  method: main
  modules:
    - process
    - sql
```

Use for: Background workers, service daemons, stateful actors.

To run as a supervised service:

```yaml
- name: worker_service
  kind: process.service
  process: app:worker
  host: app:processes
  lifecycle:
    auto_start: true
    restart:
      max_attempts: 10
```

## workflow.lua

Durable workflow that survives restarts. State is persisted to Temporal.

```yaml
- name: order_processor
  kind: workflow.lua
  source: file://order_workflow.lua
  method: main
  modules:
    - workflow
    - time
```

Use for: Multi-step business processes, long-running orchestrations.

## library.lua

Shared code that can be imported by other entries.

```yaml
- name: helpers
  kind: library.lua
  source: file://helpers.lua
  modules:
    - json
    - base64
```

Other entries reference it via `imports`:

```yaml
- name: handler
  kind: function.lua
  source: file://handler.lua
  method: main
  imports:
    helpers: app.lib:helpers
```

In Lua code:

```lua
local helpers = require("helpers")
helpers.format_date(timestamp)
```

## Modules

The `modules` field controls which modules can be loaded with `require()`:

```yaml
modules:
  - http
  - json
  - sql
  - process
```

`channel`, `print`, `subscribe`, and `unsubscribe` are loaded as Lua globals — they don't need to appear in `modules:`.

Only listed modules are available. This provides:
- Security: Prevent access to system modules
- Explicit dependencies: Clear what code needs
- Determinism: Workflows only get deterministic modules

See [Lua Runtime](lua/overview.md) for available modules.

## Imports

Import other entries as local modules:

```yaml
imports:
  utils: app.lib:utils       # require("utils")
  auth: app.auth:helpers     # require("auth")
```

The key becomes the module name in Lua code. The value is the entry ID (`namespace:name`).

## Pool Configuration

Configure execution pool for functions:

```yaml
- name: handler
  kind: function.lua
  source: file://handler.lua
  method: main
  pool:
    type: adaptive    # default
    size: 4           # initial workers
    max_size: 16      # cap for elastic pools
```

| Field | Pools | Description |
|-------|-------|-------------|
| `type` | all | Scheduler implementation (see table below) |
| `size` | static, lazy, adaptive | Initial worker count |
| `workers` | engine v2 | Worker thread count |
| `buffer` | static, adaptive | Task queue capacity (default: `workers * 64`) |
| `warm_start` | adaptive | Precompile entries at startup |
| `max_size` | lazy, adaptive | Upper bound for elastic growth (default: 16) |

| Type | Behavior |
|------|----------|
| `inline` | Synchronous execution in caller's goroutine. Lowest latency, no isolation between calls. |
| `lazy` | Zero idle workers, spawn on demand, tear down when idle. |
| `static` | Fixed-size channel-based pool. Predictable under steady load. |
| `adaptive` | Auto-scaling pool — grows under load, shrinks when idle. Default. |

## Metadata

Use `meta` for routing and discovery:

```yaml
- name: api_handler
  kind: function.lua
  meta:
    type: handler
    version: "2.0"
    tags: [api, users]
  source: file://api.lua
  method: handle
  modules:
    - http
    - json
```

Metadata is searchable via the registry:

```lua
local registry = require("registry")
local handlers = registry.find({type = "handler"})
```

## See Also

- [Entry Kinds](guides/entry-kinds.md) - All entry kinds reference
- [Compute Units](concepts/compute-units.md) - Functions vs processes vs workflows
- [Lua Runtime](lua/overview.md) - Available modules
