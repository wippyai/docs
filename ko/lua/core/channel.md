# 채널과 코루틴
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>


코루틴 간 통신을 위한 Go 스타일 채널. 버퍼드 또는 언버퍼드 채널을 생성하고, 값을 보내고 받고, select 문을 사용하여 동시 프로세스 간에 조율합니다.

`channel` 전역은 항상 사용 가능합니다.

## 채널 생성

언버퍼드 채널(크기 0)은 전송이 완료되기 전에 송신자와 수신자 모두 준비되어야 합니다. 버퍼드 채널은 공간이 있는 동안 즉시 전송을 완료할 수 있습니다:

```lua
-- 언버퍼드: 송신자와 수신자 동기화
local sync_ch = channel.new()

-- 버퍼드: 최대 10개 메시지 큐
local work_queue = channel.new(10)
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `size` | integer | 버퍼 용량 (기본값: 0, 언버퍼드) |

**반환:** `channel`

## 값 보내기

채널에 값을 보냅니다. 수신자가 준비될 때까지(언버퍼드) 또는 버퍼 공간이 있을 때까지(버퍼드) 블록합니다:

```lua
-- 워커 풀에 작업 전송
local jobs = channel.new(100)
for i, task in ipairs(tasks) do
    jobs:send(task)  -- 버퍼가 가득 차면 블록
end
jobs:close()  -- 더 이상 작업 없음 신호
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `value` | any | 보낼 값 |

**반환:** `boolean`

채널이 닫혀 있으면 에러 발생.

## 값 받기

채널에서 값을 받습니다. 값이 있거나 채널이 닫힐 때까지 블록합니다:

```lua
-- 작업 큐에서 소비하는 워커
while true do
    local job, ok = work:receive()
    if not ok then
        break  -- 채널 닫힘, 더 이상 작업 없음
    end
    process(job)
end
```

**반환:** `any, boolean`

- `value, true` - 값을 받음
- `nil, false` - 채널 닫히고 비어있음

## 채널 닫기

채널을 닫습니다. 대기 중인 송신자는 에러를 받고, 대기 중인 수신자는 `nil, false`를 받습니다. 이미 닫혀 있으면 에러 발생:

```lua
local results = channel.new(10)

-- 생산자가 결과 채움
for _, item in ipairs(data) do
    results:send(process(item))
end
results:close()  -- 완료 신호
```

## 여러 채널에서 Select

여러 채널 작업을 동시에 대기합니다. 여러 이벤트 소스 처리, 타임아웃 구현, 반응형 시스템 구축에 필수적:

```lua
local result = channel.select(cases)
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `cases` | table | select 케이스 배열 |
| `default` | boolean | true이면 준비된 케이스가 없을 때 즉시 반환 |

**반환:** `table` - 필드: `channel`, `value`, `ok`, `default`

### 타임아웃 패턴

`time.after()`를 사용하여 타임아웃과 함께 결과 대기.

```lua
local time = require("time")

local result_ch = worker:response()
local timeout = time.after("5s")

local r = channel.select {
    result_ch:case_receive(),
    timeout:case_receive()
}

if r.channel == timeout then
    return nil, errors.new("TIMEOUT", "Operation timed out")
end
return r.value
```

### Fan-in 패턴

여러 소스를 하나의 핸들러로 병합.

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

블로킹 없이 데이터가 있는지 확인.

```lua
local r = channel.select {
    ch:case_receive(),
    default = true
}

if r.default then
    -- 사용 가능한 것 없음, 다른 것 수행
else
    process(r.value)
end
```

## Select 케이스 생성

`channel.select`와 함께 사용할 케이스 생성:

```lua
-- Send 케이스 - 채널이 값을 받을 수 있을 때 완료
ch:case_send(value)

-- Receive 케이스 - 값이 있을 때 완료
ch:case_receive()
```

## 워커 풀 패턴

```lua
local work = channel.new(100)
local results = channel.new(100)

-- 워커 스폰
for i = 1, num_workers do
    process.spawn("app.workers:processor", "app:processes", work, results)
end

-- 작업 공급
for _, item in ipairs(items) do
    work:send(item)
end
work:close()

-- 결과 수집
local processed = {}
while #processed < #items do
    local result, ok = results:receive()
    if not ok then break end
    table.insert(processed, result)
end
```

## 에러

| 조건 | 종류 | 재시도 가능 |
|------|------|-----------|
| 닫힌 채널에 Send | 런타임 에러 | 아니오 |
| 닫힌 채널 Close | 런타임 에러 | 아니오 |
| select에서 잘못된 케이스 | 런타임 에러 | 아니오 |

## 참고

- [프로세스 관리](lua/core/process.md) - 프로세스 스폰과 통신
- [메시지 큐](lua/storage/queue.md) - 큐 기반 메시징
- [함수](lua/core/funcs.md) - 함수 호출
