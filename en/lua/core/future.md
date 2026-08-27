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

Use the response channel to wait for completion, then read the cached result from the future:

```lua
local ch = future:response()
ch:receive()

local payload, err = future:result()
if err then
    return nil, err
end
local result = payload:data()
```

`channel()` is an alias for `response()`.

The channel value is the operation's payload, payload table, or error. Calling `result()` after the channel becomes ready provides one consistent success/error interface and returns the cached value even after the channel is drained.

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

When an operation fails, `error()` returns a non-retryable `INTERNAL` wrapper. Use `result()` when the called function's original error kind and retryability must be preserved.

## Canceling

Request cancellation of the asynchronous operation on a best-effort basis:

```lua
local canceled, err = future:cancel()
```

The operation may still complete if it is already in progress.

**Returns:** `boolean, error`

## Timeout Pattern

```lua
local time = require("time")

local future, err = funcs.async("app.compute:slow", data)
if err then
    return nil, err
end

local timeout, err = time.after("5s")
if err then
    return nil, err
end

local r = channel.select {
    future:channel():case_receive(),
    timeout:case_receive()
}

if r.channel == timeout then
    local _, cancel_err = future:cancel()
    if cancel_err then
        return nil, cancel_err
    end
    return nil, errors.new({
        message = "Operation timed out",
        kind = errors.TIMEOUT
    })
end

local payload, result_err = future:result()
if result_err then
    return nil, result_err
end
return payload:data()
```

## First-to-Complete

```lua
local f1, err = funcs.async("app.cache:get", key)
if err then
    return nil, err
end
local f2, err = funcs.async("app.db:get", key)
if err then
    return nil, err
end

local ch1 = f1:channel()
local ch2 = f2:channel()

local r = channel.select {
    ch1:case_receive(),
    ch2:case_receive()
}

-- Cancel the slower one
local winner, loser
if r.channel == ch1 then
    winner, loser = f1, f2
else
    winner, loser = f2, f1
end

local _, cancel_err = loser:cancel()
if cancel_err then
    return nil, cancel_err
end

local payload, result_err = winner:result()
if result_err then
    return nil, result_err
end
return payload:data()
```

## Errors

| Condition | Kind | Retryable |
|-----------|------|-----------|
| Operation canceled through `result()` | `errors.CANCELED` | no |
| Operation failure returned by `result()` | varies | preserved from the function error |
| Operation failure returned by `error()` | `errors.INTERNAL` | no |
| Cancellation dispatch failed | `errors.INTERNAL` | no |
