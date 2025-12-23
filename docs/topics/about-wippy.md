# About Wippy

Wippy is an application runtime for software that needs to change while it's running—automation systems, AI agents, plugin architectures, and similar applications where the core gets engineered once and then adapted repeatedly without rebuilding or redeploying.

The foundation is the actor model. Code runs in isolated processes that communicate through messages, each managing its own state. When something fails, it fails in isolation. Supervision trees handle recovery automatically, restarting processes when they crash.

```lua
local worker = process.spawn("app.workers:handler", "app:processes")
process.send(worker, "task", {id = 1, data = payload})
process.monitor(worker)
```

Configuration lives in a central registry that propagates changes as events. Update a config file, and running processes receive the changes. They adapt without restarts—new connections, updated behavior, whatever you need—while the system keeps running.

```lua
local db = registry.get("app.db:postgres")
local cache = registry.get("app.cache:redis")
```

For operations that must survive infrastructure failures—payment flows, multi-step workflows, long-running agent tasks—the runtime persists state automatically. Server dies mid-operation? The workflow resumes on another machine, right where it stopped.

The whole system runs from a single file. No containers to orchestrate, no services to coordinate. One binary, one config, and the runtime handles the rest.

## Background

The actor model comes from Erlang, where it's been running telecom switches since the 1980s. The "let it crash" philosophy—isolate failures, restart fast—comes from there too. Go showed that channels and message-passing can make concurrent code readable. Temporal proved that durable workflows don't have to mean fighting the framework.

We built Wippy because AI agents need infrastructure that can change while they're running. New tools, updated prompts, different models—these can't wait for a deploy cycle. When an agent needs to try a new approach, that change should work in seconds, not after a release.

Since agents run as actors with registry access, they can make these changes themselves—generating code, registering new components, adjusting their own workflows. Given sufficient permissions, an agent can improve how it works without human intervention. The system can write itself.
