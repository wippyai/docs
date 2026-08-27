---
title: "프로세스와 메시징 입문"
description: "프로세스 생성, 메시징, 모니터링, 연결, 이름 등록 API를 살펴봅니다."
---

# 프로세스와 메시징 입문

격리된 작업을 생성하고, 메시지를 교환하고, 수명 주기를 모니터링하고, 실패를 연결하고, 프로세스 이름을 등록하는 API를 알아봅니다.

## 개요

프로세스는 메시지 전달로 통신하는 격리된 실행 단위입니다. 각 프로세스는 자체 수신함을 가지며 특정 메시지 주제를 구독할 수 있습니다.

**분류:** 참조/API 입문서. 각 코드 조각은 하나의 연산을 독립적으로 보여 주며, 이 페이지 자체는 독립 실행형 프로젝트가 아닙니다. 생성, 모니터링, 메시징을 결합한 완전한 애플리케이션은 [에코 서비스](echo-service.md) 튜토리얼을 참조하세요.

## 실행 환경과 의존성

예제는 실행 가능한 Lua 엔트리 안에서 실행되며 `app:processes`라는 실행 중인 `process.host`가 등록되어 있다고 가정합니다. `app.test.process:echo_worker` 같은 엔트리 ID는 프로젝트에서 정의해야 하는 프로세스 엔트리 자리표시자입니다. `process`와 `channel` API는 전역으로 제공됩니다. 직접 `process.*`에 접근하는 것이 일반적이며, `require("process")`도 모듈 선언 없이 해석됩니다. `time.after()`를 호출하는 코드 조각에는 `local time = require("time")`와 엔트리 `modules` 목록의 `time`이 필요합니다.

생성, 보내기, 모니터링, 연결, 취소, 종료, 레지스트리 변경은 보호되는 연산입니다. 실행 엔트리에 액터를 지정하고 필요한 연산 및 리소스만 허용하는 정책을 부여하세요. 그렇지 않으면 엄격 모드가 해당 연산을 거부합니다.

핵심 개념:

- `process.spawn()`과 그 변형으로 프로세스를 생성합니다.
- PID나 등록된 이름으로 주제 기반 메시지를 보냅니다.
- `process.listen()` 또는 `process.inbox()`로 메시지를 받습니다.
- 이벤트로 프로세스 수명 주기를 모니터링합니다.
- 프로세스를 연결하여 실패를 함께 처리합니다.

## 프로세스 생성

엔트리 참조에서 새 프로세스를 생성합니다.

```lua
local pid, err = process.spawn("app.test.process:echo_worker", "app:processes", "hello")
if err then
    return false, "spawn failed: " .. tostring(err)
end

-- pid is a string identifier for the spawned process
print("Started worker:", pid)
```

매개변수:

- 엔트리 참조(예: `"app.test.process:echo_worker"`)
- 호스트 참조(예: `"app:processes"`)
- 워커의 main 함수로 전달하는 선택적 인수

### 자신의 PID 가져오기

```lua
local my_pid = process.pid()
-- Returns string PID of current process
```

## 메시지 전달

메시지는 주제 기반 라우팅 시스템을 사용합니다. 주제와 함께 PID로 메시지를 보낸 다음 주제 구독 또는 수신함을 통해 받습니다.

### 메시지 보내기

```lua
-- Send to process by PID
local sent, err = process.send(worker_pid, "messages", "hello from parent")
if err then
    return false, "send failed: " .. tostring(err)
end

-- send returns (bool, error)
```

### 주제 구독으로 받기

`process.listen()`으로 특정 주제를 구독합니다.

```lua
-- Worker that listens for messages on "messages" topic
local function main()
    local ch = process.listen("messages")

    local msg, ok = ch:receive()
    if ok then
        -- msg is the payload directly
        print("Received:", msg)
        return true
    end

    return false
end

return { main = main }
```

### 수신함으로 받기

수신함은 어떤 주제 리스너와도 일치하지 않는 메시지를 받습니다.

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
            -- Messages to "specific_topic" arrive here
            local payload = result.value
        elseif result.channel == inbox_ch then
            -- Messages to any OTHER topic arrive here
            local msg = result.value
            print("Inbox got:", msg:topic(), msg:payload():data())
        end
    end
end
```

### 송신자 정보를 위한 메시지 모드

송신자 PID와 주제에 접근하려면 `{ message = true }`를 사용합니다.

```lua
-- Worker that echoes messages back to sender
local function main()
    local ch = process.listen("echo", { message = true })

    local msg = ch:receive()
    if msg then
        local sender = msg:from()
        local data = msg:payload():data()

        if sender then
            local _, send_err = process.send(sender, "reply", data)
            if send_err then
                return false, "reply failed: " .. tostring(send_err)
            end
        end
        return true
    end

    return false
end

return { main = main }
```

## 프로세스 모니터링

프로세스를 모니터링하면 종료될 때 `EXIT` 이벤트를 받습니다.

### 모니터링과 함께 생성

```lua
local events_ch = process.events()

local worker_pid, err = process.spawn_monitored(
    "app.test.process:events_exit_worker",
    "app:processes"
)
if err then
    return false, "spawn failed: " .. tostring(err)
end

-- Wait for EXIT event
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
    if event.result and event.result.error then
        print("Exit error:", event.result.error)
    elseif event.result then
        print("Return value:", event.result.value)
    end
