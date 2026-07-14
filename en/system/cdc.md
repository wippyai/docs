---
title: "Change Data Capture"
description: "Stream row-level changes from Postgres logical replication with db.cdc.postgres."
---

# Change Data Capture

Stream row-level changes from a Postgres database using logical replication (`pgoutput` plugin). A CDC source creates a replication slot, optionally snapshots existing rows, then emits insert/update/delete changes as they happen. Sources are addressable by their entry ID and consumed from Lua via the [`cdc` module](lua/storage/cdc.md).

## Configuration

```yaml
- name: pg_cdc
  kind: db.cdc.postgres
  host: ${env:DB_HOST}
  port: 5432
  database: app
  username: ${env:DB_USER}
  password: ${env:app.secrets:db_password}
  slot_name: wippy_slot
  publication: wippy_pub
  tables:
    - public.users
    - public.orders
  snapshot: true
  streaming: true
  standby_interval: "10s"
  status_interval: "10s"
  lifecycle:
    auto_start: true
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `host` | string | required | Postgres host |
| `port` | int | required | Postgres port (must be > 0) |
| `database` | string | required | Database name |
| `username` | string | required | Replication user (must have `REPLICATION` privilege) |
| `password` | string | required | Password (inline or `${env:NAME}`) |
| `slot_name` | string | required | Logical replication slot name |
| `publication` | string | - | Postgres publication; required when `tables` is empty |
| `tables` | []string | - | Tables to capture (`schema.table`); omit to use the publication's tables |
| `snapshot` | bool | false | Emit the existing rows as the initial snapshot before streaming |
| `streaming` | bool | false | Stream ongoing changes after the snapshot |
| `temporary` | bool | false | Use a temporary replication slot (removed on disconnect) |
| `failover` | bool | false | Enable failover slot mode (mutually exclusive with `temporary`) |
| `standby_interval` | duration | - | Standby status message interval (e.g. `10s`) |
| `status_interval` | duration | - | Status update interval to the server |
| `snapshot_fetch_size` | int | - | Rows fetched per snapshot batch (must be >= 0) |
| `options` | map | - | Extra connection options |
| `lifecycle` | object | - | Lifecycle configuration |

Credentials resolve `${env:NAME}` placeholders through the [environment registry](system/env.md) at decode time.

## How It Works

1. The source connects to Postgres as a replication user and creates (or resumes) the replication slot named by `slot_name`.
2. If `snapshot` is set, existing rows of the configured tables are emitted first as change events with `op = "r"` (read).
3. If `streaming` is set, ongoing row changes (`insert`, `update`, `delete`, `truncate`) are streamed from the WAL via the `pgoutput` plugin.
4. A standby status loop periodically acknowledges the LSN so Postgres retains WAL segments (`standby_interval`).
5. The source registers under its entry ID; Lua code subscribes with [`cdc.stream`](lua/storage/cdc.md).

## Source Info

Each source is described by an info record:

| Field | Description |
|-------|-------------|
| `name` | Source name (the entry ID) |
| `slot` | Replication slot name |
| `publication` | Postgres publication (if any) |
| `tables` | Captured tables (if configured) |
| `streaming` | Whether streaming is enabled |
| `failover` | Whether failover mode is enabled |
| `temporary` | Whether the slot is temporary |
| `snapshot` | Whether snapshot is enabled |

## See Also

- [CDC Module](lua/storage/cdc.md) - Lua streaming API
- [Database](system/database.md) - SQL database services
- [Environment](system/env.md) - Resolving credentials via `${env:NAME}`
