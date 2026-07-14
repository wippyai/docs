---
title: "Relay"
description: "wippy/relay 模块提供具有两层 hub 架构的 WebSocket 中继基础设施。中央 hub 管理每个用户的 hub，而后者又管理 WebSocket 客户端连接，并将消息路由到插件。"
---

# Relay

`wippy/relay` 模块提供具有两层 hub 架构的 WebSocket 中继基础设施。中央 hub 管理每个用户的 hub，而后者又管理 WebSocket 客户端连接，并将消息路由到插件。

## 架构

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

中央 hub 作为服务运行。当 WebSocket 客户端连接时，中央 hub 查找或为该用户创建一个 user hub。User hub 管理客户端的生命周期，并根据命令前缀将消息路由到插件。

## 安装

将模块添加到你的项目：

```bash
wippy add wippy/relay
wippy install
```

声明依赖并提供必需参数：

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

### 配置参数

| 参数 | 必填 | 默认值 | 说明 |
|-----------|----------|---------|-------------|
| `application_host` | 是 | — | 用于中继进程的进程宿主 |
| `env_storage` | 否 | 内部 | 环境变量存储 |
| `user_security_scope` | 是 | — | User hub 的安全作用域 |
| `max_connections_per_user` | 否 | `5` | 每个用户的 WebSocket 连接数 |
| `queue_multiplier` | 否 | `100` | 消息队列 = 连接数 × 乘数 |
| `user_hub_inactivity_timeout` | 否 | `7200s` | hub 清理前的空闲时间 |

## 客户端连接流程

1. WebSocket 客户端连接，元数据中包含 `user_id`
2. 中央 hub 验证连接并检查每个用户的限制
3. 中央 hub 为该用户创建或重用 user hub
4. User hub 向客户端发送 `welcome` 消息：

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

插件 `status` 为 `"not_started"`（已注册，从未启动）、`"pending"`（启动进行中）、`"running"`、`"failed"` 或 `"stopped"` 之一。

## 消息路由

客户端发送带有 `type` 字段的 JSON 消息。User hub 将类型前缀与已注册的插件匹配并路由消息：

```json
{ "type": "session_get_state", "data": { "key": "value" } }
```

`session_` 前缀匹配 session 插件。Hub 剥离前缀，并将消息发送到插件进程，剥离后的类型作为主题：

```lua
-- 进程主题: "get_state"
-- 负载:
{
    conn_pid = client_pid,
    type = "session_get_state",  -- 保留原始完整类型
    data = { key = "value" },
    request_id = "...",
    session_id = "..."
}
```

插件通过向 `conn_pid` 发送消息进行响应。

## 插件

插件是带有 `meta.type: relay.plugin` 的 `process.lua` 入口：

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

### 插件元数据

| 字段 | 类型 | 说明 |
|-------|------|-------------|
| `meta.type` | string | 必须为 `relay.plugin` |
| `meta.command_prefix` | string | 此插件处理的消息类型前缀 |
| `meta.auto_start` | boolean | 在 user hub 初始化时启动 |
| `meta.default_host` | string | 覆盖进程宿主 |

### 插件生命周期

插件由 user hub 生成。启动时，插件接收：

```lua
function run(args)
    local user_id = args.user_id
    local user_metadata = args.user_metadata
    local user_hub_pid = args.user_hub_pid
    local config = args.config
end
```

`session_` 插件接收生命周期消息：

| 消息 | 时机 |
|---------|------|
| `"resume"` | 第一个客户端连接到 user hub |
| `"shutdown"` | 最后一个客户端从 user hub 断开 |

插件在崩溃时自动重启 1 次。第二次崩溃后，插件被标记为 `"failed"` 且不再重启。

### 插件实现

插件在其进程收件箱接收消息。每条消息有一个主题（剥离的命令前缀）和一个负载，负载包含原始消息数据以及用于将响应发回客户端的 `conn_pid`。

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
                -- 第一个客户端已连接
            elseif topic == "shutdown" then
                -- 最后一个客户端已断开
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

## 错误处理

中继向客户端发送结构化错误消息：

| 错误代码 | 说明 |
|------------|-------------|
| `max_connections_reached` | 用户达到连接限制 |
| `missing_user_id` | 连接元数据中无 user_id |
| `hub_creation_failed` | 生成 user hub 失败 |
| `invalid_json` | 消息解码错误 |
| `unknown_command` | 消息缺少 type 字段 |
| `plugin_not_found` | 没有插件匹配命令前缀 |
| `plugin_failed` | 插件不可用或已崩溃 |

## Hub 生命周期

### User Hub 创建

User hub 按需创建——当某用户的第一个客户端连接时。Hub 以该用户的安全 Actor 和作用域生成。

### 垃圾回收

中央 hub 定期检查不活跃的 user hub。超过 `user_hub_inactivity_timeout`（默认 2 小时）没有连接客户端的 hub 会以 10 秒的取消超时被优雅终止。

GC 检查间隔自动派生：`inactivity_timeout / 2.5`。

### 安全

中央 hub 在自己的安全组（`wippy.relay.security:root`）下以完全访问权限运行。每个 user hub 以配置的 `user_security_scope` 生成，隔离用户级操作。

## 内部主题

| 主题 | 方向 | 说明 |
|-------|-----------|-------------|
| `ws.join` | Client → Central/User Hub | 连接请求 |
| `ws.leave` | Client → Central/User Hub | 断开 |
| `ws.message` | Client → User Hub | WebSocket 消息 |
| `ws.cancel` | Central → User Hub | 优雅关闭 |
| `ws.control` | Central → User Hub | 路由控制 |
| `hub.activity_update` | User Hub → Central | 客户端数量更新 |

## 另见

- [WebSocket Relay](http/websocket-relay.md) - HTTP WebSocket 端点配置
- [进程模型](concepts/process-model.md) - 进程生命周期和消息传递
- [安全](system/security.md) - 安全 Actor 和作用域
- [框架概述](framework/overview.md) - 框架模块用法
