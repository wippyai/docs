# LLM

`wippy/llm` 模块提供了统一的接口，用于与多个提供商（OpenAI、Anthropic、Google、本地模型）的大语言模型进行交互。支持文本生成、工具调用、结构化输出、向量嵌入和流式传输。

## 配置

将模块添加到项目中：

```bash
wippy add wippy/llm
wippy install
```

在 `_index.yaml` 中声明依赖。LLM 模块需要环境存储（用于 API 密钥）和进程宿主：

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

`env.storage.os` 条目将操作系统环境变量暴露给 LLM 提供商。将 API 密钥设置为环境变量（例如 `OPENAI_API_KEY`、`ANTHROPIC_API_KEY`）。

## 文本生成

在条目中导入 `llm` 库并调用 `generate()`：

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

`generate()` 的第一个参数可以是字符串提示词、提示词构建器或消息表。第二个参数是选项表。

### 生成选项

| 选项 | 类型 | 说明 |
|--------|------|-------------|
| `model` | string | 模型名称或类别（必填） |
| `temperature` | number | 随机性控制，0-1 |
| `max_tokens` | number | 最大生成令牌数 |
| `top_p` | number | 核采样参数 |
| `top_k` | number | Top-k 过滤 |
| `thinking_effort` | number | 思考深度 0-100（具有思考能力的模型） |
| `tools` | table | 工具定义数组 |
| `tool_choice` | string | `"auto"`、`"none"`、`"any"` 或工具名称 |
| `stream` | table | 流式配置：`{ reply_to, topic, buffer_size }` |
| `timeout` | number | 请求超时秒数（默认 600） |

### 响应结构

| 字段 | 类型 | 说明 |
|-------|------|-------------|
| `result` | string | 生成的文本内容 |
| `tokens` | table | 令牌用量：`prompt_tokens`、`completion_tokens`、`thinking_tokens`、`total_tokens` |
| `finish_reason` | string | 生成停止原因：`"stop"`、`"length"`、`"tool_call"` |
| `tool_calls` | table? | 工具调用数组（如果模型调用了工具） |
| `metadata` | table | 提供商特定的元数据 |
| `usage_record` | table? | 使用量跟踪记录 |

## 提示词构建器

对于多轮对话和复杂提示词，使用提示词构建器：

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

### 构建器方法

| 方法 | 说明 |
|--------|-------------|
| `prompt.new()` | 创建空构建器 |
| `prompt.with_system(content)` | 创建带系统消息的构建器 |
| `:add_system(content, meta?)` | 添加系统消息 |
| `:add_user(content, meta?)` | 添加用户消息 |
| `:add_assistant(content, meta?)` | 添加助手消息 |
| `:add_developer(content, meta?)` | 添加开发者消息 |
| `:add_message(role, content_parts, name?, meta?)` | 添加指定角色和内容部分的消息 |
| `:add_function_call(name, args, id?)` | 添加助手的工具调用 |
| `:add_function_result(name, result, id?)` | 添加工具执行结果 |
| `:add_cache_marker(id?)` | 标记缓存边界（Claude 模型） |
| `:get_messages()` | 获取消息数组 |
| `:build()` | 获取用于 `llm.generate()` 的 `{ messages = ... }` 表 |
| `:clone()` | 深拷贝构建器 |
| `:clear()` | 清除所有消息 |

所有 `add_*` 方法均返回构建器自身，支持链式调用。

### 多轮对话

通过追加消息来构建跨轮次的上下文：

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

### 多模态内容

在单条消息中组合文本和图像：

```lua
local conversation = prompt.new()
conversation:add_message(prompt.ROLE.USER, {
    prompt.text("What's in this image?"),
    prompt.image("https://example.com/photo.jpg")
})
```

| 函数 | 说明 |
|----------|-------------|
| `prompt.text(content)` | 文本内容部分 |
| `prompt.image(url, mime_type?)` | 来自 URL 的图像 |
| `prompt.image_base64(mime_type, data)` | Base64 编码的图像 |

### 角色常量

| 常量 | 值 |
|----------|-------|
| `prompt.ROLE.SYSTEM` | `"system"` |
| `prompt.ROLE.USER` | `"user"` |
| `prompt.ROLE.ASSISTANT` | `"assistant"` |
| `prompt.ROLE.DEVELOPER` | `"developer"` |
| `prompt.ROLE.FUNCTION_CALL` | `"function_call"` |
| `prompt.ROLE.FUNCTION_RESULT` | `"function_result"` |

### 克隆

克隆构建器以创建变体，而不修改原始构建器：

```lua
local base = prompt.new()
base:add_system("You are a helpful assistant.")

local conv1 = base:clone()
conv1:add_user("What is AI?")

local conv2 = base:clone()
conv2:add_user("What is ML?")
```

## 流式传输

使用进程通信实时流式传输响应。需要 `process.lua` 条目：

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

### 数据块类型

| 类型 | 字段 | 说明 |
|------|--------|-------------|
| `"chunk"` | `content` | 文本内容片段 |
| `"thinking"` | `content` | 模型思考过程 |
| `"tool_call"` | `name`、`arguments`、`id` | 工具调用 |
| `"error"` | `error.message`、`error.type` | 流错误 |
| `"done"` | `meta` | 流传输完成 |

