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

자식 워크플로우를 동기적으로 실행하고 결과를 대기합니다:

```lua
local result, err = workflow.exec("app:child_workflow", input_data)
if err then
    return nil, err
end
```

결과를 인라인으로 기다려야 할 때 자식 워크플로우를 실행하는 가장 간단한 방법입니다.

### workflow.version()

결정론적 버전닝으로 코드 변경을 처리합니다:

```lua
local version = workflow.version("payment-v2", 1, 2)

if version == 1 then
    result = funcs.call("app:old_payment", input)
else
    result = funcs.call("app:new_payment", input)
end
```

파라미터:
- `change_id` - 이 변경의 고유 식별자
- `min_supported` - 지원되는 최소 버전
- `max_supported` - 최대 (현재) 버전

버전 번호는 워크플로우 실행별로 결정론적입니다. 진행 중인 기존 워크플로우는 기록된 버전을 계속 사용하고, 새 워크플로우는 `max_supported`를 사용합니다.

### workflow.attrs()

검색 속성과 메모를 업데이트합니다:

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

검색 속성은 Temporal visibility API를 통해 인덱싱되고 쿼리할 수 있습니다. 메모는 워크플로우에 첨부된 인덱싱되지 않는 임의의 데이터입니다.

### workflow.history_length() / workflow.history_size()

워크플로우 히스토리 증가를 모니터링합니다:

```lua
local length = workflow.history_length()
local size = workflow.history_size()

if length > 10000 then
    -- continue-as-new를 고려하여 히스토리 초기화
end
```

## 워크플로우 시작

### 기본 스폰

`process.spawn()`을 사용하여 모든 코드에서 워크플로우를 시작합니다:

```lua
local pid, err = process.spawn(
    "app:order_workflow",    -- workflow entry
    "app:worker",            -- temporal worker
    {order_id = "123"}       -- input
)
```

host 파라미터는 temporal 워커를 가리킵니다 (프로세스 호스트가 아님). 워크플로우는 Temporal 인프라에서 내구성 있게 실행됩니다.

### 모니터링과 함께 스폰

워크플로우가 완료될 때 EXIT 이벤트를 수신하도록 모니터링합니다:

```lua
local pid, err = process.spawn_monitored(
    "app:order_workflow",
    "app:worker",
    {order_id = "123"}
)

local events = process.events()
local event = events:receive()

if event.kind == process.event.EXIT then
    local result = event.result.value
    local error = event.result.error
end
```

### 이름과 함께 스폰

멱등성 시작을 위해 워크플로우에 이름을 할당합니다:

```lua
local spawner = process
    .with_options({})
    :with_name("order-" .. order.id)

local pid, err = spawner:spawn_monitored(
    "app:order_workflow",
    "app:worker",
    {order_id = order.id}
)
```

이름이 제공되면 Temporal은 워크플로우 시작 중복을 제거하는 데 사용합니다. 워크플로우가 실행 중일 때 같은 이름으로 스폰하면 기본적으로 기존 워크플로우의 PID를 반환합니다.

### 명시적 워크플로우 ID와 함께 스폰

특정 Temporal 워크플로우 ID를 설정합니다:

```lua
local spawner = process
    .with_options({
        ["temporal.workflow.id"] = "order-" .. order.id,
    })

local pid, err = spawner:spawn_monitored(
    "app:order_workflow",
    "app:worker",
    order
)
```

### ID 충돌 정책

이미 존재하는 ID로 워크플로우를 스폰할 때의 동작을 제어합니다:

```lua
-- 워크플로우가 이미 존재하면 실패
local spawner = process
    .with_options({
        ["temporal.workflow.id"] = "order-123",
        ["temporal.workflow.id_conflict_policy"] = "fail",
    })

local pid, err = spawner:spawn("app:order_workflow", "app:worker", order)
if err then
    -- 이 ID로 이미 워크플로우 실행 중
end
```

```lua
-- 이미 시작된 경우 에러 (대안적 방법)
local spawner = process
    .with_options({
        ["temporal.workflow.id"] = "order-123",
        ["temporal.workflow.execution_error_when_already_started"] = true,
    })

local pid, err = spawner:spawn("app:order_workflow", "app:worker", order)
```

