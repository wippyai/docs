---
title: "WebSocket Client"
description: "Connect to WebSocket servers, send and receive messages, use compression, and close connections."
---

# WebSocket Client
<secondary-label ref="network"/>
<secondary-label ref="io"/>
<secondary-label ref="permissions"/>

The `websocket` module creates bidirectional client connections to WebSocket servers.

This is an API reference with partial connection and subscription recipes. Endpoint URLs, tokens, message handlers, and application data come from the surrounding application. The lifecycle examples close the client on every terminal or checked error path; smaller method snippets assume an enclosing owner performs that cleanup.

## Loading

```lua
local websocket = require("websocket")
```

Add `websocket` to the executable entry's `modules:` list before requiring it. The `channel` global is always available; JSON and timeout recipes also require `json` and `time`.

## Connecting

### `connect`

Open a WebSocket connection with the default options:

```lua
local client, err = websocket.connect("wss://api.example.com/ws")
if err then
    return nil, err
end
```

Pass an options table to configure the connection:

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

| Parameter | Type | Description |
|-----------|------|-------------|
| `url` | string | WebSocket URL (ws:// or wss://) |
| `options` | table | Connection options (optional) |

**Returns:** `Client, error`

#### Connection Options

| Option | Type | Description |
|--------|------|-------------|
| `headers` | table | String-to-string HTTP handshake headers; other entries are ignored |
| `protocols` | table | WebSocket subprotocol strings; non-string entries are ignored |
| `dial_timeout` | number/string | Connection timeout; `0` applies no runtime-wide connection deadline, while underlying HTTP transport defaults still apply |
| `read_timeout` | number/string | Per-message read timeout; `0` disables it |
| `write_timeout` | number/string | Accepted by the Lua API but not applied by runtime `v0.3.32a` |
| `compression` | number/string | `0`/`"disabled"`, `1`/`"context_takeover"`, or `2`/`"no_context_takeover"`; default disabled |
| `compression_threshold` | number | Minimum size to compress, in bytes (0-104857600); `0` uses 128 bytes for context takeover or 512 for no-context-takeover mode |
| `read_limit` | number | Maximum inbound message size, in bytes (0-134217728); `0` uses 16 MiB |
| `channel_capacity` | number | Service-side inbound message buffer (1-10000); default 16 |

**Timeout format:** Numbers are milliseconds. Strings use Go duration syntax such as `"5s"` or `"1m"`.

Invalid timeout strings and out-of-range or unsupported option values are ignored, leaving the corresponding default in effect.

## Sending Messages

### Text Messages

Send a text message.

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

### Binary Messages

Send a binary message by specifying `websocket.BINARY`.

```lua
client:send(binary_data, websocket.BINARY)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `data` | string | Message content |
| `type` | number | `websocket.TEXT` (1) or `websocket.BINARY` (2) |

If `type` is absent or not `websocket.TEXT` or `websocket.BINARY`, the runtime sends a text message. The call yields until the send command completes and returns no values. In runtime `v0.3.32a`, transport send failures are not returned to Lua.

### Ping

Send a ping frame.

```lua
client:ping()
```

The call yields until the ping command completes and returns no values. In runtime `v0.3.32a`, transport ping failures are not returned to Lua.

## Receiving Messages

`channel()` returns the receive channel, and `receive()` is an alias. The first call yields while the runtime creates the subscription; later calls return the same channel immediately. A subscription failure returns `nil, error`. The channel can be used with `channel.select`.

### Basic Receive

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

### Message Loop

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

### With Select

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

### Message Object

| Field | Type | Description |
|-------|------|-------------|
| `type` | string | `"text"` or `"binary"` |
| `data` | string? | Message content (nil for unknown payload types) |

## Closing Connection

Close the connection with an optional status code and reason:

```lua
local _, close_err = client:close(websocket.CLOSE_CODES.NORMAL, "Session ended")
if close_err then return nil, close_err end

-- Omitting both arguments also uses normal close code 1000.
-- Use INTERNAL_ERROR with an application-owned reason for a failed session.
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `code` | number | Close code (1000-4999), default 1000 |
| `reason` | string | Close reason (optional) |

The call yields until the close command completes. Success returns no values; a close failure returns `nil, error`. Capture two results when checking it, because the error is the second result. Values outside the accepted numeric range are ignored and the default code `1000` is used.

The receive channel is owned by the client; do not close it directly. A remote terminal event closes the channel. Calling `client:close()` unsubscribes the receive channel and stops the client-side producer, so use it promptly rather than relying on process shutdown cleanup.

## Constants

### Message Types

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

Receive-channel message objects use only `"text"` and `"binary"`. Ping and pong frames are handled by the transport, and a terminal event closes the channel instead of producing a `"close"` message object.

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
| `RESERVED` | 1004 | Reserved |
| `NO_STATUS` | 1005 | No status received |
| `ABNORMAL_CLOSURE` | 1006 | Connection lost |
| `INVALID_PAYLOAD` | 1007 | Invalid frame payload |
| `POLICY_VIOLATION` | 1008 | Policy violation |
| `MESSAGE_TOO_BIG` | 1009 | Message too large |
| `MANDATORY_EXTENSION` | 1010 | Required extension not negotiated |
| `INTERNAL_ERROR` | 1011 | Server error |
| `SERVICE_RESTART` | 1012 | Server restarting |
| `TRY_AGAIN_LATER` | 1013 | Server overloaded |
| `BAD_GATEWAY` | 1014 | Gateway error |
| `TLS_HANDSHAKE` | 1015 | TLS handshake failure |

```lua
local _, close_err = client:close(websocket.CLOSE_CODES.NORMAL, "Done")
if close_err then return nil, close_err end
```

## Examples

### Real-Time Chat

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

### Price Stream with Keep-Alive

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

## Permissions

WebSocket connections are evaluated against the active security policy.

### Security Actions

| Action | Resource | Description |
|--------|----------|-------------|
| `websocket.connect` | - | Allow/deny WebSocket connections |
| `websocket.connect.url` | URL | Allow/deny connections to specific URLs |

See [Security Model](../../system/security.md) for policy configuration.

## Errors

| Condition | Kind | Retryable |
|-----------|------|-----------|
| Connections disabled | `errors.PERMISSION_DENIED` | no |
| URL not allowed | `errors.PERMISSION_DENIED` | no |
| No context | `errors.INTERNAL` | no |
| Connection failed | `errors.INTERNAL` | yes |
| Invalid connection ID returned by the dispatcher | `errors.INTERNAL` | no |
| Subscription failed | `errors.INTERNAL` | yes |
| Missing process context during subscription | `errors.INTERNAL` | no |
| Close failed | `errors.INTERNAL` | no |

An empty URL, a non-table options value, invalid argument types, and a missing execution context or process PID when requesting the receive channel raise Lua errors. They are not returned as structured errors. Runtime `v0.3.32a` does not expose send or ping transport failures to Lua callers.

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

See [Error Handling](../core/errors.md) for working with errors.
