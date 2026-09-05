---
title: "Host Functions"
description: "WASM modules access runtime capabilities through host function imports. Each import is declared explicitly per entry in the imports list."
---

# Host Functions

WASM modules access runtime capabilities through host function imports. Each import is declared explicitly per entry in the `imports` list.

## Import Types

| Import | Namespace | Module kind | Description |
|--------|-----------|-------------|-------------|
| `wasi:cli` | `wasi:cli/*` | component | Environment, exit, stdin/stdout/stderr, terminal |
| `wasi:io` | `wasi:io/error`, `wasi:io/streams` | component | Streams and error handling |
| `wasi:poll` | `wasi:io/poll` | component | Async polling / cooperative yielding |
| `wasi:clocks` | `wasi:clocks/*` | component | Wall clock and monotonic clock |
| `wasi:filesystem` | `wasi:filesystem/*` | component | File system access through mounted directories |
| `wasi:random` | `wasi:random/*` | component | Cryptographically secure and insecure random numbers |
| `wasi:sockets` | `wasi:sockets/*` | component | TCP/UDP networking and DNS resolution |
| `wasi:http` | `wasi:http/*` | component | Outgoing HTTP client requests |
| `funcs` | `wippy:runtime/funcs@0.1.0` | component | Calling registry functions from the guest |
| `wasi1` | `wasi_snapshot_preview1` | core | WASI Preview 1 compatibility imports |
| `socket` | `wippy:runtime/socket@0.1.0` | core | Instance-owned outbound TCP through integer-only imports |

The eight `wasi:*` profiles and `funcs` are component-only: declaring one on a core module fails the entry. `wasi1` and `socket` expose core imports.

Each profile resolves under its short name, under any of the interface namespaces it provides, and under a versioned namespace. The version suffix is stripped before lookup, so `wasi:io/poll`, `wasi:io/poll@0.2.3` and `wasi:poll` all select the same profile.

An import that resolves to no profile fails the entry with `unsupported wasm host import: <id>`; a component-only profile on a core module fails with `wasm host import requires component module: <id>`.

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

TCP and UDP networking with DNS resolution. Socket operations suspend the guest and run through the dispatcher, which performs every dial, bind and lookup on the [network service](system/network.md).

### wasi:http

**Interfaces:** `wasi:http/types`, `wasi:http/outgoing-handler`

Outgoing HTTP client requests from within WASM modules. Supports request/response types defined by the WASI HTTP specification.

## funcs

**Namespace:** `wippy:runtime/funcs@0.1.0`

Calls registry functions from a component guest. Two entry points are exposed:

```wit
interface funcs {
  call-string: func(target: string, input: string) -> result<string, string>;
  call-bytes: func(target: string, input: list<u8>) -> result<list<u8>, string>;
}
```

`target` is a registry ID in `namespace:name` form. Every call is policy-checked as `funcs.call` against that target, so a guest can only reach functions the caller's scope already permits.

## wasi1

**Namespace:** `wasi_snapshot_preview1`

Declares that a core module links against WASI Preview 1. The profile also resolves under `preview1` and `wasi-preview1`. It registers no hosts of its own; Preview 1 imports are satisfied by the underlying WASM runtime.

## socket

**Namespace:** `wippy:runtime/socket@0.1.0`

Outbound TCP for core (non-component) modules. The host exports four integer-only functions, so a guest needs no component tooling to use it:

| Function | Signature | Result |
|----------|-----------|--------|
| `connect` | `(host_ptr: i32, host_len: i32, port: i32, timeout_ms: i32) -> i64` | `status << 32 \| handle` |
| `send` | `(handle: i32, buf_ptr: i32, buf_len: i32) -> i64` | `status << 32 \| written` |
| `recv` | `(handle: i32, out_ptr: i32, out_cap: i32) -> i64` | `status << 32 \| read` |
| `close` | `(handle: i32) -> i32` | `status` |

The high 32 bits of the 64-bit result carry the status; the low 32 bits carry the value.

| Status | Value | Meaning |
|--------|-------|---------|
| `OK` | 0 | Operation succeeded |
| `Invalid` | 1 | Bad arguments or an out-of-range memory region |
| `Denied` | 2 | The network service denied the dial |
| `Failed` | 3 | The operation failed |
| `UnknownHandle` | 4 | The handle is not an open connection of this instance |
| `Limit` | 5 | `max_open_sockets` reached |
| `Timeout` | 6 | The dial or the read/write deadline expired |

`connect` reads the host name from guest memory; `host_len` must be between 1 and 253 bytes and `port` between 1 and 65535. `timeout_ms` narrows the dial deadline: the effective deadline is the smaller of `timeout_ms` and the entry's `socket_timeout_ms`. `send` and `recv` are bounded by `socket_timeout_ms`. `recv` reports a clean end of stream as `OK` with a read count of 0.

Connections are owned by the instance that opened them. A handle is meaningless to another instance, the open-socket count is counted per instance, and every connection is closed when the instance is closed or the warm worker is recycled.

## Network Authorization

Neither socket host decides access itself. Every dial, bind and lookup goes through the runtime network service, which checks the `socket.connect`, `socket.listen` and `socket.resolve` permissions, applies the private-IP policy, and routes through an [overlay network](system/network.md) when one is selected. `wasi:sockets` additionally pre-checks `socket.resolve` before a DNS lookup and `socket.listen` before a UDP bind.

## See Also

- [Overview](wasm/overview.md) - WebAssembly runtime overview
- [Functions](wasm/functions.md) - WASM function configuration
- [Processes](wasm/processes.md) - Running WASM as processes
- [Network Overlays](system/network.md) - Overlay selection and socket permissions
