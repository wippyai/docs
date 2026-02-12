# LLM Agent

Build a terminal chat agent step by step, progressing from a simple LLM call to a streaming agent with tools.

## What We're Building

A terminal chat agent that:
- Generates text with an LLM
- Maintains multi-turn conversations
- Streams responses in real-time
- Uses tools to access external capabilities

## Project Structure

```
llm-agent/
├── .wippy.yaml
├── wippy.lock
└── src/
    ├── _index.yaml
    ├── ask.lua
    ├── chat.lua
    └── tools/
        ├── _index.yaml
        ├── current_time.lua
        └── calculate.lua
```

## Phase 1: Simple Generation

Start with a basic function that calls `llm.generate()` with a string prompt.

### Create the Project

```bash
mkdir llm-agent && cd llm-agent
mkdir -p src
```

### Entry Definitions

Create `src/_index.yaml`:

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

  - name: ask
    kind: function.lua
    source: file://ask.lua
    method: handler
    imports:
      llm: wippy.llm:llm
```

The LLM module needs two infrastructure entries:
- `env.storage.os` provides API keys from environment variables
- `process.host` provides the process runtime the LLM module uses internally

### Generation Code

Create `src/ask.lua`:

```lua
local llm = require("llm")

local function handler(input)
    local response, err = llm.generate(input, {
        model = "gpt-4.1-nano",
        temperature = 0.7,
        max_tokens = 512,
    })

    if err then
        return nil, err
    end

    return response.result
end

return { handler = handler }
```

### Model Definition

The LLM module resolves models from the registry. Add a model entry to `_index.yaml`:

```yaml
  - name: gpt-4.1-nano
    kind: registry.entry
    meta:
      name: gpt-4.1-nano
      type: llm.model
      title: GPT-4.1 Nano
      comment: Fast, affordable model
      capabilities:
        - generate
        - tool_use
        - structured_output
      class:
        - fast
      priority: 100
    max_tokens: 1047576
    output_tokens: 32768
    pricing:
      input: 0.1
      output: 0.4
    providers:
      - id: wippy.llm.openai:provider
        provider_model: gpt-4.1-nano
```

### Initialize and Test

```bash
wippy init
wippy run -x app:ask "What is the capital of France?"
```

This calls the function directly and prints the result. The model definition tells the LLM module which provider to use and what model name to send to the API.

## Phase 2: Conversations

Upgrade from a single call to a multi-turn conversation using the prompt builder. Change the entry from a function to a process with terminal I/O.

### Update Entry Definitions

Replace the `ask` entry with a `chat` process and add the terminal dependency:

```yaml
  - name: dep.terminal
    kind: ns.dependency
    component: wippy/terminal
    version: "*"

  - name: chat
    kind: process.lua
    meta:
      command:
        name: chat
        short: Start a terminal chat
    source: file://chat.lua
    method: main
    modules:
      - io
      - process
    imports:
      llm: wippy.llm:llm
      prompt: wippy.llm:prompt
```

### Chat Process

Create `src/chat.lua`:

```lua
local io = require("io")
local llm = require("llm")
local prompt = require("prompt")

local function main()
    io.print("Chat (type 'quit' to exit)")
    io.print("")

    local conversation = prompt.new()
    conversation:add_system("You are a helpful assistant. Be concise and direct.")

    while true do
        io.write("> ")
        io.flush()
        local input = io.readline()
        if not input or input == "quit" or input == "exit" then break end
        if input == "" then goto continue end

        conversation:add_user(input)

        local response, err = llm.generate(conversation, {
            model = "gpt-4.1-nano",
            temperature = 0.7,
            max_tokens = 1024,
        })

        if err then
            io.print("Error: " .. tostring(err))
            goto continue
        end

        io.print(response.result)
        io.print("")
        conversation:add_assistant(response.result)

        ::continue::
    end

    io.print("Bye!")
end

return { main = main }
```

### Run It

```bash
wippy update
wippy run chat
```

The prompt builder maintains the full conversation history. Each turn appends the user message and assistant response, giving the model context of prior exchanges.

## Phase 3: Agent Framework

The agent module provides a higher-level abstraction over raw LLM calls. Agents are defined declaratively with a prompt, model, and tools, then loaded and executed through a context/runner pattern.

### Add Agent Dependency

Add to `_index.yaml`:

```yaml
  - name: dep.agent
    kind: ns.dependency
    component: wippy/agent
    version: "*"
    parameters:
      - name: process_host
        value: app:processes
```

### Define an Agent

Add an agent entry:

```yaml
  - name: assistant
    kind: registry.entry
    meta:
      type: agent.gen1
      name: assistant
      title: Assistant
      comment: Terminal chat agent
    prompt: |
      You are a helpful terminal assistant. Be concise and direct.
      Answer questions clearly. If you don't know something, say so.
      Do not use emoji in responses.
    model: gpt-4.1-nano
    max_tokens: 1024
    temperature: 0.7
