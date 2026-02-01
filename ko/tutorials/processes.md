# 프로세스와 메시징

격리된 프로세스를 스폰하고 메시지 전달을 통해 통신합니다.

## 개요

프로세스는 메시지 전달을 통해 통신하는 격리된 실행 단위를 제공합니다. 각 프로세스는 자체 인박스를 가지며 특정 메시지 토픽을 구독할 수 있습니다.

주요 개념:
- `process.spawn()` 및 변형으로 프로세스 스폰
- 토픽을 통해 PID 또는 등록된 이름으로 메시지 전송
- `process.listen()` 또는 `process.inbox()`를 사용하여 메시지 수신
- 이벤트로 프로세스 라이프사이클 모니터링
- 조율된 실패 처리를 위한 프로세스 연결

## 프로세스 스폰

엔트리 참조에서 새 프로세스를 스폰합니다.

```lua
local pid, err = process.spawn("app.test.process:echo_worker", "app:processes", "hello")
if err then
    return false, "spawn failed: " .. err
end

-- pid는 스폰된 프로세스의 문자열 식별자
print("Started worker:", pid)
```

파라미터:
- 엔트리 참조 (예: `"app.test.process:echo_worker"`)
- 호스트 참조 (예: `"app:processes"`)
- 워커의 main 함수에 전달되는 선택적 인자

### 자신의 PID 가져오기

```lua
local my_pid = process.pid()
-- 현재 프로세스의 문자열 PID 반환
```

## 메시지 전달

메시지는 토픽 기반 라우팅 시스템을 사용합니다. 토픽과 함께 PID로 메시지를 보내고, 토픽 구독 또는 인박스를 통해 수신합니다.

### 메시지 보내기

```lua
-- PID로 프로세스에 전송
local sent, err = process.send(worker_pid, "messages", "hello from parent")
if err then
    return false, "send failed: " .. err
end

-- send는 (bool, error) 반환
```

### 토픽 구독을 통한 수신

`process.listen()`을 사용하여 특정 토픽을 구독합니다:

```lua
-- "messages" 토픽의 메시지를 리슨하는 워커
local function main()
    local ch = process.listen("messages")

    local msg = ch:receive()
    if msg then
        -- msg는 직접 페이로드
        print("Received:", msg)
        return true
    end

    return false
end

return { main = main }
```

### 인박스를 통한 수신

인박스는 토픽 리스너와 매칭되지 않는 메시지를 수신합니다:

```lua
local function main()
    local inbox_ch = process.inbox()
    local specific_ch = process.listen("specific_topic")

    while true do
        local result = channel.select({
            specific_ch:case_receive(),
            inbox_ch:case_receive()
        })

        if result.channel == specific_ch then
            -- "specific_topic"으로의 메시지가 여기로 도착
            local payload = result.value
        elseif result.channel == inbox_ch then
            -- 다른 모든 토픽의 메시지가 여기로 도착
            local msg = result.value
            print("Inbox got:", msg.topic, msg.payload)
        end
    end
end
```

### 발신자 정보를 위한 메시지 모드

`{ message = true }`를 사용하여 발신자 PID와 토픽에 접근합니다:

```lua
-- 메시지를 발신자에게 에코하는 워커
local function main()
    local ch = process.listen("echo", { message = true })

    local msg = ch:receive()
    if msg then
        local sender = msg:from()
        local payload = msg:payload()

        if sender then
            process.send(sender, "reply", payload)
        end
        return true
    end

    return false
end

return { main = main }
```

## 프로세스 모니터링

프로세스가 종료될 때 EXIT 이벤트를 받기 위해 모니터링합니다.

### 모니터링과 함께 스폰

