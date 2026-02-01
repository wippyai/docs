# 에러
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

분류와 재시도 메타데이터가 있는 구조화된 에러 처리. 전역 `errors` 테이블은 require 없이 사용 가능합니다.

## 에러 생성

```lua
-- 간단한 메시지 (kind 기본값은 UNKNOWN)
local err = errors.new("something went wrong")

-- kind와 함께
local err = errors.new(errors.NOT_FOUND, "user not found")

-- 전체 생성자
local err = errors.new({
    message = "user not found",
    kind = errors.NOT_FOUND,
    retryable = false,
    details = {user_id = 123}
})
```

## 에러 래핑

kind, retryable, details를 보존하면서 컨텍스트 추가:

```lua
local data, err = db.query("SELECT * FROM users")
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
    -- 잘못된 입력 처리
end

-- 또는 직접 비교
if err:kind() == errors.NOT_FOUND then
    -- 누락된 리소스 처리
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

구조화된 호출 스택 가져오기:

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

| 일반적으로 재시도 가능 | 재시도 불가 |
|----------------------|------------|
| `TIMEOUT` | `INVALID` |
| `UNAVAILABLE` | `NOT_FOUND` |
| `RATE_LIMITED` | `PERMISSION_DENIED` |
| | `ALREADY_EXISTS` |

```lua
if err:retryable() then
    -- 재시도 안전
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
