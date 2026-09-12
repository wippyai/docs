---
title: "Lua 런타임"
description: "Lua code가 Wippy process에서 실행되고 channel로 통신하며 module을 load하고 error를 처리하는 방식을 설명합니다."
---

# Lua 런타임

Lua는 I/O-bound work와 business logic을 위한 Wippy의 주 runtime입니다. code는 shared memory 대신 message passing으로 통신하는 isolated process에서 실행됩니다.

이 페이지는 conceptual overview입니다. code block은 독립된 reference snippet이며 `inbox`, `events`, `handle_message` 같은 이름은 surrounding application이 제공하는 value 또는 callback을 뜻합니다.

Lua의 design tradeoff와 WebAssembly와의 관계는 [Wippy가 Lua를 사용하는 이유](why-lua.md)를 참조하십시오.

## 프로세스

Lua 코드는 **프로세스** 내에서 실행됩니다. 스케줄러가 관리하는 격리된 실행 컨텍스트입니다. 각 프로세스는:

- 자체 memory space를 가집니다.
- I/O와 channel access 같은 blocking operation 중 yield합니다.
- monitor와 supervise가 가능합니다.
- 한 machine에서 수천 개의 다른 process와 함께 실행할 수 있습니다.

```lua
local pid, err = process.spawn("app.workers:handler", "app:processes")
if err then
    return nil, err
end

local sent, send_err = process.send(pid, "task", {data = "work"})
if send_err then
    return nil, send_err
end
```

executable Lua entry는 `process`를 ambient global로 받습니다. `modules` list에 추가하지 않고 `require("process")`로 load할 수도 있습니다. spawn, link, supervision은 [프로세스 관리](lua/core/process.md)를 참조하십시오.

## 채널

channel은 concurrent task 간 통신을 제공합니다.

```lua
local sync_ch = channel.new()   -- unbuffered
local buffered = channel.new(10)

buffered:send("work")           -- completes while buffer space is available
local val, ok = buffered:receive()  -- val is "work" and ok is true
```

`channel.select`와 pattern은 [채널](lua/core/channel.md)을 참조하십시오.

## 코루틴

프로세스 내에서 경량 코루틴 생성:

```lua
coroutine.spawn(function()
    local data = fetch_data()
    ch:send(data)
end)

do_other_work()  -- continues immediately
```

생성된 coroutine은 scheduler가 관리하므로 caller가 직접 yield하거나 resume하지 않습니다.

## Select

여러 이벤트 소스 처리:

```lua
local r = channel.select {
    inbox:case_receive(),
    events:case_receive(),
    timeout:case_receive()
}

if r.channel == timeout then
    -- timed out
elseif r.channel == events then
    handle_event(r.value)
else
    handle_message(r.value)
end
```

## 전역

다음 global은 `require` 없이 사용할 수 있으며 `modules:`에 나열할 필요가 없습니다.

- `channel` - Go 스타일 채널
- `payload` - 엔트리의 입력 payload
- `process` - process spawning, messaging, monitoring, lifecycle operation
- `print`, `subscribe`, `unsubscribe` - 로깅 및 pub/sub
- `os`, `table`, `math`, `string`, `coroutine`, `errors` - 표준 라이브러리

## 모듈

built-in runtime module 중 ambient가 아닌 것은 `require()`로 load하며 entry의 `modules:` allowlist에 있어야 합니다. executable entry는 `process`를 ambient global로 받으며 `require("process")`도 `modules:` 선언 없이 허용됩니다.

```lua
local process = require("process")
local json = require("json")
local sql = require("sql")
local http = require("http_client")
```

사용 가능한 module은 entry configuration에 따라 다릅니다. [엔트리 정의](lua/entries.md)를 참조하십시오.

Registry library도 같은 `require("alias")` syntax를 사용하지만 entry의 `imports:` map에 별도로 선언합니다.

## 언어와 라이브러리 지원

Wippy는 Luau에서 영감을 받은 [점진적 타입 시스템](lua/types.md)과 함께 Lua 5.3 syntax를 사용합니다. type은 validation에 사용하고 argument로 전달하며 runtime에 inspect할 수 있는 first-class runtime value입니다.

외부 Lua 라이브러리(LuaRocks 등)는 지원되지 않습니다. 런타임은 I/O, 네트워킹, 시스템 통합을 위한 내장 확장과 함께 자체 모듈 시스템을 제공합니다.

custom extension은 internals 문서의 [모듈](internals/modules.md)을 참조하십시오.

## 오류 처리

function은 일반적으로 `result, error` pair를 반환합니다.

```lua
local data, err = json.decode(input)
if err then
    return nil, errors.wrap(err, "decode failed")
end
```

이 snippet은 `json`이 entry의 `modules` list에 있고 `input`이 decode할 문자열을 포함한다고 가정합니다. pattern은 [오류 처리](lua/core/errors.md)를 참조하십시오.

## 다음은

- [엔트리 정의](lua/entries.md) - entry point 설정
- [채널](lua/core/channel.md) - channel pattern
- [프로세스 관리](lua/core/process.md) - spawning과 supervision
- [함수](lua/core/funcs.md) - cross-process call
