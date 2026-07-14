---
title: "LLM 简介"
---

# LLM 简介

此页面面向 AI 代理和 LLM。如果你基于 Wippy 进行构建或为 Wippy 项目生成代码，请先阅读本页。

## Wippy 是什么

Wippy 是一个基于 Actor 模型构建的单二进制应用运行时。它在隔离的进程中运行 Lua 代码，并通过消息传递进行通信——没有共享内存，也没有锁。存在三种计算模型：函数（无状态，请求级作用域）、进程（带状态的长期 Actor）和工作流（由 Temporal 支持的持久 Actor，能够在崩溃后存活）。系统的设计使得代理可以生成代码、注册它，并在不重新部署的情况下改进应用。

## 心智模型

Wippy 中的一切都是**注册表条目**（registry entry）。条目具有 ID（`namespace:name`）、种类（决定行为）、元数据和数据。YAML 文件是声明条目的一种方式，但注册表才是运行时的真实来源，条目可以在系统运行时被创建、更新或删除。

种类决定了条目的行为：

- `function.lua` — 无状态可调用函数
- `process.lua` — 长期运行的 Actor
- `workflow.lua` — 持久工作流（Temporal）
- `http.service` — HTTP 服务器
- `http.router` — 带中间件的路由组
- `http.endpoint` — HTTP 处理器
- `db.sql.postgres` / `mysql` / `sqlite` — 数据库连接
- `store.memory` / `store.sql` — 键值存储
- `queue.queue` — 消息队列
- `process.host` — 进程执行主机
- `process.service` — 受监督的进程
- `contract.definition` / `contract.binding` — 类型化服务接口
- `registry.entry` — 配置数据

## 项目结构

```
myapp/
├── .wippy.yaml              # Runtime configuration
├── wippy.lock               # Source directories
└── src/
    ├── _index.yaml          # Entry definitions (namespace: app)
    ├── api/
    │   ├── _index.yaml      # namespace: app.api
    │   └── handler.lua
    └── workers/
        ├── _index.yaml      # namespace: app.workers
        └── task.lua
```

条目定义位于 `_index.yaml` 文件中：

```yaml
version: "1.0"
namespace: app.api

entries:
  - name: get_user
    kind: function.lua
    source: file://handler.lua
    method: get_user
    modules: [sql, json]

  - name: get_user.endpoint
    kind: http.endpoint
    meta:
      router: app:api_router
    method: GET
    path: /users/{id}
    func: app.api:get_user
```

## 编写函数

函数是无状态的。它们接收参数、执行工作并返回结果。它们继承调用者的上下文，并在调用者取消时被取消。

```lua
local sql = require("sql")
local json = require("json")
local http = require("http")

local function get_user(id)
    local db, err = sql.get("app:main_db")
    if err then return nil, err end

    local rows, err = db:query("SELECT * FROM users WHERE id = $1", id)
    if err then return nil, err end
    if #rows == 0 then return nil, errors.new(errors.NOT_FOUND, "user not found") end

    return rows[1]
end

return get_user
```

对于 HTTP 处理器，使用 `http` 模块：

```lua
local http = require("http")
local json = require("json")

local function handler()
    local req = http.request()
    local res = http.response()

    local id = req:param("id")
    local user, err = funcs.call("app.api:get_user", id)
    if err then
        res:set_status(404)
        res:write_json({error = err:message()})
        return
    end

    res:write_json(user)
end

return handler
```

## 编写进程

进程是 Actor。它们拥有自己的 PID，通过收件箱接收消息，并在消息之间保持状态。它们在阻塞 I/O 时让出执行，从而允许数千个进程并发运行。

```lua
local function worker(initial_config)
    local inbox = process.inbox()
    local events = process.events()

    while true do
        local r = channel.select {
            inbox:case_receive(),
            events:case_receive()
        }

        if r.channel == events then
            local ev = r.value
            if ev.type == process.event.CANCEL then
                break
            end
        elseif r.channel == inbox then
            local msg = r.value
            local topic = msg:topic()
            local data = msg:payload():data()
            handle_message(topic, data)
        end
    end
end

return worker
```

从其他代码中生成进程：

```lua
local pid = process.spawn("app.workers:task", "app:process_host", config)
process.send(pid, "work", {item_id = 123})
```

## 编写工作流

工作流是持久的——它们可以在崩溃和重启后存活。代码看起来像普通的 Lua。运行时会自动记录函数调用结果、休眠和随机值，以使重放具有确定性。

```lua
local function order_flow(order)
    local inventory = funcs.call("app:reserve_inventory", order.items)
    if not inventory then
        return nil, errors.new("out of stock")
    end

    local payment = funcs.call("app:charge_payment", order.total)
    if not payment then
        funcs.call("app:release_inventory", inventory.id)
        return nil, errors.new("payment failed")
    end

    -- Wait for approval signal (can block for days)
    local msg = process.inbox():receive()
    if not msg:payload():data().approved then
        funcs.call("app:refund_payment", payment.id)
        funcs.call("app:release_inventory", inventory.id)
        return nil, errors.new("rejected")
    end

    return funcs.call("app:fulfill_order", order.id)
end

return order_flow
```

## 关键 API

### 调用函数

```lua
local funcs = require("funcs")

-- Synchronous
local result, err = funcs.call("namespace:function_name", arg1, arg2)

-- Asynchronous (returns Future)
local future = funcs.async("namespace:function_name", arg1)
local result, err = future:result()

-- With context
local exec = funcs.new():with_context({user_id = "123"})
exec:call("namespace:function_name")
```

### 进程通信

