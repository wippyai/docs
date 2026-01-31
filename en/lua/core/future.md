# Futures
<secondary-label ref="function"/>
<secondary-label ref="process"/>

Asynchronous operation results. Futures are returned by `funcs.async()` and contract async calls.

## Loading

Not a loadable module. Futures are created by async operations:

```lua
local funcs = require("funcs")
local future, err = funcs.async("app.compute:task", data)
```

## Response Channel

Get channel for receiving result:

```lua
local ch = future:response()
local payload, ok = ch:receive()
if ok then
    local result = payload:data()
end
```

`channel()` is an alias for `response()`.

## Completion Check

Non-blocking check if future completed:

```lua
if future:is_complete() then
    local result, err = future:result()
end
```

## Cancellation Check

Check if `cancel()` was called:

```lua
if future:is_canceled() then
    print("Operation was canceled")
end
```

## Getting Result

Get cached result (non-blocking):

```lua
local val, err = future:result()
```

**Returns:**
- Not complete: `nil, nil`
- Canceled: `nil, error` (kind `CANCELED`)
- Error: `nil, error`
- Success: `Payload, nil` or `table, nil` (multiple payloads)

## Getting Error

Get error if future failed:

```lua
local err, has_error = future:error()
if has_error then
    print("Failed:", err:message())
end
```

**Returns:** `error, boolean`

## Canceling

Cancel async operation (best-effort):

```lua
future:cancel()
```

Operation may still complete if already in progress.

## Timeout Pattern

```lua
local future = funcs.async("app.compute:slow", data)
local timeout = time.after("5s")

local r = channel.select {
    future:channel():case_receive(),
    timeout:case_receive()
}

if r.channel == timeout then
    future:cancel()
    return nil, errors.new("TIMEOUT", "Operation timed out")
end

return r.value:data()
```

## First-to-Complete

```lua
local f1 = funcs.async("app.cache:get", key)
local f2 = funcs.async("app.db:get", key)

local r = channel.select {
    f1:channel():case_receive(),
    f2:channel():case_receive()
}

-- Cancel the slower one
if r.channel == f1:channel() then
    f2:cancel()
else
    f1:cancel()
end

return r.value:data()
```

## Errors

| Condition | Kind |
|-----------|------|
| Operation canceled | `CANCELED` |
| Async operation failed | varies |
