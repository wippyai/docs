---
title: "함수 호출"
description: "등록된 함수를 동기 또는 비동기로 호출하고 요청, 보안 및 호출 옵션을 전파합니다."
---

# 함수 호출
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

`funcs` 모듈은 등록된 함수를 동기 또는 비동기로 호출합니다. executor는 요청 컨텍스트, 보안 신원 및 구현별 호출 옵션을 전파할 수 있습니다. 이 페이지는 API 참조이며, 대상 ID, 인수 및 애플리케이션 데이터는 주변 코드를 나타냅니다.

## 로딩

```lua
local funcs = require("funcs")
```

## `call`

등록된 함수를 동기적으로 호출합니다. 즉각적인 결과가 필요하고 대기할 수 있을 때 사용합니다.

```lua
local result, err = funcs.call("app.api:get_user", user_id)
if err then
    return nil, err
end
print(result.name)
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `target` | string | "namespace:name" 형식의 함수 ID |
| `...args` | any | 함수에 전달되는 인자 |

**반환:** `result, error`

target 문자열은 `namespace:name` 패턴을 따르며 namespace는 모듈을 식별하고 name은 특정 함수를 식별합니다.

## `async`

함수 호출을 시작하고 `Future`를 즉시 반환합니다. Future를 사용하면 호출이 실행되는 동안 다른 작업을 계속하고 여러 호출을 동시에 수행할 수 있습니다.

```lua
-- Start heavy computation without blocking
local future, err = funcs.async("app.process:analyze_data", large_dataset)
if err then
    return nil, err
end

-- Do other work while computation runs...

-- Wait for result when ready
local ch = future:response()
local _, open = ch:receive()
if not open then
    return nil, errors.new("future response channel closed")
end

local payload, result_err = future:result()
if result_err then
    return nil, result_err
end
local result, data_err = payload:data()
if data_err then return nil, data_err end
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `target` | string | "namespace:name" 형식의 함수 ID |
| `...args` | any | 함수에 전달되는 인자 |

**반환:** `Future, error`

## `new`

커스텀 컨텍스트, 보안 신원 또는 호출 옵션이 필요한 호출을 위한 `Executor`를 만듭니다.

```lua
local exec = funcs.new()
```

**반환:** `Executor`

## Executor

커스텀 컨텍스트 옵션이 있는 함수 호출 빌더. 메서드는 새 Executor 인스턴스를 반환하므로 (불변 체이닝) 기본 설정을 재사용할 수 있습니다.

### `with_context`

호출된 함수에서 사용 가능한 컨텍스트 값을 추가합니다. 트레이스 ID, 사용자 세션, 기능 플래그와 같은 요청 범위 데이터를 전파할 때 사용합니다.

```lua
local ctx = require("ctx")

-- Propagate request context to downstream services
local request_id, ctx_err = ctx.get("request_id")
if ctx_err then return nil, ctx_err end

local exec, err = funcs.new():with_context({
    request_id = request_id,
    feature_flags = {dark_mode = true}
})
if err then return nil, err end

local user, err = exec:call("app.api:get_user", user_id)
if err then return nil, err end
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `values` | table | 컨텍스트에 추가할 키-값 쌍 |

**반환:** `Executor, error`

### `with_actor`

호출된 함수의 인가 검사를 위한 보안 액터를 설정합니다. 특정 사용자를 대신하여 함수를 호출할 때 사용합니다.

```lua
local security = require("security")
local actor = security.actor()  -- Get current user's actor

-- Call admin function with user's credentials
local exec, err = funcs.new():with_actor(actor)
if err then return nil, err end
local result, err = exec:call("app.admin:delete_record", record_id)
if err and err:kind() == errors.PERMISSION_DENIED then
    return nil, errors.new({
        message = "User cannot delete records",
        kind = errors.PERMISSION_DENIED
    })
end
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `actor` | Actor | 보안 액터 (security 모듈에서) |

**반환:** `Executor, error`

### `with_scope`

호출된 함수의 보안 스코프를 설정합니다. 스코프는 호출에 사용 가능한 권한을 정의합니다.

```lua
local security = require("security")
local scope = security.new_scope()

local exec, err = funcs.new():with_scope(scope)
if err then return nil, err end
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `scope` | Scope | 보안 스코프 (security 모듈에서) |

**반환:** `Executor, error`

### `with_options`

호출 옵션을 설정합니다. 구현에서 자체 옵션을 정의할 수 있으며, 런타임은 아웃바운드 네트워크를 선택하는 `network`도 인식합니다.

```lua
-- Set a 5 second timeout for external API call
local exec, err = funcs.new():with_options({timeout = 5000})
if err then return nil, err end
local result, err = exec:call("app.external:fetch_data", query)
if err then
    -- Handle timeout or other error
end
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `options` | table | 구현별 옵션 |

런타임이 정의하는 옵션은 다음과 같습니다.

| 인식되는 옵션 | 타입 | 설명 |
|---------------|------|------|
| `network` | string | 아웃바운드 `network.*` 엔트리의 레지스트리 ID |

**반환:** `Executor, error`

네트워크를 선택하려면 해당 네트워크 ID에 대한 `network.select` 권한이 필요합니다.

### `call`과 `async`

executor 버전의 `call`과 `async`는 구성된 컨텍스트와 옵션을 사용합니다.

