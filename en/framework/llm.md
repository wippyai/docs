---
title: "LLM"
description: "Use wippy/llm for generation, prompts, streaming, tools, structured output, model selection, and embeddings."
---

# LLM

The `wippy/llm` module provides one interface for language models from OpenAI, Anthropic, Google, and local providers. It supports text generation, tool calling, structured output, embeddings, and streaming.

This page is an API primer with composable reference snippets, not a standalone tutorial. The snippets assume an existing Wippy project, a registered model and provider, and any credentials required by that provider. Replace example model names with one your registry exposes; remote generation and embedding calls may incur provider charges. For a complete runnable project, follow [Build an LLM Agent](tutorials/llm-agent.md).

## Setup

Add the module to your project:

```bash
wippy add wippy/llm
wippy install
```

Declare the dependency in your `_index.yaml`:

```yaml
version: "1.0"
namespace: app

entries:
  - name: dep.llm
    kind: ns.dependency
    component: wippy/llm
    version: "*"
```

The module supplies an OS environment storage and defaults its background
process host to `wippy.terminal:host`. Override the `env_storage` or
`process_host` dependency parameter only when the application needs a different
entry. Set provider API keys through variables such as `OPENAI_API_KEY` and
`ANTHROPIC_API_KEY`.

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
| `temperature` | number | Randomness control, 0-2 (provider support may vary) |
| `max_tokens` | number | Maximum tokens to generate |
| `top_p` | number | Nucleus sampling parameter |
| `top_k` | number | Top-k filtering |
| `thinking_effort` | number | Thinking depth 0-100 (models with thinking capability) |
| `tools` | table | Array of tool definitions |
| `tool_choice` | string | `"auto"`, `"none"`, `"any"`, or tool name |
| `stream` | table | Streaming config: `{ reply_to, topic, buffer_size }` |
| `timeout` | number/string | Whole HTTP request timeout: seconds or a duration string such as `"20m"` |
| `deadline_ms` | number | Total call budget in milliseconds across retries and fallback routes |
| `retry` | table/false | Transport retries: `{ attempts, backoff_ms }`; `false` disables retries |
| `cancel` | channel | Closing the channel cancels the in-flight provider call |

### Timeouts and Retries

Every driver accepts seconds as a number or numeric string (`90`, `"90"`), or a duration string (`"20m"`). For generation and structured output, timeout precedence is:

1. Call `options.timeout`.
2. Route `options.timeout`.
3. Route `context.timeout`.
4. Provider `driver.options.timeout`, its `timeout_env` reference, then the driver's environment variable.
5. 600 seconds.

Nil, empty and unset values fall through. Invalid or non-positive values return `invalid_request` naming the value and source. The environment variables are `ANTHROPIC_TIMEOUT`, `BEDROCK_TIMEOUT`, `OPENAI_TIMEOUT`, `OPENAI_COMPAT_TIMEOUT`, `VERTEX_AI_TIMEOUT` and `GEN_AI_TIMEOUT`. TypeSafe evaluation uses `TYPESAFE_TIMEOUT` and a 60-second default.

The timeout covers the whole HTTP request, including reading a stream; it does not reset between chunks. Each retry gets its own timeout. `deadline_ms` limits each request to the remaining call budget, prevents retries whose backoff would exhaust it, and prevents a fallback from starting with less than five seconds left.

```lua
local response, err = llm.generate("Explain coroutines", {
    model = "gpt-4o",
    timeout = "20m",
    deadline_ms = 1200000,
    retry = { attempts = 2, backoff_ms = 500 },
})
```

`attempts` counts retries after the first request (maximum 10). Backoff doubles from `backoff_ms` and is capped at 60000 ms. Drivers retry transient connection and HTTP failures before reading the response body; they do not replay a stream after output starts. Status probes send one request.

### Response Structure

| Field | Type | Description |
|-------|------|-------------|
| `result` | string | Generated text content |
| `tokens` | table | Token usage: `prompt_tokens`, `completion_tokens`, `thinking_tokens`, `total_tokens`, and normalized `context_tokens` (full input, including cached input), plus optional cache counters |
| `finish_reason` | string | Why generation stopped: `"stop"`, `"length"`, `"tool_call"`, `"filtered"`, `"error"`, `"cancelled"` |
| `tool_calls` | table? | Array of tool calls (if model invoked tools) |
| `metadata` | table | Provider-specific metadata, including `route` (resolved route), `adjusted` (option adjustments) and, on Claude and Bedrock, `input_transformations` (thinking binding reports) |
| `usage_record` | table? | Usage tracking record |

