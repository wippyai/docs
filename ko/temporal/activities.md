---
title: "액티비티"
description: "function.lua 또는 process.lua 엔트리를 비결정론적 작업을 위한 Temporal 액티비티로 등록합니다."
---

# 액티비티

Temporal 액티비티는 비결정론적 작업을 실행합니다. `function.lua` 또는 `process.lua` 엔트리의 메타데이터를 통해 액티비티로 등록하세요.

이 페이지의 코드 조각은 API 사용법을 보여 주는 예시입니다. 결제 예제를 실제로 사용하려면 애플리케이션이 소유하는 환경 엔트리, 자격 증명에 대한 `env.get` 권한, 결제 공급자 URL에 대한 `http_client.request` 권한, 그리고 결제 공급자 계약이 필요합니다.

## 액티비티 등록

함수를 액티비티로 등록하려면 `meta.temporal.activity`를 추가하세요:

```yaml
- name: charge_payment
  kind: function.lua
  source: file://payment.lua
  method: charge
  modules:
    - env
    - errors
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
| `name` | 아니오 | 커스텀 액티비티 타입 이름 (기본값: 엔트리 ID) |

## 구현

액티비티는 일반 Lua 함수입니다. Temporal은 워크플로우 입력을 워크플로우 이력에 저장하므로 자격 증명을 입력에 포함하지 마세요. 이 예제는 액티비티 안에서 환경 레지스트리의 결제 키를 읽습니다. 예시 공급자는 JSON 결제 요청을 받고 JSON 응답을 반환합니다. 상태 매핑은 애플리케이션이 소유하는 정책입니다. URL, 요청 필드, 응답 필드, 실패 매핑을 실제 공급자 계약에 맞게 바꾸세요.

```lua
-- payment.lua
local http = require("http_client")
local json = require("json")
local env = require("env")
local errors = require("errors")

local function payment_error(status)
    if status == 408 then
        return errors.new({kind = errors.TIMEOUT, message = "payment provider timed out", retryable = true})
    elseif status == 429 then
        return errors.new({kind = errors.RATE_LIMITED, message = "payment provider rate limited the request", retryable = true})
    elseif status >= 500 then
        return errors.new({kind = errors.UNAVAILABLE, message = "payment provider is unavailable", retryable = true})
    end
    return errors.new({kind = errors.INVALID, message = "payment request was rejected", retryable = false})
end

local function charge(input)
    local api_key, env_err = env.get("PAYMENTS_API_KEY")
    if env_err then return nil, env_err end

    local body, encode_err = json.encode({
        amount = input.amount,
        currency = input.currency,
        payment_token = input.payment_token
    })
    if encode_err then
        return nil, encode_err
    end

    local response, err = http.post("https://payments.example.com/v1/charges", {
        headers = {
            ["Authorization"] = "Bearer " .. api_key,
            ["Content-Type"] = "application/json"
        },
        body = body
    })

    if err then
        return nil, err
    end

    if response.status_code >= 400 then
        return nil, payment_error(response.status_code)
    end

    return json.decode(response.body)
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
    payment_token = "payment-token-123"
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
if err then
    return nil, err
end
local b, err = reliable:call("app:step_two", a)
if err then
    return nil, err
end
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
| `activity.name` | string | - | 레지스트리 ID와 다를 때 호출할 액티비티 타입 이름 |
| `activity.summary` | string | - | Temporal UI에 표시되는 사람이 읽을 수 있는 요약 |
| `activity.priority` | table | - | 태스크 우선순위: `priority_key` (number), `fairness_key` (string), `fairness_weight` (number) |
| `activity.versioning_intent` | string | - | `compatible` (빌드 ID 상속) 또는 `default` (할당 규칙 사용) |

duration 값은 문자열 (`"5s"`, `"10m"`, `"1h"`) 또는 밀리초 숫자를 허용합니다.

새 코드에는 표준 `activity.*` 이름을 사용하세요. 기존 `temporal.activity.*` 별칭도 호환성을 위해 계속 지원됩니다.

```lua
local executor = funcs.new():with_options({
    ["activity.summary"] = "Charge the order payment",
    ["activity.priority"] = {
        priority_key = 10,
        fairness_key = "customer-123",
        fairness_weight = 1.0,
    },
    ["activity.name"] = "charge-payment",
    ["activity.versioning_intent"] = "use_assignment_rules",
})
```

### 재시도 정책

실패한 액티비티의 자동 재시도 동작을 설정합니다:

```lua
["activity.retry_policy"] = {
    initial_interval = 1000,         -- ms before first retry
    backoff_coefficient = 2.0,       -- multiplier for each retry
    maximum_interval = 300000,       -- max interval between retries (ms)
    maximum_attempts = 10,           -- max retry attempts (0 = unlimited)
    non_retryable_error_types = {    -- errors that skip retries
        "Invalid",
        "PermissionDenied"
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

액티비티는 `local` 필드를 허용합니다:

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

현재 `local: true`는 파싱되지만 일반 액티비티와 동일하게 동작합니다: 표준 액티비티 경로를 통해 등록되고 실행됩니다. 아직 별도의 로컬 액티비티 실행 경로가 없으므로 지연 시간, 태스크 큐 동작, heartbeat에 영향을 주지 않습니다.

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
local pid, err = spawner:spawn("app:order_workflow", "app:worker", order)
if err then
    return nil, err
end
```

