# Migrations

The `wippy/migration` module provides a database migration framework with a small DSL for defining schema changes, a runner that discovers and executes them, and a bootloader that runs pending migrations for every `target_db` registered in the project.

Migrations support SQLite, PostgreSQL, and MySQL, with per-driver `up`/`down` implementations defined side by side.

## Setup

Add the module to your project:

```bash
wippy add wippy/migration
wippy install
```

Declare the dependency and the application database the migrations target:

```yaml
version: "1.0"
namespace: app

entries:
  - name: app_db
    kind: db.sql.sqlite
    path: ./data/app.db

  - name: dep.migration
    kind: ns.dependency
    component: wippy/migration
    version: "*"
```

The migration bootloader registers with `wippy/bootloader` at order `20`. When the application starts, it discovers every migration entry in the registry, groups them by `meta.target_db`, and runs pending migrations against each database.

## Defining a Migration

A migration is a `function.lua` entry with `meta.type: migration`. The entry returns a function produced by `migration.define(...)`.

```yaml
entries:
  - name: 01_create_users_table
    kind: function.lua
    meta:
      type: migration
      target_db: app:app_db
      timestamp: "2025-01-15T10:00:00Z"
    source: file://01_create_users_table.lua
    imports:
      migration: wippy.migration:migration
```

```lua
return require("migration").define(function()
    migration("Create users table", function()
        database("sqlite", function()
            up(function(db)
                local ok, err = db:execute([[
                    CREATE TABLE users (
                        id    INTEGER PRIMARY KEY,
                        name  TEXT NOT NULL,
                        email TEXT NOT NULL UNIQUE
                    )
                ]])
                if err then error(err) end
            end)

            down(function(db)
                db:execute("DROP TABLE IF EXISTS users")
            end)
        end)

        database("postgres", function()
            up(function(db)
                db:execute([[
                    CREATE TABLE users (
                        id    SERIAL PRIMARY KEY,
                        name  TEXT NOT NULL,
                        email TEXT NOT NULL UNIQUE
                    )
                ]])
            end)

            down(function(db)
                db:execute("DROP TABLE IF EXISTS users")
            end)
        end)
    end)
end)
```

### Required Metadata

| Field | Required | Description |
|-------|----------|-------------|
| `meta.type` | yes | Must be `"migration"` for discovery |
| `meta.target_db` | yes | Registry ID of the database to run against |
| `meta.timestamp` | no | ISO-8601 timestamp used for ordering when multiple migrations target the same database |
| `meta.tags` | no | Array of tags; the runner can filter migrations by tag |

Migrations for a database run in ascending `meta.timestamp` order. `meta.timestamp` is optional; the full entry id is the tie-breaker, so migrations with equal or absent timestamps still run in a stable, deterministic order.

## DSL

Inside the function passed to `migration.define`, the following nested functions are available:

| Function | Description |
|----------|-------------|
| `migration(description, fn)` | Open a new migration with a human-readable description |
| `database(type, fn)` | Declare an implementation for `"sqlite"`, `"postgres"`, or `"mysql"` |
| `up(fn)` / `down(fn)` | Define forward and rollback functions |
| `after(fn)` | Optional post-migration hook (same transaction) |

Each `up`/`down`/`after` function receives a transaction object, not a raw connection. All three operations run in a single transaction that rolls back on error.

### Transaction Methods

```lua
local rows, err  = db:query(sql, params)    -- SELECT, returns array of rows
local result, err = db:execute(sql, params) -- INSERT/UPDATE/DDL, returns { rows_affected, last_insert_id }
local stmt, err  = db:prepare(sql)          -- prepared statement
```

Always use parameterised queries:

```lua
db:execute("INSERT INTO users (name, email) VALUES (?, ?)", { "Alice", "alice@example.com" })
```

### Error Handling

Calling `error(...)` aborts the migration and rolls back the transaction. Wrap every statement that may fail:

```lua
up(function(db)
    local _, err = db:execute("CREATE TABLE ...")
    if err then error(err) end
end)
```

## Runner API

The runner is exposed as a library for programmatic use:

```yaml
imports:
  runner: wippy.migration:runner
```

```lua
local runner = require("runner").setup("app:app_db")

local result = runner:run()      -- apply all pending migrations
local result = runner:run_next() -- apply the next pending migration
local result = runner:rollback() -- roll back the most recently applied migration
local status = runner:status()   -- list applied + pending migrations
```

### `runner:run(options)`

Applies every pending migration for the configured database. Returns a summary:

```lua
{
    status = "complete",            -- "complete" or "error"
    migrations_found = 3,
    migrations_applied = 2,
    migrations_skipped = 1,
    migrations_failed = 0,
    duration = 0.123,
    migrations = { ... },           -- per-migration status
    skipped_details = { ... },
}
```

Options:

| Option | Description |
|--------|-------------|
| `tags` | Array of tags; only migrations whose `meta.tags` intersect are considered |

### `runner:rollback(options)`

Rolls back applied migrations in reverse order of application. With no options it reverts the single most recently applied migration:

```lua
runner:rollback()                                            -- roll back the last migration
runner:rollback({ count = 3 })                               -- roll back the last 3
runner:rollback({ allowed_ids = { "app:01_create_users_table" } }) -- restrict to specific ids
```

Options:

| Option | Description |
|--------|-------------|
| `count` | Number of migrations to roll back; defaults to `1` |
| `allowed_ids` | Array of migration ids; only these are eligible for rollback |

### `runner:status(options)`

Returns a status report describing every migration for the database:

```lua
{
    database_id        = "app:app_db",
    db_type            = "sqlite",
    total_migrations   = 3,
    applied_migrations = 2,
    pending_migrations = 1,
    migrations = {
        { id = "app:01_...", description = "...", timestamp = "...",
          tags = {}, status = "applied", applied_at = ... },
        -- ...
    },
}
```

Applied migrations are listed first (ordered by `applied_at`), followed by pending ones (ordered by `meta.timestamp`, then by id).

## Registry API

`wippy.migration:registry` offers direct registry queries:

| Function | Description |
|----------|-------------|
| `registry.find({ target_db, tags })` | Return all migration entries matching the criteria |
| `registry.get(id)` | Return a single migration entry by id |
| `registry.get_target_dbs()` | Return every unique `meta.target_db` present in migrations |
| `registry.get_tags()` | Return every unique tag present on migrations |

The bootloader uses these to discover the full set of target databases at startup.

## Migration Tracking

The runner creates a `_migrations` table in each target database on first run. Applied migrations are recorded by id so subsequent runs skip them. The tracking table is created automatically; do not write your own migration to create it.

## Best Practices

- **One logical change per migration** - create one table, add one column, create one index.
- **Write a real `down`** - if rollback is impossible (data loss), document that and raise an error rather than silently succeeding.
- **Prefer idempotency** - `CREATE TABLE IF NOT EXISTS` and `DROP TABLE IF EXISTS` survive reruns without special handling.
- **Keep DDL and DML separate** - don't seed data in the same migration that creates a table when you can avoid it.
- **Test both directions** - apply the migration, roll it back, and verify the schema matches the starting state.

## See Also

- [SQL Driver](system/database.md) - Database resource configuration
- [Bootloader](framework/bootloader.md) - Bootloader ordering and hooks
- [Framework Overview](framework/overview.md) - Framework module usage
