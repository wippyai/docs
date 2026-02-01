# 消息队列
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>
<secondary-label ref="permissions"/>

向分布式队列发布和消费消息。支持多种后端，包括 RabbitMQ 和其他 AMQP 兼容的代理。

队列配置请参阅 [队列](system/queue.md)。

## 加载

```lua
local queue = require("queue")
```

## 发布消息

通过 ID 向队列发送消息：

```lua
local ok, err = queue.publish("app:tasks", {
    action = "send_email",
    user_id = 456,
    template = "welcome"
})
if err then
    return nil, err
end
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `queue_id` | string | 队列标识符（格式："namespace:name"） |
| `data` | any | 消息数据（表、字符串、数字、布尔值） |
| `headers` | table | 可选的消息头 |

**返回:** `boolean, error`

### 消息头

消息头用于路由、优先级和追踪：

```lua
queue.publish("app:notifications", {
    type = "order_shipped",
    order_id = order.id
}, {
    priority = "high",
    correlation_id = request_id
})
```

## 访问投递上下文

在队列消费者中访问当前消息：

```lua
local msg, err = queue.message()
if err then
    return nil, err
end

local msg_id = msg:id()
local priority = msg:header("priority")
local all_headers = msg:headers()
```

**返回:** `Message, error`

仅在消费者上下文中处理队列消息时可用。

## 消息方法

| 方法 | 返回 | 描述 |
|--------|---------|-------------|
| `id()` | `string, error` | 唯一消息标识符 |
| `header(key)` | `any, error` | 单个头值（缺失时为 nil） |
| `headers()` | `table, error` | 所有消息头 |

## 消费者模式

队列消费者定义为直接接收负载的入口点：

```yaml
entries:
  - kind: queue.consumer
    id: email_worker
    queue: app:emails
    method: handle_email
```

```lua
function handle_email(payload)
    local msg = queue.message()

    logger:info("Processing", {
        message_id = msg:id(),
        to = payload.to
    })

    local ok, err = email.send(payload.to, payload.template, payload.data)
    if err then
        return nil, err  -- 消息将被重新入队或进入死信队列
    end
end
```

## 权限

队列操作受安全策略评估约束。

| 操作 | 资源 | 描述 |
|--------|----------|-------------|
| `queue.publish` | - | 发布消息的通用权限 |
| `queue.publish.queue` | 队列 ID | 向特定队列发布 |

两种权限都会被检查：首先是通用权限，然后是特定队列的权限。

## 错误

| 条件 | 类型 | 可重试 |
|-----------|------|-----------|
| 队列 ID 为空 | `errors.INVALID` | 否 |
| 消息数据为空 | `errors.INVALID` | 否 |
| 无投递上下文 | `errors.INVALID` | 否 |
| 权限被拒绝 | `errors.PERMISSION_DENIED` | 否 |
| 发布失败 | `errors.INTERNAL` | 是 |

错误处理请参阅 [错误处理](lua/core/errors.md)。

## 另请参阅

- [队列配置](system/queue.md) - 队列驱动和入口定义
- [队列消费者指南](guides/queue-consumers.md) - 消费者模式和工作池
- [进程管理](lua/core/process.md) - 进程生成和通信
- [通道](lua/core/channel.md) - 进程间通信模式
- [函数](lua/core/funcs.md) - 异步函数调用
