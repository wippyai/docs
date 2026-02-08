# Activities

Activity 是执行非确定性操作的函数。任何 `function.lua` 或 `process.lua` 条目都可以通过添加元数据注册为 Temporal activity。

## 注册 Activity

添加 `meta.temporal.activity` 将函数注册为 activity：

```yaml
- name: charge_payment
  kind: function.lua
  source: file://payment.lua
  method: charge
  modules:
    - http_client
    - json
  meta:
    temporal:
      activity:
        worker: app:worker
```

### 元数据字段

| 字段 | 必填 | 描述 |
|-------|----------|-------------|
| `worker` | 是 | 对 `temporal.worker` 条目的引用 |
| `local` | 否 | 作为本地 activity 执行（默认: false） |

## 实现

Activity 是普通的 Lua 函数：

```lua
-- payment.lua
local http = require("http_client")
local json = require("json")

local function charge(input)
    local response, err = http.post("https://api.stripe.com/v1/charges", {
        headers = {
            ["Authorization"] = "Bearer " .. input.api_key,
            ["Content-Type"] = "application/json"
        },
        body = json.encode({
            amount = input.amount,
            currency = input.currency,
            source = input.token
        })
    })

    if err then
        return nil, err
    end

    return json.decode(response:body())
end

return { charge = charge }
```

## 调用 Activity

在 workflow 中，使用 `funcs` 模块：

```lua
local funcs = require("funcs")

local result, err = funcs.call("app:charge_payment", {
    amount = 5000,
    currency = "usd",
    token = "tok_visa",
    api_key = ctx.stripe_key
})

if err then
    return nil, err
end
```

## Activity 选项

使用执行器构建器配置超时、重试行为和其他执行参数：

```lua
local funcs = require("funcs")

local executor = funcs.new():with_options({
    ["activity.start_to_close_timeout"] = "30s",
    ["activity.schedule_to_close_timeout"] = "5m",
    ["activity.heartbeat_timeout"] = "10s",
    ["activity.retry_policy"] = {
        maximum_attempts = 3,
        initial_interval = 1000,
        backoff_coefficient = 2.0,
        maximum_interval = 60000,
    }
})

local result, err = executor:call("app:charge_payment", input)
```

执行器不可变且可复用。构建一次即可用于多次调用：

```lua
local reliable = funcs.new():with_options({
    ["activity.start_to_close_timeout"] = "60s",
    ["activity.retry_policy"] = {
        maximum_attempts = 5,
        initial_interval = 2000,
        backoff_coefficient = 2.0,
        maximum_interval = 120000,
    }
})

local a, err = reliable:call("app:step_one", input)
local b, err = reliable:call("app:step_two", a)
```

### 选项参考

| 选项 | 类型 | 默认值 | 描述 |
|--------|------|---------|-------------|
| `activity.start_to_close_timeout` | duration | 10m | activity 执行的最长时间 |
| `activity.schedule_to_close_timeout` | duration | - | 从调度到完成的最长时间 |
| `activity.schedule_to_start_timeout` | duration | - | activity 开始执行前的最长等待时间 |
| `activity.heartbeat_timeout` | duration | - | heartbeat 之间的最长间隔 |
| `activity.id` | string | - | 自定义 activity 执行 ID |
| `activity.task_queue` | string | - | 覆盖此调用的任务队列 |
| `activity.wait_for_cancellation` | boolean | false | 等待 activity 取消完成 |
| `activity.disable_eager_execution` | boolean | false | 禁用即时执行 |
| `activity.retry_policy` | table | - | 重试配置（见下文） |

Duration 值可使用字符串（`"5s"`、`"10m"`、`"1h"`）或以毫秒为单位的数字。

### 重试策略

为失败的 activity 配置自动重试行为：

```lua
["activity.retry_policy"] = {
    initial_interval = 1000,         -- ms before first retry
    backoff_coefficient = 2.0,       -- multiplier for each retry
    maximum_interval = 300000,       -- max interval between retries (ms)
    maximum_attempts = 10,           -- max retry attempts (0 = unlimited)
    non_retryable_error_types = {    -- errors that skip retries
        "INVALID",
        "PERMISSION_DENIED"
    }
}
```

| 字段 | 类型 | 默认值 | 描述 |
|-------|------|---------|-------------|
| `initial_interval` | number | 1000 | 首次重试前的毫秒数 |
| `backoff_coefficient` | number | 2.0 | 每次重试应用于间隔的乘数 |
| `maximum_interval` | number | - | 重试间隔上限（毫秒） |
| `maximum_attempts` | number | 0 | 最大尝试次数（0 = 无限） |
| `non_retryable_error_types` | array | - | 跳过重试的错误类型 |

