# Store (Key-Value)

In-memory and SQL-backed key-value stores with TTL support.

## Entry Kinds

| Kind | Description |
|------|-------------|
| `store.memory` | In-memory store with automatic cleanup |
| `store.sql` | SQL-backed store with persistence |

## Memory Store

```yaml
- name: sessions
  kind: store.memory
  max_size: 10000
  cleanup_interval: "5m"
  lifecycle:
    auto_start: true
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `max_size` | int | 10000 | Maximum entries (0 = unlimited) |
| `cleanup_interval` | duration | 5m | Expired entry cleanup interval |

When `max_size` is reached, new entries are rejected. Data is lost on restart.

## SQL Store

```yaml
- name: cache
  kind: store.sql
  database: app:postgres
  table_name: kv_store
  cleanup_interval: "10m"
  lifecycle:
    auto_start: true
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `database` | reference | required | Database entry reference |
| `table_name` | string | required | Table name for storage |
| `id_column_name` | string | key | Column for keys |
| `payload_column_name` | string | value | Column for values |
| `expire_column_name` | string | expires_at | Column for expiration |
| `cleanup_interval` | duration | 0 | Expired entry cleanup interval |

Column names are validated against SQL injection. Create the table before use:

```sql
CREATE TABLE kv_store (
    key VARCHAR(255) PRIMARY KEY,
    value BYTEA NOT NULL,
    expires_at BIGINT
);

CREATE INDEX idx_expires_at ON kv_store(expires_at) WHERE expires_at IS NOT NULL;
```

## TTL Behavior

Both stores support time-to-live. Expired entries persist briefly until cleanup runs at `cleanup_interval`. Set to `0` to disable automatic cleanup.

## Lua API

See [Store Module](lua/storage/store.md) for operations (get, set, delete, exists, clear).
