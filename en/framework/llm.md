# LLM

The `wippy/llm` module provides a unified interface for working with Large Language Models from multiple providers (OpenAI, Anthropic, Google, local models). It supports text generation, tool calling, structured output, embeddings, and streaming.

## Setup

Add the module to your project:

```bash
wippy add wippy/llm
wippy install
```

Declare the dependency in your `_index.yaml`. The LLM module requires an environment storage (for API keys) and a process host:

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
```

The `env.storage.os` entry exposes OS environment variables to the LLM providers. Set your API keys as environment variables (e.g. `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`).

## Text Generation

Import the `llm` library into your entry and call `generate()`:

```yaml
entries:
  - name: ask
    kind: function.lua
    source: file://ask.lua
    method: handler
    imports:
      llm: wippy.llm:llm
```

```lua
local llm = require("llm")

local function handler()
    local response, err = llm.generate("What are the three laws of robotics?", {
        model = "gpt-4o"
    })

    if err then
        return nil, err
    end

    return response.result
end

return { handler = handler }
```

The first argument to `generate()` can be a string prompt, a prompt builder, or a table of messages. The second argument is an options table.

### Generate Options

| Option | Type | Description |
|--------|------|-------------|
| `model` | string | Model name or class (required) |
| `temperature` | number | Randomness control, 0-1 |
| `max_tokens` | number | Maximum tokens to generate |
| `top_p` | number | Nucleus sampling parameter |
| `top_k` | number | Top-k filtering |
| `thinking_effort` | number | Thinking depth 0-100 (models with thinking capability) |
| `tools` | table | Array of tool definitions |
| `tool_choice` | string | `"auto"`, `"none"`, `"any"`, or tool name |
| `stream` | table | Streaming config: `{ reply_to, topic, buffer_size }` |
| `timeout` | number | Request timeout in seconds (default 600) |

### Response Structure

| Field | Type | Description |
|-------|------|-------------|
| `result` | string | Generated text content |
| `tokens` | table | Token usage: `prompt_tokens`, `completion_tokens`, `thinking_tokens`, `total_tokens` |
| `finish_reason` | string | Why generation stopped: `"stop"`, `"length"`, `"tool_call"` |
| `tool_calls` | table? | Array of tool calls (if model invoked tools) |
| `metadata` | table | Provider-specific metadata |
| `usage_record` | table? | Usage tracking record |

## Prompt Builder

For multi-turn conversations and complex prompts, use the prompt builder:

```yaml
imports:
  llm: wippy.llm:llm
  prompt: wippy.llm:prompt
```

```lua
local llm = require("llm")
local prompt = require("prompt")

local conversation = prompt.new()
conversation:add_system("You are a helpful assistant.")
conversation:add_user("What is the capital of France?")

local response, err = llm.generate(conversation, {
    model = "gpt-4o",
    temperature = 0.7,
    max_tokens = 500
})
```

### Builder Methods

| Method | Description |
|--------|-------------|
| `prompt.new()` | Create empty builder |
| `prompt.with_system(content)` | Create builder with system message |
| `:add_system(content, meta?)` | Add system message |
| `:add_user(content, meta?)` | Add user message |
| `:add_assistant(content, meta?)` | Add assistant message |
| `:add_developer(content, meta?)` | Add developer message |
| `:add_message(role, content_parts, name?, meta?)` | Add message with role and content parts |
| `:add_function_call(name, args, id?)` | Add tool call from assistant |
| `:add_function_result(name, result, id?)` | Add tool execution result |
| `:add_cache_marker(id?)` | Mark cache boundary (Claude models) |
| `:get_messages()` | Get message array |
| `:build()` | Get `{ messages = ... }` table for `llm.generate()` |
| `:clone()` | Deep copy the builder |
| `:clear()` | Remove all messages |

All `add_*` methods return the builder for chaining.

### Multi-Turn Conversations

Build up context across turns by appending messages:

```lua
local conversation = prompt.new()
conversation:add_system("You are a helpful assistant.")

-- first turn
conversation:add_user("What is Lua?")
local r1 = llm.generate(conversation, { model = "gpt-4o" })
conversation:add_assistant(r1.result)

-- second turn with full context
conversation:add_user("What makes it different from Python?")
local r2 = llm.generate(conversation, { model = "gpt-4o" })
```

### Multimodal Content

Combine text and images in a single message:

```lua
local conversation = prompt.new()
conversation:add_message(prompt.ROLE.USER, {
    prompt.text("What's in this image?"),
    prompt.image("https://example.com/photo.jpg")
})
```

| Function | Description |
|----------|-------------|
| `prompt.text(content)` | Text content part |
| `prompt.image(url, mime_type?)` | Image from URL |
| `prompt.image_base64(mime_type, data)` | Base64-encoded image |

### Role Constants

| Constant | Value |
|----------|-------|
| `prompt.ROLE.SYSTEM` | `"system"` |
| `prompt.ROLE.USER` | `"user"` |
| `prompt.ROLE.ASSISTANT` | `"assistant"` |
| `prompt.ROLE.DEVELOPER` | `"developer"` |
| `prompt.ROLE.FUNCTION_CALL` | `"function_call"` |
| `prompt.ROLE.FUNCTION_RESULT` | `"function_result"` |

### Cloning

Clone a builder to create variations without modifying the original:

```lua
local base = prompt.new()
base:add_system("You are a helpful assistant.")

