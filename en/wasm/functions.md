# WASM Functions

WASM functions are registry entries that execute WebAssembly code. Two entry kinds are available: `function.wat` for inline WAT source and `function.wasm` for precompiled binaries.

## Inline WAT Functions

Define small WASM functions directly in your `_index.yaml` using WebAssembly Text format:

```yaml
entries:
  - name: answer
    kind: function.wat
    source: |
      (module
        (func (export "answer") (result i32)
          i32.const 42
        )
      )
    wit: |
      answer: func() -> s32;
    method: answer
    pool:
      type: inline
```

For larger WAT sources, use a file reference:

```yaml
  - name: answer
    kind: function.wat
    source: file://answer.wat
    wit: |
      answer: func() -> s32;
    method: answer
    pool:
      type: inline
```

### WAT Configuration Fields

| Field | Required | Description |
|-------|----------|-------------|
| `source` | Yes | Inline WAT source or `file://` reference |
| `method` | Yes | Exported function name to call |
| `wit` | No | WIT signature for raw/core modules |
| `pool` | No | Worker pool configuration |
| `transport` | No | Input/output mapping (default: `payload`) |
| `imports` | No | Host imports to enable (e.g., `wasi:cli`, `funcs`) |
| `wasi` | No | WASI configuration (args, env, mounts) |
| `limits` | No | Execution limits |

## Precompiled WASM Functions

Load compiled `.wasm` binaries from a filesystem entry:

```yaml
entries:
  - name: assets
    kind: fs.directory
    directory: ./wasm

  - name: compute
    kind: function.wasm
    fs: myns:assets
    path: /compute.wasm
    hash: sha256:292b796376f8b4cc360acf2ea6b82d1084871c3607a079f30b446da8e5c984a4
    method: compute
    pool:
      type: lazy
      max_size: 4
```

### WASM Configuration Fields

| Field | Required | Description |
|-------|----------|-------------|
| `fs` | Yes | Filesystem entry ID containing the binary |
| `path` | Yes | Path to `.wasm` file within the filesystem |
| `hash` | Yes | SHA-256 hash for integrity verification (`sha256:...`) |
| `method` | Yes | Exported function name to call |
| `wit` | No | WIT signature for raw/core modules |
| `pool` | No | Worker pool configuration |
| `transport` | No | Input/output mapping (default: `payload`) |
| `imports` | No | Host imports to enable |
| `wasi` | No | WASI configuration |
| `limits` | No | Execution limits |

## Worker Pools

Each WASM function uses a pool of pre-compiled instances. The pool type controls concurrency and resource usage.

| Type | Description |
|------|-------------|
| `inline` | Synchronous, single-threaded. New instance per call. |
| `lazy` | Zero idle workers. Scales on demand up to `max_size`. |
| `static` | Fixed number of workers with request queue. |
| `adaptive` | Auto-scaling elastic pool. |

### Pool Configuration

```yaml
pool:
  type: static
  size: 4            # Total pool size
  workers: 2         # Worker threads
  buffer: 16         # Request queue buffer (default: workers * 64)
```

```yaml
pool:
  type: lazy
  max_size: 8        # Maximum concurrent instances
```

```yaml
pool:
  type: adaptive
  max_size: 16       # Upper scaling bound
  warm_start: true   # Pre-instantiate initial workers
```

The default elastic pool maximum is 100 workers when `max_size` is not specified.

## Transports

Transports control how input and output are mapped between the runtime and the WASM module.

| Transport | Description |
|-----------|-------------|
| `payload` | Maps runtime payloads directly to WASM call arguments (default) |
| `wasi-http` | Maps HTTP request/response context to WASM arguments and results |

### Payload Transport

The default transport passes arguments directly. Lua values are transcoded to Go types, then lowered to WIT types:

```yaml
  - name: compute
    kind: function.wasm
    fs: myns:assets
    path: /compute.wasm
    hash: sha256:...
    method: compute
    pool:
      type: inline
```

```lua
-- Arguments passed directly as WASM function parameters
local result, err = funcs.call("myns:compute", 6, 7)
-- result: 42
```

### WASI HTTP Transport

