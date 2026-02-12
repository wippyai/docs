# LLM 智能体

分步构建一个终端聊天智能体，从简单的 LLM 调用逐步升级到带有工具的流式智能体。

## 构建目标

一个终端聊天智能体，具备以下功能：
- 使用 LLM 生成文本
- 维护多轮对话
- 实时流式传输响应
- 使用工具访问外部能力

## 项目结构

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

## 阶段 1：简单生成

从一个基本函数开始，使用字符串提示词调用 `llm.generate()`。

### 创建项目

```bash
mkdir llm-agent && cd llm-agent
mkdir -p src
```

### 条目定义

创建 `src/_index.yaml`：

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

LLM 模块需要两个基础设施条目：
- `env.storage.os` 从环境变量提供 API 密钥
- `process.host` 提供 LLM 模块内部使用的进程运行时

### 生成代码

创建 `src/ask.lua`：

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

### 模型定义

LLM 模块从注册表解析模型。在 `_index.yaml` 中添加模型条目：

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

### 初始化并测试

```bash
wippy init
wippy run -x app:ask "What is the capital of France?"
```

这会直接调用函数并打印结果。模型定义告诉 LLM 模块使用哪个提供商以及向 API 发送什么模型名称。

## 阶段 2：对话

从单次调用升级到使用提示词构建器的多轮对话。将条目从函数更改为带有终端 I/O 的进程。

### 更新条目定义

将 `ask` 条目替换为 `chat` 进程并添加终端依赖：

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

### 聊天进程

创建 `src/chat.lua`：

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

### 运行

```bash
wippy update
wippy run chat
```

提示词构建器维护完整的对话历史。每轮追加用户消息和助手响应，为模型提供先前交换的上下文。

## 阶段 3：智能体框架

智能体模块在原始 LLM 调用之上提供了更高层的抽象。智能体以声明式方式定义提示词、模型和工具，然后通过上下文/运行器模式加载和执行。

### 添加智能体依赖

在 `_index.yaml` 中添加：

```yaml
  - name: dep.agent
    kind: ns.dependency
    component: wippy/agent
    version: "*"
    parameters:
      - name: process_host
        value: app:processes
```

### 定义智能体

添加智能体条目：

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

### 更新聊天进程

切换到智能体框架。更新条目导入：

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

更新 `src/chat.lua`：

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

智能体框架将智能体定义（提示词、模型、参数）与执行逻辑分离。同一个智能体可以在运行时使用不同的上下文、工具和模型加载。

## 阶段 4：流式传输

逐令牌流式传输响应，而不是等待完整响应。

### 更新模块

将 `channel` 添加到进程模块：

```yaml
    modules:
      - io
      - process
      - channel
```

### 流式传输实现

更新 `src/chat.lua`：

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

关键模式：
- `coroutine.spawn` 在单独的协程中运行 `runner:step()`，以便主协程可以处理流数据块
- `channel.select` 多路复用流通道和完成通道
- 单个 `process.listen()` 创建一次并在各轮次中复用
- 文本被累积用于添加到对话历史中

## 阶段 5：工具

赋予智能体可调用的工具以访问外部能力。

### 定义工具

创建 `src/tools/_index.yaml`：

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

工具元数据告诉 LLM 该工具的功能：
- `input_schema` 是定义参数的 JSON Schema
- `llm_alias` 是 LLM 看到的函数名称
- `llm_description` 说明何时使用该工具

### 实现工具

创建 `src/tools/current_time.lua`：

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

创建 `src/tools/calculate.lua`：

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

### 将工具注册到智能体

更新 `src/_index.yaml` 中的智能体条目以引用工具：

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

### 添加工具执行

更新聊天进程模块以包含 `json` 和 `funcs`：

```yaml
    modules:
      - io
      - json
      - process
      - channel
      - funcs
```

更新 `src/chat.lua` 添加工具执行：

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

工具执行循环：
1. 使用流式传输调用 `runner:step()`
2. 如果响应包含 `tool_calls`，通过 `funcs.call()` 执行每个工具
3. 将工具调用和结果添加到对话中
4. 回到步骤 1，让智能体整合结果
5. 当没有更多工具调用时，返回最终文本

### 运行智能体

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

## 后续步骤

- [LLM 模块](../framework/llm.md) - 完整的 LLM API 参考
- [智能体模块](../framework/agents.md) - 智能体框架参考
- [CLI 应用](cli.md) - 终端 I/O 模式
- [进程](processes.md) - 进程模型与通信
