---
title: "Relay"
description: "Configure Wippy Relay hubs, WebSocket clients, prefixed plugins, user isolation, and connection lifecycle."
---

# Relay

The `wippy/relay` module routes WebSocket connections through a central hub and per-user hubs. User hubs manage client connections and dispatch messages to prefixed plugins.

## Architecture

```
Central Hub
├── User Hub (alice)
│   ├── Plugin: session_
│   ├── Plugin: ai_
│   ├── WebSocket Client 1
│   └── WebSocket Client 2
├── User Hub (bob)
│   ├── Plugin: session_
│   └── WebSocket Client 1
└── ...
```

The central hub runs as a service. When a WebSocket client connects, it finds or creates a hub for that user. The user hub manages the connection lifecycle and routes messages by command prefix.

## Setup

Add the module to your project:

```bash
wippy add wippy/relay
wippy install
```

Declare the dependency with required parameters:

```yaml
version: "1.0"
namespace: app

entries:
  - name: os_env
    kind: env.storage.os

  - name: processes
    kind: process.host
    lifecycle:
      auto_start: true

  - name: dep.relay
    kind: ns.dependency
    component: wippy/relay
    version: "*"
    parameters:
      - name: application_host
        value: app:processes
      - name: env_storage
        value: app:os_env
      - name: user_security_scope
        value: app.security:user_scope
```

### Configuration Parameters

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `application_host` | yes | — | Process host for relay processes |
| `env_storage` | no | internal | Environment variable storage |
| `user_security_scope` | yes | — | Security scope for user hubs |
| `max_connections_per_user` | no | `5` | WebSocket connections per user |
| `queue_multiplier` | no | `100` | Message queue = connections × multiplier |
| `user_hub_inactivity_timeout` | no | `7200s` | Idle time before hub cleanup |

## Client Connection Flow

1. WebSocket client connects with `user_id` in metadata
2. Central hub validates the connection and checks per-user limits
3. Central hub creates or reuses a user hub for the user
4. User hub sends a `welcome` message to the client:

```json
{
    "user_id": "alice",
    "client_count": 1,
    "plugins": [
        { "prefix": "session_", "process_id": "...", "status": "running" },
        { "prefix": "ai_", "process_id": "...", "status": "pending" }
    ]
}
```

Plugin `status` can be `"not_started"` (registered but never spawned), `"pending"` (spawn in progress), `"running"`, `"failed"`, or `"stopped"`.

## Message Routing

Clients send JSON messages with a `type` field. The user hub matches the type prefix against registered plugins and routes the message:

```json
{ "type": "session_get_state", "data": { "key": "value" } }
```

The `session_` prefix selects the session plugin. The hub removes the prefix and sends the message to the plugin process, using the remaining type as the topic:

```lua
-- process topic: "get_state"
-- payload:
{
    conn_pid = client_pid,
    type = "session_get_state",  -- original full type preserved
    data = { key = "value" },
    request_id = "...",
    session_id = "..."
}
```

Plugins respond by sending messages back to `conn_pid`.

## Plugins

Plugins are `process.lua` entries with `meta.type: relay.plugin`:

```yaml
entries:
  - name: session_plugin
    kind: process.lua
    meta:
      type: relay.plugin
      command_prefix: session_
      auto_start: true
    source: file://session_plugin.lua
    modules: [json, time, logger]
    method: run
```

### Plugin Metadata

| Field | Type | Description |
|-------|------|-------------|
| `meta.type` | string | Must be `relay.plugin` |
| `meta.command_prefix` | string | Message type prefix this plugin handles |
| `meta.auto_start` | boolean | Start when user hub initializes |
| `meta.default_host` | string | Override process host |

### Plugin Lifecycle

The user hub spawns each plugin with these startup arguments:

```lua
function run(args)
    local user_id = args.user_id
    local user_metadata = args.user_metadata
    local user_hub_pid = args.user_hub_pid
    local config = args.config
end
```

The `session_` plugin receives lifecycle messages:

| Message | When |
|---------|------|
| `"resume"` | First client connects to user hub |
| `"shutdown"` | Last client disconnects from user hub |

Plugins get 1 automatic restart on crash. After a second crash, the plugin is marked as `"failed"` and not restarted.

### Plugin Implementation

Plugins receive messages through their process inbox. Each message has a topic derived from the command type and a payload containing the original message data and `conn_pid` for responses.

```lua
local json = require("json")

local function handle_message(topic, payload)
    if topic == "get_state" then
        process.send(payload.conn_pid, "ws.message", json.encode({
            type = "session_state",
            data = { status = "active" }
        }))
    end
end

local function run(args)
    local user_id = args.user_id
    local inbox = process.inbox()
    local events = process.events()

    while true do
        local result = channel.select({
            inbox:case_receive(),
            events:case_receive()
        })
        if not result.ok then break end

        if result.channel == inbox then
            local msg = result.value
            local topic = msg:topic()
            local payload = msg:payload():data()

            if topic == "resume" then
                -- first client connected
            elseif topic == "shutdown" then
                -- last client disconnected
            else
                handle_message(topic, payload)
            end
        elseif result.channel == events then
            local event = result.value
            if event.kind == process.event.CANCEL then
                break
            end
        end
    end
end

return { run = run }
```

## Error Handling

The relay reports client errors using these codes:

| Error Code | Description |
|------------|-------------|
| `max_connections_reached` | User at connection limit |
| `missing_user_id` | No user_id in connection metadata |
| `hub_creation_failed` | Failed to spawn user hub |
| `invalid_json` | Message decode error |
| `unknown_command` | Message missing type field |
| `plugin_not_found` | No plugin matches the command prefix |
| `plugin_failed` | Plugin unavailable or crashed |

## Hub Lifecycle

### User Hub Creation

The first client connection for a user creates that user's hub. The hub runs with the user's security actor and scope.

### Garbage Collection

The central hub periodically checks for inactive user hubs. A hub with no connected clients for longer than `user_hub_inactivity_timeout` (default 2 hours) is gracefully terminated with a 10-second cancel timeout.

The GC check interval is automatically derived: `inactivity_timeout / 2.5`.

### Security

The central hub runs under its own security group (`wippy.relay.security:root`) with full access. Each user hub spawns with the configured `user_security_scope`, isolating user-level operations.

## Internal Topics

| Topic | Direction | Description |
|-------|-----------|-------------|
| `ws.join` | Client → Central/User Hub | Connection request |
| `ws.leave` | Client → Central/User Hub | Disconnection |
| `ws.message` | Client → User Hub | WebSocket message |
| `ws.cancel` | Central → User Hub | Graceful shutdown |
| `ws.control` | Central → Client | Redirects the client connection's target PID to its user hub |
| `hub.activity_update` | User Hub → Central | Client count update |

## See Also

- [WebSocket Relay](http/websocket-relay.md) — HTTP WebSocket endpoint configuration
- [Process Model](concepts/process-model.md) — Process lifecycle and messaging
- [Security](system/security.md) — Security actors and scopes
- [Framework Overview](framework/overview.md) — Install and import framework modules