The `wasi-http` transport maps HTTP requests to WASM and writes results back to the HTTP response. Use this to expose WASM functions as HTTP endpoints:

```yaml
  - name: greet_wasm
    kind: function.wasm
    fs: myns:assets
    path: /greet.wasm
    hash: sha256:...
    method: greet
    transport: wasi-http
    pool:
      type: inline

  - name: greet_endpoint
    kind: http.endpoint
    method: POST
    path: /api/greet
    func: greet_wasm
```

## Execution Limits

Set a maximum execution time for a function:

```yaml
limits:
  max_execution_ms: 5000   # 5 second timeout
```

When the limit is exceeded, the execution is cancelled and an error is returned.

## WASI Configuration

Configure WASI capabilities for the guest module:

```yaml
wasi:
  args: ["--verbose"]
  cwd: "/app"
  env:
    - id: myns:api_key
      name: API_KEY
      required: true
    - id: myns:debug_mode
      name: DEBUG
  mounts:
    - fs: myns:data_files
      guest: /data
      read_only: true
    - fs: myns:output
      guest: /output
```

| Field | Description |
|-------|-------------|
| `args` | Command-line arguments passed to the guest |
| `cwd` | Working directory inside the guest (must be absolute) |
| `env` | Environment variables mapped from registry env entries |
| `mounts` | Filesystem mounts from registry filesystem entries |

Environment variables are resolved from the environment registry at call time. Required variables cause an error if not found.

Mount paths must be absolute and unique. Each mount maps a runtime filesystem entry to a guest directory path.

## Examples

### Data Transformation Pipeline

```yaml
entries:
  - name: wasm_binaries
    kind: fs.directory
    directory: ./wasm

  - name: transform_users
    kind: function.wasm
    fs: myns:wasm_binaries
    path: /mapper.wasm
    hash: sha256:7304fc7d19778605458ae5804dae9a7343dcd3f5fc22bcc9415e98b5047192dd
    method: transform-users
    pool:
      type: lazy
      max_size: 4

  - name: filter_active
    kind: function.wasm
    fs: myns:wasm_binaries
    path: /mapper.wasm
    hash: sha256:7304fc7d19778605458ae5804dae9a7343dcd3f5fc22bcc9415e98b5047192dd
    method: filter-active
    pool:
      type: lazy
      max_size: 4
```

```lua
local funcs = require("funcs")

local users = {
    {id = 1, name = "Alice", tags = {"admin", "dev"}, active = true},
    {id = 2, name = "Bob", tags = {"user"}, active = false},
    {id = 3, name = "Carol", tags = {"dev"}, active = true},
}

-- Transform: adds display field and tag count
local transformed, err = funcs.call("myns:transform_users", users)

-- Filter: returns only active users
local active, err = funcs.call("myns:filter_active", users)
```

### JavaScript Component

Any language that compiles to WASM Component Model works. Here is a function compiled from JavaScript:

```yaml
  - name: js_add
    kind: function.wasm
    fs: myns:wasm_binaries
    path: /js_calculator.wasm
    hash: sha256:eda7db3925a40c12b5e8c36b0d228a4be4f2c79ee8b5c86b912cf8b3d9a70a7c
    method: add
    pool:
      type: inline
```

```lua
local result, err = funcs.call("myns:js_add", 10, 20)
-- result: 30
```

### Async Sleep with WASI Clocks

WASM components that import `wasi:clocks` and `wasi:io` can use clocks and polling. The async yield mechanism integrates with the Wippy dispatcher:

```yaml
  - name: sleep_ms
    kind: function.wasm
    fs: myns:wasm_binaries
    path: /sleep_test.wasm
    hash: sha256:...
    method: "test-sleep#sleep-ms"
    imports:
      - wasi:io
      - wasi:clocks
    pool:
      type: inline
```

The `#` separator in the method field references an interface method: `test-sleep#sleep-ms` calls the `sleep-ms` function from the `test-sleep` interface.

## See Also

- [Overview](wasm/overview.md) - WebAssembly runtime overview
- [Host Functions](wasm/hosts.md) - Available host interfaces
- [Processes](wasm/processes.md) - Running WASM as processes
- [Entry Kinds](guides/entry-kinds.md) - All registry entry kinds