<note>
流式传输需要 <code>process.lua</code> 条目，因为它使用 Wippy 的进程通信系统（<code>process.pid()</code>、<code>process.listen()</code>）。
</note>

## 工具调用

将工具定义为内联模式并传递给 `generate()`：

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

### 工具调用字段

| 字段 | 类型 | 说明 |
|-------|------|-------------|
| `id` | string | 唯一调用标识符 |
| `name` | string | 工具名称 |
| `arguments` | table | 匹配模式的已解析参数 |

### 工具选择

| 值 | 行为 |
|-------|----------|
| `"auto"` | 模型决定何时使用工具（默认） |
| `"none"` | 从不使用工具 |
| `"any"` | 必须使用至少一个工具 |
| `"tool_name"` | 必须使用指定的工具 |

## 结构化输出

生成匹配模式的已验证 JSON：

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
对于 OpenAI 模型，所有属性必须在 <code>required</code> 数组中。对于可选字段使用联合类型：<code>type = {"string", "null"}</code>。设置 <code>additionalProperties = false</code>。
</tip>

## 模型配置

模型定义为带有 `meta.type: llm.model` 的注册表条目：

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

### 模型条目字段

| 字段 | 说明 |
|-------|-------------|
| `meta.name` | API 调用中使用的模型标识符 |
| `meta.type` | 必须为 `llm.model` |
| `meta.capabilities` | 功能列表：`generate`、`tool_use`、`structured_output`、`embed`、`thinking`、`vision`、`caching` |
| `meta.class` | 类别归属：`fast`、`balanced`、`reasoning` 等 |
| `meta.priority` | 基于类别解析的数值优先级（越高越优先） |
| `max_tokens` | 最大上下文窗口 |
| `output_tokens` | 最大输出令牌数 |
| `pricing` | 每百万令牌成本：`input`、`output` |
| `providers` | 包含 `id`（提供商条目）和 `provider_model`（提供商特定模型名称）的数组 |

### 本地模型

对于本地托管的模型（LM Studio、Ollama），定义一个带有自定义 `base_url` 的单独提供商条目：

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

## 模型解析

模型可以通过精确名称、类别或显式类别前缀引用：

```lua
-- exact model name
llm.generate("Hello", { model = "gpt-4o" })

-- model class (picks highest priority in that class)
llm.generate("Hello", { model = "fast" })

-- explicit class syntax
llm.generate("Hello", { model = "class:reasoning" })
```

解析顺序：
1. 按精确 `meta.name` 匹配
2. 按类别名称匹配（`meta.priority` 最高者优先）
3. 使用 `class:` 前缀时，仅在该类别中搜索

## 模型发现

在运行时查询可用模型及其能力：

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

## 向量嵌入

生成用于语义搜索的向量嵌入：

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

## 错误处理

错误作为第二个返回值返回。发生错误时，第一个返回值为 `nil`：

```lua
local response, err = llm.generate("Hello", { model = "gpt-4o" })

if err then
    io.print("Error: " .. tostring(err))
    return
end

io.print(response.result)
```

### 错误类型

| 常量 | 说明 |
|----------|-------------|
| `llm.ERROR_TYPE.INVALID_REQUEST` | 请求格式错误 |
| `llm.ERROR_TYPE.AUTHENTICATION` | API 密钥无效 |
| `llm.ERROR_TYPE.RATE_LIMIT` | 超出提供商速率限制 |
| `llm.ERROR_TYPE.SERVER_ERROR` | 提供商服务器错误 |
| `llm.ERROR_TYPE.CONTEXT_LENGTH` | 输入超出上下文窗口 |
| `llm.ERROR_TYPE.CONTENT_FILTER` | 内容被安全系统过滤 |
| `llm.ERROR_TYPE.TIMEOUT` | 请求超时 |
| `llm.ERROR_TYPE.MODEL_ERROR` | 模型无效或不可用 |

### 结束原因

| 常量 | 说明 |
|----------|-------------|
| `llm.FINISH_REASON.STOP` | 正常完成 |
| `llm.FINISH_REASON.LENGTH` | 达到最大令牌数 |
| `llm.FINISH_REASON.CONTENT_FILTER` | 内容被过滤 |
| `llm.FINISH_REASON.TOOL_CALL` | 模型进行了工具调用 |
| `llm.FINISH_REASON.ERROR` | 生成过程中出错 |

## 能力

| 常量 | 说明 |
|----------|-------------|
| `llm.CAPABILITY.GENERATE` | 文本生成 |
| `llm.CAPABILITY.TOOL_USE` | 工具/函数调用 |
| `llm.CAPABILITY.STRUCTURED_OUTPUT` | JSON 结构化输出 |
| `llm.CAPABILITY.EMBED` | 向量嵌入 |
| `llm.CAPABILITY.THINKING` | 扩展思考 |
| `llm.CAPABILITY.VISION` | 图像理解 |
| `llm.CAPABILITY.CACHING` | 提示词缓存 |

## 另请参阅

- [智能体](agents.md) - 带有工具、委托和记忆的智能体框架
- [构建 LLM 智能体](../tutorials/llm-agent.md) - 分步教程
- [框架概述](overview.md) - 框架模块用法
