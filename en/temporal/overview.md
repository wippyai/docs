# Temporal Integration

Wippy integrates with [Temporal.io](https://temporal.io) for durable workflow execution, automatic replay, and long-running processes that survive restarts.

## Client Configuration

The `temporal.client` entry kind defines a connection to a Temporal server.

```yaml
- name: temporal_client
  kind: temporal.client
  address: "localhost:7233"
  namespace: "default"
  lifecycle:
    auto_start: true
```

### Required Fields

| Field | Description |
|-------|-------------|
| `address` | Temporal server address (host:port) |

### Optional Fields

| Field | Default | Description |
|-------|---------|-------------|
| `namespace` | "default" | Temporal namespace |
| `tq_prefix` | "" | Task queue name prefix for all operations |
| `connection_timeout` | "10s" | Connection timeout |
| `keep_alive_time` | "30s" | Keep-alive interval |
| `keep_alive_timeout` | "10s" | Keep-alive timeout |

### Authentication

#### No Authentication

```yaml
- name: temporal_client
  kind: temporal.client
  address: "localhost:7233"
  auth:
    type: none
```

#### API Key (Temporal Cloud)

Provide the API key via one of these methods:

```yaml
# Direct value
- name: temporal_client
  kind: temporal.client
  address: "your-namespace.tmprl.cloud:7233"
  namespace: "your-namespace"
  auth:
    type: api_key
    api_key: "your-api-key"

# From environment variable
- name: temporal_client
  kind: temporal.client
  address: "your-namespace.tmprl.cloud:7233"
  namespace: "your-namespace"
  auth:
    type: api_key
    api_key_env: "TEMPORAL_API_KEY"

# From file
- name: temporal_client
  kind: temporal.client
  address: "your-namespace.tmprl.cloud:7233"
  namespace: "your-namespace"
  auth:
    type: api_key
    api_key_file: "/etc/secrets/temporal-api-key"
```

Fields ending in `_env` reference environment variables that must be defined in the system. See [Environment System](system/env.md) for configuring environment storage and variables.

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

Certificate and key can also be provided as PEM strings or from environment:

```yaml
auth:
  type: mtls
  cert_pem: |
    -----BEGIN CERTIFICATE-----
    ...
    -----END CERTIFICATE-----
  key_pem_env: "TEMPORAL_CLIENT_KEY"
```

### TLS Configuration

```yaml
tls:
  enabled: true
  ca_file: "/path/to/ca.pem"
  server_name: "temporal.example.com"    # Override server name verification
  insecure_skip_verify: false            # Skip verification (dev only)
```

### Health Checks

```yaml
health_check:
  enabled: true
  interval: "30s"
```

## Worker Configuration

The `temporal.worker` entry kind defines a worker that executes workflows and activities.

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

### Required Fields

| Field | Description |
|-------|-------------|
| `client` | Reference to a `temporal.client` entry |
| `task_queue` | Task queue name |

### Worker Options

Fine-tune worker behavior:

```yaml
- name: worker
  kind: temporal.worker
  client: app:temporal_client
  task_queue: "my-app-queue"
  worker_options:
    # Concurrency
    max_concurrent_activity_execution_size: 1000
    max_concurrent_workflow_task_execution_size: 1000
    max_concurrent_local_activity_execution_size: 1000
    max_concurrent_session_execution_size: 1000

    # Pollers
    max_concurrent_activity_task_pollers: 20
    max_concurrent_workflow_task_pollers: 20

    # Rate limiting
    worker_activities_per_second: 0        # 0 = unlimited
    worker_local_activities_per_second: 0
    task_queue_activities_per_second: 0

    # Timeouts
    sticky_schedule_to_start_timeout: "5s"
    worker_stop_timeout: "0s"
    deadlock_detection_timeout: "0s"

    # Feature flags
    enable_logging_in_replay: false
    enable_session_worker: false
    disable_workflow_worker: false
    local_activity_worker_only: false
    disable_eager_activities: false

    # Versioning
    deployment_name: ""
    build_id: ""
    build_id_env: "BUILD_ID"              # Read from environment variable
    use_versioning: false
    default_versioning_behavior: "pinned" # or "auto_upgrade"
```

Fields ending in `_env` reference environment variables defined via [Environment System](system/env.md) entries.

### Concurrency Defaults

| Option | Default |
|--------|---------|
| `max_concurrent_activity_execution_size` | 1000 |
| `max_concurrent_workflow_task_execution_size` | 1000 |
| `max_concurrent_local_activity_execution_size` | 1000 |
| `max_concurrent_session_execution_size` | 1000 |
| `max_concurrent_activity_task_pollers` | 20 |
| `max_concurrent_workflow_task_pollers` | 20 |
| `sticky_schedule_to_start_timeout` | 5s |

## Complete Example

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

## See Also

- [Activities](temporal/activities.md) - Activity definitions
- [Workflows](temporal/workflows.md) - Workflow implementation
