---
title: "WebSocket 클라이언트"
description: "WebSocket 서버에 연결하고 메시지를 송수신하며 압축과 연결 종료를 제어합니다."
---

# WebSocket 클라이언트
<secondary-label ref="network"/>
<secondary-label ref="io"/>
<secondary-label ref="permissions"/>

`websocket` 모듈은 WebSocket 서버에 대한 양방향 클라이언트 연결을 생성합니다.

이 페이지는 부분적인 연결 및 구독 예제를 제공하는 API 레퍼런스입니다. 엔드포인트 URL, 토큰, 메시지 핸들러와 데이터는 애플리케이션이 제공합니다. 수명주기 예제는 모든 종료 및 확인된 오류 경로에서 클라이언트를 닫습니다.

## 로딩

```lua
local websocket = require("websocket")
```

불러오기 전에 실행 엔트리의 `modules:` 목록에 `websocket`을 추가하세요. 전역 `channel`은 항상 사용할 수 있으며 JSON과 타임아웃 예제에는 `json`과 `time`도 필요합니다.

## 연결

### `connect`

기본 옵션으로 WebSocket 연결을 엽니다.

```lua
local client, err = websocket.connect("wss://api.example.com/ws")
if err then
    return nil, err
end
```

옵션 테이블을 전달하여 연결을 구성합니다.

```lua
local client, err = websocket.connect("wss://api.example.com/ws", {
    headers = {
        ["Authorization"] = "Bearer " .. token
    },
    protocols = {"graphql-ws"},
    dial_timeout = "10s",
    read_timeout = "30s",
    compression = websocket.COMPRESSION.CONTEXT_TAKEOVER
})
if err then
    return nil, err
end
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `url` | string | WebSocket URL (ws:// 또는 wss://) |
| `options` | table | 연결 옵션 (선택적) |

**반환:** `Client, error`

#### 연결 옵션

| 옵션 | 타입 | 설명 |
|------|------|------|
| `headers` | table | 문자열-문자열 HTTP 핸드셰이크 헤더; 다른 항목은 무시됨 |
| `protocols` | table | WebSocket 서브프로토콜 문자열; 문자열이 아닌 항목은 무시됨 |
| `dial_timeout` | number/string | 연결 타임아웃; `0`은 런타임 전체 연결 기한을 적용하지 않음 |
| `read_timeout` | number/string | 메시지별 읽기 타임아웃; `0`은 비활성화 |
| `write_timeout` | number/string | Lua API에서 허용되지만 런타임 `v0.3.32a`에서는 적용되지 않음 |
| `compression` | number/string | `0`/`"disabled"`, `1`/`"context_takeover"`, `2`/`"no_context_takeover"`; 기본값은 비활성화 |
| `compression_threshold` | number | 압축 최소 크기(바이트, 0-104857600); `0`은 모드에 따라 기본값 사용 |
| `read_limit` | number | 최대 수신 메시지 크기(바이트, 0-134217728); `0`은 16 MiB 사용 |
| `channel_capacity` | number | 수신 채널 버퍼 (1-10000) |

**타임아웃 형식:** 숫자는 밀리초이며 문자열은 `"5s"`, `"1m"` 같은 Go duration 형식을 사용합니다.

잘못된 타임아웃 문자열과 범위를 벗어나거나 지원되지 않는 옵션 값은 무시되어 기본값이 유지됩니다.

## 메시지 보내기

### 텍스트 메시지

```lua
local json = require("json")

client:send("Hello, Server!")

-- Send JSON
local payload, encode_err = json.encode({
    type = "subscribe",
    channel = "orders"
})
if encode_err then return nil, encode_err end
client:send(payload)
```

### 바이너리 메시지

```lua
client:send(binary_data, websocket.BINARY)
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `data` | string | 메시지 내용 |
| `type` | number | `websocket.TEXT` (1) 또는 `websocket.BINARY` (2) |

`type`이 없거나 `websocket.TEXT` 또는 `websocket.BINARY`가 아니면 텍스트 메시지를 보냅니다. 호출은 전송 완료까지 yield하며 값을 반환하지 않습니다. 런타임 `v0.3.32a`에서는 전송 실패가 Lua로 반환되지 않습니다.

### Ping

```lua
client:ping()
```

호출은 ping 완료까지 yield하며 값을 반환하지 않습니다. 런타임 `v0.3.32a`에서는 ping 전송 실패가 Lua로 반환되지 않습니다.

## 메시지 받기

`channel()`은 수신 channel을 반환하고 `receive()`는 별칭입니다. 첫 호출은 런타임이 구독을 만드는 동안 yield하며, 이후 호출은 같은 channel을 즉시 반환합니다. 구독 실패는 `nil, error`를 반환하며 channel은 `channel.select`와 함께 사용할 수 있습니다.

