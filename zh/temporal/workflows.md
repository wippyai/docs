# Workflows

Workflow 是持久化函数，用于编排 activity 并在故障和重启后保持状态。使用 `workflow.lua` 条目类型定义。

## 定义

```yaml
- name: order_workflow
  kind: workflow.lua
  source: file://order_workflow.lua
  method: main
  modules:
    - funcs
    - time
    - workflow
  meta:
    temporal:
      workflow:
        worker: app:worker
```

### 元数据字段

| 字段 | 必填 | 描述 |
|-------|----------|-------------|
| `worker` | 是 | 对 `temporal.worker` 条目的引用 |
| `name` | 否 | 自定义 workflow 名称（默认为条目 ID） |

## 基本实现

```lua
local funcs = require("funcs")
local time = require("time")

local function main(order)
    -- 调用 activity
    local payment, err = funcs.call("app:charge_payment", {
        amount = order.total,
        customer = order.customer_id
    })
    if err then
        return {status = "failed", error = tostring(err)}
    end

    -- 持久化休眠（可在重启后继续）
    time.sleep("1h")

    -- 另一个 activity
    local shipment, err = funcs.call("app:ship_order", {
        order_id = order.id,
        address = order.shipping_address
    })
    if err then
        funcs.call("app:refund_payment", payment.id)
        return {status = "failed", error = tostring(err)}
    end

    return {
        status = "completed",
        payment_id = payment.id,
        tracking = shipment.tracking_number
    }
end

return { main = main }
```

## Workflow 模块

`workflow` 模块提供 workflow 特定的操作。

### workflow.info()

获取 workflow 执行信息:

```lua
local workflow = require("workflow")

local info = workflow.info()
print(info.workflow_id)    -- Workflow 执行 ID
print(info.run_id)         -- 当前运行 ID
print(info.workflow_type)  -- Workflow 类型名称
print(info.task_queue)     -- 任务队列名称
print(info.namespace)      -- Temporal 命名空间
print(info.attempt)        -- 当前尝试次数
print(info.history_length) -- 历史事件数量
print(info.history_size)   -- 历史大小（字节）
```

### workflow.version()

使用确定性版本控制处理代码变更:

```lua
local version = workflow.version("payment-v2", 1, 2)

if version == 1 then
    -- 旧行为（用于现有执行）
    result = funcs.call("app:old_payment", input)
else
    -- 新行为（版本 2）
    result = funcs.call("app:new_payment", input)
end
```

参数:
- `change_id` - 此变更的唯一标识符
- `min_supported` - 最低支持版本
- `max_supported` - 最高（当前）版本

### workflow.attrs()

更新搜索属性和备注:

```lua
workflow.attrs({
    search = {
        status = "processing",
        customer_id = order.customer_id,
        order_total = order.total
    },
    memo = {
        notes = "Priority customer",
        source = "web"
    }
})
```

### workflow.history_length()

获取 workflow 历史中的事件数量:

```lua
local length = workflow.history_length()
if length > 10000 then
    -- 考虑使用 continue-as-new
end
```

### workflow.history_size()

获取 workflow 历史大小（字节）:

```lua
local size = workflow.history_size()
```

### workflow.call()

执行子 workflow:

```lua
local result, err = workflow.call("app:child_workflow", input_data)
```

## 信号

使用进程收件箱向运行中的 workflow 发送数据。

**发送信号:**

```lua
process.send(workflow_pid, "approve", {
    approved_by = "admin",
    comment = "Looks good"
})
```

**在 workflow 中接收信号:**

```lua
local function main(order)
    local inbox = process.inbox()

    while true do
        local msg = inbox:receive()
        local topic = msg:topic()

        if topic == "approve" then
            local data = msg:payload():data()
            break
        elseif topic == "cancel" then
            local data = msg:payload():data()
            return {status = "cancelled", reason = data.reason}
        end
    end

    return process_order(order)
end
```

## 定时器

持久化定时器可在重启后继续:

```lua
local time = require("time")

time.sleep("24h")
time.sleep("5m")
time.sleep("30s")
```

## 确定性

Workflow 代码必须是确定性的。相同的输入必须产生相同的命令序列。

### 应该做

```lua
-- 使用 workflow info 获取当前时间上下文
local info = workflow.info()

-- 使用持久化休眠
time.sleep("1h")

-- 使用 activity 进行 I/O
local data = funcs.call("app:fetch_data", id)

-- 使用版本控制处理代码变更
local v = workflow.version("change-1", 1, 2)
```

### 不应该做

```lua
-- 不要使用系统时钟时间
local now = os.time()  -- 非确定性

-- 不要直接使用随机数
local r = math.random()  -- 非确定性

-- 不要在 workflow 代码中进行 I/O
local file = io.open("data.txt")  -- 非确定性

-- 不要使用全局可变状态
counter = counter + 1  -- 在重放时非确定性
```

## 错误处理

```lua
local function main(order)
    local result, err = funcs.call("app:risky_activity", order)

    if err then
        -- 记录并补偿
        funcs.call("app:send_alert", {
            error = tostring(err),
            order_id = order.id
        })

        return {status = "failed", error = tostring(err)}
    end

    return {status = "completed", result = result}
end
```

## 补偿模式 (Saga)

```lua
local function main(order)
    local compensations = {}

    -- 步骤 1: 预留库存
    local reservation, err = funcs.call("app:reserve_inventory", order.items)
    if err then
        return {status = "failed", step = "inventory", error = tostring(err)}
    end
    table.insert(compensations, 1, {
        action = "app:release_inventory",
        args = reservation.id
    })

    -- 步骤 2: 收取付款
    local payment, err = funcs.call("app:charge_payment", order.payment)
    if err then
        run_compensations(compensations)
        return {status = "failed", step = "payment", error = tostring(err)}
    end
    table.insert(compensations, 1, {
        action = "app:refund_payment",
        args = payment.id
    })

    -- 步骤 3: 发货
    local shipment, err = funcs.call("app:ship_order", order.shipping)
    if err then
        run_compensations(compensations)
        return {status = "failed", step = "shipping", error = tostring(err)}
    end

    return {status = "completed", tracking = shipment.tracking}
end

local function run_compensations(compensations)
    for _, comp in ipairs(compensations) do
        funcs.call(comp.action, comp.args)
    end
end
```

## 启动 Workflow

从任何代码启动 workflow:

```lua
local pid, err = process.spawn(
    "app:order_workflow",    -- workflow 条目
    "app:worker",            -- temporal worker
    {order_id = "123"}       -- 输入
)
```

从 HTTP 处理器启动:

```lua
local function handler()
    local req = http.request()
    local order = json.decode(req:body())

    local pid, err = process.spawn(
        "app:order_workflow",
        "app:worker",
        order
    )

    if err then
        return http.response():status(500):json({error = tostring(err)})
    end

    return http.response():json({
        workflow_id = tostring(pid),
        status = "started"
    })
end
```

## 另请参阅

- [Overview](overview.md) - 配置
- [Activities](activities.md) - Activity 定义
- [Process](../lua/core/process.md) - 进程管理
- [Functions](../lua/core/funcs.md) - 函数调用
