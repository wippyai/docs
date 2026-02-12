# 智能体

`wippy/agent` 模块提供了一个用于构建 AI 智能体的框架，支持工具调用、流式传输、委托、特征和记忆。智能体以声明式方式定义，通过上下文/运行器模式执行。

## 配置

将模块添加到项目中：

```bash
wippy add wippy/agent
wippy install
```

智能体模块依赖 `wippy/llm` 和进程宿主。声明两个依赖：

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

## 智能体定义

智能体是带有 `meta.type: agent.gen1` 的注册表条目：

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

### 智能体字段

| 字段 | 类型 | 说明 |
|-------|------|-------------|
| `meta.type` | string | 必须为 `agent.gen1` |
| `meta.name` | string | 智能体标识符 |
| `prompt` | string | 系统提示词 |
| `model` | string | 模型名称或类别 |
| `max_tokens` | number | 最大输出令牌数 |
| `temperature` | number | 随机性控制，0-1 |
| `thinking_effort` | number | 思考深度 0-100 |
| `tools` | array | 工具注册表 ID |
| `traits` | array | 特征引用 |
| `delegates` | array | 委托智能体引用 |
| `memory` | array | 静态记忆项（字符串） |
| `memory_contract` | table | 动态记忆配置 |

## 智能体上下文

智能体上下文是主要入口点。创建上下文，可选配置，然后加载智能体：

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

### 上下文方法

| 方法 | 说明 |
|--------|-------------|
| `agent_context.new(options?)` | 创建新上下文 |
| `:add_tools(specs)` | 在运行时添加工具 |
| `:add_delegates(specs)` | 添加委托智能体 |
| `:set_memory_contract(config)` | 配置动态记忆 |
| `:update_context(updates)` | 更新运行时上下文 |
| `:load_agent(spec_or_id, options?)` | 加载并编译智能体，返回运行器 |
| `:switch_to_agent(id, options?)` | 切换到其他智能体，返回 `(boolean, string?)` |
| `:switch_to_model(name)` | 更改当前智能体的模型，返回 `(boolean, string?)` |
| `:get_current_agent()` | 获取当前运行器 |

### 上下文选项

```lua
local ctx = agent_context.new({
    context = { session_id = "abc", user_id = "u1" },
    delegate_tools = { enabled = true },
})
```

### 通过内联规格加载

无需注册表条目即可加载智能体：

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

## 运行步骤

运行器执行单个推理步骤。传入包含对话的提示词构建器：

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

### 步骤选项

```lua
local response, err = runner:step(conversation, {
    context = { session_id = "abc" },
    stream_target = { reply_to = process.pid(), topic = "stream" },
    tool_call = "auto",
})
```

| 选项 | 类型 | 说明 |
|--------|------|-------------|
| `context` | table | 与智能体上下文合并的运行时上下文 |
| `stream_target` | table | 流式传输：`{ reply_to, topic }` |
| `tool_call` | string | `"auto"`、`"required"`、`"none"` |

### 步骤响应

| 字段 | 类型 | 说明 |
|-------|------|-------------|
| `result` | string | 生成的文本 |
| `tokens` | table | 令牌用量 |
| `finish_reason` | string | 停止原因 |
| `tool_calls` | table? | 待执行的工具调用 |
| `delegate_calls` | table? | 委托调用 |

### 运行器统计

```lua
local stats = runner:get_stats()
-- stats.id, stats.name, stats.total_tokens
```

## 工具定义

工具是带有 `meta.type: tool` 的 `function.lua` 条目。在单独的 `_index.yaml` 中定义：

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

### 工具元数据

| 字段 | 类型 | 说明 |
|-------|------|-------------|
| `meta.type` | string | 必须为 `tool` |
| `meta.input_schema` | string/table | 工具参数的 JSON Schema |
| `meta.llm_alias` | string | 暴露给 LLM 的名称 |
| `meta.llm_description` | string | 暴露给 LLM 的描述 |
| `meta.exclusive` | boolean | 如果为 true，取消并发工具调用 |

### 在智能体中引用工具

