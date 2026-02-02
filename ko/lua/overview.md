# Lua 런타임

I/O 바운드 및 비즈니스 로직 워크로드에 최적화된 Wippy의 주요 컴퓨트 런타임입니다. 코드는 메시지 전달로 통신하는 격리된 프로세스에서 실행됩니다. 공유 메모리도 락도 없습니다.

Wippy는 폴리글랏 런타임으로 설계되었습니다. Lua가 주요 언어이지만, 향후 버전에서는 컴퓨트 집약적이거나 특수한 워크로드를 위해 WebAssembly와 Temporal 통합을 통해 추가 언어를 지원할 예정입니다.

## 프로세스

Lua 코드는 **프로세스** 내에서 실행됩니다. 스케줄러가 관리하는 격리된 실행 컨텍스트입니다. 각 프로세스는:

- 자체 메모리 공간을 가집니다
- 블로킹 작업(I/O, 채널)에서 양보합니다
- 모니터링 및 감독할 수 있습니다
- 머신당 수천 개로 확장 가능합니다

<note>
일반적인 Lua 프로세스는 약 13 KB의 기본 메모리 오버헤드를 가집니다.
</note>

```lua
local pid = process.spawn("app.workers:handler", "app:processes")
process.send(pid, "task", {data = "work"})
```

생성, 링킹, 슈퍼비전은 [프로세스 관리](lua/core/process.md)를 참조하세요.

## 채널

통신을 위한 Go 스타일 채널:

```lua
local ch = channel.new()        -- 버퍼 없음
local buffered = channel.new(10)

ch:send(value)                  -- 수신될 때까지 블록
local val, ok = ch:receive()    -- 준비될 때까지 블록
```

select와 패턴은 [채널](lua/core/channel.md)을 참조하세요.

## 코루틴

프로세스 내에서 경량 코루틴 생성:

```lua
coroutine.spawn(function()
    local data = fetch_data()
    ch:send(data)
end)

do_other_work()  -- 즉시 계속
```

생성된 코루틴은 스케줄러가 관리합니다. 수동 yield/resume이 필요 없습니다.

## Select

여러 이벤트 소스 처리:

```lua
local r = channel.select {
    inbox:case_receive(),
    events:case_receive(),
    timeout:case_receive()
}

if r.channel == timeout then
    -- 타임아웃
elseif r.channel == events then
    handle_event(r.value)
else
    handle_message(r.value)
end
```

## 전역

require 없이 항상 사용 가능:

- `process` - 프로세스 관리 및 메시징
- `channel` - Go 스타일 채널
- `os` - 시간 및 시스템 함수
- `coroutine` - 경량 동시성

## 모듈

```lua
local json = require("json")
local sql = require("sql")
local http = require("http_client")
```

사용 가능한 모듈은 엔트리 설정에 따라 다릅니다. [엔트리 정의](lua/entries.md)를 참조하세요.

## 외부 라이브러리

Wippy는 Luau에서 영감을 받은 [점진적 타입 시스템](lua/types.md)과 함께 Lua 5.3 구문을 사용합니다. 타입은 일급 런타임 값입니다. 검증을 위해 호출 가능하고, 인자로 전달 가능하며, 인트로스펙션 가능합니다. Zod나 Pydantic 같은 스키마 라이브러리의 필요성을 대체합니다.

외부 Lua 라이브러리(LuaRocks 등)는 지원되지 않습니다. 런타임은 I/O, 네트워킹, 시스템 통합을 위한 내장 확장과 함께 자체 모듈 시스템을 제공합니다.

커스텀 확장은 내부 문서의 [모듈](internals/modules.md)을 참조하세요.

## 오류 처리

함수는 `result, error` 쌍을 반환합니다:

```lua
local data, err = json.decode(input)
if err then
    return nil, errors.wrap(err, "decode failed")
end
```

패턴은 [오류 처리](lua/core/errors.md)를 참조하세요.

## 다음은

- [엔트리 정의](lua/entries.md) - 엔트리 포인트 설정
- [채널](lua/core/channel.md) - 채널 패턴
- [프로세스 관리](lua/core/process.md) - 생성 및 슈퍼비전
- [함수](lua/core/funcs.md) - 프로세스 간 호출
