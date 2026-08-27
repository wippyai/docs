---
title: "워크플로우"
description: "workflow.lua 엔트리, 액티비티, 시그널, 자식 워크플로우, 타이머, 리플레이 안전 작업으로 내구성 있는 Temporal 워크플로우를 정의합니다."
---

# 워크플로우

`workflow.lua` 엔트리는 액티비티를 오케스트레이션하고 장애와 재시작에도 상태를 유지하는 내구성 있는 Temporal 워크플로우를 정의합니다.

이 페이지는 부분적인 사용 예제를 포함한 API 레퍼런스입니다. 엔트리 선언, 워커 등록, 액티비티 구현, 보안 정책, 주변 애플리케이션 데이터는 특정 계약을 설명하는 데 필요한 경우에만 표시합니다.

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
|-------|------|------|
| `worker` | 예 | `temporal.worker` 엔트리 참조 |
| `name` | 아니오 | 커스텀 워크플로우 타입 이름 (기본값: 엔트리 ID) |

## 기본 구현

```lua
local funcs = require("funcs")
local time = require("time")

local function main(order)
    local payment, err = funcs.call("app:charge_payment", {
        amount = order.total,
        customer = order.customer_id
    })
    if err then
        return {status = "failed", error = tostring(err)}
    end

    time.sleep("1h")

    local shipment, err = funcs.call("app:ship_order", {
        order_id = order.id,
        address = order.shipping_address
    })
    if err then
        local _, refund_err = funcs.call("app:refund_payment", payment.id)
        if refund_err then
            return {
                status = "failed",
                error = tostring(err),
                compensation_error = tostring(refund_err)
            }
        end
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

## workflow 모듈

`workflow` 모듈은 워크플로우별 작업을 제공합니다.

### workflow.info()

워크플로우 실행 정보 가져오기:

```lua
local workflow = require("workflow")

local info, info_err = workflow.info()
if info_err then return nil, info_err end
print(info.workflow_id)    -- Workflow execution ID
print(info.run_id)         -- Current run ID
print(info.workflow_type)  -- Workflow type name
print(info.task_queue)     -- Task queue name
print(info.namespace)      -- Temporal namespace
print(info.attempt)        -- Current attempt number
print(info.history_length) -- Number of history events
print(info.history_size)   -- History size in bytes
```

### workflow.exec()

자식 워크플로우를 동기적으로 실행하고 결과 대기:

```lua
local result, err = workflow.exec("app:child_workflow", input_data)
if err then
    return nil, err
end
```

부모가 자식 결과를 인라인으로 기다려야 할 때 이 형식을 사용합니다.

### workflow.version()

결정론적 버저닝으로 코드 변경 처리:

```lua
local version, err = workflow.version("payment-v2", 1, 2)
if err then
    return nil, err
end

if version == 1 then
    return funcs.call("app:old_payment", input)
else
    return funcs.call("app:new_payment", input)
