---
title: "Bootloader"
description: "Discover and run ordered application initialization functions at startup with wippy/bootloader."
---

# Bootloader

The `wippy/bootloader` module discovers and runs application initialization functions in a defined order at startup. Framework modules use bootloaders for tasks such as encryption-key setup and database migrations.

This page is a partial integration recipe and API reference, not a standalone application. The definition below is structurally complete, but `apply_seed()` represents application code that must implement the actual seed operation and its idempotency check. Any persistent cleanup or reversal depends on that application-specific operation.

## Setup

Add the module to your project:

```bash
wippy add wippy/bootloader
wippy install
```

Declare the dependency and the required application host:

```yaml
version: "1.0"
namespace: app

entries:
  - name: processes
    kind: process.host
    lifecycle:
      auto_start: true

  - name: os_env
    kind: env.storage.os

  - name: dep.bootloader
    kind: ns.dependency
    component: wippy/bootloader
    version: "*"
    parameters:
      - name: application_host
        value: app:processes
      - name: env_storage
        value: app:os_env
```

The dependency activates `wippy.bootloader:bootloader.service`, a `process.service` with `auto_start: true`.

## How It Works

At startup the bootloader:

1. Discovers every entry with `meta.type: bootloader` from the registry.
2. Sorts them by `meta.order` ascending (lowest first).
3. Executes each one sequentially as a Lua function.
4. Stops the remaining bootloader sequence on the first result with `status = "error"`.
5. Reports total, successful, failed, and skipped counts when finished.

Each bootloader checks its own conditions, performs its work, and reports a structured result.

## Defining a Bootloader

A bootloader is any `function.*` entry with `meta.type: bootloader`. Most application bootloaders use `function.lua`:

```yaml
- name: seed_defaults
  kind: function.lua
  meta:
    type: bootloader
    order: 50
    description: Seed default rows for a new install
  source: file://seed_defaults.lua
  method: run
  modules:
    - logger
  imports:
    sql: :sql
```

| Field | Required | Description |
|-------|----------|-------------|
| `meta.type` | Yes | Must be `bootloader` |
| `meta.order` | No | Execution order (default `999`); lower runs first |
| `meta.description` | No | Human-readable summary |
| `meta.requires` | No | One ID or an array of bootloader/service IDs. Earlier bootloaders must have returned `success` or `skipped`; service requirements must exist in the registry. An unmet requirement stops the remaining sequence. |

Dependency type is determined from the referenced registry entry: `meta.type: bootloader` identifies a bootloader, while other resolved entries are treated as services. If an ID cannot be resolved, the fallback treats a dotted namespace as a bootloader ID and another colon-qualified ID as a service ID. A service check waits up to 20 attempts at 500 ms intervals, but it checks registry presence, not runtime health.

### Return Contract

The `method` returns a table describing the outcome:

```lua
local function run()
    local ok, err = apply_seed()
    if err then
        return {
            status = "error",
            message = "seed failed: " .. tostring(err)
        }
    end

    if not ok then
        return {
            status = "skipped",
            message = "already seeded"
        }
    end

    return {
        status = "success",
        message = "seeded default rows"
    }
end

return { run = run }
```

| Status | Meaning |
|--------|---------|
| `success` | Work completed |
| `skipped` | No-op (already done, precondition unmet) |
| `error` | Failure — stops the remaining bootloader sequence |

A bootloader that raises a Lua error, returns an execution error, or returns a non-table value is converted to an `error` result. The orchestrator measures and overwrites `duration`; a returned `details` value is preserved for logging.

Use the three status strings exactly. Another value is logged as `UNKNOWN`, is not included in a status counter, and does not currently stop later bootloaders.

## Execution Order

Lower `order` values run first. Reserve low orders for infrastructure:

| Order | Typical Use |
|-------|-------------|
| `10` | Secrets and encryption keys (provided by the module) |
| `20` | Schema migrations (provided by `wippy/migration`) |
| `50` | Data seeding, search index warmup |
| `100` | Application-level tasks (convention) |

When two bootloaders share an order, they run in alphabetical order by their fully-qualified entry ID.

## Built-in Bootloaders

### Encryption Key (order `10`)

Generates 32 random bytes, encodes them as a 64-character hexadecimal `ENCRYPTION_KEY`, and stores the value through the configured `env_storage` if no value is present. Skipped when the variable already exists.

### Migration Bootloader (order `20`)

Provided by `wippy/migration`. Discovers every entry with `meta.type: migration`, groups them by `meta.target_db`, and applies the pending ones. See [Migrations](framework/migration.md).

## Observing Boot Status

The service logs the discovery count, then one result line per executed bootloader (`SUCCESS`, `FAILED`, `SKIPPED`) with the entry ID, order, and duration. The final summary reports executed and per-status counts. A failed bootloader stops later bootloaders and makes the orchestrator return `false` with its statistics; it does not raise a Lua process error by itself.

<tip>
Keep bootloaders idempotent. They run again whenever `bootloader.service` is started again, so check preconditions (row exists, file present, env var set) before doing work.
</tip>

## See Also

- [Migrations](framework/migration.md) — Migration bootloader and DSL
- [Supervision](guides/supervision.md) — Service lifecycle and restart policy
- [Framework Overview](framework/overview.md) — Framework module usage
