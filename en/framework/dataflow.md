---
title: "Dataflow"
description: "Compose and run DAG workflows with Wippy Dataflow nodes, routing, persistence, signals, templates, and client APIs."
---

# Dataflow

The `wippy/dataflow` module orchestrates directed acyclic graph (DAG) workflows. Functions, agents, cycles, parallel processors, and other nodes exchange data through named, discriminator-keyed routes, while the orchestrator manages execution, persisted state, and recovery.

## Setup

Add the module to your project:

```bash
wippy add wippy/dataflow
wippy install
```

Declare the dependency:

```yaml
version: "1.0"
namespace: app

entries:
  - name: dep.dataflow
    kind: ns.dependency
    component: wippy/dataflow
    version: "*"
```

The dataflow module depends on `wippy/agent`, `wippy/llm`, `wippy/session`, `wippy/test`, and `wippy/migration`; `wippy install` resolves them. By default, the module uses `app:db` for workflow persistence and `app:processes` for its wake service. Provide those entries or override the `target_db` and `process_host` requirements. Dataflow migrations run through `wippy/migration`.

The module publishes an `env.variable` entry `userspace.dataflow.env:web_host_origin` (default `https://front.wippy.ai`) that downstream flows can read for building public URLs. Override it through the env router or a requirement.

## Flow Builder

The flow builder provides a fluent interface for composing workflows. Import it into the entry that defines the flow:

```yaml
imports:
  flow: userspace.dataflow.flow:flow
```

```lua
local flow = require("flow")
```

### Core API

```lua
flow.create()
    :with_title(title)
    :with_metadata(metadata)
    :with_input(data)
    :with_data(data)
    :[operation](config)
    :as(name)
    :to(target, input_key, transform)
    :error_to(target, input_key, transform)
    :when(condition)
    :run()   -- synchronous
    :start() -- asynchronous

flow.template()
    :[operations]...
```

### Linear Pipeline

Without explicit routes, nodes form a linear chain and each node's output becomes the next node's input:

```lua
local result, err = flow.create()
    :with_input({ text = "Hello world" })
    :func("app:tokenize")
    :func("app:translate", { args = { target_lang = "fr" } })
    :func("app:format_output")
    :run()
```

### Named Routing

Use `:as()` to name a node and `:to()` to route data to another node. A node needs a name when another route references it:

```lua
local result, err = flow.create()
    :with_input(task)
        :to("router")

    :func("app:router"):as("router")
        :to("context", "routing")
        :to("dev", "routing")

    :agent("app:context_agent"):as("context")
        :to("dev", "gathered_context")

    :agent("app:dev_agent"):as("dev")
        :to("@success")

    :run()
```

The second parameter to `:to()` is the **discriminator** — the input key at the receiving node. When a node receives multiple inputs, they are collected as a table keyed by discriminator.

### Workflow Input and Static Data

`:with_input()` is the single primary input to the workflow. `:with_data()` creates independent static data sources:

```lua
flow.create()
    :with_input(task)
        :to("router")

    :with_data(config):as("cfg")
        :to("dev", "config")
        :to("logger", "config")

    :with_data(branch):as("branch_data")
        :to("checker", "branch")

    :func("app:router"):as("router")
        :to("dev", "task")

    :func("app:dev"):as("dev")
        :to("@success")
        :error_to("@fail")

    :run()
```

Use `:with_input()` for external workflow data and `:with_data()` for configuration, constants, and reference data shared by multiple nodes. Static data uses reference optimization: the first route creates the data, and later routes create references.

### Conditional Routing

Use `:when()` after `:to()` to add conditions. Conditions evaluate against the node's output using `expr` syntax:

```lua
flow.create()
    :with_input(data)
    :func("app:classify"):as("classify")
        :to("handler_a"):when("output.category == 'a'")
        :to("handler_b"):when("output.category == 'b'")
        :to("fallback")
    :func("app:handler_a"):as("handler_a"):to("@success")
    :func("app:handler_b"):as("handler_b"):to("@success")
    :func("app:fallback"):as("fallback"):to("@success")
    :run()
```

Conditions can combine with inline transforms for more complex routing:

