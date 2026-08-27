---
title: "에러"
description: "Lua 엔트리에서 structured error를 생성, wrap, inspect 및 classify합니다."
---

# 에러
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

전역 `errors` table은 category, detail 및 retry metadata가 있는 structured error를 생성하고 inspect합니다. `require` 없이 사용할 수 있습니다.

이 페이지는 API 레퍼런스입니다. 각 code block은 완전한 엔트리가 아닌 독립적인 snippet입니다. `err` 같은 변수는 주변 애플리케이션 코드에서 반환되거나 생성된 error를 가리키며 wrapping 예제는 `db`가 애플리케이션에서 제공되는 database client라고 가정합니다.

## 에러 생성

```lua
-- Simple message (kind defaults to UNKNOWN)
local err = errors.new("something went wrong")

-- With kind, retryable, and details
local err = errors.new({
    message = "user not found",
    kind = errors.NOT_FOUND,
    retryable = false,
    details = {user_id = 123}
})
```

`errors.new`는 문자열 메시지 또는 최소 `message` 필드를 가진 테이블을 받습니다. `(kind, message)` 형식은 지원되지 않습니다.

## 에러 래핑

kind, retry metadata 및 detail을 보존하면서 context를 추가합니다.

```lua
local data, err = db:query("SELECT * FROM users")
if err then
    return nil, errors.wrap(err, "failed to load users")
end
```

## 에러 메서드

| 메서드 | 반환 | 설명 |
|--------|------|------|
| `err:kind()` | string | 에러 카테고리 |
| `err:message()` | string | 에러 메시지 |
| `err:retryable()` | boolean/nil | 작업을 재시도할 수 있는지 |
| `err:details()` | table/nil | 구조화된 메타데이터 |
| `err:stack()` | string | Lua 스택 트레이스 |
| `tostring(err)` | string | 전체 표현 |

## Kind 확인

```lua
if errors.is(err, errors.INVALID) then
    -- handle invalid input
end

-- Or compare directly
if err:kind() == errors.NOT_FOUND then
    -- handle missing resource
end
```

## 에러 종류

| 상수 | 사용 사례 |
|------|----------|
| `errors.NOT_FOUND` | 리소스가 존재하지 않음 |
| `errors.ALREADY_EXISTS` | 리소스가 이미 존재 |
| `errors.INVALID` | 잘못된 입력 또는 인자 |
| `errors.PERMISSION_DENIED` | 접근 거부됨 |
| `errors.UNAVAILABLE` | 서비스가 일시적으로 다운 |
| `errors.INTERNAL` | 내부 에러 |
| `errors.CANCELED` | 작업이 취소됨 |
| `errors.CONFLICT` | 리소스 상태 충돌 |
| `errors.TIMEOUT` | 작업 시간 초과 |
| `errors.RATE_LIMITED` | 요청이 너무 많음 |
| `errors.UNKNOWN` | 지정되지 않은 에러 |

## 호출 스택

`errors.call_stack`을 사용해 structured call stack을 inspect합니다.

```lua
local stack = errors.call_stack(err)
if stack then
    print("Thread:", stack.thread)
    for _, frame in ipairs(stack.frames) do
        print(frame.source .. ":" .. frame.line, frame.name)
    end
end
```

## 재시도 가능한 에러

retryability는 error metadata이며 error kind가 보장하는 속성이 아닙니다. `err:kind()`에서 추론하지 말고 `err:retryable()`이 반환한 값을 검사하십시오. 결과가 `nil`이면 retry가 적절한지 error가 지정하지 않은 것입니다.

```lua
if err:retryable() then
    -- safe to retry
end
```

## 에러 상세

```lua
local err = errors.new({
    message = "validation failed",
    kind = errors.INVALID,
    details = {
        errors = {
            {field = "email", message = "invalid format"},
            {field = "age", message = "must be positive"}
        }
    }
})

local details = err:details()
for _, e in ipairs(details.errors) do
    print(e.field, e.message)
end
```
