# Payload Encoding
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

Convert data between formats including JSON, MessagePack, and binary. Handle typed payloads for inter-service communication and workflow data passing.

## Loading

Global namespace. No require needed.

```lua
payload.new(...)  -- direct access
```

## Format Constants

Format identifiers for payload types:

```lua
payload.format.JSON     -- "json/plain"
payload.format.YAML     -- "yaml/plain"
payload.format.STRING   -- "text/plain"
payload.format.BYTES    -- "application/octet-stream"
payload.format.MSGPACK  -- "application/msgpack"
payload.format.LUA      -- "lua/any"
payload.format.GOLANG   -- "golang/any"
payload.format.ERROR    -- "golang/error"
```

## Creating Payloads

Create a new payload from a Lua value:

```lua
-- From table
local p = payload.new({
    user_id = 123,
    name = "Alice",
    roles = {"admin", "user"}
})

-- From string
local str_p = payload.new("Hello, World!")

-- From number
local num_p = payload.new(42.5)

-- From boolean
local bool_p = payload.new(true)

-- From nil
local nil_p = payload.new(nil)

-- From error
local err_p = payload.new(errors.new("something failed"))
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `value` | any | Lua value (string, number, boolean, table, nil, or error) |

**Returns:** `Payload, nil`

## Getting Format

Get the payload format:

```lua
local p = payload.new({name = "test"})
local format = p:get_format()  -- "lua/any"

local str_p = payload.new("hello")
local format2 = str_p:get_format()  -- "lua/any"

local err_p = payload.new(errors.new("failed"))
local format3 = err_p:get_format()  -- "golang/error"
```

**Returns:** `string, nil` - one of `payload.format.*` constants

## Extracting Data

Extract the Lua value from the payload (transcodes if needed):

```lua
local p = payload.new({
    items = {1, 2, 3},
    total = 100
})

local data, err = p:data()
if err then
    return nil, err
end

print(data.total)        -- 100
print(data.items[1])     -- 1
```

**Returns:** `any, error`

## Transcoding Payloads

Transcode payload to a different format:

```lua
local p = payload.new({
    name = "test",
    value = 123
})

-- Convert to JSON
local json_p, err = p:transcode(payload.format.JSON)
if err then
    return nil, err
end
print(json_p:get_format())  -- "json/plain"

-- Convert to MessagePack (compact binary)
local msgpack_p, err = p:transcode(payload.format.MSGPACK)
if err then
    return nil, err
end

-- Convert to YAML
local yaml_p, err = p:transcode(payload.format.YAML)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `format` | string | Target format from `payload.format.*` |

**Returns:** `Payload, error`

## Async Results

Payloads are commonly received from async function calls:

```lua
local funcs = require("funcs")

local future, err = funcs.async("app.process:compute", input_data)
if err then
    return nil, err
end

-- Wait for result
local ch = future:response()
local result_payload, ok = ch:receive()
if not ok then
    return nil, errors.new("channel closed")
end

-- Extract data from payload
local result, err = result_payload:data()
if err then
    return nil, err
end

print(result.computed_value)
```

## Errors

| Condition | Kind | Retryable |
|-----------|------|-----------|
| Transcoding failure | `errors.INTERNAL` | no |
| Result not valid Lua value | `errors.INTERNAL` | no |

See [Error Handling](lua/core/errors.md) for working with errors.

