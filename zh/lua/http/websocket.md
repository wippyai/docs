# WebSocket 客户端
<secondary-label ref="network"/>
<secondary-label ref="io"/>
<secondary-label ref="permissions"/>

用于与服务器进行实时双向通信的 WebSocket 客户端。

## 加载

```lua
local websocket = require("websocket")
```

## 连接

### 基本连接

```lua
local client, err = websocket.connect("wss://api.example.com/ws")
if err then
    return nil, err
end
```

### 带选项连接

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

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `url` | string | WebSocket URL（ws:// 或 wss://） |
| `options` | table | 连接选项（可选） |

**返回:** `Client, error`

### 连接选项

| 选项 | 类型 | 描述 |
|--------|------|-------------|
| `headers` | table | 握手的 HTTP 头部 |
| `protocols` | table | WebSocket 子协议 |
| `dial_timeout` | number/string | 连接超时（毫秒或 "5s"） |
| `read_timeout` | number/string | 读取超时 |
| `write_timeout` | number/string | 写入超时 |
| `compression` | number | 压缩模式（见常量） |
| `compression_threshold` | number | 压缩的最小大小（0-100MB） |
| `read_limit` | number | 最大消息大小（0-128MB） |
| `channel_capacity` | number | 接收通道缓冲区（1-10000） |

**超时格式：** 数字为毫秒，字符串使用 Go 时长格式（"5s"、"1m"）。

## 发送消息

### 文本消息

```lua
local ok, err = client:send("Hello, Server!")
if err then
    return nil, err
end

-- Send JSON
client:send(json.encode({
    type = "subscribe",
    channel = "orders"
}))
```

### 二进制消息

```lua
client:send(binary_data, websocket.BINARY)
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `data` | string | 消息内容 |
| `type` | number | `websocket.TEXT` (1) 或 `websocket.BINARY` (2) |

**返回:** `boolean, error`

### Ping

```lua
client:ping()
```

**返回:** `boolean, error`

## 接收消息

`channel()` 方法返回用于接收消息的通道。可与 `channel.select` 配合使用进行多路复用。

### 基本接收

```lua
local ch = client:channel()

local msg, ok = ch:receive()
if ok then
    print("Type:", msg.type)  -- "text" or "binary"
    print("Data:", msg.data)
end
```

### 消息循环

```lua
local ch = client:channel()

while true do
    local msg, ok = ch:receive()
    if not ok then
        break  -- Connection closed
    end

    if msg.type == "text" then
        local data = json.decode(msg.data)
        handle_message(data)
    end
end
```

### 使用 Select

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

### 消息对象

| 字段 | 类型 | 描述 |
|-------|------|-------------|
| `type` | string | `"text"` 或 `"binary"` |
| `data` | string | 消息内容 |

## 关闭连接

```lua
-- Normal close (code 1000)
client:close()

-- With code and reason
client:close(websocket.CLOSE_CODES.NORMAL, "Session ended")

-- Error close
client:close(websocket.CLOSE_CODES.INTERNAL_ERROR, "Processing failed")
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `code` | number | 关闭码（1000-4999），默认 1000 |
| `reason` | string | 关闭原因（可选） |

**返回:** `boolean, error`

## 常量

### 消息类型

```lua
-- Numeric (for send)
websocket.TEXT    -- 1
websocket.BINARY  -- 2

-- String (received message type field)
websocket.TYPE_TEXT    -- "text"
websocket.TYPE_BINARY  -- "binary"
websocket.TYPE_PING    -- "ping"
websocket.TYPE_PONG    -- "pong"
websocket.TYPE_CLOSE   -- "close"
```

### 压缩模式

```lua
websocket.COMPRESSION.DISABLED         -- 0 (no compression)
websocket.COMPRESSION.CONTEXT_TAKEOVER -- 1 (sliding window)
websocket.COMPRESSION.NO_CONTEXT       -- 2 (per-message)
```

### 关闭码

| 常量 | 代码 | 描述 |
|----------|------|-------------|
| `NORMAL` | 1000 | 正常关闭 |
| `GOING_AWAY` | 1001 | 服务器正在关闭 |
| `PROTOCOL_ERROR` | 1002 | 协议错误 |
| `UNSUPPORTED_DATA` | 1003 | 不支持的数据类型 |
| `NO_STATUS` | 1005 | 未收到状态 |
| `ABNORMAL_CLOSURE` | 1006 | 连接丢失 |
| `INVALID_PAYLOAD` | 1007 | 无效的帧负载 |
| `POLICY_VIOLATION` | 1008 | 策略违规 |
| `MESSAGE_TOO_BIG` | 1009 | 消息过大 |
| `INTERNAL_ERROR` | 1011 | 服务器错误 |
| `SERVICE_RESTART` | 1012 | 服务器重启 |
| `TRY_AGAIN_LATER` | 1013 | 服务器过载 |

```lua
client:close(websocket.CLOSE_CODES.NORMAL, "Done")
```

## 示例

### 实时聊天

```lua
local function connect_chat(room_id, on_message)
    local client, err = websocket.connect("wss://chat.example.com/ws", {
        headers = {["Authorization"] = "Bearer " .. token}
    })
    if err then
        return nil, err
    end

    -- Join room
    client:send(json.encode({
        type = "join",
        room = room_id
    }))

    -- Message loop
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

### 带保活的价格流

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
        break  -- Connection closed
    else
        local price = json.decode(r.value.data)
        update_price(price.symbol, price.value)
    end
end

client:close()
```

## 权限

WebSocket 连接受安全策略评估约束。

### 安全操作

| 操作 | 资源 | 描述 |
|--------|----------|-------------|
| `websocket.connect` | - | 允许/拒绝 WebSocket 连接 |
| `websocket.connect.url` | URL | 允许/拒绝连接到特定 URL |

参见 [安全模型](system/security.md) 了解策略配置。

## 错误

| 条件 | 类型 | 可重试 |
|-----------|------|-----------|
| 连接被禁用 | `errors.PERMISSION_DENIED` | 否 |
| URL 不被允许 | `errors.PERMISSION_DENIED` | 否 |
| 无上下文 | `errors.INTERNAL` | 否 |
| 连接失败 | `errors.INTERNAL` | 是 |
| 无效的连接 ID | `errors.INTERNAL` | 否 |

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

参见 [错误处理](lua/core/errors.md) 了解错误处理方法。