```lua
-- Send message (fire-and-forget)
process.send(pid, "topic", data)

-- Receive messages
local inbox = process.inbox()
local msg, ok = inbox:receive()
local topic = msg:topic()
local data = msg:payload():data()

-- Monitor another process (receive EXIT on death)
process.monitor(pid)

-- Link processes (bidirectional failure notification)
process.spawn_linked("namespace:name", "host")
```

### 通道

用于协程通信的 Go 风格通道：

```lua
local ch = channel.new(10)  -- buffered
ch:send(value)
local val, ok = ch:receive()

-- Select on multiple channels
local r = channel.select {
    ch1:case_receive(),
    ch2:case_receive(),
    timeout:case_receive()
}
```

### 错误处理

函数返回 `result, error` 对。错误是类型化对象：

```lua
local result, err = some_operation()
if err then
    if errors.is(err, errors.NOT_FOUND) then
        -- handle not found
    end
    return nil, errors.wrap(err, "context message")
end
```

错误种类：`UNKNOWN`、`INVALID`、`NOT_FOUND`、`ALREADY_EXISTS`、`PERMISSION_DENIED`、`TIMEOUT`、`CANCELED`、`UNAVAILABLE`、`INTERNAL`、`CONFLICT`、`RATE_LIMITED`。

### 数据访问

```lua
-- SQL
local sql = require("sql")
local db = sql.get("app:main_db")
local rows, err = db:query("SELECT * FROM users WHERE active = $1", true)
db:execute("INSERT INTO users (name) VALUES ($1)", name)

-- Key-value store
local store = require("store")
local cache = store.get("app:cache")
cache:set("key", value, 3600)  -- TTL in seconds
local val = cache:get("key")

-- Queue
local queue = require("queue")
queue.publish("app:tasks", {task = "process", id = 123})

-- Filesystem
local fs = require("fs")
local vol = fs.get("app:storage")
local data = vol:readfile("path/to/file.txt")
vol:writefile("output.txt", content)
```

### HTTP 客户端

```lua
local http_client = require("http_client")

local resp, err = http_client.get("https://api.example.com/data", {
    headers = {Authorization = "Bearer token"},
    timeout = "10s"
})
local body = resp.body
```

### 安全

```lua
local security = require("security")

local actor = security.actor()       -- who is calling
local scope = security.scope()       -- what permissions apply
local allowed = security.can("read", "resource:users")

-- Token management
local ts = security.token_store("app:tokens")
local token = ts:create(actor, scope, {expiration = "24h"})
local validated_actor, validated_scope = ts:validate(token)
```

### 时间

```lua
local time = require("time")

time.sleep("5s")
local now = time.now()
local timeout = time.after("30s")  -- channel that fires once
local ticker = time.ticker("10s")  -- repeating channel
```

### 注册表

```lua
local registry = require("registry")

local entry = registry.get("app.api:get_user")
local tests = registry.find({["meta.type"] = "test"})

-- Create entries at runtime
local snap = registry.snapshot()
local changes = snap:changes()
changes:create({id = "app:new_func", kind = "function.lua", data = {...}})
changes:apply()
```

### 事件

```lua
local events = require("events")

-- Publish
events.send("orders", "order.created", "/orders/123", {order_id = "123"})

-- Subscribe (wildcards supported)
local sub = events.subscribe("orders.*")
local ch = sub:channel()
local evt = ch:receive()
```

## 模块访问控制

每个条目声明它可以 `require()` 哪些模块。未列出的模块根本不可用——除非你显式授予，否则不存在 `os.execute`、`io.open`、`debug.*` 或 `package.*`。运行时不会扫描或验证源代码；它在模块级别控制访问。如果一个模块不在列表中，那么对于该条目而言它就不存在。

```yaml
modules: [sql, json, http, time, funcs, store]
```

这也是工作流确定性的工作原理——工作流条目仅接收确定性模块。运行时在模块级别拦截 `time.now()`、`uuid.v4()` 和其他非确定性调用，记录结果以供重放。

## 框架模块

Wippy 有通过依赖安装的框架模块：

- **wippy/llm** — LLM 集成（OpenAI、Anthropic、Google）。`llm.generate()`、结构化输出、嵌入、流式传输。
- **wippy/agent** — 带工具使用、委派、特性、记忆的代理框架。代理定义为注册表条目。
- **wippy/test** — BDD 测试。`describe/it` 块、断言、模拟。
- **wippy/dataflow** — 基于 DAG 的工作流编排。Function、Agent、Cycle、Parallel 节点。
- **wippy/relay** — 带中央 Hub、按用户 Hub、插件路由的 WebSocket 中继。
- **wippy/views** — 带模板渲染的页面和组件系统。
- **wippy/facade** — 带身份验证桥接的前端 iframe 外观。

## 约定

- 条目 ID 使用 `namespace:name` 格式
- 名称使用点进行语义分隔，使用下划线分隔单词：`get_user.endpoint`
- 函数返回 `result, error`——始终检查错误
- 进程通过消息传递进行通信，从不共享状态
- 使用 `channel.select` 多路复用多个事件源
- 监督树处理失败——按"let it crash"原则设计
- 上下文（trace ID、用户信息、安全性）自动通过函数调用传播
- 工作流不能直接使用非确定性操作——运行时为 `funcs.call`、`time.sleep`、`uuid.v4`、`time.now` 处理此问题

## 文档

完整文档可在 [wippy.ai/docs](https://wippy.ai/docs) 获取。对 LLM 友好的端点：

- 浏览结构：`https://wippy.ai/llm/toc`
- 搜索：`https://wippy.ai/llm/search?q=query`
- 获取页面：`https://wippy.ai/llm/path/en/<path>`
- 批量获取：`https://wippy.ai/llm/context?paths=path1,path2`
