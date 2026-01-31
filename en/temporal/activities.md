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

### Activity Options

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

## Local Activities

Local activities execute in the workflow worker process without separate task queue polling. Use for fast, short operations:

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

Characteristics:
- Execute in workflow worker process
- Lower latency
- No separate task queue overhead
- Limited to short execution times
- No heartbeating

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

## Error Handling

Return errors via the standard Lua pattern:

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
        return nil, errors.new("FAILED", "payment declined")
    end

    return json.decode(response:body())
end
```

## Process Activities

`process.lua` entries can also be registered as activities:

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
