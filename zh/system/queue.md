# Queue

Wippy 提供队列系统，用于异步消息处理，支持可配置的驱动和消费者。

## 架构

```mermaid
flowchart LR
    P[Publisher] --> D[Driver]
    D --> Q[Queue]
    Q --> C[Consumer]
    C --> W[Worker Pool]
    W --> F[Function]
```

- **Driver** - 后端实现（memory、AMQP、SQS）
- **Queue** - 绑定到驱动的逻辑队列
- **Consumer** - 连接队列到处理器，带并发设置
- **Worker Pool** - 并发消息处理器

多个队列可以共享一个驱动。多个消费者可以从同一队列处理消息。

## Entry 类型

| Kind | 描述 |
|------|------|
| `queue.driver.memory` | 内存队列驱动 |
| `queue.driver.amqp` | AMQP（RabbitMQ）驱动 |
| `queue.driver.sqs` | AWS SQS 驱动（也支持 LocalStack、ElasticMQ）|
| `queue.queue` | 带驱动引用的队列声明 |
| `queue.consumer` | 处理消息的消费者 |

## 驱动配置

### 内存驱动

用于开发和单节点部署的进程内驱动。无外部依赖。

```yaml
- name: memory_driver
  kind: queue.driver.memory
  lifecycle:
    auto_start: true
```

### AMQP 驱动

用于 RabbitMQ 和 AMQP 0-9-1 兼容的 broker。

```yaml
- name: amqp_driver
  kind: queue.driver.amqp
  url: "amqp://guest:guest@localhost:5672/"
  vhost: "/"
  connection_name: "wippy-service"
  heartbeat: "10s"
  connection_timeout: "30s"
  reconnect_delay: "1s"
  reconnect_max_delay: "30s"
  default_message_ttl: "1h"
  default_queue_expiry: "24h"
  prefetch_count: 10
  lifecycle:
    auto_start: true
```

| 字段 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `url` | string | `amqp://guest:guest@localhost:5672/` | Broker URL |
| `vhost` | string | - | 虚拟主机覆盖 |
| `connection_name` | string | - | 在 broker UI 中显示的标识符 |
| `auth_mechanism` | string | `PLAIN` | `PLAIN`、`EXTERNAL`（mTLS）或 `AMQPLAIN` |
| `heartbeat` | duration | - | Keep-alive 间隔 |
| `connection_timeout` | duration | - | 拨号超时 |
| `reconnect_delay` | duration | `1s` | 初始重连退避 |
| `reconnect_max_delay` | duration | `30s` | 最大重连退避 |
| `default_message_ttl` | duration | - | 应用于已声明队列的默认消息 TTL |
| `default_queue_ttl` | duration | - | 应用于已声明队列的默认 TTL |
| `default_queue_expiry` | duration | - | 已声明队列的默认队列过期时间 |
| `prefetch_count` | int | - | Channel 级 prefetch 上限 |
| `frame_size` | int | - | AMQP frame 大小限制 |
| `channel_max` | int | - | 每连接最大 channel 数 |
| `tls` | object | - | TLS 设置（见下文）|

TLS 块：

```yaml
  tls:
    enabled: true
    server_name: "rabbit.example.com"
    cert_env: "AMQP_CLIENT_CERT"
    key_env: "AMQP_CLIENT_KEY"
    ca_env: "AMQP_CA_CERT"
    insecure_skip_verify: false
```

内联 `cert`/`key`/`ca` 字段携带 PEM 内容；`*_env` 变体通过 env registry 解析。两种来源在每个字段上互斥。`insecure_skip_verify` 禁用证书验证（仅用于开发）。

### SQS 驱动

用于 AWS SQS 和 SQS 兼容的 endpoint（LocalStack、ElasticMQ）。凭证、区域和其他 AWS SDK 设置来自共享的 `config.aws` 资源。

```yaml
- name: aws_config
  kind: config.aws
  region: us-east-1
  access_key_id_env: app:AWS_ACCESS_KEY_ID
  secret_access_key_env: app:AWS_SECRET_ACCESS_KEY

- name: sqs_driver
  kind: queue.driver.sqs
  config: app:aws_config
  endpoint: "http://localhost:9324"
  message_retention_period: 345600
  default_delay_seconds: 0
  lifecycle:
    auto_start: true
```

| 字段 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `config` | Registry ID | 必需 | 提供区域和凭证的 `config.aws` 资源 |
| `endpoint` | string | - | 自定义 endpoint URL（LocalStack、ElasticMQ）；真实 AWS 时省略 |
| `message_retention_period` | int | `345600`（4天）| 队列级保留时间（秒）（60–1209600）|
| `default_delay_seconds` | int | `0` | CreateQueue 时应用的默认投递延迟（0–900）|
| `disable_message_checksum_validation` | bool | `false` | 在发送/接收时禁用 SQS 消息校验和检查 |
| `use_fips` | bool | `false` | 使用 FIPS 兼容的 endpoint |
| `use_dual_stack` | bool | `false` | 使用 dual-stack（IPv4 + IPv6）endpoint |

队列在首次使用时由驱动自动创建。在发布时使用 SQS 前缀的 header（`sqs.*`）来寻址 SQS 特定属性；像 `correlation_id` 和 `content_type` 这样的中性键在可能的情况下会被翻译为 SQS 系统属性。

## 队列配置

