---
title: "WASM Processes"
description: "Run stateful WASM actors under a Wippy process host with process.wasm."
---

# WASM Processes

A `process.wasm` entry creates a persistent, isolated WASM actor under a Wippy
process host. One module instance lives for the PID lifetime, keeps its guest
state between messages, and participates in spawning, monitoring, messaging,
and supervised shutdown.

**Classification: process configuration and lifecycle reference.** Binary-backed
blocks assume an external component build and application-owned filesystem,
process host, environment, and policy entries. Placeholder hashes must be
replaced with the exact binary digest.

## Entry Configuration

```yaml
entries:
  - name: wasm_binaries
    kind: fs.directory
    directory: ./wasm

  - name: compute_worker
    kind: process.wasm
    fs: myns:wasm_binaries
    path: /worker.wasm
    hash: sha256:292b796376f8b4cc360acf2ea6b82d1084871c3607a079f30b446da8e5c984a4
    method: run
    imports:
      - wippy:actor
      - wasi:io
      - wasi:poll
    options:
      limits:
        memory_bytes: 67108864
      mailbox:
        capacity: 128
        bytes: 8388608
        message_bytes: 1048576
```

### Configuration Fields

| Field | Required | Description |
|-------|----------|-------------|
| `fs` | Yes | Filesystem entry ID containing the binary |
| `path` | Yes | Path to `.wasm` file within the filesystem |
| `hash` | Yes | SHA-256 hash for integrity verification |
| `method` | Yes | Exported function name to execute |
| `transport` | No | Invocation transport: `payload` (default) or `wasi-http` |
| `wit` | No | WIT signature for raw/core modules |
| `imports` | No | Host imports to enable |
| `wasi` | No | WASI configuration (`args`, `cwd`, `env`, and `mounts`) |
| `options` | No | Actor controls: `worker_class`, `limits`, and `mailbox` |

<note>
`process.wasm` actors own one instance for their whole PID lifetime, so function
pooling does not apply. A root `pool` block is rejected. Put actor limits under
`options.limits`; the old root `limits` and `meta.options` spellings are accepted
temporarily with a deprecation warning.
</note>

## Stateful Actors and Messaging

Import `wippy:actor` in a component guest to access the current PID and its
bounded mailbox. The `wippy:actor/process@0.1.0` interface provides:

| Function | Behavior |
|----------|----------|
| `self()` | Return the current actor PID as a string |
| `send(target, topic, payloads)` | Send a policy-checked message to another PID |
| `try-receive()` | Return the next message immediately, or `none` |
| `receive()` | Suspend until a message is available |
| `subscribe()` | Return a `wasi:io/poll` pollable for mailbox readiness |

Messages contain the sender PID, a topic, and up to 16 payloads. Payload formats
are `bytes`, UTF-8 `text`, and UTF-8 `json`. Sending is authorized as
`process.send` against the target PID. Mailbox admission rejects malformed,
oversized, and over-capacity messages before the guest receives them.

The guest normally exports a long-running `run` function. For example:

```wit
package example:worker;

world worker {
  import wippy:actor/process@0.1.0;
  import wasi:io/poll@0.2.8;
  export run: func() -> result<_, string>;
}
```

Inside `run`, call `receive()` in a loop, update guest state, and use `send()`
to reply to `message.from`. Returning from `run` exits the process.

## Actor Controls

Configure persistent resource and mailbox budgets under `options`:

```yaml
options:
  worker_class: wasm
  limits:
    memory_bytes: 67108864
    host_buffer_bytes: 8388608
    asyncify_stack_bytes: 65536
    max_execution_ms: 0
    max_open_sockets: 16
    socket_timeout_ms: 30000
  mailbox:
    capacity: 128
    bytes: 8388608
    message_bytes: 1048576
```

