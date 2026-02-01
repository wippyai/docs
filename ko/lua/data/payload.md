# 페이로드 인코딩
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

JSON, MessagePack, 바이너리를 포함한 형식 간 데이터 변환. 서비스 간 통신 및 워크플로우 데이터 전달을 위한 타입화된 페이로드 처리.

## 로딩

전역 네임스페이스. require 불필요.

```lua
payload.new(...)  -- 직접 접근
```

## 형식 상수

페이로드 타입용 형식 식별자:

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

## 페이로드 생성

Lua 값에서 새 페이로드 생성:

```lua
-- 테이블에서
local p = payload.new({
    user_id = 123,
    name = "Alice",
    roles = {"admin", "user"}
})

-- 문자열에서
local str_p = payload.new("Hello, World!")

-- 숫자에서
local num_p = payload.new(42.5)

-- 불리언에서
local bool_p = payload.new(true)

-- nil에서
local nil_p = payload.new(nil)

-- 에러에서
local err_p = payload.new(errors.new("something failed"))
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `value` | any | Lua 값 (string, number, boolean, table, nil 또는 error) |

**반환:** `Payload, nil`

## 형식 가져오기

페이로드 형식 가져오기:

```lua
local p = payload.new({name = "test"})
local format = p:get_format()  -- "lua/any"

local str_p = payload.new("hello")
local format2 = str_p:get_format()  -- "lua/any"

local err_p = payload.new(errors.new("failed"))
local format3 = err_p:get_format()  -- "golang/error"
```

**반환:** `string, nil` - `payload.format.*` 상수 중 하나

## 데이터 추출

페이로드에서 Lua 값 추출 (필요시 트랜스코드):

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

**반환:** `any, error`

## 페이로드 트랜스코딩

페이로드를 다른 형식으로 트랜스코드:

```lua
local p = payload.new({
    name = "test",
    value = 123
})

-- JSON으로 변환
local json_p, err = p:transcode(payload.format.JSON)
if err then
    return nil, err
end
print(json_p:get_format())  -- "json/plain"

-- MessagePack으로 변환 (컴팩트 바이너리)
local msgpack_p, err = p:transcode(payload.format.MSGPACK)
if err then
    return nil, err
end

-- YAML로 변환
local yaml_p, err = p:transcode(payload.format.YAML)
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `format` | string | `payload.format.*`의 대상 형식 |

**반환:** `Payload, error`

## 비동기 결과

페이로드는 일반적으로 비동기 함수 호출에서 수신됩니다:

```lua
local funcs = require("funcs")

local future, err = funcs.async("app.process:compute", input_data)
if err then
    return nil, err
end

-- 결과 대기
local ch = future:response()
local result_payload, ok = ch:receive()
if not ok then
    return nil, errors.new("channel closed")
end

-- 페이로드에서 데이터 추출
local result, err = result_payload:data()
if err then
    return nil, err
end

print(result.computed_value)
```

## 에러

| 조건 | 종류 | 재시도 가능 |
|------|------|-------------|
| 트랜스코딩 실패 | `errors.INTERNAL` | 아니오 |
| 결과가 유효한 Lua 값이 아님 | `errors.INTERNAL` | 아니오 |

에러 처리는 [에러 처리](lua-errors.md)를 참조하세요.
