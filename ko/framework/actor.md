# Actor

`wippy/actor` 모듈은 Lua 프로세스를 토픽 라우팅 기반의 액터로 바꾸는 메시지 전달 동시성 라이브러리를 제공합니다. 핸들러는 메시지 토픽으로 조회되며, 라이브러리는 단일 `channel.select` 루프를 통해 프로세스 받은편지함, 시스템 이벤트, 내부 비동기 결과 및 추가 채널을 다중화합니다.

## 설정

```bash
wippy add wippy/actor
wippy install
```

라이브러리를 의존성으로 선언하고 필요한 곳에서 임포트합니다:

```yaml
- name: dep.actor
  kind: ns.dependency
  component: wippy/actor
  version: "*"

- name: counter_process
  kind: process.lua
  source: file://counter.lua
  method: main
  modules:
    - time
  imports:
    actor: wippy.actor:actor
```

## 기본 사용법

```lua
local actor = require("actor")

local initial_state = { counter = 0 }

local handlers = {
    increment = function(state, payload, topic, from)
        state.counter = state.counter + (payload.amount or 1)
    end,

    get_count = function(state, payload, topic, from)
        process.send(from, "count_result", { count = state.counter })
    end,

    stop = function(state)
        return actor.exit({ final_count = state.counter })
    end,
}

local function main()
    return actor.new(initial_state, handlers):run()
end

return { main = main }
```

`actor.new(state, handlers)`는 액터 인스턴스를 반환합니다. `run()`은 핸들러가 `actor.exit(...)`를 반환하거나 프로세스가 취소될 때까지 select 루프를 구동합니다.

## 핸들러

`handlers` 테이블에서 이름이 `__`로 시작하지 않는 모든 키는 토픽 핸들러입니다. 핸들러는 `(state, payload, topic, from)`을 받습니다.

### 특수 핸들러

| 이름 | 실행 시점 |
|------|--------------|
| `__init` | select 루프가 시작되기 전 한 번 |
| `__default` | 일치하는 핸들러가 없는 토픽 |
| `__on_event` | 모든 프로세스 이벤트(취소 포함) |
| `__on_cancel` | 프로세스 취소 이벤트(`__on_event` 이후 호출) |
| `__on_internal_message` | `state.async`가 전달한 결과 |

## 제어 흐름

### Exit

```lua
return actor.exit({ reason = "done", data = state.data })
```

루프를 중지하고 해당 값으로 `run()`을 완료합니다.

### Chain

```lua
return actor.next("process", payload)
```

현재 메시지를 새로운 토픽으로 재디스패치합니다. `payload`가 `nil`이면 이전 payload가 이어서 사용됩니다. 중첩된 `if` 없이 검증 -> 처리 파이프라인을 만들 때 유용합니다.

## 상태 메서드

`actor.new`는 state 테이블에 헬퍼를 부착합니다. 이들은 어떤 핸들러에서도 사용할 수 있습니다.

| 메서드 | 설명 |
|--------|-------------|
| `state.add_handler(topic, fn)` | 런타임에 핸들러 등록 |
| `state.remove_handler(topic)` | 이전에 추가한 핸들러 제거 |
| `state.register_channel(ch, fn)` | 추가 채널을 루프에 다중화; 수신 시마다 `fn(state, value, ok, channel_id)` 실행 |
| `state.unregister_channel(ch)` | 해당 채널 수신 중지 |
| `state.async(fn)` | 새 코루틴에서 `fn` 실행; `actor.next(...)`를 반환하면 결과가 액터에 다시 전달됨 |
| `state.wait(topic, timeout_ms)` | 타임아웃이 있는 토픽 리스너 블로킹 대기; `(value, err)` 반환 |
| `state.next(topic, payload)` | `actor.next`의 별칭 |

## 이벤트 및 취소

루프는 자동으로 프로세스 이벤트를 수신합니다. 반응하려면 `__on_event`(또는 더 구체적인 `__on_cancel`)를 재정의하세요:

```lua
__on_cancel = function(state, event, kind, from)
    return actor.exit({ reason = "cancelled", items = state.items })
end,
```

사용자 정의 핸들러가 없어도 취소 이벤트는 -- 기본 이벤트 배선을 통해 -- 액터를 종료시키지만, 사용자 정의 정리는 실행되지 않습니다.

## 전체 예제

```lua
local actor = require("actor")

local handlers = {
    __init = function(state)
        state.items = {}
        state.async(function() return actor.next("ready", {}) end)
    end,

    ready = function(state)
        process.send(state.parent, "actor_ready", { pid = process.pid() })
    end,

    subscribe = function(state, _, _, from)
        state.subscriber = from
    end,

    add_item = function(state, payload)
        table.insert(state.items, payload.item)
        return actor.next("notify_change", {})
    end,

    notify_change = function(state)
        if state.subscriber then
            process.send(state.subscriber, "items_changed", { count = #state.items })
        end
    end,

    get_items = function(state, _, _, from)
        process.send(from, "items_list", { items = state.items })
    end,

    __on_cancel = function(state)
        return actor.exit({ items = state.items })
    end,
}

local function main()
    return actor.new({ parent = process.parent() }, handlers):run()
end

return { main = main }
```

## 참고

- [Process](../lua/core/process.md) - 받은편지함, 이벤트, send/spawn 프리미티브
- [Channels](../lua/core/channel.md) - 내부적으로 사용되는 채널 및 select 프리미티브
- [프레임워크 개요](overview.md) - 프레임워크 모듈 사용
