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

워크플로우에서 `funcs` 모듈을 사용하세요:

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

### 액티비티 옵션

타임아웃과 재시도 동작 설정:

```lua
local funcs = require("funcs")

local executor = funcs.new()
executor = executor:with_options({
    start_to_close_timeout = "30s",
    schedule_to_close_timeout = "5m",
    heartbeat_timeout = "10s",
    retry_policy = {
        max_attempts = 3,
        initial_interval = "1s",
        backoff_coefficient = 2.0,
        max_interval = "1m"
    }
})

local result, err = executor:call("app:charge_payment", input)
```

## 로컬 액티비티

로컬 액티비티는 별도의 태스크 큐 폴링 없이 워크플로우 워커 프로세스에서 실행됩니다. 빠르고 짧은 작업에 사용하세요:

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
- 낮은 지연 시간
- 별도의 태스크 큐 오버헤드 없음
- 짧은 실행 시간으로 제한
- 하트비팅 없음

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

## 에러 처리

표준 Lua 패턴으로 에러 반환:

```lua
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

## 프로세스 액티비티

`process.lua` 엔트리도 액티비티로 등록할 수 있습니다:

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
