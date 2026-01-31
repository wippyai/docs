# WebSocket Client
<secondary-label ref="network"/>
<secondary-label ref="io"/>
<secondary-label ref="permissions"/>

WebSocket client for real-time bidirectional communication with servers.

## Loading

```lua
local websocket = require("websocket")
```

## Connecting

### Basic Connection

```lua
local client, err = websocket.connect("wss://api.example.com/ws")
if err then
    return nil, err
end
```

### With Options

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

| Parameter | Type | Description |
|-----------|------|-------------|
| `url` | string | WebSocket URL (ws:// or wss://) |
| `options` | table | Connection options (optional) |

**Returns:** `Client, error`

### Connection Options

| Option | Type | Description |
|--------|------|-------------|
| `headers` | table | HTTP headers for handshake |
| `protocols` | table | WebSocket subprotocols |
| `dial_timeout` | number/string | Connection timeout (ms or "5s") |
| `read_timeout` | number/string | Read timeout |
| `write_timeout` | number/string | Write timeout |
| `compression` | number | Compression mode (see Constants) |
| `compression_threshold` | number | Min size to compress (0-100MB) |
| `read_limit` | number | Max message size (0-128MB) |
| `channel_capacity` | number | Receive channel buffer (1-10000) |

**Timeout format:** Numbers are milliseconds, strings use Go duration format ("5s", "1m").

## Sending Messages

### Text Messages

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

### Binary Messages

```lua
client:send(binary_data, websocket.BINARY)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `data` | string | Message content |
| `type` | number | `websocket.TEXT` (1) or `websocket.BINARY` (2) |

**Returns:** `boolean, error`

### Ping

```lua
client:ping()
```

**Returns:** `boolean, error`

## Receiving Messages

The `channel()` method returns a channel for receiving messages. Works with `channel.select` for multiplexing.

### Basic Receive

```lua
local ch = client:channel()

local msg, ok = ch:receive()
if ok then
    print("Type:", msg.type)  -- "text" or "binary"
    print("Data:", msg.data)
end
```

### Message Loop

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

### With Select

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

### Message Object

| Field | Type | Description |
|-------|------|-------------|
| `type` | string | `"text"` or `"binary"` |
| `data` | string | Message content |

## Closing Connection

```lua
-- Normal close (code 1000)
client:close()

-- With code and reason
client:close(websocket.CLOSE_CODES.NORMAL, "Session ended")

-- Error close
client:close(websocket.CLOSE_CODES.INTERNAL_ERROR, "Processing failed")
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `code` | number | Close code (1000-4999), default 1000 |
| `reason` | string | Close reason (optional) |

**Returns:** `boolean, error`

## Constants

### Message Types

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

### Compression Modes

```lua
websocket.COMPRESSION.DISABLED         -- 0 (no compression)
websocket.COMPRESSION.CONTEXT_TAKEOVER -- 1 (sliding window)
websocket.COMPRESSION.NO_CONTEXT       -- 2 (per-message)
```

### Close Codes

| Constant | Code | Description |
|----------|------|-------------|
| `NORMAL` | 1000 | Normal closure |
| `GOING_AWAY` | 1001 | Server shutting down |
| `PROTOCOL_ERROR` | 1002 | Protocol error |
| `UNSUPPORTED_DATA` | 1003 | Unsupported data type |
| `NO_STATUS` | 1005 | No status received |
| `ABNORMAL_CLOSURE` | 1006 | Connection lost |
| `INVALID_PAYLOAD` | 1007 | Invalid frame payload |
| `POLICY_VIOLATION` | 1008 | Policy violation |
| `MESSAGE_TOO_BIG` | 1009 | Message too large |
| `INTERNAL_ERROR` | 1011 | Server error |
| `SERVICE_RESTART` | 1012 | Server restarting |
| `TRY_AGAIN_LATER` | 1013 | Server overloaded |

```lua
client:close(websocket.CLOSE_CODES.NORMAL, "Done")
```

## Examples

### Real-Time Chat

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

### Price Stream with Keep-Alive

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

## Permissions

WebSocket connections are subject to security policy evaluation.

### Security Actions

| Action | Resource | Description |
|--------|----------|-------------|
| `websocket.connect` | - | Allow/deny WebSocket connections |
| `websocket.connect.url` | URL | Allow/deny connections to specific URLs |

See [Security Model](system-security.md) for policy configuration.

## Errors

| Condition | Kind | Retryable |
|-----------|------|-----------|
| Connections disabled | `errors.PERMISSION_DENIED` | no |
| URL not allowed | `errors.PERMISSION_DENIED` | no |
| No context | `errors.INTERNAL` | no |
| Connection failed | `errors.INTERNAL` | yes |
| Invalid connection ID | `errors.INTERNAL` | no |

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

See [Error Handling](lua-errors.md) for working with errors.
