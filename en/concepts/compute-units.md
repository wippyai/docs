# Compute Units

Wippy provides three ways to run code: functions, processes, and workflows. They share the same underlying machinery but differ in how long they live, where their state goes, and what happens when things fail.

## Functions

Functions are the simplest model. You call them, they run, they return a result. No state persists between calls.

```lua
local result = funcs.call("app.math:add", 2, 3)
```

Functions execute in the caller's context. If the caller cancels or exits, any running functions get canceled too. This keeps things simple—you don't have to think about cleanup.

<tip>
Use functions for HTTP handlers, data transformations, and anything that should complete quickly and return a result.
</tip>

## Processes

Processes are actors. They maintain state across multiple messages, run independently of whoever started them, and communicate through message passing.

```lua
local pid = process.spawn("app.workers:handler", "app:processes")
process.send(pid, "job", {task = "process_data"})
```

When you spawn a process, it keeps running even after your code finishes. Processes can monitor each other, link together, and form supervision trees that automatically restart failed children.

The scheduler multiplexes thousands of processes across a worker pool. Each process yields when waiting for I/O, letting others run.

<tip>
Use processes for background jobs, service daemons, and anything that needs to outlive its creator or maintain state across messages.
</tip>

## Workflows

Workflows are for operations that absolutely cannot fail. They persist their state to a workflow provider (Temporal or others) and can resume exactly where they left off after crashes, restarts, or infrastructure changes.

```lua
-- This can run for days, survive restarts, and never lose progress
workflow.execute("app.orders:process", order_id)
```

The trade-off is latency. Every step gets recorded, so workflows are slower than functions or processes. But for multi-step business processes or long-running orchestrations, that durability is worth it.

<note>
Wippy automatically handles determinism for workflows. You don't need to learn any special techniques—write normal code and the runtime ensures it behaves correctly during replay.
</note>

## How They Compare

| | Functions | Processes | Workflows |
|---|---|---|---|
| **State** | None | In memory | Persisted |
| **Lifetime** | Single call | Until exit or crash | Survives everything |
| **Communication** | Return value + messages | Message passing | Activity calls + messages |
| **Failure handling** | Caller handles | Supervision trees | Automatic retry |
| **Latency** | Lowest | Low | Higher |

## Same Code, Different Behavior

Many modules adapt to their context automatically. For example, `time.sleep()` in a function blocks the worker, in a process it yields to let others run, and in a workflow it records a timer that replays correctly on recovery.

