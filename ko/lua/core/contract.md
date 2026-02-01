# 계약
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>
<secondary-label ref="permissions"/>

타입화된 계약을 통해 서비스를 호출합니다. 스키마 검증과 비동기 실행 지원으로 원격 API, 워크플로우, 함수를 호출합니다.

## 로딩

```lua
local contract = require("contract")
```

## 바인딩 열기

ID로 바인딩을 직접 엽니다:

```lua
local greeter, err = contract.open("app.services:greeter")
if err then
    return nil, err
end

local result, err = greeter:say_hello("Alice")
```

스코프 컨텍스트 또는 쿼리 파라미터와 함께:

```lua
-- 스코프 테이블과 함께
local svc, err = contract.open("app.services:user", {
    tenant_id = "acme",
    region = "us-east"
})

-- 쿼리 파라미터와 함께 (자동 변환: "true"->bool, 숫자->int/float)
local api, err = contract.open("app.services:api?debug=true&timeout=5000")
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `binding_id` | string | 바인딩 ID, 쿼리 파라미터 지원 |
| `scope` | table | 컨텍스트 값 (선택적, 쿼리 파라미터 재정의) |

**반환:** `Instance, error`

## 계약 가져오기

인트로스펙션을 위해 계약 정의를 검색합니다:

```lua
local c, err = contract.get("app.services:greeter")

print(c:id())  -- "app.services:greeter"

local methods = c:methods()
for _, m in ipairs(methods) do
    print(m.name, m.description)
end

local method, err = c:method("say_hello")
```

### 메서드 정의

| 필드 | 타입 | 설명 |
|------|------|------|
| `name` | string | 메서드 이름 |
| `description` | string | 메서드 설명 |
| `input_schemas` | table[] | 입력 스키마 정의 |
| `output_schemas` | table[] | 출력 스키마 정의 |

## 구현 찾기

계약을 구현하는 모든 바인딩을 나열합니다:

```lua
local bindings, err = contract.find_implementations("app.services:greeter")

for _, binding_id in ipairs(bindings) do
    print(binding_id)
end
```

또는 계약 객체를 통해:

```lua
local c, err = contract.get("app.services:greeter")
local bindings, err = c:implementations()
```

## 구현 확인

인스턴스가 계약을 구현하는지 확인합니다:

```lua
if contract.is(instance, "app.services:greeter") then
    instance:say_hello("World")
end
```

## 메서드 호출

동기 호출 - 완료까지 블록:

```lua
local calc, err = contract.open("app.services:calculator")

local sum, err = calc:add(10, 20)
local product, err = calc:multiply(5, 6)
```

## 비동기 호출

비동기 실행을 위해 `_async` 접미사 추가:

```lua
local processor, err = contract.open("app.services:processor")

local future, err = processor:process_async(large_dataset)

-- 다른 작업 수행...

-- 결과 대기
local ch = future:response()
local payload, ok = ch:receive()
if ok then
    local result = payload:data()
end
```

Future 메서드는 [Futures](lua-future.md)를 참조하세요.

## 계약을 통해 열기

계약 객체를 통해 바인딩을 엽니다:

```lua
local c, err = contract.get("app.services:user")

-- 기본 바인딩
local instance, err = c:open()

-- 특정 바인딩
local instance, err = c:open("app.services:user_impl")

-- 스코프와 함께
local instance, err = c:open(nil, {user_id = 123})
local instance, err = c:open("app.services:user_impl", {user_id = 123})
```

## 컨텍스트 추가

미리 구성된 컨텍스트로 래퍼를 생성합니다:

```lua
local c, err = contract.get("app.services:user")

local wrapped = c:with_context({
    request_id = ctx.get("request_id"),
    user_id = current_user.id
})

local instance, err = wrapped:open()
```

## 보안 컨텍스트

인가를 위해 액터와 스코프를 설정합니다:

```lua
local security = require("security")
local c, err = contract.get("app.services:admin")

local secured = c:with_actor(security.actor()):with_scope(security.scope())

local admin, err = secured:open()
```

## 권한

| 권한 | 리소스 | 함수 |
|------|--------|------|
| `contract.get` | 계약 id | `get()` |
| `contract.open` | 바인딩 id | `open()`, `Contract:open()` |
| `contract.implementations` | 계약 id | `find_implementations()`, `Contract:implementations()` |
| `contract.call` | 메서드 이름 | 동기 및 비동기 메서드 호출 |
| `contract.context` | "context" | `Contract:with_context()` |
| `contract.security` | "security" | `Contract:with_actor()`, `Contract:with_scope()` |

## 에러

| 조건 | 종류 |
|------|------|
| 잘못된 바인딩 ID 형식 | `errors.INVALID` |
| 계약을 찾을 수 없음 | `errors.NOT_FOUND` |
| 바인딩을 찾을 수 없음 | `errors.NOT_FOUND` |
| 메서드를 찾을 수 없음 | `errors.NOT_FOUND` |
| 기본 바인딩 없음 | `errors.NOT_FOUND` |
| 권한 거부됨 | `errors.PERMISSION_DENIED` |
| 호출 실패 | `errors.INTERNAL` |
