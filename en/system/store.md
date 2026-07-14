---
title: "Store (Key-Value)"
description: "Key-value stores with TTL support: in-memory, SQL-backed, and cluster-replicated (Raft and CRDT)."
---

# Store (Key-Value)

Key-value stores with TTL support: in-memory, SQL-backed, and cluster-replicated (Raft and CRDT).

## Entry Kinds

| Kind | Description |
|------|-------------|
| `store.memory` | In-memory store with automatic cleanup |
| `store.sql` | SQL-backed store with persistence |
| `store.kv.raft` | Cluster-replicated, strongly-consistent KV on the shared Raft |
| `store.kv.crdt` | Cluster-replicated, eventually-consistent KV over gossip (CRDT) |

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
| `max_size` | int | 10000 | Maximum entries; 0 is replaced with the default (10000) |
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

## Cluster KV Stores

`store.kv.raft` and `store.kv.crdt` replicate key-value data across cluster nodes. Both require [clustering](guides/cluster.md) to be enabled and reuse the same [Store Module](lua/storage/store.md) Lua API. Each entry is a namespaced view into one node-wide engine; `namespace` isolates this entry's keys and must match `^[a-z][a-z0-9._-]*$` (it may not start with `_`).

### Raft (strong consistency)

```yaml
- name: deployments
  kind: store.kv.raft
  namespace: deploy
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `namespace` | string | Yes | Key namespace in the shared engine |

Writes are proposed through the shared Raft (followers forward to the leader); reads are linearizable. Conditional writes (`put` with `only_if_absent`/`if_version`) are supported. Raft state is fs-durable by default under `cluster.raft.data_dir` (default `~/.wippy/store`); see [Configuration](guides/configuration.md#cluster).

### CRDT (eventual consistency)

```yaml
- name: sessions
  kind: store.kv.crdt
  namespace: sess
  durable: false
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `namespace` | string | Yes | - | Key namespace |
| `durable` | bool | No | false | Persist fs snapshots so the namespace survives a full-cluster restart |

Writes mutate local state and disseminate over gossip; conflicting concurrent writes converge last-writer-wins. Reads are local. Conditional writes are not supported. With `durable: false` the store is in-memory and reconstructs from peers; with `durable: true` it snapshots to `<data_dir>/_sys/kvcrdt`.

<note>
<code>data_dir</code> is node-level (<code>cluster.raft.data_dir</code>), not per-entry. The shared Raft state and durable CRDT snapshots live under <code>&lt;data_dir&gt;/_sys/</code>.
</note>

## TTL Behavior

Both stores support time-to-live. Expired entries persist briefly until cleanup runs at `cleanup_interval`. Set to `0` to disable automatic cleanup.

## Lua API

See [Store Module](lua/storage/store.md) for operations: `get`, `set`, `has`, `delete`, plus `put`, `entry`, `list`, and `info` for versioned and conditional access.

## See Also

- [Store Module](lua/storage/store.md) - Lua API reference
- [Database](system/database.md) - SQL backing for `store.sql`