local conv1 = base:clone()
conv1:add_user("What is AI?")

local conv2 = base:clone()
conv2:add_user("What is ML?")
```

## Streaming

Stream responses in real-time using process communication. This requires a `process.lua` entry:

```lua
local llm = require("llm")

local TOPIC = "llm_stream"

local function main()
    local stream_ch = process.listen(TOPIC)

    local response = llm.generate("Write a short story", {
        model = "gpt-4o",
        stream = {
            reply_to = process.pid(),
            topic = TOPIC,
        },
    })

    while true do
        local chunk, ok = stream_ch:receive()
        if not ok then break end

        if chunk.type == "chunk" then
            io.write(chunk.content)
        elseif chunk.type == "thinking" then
            io.write(chunk.content)
        elseif chunk.type == "error" then
            io.print("Error: " .. chunk.error.message)
            break
        elseif chunk.type == "done" then
            break
        end
    end

    process.unlisten(stream_ch)
end
```

### Chunk Types

| Type | Fields | Description |
|------|--------|-------------|
| `"chunk"` | `content` | Text content fragment |
| `"thinking"` | `content` | Model thinking process |
| `"tool_call"` | `name`, `arguments`, `id` | Tool invocation |
| `"error"` | `error.message`, `error.type` | Stream error |
| `"done"` | `meta` | Stream complete |

<note>
Streaming requires a <code>process.lua</code> entry because it uses Wippy's process communication system (<code>process.pid()</code>, <code>process.listen()</code>).
</note>

## Tool Calling

Define tools as inline schemas and pass them to `generate()`:

```lua
local llm = require("llm")
local prompt = require("prompt")
local json = require("json")

local tools = {
    {
        name = "get_weather",
        description = "Get current weather for a location",
        schema = {
            type = "object",
            properties = {
                location = { type = "string", description = "City name" },
            },
            required = { "location" },
        },
    },
}

local conversation = prompt.new()
conversation:add_user("What's the weather in Tokyo?")

local response = llm.generate(conversation, {
    model = "gpt-4o",
    tools = tools,
    tool_choice = "auto",
})

if response.tool_calls and #response.tool_calls > 0 then
    for _, tc in ipairs(response.tool_calls) do
        -- execute the tool and get a result
        local result = { temperature = 22, condition = "sunny" }

        -- add the exchange to the conversation
        conversation:add_function_call(tc.name, tc.arguments, tc.id)
        conversation:add_function_result(tc.name, json.encode(result), tc.id)
    end

    -- continue generation with tool results
    local final = llm.generate(conversation, { model = "gpt-4o" })
    print(final.result)
end
```

### Tool Call Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique call identifier |
| `name` | string | Tool name |
| `arguments` | table | Parsed arguments matching the schema |

### Tool Choice

| Value | Behavior |
|-------|----------|
| `"auto"` | Model decides when to use tools (default) |
| `"none"` | Never use tools |
| `"any"` | Must use at least one tool |
| `"tool_name"` | Must use the specified tool |

## Structured Output

Generate validated JSON matching a schema:

```lua
local llm = require("llm")

local schema = {
    type = "object",
    properties = {
        name = { type = "string" },
        age = { type = "number" },
        hobbies = {
            type = "array",
            items = { type = "string" },
        },
    },
    required = { "name", "age", "hobbies" },
    additionalProperties = false,
}

local response, err = llm.structured_output(schema, "Describe a fictional character", {
    model = "gpt-4o",
})

if not err then
    print(response.result.name)
    print(response.result.age)
end
```

<tip>
For OpenAI models, all properties must be in the <code>required</code> array. Use union types for optional fields: <code>type = {"string", "null"}</code>. Set <code>additionalProperties = false</code>.
</tip>

## Model Configuration

Models are defined as registry entries with `meta.type: llm.model`:

```yaml
entries:
  - name: gpt-4o
    kind: registry.entry
    meta:
      name: gpt-4o
      type: llm.model
      title: GPT-4o
      comment: OpenAI's flagship model
      capabilities:
        - generate
        - tool_use
        - structured_output
        - vision
      class:
        - balanced
      priority: 100
    max_tokens: 128000
    output_tokens: 16384
    pricing:
      input: 2.5
      output: 10
    providers:
      - id: wippy.llm.openai:provider
        provider_model: gpt-4o
