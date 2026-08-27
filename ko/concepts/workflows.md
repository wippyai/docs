---
title: "워크플로"
description: "Wippy가 장기 실행 워크플로를 영속화하고 실행을 재생하며 신호를 받고 실패에서 복구하는 방법입니다."
---

# 워크플로

워크플로는 장기 실행 작업의 상태를 영속화하여 충돌이나 재시작 후에도 실행을 복구할 수 있게 합니다. 결제, 주문 이행, 여러 단계 승인 같은 프로세스에 적합합니다.

## 워크플로를 사용하는 이유

함수는 진행 중인 상태를 메모리에 보관하지만 워크플로는 실행 상태를 영속화합니다.

| 측면 | 함수 | 워크플로 |
|--------|-----------|-----------|
| 상태 | 호출 로컬 | 영속 기록에서 재구성 |
| 워커 충돌 | 진행 중인 호출 실패 | 기록된 이력에서 재생 |
| 실행 시간 | 수초~수분 | 수시간~수개월 |
| 애플리케이션 실패 | 호출자에게 반환 | 제공자 정책에 따라 종료 또는 재시도 |

## 워크플로 작동 방식

워크플로 코드는 일반 Lua 코드처럼 보입니다.

```lua
local funcs = require("funcs")
local time = require("time")

local result, err = funcs.call("app.api:charge_card", payment)
if err then return nil, err end

time.sleep("24h")

local status, err = funcs.call("app.api:check_status", result.id)
if err then return nil, err end

if status == "failed" then
    local _, refund_err = funcs.call("app.api:refund", result.id)
    if refund_err then return nil, refund_err end
end

return status
```

워크플로 엔진은 호출을 가로채 결과를 기록합니다. 충돌 후에는 기록된 이력에서 실행을 재생합니다.

워크플로 안에서 각 `funcs.call()` 대상은 Temporal 액티비티로 실행됩니다. 대상 `function.*` 엔트리는 `meta.temporal.activity.worker`를 통해 워커에 등록되어야 합니다. 등록되지 않은 엔트리는 워크플로에서 사용할 수 없습니다. `process.*` 액티비티 대상에는 Temporal 워커가 사용하는 함수 레지스트리에 등록되도록 `meta.options.default_host` 또는 레거시 `meta.default_host`도 필요합니다. 함수 액티비티 예제와 액티비티 옵션은 [액티비티](../temporal/activities.md)를 참조하세요.

<note>
워크플로 작성자는 여전히 결정적인 코드를 작성해야 합니다. Wippy는 워크플로 모듈을 Deterministic 또는 Workflow로 분류된 모듈로 제한하고 지원되는 연산에 재생 안전 구현을 제공합니다. <code>funcs.call()</code>은 기록된 액티비티를 실행하고, <code>time.sleep()</code>은 워크플로 타이머를 사용하며, <code>uuid.v4()</code>는 부작용을 기록하고, <code>time.now()</code>는 워크플로의 결정적 시간 참조를 읽습니다.
</note>

## 워크플로 패턴

### 사가 패턴

실패 시 보상 작업을 수행합니다.

```lua
local funcs = require("funcs")

local inventory, err = funcs.call("app.inventory:reserve", items)
if err then return nil, err end

local payment, err = funcs.call("app.payments:charge", amount)
if err then
    local _, compensation_err = funcs.call("app.inventory:release", inventory.id)
    return nil, compensation_err or err
end

local shipping, err = funcs.call("app.shipping:create", order)
if err then
    local _, refund_err = funcs.call("app.payments:refund", payment.id)
    local _, release_err = funcs.call("app.inventory:release", inventory.id)
    return nil, refund_err or release_err or err
end

return {inventory = inventory, payment = payment, shipping = shipping}
```

### 신호 기다리기

승인 결정, 웹훅, 사용자 작업 같은 외부 이벤트를 기다립니다.

```lua
local funcs = require("funcs")

local _, err = funcs.call("app.approvals:submit", request)
if err then return nil, err end

local inbox = process.inbox()
local msg, open = inbox:receive()  -- blocks until signal arrives
if not open then return nil, errors.new("workflow inbox closed") end

local decision, payload_err = msg:payload():data()
if payload_err then return nil, payload_err end

if decision.approved then
    return funcs.call("app.orders:fulfill", request.order_id)
else
    return funcs.call("app.notifications:send_rejection", request)
end
```

## 컴퓨팅 모델 선택

| 사용 사례 | 선택 |
|----------|--------|
| HTTP 요청 처리 | 함수 |
| 데이터 변환 | 함수 |
| 백그라운드 작업 | 프로세스 |
| 사용자 세션 상태 | 프로세스 |
| 실시간 메시징 | 프로세스 |
| 결제 처리 | 워크플로 |
| 주문 이행 | 워크플로 |
| 여러 날에 걸친 승인 | 워크플로 |

## 워크플로 시작

워크플로 호스트와 함께 `process.spawn()`을 사용합니다.

```lua
-- Spawn workflow on temporal worker
local pid, err = process.spawn("app.workflows:order_processor", "app:temporal_worker", order_data)
if err then return nil, err end

-- Send signals to workflow
local ok, err = process.send(pid, "update", {status = "approved"})
if err then return nil, err end
return ok
```

호출자는 같은 생성 API를 사용합니다. 호스트가 엔트리를 `temporal.worker`에서 실행할지 `process.host`에서 실행할지 결정합니다. 영속 이력과 재생은 Temporal 호스트 경로에만 적용됩니다. 일반 프로세스 호스트를 통해 실행한 워크플로 엔트리는 메모리 프로세스 의미 체계를 가지며 Temporal 내구성을 얻지 않습니다.

<tip>
워크플로가 <code>process.spawn()</code>으로 자식을 생성하면 같은 제공자의 자식 워크플로가 되어 내구성 보장을 유지합니다.
</tip>

## 실패와 감독

프로세스는 `process.service`를 사용해 감독되는 서비스로 실행할 수 있습니다.

```yaml
# Process definition
- name: session_handler
  kind: process.lua
  source: file://session_handler.lua
  method: main

# Supervised service wrapping the process
- name: session_manager
  kind: process.service
  process: app:session_handler
  host: app:processes
  lifecycle:
    auto_start: true
    restart:
      max_attempts: 10
```

워크플로는 프로세스 감독 트리를 사용하지 않습니다. 워크플로 제공자가 영속성과 복구를 관리하고, 애플리케이션 수준 재시도는 구성된 워크플로 및 액티비티 정책을 따릅니다.

## 구성

동적으로 생성되는 워크플로 정의:

```yaml
- name: order_processor
  kind: workflow.lua
  source: file://order_processor.lua
  method: main
  meta:
    temporal:
      workflow:
        worker: app:temporal_worker
  modules:
    - funcs
    - time
```

`funcs.call()`을 통해 호출되는 모든 함수 또는 프로세스도 액티비티 워커를 선언합니다. 예:

```yaml
- name: charge_card
  kind: function.lua
  source: file://charge_card.lua
  method: main
  meta:
    temporal:
      activity:
        worker: app:temporal_worker
```

워크플로 제공자:

```yaml
- name: temporal_worker
  kind: temporal.worker
  client: app:temporal_client
  task_queue: "orders"
  lifecycle:
    auto_start: true
```

프로덕션 워크플로 인프라는 [Temporal](https://temporal.io)을 참조하세요.

## 함께 보기

- [함수](./functions.md) — 요청 범위 호출
- [프로세스 모델](./process-model.md) — 상태를 갖는 백그라운드 작업
- [감독](../guides/supervision.md) — 프로세스 재시작 정책
