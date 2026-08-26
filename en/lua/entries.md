---
title: "Lua Entry Kinds"
description: "Configuration for Lua-based entries: functions, processes, workflows, and libraries."
---

# Lua Entry Kinds

Lua entry kinds define how source code is loaded and executed as a function, process, workflow, library, or module surface.

## Entry Kinds

| Kind | Description |
|------|-------------|
| `function.lua` | Stateless function, runs on demand |
| `process.lua` | Long-running actor with state |
| `workflow.lua` | Durable workflow (Temporal) |
| `library.lua` | Shared code imported by other entries |
| `module.lua` | Module surface (multi-method library) |

Each kind has a precompiled bytecode counterpart (`function.lua.bc`, `library.lua.bc`, `process.lua.bc`, `workflow.lua.bc`) produced by `wippy pack --bytecode '**'` (or a pattern like `--bytecode 'app:**'`). Authors write `.lua` entries; the bytecode kinds are emitted when packing with that flag.

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

## `function.lua`

A `function.lua` entry runs on demand, with each invocation handled independently.

```yaml
- name: handler
  kind: function.lua
  source: file://handler.lua
  method: main
  modules:
    - http
    - json
```

Typical uses include HTTP handlers, data transformations, and utilities.

## `process.lua`

A `process.lua` entry is a long-running actor that maintains state and communicates through messages.

```yaml
- name: worker
  kind: process.lua
  source: file://worker.lua
  method: main
  modules:
    - process
    - sql
```

Typical uses include background workers, service daemons, and stateful actors.

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

## `workflow.lua`

A `workflow.lua` entry defines a durable workflow whose state is persisted to Temporal.

```yaml
- name: order_processor
  kind: workflow.lua
  source: file://order_workflow.lua
  method: main
  modules:
    - workflow
    - time
```

Typical uses include multi-step business processes and long-running orchestration.

## `library.lua`

A `library.lua` entry provides shared code that other entries can import.

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

Only listed modules are available. The allowlist limits access to system modules, makes dependencies explicit, and restricts workflows to deterministic modules.

See [Lua Runtime](lua/overview.md) for available modules.

## Imports

Import other entries as local modules:

```yaml
imports:
  utils: app.lib:utils       # require("utils")
  auth: app.auth:helpers     # require("auth")
```

The key becomes the module name in Lua code. The value is the entry ID (`namespace:name`).

## Function Pools

Use `pool` to configure how a function entry executes:

```yaml
- name: handler
  kind: function.lua
  source: file://handler.lua
  method: main
  pool:
    type: adaptive    # explicit; omit to use auto-select (lazy)
    max_size: 16      # cap for elastic growth
```

| Field | Pools | Description |
|-------|-------|-------------|
| `type` | all | Scheduler implementation (see table below) |
| `workers` | static | Worker thread count (falls back to `size`, then 8) |
| `size` | static | Worker count when `workers` is unset; also steers auto-select toward a static pool |
| `buffer` | static | Task queue capacity (default: `workers * 64`) |
| `max_size` | lazy, adaptive | Upper bound for elastic growth (default: 16) |

| Type | Behavior |
|------|----------|
| `inline` | Synchronous execution in the caller's goroutine. No isolation between calls. |
| `lazy` | Zero idle workers, spawn on demand, tear down when idle. |
| `static` | Fixed-size channel-based pool. Predictable under steady load. |
| `adaptive` | Auto-scaling pool — grows under load, shrinks when idle. |

When `type` is omitted, the runtime selects a lazy pool by default or a static pool when `workers` is set.

## Metadata

Use `meta` to attach searchable routing and discovery fields:

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
local handlers = registry.find({["meta.type"] = "handler"})
```

## See Also

- [Entry Kinds](guides/entry-kinds.md) - Reference for all entry kinds
- [Compute Units](concepts/compute-units.md) - Functions vs processes vs workflows
- [Lua Runtime](lua/overview.md) - Available modules
