---
title: "Dataflow: Run a Durable DAG"
description: "Build and run a small wippy/dataflow workflow with persisted state, automatic migrations, and two function nodes."
---

# Dataflow: Run a Durable DAG

**Classification: runnable tutorial.** This page builds a complete, provider-free
`wippy/dataflow` project. It does not use embeddings or an LLM; for that use case,
see [Retrieval-Augmented Generation](./rag.md).

The workflow sends one input through two function nodes:

```text
{ values = { 2, 4, 6 } } -> double -> summarize -> { count = 3, total = 24 }
```

Dataflow persists the workflow, nodes, commands, wakes, and activations in SQL.
The command waits for the migration bootloader to create those tables before it
starts the flow.

## Prerequisites

- A Wippy project whose source directory is `./src`.
- Wippy runtime `v0.3.32a` or newer.
- Access to the module registry for the initial dependency install.

No model provider or API key is required.

## Project Structure

```text
dataflow-demo/
├── wippy.lock                 # generated
└── src/
    ├── _index.yaml
    ├── double.lua
    ├── summarize.lua
    └── run.lua
```

## Configure the Runtime

Create `src/_index.yaml`:

```yaml
version: "1.0"
namespace: app

entries:
  - name: db
    kind: db.sql.sqlite
    file: ./.wippy/dataflow.db
    lifecycle:
      auto_start: true

  - name: env_storage
    kind: env.storage.file
    file_path: ./.wippy/dataflow.env
    auto_create: true

  - name: processes
    kind: process.host
    lifecycle:
      auto_start: true

  # Dataflow includes session views, so its standalone configuration supplies
  # the router those transitive entries target. The HTTP service need not start.
  - name: gateway
    kind: http.service
    addr: ":18080"
    lifecycle:
      auto_start: false

  - name: api.public
    kind: http.router
    meta:
      server: app:gateway
    prefix: /api/public

  - name: api
    kind: http.router
    meta:
      server: app:gateway
    prefix: /api

  - name: dep.dataflow
    kind: ns.dependency
    component: wippy/dataflow
    version: "0.7.6"
    parameters:
      - name: userspace.dataflow:target_db
        value: app:db
      - name: userspace.dataflow:process_host
        value: app:processes
      - name: wippy.migration:app_db
        value: app:db

  - name: dep.security
    kind: ns.dependency
    component: wippy/security
    version: "*"

  - name: dep.bootloader
    kind: ns.dependency
    component: wippy/bootloader
    version: "*"
    parameters:
      - name: wippy.bootloader:application_host
        value: app:processes
      - name: wippy.bootloader:env_storage
        value: app:env_storage

  - name: dep.llm
    kind: ns.dependency
    component: wippy/llm
    version: "*"
    parameters:
      - name: wippy.llm:process_host
        value: app:processes
      - name: wippy.llm:env_storage
        value: app:env_storage

  - name: dep.session
    kind: ns.dependency
    component: wippy/session
    version: "*"
    parameters:
      - name: wippy.session:database_resource
        value: app:db
      - name: wippy.session:api_router
        value: app:api.public
      - name: wippy.session:env_storage
        value: app:env_storage
      - name: wippy.session:delegation_func_id
        value: userspace.dataflow.session:delegate

  - name: dep.views
    kind: ns.dependency
    component: wippy/views
    version: "*"
    parameters:
      - name: wippy.views:api_router
        value: app:api.public
      - name: wippy.views:env_storage
        value: app:env_storage

  - name: demo_policy
    kind: security.policy
    policy:
      actions: "*"
      resources: "*"
      effect: allow

  - name: double
    kind: function.lua
    source: file://double.lua
    method: handler

  - name: summarize
    kind: function.lua
    source: file://summarize.lua
    method: handler

  - name: run
    kind: process.lua
    meta:
      command:
        name: dataflow-demo
        short: Run the Dataflow tutorial DAG
        security:
          actor:
            id: app:dataflow-demo
          policies:
            - app:demo_policy
    source: file://run.lua
    method: main
    modules:
      - io
      - sql
      - time
    imports:
      flow: userspace.dataflow.flow:flow
```

`wippy/dataflow` owns the migration entries. The `wippy/migration` dependency is
transitive, while `wippy/bootloader` runs its migration bootloader during runtime
startup. The explicit parameters above bind both systems to `app:db`.

The broad policy keeps this isolated tutorial focused on workflow behavior.
Production commands should replace it with the exact function, database, and
process actions the workflow needs.

## Implement the Nodes

Create `src/double.lua`:

```lua
local function handler(input)
    local result = { values = {} }
    for _, value in ipairs(input.values or {}) do
        table.insert(result.values, value * 2)
    end
    return result
end

return { handler = handler }
```

Create `src/summarize.lua`:

```lua
local function handler(input)
    local total = 0
    for _, value in ipairs(input.values or {}) do
        total = total + value
    end
    return { count = #(input.values or {}), total = total }
end

return { handler = handler }
```

## Build and Run the Flow

Create `src/run.lua`:

```lua
local io = require("io")
local sql = require("sql")
local time = require("time")
local flow = require("flow")

local function wait_for_schema()
    for _ = 1, 100 do
        local db, err = sql.get("app:db")
        if not err then
            local rows, query_err = db:query(
                "SELECT name FROM sqlite_master " ..
                "WHERE type='table' AND name='dataflows'"
            )
            db:release()
            if not query_err and rows and #rows > 0 then
                return true
            end
        end
        time.sleep("100ms")
    end
    return nil, "Dataflow migrations did not finish within 10 seconds"
end

local function main()
    local ready, ready_err = wait_for_schema()
    if not ready then
        io.print("dataflow failed: " .. ready_err)
        return 1
    end

    local result, err = flow.create()
        :with_title("Double and summarize")
        :with_input({ values = { 2, 4, 6 } })
        :func("app:double")
        :as("double")
        :to("summarize", "default")
        :func("app:summarize")
        :as("summarize")
        :run()

    if err then
        io.print("dataflow failed: " .. tostring(err))
        return 1
    end

    io.print(string.format("count=%d total=%d", result.count, result.total))
    return 0
end

return { main = main }
```

Initialize the lock, resolve the dependency graph, install it, and run the named
command with console logs enabled:

```bash
wippy init
wippy update
wippy install
wippy run -c dataflow-demo
```

On the first run, the bootloader applies the Dataflow migrations. The command
then prints:

```text
count=3 total=24
```

Later runs report the migrations as already applied and execute a new persisted
workflow.

## Verify Persistence

The SQLite file is `./.wippy/dataflow.db`. After a successful run it contains
the module-owned Dataflow tables, including workflow, node, data, commit, wake,
and activation storage. Applications should inspect these through the Dataflow
client or Keeper rather than writing the tables directly.

Use `:start()` instead of `:run()` when the caller should receive a workflow ID
immediately. Use the Dataflow client to read status/output or to cancel,
terminate, revive, or signal an asynchronous workflow.

## Next Steps

- [Dataflow Framework](../framework/dataflow.md) — routing, parallel nodes,
  cycles, agents, signals, and the client API
- [Retrieval-Augmented Generation](./rag.md) — embeddings-backed retrieval
- [Keeper over MCP](./keeper-mcp.md) — inspect running workflows from an MCP client
