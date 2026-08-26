---
title: What Is Wippy? Concepts and Runtime Overview
description: Learn how Wippy uses actors, a central registry, and durable workflows to support applications that change while running.
---

# About Wippy

Wippy is an open-source actor-model runtime for applications whose behavior changes while they run. It is designed for automation systems, AI agents, plugin architectures, and other applications that need to evolve without rebuilding or redeploying the runtime.

The foundation is the actor model. Code runs in isolated processes that communicate through messages, with each process managing its own state. Supervision trees can restart processes after failures.

```lua
local worker = process.spawn("app.workers:handler", "app:processes")
process.send(worker, "task", {id = 1, data = payload})
process.monitor(worker)
```

Configuration lives in a central registry, and registry changes propagate as events. Running processes can respond to updated configuration without restarting the entire application.

```lua
local db = registry.get("app.db:postgres")
local cache = registry.get("app.cache:redis")
```

For operations that must recover from infrastructure failures, durable workflows persist execution state. This model suits payment flows, multi-step processes, and long-running agent tasks that may need to resume after a restart.

The runtime is distributed as a single binary and configured through project files.

For the full story of why Wippy was built, see [Why We Built Wippy](https://wippy.ai/about#why-we-built-wippy).
