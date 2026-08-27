---
title: "Activities"
description: "Register function.lua or process.lua entries as Temporal activities for non-deterministic operations."
---

# Activities

Temporal activities execute non-deterministic operations. Register a `function.lua` or `process.lua` entry as an activity through its metadata.

The snippets are API recipes. The payment example is illustrative and requires an application-owned environment entry, `env.get` permission for the credential, `http_client.request` permission for the provider URL, and a payment-provider contract.

## Registering Activities

Add `meta.temporal.activity` to register a function as an activity:

```yaml
- name: charge_payment
  kind: function.lua
  source: file://payment.lua
  method: charge
  modules:
    - env
    - errors
    - http_client
    - json
  meta:
    temporal:
      activity:
        worker: app:worker
```

### Metadata Fields

| Field | Required | Description |
|-------|----------|-------------|
| `worker` | Yes | Reference to `temporal.worker` entry |
| `local` | No | Execute as local activity (default: false) |

## Implementation

Activities are regular Lua functions. Keep credentials out of workflow inputs because Temporal persists those inputs in workflow history. This example reads the payment key from the environment registry inside the activity. Its placeholder provider accepts a JSON charge request and returns a JSON response. The status mapping is an application-owned policy: replace the URL, request fields, response fields, and failure mapping with your provider's contract.

```lua
-- payment.lua
local http = require("http_client")
local json = require("json")
local env = require("env")
local errors = require("errors")

local function payment_error(status)
    if status == 408 then
        return errors.new({kind = errors.TIMEOUT, message = "payment provider timed out", retryable = true})
    elseif status == 429 then
        return errors.new({kind = errors.RATE_LIMITED, message = "payment provider rate limited the request", retryable = true})
    elseif status >= 500 then
        return errors.new({kind = errors.UNAVAILABLE, message = "payment provider is unavailable", retryable = true})
    end
    return errors.new({kind = errors.INVALID, message = "payment request was rejected", retryable = false})
end

local function charge(input)
    local api_key, env_err = env.get("PAYMENTS_API_KEY")
    if env_err then return nil, env_err end

    local body, encode_err = json.encode({
        amount = input.amount,
        currency = input.currency,
        payment_token = input.payment_token
    })
    if encode_err then
        return nil, encode_err
    end

    local response, err = http.post("https://payments.example.com/v1/charges", {
        headers = {
            ["Authorization"] = "Bearer " .. api_key,
            ["Content-Type"] = "application/json"
        },
        body = body
    })

    if err then
        return nil, err
    end

    if response.status_code >= 400 then
        return nil, payment_error(response.status_code)
    end

    return json.decode(response.body)
end

return { charge = charge }
```

## Calling Activities

From workflows, use the `funcs` module:

```lua
local funcs = require("funcs")

local result, err = funcs.call("app:charge_payment", {
    amount = 5000,
    currency = "usd",
    payment_token = "payment-token-123"
})

if err then
    return nil, err
end
```

## Activity Options

Configure timeouts, retry behavior, and other execution parameters using the executor builder:

```lua
local funcs = require("funcs")

local executor = funcs.new():with_options({
    ["activity.start_to_close_timeout"] = "30s",
    ["activity.schedule_to_close_timeout"] = "5m",
    ["activity.heartbeat_timeout"] = "10s",
    ["activity.retry_policy"] = {
        maximum_attempts = 3,
        initial_interval = 1000,
        backoff_coefficient = 2.0,
        maximum_interval = 60000,
    }
})

local result, err = executor:call("app:charge_payment", input)
```

The executor is immutable and reusable. Build it once and use it for multiple calls:

```lua
local reliable = funcs.new():with_options({
    ["activity.start_to_close_timeout"] = "60s",
    ["activity.retry_policy"] = {
        maximum_attempts = 5,
        initial_interval = 2000,
        backoff_coefficient = 2.0,
        maximum_interval = 120000,
    }
})

local a, err = reliable:call("app:step_one", input)
if err then
    return nil, err
end
local b, err = reliable:call("app:step_two", a)
if err then
    return nil, err
end
```

### Options Reference

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `activity.start_to_close_timeout` | duration | 10m | Max time for activity execution |
| `activity.schedule_to_close_timeout` | duration | - | Max time from scheduling to completion |
| `activity.schedule_to_start_timeout` | duration | - | Max time before activity starts |
| `activity.heartbeat_timeout` | duration | - | Max time between heartbeats |
| `activity.id` | string | - | Custom activity execution ID |
| `activity.task_queue` | string | - | Override task queue for this call |
| `activity.wait_for_cancellation` | boolean | false | Wait for activity cancellation |
| `activity.disable_eager_execution` | boolean | false | Disable eager execution |
| `activity.retry_policy` | table | - | Retry configuration (see below) |
| `activity.versioning_intent` | string or number | - | Worker versioning intent for the activity |
| `activity.summary` | string | - | Summary shown in Temporal activity metadata |
| `activity.priority` | table | - | Priority key and optional fairness settings |
| `activity.name` | string | - | Activity type override |

Duration values accept strings (`"5s"`, `"10m"`, `"1h"`) or milliseconds as numbers.

Use the canonical `activity.*` names for new code. Legacy `temporal.activity.*` aliases remain accepted for compatibility.

```lua
local executor = funcs.new():with_options({
    ["activity.summary"] = "Charge the order payment",
    ["activity.priority"] = {
        priority_key = 10,
        fairness_key = "customer-123",
        fairness_weight = 1.0,
    },
    ["activity.name"] = "charge-payment",
    ["activity.versioning_intent"] = "use_assignment_rules",
})
```