```lua
-- Activity reads context
local ctx = require("ctx")

local function process_order(input)
    local user_id, user_err = ctx.get("user_id")   -- "user-1"
    if user_err then return nil, user_err end
    local tenant, tenant_err = ctx.get("tenant")   -- "tenant-1"
    if tenant_err then return nil, tenant_err end
    -- use context for authorization, logging, etc.
end
```

워크플로우 내에서 `funcs.new():with_context()`로 호출된 액티비티에도 컨텍스트가 전파됩니다:

```lua
-- Inside workflow
local executor = funcs.new():with_context({trace_id = "abc-123"})
local result, err = executor:call("app:charge_payment", input)
```

### 보안 컨텍스트

보안 컨텍스트 하에서 스케줄된 액티비티는 액티비티 ID를 대상(audience)으로 하는 서명된 `wippy-security` 헤더를 받습니다. 워커는 서명과 대상을 검증한 뒤, 액티비티 함수가 실행되기 전에 전파된 `ctx` 값과 보안 페이로드를 새 프레임에 병합합니다.

이 병합은 전부 아니면 전무이며 **실패하면 액티비티에 치명적입니다**: 액티비티는 코드가 실행되기 전에 에러를 반환하므로, 부분적인 컨텍스트나 검증되지 않은 액터로는 절대 실행되지 않습니다. 병합은 서명이나 대상이 검증되지 않을 때, 엔벨로프가 일관되지 않을 때(스코프 없는 액터, 또는 액터 없는 정책), 또는 엔벨로프에 지명된 정책이 로컬 보안 레지스트리에서 해석되지 않을 때 실패합니다 — 마지막이 운영상 흔한 원인입니다: 워커의 배포에 호출자가 가진 정책 엔트리가 없는 경우입니다.

워커는 자신이 참조하는 `temporal.client` 엔트리에서 서명 및 검증 키를 가져옵니다. [보안 컨텍스트 전파](temporal/overview.md#security-context-propagation)를 참조하세요.

## 에러 처리

표준 Lua 패턴으로 에러를 반환합니다:

```lua
local errors = require("errors")

-- Replace this mapping with the payment provider's documented error contract.
local function payment_error(status)
    if status == 408 then
        return errors.new({kind = errors.TIMEOUT, message = "payment provider timed out", retryable = true})
    elseif status == 429 then
        return errors.new({kind = errors.RATE_LIMITED, message = "payment provider rate limited the request", retryable = true})
    elseif status >= 500 then
        return errors.new({kind = errors.UNAVAILABLE, message = "payment provider is unavailable", retryable = true})
    end
    return errors.new({kind = errors.INVALID, message = "payment request was rejected", retryable = false})
end

local function charge(input)
    if not input.amount or input.amount <= 0 then
        return nil, errors.new({ kind = errors.INVALID, message = "amount must be positive" })
    end

    local response, err = http.post(url, options)
    if err then
        return nil, errors.wrap(err, "payment API failed")
    end

    if response:status() >= 400 then
        return nil, errors.new({ kind = errors.INVALID, message = "payment declined" })
    end

    return json.decode(response.body)
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
| 애플리케이션 에러 | 액티비티가 반환한 것 | 반환된 에러에서 상속됨 | `return nil, err`로 액티비티 코드가 반환한 에러 |
| 런타임 크래시 | `Internal` | false | 액티비티의 처리되지 않은 Lua 에러 |
| 누락된 액티비티 | `NotFound` | false | 워커에 등록되지 않은 액티비티 |
| 타임아웃 | `Timeout` | false | 설정된 타임아웃을 초과한 액티비티 |
| 보안 검증 | `Internal` | true | 전파된 보안 헤더의 서명, 대상 또는 엔벨로프 검사 실패 |
| 보안 정책 누락 | `Internal` | true | 보안 엔벨로프에 지명된 정책이 이 워커에서 해석되지 않음 |

두 보안 실패 모두 액티비티 함수가 실행되기 전 컨텍스트 병합 중에 발생합니다. 재시도 불가로 표시되지 않으므로 액티비티 재시도 정책이 계속 재시도하지만, 잘못된 서명이나 누락된 정책 엔트리는 시도마다 달라지지 않으므로 재시도는 도움이 되지 않습니다. 빠르게 실패시키려는 액티비티에는 `maximum_attempts`에 상한을 두고, 액티비티 로그 출력 없이 반복되는 `Internal` 실패는 액티비티 자체의 결함이 아니라 컨텍스트 병합 실패로 읽으세요.

```lua
local executor = funcs.new():with_options({
    ["activity.retry_policy"] = {maximum_attempts = 1}
})

local result, err = executor:call("app:missing_activity", input)
if err then
    print(err:kind())      -- "NotFound"
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
