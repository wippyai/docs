# Host Functions

WASM modules access runtime capabilities through host function imports. Each import is declared explicitly per entry in the `imports` list.

## Import Types

| Import | Description |
|--------|-------------|
| `funcs` | Call other Wippy functions (Lua or WASM) from within a WASM module |
| `wasi:cli` | Environment, exit, stdin/stdout/stderr, terminal |
| `wasi:io` | Streams, error handling, polling |
| `wasi:clocks` | Wall clock and monotonic clock |
| `wasi:filesystem` | File system access through mounted directories |
| `wasi:random` | Cryptographically secure random numbers |
| `wasi:sockets` | TCP/UDP networking and DNS resolution |
| `wasi:http` | Outgoing HTTP client requests |

Enable imports in your entry configuration:

```yaml
  - name: my_function
    kind: function.wasm
    fs: myns:assets
    path: /module.wasm
    hash: sha256:...
    method: run
    imports:
      - wasi:cli
      - wasi:io
      - wasi:clocks
      - wasi:filesystem
      - funcs
    pool:
      type: inline
```

Only declare the imports your module actually needs.

## Wippy Functions Host

**Namespace:** `wippy:runtime/funcs@0.1.0`

Enables WASM modules to call any function in the Wippy registry, including Lua functions and other WASM functions.

### Interface

```wit
interface funcs {
    call-string: func(target: string, input: string) -> result<string, string>;
    call-bytes: func(target: string, input: list<u8>) -> result<list<u8>, string>;
}
```

| Function | Description |
|----------|-------------|
| `call-string` | Call a function with string input and output |
| `call-bytes` | Call a function with binary input and output |

The `target` parameter uses the registry ID format: `namespace:entry_name`.

### Example

A WASM component that calls a Lua function:

```yaml
  - name: orchestrator
    kind: function.wasm
    fs: myns:assets
    path: /orchestrator.wasm
    hash: sha256:...
    method: run
    imports:
      - funcs
    pool:
      type: lazy
      max_size: 4
```

## WASI Imports

Each `wasi:*` import enables a group of related WASI Preview 2 interfaces.

### wasi:clocks

**Interfaces:** `wasi:clocks/wall-clock`, `wasi:clocks/monotonic-clock`

Wall clock and monotonic clock for time operations. Monotonic clock integrates with the Wippy dispatcher for async sleep.

### wasi:io

**Interfaces:** `wasi:io/error`, `wasi:io/streams`, `wasi:io/poll`

Stream read/write operations and async polling. The poll interface enables cooperative yielding through the dispatcher.

### wasi:cli

**Interfaces:** `wasi:cli/environment`, `wasi:cli/exit`, `wasi:cli/stdin`, `wasi:cli/stdout`, `wasi:cli/stderr`

Access to environment variables, process exit codes, and standard I/O streams. Environment variables are mapped from the Wippy environment registry through WASI configuration.

### wasi:filesystem

**Interfaces:** `wasi:filesystem/types`, `wasi:filesystem/preopens`

File system access through mounted directories. Mounts are configured per-entry and map Wippy filesystem entries to guest paths.

```yaml
wasi:
  mounts:
    - fs: myns:data
      guest: /data
      read_only: true
```

### wasi:random

**Interfaces:** `wasi:random/random`, `wasi:random/insecure`, `wasi:random/insecure-seed`

Cryptographically secure and insecure random number generation.

### wasi:sockets

**Interfaces:** `wasi:sockets/network`, `wasi:sockets/instance-network`, `wasi:sockets/ip-name-lookup`, `wasi:sockets/tcp`, `wasi:sockets/tcp-create-socket`, `wasi:sockets/udp`

TCP and UDP networking with DNS resolution. Socket operations integrate with the dispatcher for async I/O.

### wasi:http

**Interfaces:** `wasi:http/types`, `wasi:http/outgoing-handler`

Outgoing HTTP client requests from within WASM modules. Supports request/response types defined by the WASI HTTP specification.

## See Also

- [Overview](wasm/overview.md) - WebAssembly runtime overview
- [Functions](wasm/functions.md) - WASM function configuration
- [Processes](wasm/processes.md) - Running WASM as processes
