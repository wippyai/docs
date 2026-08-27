---
title: "WebAssembly Runtime"
description: "Run WAT and WASM functions or WASM processes alongside Lua through registry entries."
---

# WebAssembly Runtime

> The WASM runtime is an experimental extension. Configuration is stable, but runtime internals may change between releases.

Wippy registers WebAssembly modules alongside Lua code. WASM functions and processes use the same scheduler and security model and interoperate with Lua through the function registry.

## Entry Kinds

| Kind | Description |
|------|-------------|
| `function.wat` | Inline WebAssembly Text format function defined in YAML |
| `function.wasm` | Precompiled WASM binary loaded from a filesystem entry |
| `process.wasm` | WASM binary executed as a process (CLI commands or long-running) |

## How It Works

1. WASM modules are declared as registry entries in `_index.yaml`
2. At boot, modules are compiled and placed into worker pools
3. Lua (or other WASM) code calls them via `funcs.call()`
4. Arguments and return values are automatically mapped between Lua tables and WIT types
5. Async operations (I/O, sleep, HTTP) yield through the dispatcher, same as Lua

## Component Model

Wippy supports the WebAssembly Component Model with WIT (WebAssembly Interface Types). Component modules map these types between the host and guest:

- Records map to Lua tables with named fields
- Lists map to Lua arrays
- Results map to `(value, error)` return tuples
- Primitives (`s32`, `f64`, `string`, etc.) map directly

Raw/core WASM modules are also supported with explicit WIT signatures.

## Calling WASM from Lua

Call a WASM function by its registry ID through `funcs.call()`:

```lua
local funcs = require("funcs")

-- No arguments
local result, err = funcs.call("myns:answer_wat")

-- With arguments
local result, err = funcs.call("myns:compute", 6, 7)

-- With complex data
local users = {
    {id = 1, name = "Alice", tags = {"admin"}, active = true},
    {id = 2, name = "Bob", tags = {"user"}, active = false},
}
local transformed, err = funcs.call("myns:transform_users", users)
```

## Security

WASM executions inherit the caller's security context by default:

- Actor identity is inherited
- Scope is inherited
- Request context is inherited

Host capabilities are opt-in through explicit imports. Each entry declares the host profiles it needs, such as `funcs`, `wasi1`, `wasi:cli`, or `wasi:filesystem`, limiting the module's access surface. Enabling a profile does not bypass runtime security checks on operations such as function calls, sockets, or outgoing HTTP.

## See Also

- [Functions](wasm/functions.md) - WASM function entry configuration
- [Host Functions](wasm/hosts.md) - Available WASI and Wippy host interfaces
- [Processes](wasm/processes.md) - Running WASM as long-lived processes
