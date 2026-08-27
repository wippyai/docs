---
title: "페이로드 인코딩"
description: "타입이 지정된 페이로드를 만들고 형식을 검사하며 값을 추출하고 지원되는 표현 사이에서 트랜스코딩합니다."
---

# 페이로드 인코딩
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

페이로드는 함수, 프로세스, 서비스, 워크플로 사이에서 타입이 지정된 값을 운반합니다. 형식을 검사하고 값을 추출하거나 지원되는 형식 사이에서 트랜스코딩할 수 있습니다.

이 페이지는 부분 전송 레시피를 포함한 API 참조입니다. `p`, `input_data`, 비동기 대상 엔트리 같은 값은 주변 애플리케이션에서 제공됩니다.

## 로드

`payload`는 전역 네임스페이스이므로 `require()`가 필요하지 않습니다.

```lua
payload.new(...)  -- direct access
```

## 형식 상수

다음 상수는 페이로드 형식을 식별합니다:

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

## 페이로드 만들기

Lua 값으로 페이로드를 만듭니다:

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

| 매개변수 | 타입 | 설명 |
|-----------|------|-------------|
| `value` | any | Lua 값(string, number, boolean, table, nil 또는 error) |

**반환:** `Payload`

## 형식 가져오기

페이로드의 형식 식별자를 읽습니다:

```lua
local p = payload.new({name = "test"})
local format = p:get_format()  -- "lua/any"

local str_p = payload.new("hello")
local format2 = str_p:get_format()  -- "lua/any"

local err_p = payload.new(errors.new("failed"))
local format3 = err_p:get_format()  -- "golang/error"
```

**반환:** `string` — `payload.format.*` 상수 중 하나

## 데이터 추출

필요한 경우 트랜스코딩하면서 페이로드의 Lua 값을 추출합니다:

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

페이로드를 다른 지원 형식으로 트랜스코딩합니다:

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
local yaml_p, yaml_err = p:transcode(payload.format.YAML)
if yaml_err then
    return nil, yaml_err
end
```

| 매개변수 | 타입 | 설명 |
|-----------|------|-------------|
| `format` | string | `payload.format.*`의 대상 형식 |

**반환:** `Payload, error`

## 언마샬링

원본 형식과 관계없이 페이로드를 Lua 값으로 디코딩합니다:

```lua
local data, err = p:unmarshal()
if err then
    return nil, err
end
```

`data()`와 `unmarshal()`은 기존 Lua 값을 반환하거나 Lua가 아닌 페이로드를 Lua 형식으로 트랜스코딩합니다. 트랜스코더가 잘못된 결과를 만들면 후자가 더 엄격하게 동작합니다. `unmarshal()`은 `errors.INTERNAL` 오류를 반환하지만 `data()`는 `nil`을 반환합니다.

**반환:** `any, error`

## 비동기 결과

비동기 함수 호출은 페이로드 안에 반환 값을 제공합니다:

이 예시는 `app.process:compute`가 정확히 하나의 값을 반환한다고 가정합니다. 결과가 없으면 `future:result()`는 `nil`을 반환하고, 결과가 여러 개이면 하나의 `Payload`가 아니라 Lua 테이블을 반환하므로 호출자가 이 형태들을 별도로 처리해야 합니다.

```lua
local funcs = require("funcs")

local future, err = funcs.async("app.process:compute", input_data)
if err then
    return nil, err
end

-- Wait for result
local ch = future:response()
local _, ok = ch:receive()
if not ok then
    return nil, errors.new("channel closed")
end

local result_payload, result_err = future:result()
if result_err then
    return nil, result_err
end
if result_payload == nil then
    return nil, errors.new("compute returned no result")
end

-- Extract data from payload
local result, err = result_payload:data()
if err then
    return nil, err
end

print(result.computed_value)
```

## 오류

| 조건 | 종류 | 재시도 가능 |
|-----------|------|-----------|
| 트랜스코딩 실패 | `errors.INTERNAL` | 아니요 |
| 결과가 유효한 Lua 값이 아님 | `errors.INTERNAL` | 아니요 |

오류 작업 방법은 [오류 처리](../core/errors.md)를 참고하세요.
