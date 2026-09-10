---
title: "Temporal 集成"
description: "Wippy 集成 Temporal.io 以实现持久化 workflow 执行、自动重放以及可在重启后继续运行的长时间运行进程。"
---

# Temporal 集成

Wippy 集成 [Temporal.io](https://temporal.io) 以实现持久化 workflow 执行、自动重放以及可在重启后继续运行的长时间运行进程。

## 客户端配置

`temporal.client` 条目类型定义与 Temporal 服务器的连接。

```yaml
- name: temporal_client
  kind: temporal.client
  address: "localhost:7233"
  namespace: "default"
  lifecycle:
    auto_start: true
```

### 必填字段

| 字段 | 描述 |
|-------|-------------|
| `address` | Temporal 服务器地址 (host:port) |

### 可选字段

| 字段 | 默认值 | 描述 |
|-------|---------|-------------|
| `namespace` | "default" | Temporal 命名空间 |
| `tq_prefix` | "" | 所有操作的任务队列名称前缀 |
| `connection_timeout` | "10s" | 连接超时时间 |
| `keep_alive_time` | "30s" | 保活间隔 |
| `keep_alive_timeout` | "10s" | 保活超时时间 |

### 认证

#### 无认证

```yaml
- name: temporal_client
  kind: temporal.client
  address: "localhost:7233"
  auth:
    type: none
```

#### API Key (Temporal Cloud)

通过以下方式之一提供 API key:

```yaml
# 直接指定值
- name: temporal_client
  kind: temporal.client
  address: "your-namespace.tmprl.cloud:7233"
  namespace: "your-namespace"
  auth:
    type: api_key
    api_key: "your-api-key"

# 从环境变量读取
- name: temporal_client
  kind: temporal.client
  address: "your-namespace.tmprl.cloud:7233"
  namespace: "your-namespace"
  auth:
    type: api_key
    api_key: ${env:TEMPORAL_API_KEY}

# 从文件读取
- name: temporal_client
  kind: temporal.client
  address: "your-namespace.tmprl.cloud:7233"
  namespace: "your-namespace"
  auth:
    type: api_key
    api_key_file: "/etc/secrets/temporal-api-key"
```

认证和凭证字段在解码时通过[环境注册表](system/env.md)解析 `${env:NAME}` 占位符。旧式的 `api_key_env` / `key_pem_env` 指令以同样方式解析，但已弃用；请优先使用 `api_key: ${env:NAME}` / `key_pem: ${env:NAME}`。

#### mTLS

```yaml
- name: temporal_client
  kind: temporal.client
  address: "temporal.example.com:7233"
  namespace: "production"
  auth:
    type: mtls
    cert_file: "/path/to/client.pem"
    key_file: "/path/to/client.key"
  tls:
    enabled: true
    ca_file: "/path/to/ca.pem"
```

证书和密钥也可以作为 PEM 字符串或从环境变量中提供:

```yaml
auth:
  type: mtls
  cert_pem: |
    -----BEGIN CERTIFICATE-----
    ...
    -----END CERTIFICATE-----
  key_pem: ${env:TEMPORAL_CLIENT_KEY}
```

### TLS 配置

```yaml
tls:
  enabled: true
  ca_file: "/path/to/ca.pem"
  server_name: "temporal.example.com"    # 覆盖服务器名称验证
  insecure_skip_verify: false            # 跳过验证（仅用于开发环境）
```

### 健康检查

```yaml
health_check:
  enabled: true
  interval: "30s"
```

### 安全上下文传播

Wippy 以带签名的 Temporal 头部把调用方的主体和作用域传播给 workflow 和 activity。签名采用 HMAC-SHA256，密钥由 client 记录持有：

```yaml
- name: temporal_client
  kind: temporal.client
  address: "localhost:7233"
  security_hmac_key: ${env:TEMPORAL_SECURITY_KEY}
  security_hmac_previous_keys:
    - ${env:TEMPORAL_SECURITY_KEY_PREVIOUS}
```

| 字段 | 说明 |
|------|------|
| `security_hmac_key` | Base64 编码的签名密钥；解码后至少需为 32 字节 |
| `security_hmac_previous_keys` | 仍被接受用于校验的 Base64 编码密钥，用于轮换 |

这两个字段在 YAML 中都是 base64，因为它们是字节字段。解码后短于 32 字节的密钥会在配置校验时被拒绝，声明了 `security_hmac_previous_keys` 却没有 `security_hmac_key` 同样会被拒绝。新的头部始终用 `security_hmac_key` 签名；校验时会逐一尝试所列的每个旧密钥，因此轮换流程是：把新密钥设为 `security_hmac_key`，把旧密钥移入 `security_hmac_previous_keys`，等到不再有执行中的实例携带它时再移除。

**在某个主体或作用域下启动 workflow 需要该密钥。** 如果调用方带有安全上下文而 client 没有签名密钥，头部就无法签名，启动会失败。没有密钥的 client 只能从既不带主体也不带作用域的上下文启动 workflow。

worker 从其引用的 client 记录获取这些密钥，因此 worker 无需自行配置任何内容即可从 `client:` 继承签名与校验。参见 [Workflows](temporal/workflows.md#security-context) 和 [Activities](temporal/activities.md)。

## Worker 配置

`temporal.worker` 条目类型定义执行 workflow 和 activity 的 worker。

```yaml
- name: worker
  kind: temporal.worker
  client: app:temporal_client
  task_queue: "my-app-queue"
  lifecycle:
    auto_start: true
    depends_on:
      - app:temporal_client
```

### 必填字段

| 字段 | 描述 |
|-------|-------------|
| `client` | 对 `temporal.client` 条目的引用 |
| `task_queue` | 任务队列名称 |

### Worker 选项

微调 worker 行为:

```yaml
- name: worker
  kind: temporal.worker
  client: app:temporal_client
  task_queue: "my-app-queue"
  worker_options:
    # 身份
    identity: ""                          # Worker 身份（显示在 Temporal UI 中）

    # 并发
    max_concurrent_activity_execution_size: 1000
    max_concurrent_workflow_task_execution_size: 1000
    max_concurrent_local_activity_execution_size: 1000
    max_concurrent_session_execution_size: 1000
    max_concurrent_eager_activity_execution_size: 0

    # 轮询器
    max_concurrent_activity_task_pollers: 20
    max_concurrent_workflow_task_pollers: 20

    # 速率限制
    worker_activities_per_second: 0        # 0 = 无限制
    worker_local_activities_per_second: 0
    task_queue_activities_per_second: 0

    # 超时
    sticky_schedule_to_start_timeout: "5s"
    worker_stop_timeout: "0s"
    deadlock_detection_timeout: "0s"
    max_heartbeat_throttle_interval: "0s"
    default_heartbeat_throttle_interval: "0s"

    # 功能标志
    enable_logging_in_replay: false
    enable_session_worker: false
    disable_workflow_worker: false
    local_activity_worker_only: false
    disable_eager_activities: false
    disable_registration_aliasing: false

    # 版本控制
    deployment_name: ""
    build_id: ""
    build_id: ${env:BUILD_ID}              # 从 env registry 读取
    use_versioning: false
    default_versioning_behavior: "pinned" # 或 "auto_upgrade"
```

凭证和标识符字段在解码时通过[环境注册表](system/env.md)解析 `${env:NAME}` 占位符。旧式的 `build_id_env` 指令以同样方式解析，但已弃用；请优先使用 `build_id: ${env:NAME}`。

### 版本控制行为

当启用 `use_versioning` 时，`default_versioning_behavior` 控制新的工作流运行如何选择 worker 构建 ID：

| 值 | 行为 |
|------|------|
| `pinned` | 工作流在整个运行期间保持在启动时所用的构建 ID 上 |
| `auto_upgrade` | 工作流可在每个任务后在最新兼容的构建 ID 上恢复 |

当未提供字面量 `build_id` 时，`build_id: ${env:NAME}` 从 env registry 读取构建 ID。

### Session Worker

`enable_session_worker: true` 允许 worker 运行 Temporal Sessions：一系列固定到单个 worker 的活动（当活动需要共享本地状态如临时目录或打开的连接时很有用）。`max_concurrent_session_execution_size` 限制 worker 上的并发会话数。

### 并发默认值

| 选项 | 默认值 |
|--------|---------|
| `max_concurrent_activity_execution_size` | 1000 |
| `max_concurrent_workflow_task_execution_size` | 1000 |
| `max_concurrent_local_activity_execution_size` | 1000 |
| `max_concurrent_session_execution_size` | 1000 |
| `max_concurrent_activity_task_pollers` | 20 |
| `max_concurrent_workflow_task_pollers` | 20 |
| `sticky_schedule_to_start_timeout` | 5s |

## 完整示例

```yaml
version: "1.0"
namespace: app

entries:
  - name: temporal_client
    kind: temporal.client
    address: "localhost:7233"
    namespace: "default"
    lifecycle:
      auto_start: true

  - name: worker
    kind: temporal.worker
    client: app:temporal_client
    task_queue: "orders"
    lifecycle:
      auto_start: true
      depends_on:
        - app:temporal_client

  - name: order_workflow
    kind: workflow.lua
    source: file://order_workflow.lua
    method: main
    modules:
      - funcs
      - time
    meta:
      temporal:
        workflow:
          worker: app:worker

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

## 另请参阅

- [Activities](activities.md) - Activity 定义
- [Workflows](workflows.md) - Workflow 实现
