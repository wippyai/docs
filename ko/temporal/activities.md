# 액티비티

액티비티는 비결정론적 작업을 실행하는 함수입니다. 모든 `function.lua` 또는 `process.lua` 엔트리는 메타데이터를 추가하여 Temporal 액티비티로 등록할 수 있습니다.

## 액티비티 등록

함수를 액티비티로 등록하려면 `meta.temporal.activity`를 추가하세요:

```yaml
- name: charge_payment
  kind: function.lua
  source: file://payment.lua
  method: charge
  modules:
    - http_client
    - json
  meta:
    temporal:
      activity:
        worker: app:worker
```

### 메타데이터 필드

| 필드 | 필수 | 설명 |
|-------|----------|-------------|
| `worker` | 예 | `temporal.worker` 엔트리 참조 |
| `local` | 아니오 | 로컬 액티비티로 실행 (기본값: false) |

## 구현

액티비티는 일반 Lua 함수입니다:

```lua
-- payment.lua
local http = require("http_client")
local json = require("json")

local function charge(input)
    local response, err = http.post("https://api.stripe.com/v1/charges", {
        headers = {
            ["Authorization"] = "Bearer " .. input.api_key,
            ["Content-Type"] = "application/json"
        },
        body = json.encode({
            amount = input.amount,
            currency = input.currency,
            source = input.token
        })
    })

    if err then
        return nil, err
    end

    return json.decode(response:body())
end

return { charge = charge }
```

## 액티비티 호출

워크플로우에서 `funcs` 모듈을 사용합니다:

```lua
local funcs = require("funcs")

local result, err = funcs.call("app:charge_payment", {
    amount = 5000,
    currency = "usd",
    token = "tok_visa",
    api_key = ctx.stripe_key
})

if err then
    return nil, err
end
```

## 액티비티 옵션

executor 빌더를 사용하여 타임아웃, 재시도 동작, 기타 실행 파라미터를 설정합니다:

```lua
local funcs = require("funcs")

local executor = funcs.new():with_options({
    ["activity.start_to_close_timeout"] = "30s",
    ["activity.schedule_to_close_timeout"] = "5m",
    ["activity.heartbeat_timeout"] = "10s",
    ["activity.retry_policy"] = {
        maximum_attempts = 3,
        initial_interval = 1000,
        backoff_coefficient = 2.0,
        maximum_interval = 60000,
    }
})

local result, err = executor:call("app:charge_payment", input)
```

executor는 불변이며 재사용 가능합니다. 한 번 빌드하고 여러 호출에 사용하세요:

```lua
local reliable = funcs.new():with_options({
    ["activity.start_to_close_timeout"] = "60s",
    ["activity.retry_policy"] = {
        maximum_attempts = 5,
        initial_interval = 2000,
        backoff_coefficient = 2.0,
        maximum_interval = 120000,
    }
})

local a, err = reliable:call("app:step_one", input)
local b, err = reliable:call("app:step_two", a)
```

### 옵션 레퍼런스

| 옵션 | 타입 | 기본값 | 설명 |
|--------|------|---------|-------------|
| `activity.start_to_close_timeout` | duration | 10m | 액티비티 실행 최대 시간 |
| `activity.schedule_to_close_timeout` | duration | - | 스케줄링부터 완료까지 최대 시간 |
| `activity.schedule_to_start_timeout` | duration | - | 액티비티 시작 전 최대 대기 시간 |
| `activity.heartbeat_timeout` | duration | - | heartbeat 사이 최대 시간 |
| `activity.id` | string | - | 커스텀 액티비티 실행 ID |
| `activity.task_queue` | string | - | 이 호출의 태스크 큐 오버라이드 |
| `activity.wait_for_cancellation` | boolean | false | 액티비티 취소 대기 |
| `activity.disable_eager_execution` | boolean | false | 즉시 실행 비활성화 |
| `activity.retry_policy` | table | - | 재시도 설정 (아래 참조) |

duration 값은 문자열 (`"5s"`, `"10m"`, `"1h"`) 또는 밀리초 숫자를 허용합니다.

### 재시도 정책

실패한 액티비티의 자동 재시도 동작을 설정합니다:

```lua
["activity.retry_policy"] = {
    initial_interval = 1000,         -- 첫 재시도 전 ms
    backoff_coefficient = 2.0,       -- 재시도마다 적용되는 승수
    maximum_interval = 300000,       -- 재시도 간격 최대값 (ms)
    maximum_attempts = 10,           -- 최대 재시도 횟수 (0 = 무제한)
    non_retryable_error_types = {    -- 재시도를 건너뛰는 에러
        "INVALID",
        "PERMISSION_DENIED"
    }
}
```

| 필드 | 타입 | 기본값 | 설명 |
|-------|------|---------|-------------|
| `initial_interval` | number | 1000 | 첫 번째 재시도 전 밀리초 |
| `backoff_coefficient` | number | 2.0 | 재시도마다 간격에 적용되는 승수 |
| `maximum_interval` | number | - | 재시도 간격 상한 (ms) |
| `maximum_attempts` | number | 0 | 최대 시도 횟수 (0 = 무제한) |
| `non_retryable_error_types` | array | - | 재시도를 건너뛰는 에러 종류 |

