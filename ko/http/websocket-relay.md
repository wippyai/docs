---
title: "WebSocket 릴레이"
description: "WebSocket 릴레이 미들웨어는 HTTP 연결을 WebSocket으로 업그레이드하고 대상 프로세스로 메시지를 릴레이합니다."
---

# WebSocket 릴레이

`websocket_relay` 미들웨어는 HTTP 연결을 WebSocket으로 업그레이드하고 대상 프로세스로 메시지를 릴레이합니다.

## 작동 방식

1. HTTP 핸들러가 대상 프로세스 PID와 함께 `X-WS-Relay` 헤더 설정
2. 미들웨어가 연결을 WebSocket으로 업그레이드
3. 릴레이가 대상 프로세스에 연결하고 모니터링
4. 메시지가 클라이언트와 프로세스 간에 양방향으로 흐름

## 프로세스 시맨틱스

WebSocket 연결은 자체 PID를 가진 완전한 프로세스입니다. 프로세스 시스템과 통합됩니다:

- **주소 지정 가능** → 모든 프로세스가 WebSocket PID로 메시지 전송 가능
- **모니터링 가능** → 프로세스가 종료 이벤트를 위해 WebSocket 연결 모니터링 가능
- **연결 가능** → WebSocket 연결을 다른 프로세스에 연결 가능
- **EXIT 이벤트** → 연결이 닫히면 모니터가 종료 알림 수신

```lua
-- Monitor a WebSocket connection from another process
local _, monitor_err = process.monitor(websocket_pid)
if monitor_err then return nil, monitor_err end

-- Send a message to the WebSocket client from any process.
-- The relay wraps it as {topic, data} JSON; the topic name is arbitrary.
local _, send_err = process.send(websocket_pid, "update", "hello")
if send_err then return nil, send_err end
```

<tip>
릴레이는 대상 프로세스를 모니터링합니다. 대상이 종료되면 WebSocket 연결이 자동으로 닫히고 클라이언트는 종료 프레임을 받습니다.
</tip>

## 연결 전송

제어 메시지를 보내 연결을 다른 프로세스로 전송할 수 있습니다:

```lua
local _, transfer_err = process.send(websocket_pid, "ws.control", {
    target_pid = new_process_pid,
    message_topic = "ws.message"
})
if transfer_err then return nil, transfer_err end
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
    local req, req_err = http.request()
    if req_err then return nil, req_err end
    local res, res_err = http.response()
    if res_err then return nil, res_err end

    local user_id, query_err = req:query("user_id")
    if query_err then return nil, query_err end

    -- Spawn handler process
    local pid, spawn_err = process.spawn("app.ws:handler", "app:processes")
    if spawn_err then return nil, spawn_err end

    -- Configure relay
    local relay_config, encode_err = json.encode({
        target_pid = tostring(pid),
        message_topic = "ws.message",
        heartbeat_interval = "30s",
        metadata = {
            user_id = user_id
        }
    })
    if encode_err then
        local _, terminate_err = process.terminate(pid)
        return nil, terminate_err or encode_err
    end

    local header_err = res:set_header("X-WS-Relay", relay_config)
    if header_err then
        local _, terminate_err = process.terminate(pid)
        return nil, terminate_err or header_err
    end
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
| `ws.join` | 클라이언트 연결 시 | JSON `{client_pid, metadata}` |
| `ws.message` (또는 사용자의 `message_topic`) | 클라이언트 메시지 전송 시 | 원시 클라이언트 payload; `payload:data()`는 텍스트와 바이너리 모두 Lua 문자열을 반환하며 source PID는 클라이언트 PID |
| `ws.heartbeat` | 주기적 (설정된 경우) | JSON `{client_pid, uptime, message_count, metadata}` |
| `ws.leave` | 클라이언트 연결 해제 시 | JSON `{client_pid, metadata}` |

## 메시지 수신

```lua
local function handler()
    local inbox = process.inbox()

    while true do
        local msg, ok = inbox:receive()
        if not ok then break end

        local topic = msg:topic()
        local from = msg:from()                -- client connection PID

        if topic == "ws.join" then
            -- Client connected — payload is {client_pid, metadata}
            local data, payload_err = msg:payload():data()
            if payload_err then return nil, payload_err end
            local client_pid = data.client_pid

        elseif topic == "ws.message" then
            -- Raw client message; from() is the client PID
            local incoming = msg:payload()
            local frame_format = incoming:get_format()     -- "text/plain" or "application/octet-stream"
            local body, payload_err = incoming:data()      -- Lua string in either case
            if payload_err then return nil, payload_err end
            -- Decode or dispatch `body` according to `frame_format` and the
            -- application's protocol.

        elseif topic == "ws.leave" then
            -- Client disconnected — payload is {client_pid, metadata}
            -- Release application state associated with `from`.
        end
    end
end
```

## 클라이언트로 전송

클라이언트 PID로 응답을 보냅니다. 선택한 토픽은 `{topic, data}` JSON으로 래핑되어 하나의 WebSocket 텍스트 프레임으로 전달됩니다. 테이블과 문자열은 `data`에서 형태를 유지하고 Bytes payload는 base64로 인코딩됩니다. Lua `process.send`는 인자를 Lua-format payload로 내보내므로 Lua 문자열은 Bytes 분기를 사용하지 않습니다.

```lua
-- Send a structured message (any topic name)
local _, send_err = process.send(client_pid, "update", {event = "update", value = 42})
if send_err then return nil, send_err end

-- Close connection (payload is the close reason string)
local _, close_err = process.send(client_pid, "ws.close", "Session ended")
if close_err then return nil, close_err end
```

서버 -> 클라이언트의 예약된 토픽은 `ws.control` (릴레이 재구성) 및 `ws.close` (연결 종료) 입니다.

## 브로드캐스팅

여러 클라이언트에 브로드캐스트하기 위해 클라이언트 PID 추적:

```lua
local clients = {}

-- On join
clients[client_pid] = true

-- On leave
clients[client_pid] = nil

-- Broadcast
local function broadcast(message)
    for pid, _ in pairs(clients) do
        local _, send_err = process.send(pid, "broadcast", message)
        if send_err then return nil, send_err end
    end
    return true
end
```

<tip>
복잡한 다중 방 시나리오의 경우 방별로 별도 핸들러 프로세스를 스폰하거나 방 멤버십을 추적하는 중앙 매니저 프로세스를 사용하세요.
</tip>

## 참고

- [미들웨어](./middleware.md) - 미들웨어 설정
- [프로세스](../lua/core/process.md) - 프로세스 메시징
- [WebSocket 클라이언트](../lua/http/websocket.md) - 아웃바운드 WebSocket 연결
