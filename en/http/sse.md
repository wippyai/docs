# Server-Sent Events

The SSE middleware streams events from the server to HTTP clients using the [Server-Sent Events](https://html.spec.whatwg.org/multipage/server-sent-events.html) protocol.

Two mechanisms are available: **direct streaming** from an HTTP handler, and **process-backed relay** via the `sse_relay` middleware.

## Direct Streaming

Use `res:write_event()` to send SSE events directly from an HTTP handler. The response automatically switches to SSE mode on the first call, setting appropriate headers.

```lua
local http = require("http")

local function handler()
    local res = http.response()

    res:write_event({name = "status", data = {state = "started"}})
    res:write_event({name = "progress", data = {percent = 50}})
    res:write_event({name = "status", data = {state = "complete"}})
end
```

Each event requires a `name` and `data` field. The `data` value is JSON-encoded automatically.

<tip>
Direct streaming is suitable for short-lived request-response flows like progress updates. For long-lived connections managed by background processes, use the SSE Relay.
</tip>

## SSE Relay

The SSE Relay middleware creates long-lived SSE streams backed by processes. It follows the same relay pattern as [WebSocket Relay](http/websocket-relay.md).

### How It Works

1. HTTP handler sets `X-SSE-Relay` header with a JSON relay configuration
2. Middleware intercepts the response and creates an SSE session
3. Session registers as a process with its own PID
4. Messages sent to the session PID are forwarded as SSE events to the client

## Process Semantics

SSE streams are full processes with their own PID. They integrate with the process system:

- **Addressable** — Any process can send messages to a stream PID
- **Monitorable** — Processes can monitor SSE streams for exit events
- **Linkable** — SSE streams can be linked to other processes
- **EXIT events** — When a stream closes, monitors receive exit notifications

```lua
-- Send event to SSE client from any process
process.send(stream_pid, "sse.message", {event = "update", value = 42})

-- Monitor an SSE stream
process.monitor(stream_pid)
```

<tip>
The relay monitors the target process. If the target exits, the SSE stream closes automatically and the client receives a `done` event.
</tip>

## Configuration

Add as post-match middleware on a router:

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

| Option | Description |
|--------|-------------|
| `sserelay.allowed.origins` | Comma-separated allowed origins (supports wildcards) |

<note>
If no origins are configured, only same-origin requests are allowed.
</note>

## Handler Setup

The HTTP handler spawns a process and configures the relay:

```lua
local http = require("http")
local json = require("json")

local function handler()
    local res = http.response()

    -- Spawn handler process
    local pid = process.spawn("app.sse:handler", "app:processes")

    -- Configure relay
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

### Relay Config Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `target_pid` | string | — | Process PID to receive messages (omit for detached mode) |
| `message_topic` | string | `sse.message` | Topic filter for forwarded events |
| `heartbeat_interval` | duration | `30s` | Heartbeat frequency (e.g. `30s`, `1m`) |
| `idle_timeout` | duration | — | Close stream after inactivity |
| `hard_timeout` | duration | — | Close stream after absolute duration |
| `metadata` | object | — | Attached to join/leave/heartbeat messages |

## Managed vs Detached Mode

### Managed Mode

When `target_pid` is set, the relay operates in managed mode:

- Monitors the target process
- Sends `sse.join` on connect and `sse.leave` on disconnect
- Closes the stream automatically if the target exits

### Detached Mode

When `target_pid` is omitted, the relay starts in detached mode:

- Emits a `ready` event to the client with `stream_pid` and `message_topic`
- No process is monitored initially
- A process can attach later by sending an `sse.control` message

```lua
-- Detached setup: no target_pid
res:set_header("X-SSE-Relay", json.encode({
    heartbeat_interval = "30s"
}))
```

The client receives a `ready` event:

```json
{"stream_pid": "{n1@app:processes|sse-1}", "message_topic": "sse.message"}
```

## Message Topics

The relay uses these topics for communication between the stream and target process:

| Topic | Direction | When | Payload |
|-------|-----------|------|---------|
| `sse.join` | stream → target | Client connects | `client_pid`, `metadata` |
| `sse.message` | target → stream | Default event topic | Forwarded as SSE event |
| `sse.heartbeat` | stream → target | Periodic (if configured) | `client_pid`, `uptime`, `message_count` |
| `sse.leave` | stream → target | Client disconnects | `client_pid`, `metadata` |
| `sse.control` | any → stream | Control command | Relay config fields |
| `sse.close` | any → stream | Force close | Optional reason string |

## Receiving in Target Process

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
            -- Periodic health check

        elseif topic == "sse.leave" then
            cleanup(data.client_pid)
        end
    end
end
```

## Sending Events

Send events to the client by messaging the stream PID:

```lua
-- Send on the default message topic
process.send(stream_pid, "sse.message", {
    event = "update",
    value = 42
})

-- Force close the stream
process.send(stream_pid, "sse.close", "session expired")
```

Events sent on the configured `message_topic` are forwarded to the client as SSE events. The topic name becomes the SSE event name.

## Connection Transfer

Send a control message to change the target process, topic filter, or timeouts dynamically:

```lua
process.send(stream_pid, "sse.control", {
    target_pid = tostring(new_pid),
    message_topic = "custom.topic",
    idle_timeout = "5m"
})
```

When the target changes, the relay sends `sse.leave` to the old target and `sse.join` to the new one. Set `target_pid` to an empty string to detach without reattaching.

## See Also

- [Middleware](http/middleware.md) — Middleware configuration
- [WebSocket Relay](http/websocket-relay.md) — WebSocket equivalent
- [Process](lua/core/process.md) — Process messaging