```

### Update the Chat Process

Switch to the agent framework. Update the entry imports:

```yaml
  - name: chat
    kind: process.lua
    meta:
      command:
        name: chat
        short: Start a terminal chat
    source: file://chat.lua
    method: main
    modules:
      - io
      - process
    imports:
      prompt: wippy.llm:prompt
      agent_context: wippy.agent:context
```

Update `src/chat.lua`:

```lua
local io = require("io")
local prompt = require("prompt")
local agent_context = require("agent_context")

local function main()
    io.print("Chat (type 'quit' to exit)")
    io.print("")

    local ctx = agent_context.new()
    local runner, err = ctx:load_agent("app:assistant")
    if err then
        io.print("Failed to load agent: " .. tostring(err))
        return
    end

    local conversation = prompt.new()

    while true do
        io.write("> ")
        io.flush()
        local input = io.readline()
        if not input or input == "quit" or input == "exit" then break end
        if input == "" then goto continue end

        conversation:add_user(input)

        local response, gen_err = runner:step(conversation)
        if gen_err then
            io.print("Error: " .. tostring(gen_err))
            goto continue
        end

        io.print(response.result)
        io.print("")
        conversation:add_assistant(response.result)

        ::continue::
    end

    io.print("Bye!")
end

return { main = main }
```

The agent framework separates the agent definition (prompt, model, parameters) from the execution logic. The same agent can be loaded with different contexts, tools, and models at runtime.

## Phase 4: Streaming

Stream responses token-by-token instead of waiting for the full response.

### Update Modules

Add `channel` to the process modules:

```yaml
    modules:
      - io
      - process
      - channel
```

### Streaming Implementation

Update `src/chat.lua`:

```lua
local io = require("io")
local prompt = require("prompt")
local agent_context = require("agent_context")

local STREAM_TOPIC = "stream"

