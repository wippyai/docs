---
title: 什么是 Wippy - 概念与运行时概览
description: 在安装之前先了解 Wippy 的工作原理。涵盖 Actor 模型、注册表、持久化工作流，以及为何系统设计为可在运行时变化。
---

# 关于 Wippy

Wippy 是一个开源的 Actor 模型运行时，专为需要在运行时动态变化的软件设计：自动化系统、AI 代理、插件架构等。核心只需构建一次，之后可以反复调整而无需重新构建或部署。

如需完整的产品概览，包括 Wippy 替代了什么、它不是什么以及由谁构建，请参阅 [About 页面](https://wippy.ai/about)。

底层采用 Actor 模型。代码运行在隔离的进程中，通过消息进行通信，每个进程管理自己的状态。当某处发生故障时，故障被隔离在该进程内。监管树自动处理恢复，在进程崩溃时重启它们。

```lua
local worker = process.spawn("app.workers:handler", "app:processes")
process.send(worker, "task", {id = 1, data = payload})
process.monitor(worker)
```

配置存储在中央注册表中，变更以事件形式传播。更新配置文件后，正在运行的进程会收到变更通知。它们无需重启即可适应：新的连接、更新的行为，随你所需，而系统持续运行。

```lua
local db = registry.get("app.db:postgres")
local cache = registry.get("app.cache:redis")
```

对于必须在基础设施故障中存活的操作，运行时会自动持久化状态：支付流程、多步骤工作流、长时间运行的代理任务。服务器在操作中途宕机？工作流会在另一台机器上从中断处继续执行。

整个系统从单个文件运行。无需编排容器，无需协调服务。一个二进制文件，一个配置，运行时处理其余一切。

要了解我们构建 Wippy 的完整缘由，请参阅 [Why We Built Wippy](https://wippy.ai/about#why-we-built-wippy)。
