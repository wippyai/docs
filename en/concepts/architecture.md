---
title: "Application Architecture"
description: "How to carve a Wippy application into namespaces, slices, and layers so the registry graph stays composable, testable, and bootable as it grows."
---

# Application Architecture

A Wippy application is not a tree of source files — it is a **graph of registry entries**. Code lives in `function.lua` and `process.lua` entries; everything that links them — which function answers an HTTP route, which process a service supervises, which library imports which — is declared in `_index.yaml`. Structuring an app means deciding how to **carve that graph into namespaces** so it stays composable, testable, and bootable as it grows.

This page is the reasoning behind the layout. For the mechanical rules (file format, naming, where `_index.yaml` goes) see [YAML & Project Structure](start/structure.md). For the entry kinds themselves see the [Entry Kinds Guide](guides/entry-kinds.md).

## The unit is a slice

Organize by **feature**, not by file type. A slice owns one capability end to end — its database access, its long-running processes, its HTTP surface, and the vocabulary they share — and lives under one namespace prefix:

```
src/app/jobs/          namespace: app.jobs
src/app/auth/          namespace: app.auth
src/app/billing/       namespace: app.billing
```

The alternative — a top-level `handlers/`, `models/`, `services/` split — scatters every feature across the tree and couples them through proximity. Slices keep a feature's blast radius inside one folder: you can read it, test it, or delete it without chasing references across the project.

## Layers within a slice

Inside a slice, split along the axis of **what touches the outside world**. This is ports-and-adapters (hexagonal) architecture, expressed as **sub-namespaces**:

```
src/app/jobs/                  namespace: app.jobs          ← shared vocabulary
  consts.lua  config.lua  types.lua
  persist/                     namespace: app.jobs.persist  ← database adapters (sql)
  service/                     namespace: app.jobs.service  ← processes, workers
  api/                         namespace: app.jobs.api      ← http.endpoints
```

Imports flow **one way only**, outermost to innermost:

```
api  →  service  →  persist  →  { consts, config, types }
```

The slice root (the shared vocabulary) imports nothing from its own children. Children import the root. No layer reaches back up, and **no slice imports another slice directly** — cross-slice sharing goes through a common parent namespace (e.g. `app.core:types`), never sideways.

<note>
The namespace boundary is not cosmetic. It is the seam the runtime injects dependencies into and resolves boot order across. The direction of imports is what guarantees a valid boot order exists — see <a href="#why-this-shape">Why this shape</a>.
</note>

A smaller slice collapses the ceremony — a single `_index.yaml` with the libraries and one endpoint is fine. The rule that survives at every size is the **import direction**, not the folder count.

## The shared vocabulary

Three files recur at the root of a well-structured slice. They hold what every layer reads but none of them *is*:

| File | Holds | Capabilities |
|------|-------|--------------|
| `consts.lua` | State machines, enums, queue tiers, registry IDs of processes. The values that mirror your database `CHECK` constraints. | none |
| `config.lua` | Env-tunable knobs with code-default fallbacks (`env.get(KEY) or DEFAULT`), so no `env.variable` entry is required for a value to be optional. | `env` |
| `types.lua` | Entity shapes (`type Job = { ... }`) — the rows the persistence layer returns. | none |

`consts` and `types` declare **no host capabilities** — they are pure `library.lua` returning a table. That is deliberate: your domain vocabulary cannot perform I/O, so it cannot drift into business logic, and it is unit-testable with no database and no process host.

Keep this vocabulary **slice-private**. Constants and types shared across slices live in the common parent and are referenced through an import there — never copied into each slice.

## Capabilities sort by layer

Each entry declares the host capabilities it needs in `modules:`. In a layered slice these sort cleanly:

- `persist/*` declares `sql` — and nothing else gets database access.
- `service/*` declares `channel`, process host capabilities — and nothing else spawns or supervises.
- `api/*` declares whatever an endpoint needs to marshal a request.
- The root vocabulary declares nothing.

The payoff is that any capability's blast radius is exactly one layer. If you want to know everything that can write to the database, you read `persist/`. Dependency inversion stops being an abstract principle and becomes a property you can grep for.

## Applications and components

The same shape scales from a single app to a published library by changing only **who fills the holes**.

An **application** is the top-level, deployable graph. It owns the concrete infrastructure — the `http.service`, the `process.host`, the database connection — under a root namespace (conventionally `app`), and wires everything together itself.

A **component** is a publishable module mounted *into* a host. It cannot name the host's database or router, because it does not know them. Instead it declares an **interface of holes** — `ns.requirement` entries — that the host fills when it depends on the component. Internally a component is structured exactly like an application slice: same layers, same vocabulary, same import direction. The only addition is the requirement interface at its edge.

This is a spectrum, not two categories:

- **Single app, internal slices** — slices live under `src/app/`, share the app's infrastructure directly by referencing `app:db`, `app:processes`. No requirement interface needed; nothing external mounts them. (This is how a focused service is built.)
- **Multi-component composition** — each component is its own publishable module with an `ns.definition` and an `ns.requirement` interface, composed by a host through `ns.dependency`. The host fills each requirement (database, process host, router) once. (This is how a platform of reusable parts is built.)

Choose by whether the slice is meant to be **consumed by something you don't control**. If yes, give it a requirement interface and publish it. If no, let it reference the app's infrastructure directly and skip the ceremony. The layering is the invariant at both ends; the packaging is what scales with reuse.

See [Building Components](guides/components.md) for the requirement/dependency mechanism, and [Dependency Management](guides/dependency-management.md) for the lock-file side.

## Why this shape {#why-this-shape}

The discipline above is not style. Each rule is load-bearing for how the runtime composes and boots a graph:

**The namespace boundary is the injection seam.** Because layers link only through explicit `imports:` and live in distinct namespaces, the `ns.requirement` mechanism has a concrete target to inject into — the host points its database at the `persist` layer's entries, its process host at the `service` layer's entries. If `persist` grabbed `app:db` directly, the component could never be mounted into a different host: there would be no hole to fill. Layering is what makes a component **relocatable**.

**One-way imports guarantee a boot order exists.** The runtime resolves the entry graph at boot and must find a topological order. `api → service → persist → root`, never sideways and never up, means the graph is acyclic by construction. Cross-slice coupling routed through a shared parent keeps slices independently mountable instead of knotting them into a cycle the loader cannot order.

**Capabilities scoped by layer bound the blast radius.** Host capabilities are granted per entry. When only `persist` declares `sql`, the set of code that can reach the database is one directory, auditable at a glance — not an emergent property of the whole app.

**The layering produces a testability gradient.** Pure vocabulary tests with no world. `persist` tests hit a database but not a worker. A whole-module **mount test** then audits the seams the unit tests deliberately cannot see — that every supervised service points at a real process, every spawned ID resolves, every requirement is filled. You only get that gradient if the layers are actually separable.

The short version: hexagonal layering here is the one shape where requirement injection, per-layer capability scoping, and acyclic boot resolution all hold at once. The runtime's composition model *requires* the ports-and-adapters split to function — the discipline is what buys you a graph that boots and a component someone else can mount.

## See Also

- [YAML & Project Structure](start/structure.md) — file format, naming, namespaces
- [Building Components](guides/components.md) — `ns.definition`, `ns.requirement`, mounting
- [Dependency Management](guides/dependency-management.md) — lock files, consuming modules
- [Registry](concepts/registry.md) — how entries are stored and resolved
- [Entry Kinds Guide](guides/entry-kinds.md) — every entry kind
- [Process Model](concepts/process-model.md) — services, supervision, hosts
