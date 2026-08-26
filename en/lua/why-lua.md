---
title: "Why Wippy Uses Lua"
description: "The runtime constraints, tradeoffs, and complementary roles of Lua and WebAssembly in Wippy."
---

# Why Wippy Uses Lua

Wippy uses Lua as its primary runtime language because it fits the platform's process-isolation and embedding requirements. This page explains that design choice and its tradeoffs; it is not a general ranking of programming languages.

## Runtime Requirements

Wippy runs user-defined logic in isolated processes. Each process has its own memory and receives only the capabilities exposed by the runtime. Because many processes can run concurrently, the embedded language must support:

- **Low per-process overhead.** Memory use must remain practical as process counts grow.
- **Capability isolation.** The runtime must control the modules, functions, and system operations available to each process.
- **In-process embedding.** Wippy's Go core must be able to create, configure, and stop a language environment for each process.
- **Controlled module loading.** Dependencies must resolve through the registry rather than arbitrary file-system paths.
- **A small language surface.** Application code should remain readable and straightforward to generate, review, and lint.

## Alternatives Considered

### Python

Python offers a large application and data ecosystem, but its interpreter, import model, and package assumptions do not match Wippy's per-process embedding and capability model. Python services can still integrate with Wippy over explicit service boundaries.

### JavaScript

JavaScript runtimes offer several embedding options. Their module and package ecosystems, however, require a separate integration layer to provide the registry-scoped loading model Wippy uses. Wippy chose Lua's smaller host-controlled runtime surface for application code.

### Go

Go is used for Wippy's core runtime. Compiled Go code and plugins do not provide the same isolated, per-process embedded environment required for user-defined application logic.

### WebAssembly

WebAssembly is Wippy's second runtime and is intended for compiled workloads. It complements Lua when an application needs code produced by Rust, Go, C, or another language that targets WebAssembly. Lua remains the primary authoring language for application logic.

## Why Lua Fits

### Resource Use

Wippy documents a baseline overhead of approximately 13 KB for a Lua process. Low per-process overhead is important when many isolated processes run concurrently.

### Capability Boundaries

Wippy controls Lua's global environment and module loader. `require` resolves only modules granted to the process through its registry configuration. File-system, network, and operating-system access are available only through modules that the process is allowed to load.

### Embedding

Lua is designed to run inside a host application. Wippy can create a Lua environment for each process and connect it directly to the scheduler, registry, and runtime modules.

### Module Resolution

The runtime resolves modules from the registry rather than arbitrary paths. Processes with different registry scopes can therefore receive different module sets without application-level loading rules.

### Language Surface

Lua has a compact syntax and a small standard environment. Wippy adds type annotations and linting so code can be checked incrementally without changing the underlying execution model.

### Coroutines

Lua coroutines map to Wippy's cooperative scheduling model. A process can yield during channel or I/O operations while the scheduler runs other work.

## Tradeoffs

Lua does not provide an in-process package ecosystem comparable to pip or npm. Dependencies inside Wippy are registry entries with declared capabilities rather than packages installed from the network. Workloads that depend on large external libraries can run as services or as WebAssembly components.

Lua may also be unfamiliar to developers coming from other languages. The syntax is compact, but teams still need conventions, review, and linting for production code.

## Lua and WebAssembly

Wippy provides two complementary runtimes:

- **Lua** is the primary runtime for application logic, tools, and agents.
- **WebAssembly** runs compiled workloads and existing code that can target WASM.

Both runtimes use Wippy's process model, registry, and security policies. Lua code can call registered WASM functions, and WASM processes can call registered Lua functions.

## See Also

- [Lua Runtime Overview](lua/overview.md) - The Lua runtime and its modules
- [Types](lua/types.md) - Type annotations, generics, and unions
- [Linter](guides/linter.md) - Static analysis for Lua
- [WASM Runtime](wasm/overview.md) - Running compiled code in the sandbox