```lua
-- Build reusable executor with context
local exec, err = funcs.new():with_context({trace_id = "abc-123"})
if err then return nil, err end
exec, err = exec:with_options({timeout = 10000})
if err then return nil, err end

-- Make multiple calls with same context
local users, users_err = exec:call("app.api:list_users")
if users_err then return nil, users_err end
local posts, posts_err = exec:call("app.api:list_posts")
if posts_err then return nil, posts_err end
```

## Future 호출 요약

`async()`는 진행 중인 호출을 나타내는 future를 반환합니다. 아래 메서드는 호출자가 호출을 수신, 검사 또는 취소하는 단계를 다룹니다. Future 객체 참조는 [Future](./future.md)를 참조하세요.

### `response`와 `channel`

결과를 받기 위한 기본 채널을 반환합니다.

```lua
local time = require("time")

local future, err = funcs.async("app.api:slow_operation", data)
if err then
    return nil, err
end
local ch = future:response()  -- or future:channel()

local timeout, err = time.after("5s")
if err then
    return nil, err
end

local result = channel.select {
    ch:case_receive(),
    timeout:case_receive()
}
```

**반환:** `Channel`

응답 채널은 완료를 알립니다. 준비된 후 `future:result()`를 호출해 캐시된 값이나 호출된 함수의 오류를 가져오세요.

### `is_complete`

future가 완료되었는지 논블로킹 검사.

```lua
while not future:is_complete() do
    -- do other work
    local _, sleep_err = time.sleep("100ms")
    if sleep_err then return nil, sleep_err end
end
local result, err = future:result()
```

**반환:** `boolean`

### `is_canceled`

future가 provider에 의해 취소된 것으로 표시되었으면 `true`를 반환합니다. 아래의 취소 제한을 참조하세요.

```lua
if future:is_canceled() then
    print("Operation was canceled")
end
```

**반환:** `boolean`

### `result`

완료되면 캐시된 결과를 반환하고 작업이 대기 중이면 `nil`을 반환합니다.

```lua
local value, err = future:result()
if err then
    print("Failed:", err:message())
elseif value then
    local data, data_err = value:data()
    if data_err then return nil, data_err end
    print("Got:", data)
end
```

**반환:** `Payload|table|nil, error|nil`

### `error`

future가 실패했으면 에러 반환.

```lua
local err, has_error = future:error()
if has_error then
    print("Error kind:", err:kind())
end
```

**반환:** `error|nil, boolean`

이 메서드는 실패한 작업에 대해 재시도할 수 없는 `INTERNAL` 래퍼를 반환합니다. 호출된 함수의 원래 오류 메타데이터를 보존하려면 `result()`를 사용하세요.

### `cancel`

비동기 작업을 취소합니다.

```lua
local canceled, err = future:cancel()
if err then return nil, err end
```

**반환:** `boolean, error`

<warning>
런타임 v0.3.32a에서 함수와 계약 future는 하나의 프로세스 전역 취소 콜백을 공유합니다. 두 provider가 모두 로드된 경우 <code>cancel()</code>과 <code>is_canceled()</code>은 안정적인 교차 provider 계약이 아닙니다. 애플리케이션 정확성을 위해 취소에 의존하지 마세요. 런타임이 provider 취소를 분리할 때까지 로컬에서 타임아웃하고 늦은 결과를 무시하세요.
</warning>

## 병렬 작업

`async`와 `channel.select`를 결합해 여러 호출을 동시에 실행하고 수집합니다.

```lua
-- Start multiple operations in parallel
local f1, err = funcs.async("app.api:get_user", user_id)
if err then return nil, err end
local f2, err = funcs.async("app.api:get_orders", user_id)
if err then return nil, err end
local f3, err = funcs.async("app.api:get_preferences", user_id)
if err then return nil, err end

-- Wait for all to complete using channels
local user_ch = f1:channel()
local orders_ch = f2:channel()
local prefs_ch = f3:channel()

local pending = {
    [user_ch] = {name = "user", future = f1},
    [orders_ch] = {name = "orders", future = f2},
    [prefs_ch] = {name = "preferences", future = f3}
}
local results = {}
while next(pending) do
    local cases = {}
    for ch in pairs(pending) do
        cases[#cases + 1] = ch:case_receive()
    end

    local r = channel.select(cases)
    local completed = pending[r.channel]
    pending[r.channel] = nil

    local payload, result_err = completed.future:result()
    if result_err then
        return nil, result_err
    end
    local data, data_err = payload:data()
    if data_err then
        return nil, data_err
    end
    results[completed.name] = data
end
```

## 권한

함수 작업은 보안 정책 평가의 대상입니다.

| 액션 | 리소스 | 설명 |
|------|--------|------|
| `funcs.call` | 함수 ID | 특정 함수 호출 |
| `funcs.context` | `context` | `with_context()`를 사용하여 커스텀 컨텍스트 설정 |
| `funcs.security` | `security` | `with_actor()` 또는 `with_scope()` 사용 |
| `network.select` | 네트워크 ID | `with_options()`으로 아웃바운드 네트워크 선택 |

## 에러

| 조건 | 종류 | 재시도 가능 |
|------|------|-----------|
| Target 비어있음 | `errors.INVALID` | 아니오 |
| Namespace 누락 | `errors.INVALID` | 아니오 |
| Name 누락 | `errors.INVALID` | 아니오 |
| 권한 거부됨 | `errors.PERMISSION_DENIED` | 아니오 |
| 구독 실패 | `errors.INTERNAL` | 아니오 |
| 비동기 시작 디스패치 실패 | `errors.INTERNAL` | 아니오 |
| 함수 에러 | 다양함 | 다양함 |

에러 처리는 [에러 처리](./errors.md)를 참조하세요.
