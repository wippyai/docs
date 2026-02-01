# 함수 호출
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

Wippy에서 다른 함수를 호출하는 주요 방법. 컨텍스트 전파, 보안 자격 증명, 타임아웃을 완벽하게 지원하여 프로세스 간에 등록된 함수를 동기 또는 비동기로 실행합니다. 이 모듈은 컴포넌트가 통신해야 하는 분산 애플리케이션 구축의 핵심입니다.

## 로딩

```lua
local funcs = require("funcs")
```

## call

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

## async

비동기 함수 호출을 시작하고 Future와 함께 즉시 반환합니다. 블록하고 싶지 않은 장기 실행 작업이나 여러 작업을 병렬로 실행하고 싶을 때 사용합니다.

```lua
-- 블로킹 없이 무거운 계산 시작
local future, err = funcs.async("app.process:analyze_data", large_dataset)
if err then
    return nil, err
end

-- 계산 실행 중 다른 작업 수행...

-- 준비되면 결과 대기
local ch = future:response()
local payload, ok = ch:receive()
if ok then
    local result = payload:data()
end
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `target` | string | "namespace:name" 형식의 함수 ID |
| `...args` | any | 함수에 전달되는 인자 |

**반환:** `Future, error`

## new

커스텀 컨텍스트로 함수 호출을 빌드하기 위한 새 Executor를 생성합니다. 요청 컨텍스트 전파, 보안 자격 증명 설정, 타임아웃 구성이 필요할 때 사용합니다.

```lua
local exec = funcs.new()
```

**반환:** `Executor, error`

## Executor

커스텀 컨텍스트 옵션이 있는 함수 호출 빌더. 메서드는 새 Executor 인스턴스를 반환하므로 (불변 체이닝) 기본 설정을 재사용할 수 있습니다.

### with_context

호출된 함수에서 사용 가능한 컨텍스트 값을 추가합니다. 트레이스 ID, 사용자 세션, 기능 플래그와 같은 요청 범위 데이터를 전파할 때 사용합니다.

```lua
-- 다운스트림 서비스로 요청 컨텍스트 전파
local exec = funcs.new():with_context({
    request_id = ctx.get("request_id"),
    feature_flags = {dark_mode = true}
})

local user, err = exec:call("app.api:get_user", user_id)
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `values` | table | 컨텍스트에 추가할 키-값 쌍 |

**반환:** `Executor, error`

### with_actor

호출된 함수의 인가 검사를 위한 보안 액터를 설정합니다. 특정 사용자를 대신하여 함수를 호출할 때 사용합니다.

```lua
local security = require("security")
local actor = security.actor()  -- 현재 사용자의 액터 가져오기

-- 사용자의 자격 증명으로 admin 함수 호출
local exec = funcs.new():with_actor(actor)
local result, err = exec:call("app.admin:delete_record", record_id)
if err and err:kind() == "PERMISSION_DENIED" then
    return nil, errors.new("PERMISSION_DENIED", "User cannot delete records")
end
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `actor` | Actor | 보안 액터 (security 모듈에서) |

**반환:** `Executor, error`

### with_scope

호출된 함수의 보안 스코프를 설정합니다. 스코프는 호출에 사용 가능한 권한을 정의합니다.

```lua
local security = require("security")
local scope = security.new_scope()

local exec = funcs.new():with_scope(scope)
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `scope` | Scope | 보안 스코프 (security 모듈에서) |

**반환:** `Executor, error`

### with_options

타임아웃과 우선순위 같은 호출 옵션을 설정합니다. 시간 제한이 필요한 작업에 사용합니다.

```lua
-- 외부 API 호출에 5초 타임아웃 설정
local exec = funcs.new():with_options({timeout = 5000})
local result, err = exec:call("app.external:fetch_data", query)
if err then
    -- 타임아웃 또는 다른 에러 처리
end
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `options` | table | 구현별 옵션 |

**반환:** `Executor, error`

### call / async

설정된 컨텍스트를 사용하는 Executor 버전의 call과 async.

```lua
-- 컨텍스트가 있는 재사용 가능한 executor 빌드
local exec = funcs.new()
    :with_context({trace_id = "abc-123"})
    :with_options({timeout = 10000})

-- 같은 컨텍스트로 여러 호출
local users, _ = exec:call("app.api:list_users")
local posts, _ = exec:call("app.api:list_posts")
```

## Future

`async()` 호출에서 반환됩니다. 진행 중인 비동기 작업을 나타냅니다.

### response / channel

결과를 받기 위한 기본 채널을 반환합니다.

```lua
local future, _ = funcs.async("app.api:slow_operation", data)
local ch = future:response()  -- 또는 future:channel()

local result = channel.select {
    ch:case_receive(),
    timeout:case_receive()
}
```

**반환:** `Channel`

### is_complete

future가 완료되었는지 논블로킹 검사.

```lua
while not future:is_complete() do
    -- 다른 작업 수행
    time.sleep("100ms")
end
local result, err = future:result()
```

**반환:** `boolean`

### is_canceled

이 future에 `cancel()`이 호출되었으면 true 반환.

```lua
if future:is_canceled() then
    print("Operation was canceled")
end
```

**반환:** `boolean`

### result

완료되면 캐시된 결과 반환, 진행 중이면 nil.

```lua
local value, err = future:result()
if err then
    print("Failed:", err:message())
elseif value then
    print("Got:", value:data())
end
```

**반환:** `Payload|nil, error|nil`

### error

future가 실패했으면 에러 반환.

```lua
local err, has_error = future:error()
if has_error then
    print("Error kind:", err:kind())
end
```

**반환:** `error|nil, boolean`

### cancel

비동기 작업을 취소합니다.

```lua
future:cancel()
```

## 병렬 작업

async와 channel.select를 사용하여 여러 작업을 동시에 실행합니다.

```lua
-- 여러 작업을 병렬로 시작
local f1, _ = funcs.async("app.api:get_user", user_id)
local f2, _ = funcs.async("app.api:get_orders", user_id)
local f3, _ = funcs.async("app.api:get_preferences", user_id)

-- 채널을 사용하여 모두 완료 대기
local user_ch = f1:channel()
local orders_ch = f2:channel()
local prefs_ch = f3:channel()

local results = {}
for i = 1, 3 do
    local r = channel.select {
        user_ch:case_receive(),
        orders_ch:case_receive(),
        prefs_ch:case_receive()
    }
    if r.channel == user_ch then
        results.user = r.value:data()
    elseif r.channel == orders_ch then
        results.orders = r.value:data()
    else
        results.prefs = r.value:data()
    end
end
```

## 권한

함수 작업은 보안 정책 평가의 대상입니다.

| 액션 | 리소스 | 설명 |
|------|--------|------|
| `funcs.call` | 함수 ID | 특정 함수 호출 |
| `funcs.context` | `context` | `with_context()`를 사용하여 커스텀 컨텍스트 설정 |
| `funcs.security` | `security` | `with_actor()` 또는 `with_scope()` 사용 |

## 에러

| 조건 | 종류 | 재시도 가능 |
|------|------|-----------|
| Target 비어있음 | `errors.INVALID` | 아니오 |
| Namespace 누락 | `errors.INVALID` | 아니오 |
| Name 누락 | `errors.INVALID` | 아니오 |
| 권한 거부됨 | `errors.PERMISSION_DENIED` | 아니오 |
| 구독 실패 | `errors.INTERNAL` | 아니오 |
| 함수 에러 | 다양함 | 다양함 |

에러 처리는 [에러 처리](lua-errors.md)를 참조하세요.