end
```

파라미터:
- `change_id` - 이 변경에 대한 고유 식별자
- `min_supported` - 최소 지원 버전
- `max_supported` - 최대 (현재) 버전

버전 번호는 워크플로우 실행당 결정론적입니다. 진행 중인 기존 워크플로우는 기록된 버전을 계속 사용하고, 새 워크플로우는 `max_supported`를 사용합니다.

### workflow.attrs()

검색 속성 및 메모 업데이트:

```lua
local updated, err = workflow.attrs({
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
if err then
    return nil, err
end
```

검색 속성은 인덱싱되고 Temporal 가시성 API를 통해 쿼리할 수 있습니다. 메모는 워크플로우에 첨부된 임의의 비인덱스 데이터입니다.

### workflow.history_length() / workflow.history_size()

워크플로우 히스토리 증가 모니터링:

```lua
local length, length_err = workflow.history_length()
if length_err then return nil, length_err end
local size, size_err = workflow.history_size()
if size_err then return nil, size_err end

if length > 10000 then
    -- Consider continue-as-new to reset history
end
```

## 워크플로우 시작

### 기본 스폰

`process.spawn()`을 사용하여 어떤 코드에서든 워크플로우 시작:

```lua
local pid, err = process.spawn(
    "app:order_workflow",    -- workflow entry
    "app:worker",            -- temporal worker
    {order_id = "123"}       -- input
)
if err then
    return nil, err
end
```

호스트 파라미터는 temporal worker입니다(프로세스 호스트가 아님). 워크플로우는 Temporal 인프라에서 내구적으로 실행됩니다.

### 모니터링과 함께 스폰

완료될 때 EXIT 이벤트를 수신하기 위해 워크플로우 모니터링:

```lua
local pid, err = process.spawn_monitored(
    "app:order_workflow",
    "app:worker",
    {order_id = "123"}
)
if err then
    return nil, err
end

local events = process.events()
local event, open = events:receive()
if not open then
    return nil, errors.new({kind = errors.INTERNAL, message = "process event channel closed"})
end

if event.kind == process.event.EXIT then
    local result = event.result.value
    local error = event.result.error
end
```

### 이름과 함께 스폰

멱등 시작을 위해 워크플로우에 이름 할당:

```lua
local spawner = process
    .with_options({})
    :with_name("order-" .. order.id)

local pid, err = spawner:spawn_monitored(
    "app:order_workflow",
    "app:worker",
    {order_id = order.id}
)
if err then
    return nil, err
end
```

이름이 제공되면 Temporal이 이를 사용하여 워크플로우 시작을 중복 제거합니다. 워크플로우가 실행 중인 동안 같은 이름으로 스폰하면 기본적으로 기존 워크플로우의 PID를 반환합니다.

### 명시적 워크플로우 ID로 스폰

특정 Temporal 워크플로우 ID 설정:

```lua
local spawner = process
    .with_options({
        ["workflow.id"] = "order-" .. order.id,
    })

local pid, err = spawner:spawn_monitored(
    "app:order_workflow",
    "app:worker",
    order
)
if err then
    return nil, err
end
```

### ID 충돌 정책

이미 존재하는 ID로 워크플로우를 스폰할 때 동작 제어:

```lua
-- Fail if workflow already exists
local spawner = process
    .with_options({
        ["workflow.id"] = "order-123",
        ["workflow.id_conflict_policy"] = "fail",
    })

local pid, err = spawner:spawn("app:order_workflow", "app:worker", order)
if err then
    -- Workflow already running with this ID
end
```

```lua
-- Error when already started (alternative approach)
local spawner = process
    .with_options({
        ["workflow.id"] = "order-123",
        ["workflow.execution_error_when_already_started"] = true,
    })

local pid, err = spawner:spawn("app:order_workflow", "app:worker", order)
if err then return nil, err end
```

```lua
-- Reuse existing (default behavior with explicit ID)
local spawner = process
    .with_options({
        ["workflow.id"] = "order-123",
    })

local pid, err = spawner:spawn("app:order_workflow", "app:worker", order)
if err then return nil, err end
-- Returns existing workflow PID if already running
```

| 정책 | 동작 |
|--------|----------|
| `"use_existing"` | 기존 워크플로우 PID 반환 (명시적 ID의 기본값) |
| `"fail"` | 워크플로우가 존재하면 오류 반환 |
| `"terminate_existing"` | 기존 종료 후 새로 시작 |

### 워크플로우 시작 옵션

`with_options()`를 통해 Temporal 워크플로우 옵션 전달:

```lua
local spawner = process.with_options({
    ["workflow.id"] = "order-123",
    ["workflow.execution_timeout"] = "24h",
    ["workflow.run_timeout"] = "1h",
    ["workflow.task_timeout"] = "30s",
    ["workflow.id_conflict_policy"] = "fail",
    ["workflow.retry_policy"] = {
        initial_interval = 1000,
        backoff_coefficient = 2.0,
        maximum_interval = 300000,
        maximum_attempts = 3,
    },
    ["workflow.cron_schedule"] = "0 */6 * * *",
    ["workflow.search_attributes"] = {
        customer_id = "cust-123"
    },
    ["workflow.memo"] = {
        source = "api"
    },
    ["workflow.start_delay"] = "5m",
    ["workflow.parent_close_policy"] = "terminate",
})
```

#### 옵션 레퍼런스

| 옵션 | 타입 | 설명 |
|--------|------|------|
| `workflow.id` | string | 명시적 워크플로우 실행 ID |
| `workflow.task_queue` | string | 태스크 큐 오버라이드 |
| `workflow.execution_timeout` | duration | 전체 워크플로우 실행 타임아웃 |
| `workflow.run_timeout` | duration | 단일 실행 타임아웃 |
| `workflow.task_timeout` | duration | 워크플로우 태스크 처리 타임아웃 |
| `workflow.id_conflict_policy` | string | `use_existing`, `fail`, `terminate_existing` |
| `workflow.id_reuse_policy` | string | `allow_duplicate`, `allow_duplicate_failed_only`, `reject_duplicate` |
| `workflow.execution_error_when_already_started` | boolean | 워크플로우가 이미 실행 중이면 오류 |
| `workflow.retry_policy` | table | 재시도 정책 (아래 참조) |
| `workflow.cron_schedule` | string | 반복 워크플로우를 위한 cron 표현식 |
| `workflow.memo` | table | 비인덱스 워크플로우 메타데이터 |
| `workflow.search_attributes` | table | 인덱싱된 쿼리 가능 속성 |
| `workflow.enable_eager_start` | boolean | 즉시 실행 시작 |
| `workflow.start_delay` | duration | 워크플로우 시작 전 지연 |
| `workflow.summary` | string | Temporal 워크플로우 메타데이터에 표시되는 요약 |
| `workflow.details` | string | Temporal 워크플로우 메타데이터에 표시되는 세부 정보 |
| `workflow.versioning_override` | string or table | 자동 업그레이드 모드 또는 고정된 배포/빌드 버전 |
| `workflow.priority` | table | 우선순위 키와 선택적 공정성 설정 |
| `workflow.parent_close_policy` | string | 부모 종료 시 자식 동작 |
| `workflow.wait_for_cancellation` | boolean | 취소가 완료될 때까지 대기 |
| `workflow.namespace` | string | Temporal 네임스페이스 오버라이드 |
| `workflow.versioning_intent` | string or number | 자식 워크플로우의 워커 버전 관리 의도 |
| `workflow.name` | string | 자식 워크플로우 타입 오버라이드 |

Duration 값은 문자열(`"5s"`, `"10m"`, `"1h"`) 또는 숫자(밀리초)를 허용합니다.

기존 `temporal.workflow.*` 별칭도 호환성을 위해 계속 지원됩니다. 새 코드에는 위에 표시된 표준 `workflow.*` 이름을 사용하세요.

고정된 버전 오버라이드에는 모드와 배포 버전이 모두 필요합니다.

```lua
["workflow.versioning_override"] = {
    mode = "pinned",
    version = {
        deployment_name = "orders",
        build_id = "orders-v2",
    },
}
```

자동 업그레이드 오버라이드에는 문자열 `"auto_upgrade"`를 사용하세요.

#### 부모 종료 정책

부모가 종료될 때 자식 워크플로우에 발생하는 것을 제어합니다:

| 정책 | 동작 |
|--------|----------|
| `"terminate"` | 자식 워크플로우 종료 |
| `"abandon"` | 자식이 독립적으로 계속 실행 |
| `"request_cancel"` | 자식에게 취소 요청 전송 |

### 시작 메시지

워크플로우 시작과 함께 전송할 시그널을 큐에 추가합니다. 비어 있지 않은 첫 시작 메시지는 시작과 원자적으로 전송됩니다. 나머지 시작 메시지는 워크플로우가 시작된 뒤 빌더 순서대로 전송되지만, 다른 호출자가 동시에 전송한 시그널과 섞일 수 있습니다.

```lua
local spawner = process
    .with_options({})
    :with_name("counter-workflow")
    :with_message("increment", {amount = 2})
    :with_message("increment", {amount = 1})
    :with_message("increment", {amount = 4})

local pid, err = spawner:spawn_monitored(
    "app:counter_workflow",
    "app:worker",
    {initial = 0}
)
if err then return nil, err end
```

`use_existing` 충돌 정책에서는 두 번째 스폰이 기존 워크플로우로 해석될 때도 시작 메시지가 전달됩니다.

```lua
-- First spawn starts the workflow with initial messages
local first = process
    .with_options({})
    :with_name("my-counter")
    :with_message("increment", {amount = 3})

local pid, first_err = first:spawn("app:counter_workflow", "app:worker", {initial = 0})
if first_err then return nil, first_err end

-- Second spawn reuses existing workflow and delivers new messages
local second = process
    .with_options({})
    :with_name("my-counter")
    :with_message("increment", {amount = 2})

local pid2, second_err = second:spawn("app:counter_workflow", "app:worker", {initial = 999})
if second_err then return nil, second_err end
-- pid2 == pid (same workflow), input {initial = 999} is ignored
-- But the increment message with amount=2 is delivered
```

### 컨텍스트 전파

워크플로우와 그 액티비티 내에서 접근 가능한 컨텍스트 값 전달:

```lua
local spawner = process.with_context({
    user_id = "user-1",
    tenant = "tenant-1",
    request_id = "req-abc",
})

local pid, err = spawner:spawn_monitored(
    "app:order_workflow",
    "app:worker",
    order
)
if err then return nil, err end
```

워크플로우 내부(또는 그것이 호출하는 액티비티)에서 `ctx` 모듈을 통해 컨텍스트 읽기:

```lua
local ctx = require("ctx")

local user_id, user_err = ctx.get("user_id")       -- "user-1"
if user_err then return nil, user_err end
local tenant, tenant_err = ctx.get("tenant")       -- "tenant-1"
if tenant_err then return nil, tenant_err end
local all, err = ctx.all()               -- {user_id="user-1", tenant="tenant-1", request_id="req-abc"}
if err then
    return nil, err
end
```

### HTTP 핸들러에서

```lua
local function handler()
    local req, req_err = http.request()
    if req_err then
        return nil, req_err
    end

    local body, body_err = req:body()
    if body_err then
        return nil, body_err
    end
    local order, decode_err = json.decode(body)
    if decode_err then
        return nil, decode_err
    end

    local request_id, header_err = req:header("X-Request-ID")
    if header_err then
        return nil, header_err
    end

    local spawner = process
        .with_context({request_id = request_id})
        :with_options({
            ["workflow.id"] = "order-" .. order.id,
            ["workflow.id_conflict_policy"] = "fail",
        })

    local pid, err = spawner:spawn(
        "app:order_workflow",
        "app:worker",
        order
    )

    local res, res_err = http.response()
    if res_err then
        return nil, res_err
    end
    if err then
        local status_err = res:set_status(409)
        if status_err then
            return nil, status_err
        end
        local write_err = res:write_json({error = tostring(err)})
        if write_err then return nil, write_err end
        return true
    end

    local status_err = res:set_status(202)
    if status_err then
        return nil, status_err
    end
    local write_err = res:write_json({
        workflow_id = tostring(pid),
        status = "started"
    })
    if write_err then return nil, write_err end
    return true
end
```

## 시그널

워크플로우는 프로세스 메시징 시스템을 통해 시그널을 받습니다. 시그널은 내구적입니다 — 워크플로우 재생에서 살아남습니다.

### 인박스 패턴

프로세스 인박스를 통해 모든 메시지 수신:

```lua
local function main(order)
    local inbox = process.inbox()

    while true do
        local msg, open = inbox:receive()
        if not open then
            return nil, errors.new({kind = errors.INTERNAL, message = "workflow inbox closed"})
        end
        local topic = msg:topic()

        if topic == "approve" then
            break
        elseif topic == "cancel" then
            local payload = msg:payload()
            local data
            if payload then
                local payload_err
                data, payload_err = payload:data()
                if payload_err then return nil, payload_err end
            end
            local reason = type(data) == "table" and data.reason or nil
            return {status = "cancelled", reason = reason}
        end
    end

    return process_order(order)
end
```

### 토픽 기반 구독

`process.listen()`을 사용하여 특정 토픽 구독:

```lua
local function main(input)
    local results = {}
    local job_ch, job_err = process.listen("add_job")
    if job_err then return nil, job_err end
    local exit_ch, exit_err = process.listen("exit")
    if exit_err then return nil, exit_err end

    while true do
        local result = channel.select{
            job_ch:case_receive(),
            exit_ch:case_receive()
        }

        if result.channel == exit_ch then
            break
        elseif result.channel == job_ch then
            if not result.ok then
                break
            end
            local job_data = result.value
            local activity_result, err = funcs.call(
                "app:echo_activity",
                {job_id = job_data.id, data = job_data}
            )
            if err then
                return nil, err
            end
            table.insert(results, {
                job_id = job_data.id,
                result = activity_result
            })
        end
    end

    return {total_jobs = #results, results = results}
end
```

기본적으로 `process.listen()`은 원시 페이로드 데이터를 반환합니다. 발신자 정보가 있는 Message 객체를 수신하려면 `{message = true}`를 사용하세요:

```lua
local ch, err = process.listen("request", {message = true})
if err then return nil, err end
local msg, open = ch:receive()
if not open then
    return nil, errors.new({kind = errors.INTERNAL, message = "request channel closed"})
end
local sender = msg:from()
local payload = msg:payload()
local data
if payload then
    local payload_err
    data, payload_err = payload:data()
    if payload_err then return nil, payload_err end
end
```

### 직렬화된 시그널 처리

시그널이 공유 워크플로우 상태를 변경한다면 하나의 `channel.select()` 루프를 사용하세요. 이렇게 하면 변경 순서가 결정론적으로 유지되고, `finish` 분기가 차단된 핸들러 코루틴을 남기지 않고 반환할 수 있습니다.

```lua
local function main(input)
    local counter = input.initial or 0

    local function send_reply(pid, topic, payload)
        local sent, err = process.send(pid, topic, payload)
        if err then error(err) end
        return sent
    end

    local function message_data(msg)
        local payload = msg:payload()
        if not payload then return nil end
        return payload:data()
    end

    local increment_ch, increment_err = process.listen("increment", {message = true})
    if increment_err then return nil, increment_err end
    local decrement_ch, decrement_err = process.listen("decrement", {message = true})
    if decrement_err then return nil, decrement_err end
    local finish_ch, finish_err = process.listen("finish", {message = true})
    if finish_err then return nil, finish_err end

    while true do
        local result = channel.select{
            increment_ch:case_receive(),
            decrement_ch:case_receive(),
            finish_ch:case_receive()
        }
        if not result.ok then
            return nil, errors.new({kind = errors.INTERNAL, message = "signal channel closed"})
        end

        local msg = result.value
        local reply_to = msg:from()

        if result.channel == finish_ch then
            send_reply(reply_to, "ack")
            send_reply(reply_to, "ok", {message = "finishing", value = counter})
            return {final_counter = counter}
        end

        local data, payload_err = message_data(msg)
        if payload_err then return nil, payload_err end

        if type(data) ~= "table" or type(data.amount) ~= "number" then
            send_reply(reply_to, "nak", "amount must be a number")
        elseif result.channel == decrement_ch and counter - data.amount < 0 then
            send_reply(reply_to, "nak", "would result in negative value")
        else
            send_reply(reply_to, "ack")
            if result.channel == increment_ch then
                counter = counter + data.amount
            else
                counter = counter - data.amount
            end
            send_reply(reply_to, "ok", {value = counter})
        end
    end
end
```

### 시그널 확인

발신자에게 응답을 보내 요청-응답 패턴 구현:

```lua
-- Workflow side
local ch, err = process.listen("get_status", {message = true})
if err then return nil, err end
local msg, open = ch:receive()
if not open then return nil, errors.new({kind = errors.INTERNAL, message = "status channel closed"}) end
local sent, send_err = process.send(msg:from(), "status_response", {status = "processing", progress = 75})
if send_err then return nil, send_err end
```

```lua
-- Caller side
local response_ch, listen_err = process.listen("status_response")
if listen_err then return nil, listen_err end
local sent, send_err = process.send(workflow_pid, "get_status", {})
if send_err then return nil, send_err end

local timeout, timeout_err = time.after("5s")
if timeout_err then return nil, timeout_err end
local result = channel.select{
    response_ch:case_receive(),
    timeout:case_receive()
}

if result.channel == response_ch then
    if not result.ok then
        return nil, errors.new({kind = errors.INTERNAL, message = "status response channel closed"})
    end
    return result.value
end

if not result.ok then
    return nil, errors.new({kind = errors.INTERNAL, message = "status timeout channel closed"})
end
return nil, errors.new({kind = errors.TIMEOUT, message = "status request timed out", retryable = true})
```

### 크로스 워크플로우 시그널링

워크플로우는 PID를 사용하여 다른 워크플로우에 시그널을 보낼 수 있습니다:

```lua
-- Sender workflow
local function main(input)
    local target_pid = input.target
    local response_ch, listen_err = process.listen("cross_host_pong")
    if listen_err then return nil, listen_err end

    local ok, err = process.send(target_pid, "cross_host_ping", {data = "hello"})
    if err then
        return {ok = false, error = tostring(err)}
    end

    local response, open = response_ch:receive()
    if not open then
        return {ok = false, error = "cross_host_pong channel closed"}
    end
    return {ok = true, received = response}
end
```

## 자식 워크플로우

### 동기 자식 (workflow.exec)

자식 워크플로우를 실행하고 결과 대기:

```lua
local result, err = workflow.exec("app:child_workflow", input_data)
if err then
    return nil, err
end
```

### 비동기 자식 (process.spawn)

차단 없이 자식 워크플로우를 스폰하고 이벤트를 통해 완료 대기:

```lua
local events_ch = process.events()

local child_pid, err = process.spawn(
    "app:child_workflow",
    "app:worker",
    {message = "hello from parent"}
)
if err then
    return {status = "spawn_failed", error = tostring(err)}
end

-- Wait for child EXIT event
local event, open = events_ch:receive()
if not open then
    return nil, errors.new({kind = errors.INTERNAL, message = "process event channel closed"})
end

if event.kind == process.event.EXIT then
    local child_result = event.result.value
    local child_error = event.result.error
end
```

### 자식으로부터의 오류 전파

자식 워크플로우가 오류를 반환하면 EXIT 이벤트에 나타납니다:

```lua
local events_ch = process.events()
local child_pid, err = process.spawn(
    "app:error_child_workflow",
    "app:worker"
)
if err then
    return nil, err
end

local event, open = events_ch:receive()
if not open then
    return nil, errors.new({kind = errors.INTERNAL, message = "process event channel closed"})
end
if event.result.error then
    local child_err = event.result.error
    -- Error objects have kind(), retryable(), message() methods
    print(child_err:kind())       -- e.g. "NotFound"
    print(child_err:retryable())  -- false
    print(child_err:message())    -- error message text
end
```

### 워크플로우 동기 실행 (process.exec)

한 번의 호출로 워크플로우를 실행하고 결과 대기:

```lua
local result, err = process.exec(
    "app:hello_workflow",
    "app:worker",
    {name = "world"}
)
if err then
    return nil, err
end
-- result contains the workflow return value
```

## 모니터링 및 링킹

### 시작 후 모니터링

이미 시작된 워크플로우 모니터링:

```lua
local pid, err = process.spawn(
    "app:long_workflow",
    "app:worker",
    {iterations = 100}
)
if err then
    return nil, err
end

-- Monitor later
local ok, monitor_err = process.monitor(pid)
if monitor_err then
    return nil, monitor_err
end

local events_ch = process.events()
local event, open = events_ch:receive()  -- EXIT when workflow completes
if not open then
    return nil, errors.new({kind = errors.INTERNAL, message = "process event channel closed"})
end
```

### 시작 후 링킹

비정상 종료 시 LINK_DOWN을 수신하기 위해 실행 중인 워크플로우에 링크:

```lua
local ok, err = process.set_options({trap_links = true})
if err then
    return nil, err
end

local pid, err = process.spawn(
    "app:long_workflow",
    "app:worker",
    {iterations = 100}
)
if err then
    return nil, err
end

-- Link after workflow has started
time.sleep("200ms")
local linked, link_err = process.link(pid)
if link_err then return nil, link_err end

-- If workflow is terminated, receive LINK_DOWN
local terminated, terminate_err = process.terminate(pid)
if terminate_err then return nil, terminate_err end

local events_ch = process.events()
local event, open = events_ch:receive()
if not open then
    return nil, errors.new({kind = errors.INTERNAL, message = "process event channel closed"})
end
-- event.kind == process.event.LINK_DOWN
```

LINK_DOWN 이벤트는 프로세스 옵션에서 `trap_links = true`가 필요합니다. 없으면 링크된 프로세스 종료가 실패를 전파합니다.

### 모니터링/링킹 해제

모니터링 또는 링킹 제거:

```lua
local unmonitored, unmonitor_err = process.unmonitor(pid)
if unmonitor_err then return nil, unmonitor_err end
local unlinked, unlink_err = process.unlink(pid)
if unlink_err then return nil, unlink_err end
```

모니터링 또는 링킹 해제 후, 해당 프로세스에 대한 이벤트가 더 이상 전달되지 않습니다.

## 종료 및 취소

### 종료

실행 중인 워크플로우 강제 종료:

```lua
local ok, err = process.terminate(workflow_pid)
```

모니터링된 호출자는 오류와 함께 EXIT 이벤트를 받습니다.

### 취소

선택적 이유와 함께 그레이스풀 취소 요청:

```lua
local ok, err = process.cancel(workflow_pid, "cancelled by operator")
```

## 동시 작업

워크플로우 내에서 병렬 작업을 위해 `coroutine.spawn()`과 채널 사용:

```lua
local function main(input)
    local worker_count = input.workers or 3
    local job_count = input.jobs or 6

    local work_queue = channel.new(10)
    local results = channel.new(10)

    for w = 1, worker_count do
        coroutine.spawn(function()
            while true do
                local job, ok = work_queue:receive()
                if not ok then break end
                time.sleep(10 * time.MILLISECOND)
                results:send({worker = w, job = job, result = job * 2})
            end
        end)
    end

    for j = 1, job_count do
        work_queue:send(j)
    end
    work_queue:close()

    local total = 0
    local processed = {}
    for _ = 1, job_count do
        local r, open = results:receive()
        if not open then
            return nil, errors.new({kind = errors.INTERNAL, message = "results channel closed"})
        end
        total = total + r.result
        table.insert(processed, r)
    end

    return {total = total, processed = processed}
end
```

코루틴 내의 모든 채널 작업과 sleep은 재생 안전합니다.

## 타이머

내구적 타이머는 재시작에도 살아남습니다:

```lua
local time = require("time")

time.sleep("24h")
time.sleep("5m")
time.sleep("30s")
time.sleep(100 * time.MILLISECOND)
```

경과 시간 추적:

```lua
local start = time.now()
time.sleep("1s")
local elapsed = time.now():sub(start):milliseconds()
```

## 결정론

워크플로우 코드는 결정론적이어야 합니다. 동일한 입력이 동일한 명령 시퀀스를 생성해야 합니다.

### 재생 안전 작업

이러한 작업은 자동으로 인터셉트되어 결과가 기록됩니다. 재생 시 기록된 값이 반환됩니다:

```lua
-- Activity calls
local data = funcs.call("app:fetch_data", id)

-- Durable sleep
time.sleep("1h")

-- Current time
local now = time.now()

-- UUID generation
local id = uuid.v4()

-- Crypto operations
local bytes = crypto.random.bytes(32)

-- Child workflows
local result = workflow.exec("app:child", input)

-- Versioning
local v = workflow.version("change-1", 1, 2)
```

### 비결정론적 (피할 것)

```lua
-- Don't use wall clock time
local now = os.time()              -- non-deterministic

-- Don't use random directly
local r = math.random()            -- non-deterministic

-- Don't do I/O in workflow code
local file = io.open("data.txt")   -- non-deterministic

-- Don't use global mutable state
counter = counter + 1               -- non-deterministic across replays
```

## 오류 처리

### 액티비티 오류

액티비티 오류는 구조화된 메타데이터를 포함합니다:

```lua
local result, err = funcs.call("app:risky_activity", order)
if err then
    print(err:kind())       -- error classification (e.g. "NotFound", "Internal")
    print(err:retryable())  -- whether the error is retryable
    print(err:message())    -- human-readable error message
end
```

### 액티비티 실패 모드

액티비티 호출에 대한 재시도 동작 설정:

```lua
local executor = funcs.new():with_options({
    ["activity.retry_policy"] = {
        maximum_attempts = 1,
    }
})

local result, err = executor:call("app:unreliable_activity", input)
if err then
    local kind = err:kind()         -- "Internal" for runtime errors
    local retryable = err:retryable()
end
```

### 자식 워크플로우 오류

자식 워크플로우의 오류(`process.exec` 또는 EXIT 이벤트를 통해)는 동일한 메타데이터를 포함합니다:

```lua
local result, err = process.exec("app:error_workflow", "app:worker")
if err then
    print(err:kind())       -- e.g. "NotFound"
    print(err:retryable())  -- false
    print(err:message())    -- error details
end
```

## 보상 패턴 (Saga)

```lua
local function run_compensations(compensations)
    local first_err
    for _, comp in ipairs(compensations) do
        local _, err = funcs.call(comp.action, comp.args)
        if err and not first_err then
            first_err = err
        end
    end
    if first_err then return nil, first_err end
    return true
end

local function main(order)
    local compensations = {}

    local reservation, err = funcs.call("app:reserve_inventory", order.items)
    if err then
        return {status = "failed", step = "inventory", error = tostring(err)}
    end
    table.insert(compensations, 1, {
        action = "app:release_inventory",
        args = reservation.id
    })

    local payment, err = funcs.call("app:charge_payment", order.payment)
    if err then
        local _, compensation_err = run_compensations(compensations)
        if compensation_err then
            return {status = "failed", step = "payment", error = tostring(err), compensation_error = tostring(compensation_err)}
        end
        return {status = "failed", step = "payment", error = tostring(err)}
    end
    table.insert(compensations, 1, {
        action = "app:refund_payment",
        args = payment.id
    })

    local shipment, err = funcs.call("app:ship_order", order.shipping)
    if err then
        local _, compensation_err = run_compensations(compensations)
        if compensation_err then
            return {status = "failed", step = "shipping", error = tostring(err), compensation_error = tostring(compensation_err)}
        end
        return {status = "failed", step = "shipping", error = tostring(err)}
    end

    return {status = "completed", tracking = shipment.tracking}
end
```

보상은 등록의 역순으로 실행됩니다. 둘 이상의 보상이 실패하더라도 워크플로우는 나머지 작업을 계속 시도하고 첫 실패를 `compensation_error`로 보고합니다.

## 참고

- [개요](./overview.md) - 클라이언트 및 워커 설정
- [액티비티](./activities.md) - 액티비티 정의 및 옵션
- [Process](../lua/core/process.md) - 프로세스 관리 API
- [함수](../lua/core/funcs.md) - 함수 호출
- [채널](../lua/core/channel.md) - 채널 작업
