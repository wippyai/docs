# WebSocket 클라이언트
<secondary-label ref="network"/>
<secondary-label ref="io"/>
<secondary-label ref="permissions"/>

서버와의 실시간 양방향 통신을 위한 WebSocket 클라이언트.

## 로딩

```lua
local websocket = require("websocket")
```

## 연결

### 기본 연결

```lua
local client, err = websocket.connect("wss://api.example.com/ws")
if err then
    return nil, err
end
```

### 옵션과 함께

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
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `url` | string | WebSocket URL (ws:// 또는 wss://) |
| `options` | table | 연결 옵션 (선택적) |

**반환:** `Client, error`

### 연결 옵션

| 옵션 | 타입 | 설명 |
|------|------|------|
| `headers` | table | 핸드셰이크용 HTTP 헤더 |
| `protocols` | table | WebSocket 서브프로토콜 |
| `dial_timeout` | number/string | 연결 타임아웃 (ms 또는 "5s") |
| `read_timeout` | number/string | 읽기 타임아웃 |
| `write_timeout` | number/string | 쓰기 타임아웃 |
| `compression` | number | 압축 모드 (상수 참조) |
| `compression_threshold` | number | 압축 최소 크기 (0-100MB) |
| `read_limit` | number | 최대 메시지 크기 (0-128MB) |
| `channel_capacity` | number | 수신 채널 버퍼 (1-10000) |

**타임아웃 형식:** 숫자는 밀리초, 문자열은 Go duration 형식 ("5s", "1m")을 사용합니다.

## 메시지 보내기

### 텍스트 메시지

```lua
local ok, err = client:send("Hello, Server!")
if err then
    return nil, err
end

-- JSON 전송
client:send(json.encode({
    type = "subscribe",
    channel = "orders"
}))
```

### 바이너리 메시지

```lua
client:send(binary_data, websocket.BINARY)
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `data` | string | 메시지 내용 |
| `type` | number | `websocket.TEXT` (1) 또는 `websocket.BINARY` (2) |

**반환:** `boolean, error`

### Ping

```lua
client:ping()
```

**반환:** `boolean, error`

## 메시지 받기

`channel()` 메서드는 메시지 수신을 위한 채널을 반환합니다. 멀티플렉싱을 위해 `channel.select`와 함께 작동합니다.

### 기본 수신

```lua
local ch = client:channel()

local msg, ok = ch:receive()
if ok then
    print("Type:", msg.type)  -- "text" 또는 "binary"
    print("Data:", msg.data)
end
```

### 메시지 루프

```lua
local ch = client:channel()

while true do
    local msg, ok = ch:receive()
    if not ok then
        break  -- 연결 닫힘
    end

    if msg.type == "text" then
        local data = json.decode(msg.data)
        handle_message(data)
    end
end
```

### Select와 함께

```lua
local ch = client:channel()
local timeout = time.after("30s")

while true do
    local r = channel.select {
        ch:case_receive(),
        timeout:case_receive()
    }

    if r.channel == timeout then
        client:ping()  -- Keep-alive
        timeout = time.after("30s")
    else
        local data = json.decode(r.value.data)
        process(data)
    end
end
```

### 메시지 객체

| 필드 | 타입 | 설명 |
|------|------|------|
| `type` | string | `"text"` 또는 `"binary"` |
| `data` | string | 메시지 내용 |

## 연결 닫기

```lua
-- 정상 닫기 (코드 1000)
client:close()

-- 코드와 이유와 함께
client:close(websocket.CLOSE_CODES.NORMAL, "Session ended")

-- 에러 닫기
client:close(websocket.CLOSE_CODES.INTERNAL_ERROR, "Processing failed")
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `code` | number | 닫기 코드 (1000-4999), 기본값 1000 |
| `reason` | string | 닫기 이유 (선택적) |

**반환:** `boolean, error`

## 상수

### 메시지 타입

```lua
-- 숫자 (send용)
websocket.TEXT    -- 1
websocket.BINARY  -- 2

-- 문자열 (수신된 메시지 type 필드)
websocket.TYPE_TEXT    -- "text"
websocket.TYPE_BINARY  -- "binary"
websocket.TYPE_PING    -- "ping"
websocket.TYPE_PONG    -- "pong"
websocket.TYPE_CLOSE   -- "close"
```

### 압축 모드

```lua
websocket.COMPRESSION.DISABLED         -- 0 (압축 없음)
websocket.COMPRESSION.CONTEXT_TAKEOVER -- 1 (슬라이딩 윈도우)
websocket.COMPRESSION.NO_CONTEXT       -- 2 (메시지별)
```

### 닫기 코드

| 상수 | 코드 | 설명 |
|------|------|------|
| `NORMAL` | 1000 | 정상 종료 |
| `GOING_AWAY` | 1001 | 서버 종료 중 |
| `PROTOCOL_ERROR` | 1002 | 프로토콜 에러 |
| `UNSUPPORTED_DATA` | 1003 | 지원되지 않는 데이터 타입 |
| `NO_STATUS` | 1005 | 상태 수신되지 않음 |
| `ABNORMAL_CLOSURE` | 1006 | 연결 끊김 |
| `INVALID_PAYLOAD` | 1007 | 잘못된 프레임 페이로드 |
| `POLICY_VIOLATION` | 1008 | 정책 위반 |
| `MESSAGE_TOO_BIG` | 1009 | 메시지 너무 큼 |
| `INTERNAL_ERROR` | 1011 | 서버 에러 |
| `SERVICE_RESTART` | 1012 | 서버 재시작 중 |
| `TRY_AGAIN_LATER` | 1013 | 서버 과부하 |

```lua
client:close(websocket.CLOSE_CODES.NORMAL, "Done")
```

## 예제

### 실시간 채팅

```lua
local function connect_chat(room_id, on_message)
    local client, err = websocket.connect("wss://chat.example.com/ws", {
        headers = {["Authorization"] = "Bearer " .. token}
    })
    if err then
        return nil, err
    end

    -- 방 참여
    client:send(json.encode({
        type = "join",
        room = room_id
    }))

    -- 메시지 루프
    local ch = client:channel()
    while true do
        local msg, ok = ch:receive()
        if not ok then break end

        local data = json.decode(msg.data)
        on_message(data)
    end

    client:close()
end
```

### Keep-Alive와 함께 가격 스트림

```lua
local client = websocket.connect("wss://stream.example.com/prices")

client:send(json.encode({
    action = "subscribe",
    symbols = {"BTC-USD", "ETH-USD"}
}))

local ch = client:channel()
local heartbeat = time.after("30s")

while true do
    local r = channel.select {
        ch:case_receive(),
        heartbeat:case_receive()
    }

    if r.channel == heartbeat then
        client:ping()
        heartbeat = time.after("30s")
    elseif not r.ok then
        break  -- 연결 닫힘
    else
        local price = json.decode(r.value.data)
        update_price(price.symbol, price.value)
    end
end

client:close()
```

## 권한

WebSocket 연결은 보안 정책 평가 대상입니다.

### 보안 액션

| 액션 | 리소스 | 설명 |
|------|--------|------|
| `websocket.connect` | - | WebSocket 연결 허용/거부 |
| `websocket.connect.url` | URL | 특정 URL 연결 허용/거부 |

정책 설정은 [보안 모델](system-security.md)을 참조하세요.

## 에러

| 조건 | 종류 | 재시도 가능 |
|------|------|-------------|
| 연결 비활성화됨 | `errors.PERMISSION_DENIED` | 아니오 |
| URL 허용되지 않음 | `errors.PERMISSION_DENIED` | 아니오 |
| 컨텍스트 없음 | `errors.INTERNAL` | 아니오 |
| 연결 실패 | `errors.INTERNAL` | 예 |
| 잘못된 연결 ID | `errors.INTERNAL` | 아니오 |

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

에러 처리는 [에러 처리](lua-errors.md)를 참조하세요.
