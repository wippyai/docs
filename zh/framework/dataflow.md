# Dataflow

`wippy/dataflow` 模块提供了一个基于有向无环图（DAG）的工作流编排引擎。工作流由节点组成——函数、代理、循环和并行处理器——通过类型化的数据路由连接。编排器管理执行、状态持久化和恢复。

## 安装

将模块添加到你的项目：

```bash
wippy add wippy/dataflow
wippy install
```

声明依赖：

```yaml
version: "1.0"
namespace: app

entries:
  - name: dep.dataflow
    kind: ns.dependency
    component: wippy/dataflow
    version: "*"
```

dataflow 模块依赖于 `wippy/agent`、`wippy/llm` 和 `wippy/session`——当你运行 `wippy install` 时这些会被自动解析。该模块需要一个位于 `app:db` 的数据库资源用于工作流持久化，并通过 `wippy/migration` 自动运行迁移。

该模块发布一个 `env.variable` 条目 `userspace.dataflow.env:web_host_origin`（默认为 `https://front.wippy.ai`），下游流可以读取它以构建公共 URL。通过 env 路由器或 requirement 可以覆盖它。

## 流构建器

流构建器提供了用于组合工作流的流式接口。将其导入到你的条目中：

```yaml
imports:
  flow: userspace.dataflow.flow:flow
```

```lua
local flow = require("flow")
```

### 核心 API

```lua
flow.create()
    :with_title(title)
    :with_metadata(metadata)
    :with_input(data)
    :with_data(data)
    :[operation](config)
    :as(name)
    :to(target, input_key, transform)
    :error_to(target, input_key, transform)
    :when(condition)
    :run()   -- synchronous
    :start() -- asynchronous

flow.template()
    :[operations]...
```

### 线性管道

当没有定义显式路由时，节点自动链接。每个节点的输出流向下一个：

```lua
local result, err = flow.create()
    :with_input({ text = "Hello world" })
    :func("app:tokenize")
    :func("app:translate", { args = { target_lang = "fr" } })
    :func("app:format_output")
    :run()
```

### 命名路由

使用 `:as()` 为节点命名，使用 `:to()` 在它们之间路由数据。仅在需要引用节点时才使用 `:as()`：

```lua
local result, err = flow.create()
    :with_input(task)
        :to("router")

    :func("app:router"):as("router")
        :to("context", "routing")
        :to("dev", "routing")

    :agent("app:context_agent"):as("context")
        :to("dev", "gathered_context")

    :agent("app:dev_agent"):as("dev")
        :to("@success")

    :run()
```

`:to()` 的第二个参数是**判别符**（discriminator）——即接收节点处的输入键。当节点接收多个输入时，它们作为以判别符为键的表收集。

### 工作流输入和静态数据

`:with_input()` 是工作流的唯一主输入。`:with_data()` 创建独立的静态数据源：

```lua
flow.create()
    :with_input(task)
        :to("router")

    :with_data(config):as("cfg")
        :to("dev", "config")
        :to("logger", "config")

    :with_data(branch):as("branch_data")
        :to("checker", "branch")

    :func("app:router"):as("router")
        :to("dev", "task")

    :func("app:dev"):as("dev")
        :to("@success")
        :error_to("@fail")

    :run()
```

`:with_input()` 用于进入工作流的外部数据。`:with_data()` 用于多个节点之间共享的配置、常量和参考数据。静态数据使用引用优化——第一条路由创建实际数据，后续路由创建轻量级引用。

### 条件路由

在 `:to()` 之后使用 `:when()` 添加条件。条件使用 `expr` 语法针对节点输出进行求值：

```lua
flow.create()
    :with_input(data)
    :func("app:classify"):as("classify")
        :to("handler_a"):when("output.category == 'a'")
        :to("handler_b"):when("output.category == 'b'")
        :to("fallback")
    :func("app:handler_a"):as("handler_a"):to("@success")
    :func("app:handler_b"):as("handler_b"):to("@success")
    :func("app:fallback"):as("fallback"):to("@success")
    :run()
```

条件可以与内联转换结合使用以实现更复杂的路由：

```lua
:func("app:decompose"):as("decompose")
    :to("@success", nil, "{passed: true, feedback: nil}"):when("len(output.items) == 0")
    :to("processor", "items", "output.items")
```

条件表达式支持：比较（`output.score > 0.8`）、逻辑运算符（`output.valid && output.count > 5`）、数组函数（`len(output.items) > 0`、`any(output.errors, {.critical})`）、字符串操作（`output.status contains 'success'`）以及可选链（`output.data?.nested?.value`）。

### 工作流终端

