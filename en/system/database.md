# Database System

SQL database connection pooling and configuration. Supports PostgreSQL, MySQL, SQLite, Microsoft SQL Server, and Oracle.

## Entry Kinds

| Kind | Description |
|------|-------------|
| `db.sql.postgres` | PostgreSQL database |
| `db.sql.mysql` | MySQL database |
| `db.sql.sqlite` | SQLite database |
| `db.sql.mssql` | Microsoft SQL Server |
| `db.sql.oracle` | Oracle database |

## Configuration

### Standard Databases (PostgreSQL, MySQL, MSSQL, Oracle)

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

## Connection Fields

### Standard Database Fields

| Field | Type | Description |
|-------|------|-------------|
| `host` | string | Database host address |
| `port` | int | Database port number |
| `database` | string | Database name |
| `username` | string | Database user |
| `password` | string | Database password |
| `pool` | object | Connection pool settings |
| `options` | map | Database-specific options |
| `lifecycle` | object | Lifecycle configuration |

### SQLite Fields

| Field | Type | Description |
|-------|------|-------------|
| `file` | string | Database file path or `:memory:` |
| `pool` | object | Connection pool settings |
| `options` | map | SQLite-specific options |
| `lifecycle` | object | Lifecycle configuration |

### Environment Variable Fields

Use `_env` suffix to load values from environment variables or [env.variable](system-env.md) entries:

| Field | Description |
|-------|-------------|
| `host_env` | Host from environment variable |
| `port_env` | Port from environment variable |
| `database_env` | Database name from environment |
| `username_env` | Username from environment |
| `password_env` | Password from environment |

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
Avoid hardcoding passwords in configuration. Use environment variables or <code>env.variable</code> entries for credentials. See <a href="system-env.md">Environment</a> for secure secret management.
</warning>

## Connection Pool

Configure connection pooling behavior. Pool settings map to Go's [database/sql connection pool](https://pkg.go.dev/database/sql#DB.SetMaxOpenConns).

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `max_open` | int | 0 | Maximum open connections (0 = unlimited) |
| `max_idle` | int | 0 | Maximum idle connections (0 = unlimited) |
| `max_lifetime` | duration | 1h | Maximum connection lifetime |

```yaml
pool:
  max_open: 25      # Limit concurrent connections
  max_idle: 5       # Keep 5 connections ready
  max_lifetime: "30m"  # Recycle connections every 30 minutes
```

<tip>
Set <code>max_idle</code> less than or equal to <code>max_open</code>. Connections exceeding <code>max_lifetime</code> are closed and replaced, helping recover from stale connections.
</tip>

## DSN Formats

Each database type constructs a DSN from configuration:

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

## Database Options

Common database-specific options:

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

## Examples

### PostgreSQL with SSL

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

### MySQL Read Replica

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

### SQLite In-Memory

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

### Multiple Database Setup

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

## Runtime Registration

Databases can be registered at runtime using the [registry module](lua-registry.md), enabling dynamic database configuration based on application state or external configuration.

## Lua API

See [SQL Module](lua-sql.md) for database operations API.
