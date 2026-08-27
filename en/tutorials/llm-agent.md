---
title: "LLM Agent"
description: "Build a terminal chat agent step by step, progressing from a simple LLM call to a streaming agent with tools."
---

# LLM Agent

Build a terminal chat agent in five phases, from a single LLM call to streaming responses and tool execution.

**Classification: runnable tutorial with an external provider.** Each phase is a
cumulative edit to the same project and is runnable before you continue. The Wippy
contracts and local control flow are testable without credentials; generation requires
network access and a valid `OPENAI_API_KEY`.

## What We're Building

A terminal chat agent that:

- Generates text with an LLM.
- Maintains multi-turn conversations.
- Streams responses incrementally.
- Calls registered tools.

## Project Structure

```
llm-agent/
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

Start in a Wippy project whose source directory is `./src`. Set `OPENAI_API_KEY`
in the environment that starts Wippy. This tutorial declares its model explicitly;
do not also copy a second entry with the same model name from another application.

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

  - name: dep.security
    kind: ns.dependency
    component: wippy/security
    version: "*"

  - name: dep.terminal
    kind: ns.dependency
    component: wippy/terminal
    version: "*"

  - name: ask
    kind: process.lua
    meta:
      command:
        name: ask
        short: Ask one question
    source: file://ask.lua
    method: main
    modules:
      - io
    imports:
      llm: wippy.llm:llm
```

The LLM module needs two infrastructure entries:

- `env.storage.os` provides API keys from environment variables.
- `process.host` provides the process runtime used internally by the LLM module.

### Generation Code

Create `src/ask.lua`:

```lua
local io = require("io")
local llm = require("llm")

local function main()
    io.write("Question: ")
    io.flush()
    local question = io.readline()
    if not question or question == "" then
        io.print("A question is required")
        return 1
    end

    local response, err = llm.generate(question, {
        model = "gpt-4o-mini",
        temperature = 0.7,
        max_tokens = 512,
    })

    if err then
        io.print("Error: " .. tostring(err))
        return 1
    end

    io.print(response.result)
    return 0
end

return { main = main }
```

### Model Definition

The LLM module resolves models from the registry. Add a model entry to `_index.yaml`:

```yaml
  - name: gpt-4o-mini
    kind: registry.entry
    meta:
      name: gpt-4o-mini
      type: llm.model
      title: GPT-4o mini
      comment: Fast, affordable model
      capabilities:
        - generate
        - tool_use
        - structured_output
      class:
        - fast
      priority: 100
    max_tokens: 128000
    output_tokens: 16384
    pricing:
      input: 0.15
      output: 0.6
    providers:
      - id: wippy.llm.openai:provider
        provider_model: gpt-4o-mini
```

### Initialize and Test

```bash
wippy init
wippy update
wippy install
wippy run ask
```

Enter `What is the capital of France?` at the prompt. The model definition selects
the provider and the model name sent to its API.

## Phase 2: Conversations

Upgrade from a single call to a multi-turn conversation using the prompt builder. Change the entry from a function to a process with terminal I/O.

### Update Entry Definitions

Replace the `ask` entry with a `chat` process. Keep the `dep.terminal` entry from
Phase 1:

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
    imports:
      llm: wippy.llm:llm
      prompt: wippy.llm:prompt
```

Executable Lua entries receive `process` as an ambient runtime module, so it is used
directly in the code below and does not belong in the entry's `modules` list.

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
            model = "gpt-4o-mini",
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
wippy install
wippy run chat
```

The prompt builder maintains the full conversation history. Each turn appends the user message and assistant response, giving the model context of prior exchanges.

## Phase 3: Agent Framework

The agent module defines prompts, models, and tools declaratively, then loads and executes the resulting agent through a context and runner.

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
    model: gpt-4o-mini
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

The agent definition contains the prompt, model, and parameters, while the process controls execution. A context can add tools or override the model at runtime.

Resolve the newly added agent dependency, then run this phase:

```bash
wippy update
wippy install
wippy run chat
```

## Phase 4: Streaming

Process response chunks as they arrive instead of waiting for the full response.

### Streaming Implementation

Update `src/chat.lua`:

