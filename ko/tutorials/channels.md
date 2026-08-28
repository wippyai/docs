---
title: "채널과 동시성 입문"
description: "채널 연산과 코루틴 조정 패턴을 살펴봅니다."
---

# 채널과 동시성 입문

이 페이지에서는 한 프로세스 안에서 코루틴을 조정하는 채널을 소개합니다. 버퍼링, 선택, 생산자-소비자 흐름, 팬아웃, 팬인, 채널 닫기를 예제로 다룹니다.

**분류:** 참조/API 입문서. 각 코드 조각은 서로 독립적인 예제이며, 하나의 독립 실행형 애플리케이션을 구성하지 않습니다.

## 실행 환경과 의존성

이 코드 조각들은 `process.lua` 같은 실행 가능한 Lua 엔트리의 내보낸 함수 안에서 실행하세요. 해당 실행 환경에서는 `channel`과 `coroutine` API가 전역으로 제공되므로 `require()` 호출이나 `modules` 선언이 필요하지 않습니다. 각 코드 조각은 자체 채널을 생성하므로 서로 따로 실행해야 합니다.

## 채널 생성

채널은 코루틴 사이에 값을 전달합니다. `channel.new(capacity)`로 채널을 만듭니다.

```lua
local ch = channel.new(1)  -- buffered channel, capacity 1
```

### 버퍼 채널

버퍼 채널로 보내는 연산은 버퍼가 가득 찬 경우에만 블로킹됩니다.

```lua
local ch = channel.new(3)  -- buffer holds 3 items

-- Send without blocking
ch:send(1)
ch:send(2)
ch:send(3)

-- Receive in FIFO order
local v1, ok1 = ch:receive()  -- 1, true
local v2, ok2 = ch:receive()  -- 2, true
local v3, ok3 = ch:receive()  -- 3, true
```

### 비버퍼 채널

비버퍼 채널(용량 0)은 송신자와 수신자를 동기화합니다.

```lua
local ch = channel.new(0)  -- unbuffered
local done = channel.new(1)

coroutine.spawn(function()
    ch:send("from spawn")  -- blocks until receiver ready
    done:send(true)
end)

local val = ch:receive()  -- receives "from spawn"
local completed = done:receive()
```

## 채널 선택

`channel.select`는 여러 채널 연산을 기다린 뒤 가장 먼저 준비된 연산을 반환합니다.

```lua
local ch1 = channel.new(1)
local ch2 = channel.new(1)

ch1:send("ch1_value")

local result = channel.select{
    ch1:case_receive(),
    ch2:case_receive()
}

-- result is a table with: channel, value, ok
result.channel == ch1  -- true
result.value           -- "ch1_value"
result.ok              -- true
```

### 보내기 연산 선택

`case_send`를 사용하면 선택 대상에 보내기 연산을 포함할 수 있습니다. 기본 사례가 없으면 `channel.select`는 사례 중 하나가 준비될 때까지 기다립니다. 시도를 논블로킹으로 만들려면 `default = true`를 추가하세요.

```lua
local ch = channel.new(1)

local result = channel.select{
    ch:case_send("sent"),
    default = true
}

if not result.default then
    result.ok  -- true (send succeeded)
end

local v = ch:receive()  -- "sent"
```

## 생산자-소비자 패턴

생산자 하나와 소비자 하나를 사용하는 패턴입니다.

```lua
local ch = channel.new(5)
local done = channel.new(1)
local consumed = 0

-- Consumer
coroutine.spawn(function()
    while true do
        local v, ok = ch:receive()
        if not ok then break end
        consumed = consumed + 1
    end
    done:send(consumed)
end)

-- Producer
for i = 1, 10 do
    ch:send(i)
end
ch:close()

local total = done:receive()  -- 10
```

### 핑퐁 패턴

두 코루틴을 동기화합니다.

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

## 팬아웃 패턴

생산자 하나와 소비자 여러 개를 사용하는 패턴입니다.

```lua
local work = channel.new(10)
local results = channel.new(10)

-- Spawn 3 workers
for w = 1, 3 do
    coroutine.spawn(function()
        while true do
            local job, ok = work:receive()
            if not ok then break end
            results:send(job * 2)
        end
    end)
end

-- Send work
for i = 1, 6 do
    work:send(i)
end
work:close()

-- Collect results
local sum = 0
for i = 1, 6 do
    local r = results:receive()
    sum = sum + r
end
-- sum = (1+2+3+4+5+6)*2 = 42
```

## 팬인 패턴

생산자 여러 개와 소비자 하나를 사용하는 패턴입니다.

```lua
local output = channel.new(10)
local producer_count = 4
local items_per_producer = 5

-- Spawn producers
for p = 1, producer_count do
    local producer_id = p
    coroutine.spawn(function()
        for i = 1, items_per_producer do
            output:send({producer = producer_id, item = i})
        end
    end)
end

-- Collect all messages
local received = {}
for i = 1, producer_count * items_per_producer do
    local msg = output:receive()
    table.insert(received, msg)
end

-- Verify all producers sent their items
local counts = {}
for _, msg in ipairs(received) do
    counts[msg.producer] = (counts[msg.producer] or 0) + 1
end
```

## 채널 닫기

완료를 알리려면 채널을 닫습니다. 채널이 닫혀 있고 비어 있으면 수신자는 `ok = false`를 받습니다.

```lua
local ch = channel.new(5)
local done = channel.new(1)

coroutine.spawn(function()
    local count = 0
    while true do
        local v, ok = ch:receive()
        if not ok then break end  -- channel closed
        count = count + 1
    end
    done:send(count)
end)

for i = 1, 10 do
    ch:send(i)
end
ch:close()  -- signal no more values

local total = done:receive()
```

## 채널 메서드

채널 연산은 다음과 같습니다.

- `channel.new(capacity)` — 지정한 버퍼 크기의 채널을 생성합니다.
- `ch:send(value)` — 값을 보냅니다. 버퍼가 가득 차면 블로킹되며, 닫힌 채널로 보내면 오류가 발생합니다.
- `ch:receive()` — 값을 받고 `value, ok`를 반환합니다.
- `ch:close()` — 채널을 닫습니다. 이미 닫힌 채널을 다시 닫으면 오류가 발생합니다.
- `ch:case_send(value)` — `select`에 사용할 보내기 사례를 만듭니다.
- `ch:case_receive()` — `select`에 사용할 받기 사례를 만듭니다.
- `channel.select{cases...}` — 여러 연산을 기다린 뒤 `channel`, `value`, `ok`를 반환합니다.
- `channel.select{cases..., default = true}` — 준비된 사례가 없으면 즉시 `{default = true, ok = true}`를 반환합니다.

## 다음 단계

- [채널 모듈 참조](lua/core/channel.md) — 채널 API 문서
- [프로세스](tutorials/processes.md) — 프로세스 간 통신
