---
title: "Lua Entry Kinds"
description: "Configuration for Lua-based entries: functions, processes, workflows, and libraries."
---

# Lua Entry Kinds

Lua entry kinds define how source code is loaded and executed as a function, process, workflow, or library.

## Entry Kinds

| Kind | Description |
|------|-------------|
| `function.lua` | Stateless function, runs on demand |
| `process.lua` | Long-running actor with state |
| `workflow.lua` | Durable workflow (Temporal) |
| `library.lua` | Shared code imported by other entries |

Each kind has a precompiled bytecode counterpart (`function.lua.bc`, `library.lua.bc`, `process.lua.bc`, `workflow.lua.bc`) produced by `wippy pack --bytecode '**'` (or a pattern like `--bytecode 'app:**'`). Authors write `.lua` entries; the bytecode kinds are emitted when packing with that flag.

`module.lua` is reserved for built-in module definitions created by the runtime. It is not an authorable source entry and has no bytecode counterpart.

## Common Fields

All Lua entries share these fields:

| Field | Required | Description |
|-------|----------|-------------|
| `name` | yes | Unique name within namespace |
| `kind` | yes | One of the Lua kinds above |
| `source` | yes | Inline Lua source or a `file://path.lua` reference resolved when the registry is loaded |
| `method` | function/process/workflow | Function to export (libraries don't use it) |
| `modules` | no | Allowed modules for `require()` |
| `imports` | no | Other entries as local modules |
| `meta` | no | Searchable metadata |

`pool` applies only to `function.lua`. `security` applies to `function.lua` and `process.lua`.

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

Use functions for HTTP handlers, data transformations, and utilities.

## `process.lua`

A `process.lua` entry is a long-running actor that maintains state and communicates through messages.

```yaml
- name: worker
  kind: process.lua
  source: file://worker.lua
  method: main
  modules:
    - sql
```

Choose a process for background workers, service daemons, and stateful actors.

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

Use workflows for multi-step business processes and long-running orchestration.

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
```

`channel`, `payload`, `print`, `process`, `subscribe`, and `unsubscribe` are loaded as Lua globals — they don't need to appear in `modules:`. `require("process")` is also allowed without a `modules:` declaration.

Only listed built-in modules and aliases declared under `imports` are available. The module allowlist limits access to runtime capabilities, makes dependencies explicit, and restricts workflows to workflow-compatible module classes.

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
| `workers` | static | Worker count; when set, `size` must also be positive during configuration validation |
| `size` | static | Worker count when `workers` is unset; with omitted `type`, a positive `size` alone selects `inline` |
| `buffer` | static | Task queue capacity (default: `workers * 64`) |
| `max_size` | lazy, adaptive | Upper bound for elastic growth (default: 16 for an explicit type) |
| `warm_start` | all | Accepted configuration flag; it has no effect in this runtime release |

| Type | Behavior |
|------|----------|
| `inline` | Synchronous execution in the caller's goroutine. No isolation between calls. |
| `lazy` | Zero idle workers, spawn on demand, tear down when idle. |
| `static` | Fixed-size channel-based pool. Predictable under steady load. |
| `adaptive` | Auto-scaling pool — grows under load, shrinks when idle. |

When `type` is omitted, the runtime selects:

- `static` when `workers` is positive;
- `lazy` when `workers` is zero and either `size` is zero or `max_size` is positive; or
- `inline` when `size` is positive and `max_size` is zero.

The auto-selected lazy pool uses `max_size` when positive and otherwise defaults to 100. An explicit `lazy` or `adaptive` pool defaults `max_size` to 16. An explicit `static` pool uses `workers`, then `size`, then 8; its default buffer is the selected worker count multiplied by 64.

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
