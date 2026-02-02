# WebSocket 릴레이

WebSocket 릴레이 미들웨어는 HTTP 연결을 WebSocket으로 업그레이드하고 대상 프로세스로 메시지를 릴레이합니다.

## 작동 방식

1. HTTP 핸들러가 대상 프로세스 PID와 함께 `X-WS-Relay` 헤더 설정
2. 미들웨어가 연결을 WebSocket으로 업그레이드
3. 릴레이가 대상 프로세스에 연결하고 모니터링
4. 메시지가 클라이언트와 프로세스 간에 양방향으로 흐름

<warning>
WebSocket 연결은 대상 프로세스에 바인딩됩니다. 프로세스가 종료되면 연결이 자동으로 닫힙니다.
</warning>

## 프로세스 시맨틱스

WebSocket 연결은 자체 PID를 가진 완전한 프로세스입니다. 프로세스 시스템과 통합됩니다:

- **주소 지정 가능** → 모든 프로세스가 WebSocket PID로 메시지 전송 가능
- **모니터링 가능** → 프로세스가 종료 이벤트를 위해 WebSocket 연결 모니터링 가능
- **연결 가능** → WebSocket 연결을 다른 프로세스에 연결 가능
- **EXIT 이벤트** → 연결이 닫히면 모니터가 종료 알림 수신

```lua
-- 다른 프로세스에서 WebSocket 연결 모니터링
process.monitor(websocket_pid)

-- 모든 프로세스에서 WebSocket 클라이언트로 메시지 전송
process.send(websocket_pid, "ws.send", {type = "text", data = "hello"})
```

<tip>
릴레이는 대상 프로세스를 모니터링합니다. 대상이 종료되면 WebSocket 연결이 자동으로 닫히고 클라이언트는 종료 프레임을 받습니다.
</tip>

## 연결 전송

제어 메시지를 보내 연결을 다른 프로세스로 전송할 수 있습니다:

```lua
process.send(websocket_pid, "ws.control", {
    target_pid = new_process_pid,
    message_topic = "ws.message"
})
```

## 설정

라우터에 매칭 후 미들웨어로 추가:

```yaml
- name: ws_router
  kind: http.router
  meta:
    server: gateway
  prefix: /ws
  post_middleware:
    - websocket_relay
  post_options:
    wsrelay.allowed.origins: "https://app.example.com"
```

| 옵션 | 설명 |
|--------|-------------|
| `wsrelay.allowed.origins` | 쉼표로 구분된 허용 오리진 |

<note>
오리진이 설정되지 않으면 same-origin 요청만 허용됩니다.
</note>

## 핸들러 설정

HTTP 핸들러가 프로세스를 스폰하고 릴레이를 설정합니다:

```lua
local http = require("http")
local json = require("json")

local function handler()
    local req = http.request()
    local res = http.response()

    -- 핸들러 프로세스 스폰
    local pid = process.spawn("app.ws:handler", "app:processes")

    -- 릴레이 설정
    res:header("X-WS-Relay", json.encode({
        target_pid = tostring(pid),
        message_topic = "ws.message",
        heartbeat_interval = "30s",
        metadata = {
            user_id = req:query("user_id")
        }
    }))
end
```

### 릴레이 설정 필드

| 필드 | 타입 | 기본값 | 설명 |
|-------|------|---------|-------------|
| `target_pid` | string | 필수 | 메시지를 받을 프로세스 PID |
| `message_topic` | string | `ws.message` | 클라이언트 메시지의 토픽 |
| `heartbeat_interval` | duration | - | 하트비트 빈도 (예: `30s`) |
| `metadata` | object | - | 모든 메시지에 첨부 |

## 메시지 토픽

릴레이가 대상 프로세스에 보내는 메시지:

| 토픽 | 시점 | 페이로드 |
|-------|------|---------|
| `ws.join` | 클라이언트 연결 시 | `client_pid`, `metadata` |
| `ws.message` | 클라이언트 메시지 전송 시 | `client_pid`, `type`, `data`, `metadata` |
| `ws.heartbeat` | 주기적 (설정된 경우) | `client_pid`, `uptime`, `message_count` |
| `ws.leave` | 클라이언트 연결 해제 시 | `client_pid`, `reason`, `metadata` |

## 메시지 수신

```lua
local json = require("json")

local function handler()
    local inbox = process.inbox()

    while true do
        local msg, ok = inbox:receive()
        if not ok then break end

        local topic = msg:topic()
        local data = msg:payload():data()

        if topic == "ws.join" then
            -- 클라이언트 연결됨
            local client_pid = data.client_pid

        elseif topic == "ws.message" then
            -- 클라이언트 메시지 처리
            local content = json.decode(data.data)
            handle_message(data.client_pid, content)

        elseif topic == "ws.leave" then
            -- 클라이언트 연결 해제됨
            cleanup(data.client_pid)
        end
    end
end
```

## 클라이언트로 전송

클라이언트 PID를 사용하여 메시지 반환:

```lua
-- 텍스트 메시지 전송
process.send(client_pid, "ws.send", {
    type = "text",
    data = json.encode({event = "update", value = 42})
})

-- 바이너리 전송
process.send(client_pid, "ws.send", {
    type = "binary",
    data = binary_content
})

-- 연결 종료
process.send(client_pid, "ws.close", {
    code = 1000,
    reason = "Session ended"
})
```

## 브로드캐스팅

여러 클라이언트에 브로드캐스트하기 위해 클라이언트 PID 추적:

```lua
local clients = {}

-- join 시
clients[client_pid] = true

-- leave 시
clients[client_pid] = nil

-- 브로드캐스트
local function broadcast(message)
    local data = json.encode(message)
    for pid, _ in pairs(clients) do
        process.send(pid, "ws.send", {type = "text", data = data})
    end
end
```

<tip>
복잡한 다중 방 시나리오의 경우 방별로 별도 핸들러 프로세스를 스폰하거나 방 멤버십을 추적하는 중앙 매니저 프로세스를 사용하세요.
</tip>

## 참고

- [미들웨어](http/middleware.md) - 미들웨어 설정
- [프로세스](lua/core/process.md) - 프로세스 메시징
- [WebSocket 클라이언트](lua/http/websocket.md) - 아웃바운드 WebSocket 연결