```lua
local events_ch = process.events()

local worker_pid, err = process.spawn_monitored(
    "app.test.process:events_exit_worker",
    "app:processes"
)
if err then
    return false, "spawn failed: " .. err
end

-- EXIT 이벤트 대기
local timeout = time.after("3s")
local result = channel.select {
    events_ch:case_receive(),
    timeout:case_receive(),
}

if result.channel == timeout then
    return false, "timeout waiting for EXIT event"
end

local event = result.value
if event.kind == process.event.EXIT then
    print("Worker exited:", event.from)
    if event.error then
        print("Exit error:", event.error)
    end
    -- event.result를 통해 반환 값 접근
end
```

### 명시적 모니터링

이미 실행 중인 프로세스를 모니터링합니다:

```lua
local events_ch = process.events()

-- 모니터링 없이 스폰
local worker_pid, err = process.spawn("app.test.process:long_worker", "app:processes")
if err then
    return false, "spawn failed: " .. err
end

-- 명시적으로 모니터링 추가
local ok, monitor_err = process.monitor(worker_pid)
if monitor_err then
    return false, "monitor failed: " .. monitor_err
end

-- 이제 이 워커의 EXIT 이벤트를 수신함
```

모니터링 중지:

```lua
local ok, err = process.unmonitor(worker_pid)
```

## 프로세스 연결

조율된 라이프사이클 관리를 위해 프로세스를 연결합니다. 연결된 프로세스는 연결된 프로세스가 실패할 때 LINK_DOWN 이벤트를 받습니다.

### 연결된 프로세스 스폰

```lua
-- 부모가 크래시하면 자식도 종료 (trap_links가 설정되지 않은 경우)
local pid, err = process.spawn_linked("app.test.process:child_worker", "app:processes")
if err then
    return false, "spawn_linked failed: " .. err
end
```

### 명시적 연결

```lua
-- 기존 프로세스에 연결
local ok, err = process.link(target_pid)
if err then
    return false, "link failed: " .. err
end

-- 연결 해제
local ok, err = process.unlink(target_pid)
```

### LINK_DOWN 이벤트 처리

기본적으로 LINK_DOWN은 프로세스를 실패시킵니다. `trap_links`를 활성화하여 이벤트로 받습니다:

```lua
local function main()
    -- 크래시 대신 LINK_DOWN 이벤트를 받기 위해 trap_links 활성화
    local ok, err = process.set_options({ trap_links = true })
    if not ok then
        return false, "set_options failed: " .. err
    end

    -- trap_links가 활성화되었는지 확인
    local opts = process.get_options()
    if not opts.trap_links then
        return false, "trap_links should be true"
    end

    local events_ch = process.events()

    -- 실패할 연결된 프로세스 스폰
    local error_pid, err2 = process.spawn_linked(
        "app.test.process:error_exit_worker",
        "app:processes"
    )
    if err2 then
        return false, "spawn error worker failed: " .. err2
    end

    -- LINK_DOWN 이벤트 대기
    local timeout = time.after("2s")
    local result = channel.select {
        events_ch:case_receive(),
        timeout:case_receive(),
    }

    if result.channel == timeout then
        return false, "timeout waiting for LINK_DOWN"
    end

    local event = result.value
    if event.kind == process.event.LINK_DOWN then
        print("Linked process died:", event.from)
        -- 크래시 대신 우아하게 처리
        return true
    end

    return false, "expected LINK_DOWN, got: " .. tostring(event.kind)
end

return { main = main }
```

## 프로세스 레지스트리

이름 기반 조회 및 메시징을 위해 프로세스 이름을 등록합니다.

### 이름 등록

```lua
local function main()
    local test_name = "my_service_" .. tostring(os.time())

    -- 현재 프로세스를 이름으로 등록
    local ok, err = process.registry.register(test_name)
    if err then
        return false, "register failed: " .. err
    end

    -- 등록된 이름 조회
    local pid, lookup_err = process.registry.lookup(test_name)
    if lookup_err then
        return false, "lookup failed: " .. lookup_err
    end

    -- 우리 PID로 해석되는지 확인
    if pid ~= process.pid() then
        return false, "lookup returned wrong pid"
    end

    return true
end

return { main = main }
```

