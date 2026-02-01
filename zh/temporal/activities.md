# Activities

Activity 是执行非确定性操作的函数。任何 `function.lua` 或 `process.lua` 条目都可以通过添加元数据注册为 Temporal activity。

## 注册 Activity

添加 `meta.temporal.activity` 将函数注册为 activity:

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

Activity 是普通的 Lua 函数:

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

在 workflow 中，使用 `funcs` 模块:

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

### Activity 选项

配置超时和重试行为:

```lua
local funcs = require("funcs")

local executor = funcs.new()
executor = executor:with_options({
    start_to_close_timeout = "30s",
    schedule_to_close_timeout = "5m",
    heartbeat_timeout = "10s",
    retry_policy = {
        max_attempts = 3,
        initial_interval = "1s",
        backoff_coefficient = 2.0,
        max_interval = "1m"
    }
})

local result, err = executor:call("app:charge_payment", input)
```

## 本地 Activity

本地 activity 在 workflow worker 进程中执行，无需单独的任务队列轮询。适用于快速、短时操作:

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

特点:
- 在 workflow worker 进程中执行
- 更低的延迟
- 无单独的任务队列开销
- 仅限短时执行
- 无心跳机制

## Activity 命名

Activity 以其完整条目 ID 作为名称注册:

```yaml
namespace: app
entries:
  - name: charge_payment
    kind: function.lua
    # ...
```

Activity 名称: `app:charge_payment`

## 错误处理

通过标准 Lua 模式返回错误:

```lua
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

## Process Activity

`process.lua` 条目也可以注册为 activity:

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

- [Overview](overview.md) - 配置
- [Workflows](workflows.md) - Workflow 实现
- [Functions](../lua/core/funcs.md) - 函数模块
