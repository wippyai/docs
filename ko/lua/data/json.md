# JSON 인코딩
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>
<secondary-label ref="encoding"/>

Lua 테이블을 JSON으로 인코딩하고 JSON 문자열을 Lua 값으로 디코딩합니다. 데이터 검증 및 API 계약 적용을 위한 JSON Schema 검증을 포함합니다.

## 로딩

```lua
local json = require("json")
```

## 인코딩

### 값 인코딩

Lua 값을 JSON 문자열로 인코딩합니다.

```lua
-- 단순 값
json.encode("hello")        -- '"hello"'
json.encode(42)             -- '42'
json.encode(true)           -- 'true'
json.encode(nil)            -- 'null'

-- 배열 (순차적 숫자 키)
json.encode({1, 2, 3})      -- '[1,2,3]'
json.encode({"a", "b"})     -- '["a","b"]'

-- 객체 (문자열 키)
local user = {name = "Alice", age = 30}
json.encode(user)           -- '{"name":"Alice","age":30}'

-- 중첩 구조
local order = {
    id = "ord-123",
    items = {
        {sku = "ABC", qty = 2},
        {sku = "XYZ", qty = 1}
    },
    total = 99.50
}
json.encode(order)
-- '{"id":"ord-123","items":[{"sku":"ABC","qty":2},{"sku":"XYZ","qty":1}],"total":99.5}'
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

### 문자열 디코딩

JSON 문자열을 Lua 값으로 디코딩합니다.

```lua
-- 객체 파싱
local user, err = json.decode('{"name":"Bob","active":true}')
if err then
    return nil, err
end
print(user.name)    -- "Bob"
print(user.active)  -- true

-- 배열 파싱
local items = json.decode('[10, 20, 30]')
print(items[1])     -- 10
print(#items)       -- 3

-- 중첩 데이터 파싱
local response = json.decode([[
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
print(response.data.users[1].name)  -- "Alice"

-- 에러 처리
local data, err = json.decode("not valid json")
if err then
    print(err:kind())     -- "INTERNAL"
    print(err:message())  -- 파싱 에러 상세
end
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `str` | string | 디코딩할 JSON 문자열 |

**반환:** `any, error`

## 스키마 검증

### 값 검증

JSON Schema에 대해 Lua 값을 검증합니다. API 계약 적용이나 사용자 입력 검증에 사용합니다.

```lua
-- 스키마 정의
local user_schema = {
    type = "object",
    properties = {
        name = {type = "string", minLength = 1},
        email = {type = "string", format = "email"},
        age = {type = "integer", minimum = 0, maximum = 150}
    },
    required = {"name", "email"}
}

-- 유효한 데이터는 통과
local valid, err = json.validate(user_schema, {
    name = "Alice",
    email = "alice@example.com",
    age = 30
})
print(valid)  -- true

-- 유효하지 않은 데이터는 상세 정보와 함께 실패
local valid, err = json.validate(user_schema, {
    name = "",
    email = "not-an-email"
})
if not valid then
    print(err:message())  -- 검증 에러 상세
end

-- 스키마는 JSON 문자열일 수도 있음
local schema_json = '{"type":"number","minimum":0}'
local valid = json.validate(schema_json, 42)
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `schema` | table 또는 string | JSON Schema 정의 |
| `data` | any | 검증할 값 |

**반환:** `boolean, error`

스키마는 성능을 위해 콘텐츠 해시로 캐시됩니다.

### JSON 문자열 검증

먼저 디코딩하지 않고 스키마에 대해 JSON 문자열을 검증합니다. 파싱 전에 검증해야 할 때 유용합니다.

```lua
local schema = {
    type = "object",
    properties = {
        action = {type = "string", enum = {"create", "update", "delete"}}
    },
    required = {"action"}
}

-- 요청 본문의 raw JSON 검증
local body = '{"action":"create","data":{}}'
local valid, err = json.validate_string(schema, body)
if not valid then
    return nil, errors.new("INVALID", "Invalid request: " .. err:message())
end

-- 이제 안전하게 디코딩
local request = json.decode(body)
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

에러 처리는 [에러 처리](lua-errors.md)를 참조하세요.