```yaml
- name: tasks
  kind: queue.queue
  driver: app.queue:memory_driver
  codec: json/plain
  queue_name: "app_tasks"
  driver_options:
    memory:
      max_length: 500
  dead_letter:
    queue: app.queue:tasks_dlq
    max_attempts: 5
```

| 字段 | 类型 | 必需 | 描述 |
|------|------|------|------|
| `driver` | Registry ID | 是 | 队列驱动 |
| `codec` | string | 否 | Payload 编码（如 `json/plain`、`msgpack/plain`）|
| `queue_name` | string | 否 | 外部队列名（默认为 entry 名）|
| `driver_options` | object | 否 | 按驱动 kind 索引的子配置 |
| `dead_letter.queue` | Registry ID | 否 | 失败消息的队列 ID |
| `dead_letter.max_attempts` | int | 否 | 路由到 DLQ 之前的尝试次数 |

### 驱动选项

`driver_options` 下的键按驱动名称分组。驱动只读取自己的子配置——其他键处于休眠状态，这允许单个队列条目在需要时为多个驱动声明设置。

**memory：**

| 键 | 描述 |
|----|------|
| `max_length` | 有界缓冲区大小（0 = 无界）|

**amqp：**

| 键 | 描述 |
|----|------|
| `durable` | 在 broker 重启后保留 |
| `auto_delete` | 当最后一个消费者断开时删除 |
| `message_ttl` | 每队列消息 TTL 覆盖 |
| `queue_expiry` | 未使用队列的过期时间 |
| `max_length` | 保留的最大消息数 |

## 消费者配置

```yaml
- name: task_consumer
  kind: queue.consumer
  queue: app.queue:tasks
  func: app.queue:task_handler
  concurrency: 4
  prefetch: 20
  auto_ack: false
  driver_options:
    amqp:
      consumer_tag: "worker-1"
      exclusive: false
  lifecycle:
    auto_start: true
    depends_on:
      - app.queue:tasks
```

| 字段 | 默认值 | 描述 |
|------|--------|------|
| `queue` | 必需 | 队列 registry ID |
| `func` | 必需 | 处理函数 registry ID |
| `concurrency` | 1 | 并行 worker 数量 |
| `prefetch` | 10 | 每个 worker 的缓冲区大小 |
| `auto_ack` | false | 为 true 时，runtime 不调用 broker ack；处理器成功/失败是唯一的 settle 信号 |
| `driver_options` | - | 按驱动的子配置（与队列结构相同）|

**amqp 消费者选项：**

| 键 | 描述 |
|----|------|
| `exclusive` | 单消费者队列访问 |
| `no_local` | 拒绝在同一连接上发布的消息 |
| `no_wait` | 订阅时不等待 broker 确认 |
| `consumer_tag` | 此订阅的标识符 |

<tip>
消费者遵循调用上下文，可以受安全策略约束。在 lifecycle 级别配置 actor 和策略。参见 <a href="system/security.md">Security</a>。
</tip>

### Worker Pool

Worker 作为并发 goroutine 运行：

```
concurrency: 3, prefetch: 10

1. Driver delivers up to 10 messages to buffer
2. 3 workers pull from buffer concurrently
3. As workers finish, buffer refills
4. Backpressure when all workers busy and buffer full
```

## 处理函数

消费者处理器以解码后的消息体作为第一个参数。使用 `queue.message()` 访问投递元数据（id、headers）。

```lua
local queue = require("queue")
local logger = require("logger")

local function main(body)
    local msg = queue.message()
    logger:info("processing", {
        id = msg:id(),
        correlation_id = msg:header("correlation_id")
    })

    local ok, err = process_task(body)
    if err then
        return false  -- nack: redelivery or DLQ
    end
    return true       -- ack: remove from queue
end

return { main = main }
```

```yaml
- name: task_handler
  kind: function.lua
  source: file://task_handler.lua
  method: main
  modules:
    - queue
    - logger
```

### 确认机制

Runtime 根据处理器返回值自动 settle：

| 处理结果 | 动作 |
|----------|------|
| `true` 或非 `false` 返回 | Ack |
| `false` | Nack（根据驱动重新投递或 dead-letter）|
| 抛出错误 | Nack |

仅在需要提前 settle 时显式调用 `msg:ack()` 或 `msg:nack()`。Settlement 是单次的：先到达的调用获胜。

### Dead-Letter 路由

当队列上配置了 `dead_letter` 时，nack 超过 `max_attempts` 的消息会被路由到 DLQ，驱动会设置 `x_dead_letter_reason` 和 `x_original_queue` header。发布者不得设置任何 `x_*` header——这些保留给 DLQ 簿记使用。

## 发布消息

从 Lua 代码发布：

```lua
local queue = require("queue")

queue.publish("app.queue:tasks", {
    id = "task-123",
    action = "process",
    data = payload
})
```

参见 [Queue 模块](lua/storage/queue.md) 了解完整 API。

## 优雅关闭

消费者停止时：

1. 停止接收新消息
2. 取消 worker 上下文
3. 等待正在处理的消息（有超时）
4. 如果 worker 未及时完成则返回错误

## 参见

- [Queue 模块](lua/storage/queue.md) - Lua API 参考
- [Queue 消费者指南](guides/queue-consumers.md) - 消费者模式和 worker 池
- [Supervision](guides/supervision.md) - 消费者生命周期管理
