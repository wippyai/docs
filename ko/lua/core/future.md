# Future
<secondary-label ref="function"/>
<secondary-label ref="process"/>

비동기 작업 결과. Future는 `funcs.async()` 및 계약 비동기 호출에서 반환됩니다.

## 로딩

로드 가능한 모듈이 아닙니다. Future는 비동기 작업에서 생성됩니다:

```lua
local funcs = require("funcs")
local future, err = funcs.async("app.compute:task", data)
```

## 응답 채널

결과를 받기 위한 채널 가져오기:

```lua
local ch = future:response()
local payload, ok = ch:receive()
if ok then
    local result = payload:data()
end
```

`channel()`은 `response()`의 별칭입니다.

## 완료 확인

future가 완료되었는지 논블로킹 확인:

```lua
if future:is_complete() then
    local result, err = future:result()
end
```

## 취소 확인

`cancel()`이 호출되었는지 확인:

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

## 취소

비동기 작업 취소 (최선의 노력):

```lua
future:cancel()
```

이미 진행 중이면 작업이 여전히 완료될 수 있습니다.

## 타임아웃 패턴

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

## 먼저 완료되는 것

```lua
local f1 = funcs.async("app.cache:get", key)
local f2 = funcs.async("app.db:get", key)

local r = channel.select {
    f1:channel():case_receive(),
    f2:channel():case_receive()
}

-- 느린 것 취소
if r.channel == f1:channel() then
    f2:cancel()
else
    f1:cancel()
end

return r.value:data()
```

## 에러

| 조건 | 종류 |
|------|------|
| 작업 취소됨 | `CANCELED` |
| 비동기 작업 실패 | 다양함 |
