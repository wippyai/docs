---
title: "Store（键值存储）"
---

# Store（键值存储）

支持 TTL 的键值存储：内存、SQL 支持，以及集群复制（Raft 和 CRDT）。

## Entry 类型

| Kind | 描述 |
|------|------|
| `store.memory` | 带自动清理的内存存储 |
| `store.sql` | 带持久化的 SQL 支持存储 |
| `store.kv.raft` | 基于共享 Raft 的集群复制、强一致性 KV |
| `store.kv.crdt` | 基于 gossip（CRDT）的集群复制、最终一致性 KV |

## 内存存储

```yaml
- name: sessions
  kind: store.memory
  max_size: 10000
  cleanup_interval: "5m"
  lifecycle:
    auto_start: true
```

| 字段 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `max_size` | int | 10000 | 最大条目数（0 = 无限制） |
| `cleanup_interval` | duration | 5m | 过期条目清理间隔 |

当达到 `max_size` 时，新条目将被拒绝。重启后数据会丢失。

## SQL 存储

```yaml
- name: cache
  kind: store.sql
  database: app:postgres
  table_name: kv_store
  cleanup_interval: "10m"
  lifecycle:
    auto_start: true
```

| 字段 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `database` | reference | required | 数据库 entry 引用 |
| `table_name` | string | required | 存储表名 |
| `id_column_name` | string | key | 键列名 |
| `payload_column_name` | string | value | 值列名 |
| `expire_column_name` | string | expires_at | 过期时间列名 |
| `cleanup_interval` | duration | 0 | 过期条目清理间隔 |

列名会进行 SQL 注入验证。使用前需创建表：

```sql
CREATE TABLE kv_store (
    key VARCHAR(255) PRIMARY KEY,
    value BYTEA NOT NULL,
    expires_at BIGINT
);

CREATE INDEX idx_expires_at ON kv_store(expires_at) WHERE expires_at IS NOT NULL;
```

## 集群 KV 存储 {id=cluster-kv-stores}

`store.kv.raft` 和 `store.kv.crdt` 在集群各节点间复制键值数据。两者都要求启用[集群](guides/cluster.md)，并复用相同的 [Store 模块](lua/storage/store.md) Lua API。每个 entry 都是对节点级单一引擎的命名空间视图；`namespace` 隔离此 entry 的键，且必须匹配 `^[a-z][a-z0-9._-]*$`（不能以 `_` 开头）。

### Raft（强一致性）

```yaml
- name: deployments
  kind: store.kv.raft
  namespace: deploy
```

| 字段 | 类型 | 必填 | 描述 |
|-------|------|----------|-------------|
| `namespace` | string | 是 | 共享引擎中的键命名空间 |

写入通过共享 Raft 提议（follower 转发给 leader）；读取是线性化的。支持条件写入（带 `only_if_absent`/`if_version` 的 `put`）。Raft 状态默认在 `cluster.raft.data_dir`（默认 `~/.wippy/store`）下文件系统持久化；参见[配置](guides/configuration.md#cluster)。

### CRDT（最终一致性）

```yaml
- name: sessions
  kind: store.kv.crdt
  namespace: sess
  durable: false
```

| 字段 | 类型 | 必填 | 默认值 | 描述 |
|-------|------|----------|---------|-------------|
| `namespace` | string | 是 | - | 键命名空间 |
| `durable` | bool | 否 | false | 持久化文件系统快照，使命名空间在整个集群重启后仍然存留 |

写入会修改本地状态并通过 gossip 传播；冲突的并发写入按最后写入者胜出（last-writer-wins）收敛。读取是本地的。不支持条件写入。当 `durable: false` 时，存储在内存中，并从对等节点重建；当 `durable: true` 时，它会快照到 `<data_dir>/_sys/kvcrdt`。

<note>
<code>data_dir</code> 是节点级（<code>cluster.raft.data_dir</code>），而非每个 entry 独立。共享 Raft 状态和持久化的 CRDT 快照位于 <code>&lt;data_dir&gt;/_sys/</code> 下。
</note>

## TTL 行为

两种存储都支持生存时间。过期条目会短暂保留，直到 `cleanup_interval` 执行清理。设置为 `0` 可禁用自动清理。

## Lua API

参见 [Store 模块](lua/storage/store.md) 了解操作：`get`、`set`、`has`、`delete`，以及用于版本化和条件访问的 `put`、`entry`、`list` 和 `info`。

## 另请参阅

- [Store 模块](lua/storage/store.md) - Lua API 参考
- [数据库](system/database.md) - `store.sql` 的 SQL 后端