## Prompt Builder

Use the prompt builder to construct multi-turn conversations and structured messages:

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
| `:add_function_call(name, arguments, id?, options?)` | Add tool call from assistant (`arguments` is the raw JSON string) |
| `:add_function_result(name, result, id?, options?)` | Add tool result; `options.is_error = true` marks a failed result |
| `:add_cache_marker(id?)` | Mark cache boundary (Claude models) |
| `:get_messages()` | Get message array |
| `:build()` | Get `{ messages = ... }` table for `llm.generate()` |
| `:clone()` | Deep copy the builder |
| `:clear()` | Remove all messages |

All `add_*` methods return the builder for chaining.

### Positional Notes

Use `metadata.preserve_position` for context that belongs at a particular point in the conversation:

```lua
conversation:add_user("What is on my calendar?")
conversation:add_system("The current time is 09:41 UTC.", {
    preserve_position = true,
})
```

System and developer notes with this flag stay in place on every driver and do not merge with neighbouring messages. Claude and Bedrock append separate text blocks to the preceding user/tool-result turn, or open a user turn after an assistant. Google sends a user turn, OpenAI Responses keeps the note in `input`, and OpenAI-compatible sends a system message in place. Claude and Bedrock wrap developer text in `<developer-instruction>` tags; positional system text is unwrapped.

Render changing context once and persist it where it was sent. Rebuilding, moving or removing a note edits the prefix before the output it produced, restarting the prompt cache there and invalidating later thinking blocks. When slicing history, keep or drop a note with the message it follows.

### Blank Content

Text is blank when it contains no non-whitespace character. Blank user, system and developer text is omitted; images beside it remain, and tool results are unchanged. After consolidating assistant and function-call rows, a turn with neither visible text nor a call is omitted with its thinking. Whitespace-only assistant text is also omitted beside a call; visible text retains its outer whitespace.

An empty mapped conversation fails with `invalid_request` before HTTP dispatch on Claude, Bedrock, Google and OpenAI Responses. A positional system note alone is valid on OpenAI Responses; OpenAI-compatible also accepts an ordinary system message alone.

### Multi-Turn Conversations

Build up context across turns by appending messages:

```lua
local conversation = prompt.new()
conversation:add_system("You are a helpful assistant.")

-- first turn
conversation:add_user("What is Lua?")
local r1, err = llm.generate(conversation, { model = "gpt-4o" })
if err then return nil, err end
conversation:add_assistant(r1.result, r1.metadata)

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
| `prompt.ROLE.CACHE_MARKER` | `"cache_marker"` |

### Cloning

Clone a builder to create independent variations:

```lua
local base = prompt.new()
base:add_system("You are a helpful assistant.")

local conv1 = base:clone()
conv1:add_user("What is AI?")

local conv2 = base:clone()
conv2:add_user("What is ML?")
```

## Streaming

Stream responses through process communication. Streaming requires a `process.lua` entry:

```lua
local llm = require("llm")

local TOPIC = "llm_stream"

local function main()
    local stream_ch, listen_err = process.listen(TOPIC)
    if listen_err then
        return nil, listen_err
    end

    local function finish(text, response, err)
        local ok, cleanup_err = process.unlisten(stream_ch)
        if not ok then
            cleanup_err = cleanup_err or "Failed to remove LLM stream listener"
            if err then
                return nil, tostring(err) .. "; cleanup failed: " .. tostring(cleanup_err)
            end
            return nil, cleanup_err
        end
        if err then
            return nil, err
        end
        return text, response
    end

    local self_pid, pid_err = process.pid()
    if pid_err then
        return finish(nil, nil, pid_err)
    end

    local done_ch = channel.new(1)
    coroutine.spawn(function()
        local response, err = llm.generate("Write a short story", {
            model = "gpt-4o",
            stream = {
                reply_to = self_pid,
                topic = TOPIC,
            },
        })
        done_ch:send({ response = response, err = err })
    end)

    local full_text = ""
    local generation_result = nil
    local stream_done = false
    local stream_err = nil

    while true do
        local cases = {}
        if not stream_done then
            table.insert(cases, stream_ch:case_receive())
        end
        if not generation_result then
            table.insert(cases, done_ch:case_receive())
        end

        local result = channel.select(cases)
        if not result.ok then
            return finish(nil, nil, "LLM stream closed before completion")
        end

        if result.channel == done_ch then
            generation_result = result.value
            if generation_result.err then
                return finish(nil, nil, generation_result.err)
            end
            if stream_done then
                return finish(full_text, generation_result.response, stream_err)
            end
        else
            local chunk = result.value
            if chunk.type == "chunk" then
                local content = chunk.content or ""
                print(content)
                full_text = full_text .. content
            elseif chunk.type == "thinking" then
                print(chunk.content or "")
            elseif chunk.type == "error" then
                stream_done = true
                stream_err = chunk.error and chunk.error.message or "LLM stream failed"
            elseif chunk.type == "done" then
                stream_done = true
            end

            if stream_done and generation_result then
                return finish(full_text, generation_result.response, stream_err)
            end
        end
    end
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
Run generation in a separate coroutine so the listener drains chunks concurrently, and remove the listener on every return path.
</note>

