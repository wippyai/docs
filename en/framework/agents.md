# Agents

The `wippy/agent` module provides a framework for building AI agents with tool use, streaming, delegation, traits, and memory. Agents are defined declaratively and executed through a context/runner pattern.

## Setup

Add the module to your project:

```bash
wippy add wippy/agent
wippy install
```

The agent module requires `wippy/llm` and a process host. Declare both dependencies:

```yaml
version: "1.0"
namespace: app

entries:
  - name: os_env
    kind: env.storage.os

  - name: processes
    kind: process.host
    lifecycle:
      auto_start: true

  - name: dep.llm
    kind: ns.dependency
    component: wippy/llm
    version: "*"
    parameters:
      - name: env_storage
        value: app:os_env
      - name: process_host
        value: app:processes

  - name: dep.agent
    kind: ns.dependency
    component: wippy/agent
    version: "*"
    parameters:
      - name: process_host
        value: app:processes
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
| `max_tokens` | number | Maximum output tokens |
| `temperature` | number | Randomness control, 0-1 |
| `thinking_effort` | number | Thinking depth 0-100 |
| `tools` | array | Tool registry IDs |
| `traits` | array | Trait references |
| `delegates` | array | Delegate agent references |
| `memory` | array | Static memory items (strings) |
| `memory_contract` | table | Dynamic memory configuration |

## Agent Context

The agent context is the main entry point. Create a context, optionally configure it, then load an agent:

```yaml
imports:
  agent_context: wippy.agent:context
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
| `:set_memory_contract(config)` | Configure dynamic memory |
| `:update_context(updates)` | Update runtime context |
| `:load_agent(spec_or_id, options?)` | Load and compile agent, returns runner |
| `:switch_to_agent(id, options?)` | Switch to different agent, returns `(boolean, string?)` |
| `:switch_to_model(name)` | Change model on current agent, returns `(boolean, string?)` |
| `:get_current_agent()` | Get current runner |

### Context Options

```lua
local ctx = agent_context.new({
    context = { session_id = "abc", user_id = "u1" },
    delegate_tools = { enabled = true },
})
```

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

The runner executes a single reasoning step. Pass a prompt builder with the conversation:

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
local response, err = runner:step(conversation, {
    context = { session_id = "abc" },
    stream_target = { reply_to = process.pid(), topic = "stream" },
    tool_call = "auto",
})
```

| Option | Type | Description |
|--------|------|-------------|
| `context` | table | Runtime context merged with agent context |
| `stream_target` | table | Streaming: `{ reply_to, topic }` |
| `tool_call` | string | `"auto"`, `"required"`, `"none"` |

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

When an agent step returns `tool_calls`, execute them and feed results back:

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

            conversation:add_function_call(tc.name, tc.arguments, tc.id)
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

## Streaming

Stream agent responses in real-time using `stream_target`:

```lua
local TOPIC = "agent_stream"

local function stream_step(runner, conversation)
    local stream_ch = process.listen(TOPIC)

    local done_ch = channel.new(1)
    coroutine.spawn(function()
        local response, err = runner:step(conversation, {
            stream_target = {
                reply_to = process.pid(),
                topic = TOPIC,
            },
        })
        done_ch:send({ response = response, err = err })
    end)

    local full_text = ""
    while true do
        local result = channel.select({
            stream_ch:case_receive(),
            done_ch:case_receive(),
        })
        if not result.ok then break end

        if result.channel == done_ch then
            process.unlisten(stream_ch)
            local r = result.value
            return full_text, r.response, r.err
        end

        local chunk = result.value
        if chunk.type == "chunk" then
            io.write(chunk.content or "")
            full_text = full_text .. (chunk.content or "")
        elseif chunk.type == "done" then
            -- wait for the step to complete
            local r, ok = done_ch:receive()
            process.unlisten(stream_ch)
            if ok and r then
                return full_text, r.response, r.err
            end
            return full_text, nil, nil
        end
    end

    process.unlisten(stream_ch)
    return full_text, nil, nil
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
local response = runner:step(conversation)

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

Traits are reusable capabilities that contribute prompts, tools, and behavior to agents:

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

Simple memory items appended to the system prompt:

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

Configure dynamic memory recall from an external source:

```yaml
    memory_contract:
      implementation_id: app:memory_store
      context:
        user_id: "${user_id}"
      options:
        max_items: 5
        max_length: 2000
        recall_cooldown: 2
        min_conversation_length: 3
```

The memory contract is called during `runner:step()` to recall relevant items based on the conversation context. Results are injected as developer messages.

| Option | Description |
|--------|-------------|
| `max_items` | Maximum memory items per recall |
| `max_length` | Maximum total character length |
| `recall_cooldown` | Minimum steps between recalls |
| `min_conversation_length` | Minimum conversation turns before first recall |

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

This pattern enables multi-tenant applications where agents are configured per-user or per-workspace and stored outside the framework's registry.

## See Also

- [LLM](llm.md) - Underlying LLM module
- [Building an LLM Agent](../tutorials/llm-agent.md) - Step-by-step tutorial
- [Framework Overview](overview.md) - Framework module usage