### 타임아웃 관계

```
|--- schedule_to_close_timeout --------------------------------|
|--- schedule_to_start_timeout ---|--- start_to_close_timeout -|
     (waiting in queue)                (executing)
```

- `start_to_close_timeout`: 액티비티 자체가 실행될 수 있는 시간. 가장 많이 사용되는 타임아웃입니다.
- `schedule_to_close_timeout`: 액티비티가 스케줄링된 시점부터 완료까지의 총 시간으로, 큐 대기 시간과 재시도를 포함합니다.
- `schedule_to_start_timeout`: 워커가 액티비티를 선택하기 전 태스크 큐에서 대기할 수 있는 최대 시간입니다.
- `heartbeat_timeout`: 장기 실행 액티비티에서 heartbeat 보고 사이의 최대 시간입니다.

## 로컬 액티비티

로컬 액티비티는 별도의 태스크 큐 폴링 없이 워크플로우 워커 프로세스에서 실행됩니다:

```yaml
- name: validate_input
  kind: function.lua
  source: file://validate.lua
  method: validate
  modules:
    - json
  meta:
    temporal:
      activity:
        worker: app:worker
        local: true
```

특징:
- 워크플로우 워커 프로세스에서 실행
- 낮은 지연 시간 (태스크 큐 왕복 없음)
- 별도의 태스크 큐 오버헤드 없음
- 짧은 실행 시간으로 제한
- heartbeat 없음

입력 검증, 데이터 변환, 캐시 조회와 같은 빠르고 짧은 작업에 로컬 액티비티를 사용하세요.

## 액티비티 명명

액티비티는 전체 엔트리 ID를 이름으로 등록됩니다:

```yaml
namespace: app
entries:
  - name: charge_payment
    kind: function.lua
    # ...
```

액티비티 이름: `app:charge_payment`

## 컨텍스트 전파

워크플로우 스폰 시 설정된 컨텍스트 값은 액티비티 내에서 사용할 수 있습니다:

```lua
-- Spawner sets context
local spawner = process.with_context({
    user_id = "user-1",
    tenant = "tenant-1",
})
local pid = spawner:spawn("app:order_workflow", "app:worker", order)
```

```lua
-- Activity reads context
local ctx = require("ctx")

local function process_order(input)
    local user_id = ctx.get("user_id")   -- "user-1"
    local tenant = ctx.get("tenant")     -- "tenant-1"
    -- use context for authorization, logging, etc.
end
```

워크플로우 내에서 `funcs.new():with_context()`로 호출된 액티비티에도 컨텍스트가 전파됩니다:

```lua
-- Inside workflow
local executor = funcs.new():with_context({trace_id = "abc-123"})
local result, err = executor:call("app:charge_payment", input)
```

## 에러 처리

표준 Lua 패턴으로 에러를 반환합니다:

```lua
local errors = require("errors")

local function charge(input)
    if not input.amount or input.amount <= 0 then
        return nil, errors.new("INVALID", "amount must be positive")
    end

    local response, err = http.post(url, options)
    if err then
        return nil, errors.wrap(err, "payment API failed")
    end

    if response:status() >= 400 then
        return nil, errors.new("FAILED", "payment declined")
    end

    return json.decode(response:body())
end
```

### 에러 객체

워크플로우에 전파된 액티비티 에러는 구조화된 메타데이터를 포함합니다:

```lua
local result, err = funcs.call("app:charge_payment", input)
if err then
    err:kind()       -- error classification string
    err:retryable()  -- boolean, whether retry makes sense
    err:message()    -- human-readable error message
end
```

### 실패 모드

| 실패 | 에러 종류 | 재시도 가능 | 설명 |
|---------|------------|-----------|-------------|
| 애플리케이션 에러 | 다양함 | 다양함 | 액티비티 코드에서 반환된 에러 |
| 런타임 크래시 | `INTERNAL` | true | 액티비티의 처리되지 않은 Lua 에러 |
| 누락된 액티비티 | `NOT_FOUND` | false | 워커에 등록되지 않은 액티비티 |
| 타임아웃 | `TIMEOUT` | true | 설정된 타임아웃을 초과한 액티비티 |

```lua
local executor = funcs.new():with_options({
    ["activity.retry_policy"] = {maximum_attempts = 1}
})

local result, err = executor:call("app:missing_activity", input)
if err then
    print(err:kind())      -- "NOT_FOUND"
    print(err:retryable())  -- false
end
```

## 프로세스 액티비티

`process.lua` 엔트리도 장기 실행 작업을 위해 액티비티로 등록할 수 있습니다:

```yaml
- name: long_task
  kind: process.lua
  source: file://long_task.lua
  method: main
  modules:
    - http_client
  meta:
    temporal:
      activity:
        worker: app:worker
```

## 참고

- [개요](temporal/overview.md) - 설정
- [워크플로우](temporal/workflows.md) - 워크플로우 구현
- [함수](lua/core/funcs.md) - 함수 모듈
- [에러 처리](lua/core/errors.md) - 에러 타입과 패턴
