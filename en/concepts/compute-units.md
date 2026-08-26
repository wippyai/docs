---
title: "Compute Units"
description: "Compare Wippy functions, processes, and workflows by lifetime, state, communication, and failure handling."
---

# Compute Units

Wippy provides three ways to run code: functions, processes, and workflows. They share the same underlying machinery but differ in how long they live, where their state goes, and what happens when things fail.

## Functions

Functions run when called and return a result. They do not retain state between calls.

```lua
local result = funcs.call("app.math:add", 2, 3)
```

Functions execute in the caller's context. If the caller is canceled or exits, its running function calls are canceled as well.

<tip>
Use functions for HTTP handlers, data transformations, and anything that should complete quickly and return a result.
</tip>

## Processes

Processes are actors. They maintain state across multiple messages, run independently of whoever started them, and communicate through message passing.

```lua
local pid = process.spawn("app.workers:handler", "app:processes")
process.send(pid, "job", {task = "process_data"})
```

After being spawned, a process runs independently of the code that created it. Processes can monitor or link to one another and can participate in supervision trees that restart failed children.

The scheduler multiplexes thousands of processes across a worker pool. Each process yields when waiting for I/O, letting others run.

<tip>
Use processes for background jobs, service daemons, and anything that needs to outlive its creator or maintain state across messages.
</tip>

## Workflows

Workflows are for durable operations that must recover from interruptions. They persist execution state to a workflow provider, such as Temporal, and can resume after crashes, restarts, or infrastructure changes.

```lua
-- This can run for days, survive restarts, and never lose progress
process.spawn("app.orders:process", "app:temporal_worker", order_id)
```

Durability adds latency because workflow operations are recorded. Use workflows when recovery is more important than the lower latency of functions or processes, such as for multi-step business processes and long-running orchestration.

<note>
Wippy records supported workflow operations so they produce the same results during replay. Workflow code uses the same Lua syntax as other compute units.
</note>

## How They Compare

| | Functions | Processes | Workflows |
|---|---|---|---|
| **State** | None | In memory | Persisted |
| **Lifetime** | Single call | Until exit or crash | Persists across restarts |
| **Communication** | Return value + messages | Message passing | Activity calls + messages |
| **Failure handling** | Caller handles | Supervision trees | Automatic retry |
| **Latency** | Lowest | Low | Higher |

## Same Code, Different Behavior

Many modules adapt to their context automatically. For example, `time.sleep()` in a function blocks the worker, in a process it yields to let others run, and in a workflow it records a timer that replays correctly on recovery.