Closing an `options.cancel` channel aborts the provider request and returns
`finish_reason = "cancelled"` with text streamed so far. A streamed call with
`cancel` is relayed through the calling process and must run in a process.

## Tool Calling

Define tools with inline schemas and pass them to `generate()`:

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

local response, err = llm.generate(conversation, {
    model = "gpt-4o",
    tools = tools,
    tool_choice = "auto",
})
if err then return nil, err end

conversation:add_assistant(response.result or "", response.metadata)

if response.tool_calls and #response.tool_calls > 0 then
    -- Keep all calls together, followed by all results.
    for _, tc in ipairs(response.tool_calls) do
        conversation:add_function_call(tc.name, json.encode(tc.arguments), tc.id, {
            provider_metadata = tc.provider_metadata,
        })
    end
    for _, tc in ipairs(response.tool_calls) do
        -- execute the tool and get a result
        local result = { temperature = 22, condition = "sunny" }

        conversation:add_function_result(tc.name, json.encode(result), tc.id)
    end

    -- continue generation with tool results
    local final, final_err = llm.generate(conversation, {
        model = "gpt-4o",
        route = response.metadata.route,
        tools = tools,
    })
    if final_err then return nil, final_err end
    print(final.result)
end
```

### Tool Call Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique call identifier; reuse it unchanged for the result |
| `name` | string | Tool name |
| `arguments` | table | Parsed arguments matching the schema |
| `provider_metadata` | table? | Preserve through `add_function_call` options, including Google thought signatures and provider IDs |

Histories can contain IDs from another provider. Claude accepts `[a-zA-Z0-9_-]+`; Bedrock adds a 64-character limit, and OpenAI Responses limits IDs to 64 characters. Those drivers keep accepted IDs and deterministically translate foreign IDs on both the call and result to a bounded `tool-` plus SHA-256 digest, checking collisions. Stored IDs stay unchanged. OpenAI-compatible sends IDs unchanged; Google associates results using its own ID or the tool name.

### Tool Choice

| Value | Behavior |
|-------|----------|
| `"auto"` | Model decides when to use tools (default) |
| `"none"` | Never use tools |
| `"any"` | Must use at least one tool |
| `"tool_name"` | Must use the specified tool |

## Structured Output

Generate JSON validated against a schema:

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

Define models as registry entries with `meta.type: llm.model`:

```yaml
entries:
  - name: gpt-4o
    kind: registry.entry
    meta:
      name: gpt-4o
      type: llm.model
      title: GPT-4o
      comment: Text generation and tool use
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
| `providers` | Array of routes: `id` (provider entry), `provider_model` (provider-specific model name), optional route facts, `options` and `context` (see [Provider Routes](#provider-routes)) |

### Provider Routes

Each entry in `providers` is a route to one provider. Besides `id` and `provider_model`, a route can declare what the model accepts on the wire, request defaults, and connection settings:

```yaml
    providers:
      - id: wippy.llm.claude:provider
        provider_model: claude-sonnet-5-5
        thinking: always
        sampling: false
        forced_tool_choice: false
        structured_output: native
        options:
          thinking_effort: 40
```

| Field | Description |
|-------|-------------|
| `thinking` | How thinking is encoded: `adaptive`, `budget`, `none`, or `always` |
| `sampling` | `false` when the model rejects `temperature`, `top_p` and `top_k`; they are removed from requests |
| `forced_tool_choice` | `false` when the model rejects `tool_choice = "any"` or a named tool |
| `structured_output` | `native` (JSON schema output) or `tool` (a structured-output tool) |
| `options` | Request defaults for this route; caller options override them |
| `context` | Connection settings passed to the provider (for example `beta_features`) |

Missing facts keep each driver's defaults. A value a driver cannot honor fails with `invalid_request` naming the fact and the supported values.

#### Thinking

| Value | Use for | Effort 0 or unset | Effort above 0 |
|-------|---------|-------------------|----------------|
| `always` | Models whose thinking cannot be turned off: Claude Opus, Sonnet and Haiku 5.5, Opus 5, Sonnet 5, Fable | Thinking on, model's default effort | Thinking on, effort from `thinking_effort` |
| `adaptive` | Models where thinking is optional: Claude Opus 4.6, 4.7, 4.8, Sonnet 4.6 | No thinking fields sent | Adaptive thinking, effort from `thinking_effort` |
| `budget` | Models with token-budget thinking, such as Claude Haiku 4.5 | No thinking fields sent | Thinking budget derived from `thinking_effort` |
| `none` | Models without thinking | No thinking fields sent | `thinking_effort` is removed and reported in `metadata.adjusted` |

`always` is supported by the Claude and Bedrock drivers. Declare `none` only for models that do not think when the thinking field is omitted. A route that declares `adaptive` for a 5.5 model keeps working, but sends no thinking object at effort 0; change it to `always`.

`thinking_effort` maps to effort levels: below 20 is `low`, 20 to 50 `medium`, 51 to 79 `high`, 80 to 99 `xhigh`, 100 `max`. To give default agents a fixed effort on an `always` route, set `options.thinking_effort` on the route.

#### Thinking Blocks Across Agents

A Claude thinking block is bound to the system prompt, tool list and earlier messages that produced it. Claude and Bedrock preserve blocks in `metadata.thinking_blocks`. When replaying blocks with a final thinking object of type `adaptive` or `enabled`, the drivers set `thinking.block_binding.prefix_mismatch_behavior = "drop_block"` unless a binding was already supplied, and send the `thinking-binding-controls-2026-08-01` beta. This applies after merging `options.request`, for generation and structured output. An endpoint that rejects the beta returns its own error.

The API can drop the first mismatched block and all later thinking blocks for that request. Stored history remains unchanged, so the drops can recur on later requests. Blocks from another model are passed back unchanged for the provider to assess. `response.metadata.input_transformations` reports the transformations, including `thinking_dropped` with `prefix_binding_mismatch` or `model_binding_mismatch`; ignore unknown types and reasons. Claude streams capture the array from `message_start`, but do not capture a revised array after a server-side fallback in the closing `message_delta`. Bedrock reads it from `messageStop`.

At zero effort, `always` still sends a thinking object that can carry the binding. `adaptive`, `budget` and `none` without enabled thinking do not; direct callers must keep histories append-only when replaying blocks unbound. Blocks marked `metadata.stale_thinking` are omitted when the final thinking object cannot carry a binding.

Persist `metadata.content_positions` beside `thinking_blocks` on the assistant row when present. It preserves interleaved thinking, text and calls; consecutive function-call rows belong to the same response, so append all calls before their results. Older rows without positions replay thinking, then text, then calls. Each emitted assistant turn drops trailing thinking. If calls are removed, thinking after the last remaining text or call is also omitted.

Claude Sonnet 5.5's `between_tools` thinking cannot carry this setting. Agent hosts that pass `drop_stale_thinking`, including session and dataflow, remove blocks bound to an earlier prefix before such a request, so those blocks are lost rather than failing. A direct caller replaying blocks on `between_tools` still fails after a history edit on accounts where the check is enforced. Routes that should keep thinking across handoffs use `thinking: always` with a low `options.thinking_effort`.

#### Provider Request Fields

`options.request` carries provider wire fields that the generate options do not model. The driver maps every option first, then merges `request` into the request body: maps merge, other values replace, and `request` wins on conflict.

```yaml
        options:
          request:
            output_config:
              task_budget: { type: tokens, total: 64000 }
```

- Fields the driver builds itself (messages, system prompt, tools, tool choice, streaming) and, for structured output, the fields that carry the output schema cannot be set; such a request fails with `invalid_request` naming the field.
- `request` is raw wire data: route facts, the `output_tokens` cap and `metadata.adjusted` describe the generate options, not `request`.
- On a catalog model, `request` comes from the route; a caller passing `request` is rejected. Direct calls with `provider_id` may pass it.
- `request` applies to `generate` and `structured_output`.

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
      id: wippy.llm.openai_compat:driver
      options:
        api_key: ollama
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

### Fallback and Context Admission

Resolved calls try provider routes by descending route `priority`, preserving list order on ties. A class request can then try remaining class members by model priority, followed by the first card's `fallback` list. At most four provider candidates share the call deadline. Exact model names do not inherit class fallback. Per-call `fallback = { "other-model" }` replaces model fallbacks; `fallback = false` disables all fallback. A `route` taken from `response.metadata.route` pins one route. Direct `provider_id` calls and status probes do not fall back; embeddings switch only between routes of the same model.

Default fallback errors are `rate_limit_exceeded`, `payment_required`, `server_error`, `timeout_error` and `network_error`; a non-empty `fallback_on` replaces this set. Class selection can also advance after authentication, model and context-length errors. A stream switches only when the driver reports that no output has started. Successful calls report earlier failures in `metadata.fallbacks` and the answering model/provider in `metadata.route`.

Before dispatch, generation and structured output estimate text and request structure against the model card's `max_tokens` window, reserving the effective output budget. A requested output above `output_tokens` is capped and reported in `metadata.adjusted`; `strict = true` rejects adjustments. An optional `checkpoint = { token_threshold, compact = function(info) ... end }` can return a replacement prompt, which is checked once. A prompt that still does not fit returns `context_window` details, including estimated prompt tokens and requested output tokens. Estimates use four bytes per token; unknown image/document costs are reported as `unestimated_media_parts`, and providers still enforce their own limits.

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

-- A single input still returns an array of vectors.
local single_response, single_err = llm.embed("The quick brown fox", {
    model = "text-embedding-3-small",
    dimensions = 512,
})
if single_err then
    error("Embedding failed: " .. tostring(single_err))
end
local vector = single_response.result[1]

-- Multiple inputs return one vector per input.
local batch_response, batch_err = llm.embed({
    "First document",
    "Second document",
}, { model = "text-embedding-3-small" })
if batch_err then
    error("Batch embedding failed: " .. tostring(batch_err))
end
local vectors = batch_response.result
```

## Provider Status

Probe a provider before sending work, such as during readiness checks:

```lua
local status, err = llm.status({
    model = "gpt-4o",
})
```

| Option | Description |
|--------|-------------|
| `model` | Required. Model to check. |
| `provider_id` | Optional. Skip model resolution and target a specific provider. |

Returns the provider's `StatusResponse` (contents are provider-dependent).

## Error Handling

Errors are returned as the second return value. On error, the first return value is `nil`:

```lua
local response, err = llm.generate("Hello", { model = "gpt-4o" })

if err then
    print("Error: " .. tostring(err))
    return
end

print(response.result)
```

Errors are native `errors` values with `:message()`, `:kind()`, `:retryable()` and `:details()`. Driver error types appear in `details.error_type`; the native kind alone does not distinguish all provider failures.

### Error Types

| Constant | Description |
|----------|-------------|
| `llm.ERROR_TYPE.INVALID_REQUEST` | Malformed request |
| `llm.ERROR_TYPE.AUTHENTICATION` | Invalid API key |
| `llm.ERROR_TYPE.RATE_LIMIT` | Provider rate limit exceeded |
| `llm.ERROR_TYPE.PAYMENT_REQUIRED` | Exhausted quota or payment required; non-retryable within the provider |
| `llm.ERROR_TYPE.SERVER_ERROR` | Provider server error |
| `llm.ERROR_TYPE.CONTEXT_LENGTH` | Input exceeds context window |
| `llm.ERROR_TYPE.CONTEXT_WINDOW` | Local context admission rejected the prompt |
| `llm.ERROR_TYPE.CONTENT_FILTER` | Content filtered by safety systems |
| `llm.ERROR_TYPE.TIMEOUT` | Request timed out |
| `llm.ERROR_TYPE.MODEL_ERROR` | Invalid or unavailable model |
| `llm.ERROR_TYPE.NETWORK_ERROR` | Transport failure |

### Finish Reasons

| Constant | Description |
|----------|-------------|
| `llm.FINISH_REASON.STOP` | Normal completion |
| `llm.FINISH_REASON.LENGTH` | Reached max tokens |
| `llm.FINISH_REASON.CONTENT_FILTER` | Content filtered |
| `llm.FINISH_REASON.TOOL_CALL` | Model made a tool call |
| `llm.FINISH_REASON.ERROR` | Error during generation |
| `llm.FINISH_REASON.CANCELLED` | Caller cancelled generation; `result` keeps text streamed so far |

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

- [Agents](framework/agents.md) — Agent framework with tools, delegates, and memory
- [Building an LLM Agent](../tutorials/llm-agent.md) — Build an agent step by step
- [Framework Overview](framework/overview.md) — Install and import framework modules
