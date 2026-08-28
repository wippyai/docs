---
title: "채널과 코루틴"
description: "버퍼드 및 언버퍼드 채널을 만들고, 값을 교환하고, 여러 작업을 select하며 동시 작업을 조율합니다."
---

# 채널과 코루틴
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>


채널은 동시 작업 사이에서 값을 교환합니다. 버퍼드 또는 언버퍼드 방식으로 사용할 수 있으며, `channel.select`와 결합해 여러 작업을 조율할 수 있습니다.

이 페이지는 API 참조입니다. 기본 블록은 독립적인 코드 조각이며, 타임아웃, fan-in, 논블로킹 섹션은 주변 애플리케이션에서 이름 있는 채널과 콜백을 제공하는 부분 패턴입니다. 워커 풀 블록은 완전한 프로세스 내부 예제입니다.

`channel`과 `coroutine` 전역은 항상 사용할 수 있습니다. 채널은 하나의 Lua 프로세스 안에서 코루틴을 조율합니다. 프로세스 경계를 넘을 때는 프로세스 메시징, 함수 또는 큐를 사용하세요.

## 채널 생성

언버퍼드 채널(크기 0)은 전송이 완료되기 전에 송신자와 수신자가 모두 준비되어야 합니다. 버퍼드 채널은 버퍼 공간이 있는 동안 전송을 완료할 수 있습니다.

```lua
-- Unbuffered: synchronizes sender and receiver
local sync_ch = channel.new()

-- Buffered: queue up to 10 messages
local work_queue = channel.new(10)
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `size` | integer | 버퍼 용량 (기본값: 0, 언버퍼드) |

**반환:** `channel`

## 값 보내기

언버퍼드 채널에서는 수신자가 준비될 때까지, 버퍼드 채널에서는 버퍼 공간이 생길 때까지 전송이 블록됩니다.

```lua
-- Send work to a worker pool
local tasks = {"task-a", "task-b"}
local jobs = channel.new(100)
for i, task in ipairs(tasks) do
    jobs:send(task)  -- Blocks if buffer full
end
jobs:close()  -- Signal no more work
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `value` | any | 보낼 값 |

**반환:** `boolean`

닫힌 채널에 전송하면 오류가 발생합니다.

## 값 받기

값을 사용할 수 있거나 채널이 닫힐 때까지 수신이 블록됩니다.

```lua
-- Worker consuming from job queue
while true do
    local job, ok = jobs:receive()
    if not ok then
        break  -- Channel closed, no more work
    end
    process(job)
end
```

여기서 `jobs`는 애플리케이션이 제공하는 큐이고 `process`는 작업 처리 콜백입니다.

**반환:** `any, boolean`

- `value, true` — 값을 받음
- `nil, false` — 채널이 닫히고 비어 있음

## 채널 닫기

채널을 닫으면 대기 중인 송신자는 오류를 받고 대기 중인 수신자는 `nil, false`를 받습니다. 이미 닫힌 채널을 닫는 작업은 아무 효과가 없습니다.

```lua
local results = channel.new(10)

-- Producer fills results
for _, item in ipairs(data) do
    results:send(process(item))
end
results:close()  -- Signal completion
```

이 독립적인 생산자 조각은 애플리케이션이 `data`와 `process` 콜백을 제공한다고 가정합니다.

## 여러 채널에서 Select

`channel.select`는 여러 채널 작업을 동시에 기다립니다. 이벤트 소스, 타임아웃, 논블로킹 확인을 조율할 수 있습니다.

```lua
local result = channel.select(cases)
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `cases` | table | select 케이스 배열 |
| `default` | boolean | true이면 준비된 케이스가 없을 때 즉시 반환 |

**반환:** `table`

- 채널 케이스: `{channel, value, ok}` — `channel`은 케이스의 채널이고, `value`는 송수신된 값이며, 닫힌 채널 수신이면 `ok`가 false입니다.
- 준비된 케이스가 없고 `default = true`인 기본 분기: `{default = true, ok = true}`.

### 타임아웃 패턴

`time.after()`를 사용하여 채널 대기에 타임아웃을 추가합니다.

```lua
local time = require("time")

local result_ch = application_response_channel
local timeout, err = time.after("5s")
if err then
    return nil, err
end

local r = channel.select {
    result_ch:case_receive(),
    timeout:case_receive()
}

if r.channel == timeout then
    return nil, errors.new({
        message = "Operation timed out",
        kind = errors.TIMEOUT
    })
end
if not r.ok then
    return nil, errors.new("Response channel closed")
end
return r.value
```

이 부분 패턴은 엔트리의 `modules:`에 `time`이 있고 애플리케이션이 `application_response_channel`을 제공한다고 가정합니다. `time.after`는 성공 시 하나의 채널을 반환하며, 유효하지 않거나 양수가 아닌 기간에는 `nil, error`를 반환합니다.

### Fan-in 패턴

한 루프에서 여러 소스의 값을 처리합니다.

이 프로세스 엔트리 패턴은 주변 `process`를 사용하며, 애플리케이션이 종료 신호와 두 핸들러 함수를 제공합니다.

```lua
local events = process.events()
local inbox = process.inbox()
local shutdown = channel.new()

while true do
    local r = channel.select {
        events:case_receive(),
        inbox:case_receive(),
        shutdown:case_receive()
    }

    if r.channel == shutdown then
        break
    elseif r.channel == events then
        handle_event(r.value)
    else
        handle_message(r.value)
    end
end
```

### 논블로킹 확인

기본 케이스를 사용하여 블로킹 없이 사용 가능한 데이터를 확인합니다.

이 독립적인 패턴에서 `ch`와 `process` 콜백은 애플리케이션이 제공합니다.

```lua
local r = channel.select {
    ch:case_receive(),
    default = true
}

if r.default then
    -- Nothing available, do something else
elseif not r.ok then
    -- The channel is closed
else
    process(r.value)
end
```

## Select 케이스 생성

`channel.select`와 함께 사용할 케이스 생성:

```lua
-- Send case - completes when channel can accept value
ch:case_send(value)

-- Receive case - completes when value available
ch:case_receive()
```

케이스 테이블에서 송신 또는 수신 케이스가 아닌 값은 무시됩니다. 기본 분기가 없다면 테이블에 유효한 케이스를 하나 이상 포함하세요.

## 워커 풀 패턴

```lua
local items = {1, 2, 3, 4}
local num_workers = 2

local function process_item(item)
    return item * 2
end

local work = channel.new(#items)
local results = channel.new(#items)

-- Spawn workers
for _ = 1, num_workers do
    coroutine.spawn(function()
        while true do
            local item, ok = work:receive()
            if not ok then
                return
            end
            results:send(process_item(item))
        end
    end)
end

-- Feed work
for _, item in ipairs(items) do
    work:send(item)
end
work:close()

-- Collect results
local processed = {}
while #processed < #items do
    local result, ok = results:receive()
    if not ok then break end
    table.insert(processed, result)
end
```

루프가 끝나면 `processed`에는 `2`, `4`, `6`, `8`이 포함되며 결과 순서는 코루틴 스케줄링에 따라 달라집니다. 워커는 같은 Lua 프로세스의 코루틴이므로 채널을 공유합니다.

## 에러

| 조건 | 종류 | 재시도 가능 |
|------|------|-----------|
| 닫힌 채널에 전송 | 런타임 오류 | 해당 없음 |

## 참고

- [프로세스 관리](lua/core/process.md) - 프로세스 스폰과 통신
- [메시지 큐](lua/storage/queue.md) - 큐 기반 메시징
- [함수](lua/core/funcs.md) - 함수 호출
