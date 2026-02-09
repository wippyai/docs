# WASM Processes

WASM modules can run as processes through the `process.wasm` entry kind. Processes execute within the Wippy process host and support the full process lifecycle: spawning, monitoring, and supervised shutdown.

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
| `imports` | No | Host imports to enable |
| `wasi` | No | WASI configuration (args, env, mounts) |
| `limits` | No | Execution limits |

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

A `terminal.host` and `process.host` must be present for CLI commands to work.

## Process Lifecycle

WASM processes follow the Init/Step/Close lifecycle model:

1. **Init** - Module is instantiated, input arguments are captured
2. **Step** - Execution advances. For async modules, the scheduler drives yield/resume cycles. For synchronous modules, execution completes in a single step.
3. **Close** - Instance resources are released

## Spawning from Lua

Spawn a WASM process and monitor it for completion:

```lua
local process = require("process")
local time = require("time")

-- Spawn with monitoring
local pid, err = process.spawn_monitored(
    "myns:compute_worker",   -- entry ID
    "myns:processes",        -- process group
    6, 7                     -- arguments passed to the WASM function
)

if err then
    error("spawn failed: " .. tostring(err))
end

-- Wait for the process to complete
local event = process.receive(time.seconds(10))
if event and event.type == "EXIT" then
    local result = event.value  -- return value from the WASM function
end
```

## Async Execution

WASM processes that import WASI interfaces can perform async operations. The scheduler suspends the process during I/O and resumes it when the operation completes:

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

The yield/resume mechanism is transparent to the WASM code. Standard blocking calls in the guest (sleep, read, write, HTTP requests) automatically yield to the dispatcher.

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