### 기본 수신

```lua
local ch, err = client:channel()
if err then
    client:close()
    return nil, err
end

local msg, ok = ch:receive()
if ok then
    print("Type:", msg.type)  -- "text" or "binary"
    print("Data:", msg.data)
end

local _, close_err = client:close()
if close_err then return nil, close_err end
```

### 메시지 루프

```lua
local json = require("json")

local ch, err = client:channel()
if err then
    client:close()
    return nil, err
end

while true do
    local msg, ok = ch:receive()
    if not ok then
        break  -- Connection closed
    end

    if msg.type == "text" then
        local data, decode_err = json.decode(msg.data)
        if decode_err then
            client:close()
            return nil, decode_err
        end
        handle_message(data)
    end
end

local _, close_err = client:close()
if close_err then return nil, close_err end
```

### Select와 함께

```lua
local json = require("json")
local time = require("time")

local ch, ch_err = client:channel()
if ch_err then
    client:close()
    return nil, ch_err
end

local timeout, timeout_err = time.after("30s")
if timeout_err then
    client:close()
    return nil, timeout_err
end

while true do
    local r = channel.select {
        ch:case_receive(),
        timeout:case_receive()
    }

    if r.channel == timeout then
        client:ping()  -- Keep-alive
        timeout, timeout_err = time.after("30s")
        if timeout_err then
            client:close()
            return nil, timeout_err
        end
    elseif not r.ok then
        break
    else
        local data, decode_err = json.decode(r.value.data)
        if decode_err then
            client:close()
            return nil, decode_err
        end
        process(data)
    end
end

local _, close_err = client:close()
if close_err then return nil, close_err end
```

### 메시지 객체

| 필드 | 타입 | 설명 |
|------|------|------|
| `type` | string | `"text"` 또는 `"binary"` |
| `data` | string? | 메시지 내용(알 수 없는 페이로드 타입의 경우 nil) |

## 연결 닫기

```lua
local _, close_err = client:close(websocket.CLOSE_CODES.NORMAL, "Session ended")
if close_err then return nil, close_err end

-- Omitting both arguments also uses normal close code 1000.
-- Use INTERNAL_ERROR with an application-owned reason for a failed session.
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `code` | number | 닫기 코드 (1000-4999), 기본값 1000 |
| `reason` | string | 닫기 이유 (선택적) |

호출은 닫기 명령이 완료될 때까지 yield합니다. 성공 시 값을 반환하지 않으며 실패 시 `nil, error`를 반환합니다. 범위를 벗어난 코드는 무시되고 기본 코드 `1000`이 사용됩니다.

수신 channel은 클라이언트가 소유하므로 직접 닫지 마세요. `client:close()`는 구독을 해제하고 클라이언트 측 producer를 중지합니다.

## 상수

### 메시지 타입

```lua
-- Numeric (for send)
websocket.TEXT    -- 1
websocket.BINARY  -- 2

-- Compatibility string constants
websocket.TYPE_TEXT    -- "text"
websocket.TYPE_BINARY  -- "binary"
websocket.TYPE_PING    -- "ping"
websocket.TYPE_PONG    -- "pong"
websocket.TYPE_CLOSE   -- "close"
```

수신 메시지 객체는 `"text"`와 `"binary"`만 사용합니다. ping/pong은 전송 계층이 처리하고 종료 이벤트는 `"close"` 메시지 대신 channel을 닫습니다.

### 압축 모드

```lua
websocket.COMPRESSION.DISABLED         -- 0 (no compression)
websocket.COMPRESSION.CONTEXT_TAKEOVER -- 1 (sliding window)
websocket.COMPRESSION.NO_CONTEXT       -- 2 (per-message)
```

### 닫기 코드

| 상수 | 코드 | 설명 |
|------|------|------|
| `NORMAL` | 1000 | 정상 종료 |
| `GOING_AWAY` | 1001 | 서버 종료 중 |
| `PROTOCOL_ERROR` | 1002 | 프로토콜 에러 |
| `UNSUPPORTED_DATA` | 1003 | 지원되지 않는 데이터 타입 |
| `RESERVED` | 1004 | 예약됨 |
| `NO_STATUS` | 1005 | 상태 수신되지 않음 |
| `ABNORMAL_CLOSURE` | 1006 | 연결 끊김 |
| `INVALID_PAYLOAD` | 1007 | 잘못된 프레임 페이로드 |
| `POLICY_VIOLATION` | 1008 | 정책 위반 |
| `MESSAGE_TOO_BIG` | 1009 | 메시지 너무 큼 |
| `MANDATORY_EXTENSION` | 1010 | 필수 확장이 협상되지 않음 |
| `INTERNAL_ERROR` | 1011 | 서버 에러 |
| `SERVICE_RESTART` | 1012 | 서버 재시작 중 |
| `TRY_AGAIN_LATER` | 1013 | 서버 과부하 |
| `BAD_GATEWAY` | 1014 | 게이트웨이 에러 |
| `TLS_HANDSHAKE` | 1015 | TLS 핸드셰이크 실패 |

```lua
local _, close_err = client:close(websocket.CLOSE_CODES.NORMAL, "Done")
if close_err then return nil, close_err end
```

## 예제

### 실시간 채팅

```lua
local json = require("json")

