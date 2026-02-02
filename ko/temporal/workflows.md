# 워크플로우

워크플로우는 액티비티를 오케스트레이션하고 장애 및 재시작에도 상태를 유지하는 내구성 있는 함수입니다. `workflow.lua` 엔트리 종류를 사용하여 정의됩니다.

## 정의

```yaml
- name: order_workflow
  kind: workflow.lua
  source: file://order_workflow.lua
  method: main
  modules:
    - funcs
    - time
    - workflow
  meta:
    temporal:
      workflow:
        worker: app:worker
```

### 메타데이터 필드

| 필드 | 필수 | 설명 |
|-------|----------|-------------|
| `worker` | 예 | `temporal.worker` 엔트리 참조 |
| `name` | 아니오 | 커스텀 워크플로우 이름 (기본값: 엔트리 ID) |

## 기본 구현

```lua
local funcs = require("funcs")
local time = require("time")

local function main(order)
    -- 액티비티 호출
    local payment, err = funcs.call("app:charge_payment", {
        amount = order.total,
        customer = order.customer_id
    })
    if err then
        return {status = "failed", error = tostring(err)}
    end

    -- 내구성 있는 슬립 (재시작에도 유지)
    time.sleep("1h")

    -- 다른 액티비티
    local shipment, err = funcs.call("app:ship_order", {
        order_id = order.id,
        address = order.shipping_address
    })
    if err then
        funcs.call("app:refund_payment", payment.id)
        return {status = "failed", error = tostring(err)}
    end

    return {
        status = "completed",
        payment_id = payment.id,
        tracking = shipment.tracking_number
    }
end

return { main = main }
```

## 워크플로우 모듈

`workflow` 모듈은 워크플로우별 작업을 제공합니다.

### workflow.info()

워크플로우 실행 정보 가져오기:

```lua
local workflow = require("workflow")

local info = workflow.info()
print(info.workflow_id)    -- 워크플로우 실행 ID
print(info.run_id)         -- 현재 실행 ID
print(info.workflow_type)  -- 워크플로우 타입 이름
print(info.task_queue)     -- 태스크 큐 이름
print(info.namespace)      -- Temporal 네임스페이스
print(info.attempt)        -- 현재 시도 번호
print(info.history_length) -- 히스토리 이벤트 수
print(info.history_size)   -- 히스토리 크기 (바이트)
```

### workflow.version()

결정론적 버전닝으로 코드 변경 처리:

```lua
local version = workflow.version("payment-v2", 1, 2)

if version == 1 then
    -- 이전 동작 (기존 실행용)
    result = funcs.call("app:old_payment", input)
else
    -- 새 동작 (버전 2)
    result = funcs.call("app:new_payment", input)
end
```

파라미터:
- `change_id` - 이 변경의 고유 식별자
- `min_supported` - 지원되는 최소 버전
- `max_supported` - 최대 (현재) 버전

### workflow.attrs()

검색 속성과 메모 업데이트:

```lua
workflow.attrs({
    search = {
        status = "processing",
        customer_id = order.customer_id,
        order_total = order.total
    },
    memo = {
        notes = "Priority customer",
        source = "web"
    }
})
```

### workflow.history_length()

워크플로우 히스토리의 이벤트 수 가져오기:

```lua
local length = workflow.history_length()
if length > 10000 then
    -- continue-as-new 고려
end
```

### workflow.history_size()

워크플로우 히스토리 크기 (바이트) 가져오기:

```lua
local size = workflow.history_size()
```

### workflow.exec()

자식 워크플로우 실행:

```lua
local result, err = workflow.exec("app:child_workflow", input_data)
```

## 시그널

프로세스 인박스를 사용하여 실행 중인 워크플로우에 데이터 전송.

**시그널 전송:**

```lua
process.send(workflow_pid, "approve", {
    approved_by = "admin",
    comment = "Looks good"
})
```

**워크플로우에서 시그널 수신:**

