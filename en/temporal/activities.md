---
title: "Activities"
description: "Activities are functions that execute non-deterministic operations. Any function.lua or process.lua entry can be registered as a Temporal activity by…"
---

# Activities

Activities are functions that execute non-deterministic operations. Any `function.lua` or `process.lua` entry can be registered as a Temporal activity by adding metadata.

## Registering Activities

Add `meta.temporal.activity` to register a function as an activity:

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

### Metadata Fields

| Field | Required | Description |
|-------|----------|-------------|
| `worker` | Yes | Reference to `temporal.worker` entry |
| `local` | No | Execute as local activity (default: false) |
| `name` | No | Custom activity type name (defaults to entry ID) |

## Implementation

Activities are regular Lua functions:

```lua
-- payment.lua
local http = require("http_client")
local json = require("json")

local function charge(input)
    local response, err = http.post("https://api.stripe.com/v1/charges", {
        headers = {
            ["Authorization"] = "Bearer " .. input.api_key,
            ["Content-Type"] = "application/json"
        },
        body = json.encode({
            amount = input.amount,
            currency = input.currency,
            source = input.token
        })
    })

    if err then
        return nil, err
    end

    return json.decode(response:body())
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
    token = "tok_visa",
    api_key = ctx.stripe_key
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
local b, err = reliable:call("app:step_two", a)
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
| `activity.name` | string | - | Activity type name to call, when it differs from the registry ID |
| `activity.summary` | string | - | Human-readable summary shown in the Temporal UI |
| `activity.priority` | table | - | Task priority: `priority_key` (number), `fairness_key` (string), `fairness_weight` (number) |
| `activity.versioning_intent` | string | - | `compatible` (inherit the build ID) or `default` (use assignment rules) |

Duration values accept strings (`"5s"`, `"10m"`, `"1h"`) or milliseconds as numbers.

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
local pid = spawner:spawn("app:order_workflow", "app:worker", order)
```

```lua
-- Activity reads context
local ctx = require("ctx")

local function process_order(input)
    local user_id = ctx.get("user_id")   -- "user-1"
    local tenant = ctx.get("tenant")     -- "tenant-1"
    -- use context for authorization, logging, etc.
end
```

Activities called from a workflow with `funcs.new():with_context()` also propagate context:

```lua
-- Inside workflow
local executor = funcs.new():with_context({trace_id = "abc-123"})
local result, err = executor:call("app:charge_payment", input)
```

### Security Context

An activity scheduled under a security context receives the signed `wippy-security` header, audienced to the activity ID. The worker verifies the signature and audience, then merges the propagated `ctx` values and the security payload onto a fresh frame before the activity function runs.

That merge is all-or-nothing and **fatal to the activity if it fails**: the activity returns an error before its code executes, so it never runs with partial context or with an unverified actor. A merge fails when the signature or audience does not verify, when the envelope is inconsistent (an actor without a scope, or policies without an actor), or when a policy named in the envelope does not resolve in the local security registry — which is the common operational cause: the worker's deployment is missing a policy entry the caller had.

The worker takes its signing and verification keys from the `temporal.client` entry it references. See [Security context propagation](temporal/overview.md#security-context-propagation).

## Error Handling

Return errors via the standard Lua pattern:

```lua
local errors = require("errors")

local function charge(input)
    if not input.amount or input.amount <= 0 then
        return nil, errors.new({ kind = errors.INVALID, message = "amount must be positive" })
    end

    local response, err = http.post(url, options)
    if err then
        return nil, errors.wrap(err, "payment API failed")
    end

    if response:status() >= 400 then
        return nil, errors.new({ kind = errors.INVALID, message = "payment declined" })
    end

    return json.decode(response:body())
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
| Security verification | `Internal` | true | Signature, audience, or envelope check failed on the propagated security header |
| Security policy missing | `Internal` | true | A policy named in the security envelope does not resolve on this worker |

Both security failures happen during context merge, before the activity function runs. They are not marked non-retryable, so the activity retry policy keeps re-attempting them; retries do not help, because neither a bad signature nor a missing policy entry changes between attempts. Cap `maximum_attempts` on activities you want to fail fast, and read a repeating `Internal` failure with no activity log output as a context-merge failure rather than a fault in the activity.

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

- [Overview](temporal/overview.md) - Configuration
- [Workflows](temporal/workflows.md) - Workflow implementation
- [Functions](lua/core/funcs.md) - Function module
- [Error Handling](lua/core/errors.md) - Error types and patterns
