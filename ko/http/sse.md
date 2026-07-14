---
title: "Server-Sent Events"
description: "SSE 미들웨어는 Server-Sent Events 프로토콜을 사용하여 서버에서 HTTP 클라이언트로 이벤트를 스트리밍합니다."
---

# Server-Sent Events

SSE 미들웨어는 [Server-Sent Events](https://html.spec.whatwg.org/multipage/server-sent-events.html) 프로토콜을 사용하여 서버에서 HTTP 클라이언트로 이벤트를 스트리밍합니다.

두 가지 메커니즘이 제공됩니다: HTTP 핸들러에서의 **직접 스트리밍**과 `sse_relay` 미들웨어를 통한 **프로세스 기반 릴레이**입니다.

## 직접 스트리밍

`res:write_event()`를 사용하여 HTTP 핸들러에서 SSE 이벤트를 직접 전송합니다. 응답은 첫 호출 시 자동으로 SSE 모드로 전환되며 적절한 헤더가 설정됩니다.

```lua
local http = require("http")

local function handler()
    local res = http.response()

    res:write_event({name = "status", data = {state = "started"}})
    res:write_event({name = "progress", data = {percent = 50}})
    res:write_event({name = "status", data = {state = "complete"}})
end
```

각 이벤트는 `name`과 `data` 필드가 필요합니다. `data` 값은 자동으로 JSON으로 인코딩됩니다.

<tip>
직접 스트리밍은 진행률 업데이트와 같은 단기 요청-응답 흐름에 적합합니다. 백그라운드 프로세스가 관리하는 장기 연결에는 SSE Relay를 사용하세요.
</tip>

## SSE Relay

SSE Relay 미들웨어는 프로세스가 백킹하는 장기 SSE 스트림을 생성합니다. [WebSocket Relay](http/websocket-relay.md)와 동일한 릴레이 패턴을 따릅니다.

### 동작 방식

1. HTTP 핸들러가 JSON 릴레이 설정과 함께 `X-SSE-Relay` 헤더를 설정합니다
2. 미들웨어가 응답을 가로채고 SSE 세션을 생성합니다
3. 세션은 자체 PID를 가진 프로세스로 등록됩니다
4. 세션 PID로 전송된 메시지는 SSE 이벤트로 클라이언트에 전달됩니다

## 프로세스 시맨틱

SSE 스트림은 자체 PID를 가진 완전한 프로세스입니다. 프로세스 시스템과 통합됩니다:

- **주소 지정 가능** — 모든 프로세스가 스트림 PID로 메시지를 보낼 수 있음
- **모니터링 가능** — 프로세스가 종료 이벤트를 위해 SSE 스트림을 모니터링할 수 있음
- **연결 가능** — SSE 스트림은 다른 프로세스에 연결될 수 있음
- **EXIT 이벤트** — 스트림이 닫힐 때 모니터가 종료 알림을 받음

```lua
-- 모든 프로세스에서 SSE 클라이언트로 이벤트 전송
process.send(stream_pid, "sse.message", {event = "update", value = 42})

-- SSE 스트림 모니터링
process.monitor(stream_pid)
```

<tip>
릴레이는 대상 프로세스를 모니터링합니다. 대상이 종료되면 SSE 스트림이 자동으로 닫히고 클라이언트는 <code>done</code> 이벤트를 받습니다.
</tip>

## 설정

라우터에 post-match 미들웨어로 추가합니다:

```yaml
- name: sse_router
  kind: http.router
  meta:
    server: gateway
  prefix: /sse
  post_middleware:
    - sse_relay
  post_options:
    sserelay.allowed.origins: "https://app.example.com"
```

| 옵션 | 설명 |
|--------|-------------|
| `sserelay.allowed.origins` | 쉼표로 구분된 허용 origin (와일드카드 지원) |

<note>
origin이 설정되지 않으면 same-origin 요청만 허용됩니다.
</note>

## 핸들러 설정

HTTP 핸들러는 프로세스를 생성하고 릴레이를 설정합니다:

```lua
local http = require("http")
local json = require("json")

local function handler()
    local res = http.response()

    -- 핸들러 프로세스 생성
    local pid = process.spawn("app.sse:handler", "app:processes")

    -- 릴레이 설정
    res:set_header("X-SSE-Relay", json.encode({
        target_pid = tostring(pid),
        message_topic = "sse.message",
        heartbeat_interval = "30s",
        metadata = {
            user_id = http.request():query("user_id")
        }
    }))
end
```

### 릴레이 설정 필드

| 필드 | 타입 | 기본값 | 설명 |
|-------|------|---------|-------------|
| `target_pid` | string | — | 메시지를 받을 프로세스 PID (분리 모드는 생략) |
| `message_topic` | string | `sse.message` | 전달되는 이벤트의 토픽 필터 |
| `heartbeat_interval` | duration | `30s` | 하트비트 주기 (예: `30s`, `1m`) |
| `idle_timeout` | duration | — | 비활성 후 스트림 종료 |
| `hard_timeout` | duration | — | 절대 시간 후 스트림 종료 |
| `metadata` | object | — | join/leave/heartbeat 메시지에 첨부 |

## 관리(Managed) 모드와 분리(Detached) 모드

### 관리 모드

`target_pid`가 설정되면 릴레이는 관리 모드로 동작합니다:

- 대상 프로세스를 모니터링
- 연결 시 `sse.join`, 끊김 시 `sse.leave`를 전송
- 대상이 종료되면 스트림을 자동으로 닫음

### 분리 모드

`target_pid`가 생략되면 릴레이는 분리 모드로 시작합니다:

- 클라이언트에 `stream_pid`와 `message_topic`이 포함된 `ready` 이벤트를 발행
- 초기에는 모니터링되는 프로세스가 없음
- 프로세스가 나중에 `sse.control` 메시지로 연결할 수 있음

```lua
-- 분리 설정: target_pid 없음
res:set_header("X-SSE-Relay", json.encode({
    heartbeat_interval = "30s"
}))
```

클라이언트는 `ready` 이벤트를 수신합니다:

```json
{"stream_pid": "sse@node/abc123", "message_topic": "sse.message"}
```

## 메시지 토픽

릴레이는 스트림과 대상 프로세스 간 통신에 다음 토픽을 사용합니다:

| 토픽 | 방향 | 시점 | 페이로드 |
|-------|-----------|------|---------|
| `sse.join` | stream → target | 클라이언트 연결 | `client_pid`, `metadata` |
| `sse.message` | target → stream | 기본 이벤트 토픽 | SSE 이벤트로 전달됨 |
| `sse.heartbeat` | stream → target | 주기적 (설정된 경우) | `client_pid`, `uptime`, `message_count` |
| `sse.leave` | stream → target | 클라이언트 연결 끊김 | `client_pid`, `metadata` |
| `sse.control` | any → stream | 제어 명령 | 릴레이 설정 필드 |
| `sse.close` | any → stream | 강제 종료 | 선택적 사유 문자열 |

## 대상 프로세스에서 수신

```lua
local json = require("json")

local function handler()
    local inbox = process.inbox()

    while true do
        local msg, ok = inbox:receive()
        if not ok then break end

        local topic = msg:topic()
        local data = msg:payload():data()

        if topic == "sse.join" then
            local client_pid = data.client_pid

        elseif topic == "sse.heartbeat" then
            -- 주기적 헬스 체크

        elseif topic == "sse.leave" then
            cleanup(data.client_pid)
        end
    end
end
```

## 이벤트 전송

스트림 PID에 메시지를 보내 클라이언트에 이벤트를 전송합니다:

```lua
-- 기본 메시지 토픽으로 전송
process.send(stream_pid, "sse.message", {
    event = "update",
    value = 42
})

-- 스트림 강제 종료
process.send(stream_pid, "sse.close", "session expired")
```

설정된 `message_topic`으로 전송된 이벤트는 SSE 이벤트로 클라이언트에 전달됩니다. 토픽 이름이 SSE 이벤트 이름이 됩니다.

## 연결 전송

제어 메시지를 보내 대상 프로세스, 토픽 필터, 타임아웃을 동적으로 변경합니다:

```lua
process.send(stream_pid, "sse.control", {
    target_pid = tostring(new_pid),
    message_topic = "custom.topic",
    idle_timeout = "5m"
})
```

대상이 변경되면 릴레이는 이전 대상에 `sse.leave`를, 새 대상에 `sse.join`을 보냅니다. 재연결 없이 분리하려면 `target_pid`를 빈 문자열로 설정하세요.

## 참고

- [미들웨어](http/middleware.md) — 미들웨어 설정
- [WebSocket Relay](http/websocket-relay.md) — WebSocket 동등 기능
- [프로세스](lua/core/process.md) — 프로세스 메시징