local function stream_response(runner, conversation, stream_ch)
    local done_ch = channel.new(1)

    coroutine.spawn(function()
        local response, err = runner:step(conversation, {
            stream_target = {
                reply_to = process.pid(),
                topic = STREAM_TOPIC,
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
            local r = result.value
            return full_text, r.response, r.err
        end

        local chunk = result.value
        if chunk.type == "chunk" then
            io.write(chunk.content or "")
            full_text = full_text .. (chunk.content or "")
        elseif chunk.type == "done" then
            local r, ok = done_ch:receive()
            if ok and r then
                return full_text, r.response, r.err
            end
            return full_text, nil, nil
        elseif chunk.type == "error" then
            return nil, nil, chunk.error and chunk.error.message or "stream error"
        end
    end

    return full_text, nil, nil
end

local function main()
    io.print("Chat (type 'quit' to exit)")
    io.print("")

    local ctx = agent_context.new()
    local runner, err = ctx:load_agent("app:assistant")
    if err then
        io.print("Failed to load agent: " .. tostring(err))
        return
    end

    local conversation = prompt.new()
    local stream_ch = process.listen(STREAM_TOPIC)

    while true do
        io.write("> ")
        io.flush()
        local input = io.readline()
        if not input or input == "quit" or input == "exit" then break end
        if input == "" then goto continue end

        conversation:add_user(input)

        local text, _, gen_err = stream_response(runner, conversation, stream_ch)
        if gen_err then
            io.print("Error: " .. tostring(gen_err))
            goto continue
        end

        io.print("")
        if text and text ~= "" then
            conversation:add_assistant(text)
        end

        ::continue::
    end

    process.unlisten(stream_ch)
    io.print("Bye!")
end

return { main = main }
```

Key patterns:
- `coroutine.spawn` runs `runner:step()` in a separate coroutine so the main coroutine can process stream chunks
- `channel.select` multiplexes the stream channel and done channel
- A single `process.listen()` is created once and reused across turns
- Text is accumulated for adding to the conversation history

## Phase 5: Tools

Give the agent tools it can call to access external capabilities.

### Define Tools

Create `src/tools/_index.yaml`:

```yaml
version: "1.0"
namespace: app.tools

entries:
  - name: current_time
    kind: function.lua
    meta:
      type: tool
      title: Current Time
      input_schema: |
        { "type": "object", "properties": {}, "additionalProperties": false }
      llm_alias: get_current_time
      llm_description: Get the current date and time in UTC.
    source: file://current_time.lua
    modules: [time]
    method: handler

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
      llm_description: Evaluate a mathematical expression and return the result.
    source: file://calculate.lua
    modules: [expr]
    method: handler
```

Tool metadata tells the LLM what the tool does:
- `input_schema` is a JSON Schema defining the arguments
- `llm_alias` is the function name the LLM sees
- `llm_description` explains when to use the tool

### Implement Tools

Create `src/tools/current_time.lua`:

```lua
local time = require("time")

local function handler()
    local now = time.now()
    return {
        utc = now:format("2006-01-02T15:04:05Z"),
        unix = now:unix(),
    }
end

return { handler = handler }
```

Create `src/tools/calculate.lua`:

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

### Register Tools with the Agent

Update the agent entry in `src/_index.yaml` to reference the tools:

```yaml
  - name: assistant
    kind: registry.entry
    meta:
      type: agent.gen1
      name: assistant
      title: Assistant
      comment: Terminal chat agent
    prompt: |
      You are a helpful terminal assistant. Be concise and direct.
      Answer questions clearly. If you don't know something, say so.
      Use tools when they help answer the question.
      Do not use emoji in responses.
    model: gpt-4.1-nano
    max_tokens: 1024
    temperature: 0.7
    tools:
      - app.tools:current_time
      - app.tools:calculate
```

### Add Tool Execution

Update the chat process modules to include `json` and `funcs`:

```yaml
    modules:
      - io
      - json
      - process
      - channel
      - funcs
```

Update `src/chat.lua` with tool execution:

```lua
local io = require("io")
local json = require("json")
local funcs = require("funcs")
local prompt = require("prompt")
local agent_context = require("agent_context")

local STREAM_TOPIC = "stream"

local function stream_response(runner, conversation, stream_ch)
    local done_ch = channel.new(1)

    coroutine.spawn(function()
        local response, err = runner:step(conversation, {
            stream_target = {
                reply_to = process.pid(),
                topic = STREAM_TOPIC,
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
            local r = result.value
            return full_text, r.response, r.err
        end

        local chunk = result.value
        if chunk.type == "chunk" then
            io.write(chunk.content or "")
            full_text = full_text .. (chunk.content or "")
        elseif chunk.type == "done" then
            local r, ok = done_ch:receive()
            if ok and r then
                return full_text, r.response, r.err
            end
            return full_text, nil, nil
        elseif chunk.type == "error" then
            return nil, nil, chunk.error and chunk.error.message or "stream error"
        end
    end

    return full_text, nil, nil
end

local function execute_tools(tool_calls)
    local results = {}
    for _, tc in ipairs(tool_calls) do
        local args = tc.arguments
        if type(args) == "string" then
            args = json.decode(args) or {}
        end

        io.write("[" .. tc.name .. "] ")
        io.flush()

        local result, err = funcs.call(tc.registry_id, args)
        if err then
            results[tc.id] = { error = tostring(err) }
            io.print("error")
        else
            results[tc.id] = result
            io.print("done")
        end
    end
    return results
end

local function run_turn(runner, conversation, stream_ch)
    while true do
        local text, response, err = stream_response(runner, conversation, stream_ch)
        if err then
            io.print("")
            return nil, err
        end

        if text and text ~= "" then
            io.print("")
        end

        local tool_calls = response and response.tool_calls
        if not tool_calls or #tool_calls == 0 then
            return text, nil
        end

        if text and text ~= "" then
            conversation:add_assistant(text)
        end

        local results = execute_tools(tool_calls)

        for _, tc in ipairs(tool_calls) do
            local result = results[tc.id]
            local result_str = json.encode(result) or "{}"
            conversation:add_function_call(tc.name, tc.arguments, tc.id)
            conversation:add_function_result(tc.name, result_str, tc.id)
        end
    end
end

local function main()
    io.print("Terminal Agent (type 'quit' to exit)")
    io.print("")

    local ctx = agent_context.new()
    local runner, err = ctx:load_agent("app:assistant")
    if err then
        io.print("Failed to load agent: " .. tostring(err))
        return
    end

    local conversation = prompt.new()
    local stream_ch = process.listen(STREAM_TOPIC)

    while true do
        io.write("> ")
        io.flush()
        local input = io.readline()
        if not input or input == "quit" or input == "exit" then break end
        if input == "" then goto continue end

        conversation:add_user(input)

        local text, gen_err = run_turn(runner, conversation, stream_ch)
        if gen_err then
            io.print("Error: " .. tostring(gen_err))
            goto continue
        end
        if text and text ~= "" then
            conversation:add_assistant(text)
        end

        ::continue::
    end

    process.unlisten(stream_ch)
    io.print("Bye!")
end

return { main = main }
```

The tool execution loop:
1. Call `runner:step()` with streaming
2. If the response contains `tool_calls`, execute each tool via `funcs.call()`
3. Add the tool calls and results to the conversation
4. Loop back to step 1 for the agent to incorporate the results
5. When no more tool calls, return the final text

### Run the Agent

```bash
wippy update
wippy run chat
```

```
Terminal Agent (type 'quit' to exit)

> what time is it?
[get_current_time] done
The current time is 17:20 UTC on February 12, 2026.

> what is 125 * 16?
[calculate] done
125 * 16 = 2000.

> quit
Bye!
```

## Next Steps

- [LLM Module](../framework/llm.md) - Complete LLM API reference
- [Agent Module](../framework/agents.md) - Agent framework reference
- [CLI Applications](cli.md) - Terminal I/O patterns
- [Processes](processes.md) - Process model and communication
