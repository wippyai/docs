---
title: "Lua 记录类型"
---

# Lua 记录类型

Lua 相关记录的配置：函数、进程、工作流和库。

## 记录类型

| 类型 | 描述 |
|------|------|
| `function.lua` | 无状态函数，按需运行 |
| `process.lua` | 带状态的长时间运行 Actor |
| `workflow.lua` | 持久化工作流（Temporal） |
| `library.lua` | 被其他记录导入的共享代码 |
| `module.lua` | 模块表面（多方法库） |

每种类型都有一个预编译的字节码对应版本（`function.lua.bc`、`library.lua.bc`、`process.lua.bc`、`workflow.lua.bc`），由 `wippy pack --bytecode` 生成。作者编写 `.lua` 记录；打包时会自动生成字节码类型。

## 通用字段

所有 Lua 记录共享这些字段：

| 字段 | 必需 | 描述 |
|------|------|------|
| `name` | 是 | 命名空间内的唯一名称 |
| `kind` | 是 | 上述 Lua 类型之一 |
| `source` | 是 | Lua 文件路径（`file://path.lua`） |
| `method` | function/process/workflow | 要导出的函数（库不使用此字段） |
| `modules` | 否 | `require()` 允许的模块 |
| `imports` | 否 | 作为本地模块的其他记录 |
| `meta` | 否 | 可搜索的元数据 |

## function.lua

按需调用的无状态函数。每次调用都是独立的。

```yaml
- name: handler
  kind: function.lua
  source: file://handler.lua
  method: main
  modules:
    - http
    - json
```

用途：HTTP 处理器、数据转换、工具函数。

## process.lua

跨消息维护状态的长时间运行 Actor。通过消息传递进行通信。

```yaml
- name: worker
  kind: process.lua
  source: file://worker.lua
  method: main
  modules:
    - process
    - sql
```

用途：后台工作者、服务守护进程、有状态 Actor。

作为受监管服务运行：

```yaml
- name: worker_service
  kind: process.service
  process: app:worker
  host: app:processes
  lifecycle:
    auto_start: true
    restart:
      max_attempts: 10
```

## workflow.lua

能在重启后存活的持久化工作流。状态持久化到 Temporal。

```yaml
- name: order_processor
  kind: workflow.lua
  source: file://order_workflow.lua
  method: main
  modules:
    - workflow
    - time
```

用途：多步骤业务流程、长时间运行的编排。

## library.lua

可被其他记录导入的共享代码。

```yaml
- name: helpers
  kind: library.lua
  source: file://helpers.lua
  modules:
    - json
    - base64
```

其他记录通过 `imports` 引用它：

```yaml
- name: handler
  kind: function.lua
  source: file://handler.lua
  method: main
  imports:
    helpers: app.lib:helpers
```

在 Lua 代码中：

```lua
local helpers = require("helpers")
helpers.format_date(timestamp)
```

## 模块

`modules` 字段控制哪些模块可以用 `require()` 加载：

```yaml
modules:
  - http
  - json
  - sql
  - process
```

`channel`、`print`、`subscribe` 和 `unsubscribe` 作为 Lua 全局加载——无需出现在 `modules:` 中。

只有列出的模块可用。这提供了：
- 安全性：防止访问系统模块
- 显式依赖：清楚代码需要什么
- 确定性：工作流只获得确定性模块

参见 [Lua 运行时](lua/overview.md) 了解可用模块。

## 导入

将其他记录作为本地模块导入：

```yaml
imports:
  utils: app.lib:utils       # require("utils")
  auth: app.auth:helpers     # require("auth")
```

键成为 Lua 代码中的模块名。值是记录 ID（`命名空间:名称`）。

## 池配置

为函数配置执行池：

```yaml
- name: handler
  kind: function.lua
  source: file://handler.lua
  method: main
  pool:
    type: adaptive    # 默认
    size: 4           # 初始 worker 数
    max_size: 16      # 弹性池上限
```

| 字段 | 池类型 | 描述 |
|------|--------|------|
| `type` | 全部 | 调度器实现（参见下表） |
| `size` | static, lazy, adaptive | 初始 worker 数 |
| `workers` | engine v2 | worker 线程数 |
| `buffer` | static, adaptive | 任务队列容量（默认 `workers * 64`） |
| `warm_start` | adaptive | 启动时预编译条目 |
| `max_size` | lazy, adaptive | 弹性扩展上限（默认 16） |

| 类型 | 行为 |
|------|------|
| `inline` | 在调用者的 goroutine 中同步执行。延迟最低，调用之间无隔离。 |
| `lazy` | 空闲时无 worker，按需创建，空闲时回收。 |
| `static` | 基于 channel 的固定大小池。在稳定负载下可预测。 |
| `adaptive` | 自动扩展池——负载下扩容，空闲时收缩。默认。 |

## 元数据

使用 `meta` 进行路由和发现：

```yaml
- name: api_handler
  kind: function.lua
  meta:
    type: handler
    version: "2.0"
    tags: [api, users]
  source: file://api.lua
  method: handle
  modules:
    - http
    - json
```

元数据可通过注册表搜索：

```lua
local registry = require("registry")
local handlers = registry.find({type = "handler"})
```

## 另请参阅

- [记录类型](guides/entry-kinds.md) — 所有记录类型参考
- [计算单元](concepts/compute-units.md) — 函数 vs 进程 vs 工作流
- [Lua 运行时](lua/overview.md) — 可用模块
