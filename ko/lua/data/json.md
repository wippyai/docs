---
title: "JSON 인코딩"
description: "Lua 값을 JSON으로 인코딩하고, JSON 문자열을 디코딩하고, 값이나 문자열을 JSON Schema로 검증합니다."
---

# JSON 인코딩
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>
<secondary-label ref="encoding"/>

`json` 모듈은 Lua 값을 JSON으로 인코딩하고, JSON 문자열을 디코딩하고, 데이터를 JSON Schema로 검증합니다.

이 페이지는 API 레퍼런스입니다. 짧은 표현식 예시는 성공 반환값을 보여 주며, 결과를 사용하는 예시는 선택적 두 번째 `error` 반환값을 캡처합니다.

## 로딩

```lua
local json = require("json")
```

require하기 전에 실행 가능 엔트리의 `modules:` 목록에 `json`을 추가하세요.

## 인코딩

### `encode`

Lua 값을 JSON 문자열로 인코딩합니다.

```lua
-- Simple values
json.encode("hello")        -- '"hello"'
json.encode(42)             -- '42'
json.encode(true)           -- 'true'
json.encode(nil)            -- 'null'

-- Arrays (sequential numeric keys)
json.encode({1, 2, 3})      -- '[1,2,3]'
json.encode({"a", "b"})     -- '["a","b"]'

-- Objects (string keys)
local user = {name = "Alice", age = 30}
json.encode(user)           -- JSON object with name="Alice" and age=30; member order is unspecified

-- Nested structures
local order = {
    id = "ord-123",
    items = {
        {sku = "ABC", qty = 2},
        {sku = "XYZ", qty = 1}
    },
    total = 99.50
}
json.encode(order)
-- Structurally equivalent JSON; object-member order is unspecified
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `value` | any | 인코딩할 Lua 값 |

**반환:** `string, error`

인코딩 규칙:
- `nil`은 `null`이 됨
- 빈 테이블은 `[]`가 됨 (문자열 키로 생성된 경우 `{}`)
- 1부터 시작하는 순차적 키를 가진 테이블은 배열이 됨
- 문자열 키를 가진 테이블은 객체가 됨
- 숫자와 문자열 키가 혼합된 경우 에러 발생
- 희소 배열 (인덱스에 갭이 있는 경우) 에러 발생
- Inf/NaN 숫자는 `null`이 됨
- 재귀적 테이블 참조는 에러 발생
- 최대 중첩 깊이는 128 레벨

## 디코딩

### `decode`

JSON 문자열을 Lua 값으로 디코딩합니다.

```lua
-- Parse object
local user, err = json.decode('{"name":"Bob","active":true}')
if err then
    return nil, err
end
print(user.name)    -- "Bob"
print(user.active)  -- true

-- Parse array
local items, items_err = json.decode('[10, 20, 30]')
if items_err then return nil, items_err end
print(items[1])     -- 10
print(#items)       -- 3

-- Parse nested data
local response, response_err = json.decode([[
{
    "status": "ok",
    "data": {
        "users": [
            {"id": 1, "name": "Alice"},
            {"id": 2, "name": "Bob"}
        ]
    }
}
]])
if response_err then return nil, response_err end
print(response.data.users[1].name)  -- "Alice"

-- Handle errors
local data, err = json.decode("not valid json")
if err then
    print(err:kind())     -- "INTERNAL"
    print(err:message())  -- parse error details
end
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `str` | string | 디코딩할 JSON 문자열 |

**반환:** `any, error`

## 스키마 검증

### `validate`

JSON Schema에 대해 Lua 값을 검증합니다. API 계약 적용이나 사용자 입력 검증에 사용합니다.

```lua
-- Define a schema
local user_schema = {
    type = "object",
    properties = {
        name = {type = "string", minLength = 1},
        email = {type = "string", format = "email"},
        age = {type = "integer", minimum = 0, maximum = 150}
    },
    required = {"name", "email"}
}

-- Valid data passes
local valid, err = json.validate(user_schema, {
    name = "Alice",
    email = "alice@example.com",
    age = 30
})
if err then return nil, err end
print(valid)  -- true

-- Invalid data fails with details
local valid, err = json.validate(user_schema, {
    name = "",
    email = "not-an-email"
})
if not valid then
    print(err:message())  -- validation error details
end

-- Schema can also be a JSON string
local schema_json = '{"type":"number","minimum":0}'
local valid, schema_err = json.validate(schema_json, 42)
if schema_err then return nil, schema_err end
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `schema` | table 또는 string | JSON Schema 정의 |
| `data` | any | 검증할 값 |

**반환:** `boolean, error`

스키마는 성능을 위해 콘텐츠 해시로 캐시됩니다.

### `validate_string`

먼저 디코딩하지 않고 스키마에 대해 JSON 문자열을 검증합니다. 파싱 전에 검증해야 할 때 유용합니다.

```lua
local schema = {
    type = "object",
    properties = {
        action = {type = "string", enum = {"create", "update", "delete"}}
    },
    required = {"action"}
}

-- Validate raw JSON from request body
local body = '{"action":"create","data":{}}'
local valid, err = json.validate_string(schema, body)
if not valid then
    return nil, errors.new({
        message = "Invalid request: " .. err:message(),
        kind = errors.INVALID
    })
end

-- Now safe to decode
local request, decode_err = json.decode(body)
if decode_err then return nil, decode_err end
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `schema` | table 또는 string | JSON Schema 정의 |
| `json_str` | string | 검증할 JSON 문자열 |

**반환:** `boolean, error`

## 에러

| 조건 | 종류 | 재시도 가능 |
|------|------|-------------|
| 재귀적 테이블 참조 | `errors.INTERNAL` | 아니오 |
| 희소 배열 (인덱스 갭) | `errors.INTERNAL` | 아니오 |
| 테이블의 혼합 키 타입 | `errors.INTERNAL` | 아니오 |
| 128 레벨 중첩 초과 | `errors.INTERNAL` | 아니오 |
| 잘못된 JSON 구문 | `errors.INTERNAL` | 아니오 |
| 스키마 컴파일 실패 | `errors.INVALID` | 아니오 |
| 검증 실패 | `errors.INVALID` | 아니오 |

에러 처리는 [에러 처리](lua/core/errors.md)를 참조하세요.