在智能体定义中列出工具注册表 ID：

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

工具也可以使用自定义别名和上下文引用：

```yaml
    tools:
      - id: app.tools:search
        alias: web_search
        context:
          api_key: "${SEARCH_API_KEY}"
```

## 工具执行

当智能体步骤返回 `tool_calls` 时，执行工具并将结果反馈：

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

### 工具调用字段

| 字段 | 类型 | 说明 |
|-------|------|-------------|
| `id` | string | 唯一调用标识符 |
| `name` | string | 工具名称（别名或 llm_alias） |
| `arguments` | table | 已解析的参数 |
| `registry_id` | string | 用于 `funcs.call()` 的完整注册表 ID |

<note>
使用 <code>funcs.call(tc.registry_id, tc.arguments)</code> 执行工具。<code>registry_id</code> 字段直接映射到注册表中的工具条目。
</note>

## 流式传输

使用 `stream_target` 实时流式传输智能体响应：

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

流式传输使用与直接 LLM 流式传输相同的数据块类型：`"chunk"`、`"thinking"`、`"tool_call"`、`"error"`、`"done"`。

<tip>
使用 <code>coroutine.spawn</code> 在单独的协程中运行 <code>runner:step()</code>，以便并发接收流数据块。使用 <code>channel.select</code> 多路复用流通道和完成通道。
</tip>

## 委托

智能体可以委托给其他智能体。委托对父智能体表现为工具：

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

委托调用出现在 `response.delegate_calls` 中：

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

委托也可以在运行时添加：

```lua
ctx:add_delegates({
    { id = "app:specialist", name = "ask_specialist", rule = "for domain questions" },
})
```

## 特征

特征是可复用的能力，为智能体贡献提示词、工具和行为：

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

### 内置特征

| 特征 | 说明 |
|-------|-------------|
| `time_aware` | 将当前日期和时间注入到提示词中 |

`time_aware` 特征接受上下文选项：

```yaml
    traits:
      - id: time_aware
        context:
          timezone: America/New_York
          time_interval: 15
```

### 自定义特征

特征是带有 `meta.type: agent.trait` 的注册表条目。它们可以贡献：
- **prompt** - 追加到系统提示词的静态文本
- **build_func_id** - 在编译时调用的函数，用于贡献工具、提示词、委托
- **prompt_func_id** - 在每个步骤调用的函数，用于注入动态内容
- **step_func_id** - 在每个步骤调用的函数，用于副作用

## 记忆

### 静态记忆

追加到系统提示词的简单记忆项：

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

### 动态记忆合约

配置从外部源进行动态记忆召回：

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

记忆合约在 `runner:step()` 期间被调用，根据对话上下文召回相关项。结果以开发者消息的形式注入。

| 选项 | 说明 |
|--------|-------------|
| `max_items` | 每次召回的最大记忆项数 |
| `max_length` | 最大总字符长度 |
| `recall_cooldown` | 两次召回之间的最小步骤数 |
| `min_conversation_length` | 首次召回前的最小对话轮次数 |

## 解析器合约

当 `load_agent()` 接收到字符串标识符时，它首先尝试通过 `wippy.agent:resolver` 合约解析。如果没有绑定解析器或解析器返回 nil，则回退到注册表查找。

这允许应用程序实现自定义智能体解析，例如从数据库加载智能体定义。

### 绑定解析器

定义解析器函数并将其绑定到合约：

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

### 解析器实现

解析器接收 `{ agent_id = "..." }` 并返回智能体规格表或 nil：

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

### 解析顺序

1. 尝试 `wippy.agent:resolver` 合约（如果已绑定）
2. 尝试按 ID 查找注册表
3. 尝试按名称查找注册表
4. 如果未找到则返回错误

此模式支持多租户应用，其中智能体按用户或按工作区配置，并存储在框架注册表之外。

## 另请参阅

- [LLM](llm.md) - 底层 LLM 模块
- [构建 LLM 智能体](../tutorials/llm-agent.md) - 分步教程
- [框架概述](overview.md) - 框架模块用法
