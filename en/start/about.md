---
title: What Is Wippy? The Runtime for AI-Native Applications
description: Wippy is an open-source, self-hosted runtime for AI-native applications. Learn how actors, a central registry and durable workflows let you build AI agents and complete applications on one runtime.
---

# About Wippy

Wippy is an open-source runtime for AI-native applications. AI agents, durable workflows, and the application around them run on one self-hosted runtime, from a single tool to a complex multi-agent product. Applications can be extended while they run, by people or by agents, without rebuilding or redeploying the runtime.

The foundation is the actor model. Code runs in isolated processes that communicate through messages, with each process managing its own state. Supervised process services can be restarted according to their lifecycle policy.

```lua
local worker, err = process.spawn("app.workers:handler", "app:processes")
if not worker then
    return nil, err
end

local ok, monitor_err = process.monitor(worker)
if not ok then
    return nil, monitor_err
end

return process.send(worker, "task", {id = 1, data = payload})
```

Runtime definitions live in a central registry. For entry kinds dispatched through the event bus, registered handlers reconcile accepted changes without restarting the entire application. Some internal entry kinds intentionally bypass event dispatch.

```lua
local db, err = registry.get("app.db:postgres")
if not db then
    return nil, err
end

local cache, cache_err = registry.get("app.cache:redis")
if not cache then
    return nil, cache_err
end
```

For operations that must recover from infrastructure failures, durable workflows persist execution state. This model suits payment flows, multi-step processes, and long-running agent tasks that may need to resume after a restart.

The runtime is distributed as a single binary and configured through project files.

For the project overview and design notes, see [About Wippy](https://wippy.ai/about).
