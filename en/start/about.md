---
title: What Is Wippy - Concepts and Runtime Overview
description: Understand how Wippy works before you install it. Covers the actor model, the registry, durable workflows, and why the system is designed to change while it runs.
---

# About Wippy

Wippy is an open-source actor-model runtime for software that needs to change while it is running: automation systems, AI agents, plugin architectures, and similar applications where the core gets engineered once and then adapted repeatedly without rebuilding or redeploying.

For a full product overview including what Wippy replaces, what it is not, and who builds it, see the [About page](https://wippy.ai/about).

The foundation is the actor model. Code runs in isolated processes that communicate through messages, each managing its own state. When something fails, it fails in isolation. Supervision trees handle recovery automatically, restarting processes when they crash.

```lua
local worker = process.spawn("app.workers:handler", "app:processes")
process.send(worker, "task", {id = 1, data = payload})
process.monitor(worker)
```

Configuration lives in a central registry that propagates changes as events. Update a config file, and running processes receive the changes. They adapt without restarts. New connections, updated behavior, whatever you need, while the system keeps running.

```lua
local db = registry.get("app.db:postgres")
local cache = registry.get("app.cache:redis")
```

For operations that must survive infrastructure failures, the runtime persists state automatically: payment flows, multi-step workflows, and long-running agent tasks. Server dies mid-operation? The workflow resumes on another machine, right where it stopped.

The whole system runs from a single file. No containers to orchestrate, no services to coordinate. One binary, one config, and the runtime handles the rest.

For the full story of why Wippy was built, see [Why We Built Wippy](https://wippy.ai/about#why-we-built-wippy).
