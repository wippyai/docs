---
title: "Database 系统"
description: "SQL 数据库连接池和配置。支持 PostgreSQL、MySQL 和 SQLite。"
---

# Database 系统

SQL 数据库连接池和配置。支持 PostgreSQL、MySQL 和 SQLite。

## Entry 类型

| Kind | 描述 |
|------|------|
| `db.sql.postgres` | PostgreSQL 数据库 |
| `db.sql.mysql` | MySQL 数据库 |
| `db.sql.sqlite` | SQLite 数据库 |

## 配置

### 标准数据库（PostgreSQL、MySQL）

```yaml
# src/data/_index.yaml
version: "1.0"
namespace: app.data

entries:
  - name: main_db
    kind: db.sql.postgres
    host: "localhost"
    port: 5432
    database: "myapp"
    username: "dbuser"
    password: "dbpass"
    pool:
      max_open: 25
      max_idle: 5
      max_lifetime: "1h"
    options:
      sslmode: "disable"
    lifecycle:
      auto_start: true
```

### SQLite

```yaml
  - name: cache_db
    kind: db.sql.sqlite
    file: "/var/data/cache.db"  # Use :memory: for in-memory
    pool:
      max_open: 4
      max_idle: 2
      max_lifetime: "1h"
    lifecycle:
      auto_start: true
```

<note>
私有的内存 SQLite 数据库（<code>file: ":memory:"</code>）的作用域限定为单个物理连接，因此 <code>max_open</code> 和 <code>max_idle</code> 被强制为 <code>1</code>。基于文件的数据库会遵循配置的 <code>pool</code> 设置，CDC 快照读事务需要这一点，才不会占用唯一的写入连接。日志模式始终为 <code>WAL</code>。
</note>

## 连接字段

### 标准数据库字段

| 字段 | 类型 | 描述 |
|------|------|------|
| `host` | string | 数据库主机地址 |
| `port` | int | 数据库端口号 |
| `database` | string | 数据库名称 |
| `username` | string | 数据库用户 |
| `password` | string | 数据库密码 |
| `pool` | object | 连接池设置 |
| `options` | map | 数据库特定选项 |
| `lifecycle` | object | 生命周期配置 |

### SQLite 字段

| 字段 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `file` | string | 必填 | 数据库文件路径或 `:memory:` |
| `pool` | object | - | 连接池设置；对 `:memory:` 会把 `max_open` 和 `max_idle` 强制为 `1` |
| `max_mutation_changes` | int | 100000 | 单个事务在已提交变更观察器中可保留的行数 |
| `max_mutation_bytes` | int | 67108864 | 单个事务在观察器中可保留的逻辑字节数（64 MiB） |
| `options` | map | - | 接受但忽略 |
| `lifecycle` | object | - | 生命周期配置 |

`max_mutation_changes` 和 `max_mutation_bytes` 限定为 [`db.cdc.sqlite`](system/cdc.md) 源供数的内存中已提交变更观察器的上限。任一字段为零表示选用默认值；负值会被拒绝。这些上限是保守的而非精确的：SQLite 会把完整的一行交给 pre-update 钩子，因此在上限拒绝该候选之前，可能已经物化了一行。

### 密钥与环境值

使用 `${env:NAME}` 占位符从[环境注册表](system/env.md)中取连接值，在解码时解析。`NAME` 是已注册变量的公开名称或其条目 ID（例如 `app.secrets:db_password`）；它不是原始的操作系统环境变量。

```yaml
- name: prod_db
  kind: db.sql.postgres
  host: ${env:DB_HOST}
  port: ${env:DB_PORT}
  database: ${env:DB_NAME}
  username: ${env:DB_USER}
  password: ${env:app.secrets:db_password}
```

<note>
较早的配置使用同级的 <code>&lt;field&gt;_env</code> 指令（<code>host_env</code>、<code>port_env</code>、<code>database_env</code>、<code>username_env</code>、<code>password_env</code>），其解析方式相同。该形式已<b>弃用</b> — 请迁移到上面所示的 <code>${env:NAME}</code> 占位符。
</note>

<warning>
避免在配置中硬编码密码。使用 <code>env.variable</code> entry 来管理凭据。参见 <a href="system/env.md">Environment</a> 了解安全的密钥管理。
</warning>

## 连接池

