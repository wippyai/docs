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

The `time_aware` trait accepts context options:

```yaml
    traits:
      - id: time_aware
        context:
          timezone: America/New_York
          time_interval: 15
```

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