```lua
-- 기존 것 재사용 (명시적 ID의 기본 동작)
local spawner = process
    .with_options({
        ["temporal.workflow.id"] = "order-123",
    })

local pid, err = spawner:spawn("app:order_workflow", "app:worker", order)
-- 이미 실행 중이면 기존 워크플로우 PID 반환
```

| 정책 | 동작 |
|--------|----------|
| `"use_existing"` | 기존 워크플로우 PID 반환 (명시적 ID의 기본값) |
| `"fail"` | 워크플로우가 존재하면 에러 반환 |
| `"terminate_existing"` | 기존 것을 종료하고 새로 시작 |

### 워크플로우 시작 옵션

`with_options()`를 통해 Temporal 워크플로우 옵션을 전달합니다:

```lua
local spawner = process.with_options({
    ["temporal.workflow.id"] = "order-123",
    ["temporal.workflow.execution_timeout"] = "24h",
    ["temporal.workflow.run_timeout"] = "1h",
    ["temporal.workflow.task_timeout"] = "30s",
    ["temporal.workflow.id_conflict_policy"] = "fail",
    ["temporal.workflow.retry_policy"] = {
        initial_interval = 1000,
        backoff_coefficient = 2.0,
        maximum_interval = 300000,
        maximum_attempts = 3,
    },
    ["temporal.workflow.cron_schedule"] = "0 */6 * * *",
    ["temporal.workflow.search_attributes"] = {
        customer_id = "cust-123"
    },
    ["temporal.workflow.memo"] = {
        source = "api"
    },
    ["temporal.workflow.start_delay"] = "5m",
    ["temporal.workflow.parent_close_policy"] = "terminate",
})
```

#### 전체 옵션 레퍼런스

| 옵션 | 타입 | 설명 |
|--------|------|-------------|
| `temporal.workflow.id` | string | 명시적 워크플로우 실행 ID |
| `temporal.workflow.task_queue` | string | 태스크 큐 오버라이드 |
| `temporal.workflow.execution_timeout` | duration | 총 워크플로우 실행 타임아웃 |
| `temporal.workflow.run_timeout` | duration | 단일 실행 타임아웃 |
| `temporal.workflow.task_timeout` | duration | 워크플로우 태스크 처리 타임아웃 |
| `temporal.workflow.id_conflict_policy` | string | `use_existing`, `fail`, `terminate_existing` |
| `temporal.workflow.id_reuse_policy` | string | `allow_duplicate`, `allow_duplicate_failed_only`, `reject_duplicate` |
| `temporal.workflow.execution_error_when_already_started` | boolean | 워크플로우가 이미 실행 중이면 에러 |
| `temporal.workflow.retry_policy` | table | 재시도 정책 (아래 참조) |
| `temporal.workflow.cron_schedule` | string | 반복 워크플로우를 위한 cron 표현식 |
| `temporal.workflow.memo` | table | 인덱싱되지 않는 워크플로우 메타데이터 |
| `temporal.workflow.search_attributes` | table | 인덱싱된 쿼리 가능 속성 |
| `temporal.workflow.enable_eager_start` | boolean | 즉시 실행 시작 |
| `temporal.workflow.start_delay` | duration | 워크플로우 시작 전 지연 |
| `temporal.workflow.parent_close_policy` | string | 부모 종료 시 자식 동작 |
| `temporal.workflow.wait_for_cancellation` | boolean | 취소 완료 대기 |
| `temporal.workflow.namespace` | string | Temporal 네임스페이스 오버라이드 |

duration 값은 문자열 (`"5s"`, `"10m"`, `"1h"`) 또는 밀리초 숫자를 허용합니다.

#### 부모 종료 정책

부모가 종료될 때 자식 워크플로우에 발생하는 동작을 제어합니다:

| 정책 | 동작 |
|--------|----------|
| `"terminate"` | 자식 워크플로우 종료 |
| `"abandon"` | 자식이 독립적으로 계속 실행 |
| `"request_cancel"` | 자식에게 취소 요청 전송 |

### 시작 메시지

워크플로우 시작 직후 전송할 시그널을 큐에 넣습니다. 메시지는 외부 시그널보다 먼저 전달됩니다:

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
```

시작 메시지는 `use_existing` 충돌 정책과 함께 사용할 때 특히 유용합니다. 두 번째 스폰이 기존 워크플로우로 확인되어도 시작 메시지는 여전히 전달됩니다:

```lua
-- 첫 번째 스폰이 초기 메시지와 함께 워크플로우를 시작
local first = process
    .with_options({})
    :with_name("my-counter")
    :with_message("increment", {amount = 3})

