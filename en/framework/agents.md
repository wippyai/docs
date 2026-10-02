---
title: "Agents"
description: "Define and run Wippy agents with tools, streaming, delegates, traits, memory, and custom resolution."
---

# Agents

The `wippy/agent` module defines agents declaratively and runs them through a context and runner. Agents can use tools, stream responses, delegate work, apply traits, and recall memory.

This page is an API primer with composable reference snippets, not a standalone tutorial. The snippets assume an existing Wippy project, a registered LLM model and provider, configured provider credentials, and the agent, tool, or resolver entries referenced by each example. Later snippets build on variables such as `ctx`, `runner`, and `conversation` created in earlier sections. For a complete runnable project, follow [Build an LLM Agent](tutorials/llm-agent.md).

## Setup

Add the module to your project:

```bash
wippy add wippy/agent
wippy install
```

The agent module declares its `wippy/llm` dependency itself. Add the agent
dependency to source when it is not already present:

```yaml
version: "1.0"
namespace: app

entries:
  - name: dep.agent
    kind: ns.dependency
    component: wippy/agent
    version: "*"
```

## Agent Definitions

Agents are registry entries with `meta.type: agent.gen1`:

```yaml
entries:
  - name: assistant
    kind: registry.entry
    meta:
      type: agent.gen1
      name: assistant
      title: Assistant
      comment: A helpful chat assistant
    prompt: |
      You are a helpful assistant. Be concise and direct.
      Answer questions clearly.
    model: gpt-4o
    max_tokens: 1024
    temperature: 0.7
```

### Agent Fields

| Field | Type | Description |
|-------|------|-------------|
| `meta.type` | string | Must be `agent.gen1` |
| `meta.name` | string | Agent identifier |
| `prompt` | string | System prompt |
| `model` | string | Model name or class |
| `max_tokens` | number | Maximum output tokens (default `512`) |
| `temperature` | number | Optional sampling temperature; omitted by default, with range and support determined by the provider |
| `thinking_effort` | number | Forwarded to the model only when `> 0` (provider-defined scale) |
| `tools` | array | Tool registry IDs |
| `traits` | array | Trait references |
| `delegates` | array | Delegate agent references |
| `memory` | array | Static memory items (strings) |
| `memory_contract` | table | Dynamic memory configuration |

## Agent Context

Create an agent context, configure it as needed, and then load an agent:

```yaml
imports:
  agent_context: wippy.agent:context
  prompt: wippy.llm:prompt
```

```lua
local agent_context = require("agent_context")

local ctx = agent_context.new()
local runner, err = ctx:load_agent("app:assistant")
if err then
    error("Failed to load agent: " .. tostring(err))
end
```

### Context Methods

| Method | Description |
|--------|-------------|
| `agent_context.new(options?)` | Create new context |
| `:add_tools(specs)` | Add tools at runtime |
| `:add_delegates(specs)` | Add delegate agents |
| `:configure_delegate_tools(config)` | Configure how delegates expose themselves as tools |
| `:set_memory_contract(config)` | Configure dynamic memory |
| `:set_context_merger(fn)` | Provide a function to merge runtime context updates |
| `:update_context(updates)` | Update runtime context |
| `:load_agent(spec_or_id, options?)` | Load and compile agent, returns runner |
| `:switch_to_agent(id, options?)` | Switch to different agent, returns `(boolean, string?)` |
| `:switch_to_model(name)` | Change model on current agent, returns `(boolean, string?)` |
| `:get_current_agent()` | Get current runner |
| `:get_config()` | Return a summary of the context configuration |

### Context Options

```lua
local ctx = agent_context.new({
    context = { session_id = "abc", user_id = "u1" },
    delegate_tools = { enabled = true },
    enable_cache = true,
})
```

| Option | Description |
|--------|-------------|
| `context` | Base runtime context forwarded to tools and delegates |
| `delegate_tools` | Default delegate-tool configuration (overridden by `configure_delegate_tools`) |
| `enable_cache` | Prompt cache marker setting for Claude models. The current implementation always enables markers, including when this option is `false`. |

### Loading by Inline Spec

Load an agent without a registry entry:

```lua
local runner, err = ctx:load_agent({
    id = "inline-agent",
    name = "helper",
    prompt = "You are a helpful assistant.",
    model = "gpt-4o",
    max_tokens = 1024,
    tools = { "app.tools:search" },
})
```

