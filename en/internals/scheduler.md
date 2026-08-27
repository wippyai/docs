---
title: "Scheduler"
description: "How Wippy schedules process work, routes events, manages worker queues, and shuts processes down."
---

# Scheduler

The scheduler executes processes on workers with local deques, inject queues, a global queue, and work stealing.

## Process Interface

The scheduler works with any type implementing the `Process` interface:

```go
type Process interface {
    Init(ctx context.Context, method string, input payload.Payloads) error
    Step(events []Event, out *StepOutput) error
    Close()
}
```

| Method | Purpose |
|--------|---------|
| `Init` | Prepare process with entry method name and input arguments |
| `Step` | Advance state machine with incoming events, write yields to output |
| `Close` | Release resources |

The `method` parameter in `Init` specifies which entry point to invoke. A process instance can expose multiple entry points, and the caller selects which one to execute.

The scheduler calls `Step()` repeatedly, passing events (yield completions, messages) and collecting yields (commands to dispatch). The process writes its status and any yields to the `StepOutput` buffer.

```go
type Event struct {
    Type  EventType  // EventYieldComplete or EventMessage
    Tag   uint64     // Correlation tag for yield completions
    Data  any        // Result data or message payload
    Error error      // Error if yield failed
}
```

## Structure

The scheduler spawns `GOMAXPROCS` workers by default. Each worker has a local deque for cache-friendly LIFO access and a per-worker MPSC inject queue for requeued work that has affinity to that worker, including yield completions and message wakes. A global FIFO queue handles new submissions and affinity-less re-queues. Processes are tracked by PID for message routing.

## Work Finding

```mermaid
flowchart TD
    W[Worker needs work] --> L{Local deque?}
    L -->|has items| LP[Pop from bottom LIFO]
    L -->|empty| I{Inject queue?}
    I -->|has items| IP[Pop + drain up to 16 to local]
    I -->|empty| G{Global queue?}
    G -->|has items| GP[Pop + batch transfer up to 16]
    G -->|empty| S[Scan other workers from rotating start]
    S --> SH[Steal up to half, capped at 32]
```

Workers check sources in priority order:

| Priority | Source | Pattern |
|----------|--------|---------|
| 1 | Local deque | LIFO pop, lock-free, cache-friendly |
| 2 | Inject queue | MPSC pop of affine requeues/events, drain up to 16 to local |
| 3 | Global queue | FIFO pop with batch transfer |
| 4 | Other workers | Scan from a rotating start index and steal up to half, capped at 32 items per attempt |

When popping from the inject or global queue, workers take one item and move up to 16 more to their local deque.

## Chase-Lev Deque

Each worker owns a Chase-Lev work-stealing deque:

```go
type Deque struct {
    buffer atomic.Pointer[dequeBuffer]
    top    atomic.Int64  // Thieves steal from here (CAS)
    bottom atomic.Int64  // Owner pushes/pops here
}
```

The owner pushes and pops from the bottom (LIFO) without a mutex; popping the
last item uses CAS to coordinate with thieves. Thieves steal from the top (FIFO)
using CAS. This gives the owner cache-friendly access to recently-pushed items
while distributing older work to stealers.

`StealHalfInto` takes up to half the available items in one CAS operation,
limited by the destination buffer. Worker steal attempts use a 32-item buffer.

## Adaptive Spinning

Before blocking on the condition variable, workers spin adaptively:

| Spin Count | Action |
|------------|--------|
| < 4 | Tight loop |
| 4-15 | Yield thread (`runtime.Gosched`) |
| >= 16 | Block on condition variable |

## Process States

```mermaid
stateDiagram-v2
    [*] --> Ready: Submit
    Ready --> Running: CAS by worker
    Running --> Complete: done
    Running --> Blocked: yields commands
    Running --> Idle: waiting for messages
    Blocked --> Ready: CompleteYield
    Idle --> Ready: Send arrives
```

| State | Description |
|-------|-------------|
| Ready | Queued for execution |
| Running | Worker is executing Step() |
| Blocked | Waiting for yield completion |
| Idle | Waiting for messages |
| Complete | Execution finished |

A wakeup flag handles races: if a handler calls `CompleteYield` while the worker still owns the process (Running), it sets the flag. The worker checks the flag after dispatching and re-queues if set.

## Event Queue

Each process has an MPSC (multi-producer, single-consumer) event queue:

- **Producers**: Command handlers (`CompleteYield`), message senders (`Send`)
- **Consumer**: Worker drains events in `Step()`

## Message Routing

The scheduler implements `relay.Receiver` to route messages to processes. When `Send()` is called, it looks up the target PID in `byPID` map, pushes the message as an event to the process queue, and wakes the process if it is idle or blocked. It re-queues via injectOrGlobal, which pushes to the last worker's per-worker inject queue when the process has a known worker affinity, and falls back to the global queue otherwise.

## Shutdown

On shutdown, the scheduler sends cancel events to all tracked processes and waits for them to complete or timeout. Workers exit once no work remains.

## See Also

- [Command Dispatch](./dispatch.md) - How yields reach handlers
- [Process Model](../concepts/process-model.md) - High-level concepts