local pid, err = first:spawn("app:counter_workflow", "app:worker", {initial = 0})

-- 두 번째 스폰이 기존 워크플로우로 매핑되고 새 메시지를 전달
local second = process
    .with_options({})
    :with_name("my-counter")
    :with_message("increment", {amount = 2})

local pid2, err = second:spawn("app:counter_workflow", "app:worker", {initial = 999})
-- pid2 == pid (같은 워크플로우), input {initial = 999}는 무시됨
-- 하지만 amount=2인 increment 메시지는 전달됨
```

### 컨텍스트 전파

워크플로우와 해당 액티비티 내에서 접근 가능한 컨텍스트 값을 전달합니다:

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
```

워크플로우 (또는 호출하는 액티비티) 내에서 `ctx` 모듈을 통해 컨텍스트를 읽습니다:

```lua
local ctx = require("ctx")

local user_id = ctx.get("user_id")       -- "user-1"
local tenant = ctx.get("tenant")         -- "tenant-1"
local all = ctx.all()                    -- {user_id="user-1", tenant="tenant-1", request_id="req-abc"}
```

### HTTP 핸들러에서

```lua
local function handler()
    local req = http.request()
    local order = json.decode(req:body())

    local spawner = process
        .with_context({request_id = req:header("X-Request-ID")})
        :with_options({
            ["temporal.workflow.id"] = "order-" .. order.id,
            ["temporal.workflow.id_conflict_policy"] = "fail",
        })

    local pid, err = spawner:spawn(
        "app:order_workflow",
        "app:worker",
        order
    )

    if err then
        return http.response():status(409):json({error = tostring(err)})
    end

    return http.response():status(202):json({
        workflow_id = tostring(pid),
        status = "started"
    })
end
```

## 시그널

워크플로우는 프로세스 메시징 시스템을 통해 시그널을 수신합니다. 시그널은 내구성이 있어 워크플로우 리플레이에서도 유지됩니다.

### 인박스 패턴

프로세스 인박스를 통해 모든 메시지를 수신합니다:

```lua
local function main(order)
    local inbox = process.inbox()

    while true do
        local msg = inbox:receive()
        local topic = msg:topic()
        local data = msg:payload():data()

        if topic == "approve" then
            break
        elseif topic == "cancel" then
            return {status = "cancelled", reason = data.reason}
        end
    end

    return process_order(order)
end
```

### 토픽 기반 구독

`process.listen()`을 사용하여 특정 토픽을 구독합니다:

```lua
local function main(input)
    local results = {}
    local job_ch = process.listen("add_job")
    local exit_ch = process.listen("exit")

    while true do
        local result = channel.select{
            job_ch:case_receive(),
            exit_ch:case_receive()
        }

        if result.channel == exit_ch then
            break
        elseif result.channel == job_ch then
            local job_data = result.value
            local activity_result, err = funcs.call(
                "app:echo_activity",
                {job_id = job_data.id, data = job_data}
            )
            table.insert(results, {
                job_id = job_data.id,
                result = activity_result
            })
        end
    end

    return {total_jobs = #results, results = results}
end
```

기본적으로 `process.listen()`은 원시 페이로드 데이터를 반환합니다. 발신자 정보가 포함된 Message 객체를 수신하려면 `{message = true}`를 사용하세요:

```lua
local ch = process.listen("request", {message = true})
local msg = ch:receive()
local sender = msg:from()
local data = msg:payload():data()
```

### 다중 시그널 핸들러

`coroutine.spawn()`을 사용하여 서로 다른 시그널 타입을 동시에 처리합니다:

