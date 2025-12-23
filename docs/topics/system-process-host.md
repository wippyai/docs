# Process Host

Process hosts manage Lua process execution using a work-stealing scheduler.

<note>
Each host schedules processes independently. Load is not distributed between hosts automatically.
</note>

## Entry Kind

| Kind | Description |
|------|-------------|
| `process.host` | Process execution host with scheduler |

## Configuration

```yaml
- name: main_host
  kind: process.host
  host:
    workers: 8
    queue_size: 1024
    local_queue_size: 256
  lifecycle:
    auto_start: true
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `workers` | int | NumCPU | Worker goroutines |
| `queue_size` | int | 1024 | Global queue capacity |
| `local_queue_size` | int | 256 | Per-worker local deque size |

## Scheduler

The scheduler uses work-stealing: each worker has a local deque, and idle workers steal from the global queue or other workers. This balances load automatically.

- **Workers** execute processes concurrently
- **Global queue** holds pending processes when all workers are busy
- **Local queues** reduce contention by keeping work close to workers

## Process Types

Process hosts execute entries of these kinds:

| Kind | Description |
|------|-------------|
| `lua.process` | Source-based Lua process |
| `lua.process.bytecode` | Precompiled Lua bytecode |

<note>
Additional process kinds are planned for future releases.
</note>

Processes run independently with their own context, communicate via messages, and are supervised for fault tolerance.
