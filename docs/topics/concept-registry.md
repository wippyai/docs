# Registry

The registry is Wippy's central configuration store. All definitions—entry points, services, resources—live here, and changes propagate reactively through the system.

## Entries

The registry holds **entries**—typed definitions with unique IDs:

```
app.api:get_user          → HTTP handler
app.workers:email_sender  → Background process
app:database              → Database connection
app:templates             → Template set
```

Each entry has an `ID` (namespace:name format), a `kind` that determines its handler, arbitrary `meta` fields, and kind-specific `data`.

## Kind Handlers

When an entry is submitted, its `kind` determines which handler processes it. The handler validates the configuration and creates runtime resources—an `http.service` entry starts an HTTP server, a `function.lua` entry creates a function pool, a `sql.database` entry establishes a connection pool. See [Entry Kinds Guide](guide-entry-kinds.md) for available kinds and [Custom Entry Kinds](internal-kinds.md) for implementing handlers.

## Live Updates

The registry supports runtime changes—add, update, or remove entries while the system runs. Changes flow through the event bus where listeners can validate or reject them, and transactions ensure atomicity. Version history enables rollback.

YAML definition files are serialized registry snapshots loaded at startup. See [Registry module](lua-registry.md) for programmatic access.

## See Also

- [YAML & Project Structure](getting-started-structure.md) - Definition files
- [Custom Entry Kinds](internal-kinds.md) - Implementing kind handlers
- [Process Model](concept-process-model.md) - How processes work
