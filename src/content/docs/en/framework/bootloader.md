---
title: "Bootloader"
---

# Bootloader

The `wippy/bootloader` module orchestrates application initialization by discovering and running bootloader functions in a defined order at startup. Other framework modules (migrations, encryption, index refresh) register bootloaders to run their own initialization steps.

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

The bootloader itself runs as `wippy.bootloader:bootloader.service` (a `process.service` with `auto_start: true`). Nothing else is required to activate it.

## How It Works

At startup the bootloader:

1. Discovers every entry with `meta.type: bootloader` from the registry.
2. Sorts them by `meta.order` ascending (lowest first).
3. Executes each one sequentially as a Lua function.
4. Stops on the first error that returns `status = "error"`.
5. Reports total / success / failed / skipped counts when finished.

Bootloaders are autonomous — each one checks its own conditions, does its work, and reports a structured result.

## Defining a Bootloader

A bootloader is any `function.lua` entry with `meta.type: bootloader`:

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
| `meta.requires` | No | Bootloader IDs and/or service IDs that must complete/be available first; the runtime waits for services and fails the bootloader (stopping the boot sequence) if a requirement is unmet |

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
| `error` | Failure — stops the boot sequence |

A bootloader that raises a Lua error is treated as `error`.

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

Generates a 256-bit `ENCRYPTION_KEY` and stores it through the configured `env_storage` if no value is present. Other modules (security, usage tracking) read this variable for envelope encryption. Skipped when the variable already exists.

### Migration Bootloader (order `20`)

Provided by `wippy/migration`. Discovers every entry with `meta.type: migration`, groups them by `meta.target_db`, and applies the pending ones. See [Migrations](framework/migration.md).

## Observing Boot Status

The service logs one line per bootloader (`SUCCESS`, `FAILED`, `SKIPPED`) with the entry ID, order, and duration. The final summary line reports aggregate counts. A failed bootloader aborts startup — the supervisor's restart policy then applies to `bootloader.service`.

<tip>
Keep bootloaders idempotent. They may run again after a crash restart, so check preconditions (row exists, file present, env var set) before doing work.
</tip>

## See Also

- [Migrations](framework/migration.md) - Migration bootloader and DSL
- [Supervision](guides/supervision.md) - Service lifecycle and restart policy
- [Framework Overview](framework/overview.md) - Framework module usage
