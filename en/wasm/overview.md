---
title: "WebAssembly Runtime"
description: "Run WAT and WASM functions or WASM processes alongside Lua through registry entries."
---

# WebAssembly Runtime

> The WASM runtime is an experimental extension. Configuration is stable, but runtime internals may change between releases.

Wippy registers WebAssembly modules alongside Lua code. Function entries join the function registry and run through function pools; process entries register process factories and run under process hosts. Both use the runtime scheduler and security model.

**Classification: conceptual overview.** The Lua block contains independent call
patterns and assumes the named WASM entries and their WIT contracts are already
registered. See the Rust/WASM tutorial for a project with a compiled component.

## Entry Kinds

| Kind | Description |
|------|-------------|
| `function.wat` | Inline WebAssembly Text format function defined in YAML |
| `function.wasm` | Precompiled WASM binary loaded from a filesystem entry |
| `process.wasm` | WASM binary executed as a process (CLI commands or long-running) |

## How It Works

1. WASM modules are declared as registry entries in `_index.yaml`
2. At boot, `function.wat` and `function.wasm` entries are compiled, registered as functions, and placed into their configured function pools
3. Lua calls those function entries through `funcs.call()`
4. `process.wasm` entries instead register process factories and are spawned under a process host
5. Function arguments and return values are mapped between Lua tables and WIT types
6. Supported dispatcher-bridged operations, including clock polling and outgoing HTTP, yield so the scheduler can run other work

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
if err then return nil, err end

-- With arguments
local computed, compute_err = funcs.call("myns:compute", 6, 7)
if compute_err then return nil, compute_err end

-- With complex data
local users = {
    {id = 1, name = "Alice", tags = {"admin"}, active = true},
    {id = 2, name = "Bob", tags = {"user"}, active = false},
}
local transformed, err = funcs.call("myns:transform_users", users)
if err then return nil, err end
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
- [Rust/WASM Tutorial](../tutorials/rust-wasm.md) - Build and register a component
