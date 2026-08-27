---
title: "Registry"
description: "How Wippy stores typed entries, initializes runtime resources, and propagates configuration changes."
---

# Registry

The registry is Wippy's versioned store for entry points, services, resources, and other runtime definitions. Most runtime entry kinds are reconciled through event-bus transactions; internal kinds such as `registry.entry` and namespace metadata bypass event dispatch by default.

## Entries

The registry holds **entries**—typed definitions with unique IDs:

```
app.api:get_user          → HTTP handler
app.workers:email_sender  → Background process
app:database              → Database connection
app:templates             → Template set
```

Each entry has an `ID` (namespace:name format), a `kind` that determines its handler, arbitrary `meta` fields, and kind-specific `data`.

Registry IDs are also used as resources by many authorization checks. The registry stores the definitions; the security scope decides whether guarded operations may access them. See the [Security Model](./security-model.md).

## Kind Handlers

When a dispatched entry is submitted, its `kind` selects the registered handler. The handler validates and reconciles the corresponding runtime resource: an `http.service` entry manages an HTTP server, a `function.lua` entry manages a function pool, and a `db.sql.postgres` entry manages a connection pool. See the [Entry Kinds Guide](../guides/entry-kinds.md) for available kinds and [Custom Entry Kinds](../internals/kinds.md) for handler implementation.

## Live Updates

Entries can be added, updated, or removed while the system runs. For dispatched kinds, a registry transaction asks participating handlers to accept or reject each operation before commit. A rejection discards the transaction and applies the inverse transition. Related topology changes produce one new registry version.

Version history supports backward and forward transitions when history is enabled. Memory history is the default and lasts for the process lifetime; SQLite and PostgreSQL backends persist history across restarts.

YAML and JSON definition files are source manifests that the boot loader converts into entries. They are not serialized registry snapshots. See [Registry module](../lua/core/registry.md) for programmatic access.

## See Also

- [YAML & Project Structure](../start/structure.md) — Definition files
- [Custom Entry Kinds](../internals/kinds.md) — Implement kind handlers
- [Process Model](./process-model.md) — Understand process execution