```lua
local function main(order)
    local inbox = process.inbox()

    while true do
        local msg = inbox:receive()
        local topic = msg:topic()

        if topic == "approve" then
            local data = msg:payload():data()
            break
        elseif topic == "cancel" then
            local data = msg:payload():data()
            return {status = "cancelled", reason = data.reason}
        end
    end

    return process_order(order)
end
```

## 타이머

내구성 있는 타이머는 재시작에도 유지됩니다:

```lua
local time = require("time")

time.sleep("24h")
time.sleep("5m")
time.sleep("30s")
```

## 결정론

워크플로우 코드는 결정론적이어야 합니다. 같은 입력은 같은 명령 시퀀스를 생성해야 합니다.

### 해야 할 것

```lua
-- 현재 시간 컨텍스트를 위해 워크플로우 정보 사용
local info = workflow.info()

-- 내구성 있는 슬립 사용
time.sleep("1h")

-- I/O에 액티비티 사용
local data = funcs.call("app:fetch_data", id)

-- 코드 변경에 버전닝 사용
local v = workflow.version("change-1", 1, 2)
```

### 하지 말아야 할 것

```lua
-- 벽시계 시간 사용 금지
local now = os.time()  -- 비결정론적

-- 직접 랜덤 사용 금지
local r = math.random()  -- 비결정론적

-- 워크플로우 코드에서 I/O 금지
local file = io.open("data.txt")  -- 비결정론적

-- 글로벌 가변 상태 사용 금지
counter = counter + 1  -- 리플레이에서 비결정론적
```

## 에러 처리

```lua
local function main(order)
    local result, err = funcs.call("app:risky_activity", order)

    if err then
        -- 로그 및 보상
        funcs.call("app:send_alert", {
            error = tostring(err),
            order_id = order.id
        })

        return {status = "failed", error = tostring(err)}
    end

    return {status = "completed", result = result}
end
```

## 보상 패턴 (Saga)

```lua
local function main(order)
    local compensations = {}

    -- 1단계: 재고 예약
    local reservation, err = funcs.call("app:reserve_inventory", order.items)
    if err then
        return {status = "failed", step = "inventory", error = tostring(err)}
    end
    table.insert(compensations, 1, {
        action = "app:release_inventory",
        args = reservation.id
    })

    -- 2단계: 결제 청구
    local payment, err = funcs.call("app:charge_payment", order.payment)
    if err then
        run_compensations(compensations)
        return {status = "failed", step = "payment", error = tostring(err)}
    end
    table.insert(compensations, 1, {
        action = "app:refund_payment",
        args = payment.id
    })

    -- 3단계: 주문 배송
    local shipment, err = funcs.call("app:ship_order", order.shipping)
    if err then
        run_compensations(compensations)
        return {status = "failed", step = "shipping", error = tostring(err)}
    end

    return {status = "completed", tracking = shipment.tracking}
end

local function run_compensations(compensations)
    for _, comp in ipairs(compensations) do
        funcs.call(comp.action, comp.args)
    end
end
```

## 워크플로우 스폰

모든 코드에서 워크플로우 시작:

```lua
local pid, err = process.spawn(
    "app:order_workflow",    -- 워크플로우 엔트리
    "app:worker",            -- temporal 워커
    {order_id = "123"}       -- 입력
)
```

HTTP 핸들러에서:

```lua
local function handler()
    local req = http.request()
    local order = json.decode(req:body())

    local pid, err = process.spawn(
        "app:order_workflow",
        "app:worker",
        order
    )

    if err then
        return http.response():status(500):json({error = tostring(err)})
    end

    return http.response():json({
        workflow_id = tostring(pid),
        status = "started"
    })
end
```

## 참고

- [개요](temporal/overview.md) - 설정
- [액티비티](temporal/activities.md) - 액티비티 정의
- [프로세스](lua/core/process.md) - 프로세스 관리
- [함수](lua/core/funcs.md) - 함수 호출
