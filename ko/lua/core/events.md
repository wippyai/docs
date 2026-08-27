---
title: "이벤트 버스"
description: "best-effort runtime 및 application event를 publish하고 observe합니다."
---

# 이벤트 버스
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="permissions"/>

event bus는 monitoring, logging, metric, reactive side effect를 위해 runtime과 application activity를 publish합니다. 이 페이지는 API reference이며 snippet은 나열된 module과 permission을 가진 executable Lua entry를 가정합니다.

<note>
event bus는 reliable transport가 아니라 best-effort publish/subscribe channel입니다. business-critical delivery에 의존하지 마십시오. delivery가 application correctness의 일부라면 process messaging(`process.send`), channel 또는 [message queue](../storage/queue.md)를 사용하십시오.
</note>

## 로딩

```lua
local events = require("events")
```

## 이벤트 구독

optional event-kind filter와 함께 하나의 system 또는 system pattern을 구독합니다.

```lua
-- Subscribe to all order events
local sub, err = events.subscribe("orders.*")
if err then
    return nil, err
end

-- Process events
local ch = sub:channel()
while true do
    local evt, ok = ch:receive()
    if not ok then break end

    print(evt.system, evt.kind, evt.path)
    -- Process evt.data when the publisher supplied a payload.
end
```

두 번째 argument를 전달하면 하나의 kind로 delivery를 제한할 수 있습니다. 예: `events.subscribe("users", "user.created")`. kind를 생략하면 matching system의 모든 kind를 받습니다.

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `system` | string | 시스템 패턴 ("test.*"와 같은 와일드카드 지원) |
| `kind` | string | 이벤트 종류 필터 (선택적) |

**반환:** `Subscription, error`

## 이벤트 전송

이벤트 버스에 이벤트를 전송합니다:

```lua
-- Send order created event
local ok, err = events.send("orders", "order.created", "/orders/123", {
    order_id = "123",
    customer_id = "456",
    total = 99.99
})
if err then
    return nil, err
end

-- Send without data
local heartbeat_sent, heartbeat_err = events.send("system", "heartbeat", "/health")
if heartbeat_err then
    return nil, heartbeat_err
end
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `system` | string | 시스템 식별자 |
| `kind` | string | 이벤트 종류/타입 |
| `path` | string | 라우팅을 위한 이벤트 경로 |
| `data` | any | 이벤트 페이로드 (선택적) |

**반환:** `boolean, error`

성공 return은 runtime이 send를 수락했음을 확인할 뿐 subscriber가 event를 받거나 처리했음을 확인하지 않습니다.

## 구독 메서드

### 채널 가져오기

이벤트를 받기 위한 채널 가져오기:

```lua
local json = require("json")
local ch = sub:channel()

local evt, ok = ch:receive()
if ok then
    print("System:", evt.system)
    print("Kind:", evt.kind)
    print("Path:", evt.path)
    local encoded, encode_err = json.encode(evt.data)
    if encode_err then return nil, encode_err end
    print("Data:", encoded)
end
```

각 event에는 `system`, `kind`, `path`가 포함됩니다. `data` field는 publisher가 non-nil payload를 제공한 경우에만 존재합니다.

### 구독 닫기

구독 해제하고 채널을 닫습니다:

```lua
local closed = sub:close() -- true
```

close는 idempotent합니다. channel이 닫힌 후 buffered event를 모두 drain하면 `receive()`가 `nil, false`를 반환합니다.

## 권한

| 액션 | 리소스 | 설명 |
|------|--------|------|
| `events.subscribe` | system | 시스템에서 이벤트 구독 |
| `events.send` | system | 시스템에 이벤트 전송 |

## 에러

| 조건 | 종류 | 재시도 가능 |
|------|------|-------------|
| 빈 system | `errors.INVALID` | 아니오 |
| 빈 send kind | `errors.INVALID` | 아니오 |
| 빈 path | `errors.INVALID` | 아니오 |
| 정책 거부됨 | `errors.INVALID` | 아니오 |
| execution 또는 process context 없음 | `errors.INTERNAL` | 아니오 |

[에러 처리](./errors.md)에서 error 사용법을 확인하십시오.