## Running Steps

The runner executes one agent step from a prompt-builder conversation:

```lua
local prompt = require("prompt")

local conversation = prompt.new()
conversation:add_user("What is the capital of France?")

local response, err = runner:step(conversation)
if err then
    error(tostring(err))
end

print(response.result)
```

### Step Options

```lua
local self_pid, pid_err = process.pid()
if pid_err then
    error("Failed to get process PID: " .. tostring(pid_err))
end

local response, err = runner:step(conversation, {
    context = { session_id = "abc" },
    stream_target = { reply_to = self_pid, topic = "stream" },
    tool_call = "auto",
})
if err then
    error("Agent step failed: " .. tostring(err))
end
```

| Option | Type | Description |
|--------|------|-------------|
| `context` | table | Runtime context merged with agent context |
| `stream_target` | table | Streaming: `{ reply_to, topic }` |
| `tool_call` | string | `"auto"`, `"any"`, `"none"`, or a tool name |

### Step Response

| Field | Type | Description |
|-------|------|-------------|
| `result` | string | Generated text |
| `tokens` | table | Token usage |
| `finish_reason` | string | Stop reason |
| `tool_calls` | table? | Tool calls to execute |
| `delegate_calls` | table? | Delegate invocations |

### Runner Stats

```lua
local stats = runner:get_stats()
-- stats.id, stats.name, stats.total_tokens
```

## Tool Definitions

Tools are `function.lua` entries with `meta.type: tool`. Define them in a separate `_index.yaml`:

```yaml
version: "1.0"
namespace: app.tools

entries:
  - name: calculate
    kind: function.lua
    meta:
      type: tool
      title: Calculate
      input_schema: |
        {
          "type": "object",
          "properties": {
            "expression": {
              "type": "string",
              "description": "Math expression to evaluate"
            }
          },
          "required": ["expression"],
          "additionalProperties": false
        }
      llm_alias: calculate
      llm_description: Evaluate a mathematical expression.
    source: file://calculate.lua
    modules: [expr]
    method: handler
```

```lua
local expr = require("expr")

local function handler(args)
    local result, err = expr.eval(args.expression)
    if err then
        return { error = tostring(err) }
    end
    return { result = result }
end

return { handler = handler }
```

### Tool Metadata

| Field | Type | Description |
|-------|------|-------------|
| `meta.type` | string | Must be `tool` |
| `meta.input_schema` | string/table | JSON Schema for tool arguments |
| `meta.llm_alias` | string | Name exposed to the LLM |
| `meta.llm_description` | string | Description exposed to the LLM |
| `meta.exclusive` | boolean | If true, cancels concurrent tool calls |

### Referencing Tools in Agents

List tool registry IDs in the agent definition:

```yaml
  - name: assistant
    kind: registry.entry
    meta:
      type: agent.gen1
      name: assistant
    prompt: You are a helpful assistant with tools.
    model: gpt-4o
    max_tokens: 1024
    tools:
      - app.tools:calculate
      - app.tools:search
      - app.tools:*          # wildcard: all tools in namespace
```

Tools can also be referenced with custom aliases and context:

```yaml
    tools:
      - id: app.tools:search
        alias: web_search
        context:
          api_key: "${SEARCH_API_KEY}"
```

## Tool Execution

When an agent step returns `tool_calls`, execute the calls and add their results to the conversation:

```lua
local json = require("json")
local funcs = require("funcs")

local function execute_and_continue(runner, conversation)
    while true do
        local response, err = runner:step(conversation)
        if err then return nil, err end

        local tool_calls = response.tool_calls
        if not tool_calls or #tool_calls == 0 then
            return response.result, nil
        end

        for _, tc in ipairs(tool_calls) do
            local result, call_err = funcs.call(tc.registry_id, tc.arguments)
            local result_str
            if call_err then
                result_str = json.encode({ error = tostring(call_err) })
            else
                result_str = json.encode(result)
            end

            conversation:add_function_call(tc.name, json.encode(tc.arguments), tc.id)
            conversation:add_function_result(tc.name, result_str, tc.id)
        end
    end
end
```

