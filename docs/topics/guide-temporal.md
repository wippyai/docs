# Temporal Integration

Run durable workflows with Temporal.io.

## Overview

Wippy integrates with Temporal for:
- Durable workflow execution
- Activity orchestration
- Automatic replay and recovery

Workflows and activities are auto-registered via entry metadata.

## Client Configuration

Define a Temporal client entry:

```yaml
- name: temporal_client
  kind: temporal.client
  address: localhost:7233
  namespace: default
  lifecycle:
    auto_start: true
```

### Authentication

**API Key:**

```yaml
- name: temporal_client
  kind: temporal.client
  address: temporal.example.com:7233
  namespace: production
  auth:
    type: api_key
    value_from_env: TEMPORAL_API_KEY
```

**mTLS:**

```yaml
- name: temporal_client
  kind: temporal.client
  address: temporal.example.com:7233
  namespace: production
  auth:
    type: mtls
    cert_file: /path/to/cert.pem
    key_file: /path/to/key.pem
  tls:
    ca_file: /path/to/ca.pem
```

## Worker Configuration

Define a worker to execute workflows and activities:

```yaml
- name: worker
  kind: temporal.worker
  client: app:temporal_client
  task_queue: my-tasks
  lifecycle:
    auto_start: true
    depends_on:
      - app:temporal_client
```

### Worker Options

| Field | Default | Description |
|-------|---------|-------------|
| `client` | required | Reference to temporal.client entry |
| `task_queue` | required | Task queue name |
| `worker_options.max_concurrent_workflow_task_execution_size` | 1000 | Max concurrent workflow tasks |
| `worker_options.max_concurrent_activity_execution_size` | 1000 | Max concurrent activities |
| `worker_options.max_concurrent_local_activity_execution_size` | 1000 | Max concurrent local activities |
| `worker_options.workflow_task_poller_count` | 2 | Workflow task pollers |
| `worker_options.activity_task_poller_count` | 2 | Activity task pollers |

## Workflows

Workflows are `workflow.lua` entries with temporal metadata:

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

```lua
-- order_workflow.lua
local funcs = require("funcs")
local time = require("time")
local workflow = require("workflow")

local function main(input)
    -- Get workflow info
    local info = workflow.info()

    -- Call activity (automatically routed through Temporal)
    local payment, err = funcs.call("app:charge_payment", {
        order_id = input.order_id,
        amount = input.amount
    })
    if err then
        return nil, err
    end

    -- Durable sleep (survives restarts)
    time.sleep("24h")

    -- Send notification
    funcs.call("app:send_notification", {
        user_id = input.user_id,
        message = "Order shipped"
    })

    return { status = "completed", payment_id = payment.id }
end

return main
```

### Workflow Module API

| Function | Description |
|----------|-------------|
| `workflow.info()` | Returns workflow execution info (workflow_id, run_id, task_queue, attempt, etc.) |
| `workflow.version(change_id, min, max)` | Deterministic versioning for code changes |
| `workflow.history_length()` | Current event history length |
| `workflow.history_size()` | Event history size in bytes |
| `workflow.attrs({search={}, memo={}})` | Upsert search attributes and memo |

## Activities

Functions become activities via temporal metadata:

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

```lua
-- payment.lua
local http_client = require("http_client")
local json = require("json")

local function charge(input)
    local resp, err = http_client.post("https://api.stripe.com/charges", {
        body = json.encode({
            amount = input.amount,
            order_id = input.order_id
        })
    })
    if err then
        return nil, err
    end
    return json.decode(resp.body)
end

return { charge = charge }
```

### Local Activities

For fast, in-process activities that don't need separate task queue routing:

```yaml
- name: validate_input
  kind: function.lua
  source: file://validation.lua
  method: validate
  meta:
    temporal:
      activity:
        worker: app:worker
        local: true
```

## Calling Activities from Workflows

Use `funcs.call()` - the interception system routes calls through Temporal:

```lua
local funcs = require("funcs")

local function main(input)
    -- This call goes through Temporal when in workflow context
    local result, err = funcs.call("app:charge_payment", {
        amount = input.amount
    })

    if err then
        return nil, err
    end

    return result
end
```

## Versioning

Use `workflow.version()` when changing workflow logic:

```lua
local workflow = require("workflow")

local function main(input)
    local v = workflow.version("payment-v2", 1, 2)

    if v == 1 then
        -- Old payment logic
        return old_payment(input)
    else
        -- New payment logic
        return new_payment(input)
    end
end
```

## Error Handling

Activities return errors that workflows can handle:

```lua
local function main(input)
    local result, err = funcs.call("app:risky_activity", input)

    if err then
        -- Check if retryable
        if err:retryable() then
            return nil, err  -- Let Temporal retry
        end
        -- Non-retryable, handle gracefully
        funcs.call("app:notify_failure", { error = err:message() })
        return { status = "failed", error = err:message() }
    end

    return result
end
```

## See Also

- [Entry Kinds](guide-entry-kinds.md) - temporal.client and temporal.worker config
- [Functions](concept-functions.md) - Function execution model