### 超时关系

```
|--- schedule_to_close_timeout --------------------------------|
|--- schedule_to_start_timeout ---|--- start_to_close_timeout -|
     (waiting in queue)                (executing)
```

- `start_to_close_timeout`：activity 本身可运行的最长时间。这是最常用的超时设置。
- `schedule_to_close_timeout`：从 activity 调度到完成的总时间，包括队列等待时间和重试。
- `schedule_to_start_timeout`：activity 在任务队列中等待 worker 接取的最长时间。
- `heartbeat_timeout`：对于长时间运行的 activity，两次 heartbeat 报告之间的最长间隔。

## 本地 Activity

本地 activity 在 workflow worker 进程中执行，无需单独的任务队列轮询：

```yaml
- name: validate_input
  kind: function.lua
  source: file://validate.lua
  method: validate
  modules:
    - json
  meta:
    temporal:
      activity:
        worker: app:worker
        local: true
```

特点：
- 在 workflow worker 进程中执行
- 延迟更低（无任务队列往返）
- 无单独任务队列开销
- 仅限短时执行
- 无 heartbeat 机制

适合快速、短时的操作，如输入验证、数据转换或缓存查找。

## Activity 命名

Activity 以其完整条目 ID 作为名称注册：

```yaml
namespace: app
entries:
  - name: charge_payment
    kind: function.lua
    # ...
```

Activity 名称：`app:charge_payment`

## 上下文传播

启动 workflow 时设置的上下文值在 activity 内部可用：

```lua
-- Spawner sets context
local spawner = process.with_context({
    user_id = "user-1",
    tenant = "tenant-1",
})
local pid = spawner:spawn("app:order_workflow", "app:worker", order)
```

```lua
-- Activity reads context
local ctx = require("ctx")

local function process_order(input)
    local user_id = ctx.get("user_id")   -- "user-1"
    local tenant = ctx.get("tenant")     -- "tenant-1"
    -- use context for authorization, logging, etc.
end
```

通过 `funcs.new():with_context()` 调用的 activity 也会传播上下文：

```lua
-- Inside workflow
local executor = funcs.new():with_context({trace_id = "abc-123"})
local result, err = executor:call("app:charge_payment", input)
```

## 错误处理

通过标准 Lua 模式返回错误：

```lua
local errors = require("errors")

local function charge(input)
    if not input.amount or input.amount <= 0 then
        return nil, errors.new("INVALID", "amount must be positive")
    end

    local response, err = http.post(url, options)
    if err then
        return nil, errors.wrap(err, "payment API failed")
    end

    if response:status() >= 400 then
        return nil, errors.new("FAILED", "payment declined")
    end

    return json.decode(response:body())
end
```

### 错误对象

传播到 workflow 的 activity 错误携带结构化元数据：

```lua
local result, err = funcs.call("app:charge_payment", input)
if err then
    err:kind()       -- error classification string
    err:retryable()  -- boolean, whether retry makes sense
    err:message()    -- human-readable error message
end
```

### 故障模式

| 故障 | 错误类型 | 可重试 | 描述 |
|---------|------------|-----------|-------------|
| 应用错误 | 各异 | 各异 | activity 代码返回的错误 |
| 运行时崩溃 | `INTERNAL` | 是 | activity 中未处理的 Lua 错误 |
| 缺少 activity | `NOT_FOUND` | 否 | Activity 未注册到 worker |
| 超时 | `TIMEOUT` | 是 | Activity 超过配置的超时时间 |

```lua
local executor = funcs.new():with_options({
    ["activity.retry_policy"] = {maximum_attempts = 1}
})

local result, err = executor:call("app:missing_activity", input)
if err then
    print(err:kind())      -- "NOT_FOUND"
    print(err:retryable())  -- false
end
```

## Process Activity

`process.lua` 条目也可以注册为 activity，用于长时间运行的操作：

```yaml
- name: long_task
  kind: process.lua
  source: file://long_task.lua
  method: main
  modules:
    - http_client
  meta:
    temporal:
      activity:
        worker: app:worker
```

## 另请参阅

- [Overview](temporal/overview.md) - 配置
- [Workflows](temporal/workflows.md) - Workflow 实现
- [Functions](lua/core/funcs.md) - 函数模块
- [Error Handling](lua/core/errors.md) - 错误类型与模式
