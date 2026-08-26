---
title: "Application Architecture"
description: "How to carve a Wippy application into namespaces, slices, and layers so the registry graph stays composable, testable, and bootable as it grows."
---

# Application Architecture

A Wippy application is a **graph of registry entries** represented by source files. Code lives in entries such as `function.lua` and `process.lua`; `_index.yaml` files declare how functions, routes, services, and libraries connect. Application structure determines how that graph is divided into namespaces so it remains composable, testable, and bootable as it grows.

This page explains one way to organize that graph. For file format, naming, and `_index.yaml` placement, see [YAML & Project Structure](start/structure.md). For entry definitions, see the [Entry Kinds Guide](guides/entry-kinds.md).

## Feature Slices

A useful default is to organize by **feature** rather than file type. A slice owns one capability end to end—its database access, long-running processes, HTTP surface, and shared vocabulary—and lives under one namespace prefix:

```
src/app/jobs/          namespace: app.jobs
src/app/auth/          namespace: app.auth
src/app/billing/       namespace: app.billing
```

Feature slices keep related behavior within one folder, making a capability easier to read, test, change, or remove without tracing it across top-level `handlers/`, `models/`, and `services/` directories.

## Layers within a slice

For larger slices, separate code by **what touches the outside world**. This applies ports-and-adapters (hexagonal) architecture through **sub-namespaces**:

```
src/app/jobs/                  namespace: app.jobs          ← shared vocabulary
  consts.lua  config.lua  types.lua
  persist/                     namespace: app.jobs.persist  ← database adapters (sql)
  service/                     namespace: app.jobs.service  ← processes, workers
  api/                         namespace: app.jobs.api      ← http.endpoints
```

Keep imports flowing from outer layers toward inner layers:

```
api  →  service  →  persist  →  { consts, config, types }
```

The slice root contains shared vocabulary and does not import its own children. Children may import the root. Avoid direct imports between slices; place shared definitions in a common parent namespace such as `app.core:types`.

<note>
Namespace boundaries provide the seams used for dependency injection and boot-order resolution. A consistent import direction keeps those relationships explicit. See <a href="#why-this-shape">Why this shape</a>.
</note>

A small slice can use one `_index.yaml` for its libraries and endpoint. The important property is the **import direction**, not the number of folders.

## Shared Vocabulary

Three files commonly appear at the root of a slice. They contain definitions shared by the slice's layers:

| File | Holds | Capabilities |
|------|-------|--------------|
| `consts.lua` | State machines, enums, queue tiers, registry IDs of processes. The values that mirror your database `CHECK` constraints. | none |
| `config.lua` | Env-tunable knobs with code-default fallbacks (`env.get(KEY) or DEFAULT`), so no `env.variable` entry is required for a value to be optional. | `env` |
| `types.lua` | Entity shapes (`type Job = { ... }`) — the rows the persistence layer returns. | none |

`consts` and `types` declare **no host capabilities**; they are pure `library.lua` entries that return a table. Keeping domain vocabulary free of I/O also makes it testable without a database or process host.

Keep this vocabulary **slice-private**. Place constants and types shared across slices in a common parent namespace and import them rather than copying them.

## Capabilities by Layer

Each entry declares the host capabilities it needs in `modules:`. A layered slice can assign them by responsibility:

- `persist/*` declares `sql`, keeping database access in the persistence layer.
- `service/*` declares `channel` and process-host capabilities, keeping spawning and supervision in the service layer.
- `api/*` declares whatever an endpoint needs to marshal a request.
- The root vocabulary declares nothing.

This limits each capability to a known layer. To review code that can write to the database, for example, inspect `persist/` and its declared modules.

## Applications and Components

The same shape can support a single application or a published library; the difference is **who supplies its dependencies**.

An **application** is the top-level, deployable graph. It owns the concrete infrastructure — the `http.service`, the `process.host`, the database connection — under a root namespace (conventionally `app`), and wires everything together itself.

A **component** is a publishable module mounted into a host. Because it does not know the host's database or router IDs, it declares an interface of `ns.requirement` entries that the host supplies. Internally, a component can use the same layers, vocabulary, and import direction as an application slice.

These are two points on a spectrum:

- **Single app, internal slices** — slices live under `src/app/`, share the app's infrastructure directly by referencing `app:db`, `app:processes`. No requirement interface is needed because nothing external mounts them.
- **Multi-component composition** — each component is its own publishable module with an `ns.definition` and an `ns.requirement` interface, composed by a host through `ns.dependency`. The host fills each requirement (database, process host, router) once.

Choose based on whether the slice will be **consumed by a host you do not control**. Reusable components need a requirement interface; internal slices can reference application infrastructure directly. The packaging changes with reuse, while the internal layering can remain the same.

See [Building Components](guides/components.md) for the requirement/dependency mechanism, and [Dependency Management](guides/dependency-management.md) for the lock-file side.

## Why Use This Shape {#why-this-shape}

This structure supports composition, capability review, and boot-order analysis:

**The namespace boundary is the injection seam.** When layers connect through explicit `imports:` and live in distinct namespaces, `ns.requirement` entries have clear injection targets. A host can supply a database to persistence entries and a process host to service entries. Directly referencing `app:db` would instead couple the component to that host.

**One-way imports keep boot order resolvable.** The runtime resolves the entry graph at boot and needs a topological order. The direction `api → service → persist → root` keeps a slice acyclic. Routing shared dependencies through a parent namespace also reduces cross-slice cycles.

**Capabilities scoped by layer have a clear boundary.** Host capabilities are granted per entry. When persistence entries alone declare `sql`, the code that can reach the database is easier to identify and audit.

**The layering supports different test scopes.** Vocabulary can be tested without infrastructure. Persistence tests can use a database without starting workers. A whole-module **mount test** then checks the integration seams: every supervised service points to a process, every spawned ID resolves, and every requirement is filled.

## See Also

- [YAML & Project Structure](start/structure.md) — file format, naming, namespaces
- [Building Components](guides/components.md) — `ns.definition`, `ns.requirement`, mounting
- [Dependency Management](guides/dependency-management.md) — lock files, consuming modules
- [Registry](concepts/registry.md) — how entries are stored and resolved
- [Entry Kinds Guide](guides/entry-kinds.md) — every entry kind
- [Process Model](concepts/process-model.md) — services, supervision, hosts
