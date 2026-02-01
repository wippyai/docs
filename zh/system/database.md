# Database 系统

SQL 数据库连接池和配置。支持 PostgreSQL、MySQL、SQLite、Microsoft SQL Server 和 Oracle。

## Entry 类型

| Kind | 描述 |
|------|------|
| `db.sql.postgres` | PostgreSQL 数据库 |
| `db.sql.mysql` | MySQL 数据库 |
| `db.sql.sqlite` | SQLite 数据库 |
| `db.sql.mssql` | Microsoft SQL Server |
| `db.sql.oracle` | Oracle 数据库 |

## 配置

### 标准数据库（PostgreSQL、MySQL、MSSQL、Oracle）

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
      max_open: 1
      max_idle: 1
      max_lifetime: "1h"
    options:
      cache: "shared"
    lifecycle:
      auto_start: true
```

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

| 字段 | 类型 | 描述 |
|------|------|------|
| `file` | string | 数据库文件路径或 `:memory:` |
| `pool` | object | 连接池设置 |
| `options` | map | SQLite 特定选项 |
| `lifecycle` | object | 生命周期配置 |

### 环境变量字段

使用 `_env` 后缀从环境变量或 [env.variable](system/env.md) entry 加载值：

| 字段 | 描述 |
|------|------|
| `host_env` | 从环境变量获取主机 |
| `port_env` | 从环境变量获取端口 |
| `database_env` | 从环境变量获取数据库名称 |
| `username_env` | 从环境变量获取用户名 |
| `password_env` | 从环境变量获取密码 |

```yaml
- name: prod_db
  kind: db.sql.postgres
  host_env: "DB_HOST"
  port_env: "DB_PORT"
  database_env: "DB_NAME"
  username_env: "DB_USER"
  password_env: "app.secrets:db_password"  # Reference env.variable entry
```

<warning>
避免在配置中硬编码密码。使用环境变量或 <code>env.variable</code> entry 来管理凭据。参见 <a href="system-env.md">Environment</a> 了解安全的密钥管理。
</warning>

## 连接池

配置连接池行为。池设置映射到 Go 的 [database/sql 连接池](https://pkg.go.dev/database/sql#DB.SetMaxOpenConns)。

| 字段 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `max_open` | int | 0 | 最大打开连接数（0 = 无限制） |
| `max_idle` | int | 0 | 最大空闲连接数（0 = 无限制） |
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

每种数据库类型从配置构建 DSN：

### PostgreSQL {id="dsn-postgresql"}

```
postgres://username:password@host:port/database?sslmode=disable
```

### MySQL {id="dsn-mysql"}

```
username:password@tcp(host:port)/database?charset=utf8mb4
```

### SQLite {id="dsn-sqlite"}

```
file:/path/to/database.db?cache=shared
:memory:?mode=memory
```

### Microsoft SQL Server {id="dsn-mssql"}

```
sqlserver://username:password@host:port?database=dbname
```

### Oracle {id="dsn-oracle"}

```
oracle://username:password@host:port/service_name
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

```yaml
options:
  cache: "shared"         # shared, private
  mode: "rwc"            # ro, rw, rwc, memory
  _journal_mode: "WAL"   # DELETE, TRUNCATE, PERSIST, MEMORY, WAL, OFF
```

### Microsoft SQL Server {id="options-mssql"}

```yaml
options:
  encrypt: "true"
  TrustServerCertificate: "false"
```

### Oracle {id="options-oracle"}

```yaml
options:
  poolMinSessions: "1"
  poolMaxSessions: "10"
  poolIncrement: "1"
```

## 示例

### 带 SSL 的 PostgreSQL

```yaml
- name: secure_postgres
  kind: db.sql.postgres
  host: "db.example.com"
  port: 5432
  database: "production"
  username: "app_user"
  password: "${DB_PASSWORD}"
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
  password_env: "REPLICA_PASSWORD"
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
  pool:
    max_open: 1
    max_idle: 1
  options:
    cache: "shared"
    mode: "memory"
```

### 多数据库配置

```yaml
entries:
  # Primary database
  - name: users_db
    kind: db.sql.postgres
    host_env: "USERS_DB_HOST"
    port: 5432
    database: "users"
    username_env: "USERS_DB_USER"
    password_env: "USERS_DB_PASSWORD"
    lifecycle:
      auto_start: true

  # Analytics database
  - name: analytics_db
    kind: db.sql.mysql
    host_env: "ANALYTICS_DB_HOST"
    port: 3306
    database: "analytics"
    username_env: "ANALYTICS_DB_USER"
    password_env: "ANALYTICS_DB_PASSWORD"
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
