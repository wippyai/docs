---
title: "Futures"
description: "Receive, inspect, and cancel results from asynchronous function and contract calls."
---

# Futures
<secondary-label ref="function"/>
<secondary-label ref="process"/>

Futures represent asynchronous operation results. They are returned by `funcs.async()` and asynchronous contract calls.

## Loading

Futures are not loaded as a module; asynchronous operations create them:

```lua
local funcs = require("funcs")
local future, err = funcs.async("app.compute:task", data)
```

## Response Channel

Use the response channel to receive the result:

```lua
local ch = future:response()
local payload, ok = ch:receive()
if ok then
    local result = payload:data()
end
```

`channel()` is an alias for `response()`.

## Completion Check

Check whether the future has completed without blocking:

```lua
if future:is_complete() then
    local result, err = future:result()
end
```

## Cancellation Check

Check whether `cancel()` was called:

```lua
if future:is_canceled() then
    print("Operation was canceled")
end
```

## Getting Result

Read the cached result without blocking:

```lua
local val, err = future:result()
```

**Returns:**

- Not complete: `nil, nil`
- Canceled: `nil, error` (kind `CANCELED`)
- Error: `nil, error`
- Success: `Payload, nil` or `table, nil` (multiple payloads)

## Getting Error

Read the error when the future has failed:

```lua
local err, has_error = future:error()
if has_error then
    print("Failed:", err:message())
end
```

**Returns:** `error, boolean`

## Canceling

Request cancellation of the asynchronous operation on a best-effort basis:

```lua
future:cancel()
```

The operation may still complete if it is already in progress.

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
    return nil, errors.new({
        message = "Operation timed out",
        kind = errors.TIMEOUT
    })
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
