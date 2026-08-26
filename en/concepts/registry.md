---
title: "Registry"
description: "How Wippy stores typed entries, initializes runtime resources, and propagates configuration changes."
---

# Registry

The registry is Wippy's central configuration store for entry points, services, resources, and other runtime definitions. Registry changes propagate through the system as events.

## Entries

The registry holds **entries**—typed definitions with unique IDs:

```
app.api:get_user          → HTTP handler
app.workers:email_sender  → Background process
app:database              → Database connection
app:templates             → Template set
```

Each entry has an `ID` (namespace:name format), a `kind` that determines its handler, arbitrary `meta` fields, and kind-specific `data`.

For how the registry functions as an authorization layer, see the [Security Model](concepts/security-model.md).

## Kind Handlers

When an entry is submitted, its `kind` selects the handler that processes it. The handler validates the configuration and creates the corresponding runtime resource: an `http.service` entry starts an HTTP server, a `function.lua` entry creates a function pool, and a `db.sql.postgres` entry establishes a connection pool. See the [Entry Kinds Guide](guides/entry-kinds.md) for available kinds and [Custom Entry Kinds](internals/kinds.md) for handler implementation.

## Live Updates

Entries can be added, updated, or removed while the system runs. Changes flow through the event bus, where listeners can validate or reject them. Transactions apply related changes atomically, and version history supports rollback.

YAML definition files are serialized registry snapshots loaded at startup. See [Registry module](lua/core/registry.md) for programmatic access.

## See Also

- [YAML & Project Structure](start/structure.md) — Definition files
- [Custom Entry Kinds](internals/kinds.md) — Implement kind handlers
- [Process Model](concepts/process-model.md) — Understand process execution