local function connect_chat(room_id, token, on_message)
    local client, err = websocket.connect("wss://chat.example.com/ws", {
        headers = {["Authorization"] = "Bearer " .. token}
    })
    if err then
        return nil, err
    end

    -- Join room. Runtime v0.3.32a does not expose transport send failures.
    local join_payload, encode_err = json.encode({
        type = "join",
        room = room_id
    })
    if encode_err then
        client:close()
        return nil, encode_err
    end
    client:send(join_payload)

    -- Message loop
    local ch, channel_err = client:channel()
    if channel_err then
        client:close()
        return nil, channel_err
    end
    while true do
        local msg, ok = ch:receive()
        if not ok then break end

        local data, decode_err = json.decode(msg.data)
        if decode_err then
            client:close()
            return nil, decode_err
        end
        on_message(data)
    end

    local _, close_err = client:close()
    if close_err then return nil, close_err end
    return true
end
```

### Keep-Alive와 함께 가격 스트림

```lua
local json = require("json")
local time = require("time")

local client, err = websocket.connect("wss://stream.example.com/prices")
if err then
    return nil, err
end

local subscribe_payload, encode_err = json.encode({
    action = "subscribe",
    symbols = {"BTC-USD", "ETH-USD"}
})
if encode_err then
    client:close()
    return nil, encode_err
end
client:send(subscribe_payload)

local ch, channel_err = client:channel()
if channel_err then
    client:close()
    return nil, channel_err
end

local heartbeat, heartbeat_err = time.after("30s")
if heartbeat_err then
    client:close()
    return nil, heartbeat_err
end

while true do
    local r = channel.select {
        ch:case_receive(),
        heartbeat:case_receive()
    }

    if r.channel == heartbeat then
        client:ping()
        heartbeat, heartbeat_err = time.after("30s")
        if heartbeat_err then
            client:close()
            return nil, heartbeat_err
        end
    elseif not r.ok then
        break  -- Connection closed
    else
        local price, decode_err = json.decode(r.value.data)
        if decode_err then
            client:close()
            return nil, decode_err
        end
        update_price(price.symbol, price.value)
    end
end

local _, close_err = client:close()
if close_err then return nil, close_err end
```

## 권한

WebSocket 연결은 보안 정책 평가 대상입니다.

### 보안 액션

| 액션 | 리소스 | 설명 |
|------|--------|------|
| `websocket.connect` | - | WebSocket 연결 허용/거부 |
| `websocket.connect.url` | URL | 특정 URL 연결 허용/거부 |

정책 설정은 [보안 모델](system/security.md)을 참조하세요.

## 에러

| 조건 | 종류 | 재시도 가능 |
|------|------|-------------|
| 연결 비활성화됨 | `errors.PERMISSION_DENIED` | 아니오 |
| URL 허용되지 않음 | `errors.PERMISSION_DENIED` | 아니오 |
| 컨텍스트 없음 | `errors.INTERNAL` | 아니오 |
| 연결 실패 | `errors.INTERNAL` | 예 |
| 잘못된 연결 ID | `errors.INTERNAL` | 아니오 |
| 구독 실패 | `errors.INTERNAL` | 예 |
| 구독 중 프로세스 컨텍스트 없음 | `errors.INTERNAL` | 아니오 |
| 닫기 실패 | `errors.INTERNAL` | 아니오 |

빈 URL, 테이블이 아닌 옵션, 잘못된 인자 타입, 수신 channel 요청 시 실행 컨텍스트나 PID가 없는 경우는 구조화된 에러가 아니라 Lua 에러를 발생시킵니다.

```lua
local client, err = websocket.connect(url)
if err then
    if errors.is(err, errors.PERMISSION_DENIED) then
        print("Access denied:", err:message())
    elseif err:retryable() then
        print("Temporary error:", err:message())
    end
    return nil, err
end
```

에러 처리는 [에러 처리](lua/core/errors.md)를 참조하세요.
