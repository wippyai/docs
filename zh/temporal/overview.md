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
    api_key_env: "TEMPORAL_API_KEY"

# 从文件读取
- name: temporal_client
  kind: temporal.client
  address: "your-namespace.tmprl.cloud:7233"
  namespace: "your-namespace"
  auth:
    type: api_key
    api_key_file: "/etc/secrets/temporal-api-key"
```

以 `_env` 结尾的字段引用系统中定义的环境变量。有关配置环境存储和变量的详细信息，请参阅[环境系统](../system/env.md)。

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
  key_pem_env: "TEMPORAL_CLIENT_KEY"
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
    # 并发
    max_concurrent_activity_execution_size: 1000
    max_concurrent_workflow_task_execution_size: 1000
    max_concurrent_local_activity_execution_size: 1000
    max_concurrent_session_execution_size: 1000

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

    # 功能标志
    enable_logging_in_replay: false
    enable_session_worker: false
    disable_workflow_worker: false
    local_activity_worker_only: false
    disable_eager_activities: false

    # 版本控制
    deployment_name: ""
    build_id: ""
    build_id_env: "BUILD_ID"              # 从环境变量读取
    use_versioning: false
    default_versioning_behavior: "pinned" # 或 "auto_upgrade"
```

以 `_env` 结尾的字段引用通过[环境系统](../system/env.md)条目定义的环境变量。

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
