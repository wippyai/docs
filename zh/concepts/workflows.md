# 工作流

工作流是持久的、长时间运行的操作，能在崩溃和重启后存活。它们为支付、订单履行和多步骤审批等关键业务流程提供可靠性保证。

## 为什么使用工作流？

函数是临时性的——如果宿主崩溃，进行中的工作就会丢失。工作流持久化它们的状态：

| 方面 | 函数 | 工作流 |
|------|------|--------|
| 状态 | 内存中 | 持久化 |
| 崩溃 | 工作丢失 | 恢复 |
| 持续时间 | 秒到分钟 | 小时到月 |
| 完成 | 尽力而为 | 保证 |

## 工作流如何运作

工作流代码看起来像普通的 Lua 代码：

```lua
local funcs = require("funcs")
local time = require("time")

local result = funcs.call("app.api:charge_card", payment)
time.sleep("24h")
local status = funcs.call("app.api:check_status", result.id)

if status == "failed" then
    funcs.call("app.api:refund", result.id)
end
```

工作流引擎拦截调用并记录结果。如果进程崩溃，执行从历史记录重放——相同的代码，相同的结果。

<note>
Wippy 自动处理确定性。<code>funcs.call()</code>、<code>time.sleep()</code>、<code>uuid.v4()</code> 和 <code>time.now()</code> 等操作被拦截并记录其结果。在重放时，返回记录的值而不是重新执行。
</note>

## 工作流模式

### Saga 模式

失败时补偿：

```lua
local funcs = require("funcs")

local inventory = funcs.call("app.inventory:reserve", items)
if inventory.error then
    return nil, inventory.error
end

local payment = funcs.call("app.payments:charge", amount)
if payment.error then
    funcs.call("app.inventory:release", inventory.id)
    return nil, payment.error
end

local shipping = funcs.call("app.shipping:create", order)
if shipping.error then
    funcs.call("app.payments:refund", payment.id)
    funcs.call("app.inventory:release", inventory.id)
    return nil, shipping.error
end

return {inventory = inventory, payment = payment, shipping = shipping}
```

### 等待信号

等待外部事件（审批决定、webhook、用户操作）：

```lua
local funcs = require("funcs")

funcs.call("app.approvals:submit", request)

local inbox = process.inbox()
local msg = inbox:receive()  -- 阻塞直到信号到达

if msg.approved then
    funcs.call("app.orders:fulfill", request.order_id)
else
    funcs.call("app.notifications:send_rejection", request)
end
```

## 何时使用什么

| 用例 | 选择 |
|------|------|
| HTTP 请求处理 | 函数 |
| 数据转换 | 函数 |
| 后台作业 | 进程 |
| 用户会话状态 | 进程 |
| 实时消息 | 进程 |
| 支付处理 | 工作流 |
| 订单履行 | 工作流 |
| 多天审批 | 工作流 |

## 启动工作流

工作流的生成方式与进程相同——使用 `process.spawn()` 但使用不同的宿主：

```lua
-- 在 temporal worker 上生成工作流
local pid = process.spawn("app.workflows:order_processor", "app:temporal_worker", order_data)

-- 向工作流发送信号
process.send(pid, "update", {status = "approved"})
```

从调用者的角度来看，API 是相同的。区别在于宿主：工作流运行在 `temporal.worker` 而不是 `process.host` 上。

<tip>
当工作流通过 <code>process.spawn()</code> 生成子进程时，它们成为同一提供者上的子工作流，保持持久性保证。
</tip>

## 失败和监管

进程可以使用 `process.service` 作为受监管的服务运行：

```yaml
# 进程定义
- name: session_handler
  kind: process.lua
  source: file://session_handler.lua
  method: main

# 包装进程的受监管服务
- name: session_manager
  kind: process.service
  process: app:session_handler
  host: app:processes
  lifecycle:
    auto_start: true
    restart:
      max_attempts: 10
```

工作流不使用监管树——它们由工作流提供者（Temporal）自动管理。提供者处理持久化、重试和恢复。

## 配置

进程定义（动态生成）：

```yaml
- name: order_processor
  kind: workflow.lua
  source: file://order_processor.lua
  method: main
  modules:
    - funcs
    - time
```

工作流提供者：

```yaml
- name: temporal_worker
  kind: temporal.worker
  client: app:temporal_client
  task_queue: "orders"
  lifecycle:
    auto_start: true
```

参见 [Temporal](https://temporal.io) 了解生产级工作流基础设施。

## 另请参阅

- [函数](concepts/functions.md) — 无状态请求处理
- [进程模型](concepts/process-model.md) — 有状态后台工作
- [监管](guides/supervision.md) — 进程重启策略
