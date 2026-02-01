# Store（键值存储）

内存和 SQL 支持的键值存储，支持 TTL。

## Entry 类型

| Kind | 描述 |
|------|------|
| `store.memory` | 带自动清理的内存存储 |
| `store.sql` | 带持久化的 SQL 支持存储 |

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

## TTL 行为

两种存储都支持生存时间。过期条目会短暂保留，直到 `cleanup_interval` 执行清理。设置为 `0` 可禁用自动清理。

## Lua API

参见 [Store 模块](lua/storage/store.md) 了解操作方法（get、set、delete、exists、clear）。