```lua
local io = require("io")
local prompt = require("prompt")
local agent_context = require("agent_context")

local STREAM_TOPIC = "stream"
local stream_sequence = 0

local function stream_response(runner, conversation)
    stream_sequence = stream_sequence + 1
    local topic = STREAM_TOPIC .. ":" .. tostring(stream_sequence)
    local stream_ch = process.listen(topic)
    local done_ch = channel.new(1)

    coroutine.spawn(function()
        local response, err = runner:step(conversation, {
            stream_target = {
                reply_to = process.pid(),
                topic = topic,
            },
        })
        done_ch:send({ response = response, err = err })
    end)

    local full_text = ""
    local response_result = nil
    local stream_done = false

    local function finish(text, response, err)
        process.unlisten(stream_ch)
        return text, response, err
    end

    while true do
        local result = channel.select({
            stream_ch:case_receive(),
            done_ch:case_receive(),
        })
        if not result.ok then break end

        if result.channel == done_ch then
            response_result = result.value
        else
            local chunk = result.value
            if chunk.type == "chunk" then
                io.write(chunk.content or "")
                full_text = full_text .. (chunk.content or "")
            elseif chunk.type == "done" then
                stream_done = true
            elseif chunk.type == "error" then
                return finish(nil, nil, chunk.error and chunk.error.message or "stream error")
            end
        end

        if response_result and response_result.err then
            return finish(full_text, response_result.response, response_result.err)
        end

        if response_result and stream_done then
            return finish(full_text, response_result.response, response_result.err)
        end
    end

    return finish(full_text, nil, nil)
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
    while true do
        io.write("> ")
        io.flush()
        local input = io.readline()
        if not input or input == "quit" or input == "exit" then break end
        if input == "" then goto continue end

        conversation:add_user(input)

        local text, _, gen_err = stream_response(runner, conversation)
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

    io.print("Bye!")
end

return { main = main }
```

Key patterns:

- `coroutine.spawn` runs `runner:step()` separately so the main coroutine can process stream chunks.
- `channel.select` waits on both the stream channel and completion channel.
- Each turn uses a unique topic and removes its listener after both the runner and
  that turn's stream report completion.
- The process accumulates streamed text for the conversation history.

Run the streaming phase with the same command:

```bash
wippy run chat
```

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

Tool metadata describes the callable interface to the LLM:

- `input_schema` defines the arguments with JSON Schema.
- `llm_alias` is the function name presented to the LLM.
- `llm_description` explains when to use the tool.

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
    model: gpt-4o-mini
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
local stream_sequence = 0

local function stream_response(runner, conversation)
    stream_sequence = stream_sequence + 1
    local topic = STREAM_TOPIC .. ":" .. tostring(stream_sequence)
    local stream_ch = process.listen(topic)
    local done_ch = channel.new(1)

    coroutine.spawn(function()
        local response, err = runner:step(conversation, {
            stream_target = {
                reply_to = process.pid(),
                topic = topic,
            },
        })
        done_ch:send({ response = response, err = err })
    end)

    local full_text = ""
    local response_result = nil
    local stream_done = false

    local function finish(text, response, err)
        process.unlisten(stream_ch)
        return text, response, err
    end

    while true do
        local result = channel.select({
            stream_ch:case_receive(),
            done_ch:case_receive(),
        })
        if not result.ok then break end

        if result.channel == done_ch then
            response_result = result.value
        else
            local chunk = result.value
            if chunk.type == "chunk" then
                io.write(chunk.content or "")
                full_text = full_text .. (chunk.content or "")
            elseif chunk.type == "done" then
                stream_done = true
            elseif chunk.type == "error" then
                return finish(nil, nil, chunk.error and chunk.error.message or "stream error")
            end
        end

        if response_result and response_result.err then
            return finish(full_text, response_result.response, response_result.err)
        end

        if response_result and stream_done then
            return finish(full_text, response_result.response, response_result.err)
        end
    end

    return finish(full_text, nil, nil)
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

local function run_turn(runner, conversation)
    while true do
        local text, response, err = stream_response(runner, conversation)
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
    while true do
        io.write("> ")
        io.flush()
        local input = io.readline()
        if not input or input == "quit" or input == "exit" then break end
        if input == "" then goto continue end

        conversation:add_user(input)

        local text, gen_err = run_turn(runner, conversation)
        if gen_err then
            io.print("Error: " .. tostring(gen_err))
            goto continue
        end
        if text and text ~= "" then
            conversation:add_assistant(text)
        end

        ::continue::
    end

    io.print("Bye!")
end

return { main = main }
```

The tool-execution loop:

1. Call `runner:step()` with streaming.
2. If the response contains `tool_calls`, execute each tool with `funcs.call()`.
3. Add the tool calls and results to the conversation.
4. Call the runner again so it can incorporate the results.
5. Return the final text when the response contains no more tool calls.

### Run the Agent

```bash
wippy update
wippy install
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

## Completeness and Limits

- The page contains every authored Lua file and registry entry needed by the five
  phases. `wippy.lock` and installed modules are generated by the commands above.
- Model output, token usage, tool-choice order, and wording are provider-dependent;
  the displayed interaction is illustrative rather than an assertion of exact text.
- The calculator is intentionally a small arithmetic parser, not a general expression
  evaluator. Treat every real tool as an authority boundary and attach narrow security
  policies before exposing side effects.

## Next Steps

- [LLM Module](../framework/llm.md) — LLM API reference
- [Agent Module](../framework/agents.md) — Agent framework reference
- [CLI Applications](./cli.md) — Terminal I/O patterns
- [Processes](./processes.md) — Process model and communication