end
```

### 명시적 모니터링

이미 실행 중인 프로세스를 모니터링합니다.

```lua
local events_ch = process.events()

-- Spawn without monitoring
local worker_pid, err = process.spawn("app.test.process:long_worker", "app:processes")
if err then
    return false, "spawn failed: " .. tostring(err)
end

-- Add monitoring explicitly
local ok, monitor_err = process.monitor(worker_pid)
if monitor_err then
    return false, "monitor failed: " .. tostring(monitor_err)
end

-- Now will receive EXIT events for this worker
```

모니터링을 중지합니다.

```lua
local ok, err = process.unmonitor(worker_pid)
if err then
    return false, "unmonitor failed: " .. tostring(err)
end
```

## 프로세스 연결

수명 주기를 함께 관리하려면 프로세스를 연결합니다. 기본적으로 비정상 종료는 연결된 동료 프로세스를 종료합니다. `trap_links=true`인 동료는 계속 실행되며 대신 `LINK_DOWN` 이벤트를 받습니다.

### 연결된 프로세스 생성

```lua
-- Child terminates if parent crashes (unless trap_links is set)
local pid, err = process.spawn_linked("app.test.process:child_worker", "app:processes")
if err then
    return false, "spawn_linked failed: " .. tostring(err)
end
```

### 명시적 연결

```lua
-- Link to existing process
local ok, err = process.link(target_pid)
if err then
    return false, "link failed: " .. tostring(err)
end

-- Unlink
local ok, err = process.unlink(target_pid)
if err then
    return false, "unlink failed: " .. tostring(err)
end
```

### LINK_DOWN 이벤트 처리

기본적으로 연결된 동료가 비정상 종료되면 현재 프로세스가 종료되며 Lua `LINK_DOWN` 이벤트는 전달되지 않습니다. 계속 실행하면서 해당 이벤트를 받으려면 `trap_links`를 활성화합니다.

```lua
local function main()
    -- Enable trap_links to receive LINK_DOWN events instead of crashing
    local ok, err = process.set_options({ trap_links = true })
    if not ok then
        return false, "set_options failed: " .. tostring(err)
    end

    -- Verify trap_links is enabled
    local opts = process.get_options()
    if not opts.trap_links then
        return false, "trap_links should be true"
    end

    local events_ch = process.events()

    -- Spawn a linked process that will fail
    local error_pid, err2 = process.spawn_linked(
        "app.test.process:error_exit_worker",
        "app:processes"
    )
    if err2 then
        return false, "spawn error worker failed: " .. tostring(err2)
    end

    -- Wait for LINK_DOWN event
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
        -- Handle gracefully instead of crashing
        return true
    end

    return false, "expected LINK_DOWN, got: " .. tostring(event.kind)
end

return { main = main }
```

## 프로세스 레지스트리

이름 기반 조회와 메시징을 사용하려면 프로세스 이름을 등록합니다.

### 이름 등록

```lua
local function main()
    local test_name = "my_service_" .. tostring(os.time())

    -- Register current process with a name
    local ok, err = process.registry.register(test_name)
    if err then
        return false, "register failed: " .. tostring(err)
    end

    -- Lookup the registered name
    local pid, lookup_err = process.registry.lookup(test_name)
    if lookup_err then
        return false, "lookup failed: " .. tostring(lookup_err)
    end

    -- Verify it resolves to our PID
    if pid ~= process.pid() then
        return false, "lookup returned wrong pid"
    end

    return true
end

return { main = main }
```

### 이름 등록 해제

```lua
-- Unregister explicitly
local unregistered = process.registry.unregister(test_name)
if not unregistered then
    print("Name was not registered")
end

-- Lookup after unregister returns nil + error
local pid, err = process.registry.lookup(test_name)
-- pid will be nil, err will be non-nil
```

프로세스가 종료되면 이름은 자동으로 해제됩니다.

## 예제: 모니터링되는 워커 풀

이 부분 예제는 부모 프로세스가 모니터링되는 워커 여러 개를 생성하고 완료 상태를 추적하는 방법을 보여 줍니다. 사용하려면 부모와 `app.test.process:task_worker` 엔트리, `app:processes` 호스트, 필요한 프로세스 정책을 정의하고 두 엔트리의 모듈 목록에 `time`을 포함하세요.

```lua
-- Parent process
local time = require("time")

local function main()
    local events_ch = process.events()

    -- Track spawned workers
    local workers = {}
    local worker_count = 5

    -- Spawn multiple monitored workers
    for i = 1, worker_count do
        local worker_pid, err = process.spawn_monitored(
            "app.test.process:task_worker",
            "app:processes",
            { task_id = i, value = i * 10 }
        )

        if err then
            return false, "spawn worker " .. i .. " failed: " .. tostring(err)
        end

        workers[worker_pid] = { task_id = i, started = os.time() }
    end

    -- Wait for all workers to complete
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
                if event.result and event.result.error then
                    print("Worker " .. worker.task_id .. " failed:", event.result.error)
                else
                    print("Worker " .. worker.task_id .. " completed:", event.result and event.result.value)
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
    -- Simulate work
    time.sleep("100ms")

    -- Process task
    local result = task.value * 2

    return result
end

return { main = main }
```

## 다음 단계

- [프로세스 모듈 참조](../lua/core/process.md) — 프로세스 API 문서
- [채널](channels.md) — 메시지 처리를 위한 채널 연산