路由到 `@success` 或 `@fail` 以显式终止工作流。在嵌套上下文中（循环、并行），终端产生节点输出而不是工作流输出：

```lua
:func("app:final_step"):to("@success")
:func("app:handler"):error_to("@fail")
```

### 错误路由

使用 `:error_to()` 将节点错误路由到处理器。错误可以作为普通输入路由到恢复节点：

```lua
:agent("app:gpt_planner", { model = "gpt-5" }):as("gpt_planner")
    :to("consolidator", "gpt_plan")
    :error_to("consolidator", "gpt_plan")

:agent("app:claude_planner", { model = "claude-4-5-sonnet" }):as("claude_planner")
    :to("consolidator", "claude_plan")
    :error_to("consolidator", "claude_plan")

:agent("app:consolidator", {
    inputs = { required = { "gpt_plan", "claude_plan" } }
}):as("consolidator")
```

这种模式并行运行两个规划器——如果一个失败，其错误就成为整合器的输入，整合器则使用可用的任何结果继续。

## 输入合并

节点接收输入的方式取决于判别符和是否配置了 `args`。

**没有 args——单个默认输入：**

```lua
:func("source"):to("target")
-- target receives: raw content (unwrapped)
```

**没有 args——单个命名输入：**

```lua
:func("source"):to("target", "task")
-- target receives: { task = content }
```

**没有 args——多个输入：**

```lua
:func("source1"):to("target", "data")
:func("source2"):to("target", "config")
-- target receives: { data = content1, config = content2 }
```

**有 args——输入合并到基础中：**

```lua
:func("app:api_client", {
    args = { base_url = "https://api.com", timeout = 5000 }
})
-- with :to("api_client", "body") from upstream
-- api_client receives: { base_url = "https://api.com", timeout = 5000, body = content }
```

<note>
带有 <code>args</code> 的节点不能接收带有 <code>"default"</code> 判别符的输入。请改用带 <code>:to(target, "input_key")</code> 的命名判别符。
</note>

## 输入转换

在数据到达节点之前对其进行转换：

```lua
-- String transform: single expression
:func("app:step", { input_transform = "input.nested.field" })

-- Table transform: named expressions
:func("app:step", {
    input_transform = {
        task = "inputs.task",
        config = "inputs.settings",
        priority = "output.score > 0.8 ? 'high' : 'normal'"
    }
})
```

转换中可用的上下文变量：`input`（工作流输入）、`inputs`（所有传入节点的输入）、`output`（路由时当前节点的输出）。

### 内联路由转换

`:to()` 的第三个参数是一个内联转换表达式：

```lua
:func("source"):as("source")
    :to("target", nil, "output.data")
    :to("other", nil, "{passed: true, value: output.x}")
    :to("list", nil, "map(output.items, {.id})")
```

## 节点类型

### 函数节点

执行已注册的 `function.lua` 条目：

```lua
:func("app:my_function", {
    args = { key = "value" },
    inputs = { required = { "task", "config" } },
    context = { session_id = "abc" },
    input_transform = { task = "inputs.prompt" },
    metadata = { title = "Process Data" }
})
```

| Option | Type | Description |
|--------|------|-------------|
| `args` | table | 与节点输入合并的基础参数 |
| `inputs` | table | 输入要求：`{ required = {...}, optional = {...} }` |
| `context` | table | 传递给函数的执行上下文 |
| `input_transform` | string/table | 转换输入的表达式 |
| `metadata` | table | 节点元数据（例如 `{ title = "..." }`） |

如果函数返回 `{ _control = { commands = [...] } }`，编排器会生成一个子工作流。这就是嵌套流的工作方式。

### 代理节点

执行带有工具调用和可选结构化退出的代理：

```lua
:agent("app:content_writer", {
    model = "gpt-5",
    inputs = { required = { "context", "content_plan", "analysis" } },
    arena = {
        prompt = "Write content based on the provided context.",
        max_iterations = 12,
        tool_calling = "any",
        exit_schema = {
            type = "object",
            properties = {
                content = { type = "string" },
                title = { type = "string" }
            },
            required = { "content", "title" }
        }
    },
    show_tool_calls = true,
    metadata = { title = "Content Writer" }
})
```

