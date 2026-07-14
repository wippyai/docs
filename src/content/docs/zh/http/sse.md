---
title: "Server-Sent Events"
description: "SSE 中间件使用 Server-Sent Events 协议从服务器向 HTTP 客户端流式推送事件。"
---

# Server-Sent Events

SSE 中间件使用 [Server-Sent Events](https://html.spec.whatwg.org/multipage/server-sent-events.html) 协议从服务器向 HTTP 客户端流式推送事件。

提供两种机制：从 HTTP 处理函数进行**直接流式传输**，以及通过 `sse_relay` 中间件进行**进程支持的中继**。

## 直接流式传输

使用 `res:write_event()` 直接从 HTTP 处理函数发送 SSE 事件。响应在首次调用时自动切换到 SSE 模式，并设置相应的响应头。

```lua
local http = require("http")

local function handler()
    local res = http.response()

    res:write_event({name = "status", data = {state = "started"}})
    res:write_event({name = "progress", data = {percent = 50}})
    res:write_event({name = "status", data = {state = "complete"}})
end
```

每个事件需要 `name` 和 `data` 字段。`data` 值会自动进行 JSON 编码。

<tip>
直接流式传输适用于短期的请求-响应流程，如进度更新。对于由后台进程管理的长期连接，使用 SSE Relay。
</tip>

## SSE Relay

SSE Relay 中间件创建由进程支持的长期 SSE 流。它遵循与 [WebSocket Relay](http/websocket-relay.md) 相同的中继模式。

### 工作原理

1. HTTP 处理函数设置带有 JSON 中继配置的 `X-SSE-Relay` 响应头
2. 中间件拦截响应并创建 SSE 会话
3. 会话以自己的 PID 注册为一个进程
4. 发送到会话 PID 的消息作为 SSE 事件转发给客户端

## 进程语义

SSE 流是拥有自己 PID 的完整进程。它们与进程系统集成：

- **可寻址** —— 任何进程都可以向流 PID 发送消息
- **可监控** —— 进程可以监控 SSE 流的退出事件
- **可链接** —— SSE 流可以与其他进程链接
- **EXIT 事件** —— 当流关闭时，监控者会收到退出通知

```lua
-- 从任意进程向 SSE 客户端发送事件
process.send(stream_pid, "sse.message", {event = "update", value = 42})

-- 监控 SSE 流
process.monitor(stream_pid)
```

<tip>
中继会监控目标进程。如果目标退出，SSE 流自动关闭，客户端收到 <code>done</code> 事件。
</tip>

## 配置

作为路由器上的 post-match 中间件添加：

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

| 选项 | 说明 |
|--------|-------------|
| `sserelay.allowed.origins` | 逗号分隔的允许来源（支持通配符） |

<note>
如果未配置来源，则只允许同源请求。
</note>

## 处理函数设置

HTTP 处理函数生成一个进程并配置中继：

```lua
local http = require("http")
local json = require("json")

local function handler()
    local res = http.response()

    -- 生成处理进程
    local pid = process.spawn("app.sse:handler", "app:processes")

    -- 配置中继
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

### 中继配置字段

| 字段 | 类型 | 默认值 | 说明 |
|-------|------|---------|-------------|
| `target_pid` | string | — | 接收消息的进程 PID（在分离模式下省略） |
| `message_topic` | string | `sse.message` | 转发事件的主题过滤器 |
| `heartbeat_interval` | duration | `30s` | 心跳频率（如 `30s`、`1m`） |
| `idle_timeout` | duration | — | 在不活动后关闭流 |
| `hard_timeout` | duration | — | 在绝对持续时间后关闭流 |
| `metadata` | object | — | 附加到 join/leave/heartbeat 消息 |

## 受管模式与分离模式

### 受管模式

当设置了 `target_pid` 时，中继以受管模式运行：

- 监控目标进程
- 在连接时发送 `sse.join`，断开时发送 `sse.leave`
- 如果目标退出，自动关闭流

### 分离模式

当省略 `target_pid` 时，中继以分离模式启动：

- 向客户端发出带有 `stream_pid` 和 `message_topic` 的 `ready` 事件
- 初始时不监控任何进程
- 进程可稍后通过发送 `sse.control` 消息来附加

```lua
-- 分离模式设置：无 target_pid
res:set_header("X-SSE-Relay", json.encode({
    heartbeat_interval = "30s"
}))
```

客户端收到 `ready` 事件：

```json
{"stream_pid": "sse@node/abc123", "message_topic": "sse.message"}
```

## 消息主题

中继使用以下主题在流和目标进程之间通信：

| 主题 | 方向 | 时机 | 负载 |
|-------|-----------|------|---------|
| `sse.join` | stream → target | 客户端连接 | `client_pid`、`metadata` |
| `sse.message` | target → stream | 默认事件主题 | 作为 SSE 事件转发 |
| `sse.heartbeat` | stream → target | 周期性（如已配置） | `client_pid`、`uptime`、`message_count` |
| `sse.leave` | stream → target | 客户端断开 | `client_pid`、`metadata` |
| `sse.control` | any → stream | 控制命令 | 中继配置字段 |
| `sse.close` | any → stream | 强制关闭 | 可选的原因字符串 |

## 在目标进程中接收

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
            -- 周期性健康检查

        elseif topic == "sse.leave" then
            cleanup(data.client_pid)
        end
    end
end
```

## 发送事件

通过向流 PID 发送消息来向客户端发送事件：

```lua
-- 在默认消息主题上发送
process.send(stream_pid, "sse.message", {
    event = "update",
    value = 42
})

-- 强制关闭流
process.send(stream_pid, "sse.close", "session expired")
```

在配置的 `message_topic` 上发送的事件作为 SSE 事件转发给客户端。主题名称成为 SSE 事件名称。

## 连接转移

发送控制消息以动态更改目标进程、主题过滤器或超时时间：

```lua
process.send(stream_pid, "sse.control", {
    target_pid = tostring(new_pid),
    message_topic = "custom.topic",
    idle_timeout = "5m"
})
```

当目标更改时，中继向旧目标发送 `sse.leave`，向新目标发送 `sse.join`。将 `target_pid` 设置为空字符串可分离而不重新附加。

## 另见

- [中间件](http/middleware.md) —— 中间件配置
- [WebSocket Relay](http/websocket-relay.md) —— WebSocket 等价机制
- [Process](lua/core/process.md) —— 进程消息传递