### 이름 등록 해제

```lua
-- 명시적 등록 해제
local unregistered = process.registry.unregister(test_name)
if not unregistered then
    print("Name was not registered")
end

-- 등록 해제 후 조회는 nil + error 반환
local pid, err = process.registry.lookup(test_name)
-- pid는 nil, err는 non-nil
```

이름은 프로세스가 종료될 때 자동으로 해제됩니다.

## 완전한 예제: 모니터링되는 워커 풀

이 예제는 부모 프로세스가 여러 모니터링되는 워커를 스폰하고 완료를 추적하는 것을 보여줍니다.

```lua
-- 부모 프로세스
local time = require("time")

local function main()
    local events_ch = process.events()

    -- 스폰된 워커 추적
    local workers = {}
    local worker_count = 5

    -- 여러 모니터링되는 워커 스폰
    for i = 1, worker_count do
        local worker_pid, err = process.spawn_monitored(
            "app.test.process:task_worker",
            "app:processes",
            { task_id = i, value = i * 10 }
        )

        if err then
            return false, "spawn worker " .. i .. " failed: " .. err
        end

        workers[worker_pid] = { task_id = i, started = os.time() }
    end

    -- 모든 워커가 완료될 때까지 대기
    local completed = 0
    local timeout = time.after("10s")

    while completed < worker_count do
        local result = channel.select {
            events_ch:case_receive(),
            timeout:case_receive(),
        }

        if result.channel == timeout then
            return false, "timeout waiting for workers"
        end

        local event = result.value
        if event.kind == process.event.EXIT then
            local worker = workers[event.from]
            if worker then
                if event.error then
                    print("Worker " .. worker.task_id .. " failed:", event.error)
                else
                    print("Worker " .. worker.task_id .. " completed:", event.result)
                end
                completed = completed + 1
            end
        end
    end

    return true
end

return { main = main }
```

워커 프로세스:

```lua
-- task_worker.lua
local time = require("time")

local function main(task)
    -- 작업 시뮬레이션
    time.sleep("100ms")

    -- 작업 처리
    local result = task.value * 2

    return result
end

return { main = main }
```

## 요약

프로세스 스폰:
- `process.spawn()` - 기본 스폰, PID 반환
- `process.spawn_monitored()` - 자동 모니터링과 함께 스폰
- `process.spawn_linked()` - 라이프사이클 연결과 함께 스폰
- `process.pid()` - 현재 프로세스 PID 가져오기

메시징:
- `process.send(pid, topic, payload)` - PID로 메시지 전송
- `process.listen(topic)` - 토픽 구독, 페이로드 수신
- `process.listen(topic, { message = true })` - `:from()`, `:payload()`, `:topic()`이 있는 전체 메시지 수신
- `process.inbox()` - 리스너와 매칭되지 않는 메시지 수신

모니터링:
- `process.events()` - EXIT 및 LINK_DOWN 이벤트를 위한 채널
- `process.monitor(pid)` - 기존 프로세스 모니터링
- `process.unmonitor(pid)` - 모니터링 중지

연결:
- `process.link(pid)` - 프로세스에 연결
- `process.unlink(pid)` - 프로세스 연결 해제
- `process.set_options({ trap_links = true })` - 크래시 대신 LINK_DOWN을 이벤트로 수신
- `process.get_options()` - 현재 프로세스 옵션 가져오기

레지스트리:
- `process.registry.register(name)` - 현재 프로세스의 이름 등록
- `process.registry.lookup(name)` - 이름으로 PID 찾기
- `process.registry.unregister(name)` - 이름 등록 제거

## 참고

- [프로세스 모듈 참조](lua-process.md) - 전체 API 문서
- [채널](channels.md) - 메시지 처리를 위한 채널 작업
