---
title: "Host Functions"
description: "Enable Wippy function calls, WASI Preview 1 compatibility, or selected WASI Preview 2 interfaces through entry imports."
---

# Host Functions

Each entry opts into the host interfaces listed below through its `imports` field.

**Classification: host-interface reference.** The YAML block is a partial entry:
replace the filesystem ID, path, method, and hash with values from a compiled
module. The digest must be the module's actual SHA-256 value.

## Import Types

| Import | Description |
|--------|-------------|
| `funcs` | Call Wippy registry functions from a Component Model module |
| `wasi1` | WASI Preview 1 compatibility for raw/core modules |
| `wasi:cli` | Environment, exit, stdin/stdout/stderr, terminal |
| `wasi:io` | Streams and error handling |
| `wasi:poll` | Async polling / cooperative yielding (interface `wasi:io/poll`) |
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
    pool:
      type: inline
```

Only declare the imports your module actually needs.

`funcs` and the `wasi:*` profiles below require a Component Model module. Use `wasi1` for a raw/core module that imports `wasi_snapshot_preview1`; the aliases `wasi-preview1`, `preview1`, and `wasi_snapshot_preview1` resolve to the same profile. Unsupported imports, or Component Model-only profiles on a core module, fail during module preparation.

## Wippy Function Calls

The `funcs` profile registers the `wippy:runtime/funcs@0.1.0` interface for Component Model modules:

```wit
interface funcs {
  call-string: func(target: string, input: string) -> result<string, string>;
  call-bytes: func(target: string, input: list<u8>) -> result<list<u8>, string>;
}
```

Both methods invoke the target through Wippy's function registry. The call inherits the execution security context and requires `funcs.call` permission on the target registry ID.

## WASI Imports

Each `wasi:*` import enables a group of related WASI Preview 2 interfaces.

### wasi:clocks

**Interfaces:** `wasi:clocks/wall-clock`, `wasi:clocks/monotonic-clock`

Wall clock and monotonic clock for time operations. Monotonic clock integrates with the Wippy dispatcher for async sleep.

### wasi:io

**Interfaces:** `wasi:io/error`, `wasi:io/streams`

Stream read/write operations and error handling. The `wasi:io/poll` interface is provided separately by the `wasi:poll` import.

### wasi:poll

**Interfaces:** `wasi:io/poll`

Async polling. The poll interface enables cooperative yielding through the dispatcher.

### wasi:cli

**Interfaces:** `wasi:cli/environment`, `wasi:cli/exit`, `wasi:cli/stdin`, `wasi:cli/stdout`, `wasi:cli/stderr`, `wasi:cli/terminal-stdin`, `wasi:cli/terminal-stdout`, `wasi:cli/terminal-stderr`

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

**Interfaces:** `wasi:sockets/instance-network`, `wasi:sockets/ip-name-lookup`, `wasi:sockets/tcp`, `wasi:sockets/tcp-create-socket`, `wasi:sockets/udp`, `wasi:sockets/udp-create-socket`

TCP and UDP networking with DNS resolution. Socket operations integrate with the dispatcher for async I/O.

### wasi:http

**Interfaces:** `wasi:http/types`, `wasi:http/outgoing-handler`

Outgoing HTTP client requests from within WASM modules. Supports request/response types defined by the WASI HTTP specification.

Outgoing requests require `http_client.request` permission on the URL. Requests to private IP addresses also require `http_client.private_ip` for the resolved address.

## Socket Permissions

Enabling `wasi:sockets` makes the interfaces available but does not authorize network access. DNS lookup requires `socket.resolve` on the name, outbound TCP connections require `socket.connect` on the address, and TCP or UDP binding requires `socket.listen` on the address.

## See Also

- [Overview](wasm/overview.md) - WebAssembly runtime overview
- [Functions](wasm/functions.md) - WASM function configuration
- [Processes](wasm/processes.md) - Running WASM as processes