```lua
:func("app:decompose"):as("decompose")
    :to("@success", nil, "{passed: true, feedback: nil}"):when("len(output.items) == 0")
    :to("processor", "items", "output.items")
```

Conditional expressions support: comparisons (`output.score > 0.8`), logical operators (`output.valid && output.count > 5`), array functions (`len(output.items) > 0`, `any(output.errors, {.critical})`), string operations (`output.status contains 'success'`), and optional chaining (`output.data?.nested?.value`).

### Workflow Terminals

Route to `@success` or `@fail` to terminate the workflow explicitly. In nested contexts (cycles, parallel), terminals create node outputs instead of workflow outputs:

```lua
:func("app:final_step"):to("@success")
:func("app:handler"):error_to("@fail")
```

### Error Routing

Use `:error_to()` to route node errors to a handler. Errors can be routed as normal inputs to recovery nodes:

```lua
:agent("app:gpt_planner", { model = "gpt-5" }):as("gpt_planner")
    :to("consolidator", "gpt_plan")
    :error_to("consolidator", "gpt_plan")

:agent("app:claude_planner", { model = "claude-4-5-sonnet" }):as("claude_planner")
    :to("consolidator", "claude_plan")
    :error_to("consolidator", "claude_plan")

:agent("app:consolidator", {
    inputs = { required = { "gpt_plan", "claude_plan" } }
}):as("consolidator")
```

In this graph, both planners can run in parallel. A planner error follows the same route to the consolidator as its successful output.

## Input Merging

Input shape depends on route discriminators and whether the node defines `args`.

**Without args — single default input:**

```lua
:func("source"):to("target")
-- target receives: raw content (unwrapped)
```

**Without args — single named input:**

```lua
:func("source"):to("target", "task")
-- target receives: { task = content }
```

**Without args — multiple inputs:**

```lua
:func("source1"):to("target", "data")
:func("source2"):to("target", "config")
-- target receives: { data = content1, config = content2 }
```

**With args — inputs merge into base:**

```lua
:func("app:api_client", {
    args = { base_url = "https://api.com", timeout = 5000 }
})
-- with :to("api_client", "body") from upstream
-- api_client receives: { base_url = "https://api.com", timeout = 5000, body = content }
```

<note>
Nodes with <code>args</code> or string-form <code>input_transform</code> cannot receive inputs with the <code>"default"</code> discriminator. Use named discriminators with <code>:to(target, "input_key")</code> instead.
</note>

## Input Transforms

Transform data before it reaches a node:

```lua
-- String transform: single expression
:func("app:step", { input_transform = "input.nested.field" })

-- Table transform: named expressions
:func("app:step", {
    input_transform = {
        task = "inputs.task",
        config = "inputs.settings",
        priority = "output.score > 0.8 ? 'high' : 'normal'"
    }
})
```

