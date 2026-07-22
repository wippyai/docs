---
title: "Building Components"
description: "Authoring reusable modules: declaring requirement interfaces with ns.requirement and how hosts supply values through dependency parameters."
---

# Building Components

A **component** is a reusable Wippy module — a slice of functionality published to the hub and mounted into a host application. The challenge a component faces is that it cannot name the things it depends on: it needs *a* database, *a* process host, *a* router, but it does not know which ones the host will give it. Wippy solves this with a **requirement interface** — the component declares holes, the host fills them.

This guide covers the author side: declaring that interface and understanding how values flow into your entries. For the consumer side (lock files, version constraints, `wippy add`/`update`) see [Dependency Management](guides/dependency-management.md). For how a component is structured internally see [Application Architecture](concepts/architecture.md).

## The three kinds

| Kind | Side | Role |
|------|------|------|
| `ns.definition` | component | Module metadata; required to publish. |
| `ns.requirement` | component | A hole the host must fill, and where to inject the value. |
| `ns.dependency` | host | Mounts a component and supplies values for its requirements. |

## ns.definition

One per module, required for publishing. It carries the module's display name and README path — nothing more.

```yaml
- name: definition
  kind: ns.definition
  module: jobs                # optional; defaults to the entry name
  readme: file://README.md    # path to the module's documentation
  meta:
    title: Durable Jobs
    description: Leased job queue with retry and dead-lettering.
```

Only `module` and `readme` are component data; `meta` is ordinary entry metadata for management UIs. Release notes are supplied at publish time, not here.

## ns.requirement

A requirement is a **named hole with a list of injection targets**. The host supplies a value; the runtime writes that value into each target entry at the given path.

```yaml
- name: target_db
  kind: ns.requirement
  meta:
    description: SQL database backing every table in this module.
  default: app:db
  targets:
    - entry: app.jobs.migrations:schema
      path: .meta.target_db
    - entry: app.jobs.persist:lifecycle
      path: .db
```

### default — mandatory vs optional

The `default` field decides whether the host *must* supply a value:

- **`default` present** (any value, including an empty string) → the requirement is **optional**. If the host supplies nothing, the default is used.
- **`default` absent** → the requirement is **mandatory**. With nothing supplied, linking fails under strict mode (and warns otherwise).

<note>
An explicitly empty default (<code>default: ""</code>) is distinct from no default at all. Empty-string means "optional, falls back to nothing"; absent means "the host must provide this." Use a default for infrastructure that has a sane in-app convention (<code>app:db</code>, <code>app:processes</code>); omit it for values only the host can know.
</note>

### targets — where the value lands

Each target is an `{entry, path}` pair:

- **`entry`** — the entry the value is injected into. A bare name (`schema`) resolves within the requirement's own namespace; a fully-qualified id (`app.jobs.migrations:schema`) targets that entry exactly, across namespaces.
- **`path`** — a dot path into the target entry, e.g. `.meta.target_db`, `.host`, `.database.url`. The leading dot is conventional.

A requirement with no targets is an error — a hole that injects nowhere is meaningless.

Append instead of set with the `+=` suffix on the path — useful when several requirements contribute to one list (e.g. middleware):

```yaml
targets:
  - entry: app.api:router
    path: .middleware+=     # appends the value to the list at .middleware
```

### One requirement, many targets

Group everything that needs the same value under a single requirement. This is the idiomatic pattern: a `target_db` requirement injecting into every migration's `.meta.target_db` and every persistence library's `.db`, a `process_host` injecting into each supervised `service`'s `.host`, an `api_router` injecting into each endpoint's `.meta.router`:

```yaml
- name: process_host
  kind: ns.requirement
  default: app:processes
  targets:
    - { entry: app.jobs.service:worker.service, path: .host }
    - { entry: app.jobs.service:sweeper.service, path: .host }
```

The host fills one hole; the runtime fans the value out to every target. Nothing is mirrored into a parallel config entry — the requirement entry *is* the wiring.

## Consuming a component

The host mounts a component with `ns.dependency` and fills its requirements through `parameters`:

```yaml
version: "1.0"
namespace: app
entries:
  - name: dep.jobs
    kind: ns.dependency
    component: acme/jobs
    version: "^1.0.0"
    parameters:
      - name: target_db
        value: app:db
      - name: process_host
        value: app:processes
      - name: api_router
        value: app:api
```

Each `parameter.name` matches a requirement; its `value` is what gets injected into that requirement's targets. Requirements with a default may be omitted; mandatory ones must be supplied.

### Parameter name matching

How a parameter name binds to a requirement:

- **Bare name** (`target_db`) matches a requirement of that name belonging to the component being mounted. It does not cross into a different module's requirements.
- **Qualified name** (`acme.jobs:target_db`) matches that requirement id exactly. Use this to disambiguate when wiring transitive dependencies.

If two dependencies supply **different** values for the same requirement, that is a conflict and is reported (identical values are fine).

## When values resolve

Injection happens at the **Link stage** of the build pipeline — at publish, during dependency expansion, and at boot — not at runtime. The stage:

1. Collects every `ns.requirement` and every `ns.dependency` with its parameters.
2. For each requirement, resolves a value: a matching parameter wins; otherwise the default; otherwise (no default) it is unresolved.
3. Writes the resolved value into each target entry at its path (set, or append for `+=`).

Under **strict requirements** an unresolved mandatory requirement fails the build; otherwise it logs a warning and proceeds. By the time entries reach the runtime, every filled requirement has already been baked into its targets.

## Verify the seams: a mount test

Unit tests exercise a slice in isolation; they cannot see whether the *assembled* module is coherent. Add a packaging/mount test that audits the module as a whole against the live, requirement-injected registry:

- every supervised `service` points at a process entry that exists,
- every spawned or scheduled id resolves to a real entry,
- every `env.variable`'s storage is registered.

These are the integration seams the isolated unit suites mask — the gaps that let a supervisor reference a worker that was never registered, or a test fixture leak a harness-only storage id into a mounted boot. See [Supervision](guides/supervision.md) and the [Testing](framework/testing.md) framework.

## See Also

- [Application Architecture](concepts/architecture.md) — how a component is structured internally
- [Dependency Management](guides/dependency-management.md) — lock files, versions, the consumer workflow
- [Publishing Modules](guides/publishing.md) — putting a component on the hub
- [Entry Kinds Guide](guides/entry-kinds.md) — `ns.definition`, `ns.requirement`, `ns.dependency` reference