### Tool Call Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique call identifier |
| `name` | string | Tool name (alias or llm_alias) |
| `arguments` | table | Parsed arguments |
| `registry_id` | string | Full registry ID for `funcs.call()` |

<note>
Use <code>funcs.call(tc.registry_id, tc.arguments)</code> to execute tools. The <code>registry_id</code> field maps directly to the tool's entry in the registry.
</note>

For how agent tool access and observability are secured, see the [Security Model](concepts/security-model.md).

## Attention context and UI actions

When a user message contains a validated `wippy.attention` version 1 through 4 attachment,
the prompt builder renders bounded candidates into the same user-role turn. The
rendered block is marked `untrusted_user_observation`; labels, accessible text,
and values are data and cannot supply model instructions. Unknown attachment
kinds or versions remain inert until a handler is registered. Prompt rendering
has its own byte budget and does not mutate the persisted attachment.

Files attached to a user message are listed to the model by file name, type,
size and ID. Their content is never inlined as an image. Image content reaches
the model only through an approved `wippy.attention.visual` capture, described
in [Visual capture](#visual-capture).

### Attention trait and tools

Add `wippy.agent.traits:attention` to an agent to give it the Attention tools.
All of them are private tools in the `wippy.agent.tools` namespace. Reads work
with automatic attachment, message-context capability and overlay permission
off. An incoming attachment does not grant tools.

The nine read tools inspect the current interface of the Host tab that
submitted the turn:

| Tool | Example arguments | Purpose |
|---|---|---|
| `attention_find_semantic` | `{"role":"button","name":"Save"}` | Match `role`, `name`, `text` or `resource_id` across the permitted tree. |
| `attention_find_css` | `{"selector":"button","root":ref}` | Query one known document or shadow root. |
| `attention_get_node` | `{"node_id":"returned-canonical-id"}` | Resolve one known canonical node. |
| `attention_get_tree` | `{"scope":ref,"limit":16,"depth":2}` | Read a bounded subtree page. |
| `attention_get_geometry` | `{"node":ref}` | Read geometry, coordinate space and quality. |
| `attention_get_cursor` | `{}` | Read the latest pointer observation. |
| `attention_get_focus` | `{}` | Read the focused target. |
| `attention_get_selection` | `{}` | Read selected text and both endpoint paths. |
| `attention_hit_test` | `{"x":100,"y":120}` | Inspect a point, by default with a 20 CSS-pixel radius and a 5-pixel grid. |

In the examples, `ref` is the complete returned `NodeRef` with
`host_instance_id`, `node_id`, `mount_id` and `generation`. The older
`attention_inspect` tool was removed; the explicit read tools above replace it.

`attention_context_set` turns automatic pointing context on or off for the
current Session. It takes a required boolean `enabled` and an optional
`expected_revision`. The agent may call it without asking the user. The
setting belongs to the Session, so it stays in effect after the user switches
to another agent.

The four action tools ask the user to clarify or capture a target through the
current authenticated Host connection:

| Tool | Purpose | Targets |
|---|---|---|
| `ui_action_highlight` | Highlight candidate rectangles. | 1 to 32 |
| `ui_action_confirm` | Ask whether a supplied candidate is the intended one. | 1 to 32 |
| `ui_action_select` | Ask the user to select a candidate, or to select an arbitrary area when there are no targets and `capture_region: true`. | 0 to 32 |
| `ui_action_capture_visual` | Ask the user to approve an image of a target, region or viewport. The `capture` object sets `scope` (`target`, `region` or `viewport`), `region`, `allow_adjustment`, `allow_viewport_choice` and `format` (`image/png` or `image/webp`). | 1 to 32 |

The action tools and `attention_context_set` are exclusive, so each one
cancels concurrent tool calls. See [agent clarification
actions](../frontend/web-host/attention-context.md#agent-clarification-actions)
for every argument and default.

### Read limits and history

Semantic search and CSS search are separate modes; CSS requires one canonical
document or shadow-root reference. Search returns at most eight matches and
tree pages at most 32 nodes. Private results use `wippy.attention.model.v1`,
preserve complete returned ancestry through local dictionaries, and are capped
at 8 KiB.

The trait guard admits one read per batch and four attempted reads per user
turn, including invalid and refused attempts. Two invalid attempts end repair.
It refuses reads when trusted history cannot establish the turn boundary. A
refused call keeps the model's own call ID, tool name and arguments. The
refusal reason travels to the tool in its execution context, and the tool
returns a `rejected` result without contacting the Host. Unrelated tools in a
mixed batch keep their normal behavior. These limits are not a global
provider-generation or cost limit. See [the complete
limits](../frontend/web-host/attention-context.md#canonical-inspection-and-agent-tools).

Session stores each compact read result in private function history, and later
model generations see it again. Session withdraws an earlier read in the turn
only when what it observed has changed. Reads of tree content are withdrawn
when the tree revision changes, and geometry reads are withdrawn when geometry
changes. Cursor, focus and selection reads are withdrawn only when a newer read
of the same query exists. A withdrawn result stays in history, and the model
sees a notice that tells it to call the tool again. Read lifetimes are measured
from the time the server received the result, not from browser clocks.

### Target references

Each item of an action tool's `targets` array is an immutable target reference
containing the snapshot, target, Host instance, mount ID and generation, path
digest, rectangle, and optional label. It contains no capability or bearer
token. The prompt renderer exposes this object as a candidate's `action_ref`,
and a read that returns exactly one actionable node exposes it as `target_ref`.
The agent must copy that exact object verbatim as one item of the tool's
`targets` array, and must not build one from IDs, labels or coordinates. Tool
arguments can also include a prompt of at most 512 characters and independent
pointer and keyboard permissions. A zero-target `select` request is valid only
with `capture_region: true`. Here `capture_region` enables Host-owned arbitrary
area selection; it does not authorize screenshot capture.

The tools receive ephemeral `ui_action_runtime` context only at exact
registered tool execution. The context is excluded from validated tool-call
records, wrappers, persistence, history, and model-visible payloads. The session
broker rejects a tool when the current turn has no eligible Host connection,
when interactive actions are disabled, or when its target belongs to another
Host instance. Read-only inspection has independent authority. Requests bind to
the Host tab that submitted the current turn; reconnect requires a fresh
authenticated binding and cannot replay an expired request.

The Session plugin is the sole WebSocket inbox owner. It validates incoming
action results and routes each accepted result to a private per-call mailbox.
Framework tools wait on that mailbox rather than subscribing to WebSocket
topics themselves.

The tool path waits for one terminal Host result. Its status is `selected`,
`confirmed`, `prepared`, `cancelled`, `denied`, `rejected`, `expired`, `stale`,
`disconnected`, `permission-denied`, `unavailable` or `error`. See [terminal
statuses](../frontend/web-host/attention-context.md#terminal-statuses) for the
meaning of each one. The broker permits one pending action per session, caps
expiry at 120 seconds, and accepts only the first correctly correlated terminal
result.

### Visual capture

`ui_action_capture_visual` opens explicit Host approval and prepares a
removable ordinary composer file. It never sends the message. Target or region
capture is the default, and viewport capture is offered only when the request
sets `allow_viewport_choice`. The approved image is uploaded as an ordinary
file, so the application's upload type must accept `image/png`, and
`image/webp` when that format is requested.

When the user later sends a message that still includes the file, the Host adds
one `wippy.attention.visual` attachment that references the upload. This
happens even when automatic pointing context is off. Semantic Attention
attachments contain no screenshot bytes or upload references.

The session upload authorizer and byte resolver are implemented through the
content-provider contract. Before persistence, the session layer validates
reference structure, session binding, expiry, media type, size, and digest,
then authorizes the reference and verifies the resolved bytes. An attached
reference that cannot pass these checks rejects the complete send atomically;
it is not silently removed to persist a semantic-only message.

When rendering an accepted message, the framework emits image input only when
an authorized `visual_resolver` returns bytes that pass media-type, size, and
SHA-256 checks. Later expiry, denied access, an unavailable resolver, or
invalid bytes omits the image and returns a render diagnostic without changing
the persisted message; other valid semantic context remains renderable.

Deployments must verify capture, redaction, ordinary-file authorization, expiry
and orphan cleanup independently. A byte resolver alone does not establish
those behaviors.

### Errors during a turn

A model or provider error ends only the current turn. The user sees the error
and can send the message again in the same Session. If the Session process
stopped because of a crash, the next message reopens it.

See [Web Host Attention Context](../frontend/web-host/attention-context.md#agent-clarification-actions)
for the overlay behavior and [Relay](./relay.md#attention-ui-action-routing) for
connection targeting.

## Streaming

Stream agent responses through `stream_target`:

```lua
local TOPIC = "agent_stream"

local function stream_step(runner, conversation)
    local stream_ch, listen_err = process.listen(TOPIC)
    if listen_err then
        return nil, nil, listen_err
    end

    local function finish(text, response, err)
        local ok, cleanup_err = process.unlisten(stream_ch)
        if not ok then
            cleanup_err = cleanup_err or "Failed to remove agent stream listener"
            if err then
                return text, nil, tostring(err) .. "; cleanup failed: " .. tostring(cleanup_err)
            end
            return text, nil, cleanup_err
        end
        if err then
            return text, nil, err
        end
        return text, response, nil
    end

    local self_pid, pid_err = process.pid()
    if pid_err then
        return finish("", nil, pid_err)
    end

    local done_ch = channel.new(1)
    coroutine.spawn(function()
        local response, err = runner:step(conversation, {
            stream_target = {
                reply_to = self_pid,
                topic = TOPIC,
            },
        })
        done_ch:send({ response = response, err = err })
    end)

    local full_text = ""
    local step_result = nil
    local stream_done = false
    local stream_err = nil

    while true do
        local cases = {}
        if not stream_done then
            table.insert(cases, stream_ch:case_receive())
        end
        if not step_result then
            table.insert(cases, done_ch:case_receive())
        end

        local result = channel.select(cases)
        if not result.ok then
            return finish(full_text, nil, "Agent stream closed before completion")
        end

        if result.channel == done_ch then
            step_result = result.value
            if step_result.err then
                return finish(full_text, nil, step_result.err)
            end
            if stream_done then
                return finish(full_text, step_result.response, stream_err)
            end
        else
            local chunk = result.value
            if chunk.type == "chunk" then
                local content = chunk.content or ""
                print(content)
                full_text = full_text .. content
            elseif chunk.type == "error" then
                stream_done = true
                stream_err = chunk.error and chunk.error.message or "Agent stream failed"
            elseif chunk.type == "done" then
                stream_done = true
            end

            if stream_done and step_result then
                return finish(full_text, step_result.response, stream_err)
            end
        end
    end
end
```

The stream uses the same chunk types as direct LLM streaming: `"chunk"`, `"thinking"`, `"tool_call"`, `"error"`, `"done"`.

<tip>
Use <code>coroutine.spawn</code> to run <code>runner:step()</code> in a separate coroutine so you can receive stream chunks concurrently. Use <code>channel.select</code> to multiplex the stream and completion channels.
</tip>

## Delegates

Agents can delegate to other agents. Delegates appear as tools to the parent agent:

```yaml
  - name: coordinator
    kind: registry.entry
    meta:
      type: agent.gen1
      name: coordinator
    prompt: Route questions to the right specialist.
    model: gpt-4o
    max_tokens: 1024
    delegates:
      - id: app:code_agent
        name: ask_coder
        rule: for programming questions
      - id: app:math_agent
        name: ask_mathematician
        rule: for math problems
```

Delegate calls appear in `response.delegate_calls`:

```lua
local response, err = runner:step(conversation)
if err then
    error("Delegate step failed: " .. tostring(err))
end

if response.delegate_calls then
    for _, dc in ipairs(response.delegate_calls) do
        -- dc.agent_id - target agent registry ID
        -- dc.name - delegate tool name
        -- dc.arguments - forwarded message
    end
end
```

Delegates can also be added at runtime:

```lua
ctx:add_delegates({
    { id = "app:specialist", name = "ask_specialist", rule = "for domain questions" },
})
```

## Traits

Traits are reusable definitions that contribute prompts, tools, and behavior to agents:

```yaml
  - name: assistant
    kind: registry.entry
    meta:
      type: agent.gen1
      name: assistant
    prompt: You are a helpful assistant.
    model: gpt-4o
    traits:
      - time_aware
      - id: custom_trait
        context:
          key: value
```

### Built-in Traits

| Trait | Description |
|-------|-------------|
| `time_aware` | Injects current date and time into the prompt |
| `attention` | Adds the Attention read tools, `attention_context_set` and the UI action tools. See [Attention context and UI actions](#attention-context-and-ui-actions). |

The `time_aware` trait accepts context options:

```yaml
    traits:
      - id: time_aware
        context:
          timezone: America/New_York
          time_interval: 15
```

The `wippy/session` module, version 0.6.3 or newer, provides two traits for live session input:

| Trait | Description |
|-------|-------------|
| `wippy.session.traits:steering` | Defaults the active agent to accepting messages while a turn is running. |
| `wippy.session.traits:input_control` | Grants `set_session_input_policy`, which can change the current turn or persistent session policy. It does not enable steering by itself. |

See [Sessions](./sessions.md) for policy order, tool scopes, Stop behavior, and
the public interaction state.

### Custom Traits

Traits are registry entries with `meta.type: agent.trait`. They can contribute:
- **prompt** - static text appended to the system prompt
- **build_func_id** - function called at compile time to contribute tools, prompts, delegates
- **prompt_func_id** - function called at each step to inject dynamic content
- **step_func_id** - function called at each step for side effects

## Memory

### Static Memory

Static memory items are appended to the system prompt:

```yaml
  - name: assistant
    kind: registry.entry
    meta:
      type: agent.gen1
      name: assistant
    prompt: You are a helpful assistant.
    model: gpt-4o
    memory:
      - "User prefers concise answers"
      - "Always cite sources when possible"
```

### Dynamic Memory Contract

Configure dynamic memory recall through an external implementation:

```yaml
    memory_contract:
      implementation_id: app:memory_store
      context:
        user_id: "${user_id}"
      options:
        max_items: 3
        max_length: 1000
        recall_cooldown: 1
        min_conversation_length: 2
```

The memory contract is called during `runner:step()` to recall relevant items based on the conversation context. Results are injected as developer messages.

| Option | Default | Description |
|--------|---------|-------------|
| `max_items` | `3` | Maximum memory items per recall |
| `max_length` | `1000` | Maximum total character length |
| `recall_cooldown` | `1` | Minimum steps between recalls |
| `min_conversation_length` | `2` | Minimum conversation turns before first recall |

## Resolver Contract

When `load_agent()` receives a string identifier, it first tries to resolve it through the `wippy.agent:resolver` contract. If no resolver is bound or the resolver returns nil, it falls back to the registry lookup.

This allows applications to implement custom agent resolution, such as loading agent definitions from a database.

### Binding a Resolver

Define a resolver function and bind it to the contract:

```yaml
entries:
  - name: agent_resolver.resolve
    kind: function.lua
    source: file://agent_resolver.lua
    method: resolve
    modules:
      - logger
    imports:
      agent_registry: wippy.agent.discovery:registry

  - name: agent_resolver_binding
    kind: contract.binding
    contracts:
      - contract: wippy.agent:resolver
        default: true
        methods:
          resolve: app:agent_resolver.resolve
```

### Resolver Implementation

The resolver receives `{ agent_id = "..." }` and returns an agent spec table or nil:

```lua
local agent_registry = require("agent_registry")

local CUSTOM_PREFIX = "custom:"

function resolve(args)
    local agent_id = args.agent_id
    if not agent_id then
        return nil, "agent_id is required"
    end

    if agent_id:sub(1, #CUSTOM_PREFIX) == CUSTOM_PREFIX then
        local id = agent_id:sub(#CUSTOM_PREFIX + 1)

        -- load from database, config file, or any other source
        return {
            id = agent_id,
            name = "custom-agent",
            prompt = "You are a custom agent.",
            model = "class:balanced",
            max_tokens = 1024,
            tools = {},
        }
    end

    -- fall back to registry
    local spec, err = agent_registry.get_by_id(agent_id)
    if not spec then
        spec, err = agent_registry.get_by_name(agent_id)
    end
    return spec, err
end

return {
    resolve = resolve,
}
```

### Resolution Order

1. Try `wippy.agent:resolver` contract (if bound)
2. Try registry lookup by ID
3. Try registry lookup by name
4. Return error if not found

Custom resolution can load agent definitions outside the framework registry, including definitions scoped by user or workspace.

## See Also

- [LLM](framework/llm.md) — Underlying model interface
- [Building an LLM Agent](../tutorials/llm-agent.md) — Build an agent step by step
- [Framework Overview](framework/overview.md) — Install and import framework modules