| Option | Type | Description |
|--------|------|-------------|
| `model` | string | 覆盖模型 |
| `arena.prompt` | string | 系统提示 |
| `arena.max_iterations` | number | 最大推理循环次数（默认：64） |
| `arena.min_iterations` | number | 退出前的最小迭代次数（默认：1） |
| `arena.tool_calling` | string | `"auto"`、`"any"`（需要 `exit_schema`）、`"none"`（拒绝 `exit_schema`） |
| `arena.tools` | array | 工具注册表 ID |
| `arena.exit_schema` | table | 用于结构化退出的 JSON schema |
| `arena.exit_func_id` | string | 验证退出输出的函数 |
| `arena.context` | table | 额外的上下文 |
| `inputs` | table | 输入要求 |
| `show_tool_calls` | boolean | 在输出中包含工具调用 |
| `input_transform` | string/table | 转换输入 |
| `metadata` | table | 节点元数据 |

**动态代理选择：** 将空字符串作为代理 ID 传递，并通过 `input_transform` 解析：

```lua
:agent("", {
    inputs = { required = { "spec", "task" } },
    input_transform = {
        agent_id = "inputs.spec.agent_id",
        task = "inputs.task"
    },
    arena = {
        prompt = "Process according to spec",
        max_iterations = 25
    }
})
```

**退出验证：** 当设置了 `exit_func_id` 时，该函数验证代理的退出输出。验证失败时，代理将错误作为观察接收并继续（最多达到 `max_iterations`）。

### 循环节点

使用持久状态反复迭代函数或模板：

```lua
:cycle({
    func_id = "app:content_cycle",
    max_iterations = 3,
    initial_state = {
        entry_id = entry_id,
        content_prompt = prompt,
        min_score = 8.0,
        feedback_history = {}
    }
})
```

循环函数在每次迭代时接收：

```lua
{
    input = <workflow_input>,
    state = <accumulated_state>,
    last_result = <previous_iteration_output>,
    iteration = <current_iteration_number>
}
```

该函数控制是否继续：

```lua
function my_cycle(cycle_context)
    -- stop if approved
    if cycle_context.last_result and cycle_context.last_result.approved then
        return {
            state = cycle_context.state,
            result = cycle_context.last_result,
            continue = false
        }
    end

    -- spawn child workflow for this iteration
    return flow.create()
        :with_input({ task = cycle_context.input.task })
        :agent("app:worker")
        :agent("app:qa")
        :run()
end
```

| Option | Type | Description |
|--------|------|-------------|
| `func_id` | string | 迭代函数（与 `template` 互斥） |
| `template` | FlowBuilder | 每次迭代的模板（与 `func_id` 互斥） |
| `max_iterations` | number | 最大迭代次数 |
| `initial_state` | table | 起始状态 |
| `continue_condition` | string | 表达式：为真时继续 |

**基于模板的循环：**

```lua
:cycle({
    template = flow.template()
        :agent("app:worker")
        :func("app:validator"),
    max_iterations = 5
})
```

### 并行节点

数组上的 map-reduce 模式：

```lua
:parallel({
    inputs = { required = { "specs", "task" } },
    source_array_key = "specs",
    iteration_input_key = "spec",
    passthrough_keys = { "task" },
    batch_size = 10,
    on_error = "collect_errors",
    filter = "successes",
    unwrap = true,
    template = flow.template()
        :agent("app:processor", {
            inputs = { required = { "spec", "task" } },
            input_transform = {
                agent_id = "inputs.spec.agent_id",
                task = "inputs.task"
            },
            arena = {
                prompt = "Process according to spec",
                max_iterations = 25
            }
        })
        :to("@success"),
    metadata = { title = "Process Specs" }
})
```

| Option | Type | Description |
|--------|------|-------------|
| `source_array_key` | string | 包含数组的输入键（必需） |
| `template` | FlowBuilder | 每个项的模板（必需，必须路由到 `@success`） |
| `iteration_input_key` | string | 当前项的输入键（默认：`"default"`） |
| `batch_size` | number | 每个并行批次的项数（默认：1 = 顺序） |
| `on_error` | string | `"collect_errors"`（默认）或 `"fail_fast"` |
| `filter` | string | `"all"`（默认）、`"successes"`、`"failures"` |
| `unwrap` | boolean | 返回原始结果而非带元数据的包装（默认：false） |
| `passthrough_keys` | array | 转发给每次迭代的输入键 |

**直通键**（passthrough keys）在不复制源数组中的数据的情况下，为每次迭代提供共享上下文（配置、任务描述）：

```lua
:with_data(file_list):as("files"):to("processor", "files")
:with_data("secret"):as("api_key"):to("processor", "api_key")

:parallel({
    inputs = { required = { "files", "api_key" } },
    source_array_key = "files",
    iteration_input_key = "filename",
    passthrough_keys = { "api_key" },
    template = flow.template()
        :func("app:upload", {
            inputs = { required = { "filename", "api_key" } }
        })
        :to("@success")
}):as("processor")
```