| Field | Default | Description |
|-------|---------|-------------|
| `worker_class` | `wasm` | Dedicated scheduler worker class; `wasm` is currently the only supported value |
| `limits.memory_bytes` | 64 MiB | Guest linear-memory ceiling; a positive 64 KiB multiple, at most 4 GiB |
| `limits.host_buffer_bytes` | unlimited | Accounted resident host-buffer ceiling; `0` disables this byte ceiling |
| `limits.asyncify_stack_bytes` | runtime default (64 KiB) | Owned suspension storage for a core module |
| `limits.max_execution_ms` | unlimited | Wall-clock lifetime for the actor; `0` means no deadline |
| `limits.max_open_sockets` | 16 | Concurrent open sockets owned by the actor |
| `limits.socket_timeout_ms` | 30000 | Socket operation timeout in milliseconds |
| `mailbox.capacity` | 128 | Maximum queued messages |
| `mailbox.bytes` | 8 MiB | Aggregate queued-message budget |
| `mailbox.message_bytes` | 1 MiB | Per-message budget, including framing overhead |

`mailbox.message_bytes` cannot exceed `mailbox.bytes`. The capacity must also
fit the byte budget's minimum 256-byte accounting per queued message. Unknown
fields and invalid values fail entry admission.

## CLI Commands

Register a WASM process as a named command with `meta.command`:

```yaml
  - name: greet
    kind: process.wasm
    meta:
      command:
        name: greet
        short: Greet someone via WASM
    fs: myns:wasm_binaries
    path: /component.wasm
    hash: sha256:...
    method: greet
```

Run it with:

```bash
wippy run greet
```

List available commands:

```bash
wippy run list
```

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Command name used with `wippy run <name>` |
| `short` | No | Short description shown in `wippy run list` |
| `main` | No | Mark the entry as the default command for a pack or hub module |
| `use_case` | No | Entrypoint category; defaults to `run` |
| `security` | No | Security context applied only when the trusted terminal launcher starts this command |

A `terminal.host` must be present for CLI commands to work; it is the process host that runs the command.

## Process Lifecycle

WASM processes follow the Init/Step/Close lifecycle model:

1. **Init** - Call context, method, and input arguments are captured
2. **Step** - The first step instantiates and starts the module. Later steps advance dispatcher-bridged operations; a synchronous execution can complete in the first step.
3. **Close** - Instance resources are released

## Spawning from Lua

Spawn a WASM process and monitor it for completion:

```lua
local errors = require("errors")

-- Spawn with monitoring
local pid, err = process.spawn_monitored(
    "myns:compute_worker",   -- entry ID
    "myns:processes",        -- process host
    6, 7                     -- arguments passed to the WASM function
)

if err then
    return nil, err
end

-- Wait for the process to complete
local events = process.events()
while true do
    local event, open = events:receive()
    if not open then return nil, errors.new("process event channel closed") end
    if event.kind == process.event.EXIT and event.from == pid then
        local result = event.result.value  -- return value from the WASM function
        return result, event.result.error
    end
end
```

## Async Execution

WASM actors yield for host operations that the runtime bridges through the
dispatcher, including mailbox receive/send, polling, clocks, sockets, DNS,
filesystem streams, and outgoing HTTP. The scheduler suspends the process until
the pending operation completes, then resumes the same guest instance:

```yaml
  - name: http_worker
    kind: process.wasm
    fs: myns:wasm_binaries
    path: /http_worker.wasm
    hash: sha256:...
    method: run
    imports:
      - wasi:io
      - wasi:cli
      - wasi:http
    wasi:
      env:
        - id: myns:api_url
          name: API_URL
          required: true
```

The yield/resume mechanism is transparent to an asyncified core module or a
component using the supported pollable interfaces.

## WASI Configuration

Processes support the same WASI configuration as functions:

```yaml
  - name: file_processor
    kind: process.wasm
    fs: myns:wasm_binaries
    path: /processor.wasm
    hash: sha256:...
    method: process
    imports:
      - wasi:cli
      - wasi:io
      - wasi:clocks
      - wasi:filesystem
    wasi:
      args: ["--input", "/data/input.csv"]
      cwd: "/app"
      env:
        - id: myns:output_format
          name: OUTPUT_FORMAT
      mounts:
        - fs: myns:input_data
          guest: /data
          read_only: true
        - fs: myns:output_dir
          guest: /output
```

## See Also

- [Overview](wasm/overview.md) - WebAssembly runtime overview
- [Functions](wasm/functions.md) - WASM function configuration
- [Host Functions](wasm/hosts.md) - Available host interfaces
- [Process Model](concepts/process-model.md) - Process lifecycle
- [Supervision](guides/supervision.md) - Process supervision trees