Context variables available in transforms: `input` (workflow input), `inputs` (all incoming node inputs), `output` (current node's output when routing).

### Inline Route Transforms

The third parameter to `:to()` is an inline transform expression:

```lua
:func("source"):as("source")
    :to("target", nil, "output.data")
    :to("other", nil, "{passed: true, value: output.x}")
    :to("list", nil, "map(output.items, {.id})")
```

## Node Types

### Function Node

Executes a registered `function.lua` entry.

```lua
:func("app:my_function", {
    args = { key = "value" },
    inputs = { required = { "task", "config" } },
    context = { session_id = "abc" },
    input_transform = { task = "inputs.prompt" },
    metadata = { title = "Process Data" }
})
```

| Option | Type | Description |
|--------|------|-------------|
| `args` | table | Base arguments merged with node inputs |
| `inputs` | table | Input requirements: `{ required = {...}, optional = {...} }` |
| `context` | table | Execution context passed to function |
| `input_transform` | string/table | Expression to transform inputs |
| `metadata` | table | Node metadata (e.g., `{ title = "..." }`) |

If the function returns `{ _control = { commands = [...] } }`, the orchestrator spawns a child workflow. This is how nested flows work.

### Agent Node

Executes an agent with tool calling and an optional structured exit.

```lua
:agent("app:content_writer", {
    model = "gpt-5",
    inputs = { required = { "context", "content_plan", "analysis" } },
    arena = {
        prompt = "Write content based on the provided context.",
        max_iterations = 12,
        tool_calling = "any",
        exit_schema = {
            type = "object",
            properties = {
                content = { type = "string" },
                title = { type = "string" }
            },
            required = { "content", "title" }
        }
    },
    show_tool_calls = true,
    metadata = { title = "Content Writer" }
})
```

| Option | Type | Description |
|--------|------|-------------|
| `model` | string | Override model |
| `arena.prompt` | string | System prompt |
| `arena.max_iterations` | number | Max reasoning loops (default: 32) |
| `arena.min_iterations` | number | Min iterations before exit (default: 1) |
| `arena.tool_calling` | string | `"auto"`, `"any"` (requires `exit_schema`), `"none"` (rejects `exit_schema`) |
| `arena.tools` | array | Tool registry IDs |
| `arena.exit_schema` | table | JSON schema for structured exit |
| `arena.exit_func_id` | string | Function to validate exit output |
| `arena.context` | table | Additional context |
| `inputs` | table | Input requirements |
| `active_traits` | array | Override the selected agent's active traits; an empty array disables them for this node |
| `active_tools` | array | Override the selected agent's active tools; an empty array disables them for this node |
| `show_tool_calls` | boolean | Include tool calls in output |
| `input_transform` | string/table | Transform inputs |
| `metadata` | table | Node metadata |

**Dynamic agent selection:** Pass an empty string as agent ID and resolve it via `input_transform`:

```lua
:agent("", {
    inputs = { required = { "spec", "task" } },
    input_transform = {
        agent_id = "inputs.spec.agent_id",
        task = "inputs.task"
    },
    arena = {
        prompt = "Process according to spec",
        max_iterations = 25
    }
})
```

**Exit validation:** When `exit_func_id` is set, the function validates the agent's exit output. On validation failure, the agent receives the error as observation and continues (up to `max_iterations`).

### Cycle Node

Repeats a function or template while carrying state between iterations.

```lua
:cycle({
    func_id = "app:content_cycle",
    max_iterations = 3,
    initial_state = {
        entry_id = entry_id,
        content_prompt = prompt,
        task = task,
        min_score = 8.0,
        feedback_history = {}
    }
})
```

The cycle function receives on each iteration:

```lua
{
    input = <workflow_input>,  -- only on the first iteration (iteration == 1); nil thereafter
    state = <accumulated_state>,
    last_result = <previous_iteration_output>,
    iteration = <current_iteration_number>
}
```

`input` carries the workflow input only on the first iteration and is `nil` thereafter; persist anything needed across iterations into `state`.

The function controls continuation:

```lua
function my_cycle(cycle_context)
    -- stop if approved
    if cycle_context.last_result and cycle_context.last_result.approved then
        return {
            state = cycle_context.state,
            result = cycle_context.last_result,
            continue = false
        }
    end

    -- spawn child workflow for this iteration
    -- task is read from state since cycle_context.input is nil after iteration 1
    return flow.create()
        :with_input({ task = cycle_context.state.task })
        :agent("app:worker")
        :agent("app:qa")
        :run()
end
```

| Option | Type | Description |
|--------|------|-------------|
| `func_id` | string | Iteration function (mutually exclusive with `template`) |
| `template` | FlowBuilder | Template for each iteration (mutually exclusive with `func_id`) |
| `max_iterations` | number | Maximum iterations (default: 100) |
| `initial_state` | table | Starting state (default: `{}`) |
| `continue_condition` | string | Expression: continue while true |
| `inputs` | table | Input requirements |
| `context` | table | Execution context passed to the cycle function |
| `input_transform` | string/table | Transform inputs before the cycle receives them |
| `metadata` | table | Node metadata |

**Template-based cycle:**

```lua
:cycle({
    template = flow.template()
        :agent("app:worker")
        :func("app:validator"),
    max_iterations = 5
})
```

### Parallel Node

Processes array items through a reusable template.

```lua
:parallel({
    inputs = { required = { "specs", "task" } },
    source_array_key = "specs",
    iteration_input_key = "spec",
    passthrough_keys = { "task" },
    batch_size = 10,
    scheduling = "rolling",
    on_error = "continue",
    filter = "successes",
    unwrap = true,
    template = flow.template()
        :agent("app:processor", {
            inputs = { required = { "spec", "task" } },
            input_transform = {
                agent_id = "inputs.spec.agent_id",
                task = "inputs.task"
            },
            arena = {
                prompt = "Process according to spec",
                max_iterations = 25
            }
        })
        :to("@success"),
    metadata = { title = "Process Specs" }
})
```

| Option | Type | Description |
|--------|------|-------------|
| `source_array_key` | string | Input key containing a non-empty array (required) |
| `template` | FlowBuilder | Template for each item (required, must route to `@success`) |
| `iteration_input_key` | string | Input key for current item (default: `"default"`) |
| `batch_size` | number | Positive integer up to 1000; maximum in-flight items (default: 1) |
| `scheduling` | string | `"batch"` (default) waits for a whole wave; `"rolling"` refills completed slots and requires `on_error = "continue"` |
| `on_error` | string | `"continue"` (default) or `"fail_fast"`; `"collect_errors"` is a compatibility alias for `"continue"` |
| `filter` | string | `"all"` (default), `"successes"`, `"failures"` |
| `unwrap` | boolean | Return raw results instead of wrapped metadata (default: false) |
| `passthrough_keys` | array | Input keys forwarded to every iteration |
| `inputs` | table | Input requirements |
| `input_transform` | string/table | Transform inputs before parallel processing |
| `metadata` | table | Node metadata |

**Passthrough keys** provide shared context (config, task description) to every iteration without duplicating data in the source array:

```lua
:with_data(file_list):as("files"):to("processor", "files")
:with_data("secret"):as("api_key"):to("processor", "api_key")

:parallel({
    inputs = { required = { "files", "api_key" } },
    source_array_key = "files",
    iteration_input_key = "filename",
    passthrough_keys = { "api_key" },
    template = flow.template()
        :func("app:upload", {
            inputs = { required = { "filename", "api_key" } }
        })
        :to("@success")
}):as("processor")
```

### Signal Node

Pauses a node until an external signal arrives. This supports human approvals, external events, and staged workflows:

```lua
:signal({
    signal_id = "approval",
    inputs = { required = { "draft" } },
    metadata = { title = "Wait for approval" }
})
```

| Option | Type | Description |
|--------|------|-------------|
| `signal_id` | string | Signal name matched against `client:signal()`. If empty or omitted, a UUID v7 is generated at runtime |
| `timeout` | string/number | Positive duration string or positive finite milliseconds; expiry emits `{ timeout = true, code = "SIGNAL_TIMEOUT" }` |
| `inputs` | table | Input requirements |
| `input_transform` | string/table | Transform inputs before the node receives them |
| `metadata` | table | Node metadata |

Send the signal from outside the workflow using the client API (see `client:signal()` below).

#### Behavior

The node yields with `wait_for_signal = true` and persists that yield in the workflow state. The orchestrator resumes the node when a matching `NODE_SIGNAL` commit arrives.

- `client:signal()` stores omitted, `nil`, or `false` data as `{}`. That empty object, as well as preserved values such as `0` and `""`, satisfies the yield.
- A signal yield blocks `COMPLETE_WORKFLOW` but does not block other pending nodes — parallel branches continue to execute while one branch waits.
- `client:signal()` durably queues the signal and requests workflow activation. If the signal arrives before the node reaches its yield, it is delivered when that yield is tracked; a separate `:start()` call is not required.
- Only one signal satisfies each yield. If a second signal with the same `signal_id` arrives before the yield is satisfied, it overwrites the first.
- When multiple active yields share a `signal_id`, one matching yield receives the data; which one is not defined. Use unique IDs when the recipient matters.
- Omitting `signal_id` generates a UUID v7 that the builder does not return. Set an explicit, stable ID for signals delivered through the client API.
- Delivered signal data is passed to the node's output as the signal payload.

#### Durability and recovery

The signal yield is part of the workflow state, persisted through the same outbox mechanism as every other command. If the orchestrator process is killed while waiting:

- The pending yield is restored on restart.
- Signals delivered during the outage are queued and applied when the state reloads.
- Compound pipelines (`func → signal → signal → func`) recover step-by-step — each signal can be delivered across a separate restart.

Orphaned signal yields (yields whose parent process exited without completion) are cleaned up by the workflow state's process exit handler.

#### Pipeline patterns

Signal nodes participate in any topology. Add the client binding alongside the `flow` import shown above:

```yaml
imports:
  client: userspace.dataflow:client
```

```lua
local client = require("client")
local c, client_err = client.new()
if client_err then return nil, client_err end

-- Human-in-the-loop approval between two functions
local approval_id, start_err = flow.create()
    :with_input({ draft_id = "draft-123" })
    :func("app:draft")
    :signal({ signal_id = "approve_draft" })
    :func("app:publish")
    :start()
if start_err then return nil, start_err end

local _, signal_err = c:signal(approval_id, "approve_draft", { approved = true })
if signal_err then return nil, signal_err end

-- Two parallel approvals that must both arrive before release
local release_id, release_err = flow.create()
    :with_input({ doc = "release-notes" })
        :as("trigger")
        :to("legal", "doc")
        :to("finance", "doc")

    :signal({ signal_id = "legal_ok", inputs = { required = { "doc" } } })
        :as("legal")
        :to("gate", "legal")

    :signal({ signal_id = "finance_ok", inputs = { required = { "doc" } } })
        :as("finance")
        :to("gate", "finance")

    :join({ inputs = { required = { "legal", "finance" } } })
        :as("gate")
        :to("release")

    :func("app:release"):as("release"):to("@success")
    :start()
if release_err then return nil, release_err end

local _, legal_err = c:signal(release_id, "legal_ok", { approved_by = "legal" })
if legal_err then return nil, legal_err end

local _, finance_err = c:signal(release_id, "finance_ok", { approved_by = "finance" })
if finance_err then return nil, finance_err end
```

Stored signal data is exposed as the node output. Downstream nodes receive the submitted payload, except that omitted, `nil`, or `false` data is normalized to `{}`.

### Join Node

Collects multiple inputs before proceeding:

```lua
:join({
    inputs = { required = { "source1", "source2" } },
    output_mode = "object",
    ignored_keys = { "triggered" }
})
```

| Option | Type | Description |
|--------|------|-------------|
| `output_mode` | string | `"object"` (default) or `"array"` (arrival order) |
| `ignored_keys` | array | Input keys excluded from output |
| `inputs` | table | Input requirements |
| `input_transform` | string/table | Transform inputs before joining |
| `metadata` | table | Node metadata |

## Templates

Templates define reusable sub-workflows. Create one with `flow.template()` and inline it with `:use()`:

```lua
local preprocessor = flow.template()
    :func("app:clean")
    :func("app:tokenize")

flow.create()
    :with_input(data)
    :use(preprocessor)
    :func("app:process")
    :run()
```

Templates inline their operations into the parent flow at compile time.

## Nested Workflows

Functions used in cycles and parallel nodes can spawn child workflows by returning `flow.create():run()`:

```lua
function my_processor(input)
    return flow.create()
        :with_input(input)
        :func("app:step_a")
        :func("app:step_b")
        :run()
end
```

When `:run()` executes inside an existing dataflow context, it returns `{ _control = { commands = [...] } }` instead of executing directly. The orchestrator handles the child workflow through the yield mechanism.

<note>
A function that needs to spawn a child workflow must return <code>flow.create():run()</code>. Other dataflow functions can return ordinary results.
</note>

## Synchronous vs Asynchronous

`:run()` executes synchronously. It normally returns terminal workflow output, but a durable wait can passivate execution first; in that case the returned result has `pending = true` and `passivated = true` together with the workflow ID.

```lua
local result, err = flow.create()
    :with_input({ text = "hello" })
    :func("app:process")
    :run()
```

`:start()` returns immediately with a workflow ID:

```lua
local dataflow_id, err = flow.create()
    :with_input({ text = "hello" })
    :func("app:process")
    :start()
```

`:start()` cannot be used in nested contexts.

## Client API

Use the client API for programmatic workflow management:

```yaml
imports:
  client: userspace.dataflow:client
```

```lua
local client = require("client")

local c, err = client.new()
```

| Method | Description |
|--------|-------------|
| `client.new()` | Create client (requires the current security actor and scope) |
| `:create_workflow(commands, options?)` | Create workflow, returns `dataflow_id` |
| `:execute(dataflow_id, options?)` | Run synchronously, returns result |
| `:start(dataflow_id, options?)` | Run asynchronously, returns `dataflow_id` |
| `:output(dataflow_id)` | Fetch workflow outputs |
| `:get_status(dataflow_id)` | Get current status |
| `:cancel(dataflow_id, timeout?)` | Gracefully cancel (default: 30s) |
| `:terminate(dataflow_id)` | Force terminate |
| `:signal(dataflow_id, signal_id, data?)` | Deliver an external signal to a waiting signal node |
| `:revive(dataflow_id)` | Request activation for a non-terminal workflow |

## Workflow Status

| Status | Description |
|--------|-------------|
| `pending` | Created but not yet executing |
| `running` | Workflow execution is active |
| `waiting` | Passivated while awaiting a durable event such as a signal |
| `completed` | Finished successfully |
| `failed` | Failed |
| `cancelled` | User cancelled |
| `terminated` | Force terminated |

Nodes have a separate lifecycle. Current node transitions use `template`, `pending`, `running`, `waiting`, `completed`, `failed`, and `cancelled`. `ready` is accepted as a loaded workflow activation status; `paused`, `skipped`, and node-level `terminated` remain recognized compatibility values but are not written as current node transitions.

## Metadata

```lua
flow.create()
    :with_title("Document Processing Pipeline")
    :with_metadata({ source = "api", priority = "high" })
    :with_input({ document_id = "doc-123" })
    :func("app:process", { metadata = { title = "Process Document" } })
    :run()
```

Title defaults to "Flow Builder Workflow" if not provided.

## Validation Rules

The compiler validates the workflow graph before execution:

- All `:as(name)` names must be unique
- All `:to()` and `:error_to()` targets must reference existing names (except `@success`, `@fail`)
- Graph must be acyclic
- All nodes must have incoming routes (from another node, workflow input, or static data)
- `:cycle()` requires `func_id` or `template` (not both)
- `:parallel()` requires `source_array_key` and `template`
- At least one path must lead to `@success` or have auto-output
- `:when()` only follows `:to()` or `:error_to()` from nodes (not static data)
- Nodes with `args` or string-form `input_transform` cannot receive inputs with the `"default"` discriminator

## Expression Reference

Expressions use the `expr` module syntax, available in `:when()` conditions and `input_transform` values.

**Operators:** `+`, `-`, `*`, `/`, `%`, `**`, `&`, `|`, `^`, `<<`, `>>`, `==`, `!=`, `<`, `<=`, `>`, `>=`, `&&`, `||`, `!`, `in`, `contains`, `startsWith`, `endsWith`

**Array functions:** `all()`, `any()`, `none()`, `one()`, `filter()`, `map()`, `count()`, `len()`, `first()`, `last()`

**Math functions:** `max()`, `min()`, `abs()`, `ceil()`, `floor()`, `round()`, `sqrt()`, `pow()`

**String functions:** `len()`, `upper()`, `lower()`, `trim()`, `split()`, `join()`

**Type functions:** `type()`, `int()`, `float()`, `string()`

**Literals:** numbers, strings, booleans (`true`/`false`), null (`nil`), arrays (`[1, 2, 3]`), objects (`{key: value}`)

**Ternary:** `output.age >= 18 ? output.verified : false`

**Optional chaining:** `output.data?.nested?.value`

## Error Handling

Both `:run()` and `:start()` follow standard Lua error conventions:

- Success: `data, nil` (run) or `dataflow_id, nil` (start)
- Failure: `nil, error_message`

Error categories: compilation errors, client errors, workflow creation errors, execution errors, and workflow failures.

## See Also

- [Agents](./agents.md) — Agent framework used by agent nodes
- [LLM](./llm.md) — Model interface used by agents
- [Framework Overview](./overview.md) — Install and import framework modules