### 信号节点

暂停执行直到外部信号到达。用于人工审批、外部事件或分阶段工作流：

```lua
:signal({
    signal_id = "approval",
    inputs = { required = { "draft" } },
    metadata = { title = "Wait for approval" }
})
```

| Option | Type | Description |
|--------|------|-------------|
| `signal_id` | string | 与 `client:signal()` 匹配的信号名称。如果为空或省略，则在运行时生成 UUID v7 |
| `inputs` | table | 输入要求 |
| `input_transform` | string/table | 在节点接收输入之前对其进行转换 |
| `metadata` | table | 节点元数据 |

使用客户端 API 从工作流外部发送信号（见下文的 `client:signal()`）。

#### 行为

该节点使用 `wait_for_signal = true` yield 并将该 yield 持久化到工作流状态中。当匹配的 `NODE_SIGNAL` commit 到达时，编排器恢复该节点。

- 任何非 `nil` 的 payload 都可以满足信号。`false`、`0`、`""` 和 `{}` 都能满足 yield；只有 `nil` 会使其保持挂起。
- 信号 yield 会阻塞 `COMPLETE_WORKFLOW`，但不会阻塞其他待处理的节点——并行分支在一个分支等待时会继续执行。
- 信号可以在 `:start()` 之前预排队：如果在信号节点到达 yield 之前匹配的 `NODE_SIGNAL` commit 到达，它将在 yield 被跟踪的瞬间传递。
- 每个 yield 只有一个信号能满足。如果在 yield 被满足之前到达第二个具有相同 `signal_id` 的信号，它将覆盖第一个。
- 当多个信号 yield 共享相同的 `signal_id` 时，第一个匹配的 yield 接收数据。
- 如果 `signal_id` 字段缺失，匹配将回退到节点的判别符。
- 传递的信号数据作为信号 payload 传递给节点的输出。

#### 持久性和恢复

信号 yield 是工作流状态的一部分，通过与其他所有命令相同的 outbox 机制持久化。如果编排器进程在等待时被终止：

- 挂起的 yield 在重启时恢复。
- 中断期间传递的信号被排队，并在状态重新加载时应用。
- 复合管道（`func → signal → signal → func`）逐步恢复——每个信号可以在单独的重启中传递。

孤立的信号 yield（其父进程在未完成时退出的 yield）由工作流状态的进程退出处理程序清理。

#### 管道模式

信号节点可以参与任何拓扑：

```lua
-- Human-in-the-loop approval between two functions
flow.create()
    :func("app:draft")
    :signal({ signal_id = "approve_draft" })
    :func("app:publish")
    :run()

-- Two parallel approvals that must both arrive before release
flow.create()
    :with_input({ doc = "release-notes" })
        :as("trigger")
        :to("legal", "doc")
        :to("finance", "doc")

    :signal({ signal_id = "legal_ok", inputs = { required = { "doc" } } })
        :as("legal")
        :to("gate", "legal")

    :signal({ signal_id = "finance_ok", inputs = { required = { "doc" } } })
        :as("finance")
        :to("gate", "finance")

    :join({ inputs = { required = { "legal", "finance" } } })
        :as("gate")
        :to("release")

    :func("app:release"):as("release"):to("@success")
    :run()
```

信号数据作为节点输出暴露，因此下游节点接收传递给 `client:signal()` 的任何内容。

### 连接节点

在继续之前收集多个输入：

```lua
:join({
    inputs = { required = { "source1", "source2" } },
    output_mode = "object",
    ignored_keys = { "triggered" }
})
```

| Option | Type | Description |
|--------|------|-------------|
| `output_mode` | string | `"object"`（默认）或 `"array"`（到达顺序） |
| `ignored_keys` | array | 从输出中排除的输入键 |
| `inputs` | table | 输入要求 |

## 模板

模板定义可重用的子工作流。使用 `flow.template()` 创建，使用 `:use()` 内联：

```lua
local preprocessor = flow.template()
    :func("app:clean")
    :func("app:tokenize")

flow.create()
    :with_input(data)
    :use(preprocessor)
    :func("app:process")
    :run()
```

模板在编译时将其操作内联到父流中。

## 嵌套工作流

在循环和并行节点中使用的函数可以通过返回 `flow.create():run()` 生成子工作流：

```lua
function my_processor(input)
    return flow.create()
        :with_input(input)
        :func("app:step_a")
        :func("app:step_b")
        :run()
end
```

当 `:run()` 在现有 dataflow 上下文中执行时，它会返回 `{ _control = { commands = [...] } }` 而不是直接执行。编排器通过 yield 机制处理子工作流。

