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
| `agent_options` | table | Host options, including `checkpoint`, `turn_context` and loop settings |

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
| `context_id` | string | Conversation ID for LLM usage tracking |
| `route` | table | Previous response's `route_pin`, retained for the current turn |
| `drop_stale_thinking` | boolean | Strip thinking bound to an earlier system/tool prefix |
| `thinking_is_current` | function | Optional `(message, fingerprint) -> boolean` replacing the fingerprint comparison |
| `checkpoint` | table | `{ token_threshold, compact }`; callback returns a replacement conversation builder |
| `cancel` | channel | Host closes it to cancel in-flight generation |

### Step Response

| Field | Type | Description |
|-------|------|-------------|
| `result` | string | Generated text |
| `tokens` | table | Token usage |
| `finish_reason` | string | Stop reason |
| `tool_calls` | table? | Tool calls to execute |
| `delegate_calls` | table? | Delegate invocations |
| `metadata` | table? | Provider metadata, including `thinking_blocks` and `content_positions` |
| `context_notes` | array? | Positional notes sent after the supplied conversation and before the output |
| `prefix_fingerprint` | string? | SHA-256 of the system text and tool definitions actually sent |
| `route_pin` | table? | Route retained after fallback, or the pin passed to this step |

Pass `response.route_pin` back as `route` on later steps of the same turn, and clear it for a new turn. This keeps tool results on the route that produced their calls after a fallback. Closing `cancel` returns a stopped response with any text streamed so far and `finish_reason = "cancelled"`.

### Persisting Step Context

Persist `context_notes` in order after the supplied conversation and before the assistant text or calls. These developer messages carry `metadata.preserve_position = true`; replay their content and metadata unchanged. `context_notes` replaces the earlier `memory_prompt` response field. Discard notes when discarding the step's output. Recall cooldown reads `metadata.memory_ids` from the persisted notes.

Store `prefix_fingerprint` as `metadata.prefix_fingerprint` on assistant rows carrying thinking, together with `metadata.thinking_blocks` and any `metadata.content_positions`. Set `drop_stale_thinking = true` on subsequent steps. The runner removes blocks through the last stale message, including messages without a fingerprint. It works on copies and recomputes the fingerprint if a checkpoint replaces the conversation.

The fingerprint covers the compiled system prompt, ordinary conversation system text and provider-visible tool definitions. It excludes the model and registry-only metadata. It reflects the Claude/Bedrock prefix; equality on other drivers is necessary but does not prove identical wire input. Edits to earlier conversation messages are not detected. Hosts with a checkpoint epoch can supply `thinking_is_current(message, fingerprint)` to check both.