```lua
local function main(input)
    local counter = input.initial or 0
    local done = false

    coroutine.spawn(function()
        local ch = process.listen("increment", {message = true})
        while not done do
            local msg, ok = ch:receive()
            if not ok then break end

            local data = msg:payload():data()
            local reply_to = msg:from()

            if type(data) ~= "table" or type(data.amount) ~= "number" then
                process.send(reply_to, "nak", "amount must be a number")
            else
                process.send(reply_to, "ack")
                counter = counter + data.amount
                process.send(reply_to, "ok", {value = counter})
            end
        end
    end)

    coroutine.spawn(function()
        local ch = process.listen("decrement", {message = true})
        while not done do
            local msg, ok = ch:receive()
            if not ok then break end

            local data = msg:payload():data()
            local reply_to = msg:from()

            if counter - data.amount < 0 then
                process.send(reply_to, "nak", "would result in negative value")
            else
                process.send(reply_to, "ack")
                counter = counter - data.amount
                process.send(reply_to, "ok", {value = counter})
            end
        end
    end)

    -- Main coroutine waits for finish signal
    local finish_ch = process.listen("finish", {message = true})
    local msg = finish_ch:receive()
    process.send(msg:from(), "ack")
    process.send(msg:from(), "ok", {message = "finishing"})
    done = true

    return {final_counter = counter}
end
```

### 시그널 확인 응답

발신자에게 응답을 보내는 요청-응답 패턴을 구현합니다:

```lua
-- Workflow side
local ch = process.listen("get_status", {message = true})
local msg = ch:receive()
process.send(msg:from(), "status_response", {status = "processing", progress = 75})
```

```lua
-- Caller side
local response_ch = process.listen("status_response")
process.send(workflow_pid, "get_status", {})

local timeout = time.after("5s")
local result = channel.select{
    response_ch:case_receive(),
    timeout:case_receive()
}

if result.channel == response_ch then
    local status = result.value
end
```

### 워크플로우 간 시그널링

워크플로우는 PID를 사용하여 다른 워크플로우에 시그널을 보낼 수 있습니다:

```lua
-- Sender workflow
local function main(input)
    local target_pid = input.target
    local ok, err = process.send(target_pid, "cross_host_ping", {data = "hello"})
    if err then
        return {ok = false, error = tostring(err)}
    end

    local response_ch = process.listen("cross_host_pong")
    local response = response_ch:receive()
    return {ok = true, received = response}
end
```

## 자식 워크플로우

### 동기 자식 (workflow.exec)

자식 워크플로우를 실행하고 결과를 대기합니다:

```lua
local result, err = workflow.exec("app:child_workflow", input_data)
if err then
    return nil, err
end
```

### 비동기 자식 (process.spawn)

블로킹 없이 자식 워크플로우를 스폰한 다음, 이벤트를 통해 완료를 대기합니다:

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

-- 자식의 EXIT 이벤트 대기
local event = events_ch:receive()

if event.kind == process.event.EXIT then
    local child_result = event.result.value
    local child_error = event.result.error
end
```

### 자식에서의 에러 전파

자식 워크플로우가 에러를 반환하면 EXIT 이벤트에 나타납니다:

```lua
local events_ch = process.events()
local child_pid, err = process.spawn(
    "app:error_child_workflow",
    "app:worker"
)

local event = events_ch:receive()
if event.result.error then
    local child_err = event.result.error
    -- Error objects have kind(), retryable(), message() methods
    print(child_err:kind())       -- e.g. "NOT_FOUND"
    print(child_err:retryable())  -- false
    print(child_err:message())    -- error message text
end
```

### 워크플로우 동기 실행 (process.exec)

한 번의 호출로 워크플로우를 실행하고 결과를 대기합니다:

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

## 모니터링과 링킹

### 시작 후 모니터링

이미 시작된 워크플로우를 모니터링합니다:

```lua
local pid, err = process.spawn(
    "app:long_workflow",
    "app:worker",
    {iterations = 100}
)

-- Monitor later
local ok, err = process.monitor(pid)

local events_ch = process.events()
local event = events_ch:receive()  -- EXIT when workflow completes
```

### 시작 후 링킹

실행 중인 워크플로우에 링크하여 비정상 종료 시 LINK_DOWN을 수신합니다:

```lua
local ok, err = process.set_options({trap_links = true})

local pid, err = process.spawn(
    "app:long_workflow",
    "app:worker",
    {iterations = 100}
)

-- 워크플로우 시작 후 링킹
time.sleep("200ms")
local ok, err = process.link(pid)

-- 워크플로우가 종료되면 LINK_DOWN 수신
process.terminate(pid)

