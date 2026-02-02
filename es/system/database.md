# Sistema de Base de Datos

Pool de conexiones y configuración de bases de datos SQL. Soporta PostgreSQL, MySQL, SQLite, Microsoft SQL Server y Oracle.

## Tipos de Entrada

| Tipo | Descripción |
|------|-------------|
| `db.sql.postgres` | Base de datos PostgreSQL |
| `db.sql.mysql` | Base de datos MySQL |
| `db.sql.sqlite` | Base de datos SQLite |
| `db.sql.mssql` | Microsoft SQL Server |
| `db.sql.oracle` | Base de datos Oracle |

## Configuración

### Bases de Datos Estándar (PostgreSQL, MySQL, MSSQL, Oracle)

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
    file: "/var/data/cache.db"  # Use :memory: para en memoria
    pool:
      max_open: 1
      max_idle: 1
      max_lifetime: "1h"
    options:
      cache: "shared"
    lifecycle:
      auto_start: true
```

## Campos de Conexión

### Campos de Base de Datos Estándar

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `host` | string | Dirección del host de base de datos |
| `port` | int | Número de puerto de base de datos |
| `database` | string | Nombre de base de datos |
| `username` | string | Usuario de base de datos |
| `password` | string | Contraseña de base de datos |
| `pool` | object | Configuración del pool de conexiones |
| `options` | map | Opciones específicas de la base de datos |
| `lifecycle` | object | Configuración de ciclo de vida |

### Campos de SQLite

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `file` | string | Ruta del archivo de base de datos o `:memory:` |
| `pool` | object | Configuración del pool de conexiones |
| `options` | map | Opciones específicas de SQLite |
| `lifecycle` | object | Configuración de ciclo de vida |

### Campos de Variables de Entorno

Use el sufijo `_env` para cargar valores desde variables de entorno o entradas [env.variable](system/env.md):

| Campo | Descripción |
|-------|-------------|
| `host_env` | Host desde variable de entorno |
| `port_env` | Puerto desde variable de entorno |
| `database_env` | Nombre de base de datos desde entorno |
| `username_env` | Usuario desde entorno |
| `password_env` | Contraseña desde entorno |

```yaml
- name: prod_db
  kind: db.sql.postgres
  host_env: "DB_HOST"
  port_env: "DB_PORT"
  database_env: "DB_NAME"
  username_env: "DB_USER"
  password_env: "app.secrets:db_password"  # Referencia entrada env.variable
```

<warning>
Evite codificar contraseñas en la configuración. Use variables de entorno o entradas <code>env.variable</code> para credenciales. Consulte <a href="system/env.md">Entorno</a> para gestión segura de secretos.
</warning>

## Pool de Conexiones

Configure el comportamiento del pool de conexiones. La configuración del pool se mapea al [pool de conexiones de database/sql](https://pkg.go.dev/database/sql#DB.SetMaxOpenConns) de Go.

| Campo | Tipo | Por Defecto | Descripción |
|-------|------|---------|-------------|
| `max_open` | int | 0 | Conexiones máximas abiertas (0 = ilimitado) |
| `max_idle` | int | 0 | Conexiones máximas inactivas (0 = ilimitado) |
| `max_lifetime` | duration | 1h | Tiempo de vida máximo de conexión |

```yaml
pool:
  max_open: 25      # Limitar conexiones concurrentes
  max_idle: 5       # Mantener 5 conexiones listas
  max_lifetime: "30m"  # Reciclar conexiones cada 30 minutos
```

<tip>
Establezca <code>max_idle</code> menor o igual a <code>max_open</code>. Las conexiones que excedan <code>max_lifetime</code> se cierran y reemplazan, ayudando a recuperarse de conexiones obsoletas.
</tip>

## Formatos DSN

Cada tipo de base de datos construye un DSN desde la configuración:

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

## Opciones de Base de Datos

Opciones comunes específicas de base de datos:

### PostgreSQL {id="options-postgresql"}

```yaml
options:
  sslmode: "require"      # disable, require, verify-ca, verify-full
  connect_timeout: "10"   # Timeout de conexión en segundos
  application_name: "myapp"
```

### MySQL {id="options-mysql"}

```yaml
options:
  charset: "utf8mb4"
  parseTime: "true"       # Parsear valores de tiempo a time.Time
  loc: "Local"            # Zona horaria
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

## Ejemplos

### PostgreSQL con SSL

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

### Réplica de Lectura MySQL

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

### SQLite En Memoria

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

### Configuración de Múltiples Bases de Datos

```yaml
entries:
  # Base de datos principal
  - name: users_db
    kind: db.sql.postgres
    host_env: "USERS_DB_HOST"
    port: 5432
    database: "users"
    username_env: "USERS_DB_USER"
    password_env: "USERS_DB_PASSWORD"
    lifecycle:
      auto_start: true

  # Base de datos de analíticas
  - name: analytics_db
    kind: db.sql.mysql
    host_env: "ANALYTICS_DB_HOST"
    port: 3306
    database: "analytics"
    username_env: "ANALYTICS_DB_USER"
    password_env: "ANALYTICS_DB_PASSWORD"
    lifecycle:
      auto_start: true

  # Cache local
  - name: cache
    kind: db.sql.sqlite
    file: "/var/cache/app.db"
    lifecycle:
      auto_start: true
```

## Registro en Tiempo de Ejecución

Las bases de datos pueden registrarse en tiempo de ejecución usando el [módulo registry](lua/core/registry.md), habilitando configuración dinámica de base de datos basada en el estado de la aplicación o configuración externa.

## API Lua

Consulte el [Módulo SQL](lua/storage/sql.md) para la API de operaciones de base de datos.