配置连接池行为。池设置映射到 Go 的 [database/sql 连接池](https://pkg.go.dev/database/sql#DB.SetMaxOpenConns)。

| 字段 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `max_open` | int | 0 | 最大打开连接数（0 = 无限制） |
| `max_idle` | int | 0 | 最大空闲连接数（0 = 不保留空闲连接） |
| `max_lifetime` | duration | 1h | 连接最大生命周期 |

```yaml
pool:
  max_open: 25      # Limit concurrent connections
  max_idle: 5       # Keep 5 connections ready
  max_lifetime: "30m"  # Recycle connections every 30 minutes
```

<tip>
将 <code>max_idle</code> 设置为小于或等于 <code>max_open</code>。超过 <code>max_lifetime</code> 的连接会被关闭并替换，有助于恢复过期连接。
</tip>

## DSN 格式

每种数据库类型从配置构建 DSN。所有 `options` 都会被追加（按键排序）；默认不包含任何选项。

### PostgreSQL {id="dsn-postgresql"}

```
host='host' port=port user='username' password='password' dbname='database' [option='value' ...]
```

除端口外的每个值都用单引号包裹，其中嵌入的 `'` 和 `\` 会用反斜杠转义，因此包含空格或引号的主机、密码和选项值都能原样传递。

### MySQL {id="dsn-mysql"}

```
username:password@tcp(host:port)/database[?option=value&...]
```

### SQLite {id="dsn-sqlite"}

```
file:/path/to/database.db?mode=rwc
:memory:
```

## 数据库选项

常见的数据库特定选项：

### PostgreSQL {id="options-postgresql"}

```yaml
options:
  sslmode: "require"      # disable, require, verify-ca, verify-full
  connect_timeout: "10"   # Connection timeout in seconds
  application_name: "myapp"
```

### MySQL {id="options-mysql"}

```yaml
options:
  charset: "utf8mb4"
  parseTime: "true"       # Parse time values to time.Time
  loc: "Local"            # Timezone
```

### SQLite {id="options-sqlite"}

SQLite 不会把 `options` 映射应用到它的 DSN。文件数据库始终以 `mode=rwc` 打开，日志模式始终设为 `WAL`。`options` 字段被接受但会被忽略。

## 示例

### 带 SSL 的 PostgreSQL

```yaml
- name: secure_postgres
  kind: db.sql.postgres
  host: "db.example.com"
  port: 5432
  database: "production"
  username: "app_user"
  password: ${env:app.secrets:db_password}
  pool:
    max_open: 50
    max_idle: 10
    max_lifetime: "1h"
  options:
    sslmode: "verify-full"
    sslcert: "/certs/client.crt"
    sslkey: "/certs/client.key"
    sslrootcert: "/certs/ca.crt"
  lifecycle:
    auto_start: true
```

### MySQL 只读副本

```yaml
- name: mysql_replica
  kind: db.sql.mysql
  host: "replica.db.example.com"
  port: 3306
  database: "app"
  username: "readonly"
  password: ${env:app.secrets:replica_password}
  pool:
    max_open: 20
    max_idle: 5
    max_lifetime: "30m"
  options:
    charset: "utf8mb4"
    parseTime: "true"
    readTimeout: "30s"
```

### SQLite 内存数据库

```yaml
- name: test_db
  kind: db.sql.sqlite
  file: ":memory:"
```

### 多数据库配置

```yaml
entries:
  # Primary database
  - name: users_db
    kind: db.sql.postgres
    host: ${env:USERS_DB_HOST}
    port: 5432
    database: "users"
    username: ${env:USERS_DB_USER}
    password: ${env:app.secrets:users_db_password}
    lifecycle:
      auto_start: true

  # Analytics database
  - name: analytics_db
    kind: db.sql.mysql
    host: ${env:ANALYTICS_DB_HOST}
    port: 3306
    database: "analytics"
    username: ${env:ANALYTICS_DB_USER}
    password: ${env:app.secrets:analytics_db_password}
    lifecycle:
      auto_start: true

  # Local cache
  - name: cache
    kind: db.sql.sqlite
    file: "/var/cache/app.db"
    lifecycle:
      auto_start: true
```

## 运行时注册

数据库可以在运行时使用 [registry 模块](lua/core/registry.md) 注册，支持基于应用状态或外部配置的动态数据库配置。

## Lua API

参见 [SQL 模块](lua/storage/sql.md) 了解数据库操作 API。

## 另请参阅

- [SQL 模块](lua/storage/sql.md) - Lua API 参考
- [Store](system/store.md) - 基于 `db.sql.*` 数据库的键值存储
- [Queue](system/queue.md) - SQL 支持的队列处理器
- [变更数据捕获](system/cdc.md) - 从 `db.sql.sqlite` 或 Postgres 数据库流式获取行级变更
