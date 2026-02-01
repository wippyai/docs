# 채널과 동시성

프로세스 내 동시 프로그래밍을 위한 Go 스타일 채널.

## 채널 생성

채널은 코루틴 간 통신 파이프입니다. `channel.new(capacity)`로 생성합니다:

```lua
local ch = channel.new(1)  -- 버퍼드 채널, 용량 1
```

### 버퍼드 채널

버퍼드 채널은 버퍼가 가득 찰 때까지 블로킹 없이 전송을 허용합니다:

```lua
local ch = channel.new(3)  -- 버퍼가 3개 항목 보유

-- 블로킹 없이 전송
ch:send(1)
ch:send(2)
ch:send(3)

-- FIFO 순서로 수신
local v1, ok1 = ch:receive()  -- 1, true
local v2, ok2 = ch:receive()  -- 2, true
local v3, ok3 = ch:receive()  -- 3, true
```

### 언버퍼드 채널

언버퍼드 채널(용량 0)은 송신자와 수신자를 동기화합니다:

```lua
local ch = channel.new(0)  -- 언버퍼드
local done = channel.new(1)

coroutine.spawn(function()
    ch:send("from spawn")  -- 수신자 준비될 때까지 블록
    done:send(true)
end)

local val = ch:receive()  -- "from spawn" 수신
local completed = done:receive()
```

## 채널 Select

`channel.select`는 여러 채널에서 대기하고 첫 번째 준비된 작업을 반환합니다:

```lua
local ch1 = channel.new(1)
local ch2 = channel.new(1)

ch1:send("ch1_value")

local result = channel.select{
    ch1:case_receive(),
    ch2:case_receive()
}

-- result는 channel, value, ok를 가진 테이블
result.channel == ch1  -- true
result.value           -- "ch1_value"
result.ok              -- true
```

### Send를 포함한 Select

`case_send`를 사용하여 논블로킹 전송을 시도합니다:

```lua
local ch = channel.new(1)

local result = channel.select{
    ch:case_send("sent")
}

result.ok  -- true (전송 성공)

local v = ch:receive()  -- "sent"
```

## 생산자-소비자 패턴

단일 생산자, 단일 소비자:

```lua
local ch = channel.new(5)
local done = channel.new(1)
local consumed = 0

-- 소비자
coroutine.spawn(function()
    while true do
        local v, ok = ch:receive()
        if not ok then break end
        consumed = consumed + 1
    end
    done:send(consumed)
end)

-- 생산자
for i = 1, 10 do
    ch:send(i)
end
ch:close()

local total = done:receive()  -- 10
```

### 핑퐁 패턴

두 코루틴을 동기화합니다:

```lua
local ping = channel.new(0)
local pong = channel.new(0)
local rounds_done = channel.new(1)

coroutine.spawn(function()
    for i = 1, 5 do
        ping:receive()
        pong:send("pong")
    end
    rounds_done:send(true)
end)

for i = 1, 5 do
    ping:send("ping")
    pong:receive()
end

local completed = rounds_done:receive()
```

## Fan-Out 패턴

하나의 생산자, 여러 소비자:

```lua
local work = channel.new(10)
local results = channel.new(10)

-- 3개의 워커 스폰
for w = 1, 3 do
    coroutine.spawn(function()
        while true do
            local job, ok = work:receive()
            if not ok then break end
            results:send(job * 2)
        end
    end)
end

-- 작업 전송
for i = 1, 6 do
    work:send(i)
end
work:close()

-- 결과 수집
local sum = 0
for i = 1, 6 do
    local r = results:receive()
    sum = sum + r
end
-- sum = (1+2+3+4+5+6)*2 = 42
```

## Fan-In 패턴

여러 생산자, 단일 소비자:

```lua
local output = channel.new(10)
local producer_count = 4
local items_per_producer = 5

-- 생산자 스폰
for p = 1, producer_count do
    coroutine.spawn(function()
        for i = 1, items_per_producer do
            output:send({producer = p, item = i})
        end
    end)
end

-- 모든 메시지 수집
local received = {}
for i = 1, producer_count * items_per_producer do
    local msg = output:receive()
    table.insert(received, msg)
end

-- 모든 생산자가 항목을 보냈는지 확인
local counts = {}
for _, msg in ipairs(received) do
    counts[msg.producer] = (counts[msg.producer] or 0) + 1
end
```

## 채널 닫기

완료를 알리기 위해 채널을 닫습니다. 수신자는 채널이 닫히고 비어있을 때 `ok = false`를 받습니다:

```lua
local ch = channel.new(5)
local done = channel.new(1)

coroutine.spawn(function()
    local count = 0
    while true do
        local v, ok = ch:receive()
        if not ok then break end  -- 채널 닫힘
        count = count + 1
    end
    done:send(count)
end)

for i = 1, 10 do
    ch:send(i)
end
ch:close()  -- 더 이상 값이 없음을 알림

local total = done:receive()
```

## 채널 메서드

사용 가능한 작업:

- `channel.new(capacity)` - 버퍼 크기로 채널 생성
- `ch:send(value)` - 값 전송 (버퍼가 가득 차면 블록)
- `ch:receive()` - 값 수신, `value, ok` 반환
- `ch:close()` - 채널 닫기
- `ch:case_send(value)` - select를 위한 전송 케이스 생성
- `ch:case_receive()` - select를 위한 수신 케이스 생성
- `channel.select{cases...}` - 여러 작업에서 대기

## 다음 단계

- [채널 모듈 참조](lua-channel.md) - 완전한 API 문서
- [프로세스](processes.md) - 프로세스 간 통신
