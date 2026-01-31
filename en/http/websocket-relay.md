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

-- Send message to WebSocket client from any process
process.send(websocket_pid, "ws.send", {type = "text", data = "hello"})
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

### Relay Config Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `target_pid` | string | required | Process PID to receive messages |
| `message_topic` | string | `ws.message` | Topic for client messages |
| `heartbeat_interval` | duration | - | Heartbeat frequency (e.g. `30s`) |
| `metadata` | object | - | Attached to all messages |

## Message Topics

The relay sends these messages to the target process:

| Topic | When | Payload |
|-------|------|---------|
| `ws.join` | Client connects | `client_pid`, `metadata` |
| `ws.message` | Client sends message | `client_pid`, `type`, `data`, `metadata` |
| `ws.heartbeat` | Periodic (if configured) | `client_pid`, `uptime`, `message_count` |
| `ws.leave` | Client disconnects | `client_pid`, `reason`, `metadata` |

## Receiving Messages

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
            -- Client connected
            local client_pid = data.client_pid

        elseif topic == "ws.message" then
            -- Handle client message
            local content = json.decode(data.data)
            handle_message(data.client_pid, content)

        elseif topic == "ws.leave" then
            -- Client disconnected
            cleanup(data.client_pid)
        end
    end
end
```

## Sending to Client

Send messages back using the client PID:

```lua
-- Send text message
process.send(client_pid, "ws.send", {
    type = "text",
    data = json.encode({event = "update", value = 42})
})

-- Send binary
process.send(client_pid, "ws.send", {
    type = "binary",
    data = binary_content
})

-- Close connection
process.send(client_pid, "ws.close", {
    code = 1000,
    reason = "Session ended"
})
```

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
        process.send(pid, "ws.send", {type = "text", data = data})
    end
end
```

<tip>
For complex multi-room scenarios, spawn a separate handler process per room or use a central manager process that tracks room memberships.
</tip>

## See Also

- [Middleware](http-middleware.md) - Middleware configuration
- [Process](lua-process.md) - Process messaging
- [WebSocket Client](lua-websocket.md) - Outbound WebSocket connections