```

### Model Entry Fields

| Field | Description |
|-------|-------------|
| `meta.name` | Model identifier used in API calls |
| `meta.type` | Must be `llm.model` |
| `meta.capabilities` | Feature list: `generate`, `tool_use`, `structured_output`, `embed`, `thinking`, `vision`, `caching` |
| `meta.class` | Class membership: `fast`, `balanced`, `reasoning`, etc. |
| `meta.priority` | Numeric priority for class-based resolution (higher wins) |
| `max_tokens` | Maximum context window |
| `output_tokens` | Maximum output tokens |
| `pricing` | Cost per million tokens: `input`, `output` |
| `providers` | Array with `id` (provider entry) and `provider_model` (provider-specific model name) |

### Local Models

For locally hosted models (LM Studio, Ollama), define a separate provider entry with a custom `base_url`:

```yaml
  - name: local_provider
    kind: registry.entry
    meta:
      name: ollama
      type: llm.provider
      title: Ollama Local
    driver:
      id: wippy.llm.openai:driver
      options:
        api_key_env: none
        base_url: http://127.0.0.1:11434/v1

  - name: local-llama
    kind: registry.entry
    meta:
      name: local-llama
      type: llm.model
      title: Local Llama
      capabilities:
        - generate
    max_tokens: 4096
    output_tokens: 4096
    pricing:
      input: 0
      output: 0
    providers:
      - id: app:local_provider
        provider_model: llama-3.2
```

## Model Resolution

Models can be referenced by exact name, class, or explicit class prefix:

```lua
-- exact model name
llm.generate("Hello", { model = "gpt-4o" })

-- model class (picks highest priority in that class)
llm.generate("Hello", { model = "fast" })

-- explicit class syntax
llm.generate("Hello", { model = "class:reasoning" })
```

Resolution order:
1. Match by exact `meta.name`
2. Match by class name (highest `meta.priority` wins)
3. With `class:` prefix, search only in that class

## Model Discovery

Query available models and their capabilities at runtime:

```lua
local llm = require("llm")

-- all models
local models = llm.available_models()

-- filter by capability
local tool_models = llm.available_models("tool_use")
local embed_models = llm.available_models("embed")

-- list model classes
local classes = llm.get_classes()
for _, c in ipairs(classes) do
    print(c.name .. ": " .. c.title)
end
```

## Embeddings

Generate vector embeddings for semantic search:

```lua
local llm = require("llm")

-- single text
local response = llm.embed("The quick brown fox", {
    model = "text-embedding-3-small",
    dimensions = 512,
})
-- response.result is a float array

-- multiple texts
local response = llm.embed({
    "First document",
    "Second document",
}, { model = "text-embedding-3-small" })
-- response.result is an array of float arrays
```

## Error Handling

Errors are returned as the second return value. On error, the first return value is `nil`:

```lua
local response, err = llm.generate("Hello", { model = "gpt-4o" })

if err then
    io.print("Error: " .. tostring(err))
    return
end

io.print(response.result)
```

### Error Types

| Constant | Description |
|----------|-------------|
| `llm.ERROR_TYPE.INVALID_REQUEST` | Malformed request |
| `llm.ERROR_TYPE.AUTHENTICATION` | Invalid API key |
| `llm.ERROR_TYPE.RATE_LIMIT` | Provider rate limit exceeded |
| `llm.ERROR_TYPE.SERVER_ERROR` | Provider server error |
| `llm.ERROR_TYPE.CONTEXT_LENGTH` | Input exceeds context window |
| `llm.ERROR_TYPE.CONTENT_FILTER` | Content filtered by safety systems |
| `llm.ERROR_TYPE.TIMEOUT` | Request timed out |
| `llm.ERROR_TYPE.MODEL_ERROR` | Invalid or unavailable model |

### Finish Reasons

| Constant | Description |
|----------|-------------|
| `llm.FINISH_REASON.STOP` | Normal completion |
| `llm.FINISH_REASON.LENGTH` | Reached max tokens |
| `llm.FINISH_REASON.CONTENT_FILTER` | Content filtered |
| `llm.FINISH_REASON.TOOL_CALL` | Model made a tool call |
| `llm.FINISH_REASON.ERROR` | Error during generation |

## Capabilities

| Constant | Description |
|----------|-------------|
| `llm.CAPABILITY.GENERATE` | Text generation |
| `llm.CAPABILITY.TOOL_USE` | Tool/function calling |
| `llm.CAPABILITY.STRUCTURED_OUTPUT` | JSON structured output |
| `llm.CAPABILITY.EMBED` | Vector embeddings |
| `llm.CAPABILITY.THINKING` | Extended thinking |
| `llm.CAPABILITY.VISION` | Image understanding |
| `llm.CAPABILITY.CACHING` | Prompt caching |

## See Also

- [Agents](agents.md) - Agent framework with tools, delegates, and memory
- [Building an LLM Agent](../tutorials/llm-agent.md) - Step-by-step tutorial
- [Framework Overview](overview.md) - Framework module usage
