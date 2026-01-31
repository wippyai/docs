# Activities

Activities are functions that execute non-deterministic operations (I/O, network calls, database access). They're defined as regular `function.lua` entries with Temporal metadata.

## Definition

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

The `meta.temporal.activity.worker` field registers this function as an activity on the specified worker.

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

print(result.id)
```

## Activity Options

Configure timeouts and retry behavior:

```lua
local funcs = require("funcs")

local executor = funcs.new()
executor = executor:with_options({
    start_to_close_timeout = "30s",
    schedule_to_close_timeout = "5m",
    heartbeat_timeout = "10s",
    retry_policy = {
        max_attempts = 3,
        initial_interval = "1s",
        backoff_coefficient = 2.0,
        max_interval = "1m"
    }
})

local result, err = executor:call("app:charge_payment", input)
```

### Timeout Options

| Option | Description |
|--------|-------------|
| `start_to_close_timeout` | Max time from activity start to completion |
| `schedule_to_close_timeout` | Max time from scheduling to completion |
| `heartbeat_timeout` | Max time between heartbeats |

### Retry Policy

| Option | Default | Description |
|--------|---------|-------------|
| `max_attempts` | 3 | Maximum retry attempts |
| `initial_interval` | 1s | Initial retry delay |
| `backoff_coefficient` | 2.0 | Multiplier for subsequent delays |
| `max_interval` | 1m | Maximum retry delay |

## Local Activities

For fast, in-process execution without separate task queue overhead:

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

Local activities:
- Execute in the workflow worker process
- No separate task queue polling
- Lower latency for quick operations
- Limited to short execution times

## Task Queue Routing

Route activities to specific queues:

```yaml
# Worker for payment processing
- name: payment_worker
  kind: temporal.worker
  client: app:temporal_client
  task_queue: "payment-queue"

# Activity registered on payment queue
- name: process_payment
  kind: function.lua
  source: file://payment.lua
  method: process
  meta:
    temporal:
      activity:
        worker: app:payment_worker
```

Override at call time:

```lua
executor = executor:with_options({
    task_queue = "priority-queue"
})

local result = executor:call("app:process_payment", input)
```

## Error Handling

Activities return errors via the standard Lua pattern:

```lua
local function charge(input)
    if not input.amount or input.amount <= 0 then
        return nil, errors.new("INVALID", "amount must be positive")
    end

    local response, err = http.post(url, options)
    if err then
        return nil, errors.wrap(err, "payment API failed")
    end

    if response:status() >= 400 then
        return nil, errors.new("FAILED", "payment declined: " .. response:body())
    end

    return json.decode(response:body())
end
```

Errors propagate to the workflow:

```lua
local result, err = funcs.call("app:charge_payment", input)
if err then
    if err:kind() == errors.INVALID then
        -- Bad input, don't retry
        return {status = "rejected", reason = tostring(err)}
    end
    -- Other errors will be retried per retry policy
    return nil, err
end
```

## Heartbeats

For long-running activities, send heartbeats to indicate progress:

```lua
local activity = require("activity")

local function process_large_file(input)
    local file = fs.open(input.path)
    local processed = 0

    for chunk in file:chunks(1024 * 1024) do
        process_chunk(chunk)
        processed = processed + 1

        -- Report progress
        activity.heartbeat({
            chunks_processed = processed,
            percent = (processed / input.total_chunks) * 100
        })
    end

    return {processed = processed}
end
```

## See Also

- [Overview](temporal/overview.md) - Configuration
- [Workflows](temporal/workflows.md) - Workflow implementation
- [Functions](lua/core/funcs.md) - Function module reference
