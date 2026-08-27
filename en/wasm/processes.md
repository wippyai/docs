---
title: "WASM Processes"
description: "Run WASM modules under a Wippy process host with process.wasm."
---

# WASM Processes

A `process.wasm` entry runs a WASM module under a Wippy process host with spawning, monitoring, and supervised shutdown.

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
    method: compute
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
| `limits` | No | Execution limits |

<note>
`process.wasm` shares its config struct with `function.wasm`, so a `pool` block is accepted by the schema but ignored — processes run under the process host rather than a function pool.
</note>

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

A `terminal.host` must be present for CLI commands. It owns the scheduler used
for the command process, so a separate `process.host` is not required. When
multiple terminal hosts exist, select one with `--host`.

## Process Lifecycle

WASM processes follow the Init/Step/Close lifecycle model:

1. **Init** - Call context, method, and input arguments are captured
2. **Step** - The first step instantiates and starts the module. Later steps advance dispatcher-bridged operations; a synchronous execution can complete in the first step.
3. **Close** - Instance resources are released

## Spawning from Lua

Spawn a WASM process and monitor it for completion:

```lua
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

WASM processes can yield for host operations that the runtime bridges through
the dispatcher, including supported clock polling and outgoing HTTP. The
scheduler suspends the process until that pending operation completes, then
resumes it:

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

The yield/resume mechanism is transparent to the guest for those asyncified
operations. Do not assume every blocking WASI call yields: stream reads and
writes are synchronous in the pinned runtime.

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

- [Overview](./overview.md) - WebAssembly runtime overview
- [Functions](./functions.md) - WASM function configuration
- [Host Functions](./hosts.md) - Available host interfaces
- [Process Model](../concepts/process-model.md) - Process lifecycle
- [Supervision](../guides/supervision.md) - Process supervision trees
