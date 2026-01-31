# Temporal Integration

Wippy integrates with [Temporal.io](https://temporal.io) for durable workflow execution, automatic replay, and long-running processes that survive restarts.

## Client Configuration

Connect to Temporal server:

```yaml
- name: temporal_client
  kind: temporal.client
  address: "localhost:7233"
  namespace: "default"
  lifecycle:
    auto_start: true
```

### Authentication

**API Key (Temporal Cloud):**

```yaml
- name: temporal_client
  kind: temporal.client
  address: "your-namespace.tmprl.cloud:7233"
  namespace: "your-namespace"
  auth:
    type: api_key
    value_from_env: "TEMPORAL_API_KEY"
  lifecycle:
    auto_start: true
```

**mTLS:**

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
    ca_file: "/path/to/ca.pem"
  lifecycle:
    auto_start: true
```

### Environment Variables

Configuration can be overridden via environment:

| Variable | Description |
|----------|-------------|
| `TEMPORAL_ADDRESS` | Server address |
| `TEMPORAL_NAMESPACE` | Namespace |
| `TEMPORAL_API_KEY` | API key for Temporal Cloud |

## Worker Configuration

Workers execute workflows and activities from a task queue:

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

### Worker Options

Fine-tune worker behavior:

```yaml
- name: worker
  kind: temporal.worker
  client: app:temporal_client
  task_queue: "my-app-queue"
  worker_options:
    max_concurrent_workflow_task_execution_size: 1000
    max_concurrent_activity_execution_size: 1000
    max_concurrent_local_activity_execution_size: 1000
    workflow_task_poller_count: 2
    activity_task_poller_count: 2
  lifecycle:
    auto_start: true
```

| Option | Default | Description |
|--------|---------|-------------|
| `max_concurrent_workflow_task_execution_size` | 1000 | Max concurrent workflow tasks |
| `max_concurrent_activity_execution_size` | 1000 | Max concurrent activities |
| `max_concurrent_local_activity_execution_size` | 1000 | Max concurrent local activities |
| `workflow_task_poller_count` | 2 | Workflow task pollers |
| `activity_task_poller_count` | 2 | Activity task pollers |

## Registering Workflows and Activities

Workflows and activities are automatically registered with workers via metadata:

```yaml
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

## Starting Workflows

From Lua code:

```lua
local pid, err = process.spawn(
    "app:order_workflow",    -- workflow entry
    "app:worker",            -- temporal worker
    {order_id = "123"}       -- input
)
```

From HTTP handlers:

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

## See Also

- [Activities](temporal/activities.md) - Activity definitions
- [Workflows](temporal/workflows.md) - Workflow implementation
- [Functions](lua/core/funcs.md) - Function calls