<note>
参与 dataflow 组合的函数<strong>必须</strong>返回 <code>flow.create():run()</code>。返回其他任何内容的函数不能生成子工作流。
</note>

## 同步 vs 异步

`:run()` 阻塞直到工作流完成并返回输出：

```lua
local result, err = flow.create()
    :with_input({ text = "hello" })
    :func("app:process")
    :run()
```

`:start()` 立即返回一个工作流 ID：

```lua
local dataflow_id, err = flow.create()
    :with_input({ text = "hello" })
    :func("app:process")
    :start()
```

`:start()` 不能在嵌套上下文中使用。

## 客户端 API

用于编程式工作流管理：

```yaml
imports:
  client: userspace.dataflow:client
```

```lua
local client = require("client")

local c, err = client.new()
```

| Method | Description |
|--------|-------------|
| `client.new()` | 创建客户端（需要安全 actor） |
| `:create_workflow(commands, options?)` | 创建工作流，返回 `dataflow_id` |
| `:execute(dataflow_id, options?)` | 同步运行，返回结果 |
| `:start(dataflow_id, options?)` | 异步运行，返回 `dataflow_id` |
| `:output(dataflow_id)` | 获取工作流输出 |
| `:get_status(dataflow_id)` | 获取当前状态 |
| `:cancel(dataflow_id, timeout?)` | 优雅地取消（默认：30 秒） |
| `:terminate(dataflow_id)` | 强制终止 |
| `:signal(dataflow_id, signal_id, data?)` | 将外部信号传递给等待中的信号节点 |

## 工作流状态

| Status | Description |
|--------|-------------|
| `template` | 节点是模板实例 |
| `pending` | 等待输入 |
| `ready` | 输入已收集，准备执行 |
| `running` | 正在执行 |
| `paused` | 已 yield，等待子工作流 |
| `completed` | 成功完成 |
| `failed` | 失败 |
| `cancelled` | 用户取消 |
| `skipped` | 未采用的条件分支 |
| `terminated` | 强制终止 |

## 元数据

```lua
flow.create()
    :with_title("Document Processing Pipeline")
    :with_metadata({ source = "api", priority = "high" })
    :func("app:process", { metadata = { title = "Process Document" } })
    :run()
```

如果未提供，标题默认为 "Flow Builder Workflow"。

## 验证规则

编译器在编译时验证工作流：

- 所有 `:as(name)` 名称必须唯一
- 所有 `:to()` 和 `:error_to()` 目标必须引用现有名称（`@success`、`@fail` 除外）
- 图必须是无环的
- 所有节点必须有传入路由（来自另一个节点、工作流输入或静态数据）
- `:cycle()` 需要 `func_id` 或 `template`（不能同时有）
- `:parallel()` 需要 `source_array_key` 和 `template`
- 至少一条路径必须通向 `@success` 或具有自动输出
- `:when()` 仅跟随来自节点的 `:to()` 或 `:error_to()`（不是静态数据）
- 带 `args` 的节点不能接收带 `"default"` 判别符的输入

## 表达式参考

表达式使用 `expr` 模块语法，在 `:when()` 条件和 `input_transform` 值中可用。

**运算符：** `+`、`-`、`*`、`/`、`%`、`**`、`==`、`!=`、`<`、`<=`、`>`、`>=`、`&&`、`||`、`!`、`contains`、`startsWith`、`endsWith`

**数组函数：** `all()`、`any()`、`none()`、`one()`、`filter()`、`map()`、`count()`、`len()`、`first()`、`last()`

**数学函数：** `max()`、`min()`、`abs()`、`ceil()`、`floor()`、`round()`、`sqrt()`、`pow()`

**字符串函数：** `len()`、`upper()`、`lower()`、`trim()`、`split()`、`join()`

**类型函数：** `type()`、`int()`、`float()`、`string()`

**字面量：** 数字、字符串、布尔值（`true`/`false`）、null（`nil`）、数组（`[1, 2, 3]`）、对象（`{key: value}`）

**三元：** `output.age >= 18 ? output.verified : false`

**可选链：** `output.data?.nested?.value`

## 错误处理

`:run()` 和 `:start()` 都遵循标准的 Lua 错误约定：

- 成功：`data, nil`（run）或 `dataflow_id, nil`（start）
- 失败：`nil, error_message`

错误类别：编译错误、客户端错误、工作流创建错误、执行错误和工作流失败。

## 另请参阅

- [Agents](agents.md) - 代理节点使用的代理框架
- [LLM](llm.md) - LLM 模块
- [Framework Overview](overview.md) - 框架模块用法
