# WebSocket Relay

WebSocket relay 中间件将 HTTP 连接升级为 WebSocket 并将消息中继到目标进程。

## 工作原理

1. HTTP 处理器设置 `X-WS-Relay` 头，包含目标进程 PID
2. 中间件将连接升级为 WebSocket
3. Relay 附加到目标进程并监控它
4. 消息在客户端和进程之间双向流动

<warning>
WebSocket 连接绑定到目标进程。如果进程退出，连接自动关闭。
</warning>

## 进程语义

WebSocket 连接是完整的进程，拥有自己的 PID。它们与进程系统集成：

- **可寻址** - 任何进程都可以向 WebSocket PID 发送消息
- **可监控** - 进程可以监控 WebSocket 连接的退出事件
- **可链接** - WebSocket 连接可以链接到其他进程
- **EXIT 事件** - 连接关闭时，监控者收到退出通知

```lua
-- 从另一个进程监控 WebSocket 连接
process.monitor(websocket_pid)

-- 从任何进程向 WebSocket 客户端发送消息
process.send(websocket_pid, "ws.send", {type = "text", data = "hello"})
```

<tip>
Relay 监控目标进程。如果目标退出，WebSocket 连接自动关闭，客户端收到关闭帧。
</tip>

## 连接转移

可以通过发送控制消息将连接转移到另一个进程：

```lua
process.send(websocket_pid, "ws.control", {
    target_pid = new_process_pid,
    message_topic = "ws.message"
})
```

## 配置

在路由器上添加为匹配后中间件：

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

| 选项 | 说明 |
|------|------|
| `wsrelay.allowed.origins` | 允许的来源，逗号分隔 |

<note>
如果未配置来源，仅允许同源请求。
</note>

## 处理器设置

HTTP 处理器生成进程并配置 relay：

```lua
local http = require("http")
local json = require("json")

local function handler()
    local req = http.request()
    local res = http.response()

    -- 生成处理进程
    local pid = process.spawn("app.ws:handler", "app:processes")

    -- 配置 relay
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

### Relay 配置字段

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `target_pid` | string | 必填 | 接收消息的进程 PID |
| `message_topic` | string | `ws.message` | 客户端消息的主题 |
| `heartbeat_interval` | duration | - | 心跳频率 (如 `30s`) |
| `metadata` | object | - | 附加到所有消息 |

## 消息主题

Relay 向目标进程发送以下消息：

| 主题 | 时机 | 负载 |
|------|------|------|
| `ws.join` | 客户端连接 | `client_pid`, `metadata` |
| `ws.message` | 客户端发送消息 | `client_pid`, `type`, `data`, `metadata` |
| `ws.heartbeat` | 定期 (如果配置) | `client_pid`, `uptime`, `message_count` |
| `ws.leave` | 客户端断开 | `client_pid`, `reason`, `metadata` |

## 接收消息

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
            -- 客户端已连接
            local client_pid = data.client_pid

        elseif topic == "ws.message" then
            -- 处理客户端消息
            local content = json.decode(data.data)
            handle_message(data.client_pid, content)

        elseif topic == "ws.leave" then
            -- 客户端已断开
            cleanup(data.client_pid)
        end
    end
end
```

## 发送到客户端

使用客户端 PID 发送回复消息：

```lua
-- 发送文本消息
process.send(client_pid, "ws.send", {
    type = "text",
    data = json.encode({event = "update", value = 42})
})

-- 发送二进制
process.send(client_pid, "ws.send", {
    type = "binary",
    data = binary_content
})

-- 关闭连接
process.send(client_pid, "ws.close", {
    code = 1000,
    reason = "Session ended"
})
```

## 广播

跟踪客户端 PID 以广播到多个客户端：

```lua
local clients = {}

-- 加入时
clients[client_pid] = true

-- 离开时
clients[client_pid] = nil

-- 广播
local function broadcast(message)
    local data = json.encode(message)
    for pid, _ in pairs(clients) do
        process.send(pid, "ws.send", {type = "text", data = data})
    end
end
```

<tip>
对于复杂的多房间场景，可以为每个房间生成独立的处理进程，或使用中央管理进程追踪房间成员。
</tip>

## 参见

- [中间件](http/middleware.md) - 中间件配置
- [进程](lua/core/process.md) - 进程消息传递
- [WebSocket 客户端](lua/http/websocket.md) - 出站 WebSocket 连接
