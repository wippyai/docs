---
title: "Why Wippy Uses Lua - Embedded Runtime Language Decision"
description: "Wippy uses Lua as its primary runtime language. Here is why: memory footprint, full sandboxability, clean Go embedding, deterministic module loading, and LLM-friendly syntax."
---

# Why Wippy Uses Lua

Every technical evaluator asks this question, so here's the direct answer.

## Runtime Requirements

Wippy runs user-defined logic inside isolated processes. Each process needs its own memory space, its own set of available capabilities, and no way to reach outside its boundary unless the runtime explicitly allows it. The platform runs thousands of these processes concurrently on a single instance, each one potentially executing different code for different tenants.

This means the language runtime embedded inside each process must be:

- **Tiny.** Each process runs in its own isolated environment. At thousands of concurrent processes, memory per process matters. Wippy targets a baseline overhead of ~13 KB per process.
- **Fully sandboxable.** The runtime must control exactly which modules, functions, and system calls each process can access. No ambient authority. No global state leaking between processes.
- **Embeddable.** The language runtime must be a library that Wippy's core (written in Go) can instantiate, configure, and tear down per process. It cannot be an external process or a separate binary.
- **Deterministic in module loading.** When a process starts, the runtime decides what code it can see. No file system access. No `require` that reaches into arbitrary paths. Dependencies come from the registry, scoped per process.
- **LLM-friendly syntax.** Agents generate and modify code. The language must be simple enough that an LLM can read, write, and reason about it reliably without hallucinating syntax.

## Languages Evaluated: Python, JavaScript, Go, and WASM

### Python

The default choice for AI workloads. We ruled it out because CPython's memory footprint is 10-30 MB per interpreter, orders of magnitude larger than a Lua process. Python's import system gives code ambient access to the file system, network, and OS. Sandboxing Python requires either WASM compilation (which breaks most libraries) or heavy patching of the interpreter. Python's concurrency model (the GIL) also conflicts with our per-process isolation model. The ecosystem is a strength for standalone scripts, but a liability for a sandboxed runtime where you need deterministic control over what code can access.

### JavaScript (V8/QuickJS)

V8 is fast but enormous (tens of MB per isolate). QuickJS is small enough to embed, but JavaScript's prototype chain and dynamic module system make sandboxing harder than it looks. `import` and `require` want to reach the file system. The ecosystem expects npm, which assumes network access and a writable file system, neither of which exist inside a Wippy process. We'd spend more time fighting the language's assumptions than building the product.

### Go

Wippy's core is written in Go, so this was tempting. But Go doesn't embed. You can't instantiate a Go runtime as a library inside another Go program. Go plugins exist but they're fragile, share memory with the host process, and can't be sandboxed. Go is right for the runtime itself; it's wrong for user code.

### WASM

Genuinely strong for sandboxing, and we've built it as Wippy's second runtime (see below). But WASM alone isn't sufficient as the primary language for agent development. The developer experience for writing and debugging WASM directly is still rough, and LLMs generate WASM-targeted code less reliably than they generate Lua. WASM is the right choice when you need to run compiled code from other languages inside the Wippy sandbox. Lua is the right choice for the primary development and agent-authoring experience.

## Why Lua Meets All Five Requirements

Lua was built for exactly this use case. It is the most embedded scripting language in production, running inside World of Warcraft, Roblox, Redis, Nginx/OpenResty, Cisco and Juniper networking equipment, Adobe Lightroom, and hundreds of game engines. It has been embedded in hostile environments (games where users run untrusted code) for over 25 years.

### Memory

A Wippy Lua process has a baseline overhead of ~13 KB. At 10,000 concurrent processes, that is roughly 130 MB of baseline process overhead. In Python, the same count would require 100-300 GB. This isn't a theoretical concern; it's the difference between running on a single machine and needing a cluster.

### Sandboxing

Lua's module system is a single function (`require`) that the host controls completely. Replace it with a custom loader that resolves only what the process is granted, and the process sees only what you allow. There is no `import os`, no `subprocess`, no ambient file system access; those functions are not present in a process's environment. The sandbox is the default state, not a patch on top of an open system.

### Embedding

Lua's interface is famously small. The canonical C API is around 60 functions, and pure-Go implementations make embedding it in Wippy's Go core straightforward, with no cgo. Creating and tearing down a process's Lua environment is cheap; Wippy does it on every process start with no measurable overhead.

### Deterministic module control

In Wippy, the code a process can load is determined by its registry scope. The Lua loader resolves modules from the registry, not the file system. If a process is not granted a module, that module does not exist from the process's perspective. This is how multi-tenant isolation works at the code level: different tenants can have different modules available, enforced by the runtime, not by application logic.

### LLM-friendly

Lua's syntax is minimal: no classes, no decorators, no type annotations baked into the language, no async/await, no complex module resolution. An LLM that has seen Lua can generate correct Lua on the first try far more reliably than it can generate correct Python (with its decorator patterns, context managers, and type system) or JavaScript (with its prototype chain, `this` binding, and module flavors). For a platform where agents write and modify their own tools, this matters. Wippy extends Lua with a type annotation system (generics, unions, channel types) and a built-in linter, so you get type safety without the syntax complexity.

### Coroutines

Lua has native coroutine support, which maps directly to Wippy's concurrent process model. Each process runs in a coroutine that yields to the scheduler. No threads. No locks. No race conditions between processes. Thousands of concurrent processes cooperate without the complexity of thread-based concurrency.

## What You Lose

Lua's ecosystem is small. There is no equivalent of pip or npm with tens of thousands of packages. This is intentional: in Wippy, dependencies are registry entries with declared capabilities and security policies, not arbitrary packages pulled from the internet. But it means you can't `pip install pandas` inside a Wippy process. Data processing that requires heavy library support (ML model inference, complex numerical computation) should either run as external services that Wippy agents call via tools, or run as WASM functions inside the Wippy sandbox.

Lua is also unfamiliar to most developers. The learning curve is real, though short; Lua's entire language reference is about 30 pages. Most developers who know any programming language can write Lua within a day. The unfamiliarity is a friction cost, but the architectural benefits (sandboxing, memory, embedding) outweigh it for a runtime platform where most user code is short, tool-oriented, and increasingly AI-generated.

## Lua + WASM: The Full Picture

Wippy is not a Lua-only platform. It ships two runtimes:

**Lua** is the primary runtime for agent development, tool authoring, and application logic. It's where most Wippy code is written and where agents generate code. The small footprint, full sandboxability, and LLM-friendly syntax make it the right default.

**WASM** is the secondary runtime for compiled workloads. If you have existing code in Rust, Go, C, or any language that compiles to WebAssembly, you can run it inside Wippy with the same process isolation and registry integration as Lua. WASM functions and processes integrate with WASI for clocks, I/O, filesystem (via mounted Wippy filesystem entries), and environment access. This means you can bring existing business logic into the Wippy sandbox without rewriting it in Lua.

The two runtimes share the same process model, the same registry, and the same security policies. A Lua agent can call a WASM function. A WASM process can call Lua functions through the registry. They are peers in the same system.

## See Also

- [Lua Runtime Overview](lua/overview.md) - The Lua runtime and its modules
- [Types](lua/types.md) - Type annotations, generics, and unions
- [Linter](guides/linter.md) - Static analysis for Lua
- [WASM Runtime](wasm/overview.md) - Running compiled code in the sandbox