local events_ch = process.events()
local event = events_ch:receive()
-- event.kind == process.event.LINK_DOWN
```

LINK_DOWN 이벤트는 프로세스 옵션에서 `trap_links = true`가 필요합니다. 이 설정이 없으면 링크된 프로세스의 종료가 장애를 전파합니다.

### 모니터링 해제 / 링크 해제

모니터링 또는 링킹을 제거합니다:

```lua
process.unmonitor(pid)  -- EXIT 이벤트 수신 중지
process.unlink(pid)     -- 양방향 링크 제거
```

모니터링 또는 링크를 해제하면 해당 프로세스의 이벤트가 더 이상 전달되지 않습니다.

## 종료와 취소

### 종료

실행 중인 워크플로우를 강제 종료합니다:

```lua
local ok, err = process.terminate(workflow_pid)
```

모니터링 중인 호출자는 에러가 포함된 EXIT 이벤트를 수신합니다.

### 취소

선택적 데드라인과 함께 정상적인 취소를 요청합니다:

```lua
local ok, err = process.cancel(workflow_pid, "5s")
```

## 동시 작업

워크플로우 내부에서 병렬 작업을 위해 `coroutine.spawn()`과 채널을 사용합니다:

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
        local r = results:receive()
        total = total + r.result
        table.insert(processed, r)
    end

    return {total = total, processed = processed}
end
```

코루틴 내부의 모든 채널 연산과 슬립은 리플레이에 안전합니다.

## 타이머

내구성 있는 타이머는 재시작에도 유지됩니다:

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

워크플로우 코드는 결정론적이어야 합니다. 같은 입력은 같은 명령 시퀀스를 생성해야 합니다.

### 리플레이에 안전한 연산

아래 연산은 자동으로 가로채어 결과가 기록됩니다. 리플레이 시 기록된 값이 반환됩니다:

```lua
-- Activity 호출
local data = funcs.call("app:fetch_data", id)

-- 내구성 sleep
time.sleep("1h")

-- 현재 시간
local now = time.now()

-- UUID 생성
local id = uuid.v4()

-- Crypto 연산
local bytes = crypto.random_bytes(32)

-- 자식 워크플로우
local result = workflow.exec("app:child", input)

-- 버전닝
local v = workflow.version("change-1", 1, 2)
```

### 비결정론적 (사용 금지)

```lua
-- 시스템 시간 사용 금지
local now = os.time()              -- 비결정론적

-- 직접 난수 생성 금지
local r = math.random()            -- 비결정론적

-- 워크플로우 코드에서 I/O 금지
local file = io.open("data.txt")   -- 비결정론적

-- 전역 변경 가능 상태 사용 금지
counter = counter + 1               -- replay에서 비결정론적
```

## 에러 처리

### 액티비티 에러

액티비티 에러는 구조화된 메타데이터를 포함합니다:

```lua
local result, err = funcs.call("app:risky_activity", order)
if err then
    print(err:kind())       -- error classification (e.g. "NOT_FOUND", "INTERNAL")
    print(err:retryable())  -- whether the error is retryable
    print(err:message())    -- human-readable error message
end
```

### 액티비티 실패 모드

액티비티 호출의 재시도 동작을 설정합니다:

```lua
local executor = funcs.new():with_options({
    ["activity.retry_policy"] = {
        maximum_attempts = 1,
    }
})

local result, err = executor:call("app:unreliable_activity", input)
if err then
    local kind = err:kind()         -- "INTERNAL" for runtime errors
    local retryable = err:retryable()
end
```

### 자식 워크플로우 에러

자식 워크플로우의 에러 (`process.exec` 또는 EXIT 이벤트를 통해)는 동일한 메타데이터를 포함합니다:

```lua
local result, err = process.exec("app:error_workflow", "app:worker")
if err then
    print(err:kind())       -- e.g. "NOT_FOUND"
    print(err:retryable())  -- false
    print(err:message())    -- error details
end
```

## 보상 패턴 (Saga)

```lua
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
        run_compensations(compensations)
        return {status = "failed", step = "payment", error = tostring(err)}
    end
    table.insert(compensations, 1, {
        action = "app:refund_payment",
        args = payment.id
    })

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

## 참고

- [개요](temporal/overview.md) - 클라이언트와 워커 설정
- [액티비티](temporal/activities.md) - 액티비티 정의와 옵션
- [프로세스](lua/core/process.md) - 프로세스 관리 API
- [함수](lua/core/funcs.md) - 함수 호출
- [채널](lua/core/channel.md) - 채널 연산
