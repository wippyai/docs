---
title: "Future"
description: "asynchronous function 및 contract call의 result를 receive, inspect 및 cancel합니다."
---

# Future
<secondary-label ref="function"/>
<secondary-label ref="process"/>

Future는 asynchronous operation result를 나타냅니다. `funcs.async()`와 asynchronous contract call이 반환합니다. 이 페이지는 API reference이며 pattern의 target ID와 argument는 application-defined입니다.

## 로딩

로드 가능한 모듈이 아닙니다. Future는 비동기 작업에서 생성됩니다:

```lua
local funcs = require("funcs")
local future, err = funcs.async("app.compute:task", data)
if err then
    return nil, err
end
```

## 응답 채널

response channel로 completion을 기다린 다음 future에서 cached result를 읽습니다.

```lua
local ch = future:response()
local _, open = ch:receive()
if not open then
    return nil, errors.new("future response channel closed")
end

local payload, err = future:result()
if err then
    return nil, err
end
local result, data_err = payload:data()
if data_err then return nil, data_err end
```

`channel()`은 `response()`의 별칭입니다.

channel value는 operation payload, payload table 또는 error입니다. channel이 ready된 뒤 `result()`를 호출하면 consistent success/error interface를 제공하며 channel이 drain된 뒤에도 cached value를 반환합니다.

## 완료 확인

future가 완료되었는지 논블로킹 확인:

```lua
if future:is_complete() then
    local result, err = future:result()
end
```

## 취소 확인

future가 provider에 의해 canceled로 표시되었는지 확인합니다.

```lua
if future:is_canceled() then
    print("Operation was canceled")
end
```

## 결과 가져오기

캐시된 결과 가져오기 (논블로킹):

```lua
local val, err = future:result()
```

**반환:**
- 완료되지 않음: `nil, nil`
- 취소됨: `nil, error` (종류 `CANCELED`)
- 에러: `nil, error`
- 성공: `Payload, nil` 또는 `table, nil` (다중 페이로드)

## 에러 가져오기

future가 실패했으면 에러 가져오기:

```lua
local err, has_error = future:error()
if has_error then
    print("Failed:", err:message())
end
```

**반환:** `error, boolean`

operation이 실패하면 `error()`는 non-retryable `INTERNAL` wrapper를 반환합니다. called function의 original error kind와 retryability를 보존해야 하면 `result()`를 사용하십시오.

## 취소

asynchronous operation의 cancellation을 best-effort로 요청합니다.

```lua
local canceled, err = future:cancel()
```

이미 진행 중이면 작업이 여전히 완료될 수 있습니다.

**반환:** `boolean, error`

<warning>
runtime v0.3.32a에서 function과 contract future는 process-global cancellation callback 하나를 공유합니다. 두 provider가 모두 load되면 <code>cancel()</code>과 <code>is_canceled()</code>는 stable cross-provider contract가 아닙니다. application correctness에 cancellation을 사용하지 마십시오. runtime이 provider cancellation을 분리할 때까지 local timeout을 사용하고 late result를 무시하십시오.
</warning>

## 타임아웃 패턴

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
    -- The operation may still complete; this caller ignores the late result.
    return nil, errors.new({
        message = "Operation timed out",
        kind = errors.TIMEOUT
    })
end

local payload, result_err = future:result()
if result_err then
    return nil, result_err
end
local value, data_err = payload:data()
if data_err then return nil, data_err end
return value
```

## 먼저 완료되는 것

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

-- The slower operation may still complete; this caller ignores its result.
local winner
if r.channel == ch1 then
    winner = f1
else
    winner = f2
end

local payload, result_err = winner:result()
if result_err then
    return nil, result_err
end
local value, data_err = payload:data()
if data_err then return nil, data_err end
return value
```

## 에러

| 조건 | 종류 | 재시도 가능 |
|------|------|-------------|
| `result()`를 통한 operation cancel | `errors.CANCELED` | 아니오 |
| `result()`가 반환한 operation failure | varies | function error에서 보존 |
| `error()`가 반환한 operation failure | `errors.INTERNAL` | 아니오 |
| cancellation dispatch failure | `errors.INTERNAL` | 아니오 |
