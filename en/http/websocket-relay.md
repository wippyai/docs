# WebSocket Relay

The WebSocket relay middleware upgrades HTTP connections to WebSocket and relays messages to a target process.

## How It Works

1. HTTP handler sets `X-WS-Relay` header with target process PID
2. Middleware upgrades connection to WebSocket
3. Relay attaches to the target process and monitors it
4. Messages flow bidirectionally between client and process

<warning>
The WebSocket connection is bound to the target process. If the process exits, the connection closes automatically.
</warning>

## Process Semantics

WebSocket connections are full processes with their own PID. They integrate with the process system:

- **Addressable** → Any process can send messages to a WebSocket PID
- **Monitorable** → Processes can monitor WebSocket connections for exit events
- **Linkable** → WebSocket connections can be linked to other processes
- **EXIT events** → When connection closes, monitors receive exit notifications

```lua
-- Monitor a WebSocket connection from another process
process.monitor(websocket_pid)

-- Send a message to the WebSocket client from any process.
-- The relay wraps it as {topic, data} JSON; the topic name is arbitrary.
process.send(websocket_pid, "update", "hello")
```

<tip>
The relay monitors the target process. If the target exits, the WebSocket connection closes automatically and the client receives a close frame.
</tip>

## Connection Transfer

Connections can be transferred to a different process by sending a control message:

```lua
process.send(websocket_pid, "ws.control", {
    target_pid = new_process_pid,
    message_topic = "ws.message"
})
```

## Configuration

Add as post-match middleware on a router:

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

| Option | Description |
|--------|-------------|
| `wsrelay.allowed.origins` | Comma-separated allowed origins |

<note>
If no origins configured, only same-origin requests are allowed.
</note>

## Handler Setup

The HTTP handler spawns a process and configures the relay:

```lua
local http = require("http")
local json = require("json")

local function handler()
    local req = http.request()
    local res = http.response()

    -- Spawn handler process
    local pid = process.spawn("app.ws:handler", "app:processes")

    -- Configure relay
    res:set_header("X-WS-Relay", json.encode({
        target_pid = tostring(pid),
        message_topic = "ws.message",
        heartbeat_interval = "30s",
        metadata = {
            user_id = req:query("user_id")
        }
    }))
end
```

### Relay Config Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `target_pid` | string | required | Process PID to receive messages |
| `message_topic` | string | `ws.message` | Topic for client messages |
| `heartbeat_interval` | duration | `30s` | Heartbeat frequency (e.g. `30s`) |
| `metadata` | object | - | Attached to all messages |

## Message Topics

The relay sends these messages to the target process:

| Topic | When | Payload |
|-------|------|---------|
| `ws.join` | Client connects | JSON `{client_pid, metadata}` |
| `ws.message` (or your `message_topic`) | Client sends message | Raw client payload (text frame → string, binary frame → bytes); the source PID of the relay package is the client PID |
| `ws.heartbeat` | Periodic (every 30s by default; interval overridable via `heartbeat_interval`) | JSON `{client_pid, uptime, message_count, metadata}` |
| `ws.leave` | Client disconnects | JSON `{client_pid, metadata}` |

## Receiving Messages

```lua
local json = require("json")

local function handler()
    local inbox = process.inbox()

    while true do
        local msg, ok = inbox:receive()
        if not ok then break end

        local topic = msg:topic()
        local from = msg:from()                -- client connection PID

        if topic == "ws.join" then
            -- Client connected — payload is {client_pid, metadata}
            local data = msg:payload():data()
            local client_pid = data.client_pid

        elseif topic == "ws.message" then
            -- Raw client message; from() is the client PID
            local body = msg:payload():data()  -- string or bytes
            handle_message(from, json.decode(body))

        elseif topic == "ws.leave" then
            -- Client disconnected — payload is {client_pid, metadata}
            cleanup(from)
        end
    end
end
```

## Sending to Client

Send messages back using the client PID. Any topic you choose is wrapped as `{topic, data}` JSON and forwarded to the WebSocket. Every server-to-client message is sent as a single WebSocket TEXT frame containing the `{topic, data}` JSON wrapper. Binary payloads are base64-encoded into the `data` field; they are NOT sent as separate binary frames.

```lua
-- Send a structured message (any topic name)
process.send(client_pid, "update", json.encode({event = "update", value = 42}))

-- Send binary
process.send(client_pid, "data", binary_content)

-- Close connection (payload is the close reason string)
process.send(client_pid, "ws.close", "Session ended")
```

The reserved topics from server → client are `ws.control` (relay reconfiguration) and `ws.close` (close the connection).

## Broadcasting

Track client PIDs to broadcast to multiple clients:

```lua
local clients = {}

-- On join
clients[client_pid] = true

-- On leave
clients[client_pid] = nil

-- Broadcast
local function broadcast(message)
    local data = json.encode(message)
    for pid, _ in pairs(clients) do
        process.send(pid, "broadcast", data)
    end
end
```

<tip>
For complex multi-room scenarios, spawn a separate handler process per room or use a central manager process that tracks room memberships.
</tip>

## See Also

- [Middleware](http/middleware.md) - Middleware configuration
- [Process](lua/core/process.md) - Process messaging
- [WebSocket Client](lua/http/websocket.md) - Outbound WebSocket connections