The current tool round keeps its thinking, with stale blocks marked for the driver to bind or omit. An older stale turn with an unanswered call fails before dispatch. See [thinking block binding](./llm.md#thinking-blocks-across-agents) for provider handling.

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

When an agent step returns `tool_calls`, execute them through the tool caller. Declare its import and the `json` module on the calling entry:

```yaml
modules: [json]
imports:
  tool_caller: wippy.agent.tools:caller
```

This loop handles registered tools; a host using delegates must also settle `delegate_calls`.

```lua
local json = require("json")
local tool_caller = require("tool_caller")

local function execute_and_continue(runner, conversation)
    local caller = tool_caller.new():set_strategy(tool_caller.STRATEGY.PARALLEL)
    local route_pin = nil
    while true do
        local response, err = runner:step(conversation, {
            route = route_pin,
            drop_stale_thinking = true,
        })
        if err then return nil, err end
        if response.truncation_reason then return nil, "Agent output was truncated" end
        route_pin = response.route_pin

        for _, note in ipairs(response.context_notes or {}) do
            conversation:add_message(note.role, note.content, note.name, note.metadata)
        end
        local metadata = response.metadata or {}
        metadata.prefix_fingerprint = response.prefix_fingerprint
        conversation:add_assistant(response.result or "", metadata)

        local tool_calls = response.tool_calls
        if not tool_calls or #tool_calls == 0 then
            return response.result, nil
        end

        -- Keep the response's calls together, then append results in call order.
        for _, tc in ipairs(tool_calls) do
            conversation:add_function_call(tc.name, json.encode(tc.arguments), tc.id, {
                provider_metadata = tc.provider_metadata,
            })
        end
        local validated, validation_err = caller:validate(tool_calls)
        if validation_err then return nil, validation_err end
        local results, execute_err = caller:execute({}, validated)
        if execute_err then return nil, execute_err end
        for _, tc in ipairs(tool_calls) do
            local result = results[tc.id]
            local result_str = json.encode(result.error
                and { error = tostring(result.error) } or result.result)
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
| `registry_id` | string | Full registry ID for execution |
| `provider_metadata` | table? | Pass unchanged in `add_function_call` options |

<note>
The caller validates calls and applies execution context. Hosts can configure wrappers with <code>set_tool_wrappers(runner.tool_wrappers)</code> and supply their refs with <code>set_wrapper_context(...)</code>. Its default strategy is <code>SEQUENTIAL</code>; select <code>PARALLEL</code> to run a batch concurrently. A result of <code>{ success = false, error = "non-empty text" }</code> sets <code>ToolExecResult.error</code> while preserving the original result. An <code>error</code> field alone remains ordinary result data.
</note>

### Result Listener

Register a listener to persist results as calls finish:

```lua
local caller = tool_caller.new():set_strategy(tool_caller.STRATEGY.PARALLEL)
caller:set_result_listener(function(call_id, result)
    local _, err = store:save_observation(call_id, result)
    if err then return nil, err end
end)
```

Here `store:save_observation` is the host's persistence function. The listener receives each call ID once, including validation failures, tool errors and cancellation, before `after_execute` wrappers. Parallel delivery follows completion order; sequential delivery finishes before the next call starts. The listener runs synchronously, so Stop waits for it to return. Keep it short and do not mutate the result.

Raising or returning a non-nil second value fails delivery. The caller cancels running calls, starts no more, skips `after_execute`, and returns `nil, error` naming the failed ID. Already accepted results remain accepted. `set_result_listener(nil)` removes the listener. Hosts can pass a cancel channel as the third argument to `execute(context, validated, cancel)`.

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

Keep the agent's existing model, prompt and unrelated traits. Add the reusable
trait as one additional item:

```yaml
traits:
  - id: wippy.agent.traits:attention
```

The trait supplies its read guard and tools. A bare standalone agent runner
does not create a browser connection; live reads also need the Session broker
and a turn bound to an authenticated Host tab. See the [Attention
quickstart](../frontend/web-host/attention-quickstart.md) for a full agent entry,
Host configuration and public package examples.

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
`expected_revision`. The trait instructs the agent to call it only when the user requests a change.
There is no additional confirmation prompt. The setting belongs to the Session,
so it stays in effect after the user switches
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

Session stores each compact read result in private function history. Later
model generations can reuse it while it remains valid. A result expires after
30 seconds, on a later user turn, after a completed browser action, or when a
newer read replaces the same query. Tree reads also become stale when a later
read reports a changed tree revision. Geometry reads use the geometry revision;
point reads use both. Cursor, focus and selection use query replacement rather
than the shared observation revision. Withdrawal uses existing `metadata.stale`
behavior and preserves valid tool-call/result pairs. The result stays stored,
but the model receives a stale-result notice instead of the old observation.
Read lifetimes are measured from the time the server received the result, not
from browser clocks. Immutable automatic attachments leave the model view
after expiry, a later user turn, a fresh usable read or a completed browser
action. Their stored content and hashes remain unchanged.

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
      - wippy.agent.traits:time_aware
      - id: app:custom_trait
        context:
          key: value
```

### Built-in Traits

| Trait | Description |
|-------|-------------|
| `wippy.agent.traits:time_aware` | Declares per-turn time context for the host to render and store |
| `wippy.agent.traits:attention` | Adds the Attention read tools, `attention_context_set` and the UI action tools. See [Attention context and UI actions](#attention-context-and-ui-actions). |

The `time_aware` trait accepts context options:

```yaml
    traits:
      - id: wippy.agent.traits:time_aware
        context:
          timezone: America/New_York
          time_format: "2006-01-02 15:04 MST"
```

The build function contributes `agent_options.turn_context.time = { timezone, format }` and no prompt text. `timezone` defaults to UTC; `time_format` is an optional Go time layout. The legacy `time_interval` is ignored. Hosts render once per user turn with `wippy.agent:turn_context` and persist the note after the user message:

```yaml
modules: [time]
imports:
  turn_context: wippy.agent:turn_context
```

```lua
local turn_context = require("turn_context")
local time = require("time")

local note, err = turn_context.render(runner.agent_options, time.now())
if err then return nil, err end
if note then
    conversation:add_system(note, { preserve_position = true })
end
```

Keep this note unchanged on later steps. Session and Dataflow hosts persist it automatically. Unknown or empty timezones and invalid formats fail rendering; a malformed `time_format` fails trait compilation.

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
- **prompt_func_id** - function called at each step whose returned system text must stay stable across the conversation
- **step_func_id** - function called at each step for side effects

Changing per-step context belongs in persisted positional notes. Lifecycle messages from `activate` and `before_step` must use `developer` or `system`; Session and Dataflow reject other roles. A failed prompt function fails the step before provider dispatch.

### Behaviors and Compaction

Put `behaviors` directly on the trait registry entry, alongside `meta`; do not nest it under `data`. Attach a trait to set per-agent checkpoint defaults:

```yaml
entries:
  - name: compaction
    kind: registry.entry
    meta:
      type: agent.trait
      name: Compaction
    behaviors:
      compaction:
        handles: [checkpoint]
        checkpoint:
          token_threshold: 12000
          model: class:fast
          temperature: 0.2
          max_tokens: 3000

  - name: assistant
    kind: registry.entry
    meta:
      type: agent.gen1
      name: assistant
    prompt: You are a helpful assistant.
    model: gpt-4o
    traits: [app:compaction]
    agent_options:
      checkpoint:
        token_threshold: 16000
```

This behavior has no checkpoint handler and configures the host's default summarizer. Only behaviors without a checkpoint handler (`handlers.checkpoint` or the shared `handler`) promote `model`, `temperature`, Session's `max_tool_result_chars`, `max_conversation_chars`, `max_tool_results`, `max_tool_results_chars`, and Dataflow's `max_row_chars` into `agent_options.checkpoint`. With a handler, those keys remain local to its binding. The keys `enabled`, `function_id`, `max_memory_chars`, `max_tokens`, `strict` and `token_threshold` are promoted either way. Other checkpoint keys are not promoted.

Behavior options merge in this order: trait options, behavior options, attachment options, phase options. Maps compile in key order; arrays retain declaration order. Checkpoint scheduling merges trait defaults, explicit `agent_options.checkpoint`, then host `config.checkpoint`. Session-wide defaults precede the agent values. Maps merge recursively; lists replace, including empty lists. False, zero and empty strings are explicit overrides.

The detached effective checkpoint options override binding defaults and reach both the binding and function fallback. Bindings run first; a strict binding failure prevents fallback. Absent configuration does not enable checkpointing. See [Sessions](./sessions.md#checkpoints) and [Dataflow](./dataflow.md#agent-checkpoints) for scheduling and sizing.

Tool wrappers must preserve every original call ID exactly once, even when redirecting tools or reordering calls. Missing, duplicated or added IDs fail validation before execution.

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

The memory contract is called during eligible steps to recall relevant background context. Results are sent as positional developer messages and returned in `context_notes` for the host to persist. Recall failures do not stop generation; `memory_recall_error` describes the failure. An empty memory list is not an error.

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
