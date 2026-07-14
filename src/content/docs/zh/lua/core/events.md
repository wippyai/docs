---
title: "事件总线"
description: "<secondary-label ref='function'/ <secondary-label ref='process'/ <secondary-label ref='permissions'/"
---

# 事件总线
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="permissions"/>

发布和订阅事件，用于观测——监控运行时和应用活动并对其做出响应。

<note>
事件总线仅用于观测：监控、日志、指标和响应式副作用。它是尽力而为的发布/订阅通道，不是可靠传输——不要在其上构建业务逻辑，也不要依赖它保证投递。业务关键消息传递请使用进程消息（`process.send`）、通道或[消息队列](lua/storage/queue.md)。
</note>

## 加载

```lua
local events = require("events")
```

## 订阅事件

从事件总线订阅事件：

```lua
-- 订阅所有订单事件
local sub, err = events.subscribe("orders.*")
if err then
    return nil, err
end

-- 订阅特定事件类型
local sub = events.subscribe("users", "user.created")

-- 订阅系统的所有事件
local sub = events.subscribe("payments")

-- 处理事件
local ch = sub:channel()
while true do
    local evt, ok = ch:receive()
    if not ok then break end

    logger:info("Received event", {
        system = evt.system,
        kind = evt.kind,
        path = evt.path
    })
    handle_event(evt)
end
```

| 参数 | 类型 | 描述 |
|------|------|------|
| `system` | string | 系统模式（支持通配符，如 "test.*"） |
| `kind` | string | 事件类型过滤（可选） |

**返回:** `Subscription, error`

## 发送事件

向事件总线发送事件：

```lua
-- 发送订单创建事件
local ok, err = events.send("orders", "order.created", "/orders/123", {
    order_id = "123",
    customer_id = "456",
    total = 99.99
})
if err then
    return nil, err
end

-- 发送用户事件
events.send("users", "user.registered", "/users/" .. user.id, {
    user_id = user.id,
    email = user.email,
    created_at = time.now():format("2006-01-02T15:04:05Z07:00")
})

-- 发送支付事件
events.send("payments", "payment.completed", "/payments/" .. payment.id, {
    payment_id = payment.id,
    order_id = payment.order_id,
    amount = payment.amount,
    method = payment.method
})

-- 发送无数据事件
events.send("system", "heartbeat", "/health")
```

| 参数 | 类型 | 描述 |
|------|------|------|
| `system` | string | 系统标识符 |
| `kind` | string | 事件类型/种类 |
| `path` | string | 用于路由的事件路径 |
| `data` | any | 事件负载（可选） |

**返回:** `boolean, error`

## 订阅方法

### 获取通道

获取用于接收事件的通道：

```lua
local ch = sub:channel()

local evt, ok = ch:receive()
if ok then
    print("System:", evt.system)
    print("Kind:", evt.kind)
    print("Path:", evt.path)
    print("Data:", json.encode(evt.data))
end
```

事件字段：`system`、`kind`、`path`、`data`

### 关闭订阅

取消订阅并关闭通道：

```lua
sub:close()
```

## 权限

| 操作 | 资源 | 描述 |
|------|------|------|
| `events.subscribe` | system | 订阅来自某系统的事件 |
| `events.send` | system | 向某系统发送事件 |

## 错误

| 条件 | 类型 | 可重试 |
|------|------|--------|
| 系统为空 | `errors.INVALID` | 否 |
| 类型为空 | `errors.INVALID` | 否 |
| 路径为空 | `errors.INVALID` | 否 |
| 策略拒绝 | `errors.INVALID` | 否 |

错误处理参见[错误处理](lua/core/errors.md)。
