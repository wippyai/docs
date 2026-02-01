# 워크플로우

워크플로우는 크래시와 재시작을 견디는 내구성 있고 장기 실행되는 작업입니다. 결제, 주문 이행, 다단계 승인과 같은 중요한 비즈니스 프로세스에 대한 신뢰성 보장을 제공합니다.

## 왜 워크플로우인가?

함수는 일시적입니다. 호스트가 크래시하면 진행 중인 작업이 손실됩니다. 워크플로우는 상태를 영속화합니다:

| 측면 | 함수 | 워크플로우 |
|--------|-----------|-----------|
| 상태 | 메모리 내 | 영속화됨 |
| 크래시 | 작업 손실 | 재개 |
| 기간 | 초에서 분 | 시간에서 월 |
| 완료 | 최선의 노력 | 보장됨 |

## 워크플로우 작동 방식

워크플로우 코드는 일반 Lua 코드처럼 보입니다:

```lua
local funcs = require("funcs")
local time = require("time")

local result = funcs.call("app.api:charge_card", payment)
time.sleep("24h")
local status = funcs.call("app.api:check_status", result.id)

if status == "failed" then
    funcs.call("app.api:refund", result.id)
end
```

워크플로우 엔진은 호출을 가로채고 결과를 기록합니다. 프로세스가 크래시하면 기록된 히스토리에서 실행이 리플레이됩니다. 같은 코드로 같은 결과를 얻습니다.

<note>
Wippy는 결정론을 자동으로 처리합니다. <code>funcs.call()</code>, <code>time.sleep()</code>, <code>uuid.v4()</code>, <code>time.now()</code> 같은 작업이 가로채져 결과가 기록됩니다. 리플레이 시에는 재실행하지 않고 기록된 값이 반환됩니다.
</note>

## 워크플로우 패턴

### Saga 패턴

실패 시 보상:

```lua
local funcs = require("funcs")

local inventory = funcs.call("app.inventory:reserve", items)
if inventory.error then
    return nil, inventory.error
end

local payment = funcs.call("app.payments:charge", amount)
if payment.error then
    funcs.call("app.inventory:release", inventory.id)
    return nil, payment.error
end

local shipping = funcs.call("app.shipping:create", order)
if shipping.error then
    funcs.call("app.payments:refund", payment.id)
    funcs.call("app.inventory:release", inventory.id)
    return nil, shipping.error
end

return {inventory = inventory, payment = payment, shipping = shipping}
```

### 시그널 대기

외부 이벤트(승인 결정, 웹훅, 사용자 액션) 대기:

```lua
local funcs = require("funcs")

funcs.call("app.approvals:submit", request)

local inbox = process.inbox()
local msg = inbox:receive()  -- 시그널이 도착할 때까지 블록

if msg.approved then
    funcs.call("app.orders:fulfill", request.order_id)
else
    funcs.call("app.notifications:send_rejection", request)
end
```

## 언제 무엇을 사용할까

| 사용 사례 | 선택 |
|----------|--------|
| HTTP 요청 처리 | 함수 |
| 데이터 변환 | 함수 |
| 백그라운드 작업 | 프로세스 |
| 사용자 세션 상태 | 프로세스 |
| 실시간 메시징 | 프로세스 |
| 결제 처리 | 워크플로우 |
| 주문 이행 | 워크플로우 |
| 다일 승인 | 워크플로우 |

## 워크플로우 시작

워크플로우는 프로세스와 같은 방식으로 생성됩니다. `process.spawn()`을 다른 호스트와 함께 사용합니다:

```lua
-- temporal 워커에서 워크플로우 생성
local pid = process.spawn("app.workflows:order_processor", "app:temporal_worker", order_data)

-- 워크플로우에 시그널 보내기
process.send(pid, "update", {status = "approved"})
```

호출자 관점에서 API는 동일합니다. 차이점은 호스트입니다. 워크플로우는 `process.host` 대신 `temporal.worker`에서 실행됩니다.

<tip>
워크플로우가 <code>process.spawn()</code>으로 자식을 생성하면, 같은 프로바이더의 자식 워크플로우가 되어 내구성 보장이 유지됩니다.
</tip>

## 실패와 슈퍼비전

프로세스는 `process.service`를 사용하여 감독되는 서비스로 실행할 수 있습니다:

```yaml
# 프로세스 정의
- name: session_handler
  kind: process.lua
  source: file://session_handler.lua
  method: main

# 프로세스를 래핑하는 감독 서비스
- name: session_manager
  kind: process.service
  process: app:session_handler
  host: app:processes
  lifecycle:
    auto_start: true
    restart:
      max_attempts: 10
```

워크플로우는 슈퍼비전 트리를 사용하지 않습니다. 워크플로우 프로바이더(Temporal)가 자동으로 관리하며, 영속성, 재시도, 복구를 모두 처리합니다.

## 설정

워크플로우 정의 (동적으로 생성됨):

```yaml
- name: order_processor
  kind: workflow.lua
  source: file://order_processor.lua
  method: main
  modules:
    - funcs
    - time
```

워크플로우 프로바이더:

```yaml
- name: temporal_worker
  kind: temporal.worker
  client: app:temporal_client
  task_queue: "orders"
  lifecycle:
    auto_start: true
```

프로덕션 워크플로우 인프라는 [Temporal](https://temporal.io)을 참조하세요.

## 참고

- [함수](concept-functions.md) - 상태 비저장 요청 처리
- [프로세스 모델](concept-process-model.md) - 상태 저장 백그라운드 작업
- [슈퍼비전](guide-supervision.md) - 프로세스 재시작 정책