### Retry Policy

Configure automatic retry behavior for failed activities:

```lua
["activity.retry_policy"] = {
    initial_interval = 1000,         -- ms before first retry
    backoff_coefficient = 2.0,       -- multiplier for each retry
    maximum_interval = 300000,       -- max interval between retries (ms)
    maximum_attempts = 10,           -- max retry attempts (0 = unlimited)
    non_retryable_error_types = {    -- errors that skip retries
        "Invalid",
        "PermissionDenied"
    }
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `initial_interval` | number | 1000 | Milliseconds before first retry |
| `backoff_coefficient` | number | 2.0 | Multiplier applied to interval each retry |
| `maximum_interval` | number | - | Cap on retry interval (ms) |
| `maximum_attempts` | number | 0 | Max attempts (0 = unlimited) |
| `non_retryable_error_types` | array | - | Error kinds that bypass retries |

### Timeout Relationships

```
|--- schedule_to_close_timeout --------------------------------|
|--- schedule_to_start_timeout ---|--- start_to_close_timeout -|
     (waiting in queue)                (executing)
```

- `start_to_close_timeout`: How long the activity itself can run. This is the most commonly used timeout.
- `schedule_to_close_timeout`: Total time from when the activity is scheduled until it completes, including queue wait time and retries.
- `schedule_to_start_timeout`: Max time the activity can wait in the task queue before a worker picks it up.
- `heartbeat_timeout`: For long-running activities, the max time between heartbeat reports.

## Local Activities

The `local` field is accepted on an activity:

```yaml
- name: validate_input
  kind: function.lua
  source: file://validate.lua
  method: validate
  modules:
    - json
  meta:
    temporal:
      activity:
        worker: app:worker
        local: true
```

Currently `local: true` is parsed but behaves identically to a regular activity: it is registered and executed through the standard activity path. There is no distinct local-activity execution yet, so it does not change latency, task queue behavior, or heartbeating.

## Activity Naming

Activities are registered with their full entry ID as the name:

```yaml
namespace: app
entries:
  - name: charge_payment
    kind: function.lua
    # ...
```

Activity name: `app:charge_payment`

## Context Propagation

Context values set when spawning the workflow are available inside activities:

```lua
-- Spawner sets context
local spawner = process.with_context({
    user_id = "user-1",
    tenant = "tenant-1",
})
local pid, err = spawner:spawn("app:order_workflow", "app:worker", order)
if err then
    return nil, err
end
```

```lua
-- Activity reads context
local ctx = require("ctx")

local function process_order(input)
    local user_id, user_err = ctx.get("user_id")   -- "user-1"
    if user_err then return nil, user_err end
    local tenant, tenant_err = ctx.get("tenant")   -- "tenant-1"
    if tenant_err then return nil, tenant_err end
    -- use context for authorization, logging, etc.
end
```

Activities called from a workflow with `funcs.new():with_context()` also propagate context:

```lua
-- Inside workflow
local executor = funcs.new():with_context({trace_id = "abc-123"})
local result, err = executor:call("app:charge_payment", input)
```

## Error Handling

Return errors via the standard Lua pattern:

```lua
local errors = require("errors")

-- Replace this mapping with the payment provider's documented error contract.
local function payment_error(status)
    if status == 408 then
        return errors.new({kind = errors.TIMEOUT, message = "payment provider timed out", retryable = true})
    elseif status == 429 then
        return errors.new({kind = errors.RATE_LIMITED, message = "payment provider rate limited the request", retryable = true})
    elseif status >= 500 then
        return errors.new({kind = errors.UNAVAILABLE, message = "payment provider is unavailable", retryable = true})
    end
    return errors.new({kind = errors.INVALID, message = "payment request was rejected", retryable = false})
end

local function charge(input)
    if not input.amount or input.amount <= 0 then
        return nil, errors.new({ kind = errors.INVALID, message = "amount must be positive" })
    end

    local response, err = http.post(url, options)
    if err then
        return nil, errors.wrap(err, "payment API failed")
    end

    if response.status_code >= 400 then
        return nil, payment_error(response.status_code)
    end

    return json.decode(response.body)
end
```

### Error Objects

Activity errors propagated to workflows carry structured metadata:

```lua
local result, err = funcs.call("app:charge_payment", input)
if err then
    err:kind()       -- error classification string
    err:retryable()  -- boolean, whether retry makes sense
    err:message()    -- human-readable error message
end
```

### Failure Modes

| Failure | Error Kind | Retryable | Description |
|---------|------------|-----------|-------------|
| Application error | Whatever the activity returned | Inherited from the returned error | Error returned by activity code via `return nil, err` |
| Runtime crash | `Internal` | false | Unhandled Lua error in activity |
| Missing activity | `NotFound` | false | Activity not registered with worker |
| Timeout | `Timeout` | false | Activity exceeded configured timeout |

```lua
local executor = funcs.new():with_options({
    ["activity.retry_policy"] = {maximum_attempts = 1}
})

local result, err = executor:call("app:missing_activity", input)
if err then
    print(err:kind())      -- "NotFound"
    print(err:retryable())  -- false
end
```

## Process Activities

`process.lua` entries can also be registered as activities for long-running operations:

```yaml
- name: long_task
  kind: process.lua
  source: file://long_task.lua
  method: main
  modules:
    - http_client
  meta:
    temporal:
      activity:
        worker: app:worker
```

## See Also

- [Overview](./overview.md) - Configuration
- [Workflows](./workflows.md) - Workflow implementation
- [Functions](../lua/core/funcs.md) - Function module
- [Error Handling](../lua/core/errors.md) - Error types and patterns
