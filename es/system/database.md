---
title: "Sistema de Base de Datos"
description: "Pool de conexiones y configuración de bases de datos SQL. Soporta PostgreSQL, MySQL y SQLite."
---

# Sistema de Base de Datos

Wippy proporciona entradas SQL con pool de conexiones para PostgreSQL y MySQL, además de una entrada SQLite de una sola conexión.

Esta página es una referencia de configuración. Salvo que un fence incluya `version`, `namespace` y `entries`, trátelo como un fragmento para colocarlo dentro de una lista de entradas existente.

## Tipos de Entrada

| Tipo | Descripción |
|------|-------------|
| `db.sql.postgres` | Base de datos PostgreSQL |
| `db.sql.mysql` | Base de datos MySQL |
| `db.sql.sqlite` | Base de datos SQLite |

## Configuración

### Bases de Datos Estándar (PostgreSQL, MySQL)

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
    password: ${env:app.secrets:db_password}
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
      max_lifetime: "1h"
    lifecycle:
      auto_start: true
```

<note>
SQLite siempre funciona con una sola conexión (<code>max_open</code> y <code>max_idle</code> se fuerzan a <code>1</code>) y con el modo de journal <code>WAL</code>. De <code>pool</code> solo se aplica <code>max_lifetime</code>.
</note>

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
| `pool` | object | Solo se aplica `max_lifetime` (las conexiones se fijan en 1) |
| `options` | map | Se acepta pero se ignora |
| `lifecycle` | object | Configuración de ciclo de vida |

### Secretos y valores de entorno

Obtenga los valores de conexión del [registro de entorno](./env.md) con marcadores `${env:NAME}`, resueltos al decodificarse. `NAME` es el nombre público de una variable registrada o su ID de entrada (por ejemplo, `app.secrets:db_password`); no es una variable de entorno sin procesar del sistema operativo.

```yaml
- name: prod_db
  kind: db.sql.postgres
  host: ${env:DB_HOST}
  port: ${env:DB_PORT|5432}
  database: ${env:DB_NAME}
  username: ${env:DB_USER}
  password: ${env:app.secrets:db_password}
```

<note>
Las configuraciones antiguas usan una directiva hermana <code>&lt;field&gt;_env</code> (<code>host_env</code>, <code>port_env</code>, <code>database_env</code>, <code>username_env</code>, <code>password_env</code>) que se resuelve del mismo modo. Esta forma está <b>obsoleta</b>: migre al marcador <code>${env:NAME}</code> mostrado arriba.
</note>

<warning>
Evite escribir contraseñas directamente en la configuración. Use entradas <code>env.variable</code> para las credenciales. Consulte <a href="./env.md">Entorno</a> para configurar secretos.
</warning>

## Pool de Conexiones

Configure el comportamiento del pool de conexiones. La configuración del pool se mapea al [pool de conexiones de database/sql](https://pkg.go.dev/database/sql#DB.SetMaxOpenConns) de Go.

| Campo | Tipo | Por Defecto | Descripción |
|-------|------|---------|-------------|
| `max_open` | int | 0 | Conexiones máximas abiertas (0 = ilimitado) |
| `max_idle` | int | 0 | Máximo de conexiones inactivas (0 = no conservar conexiones inactivas) |
| `max_lifetime` | duration | 1h | Tiempo de vida máximo de conexión |

```yaml
pool:
  max_open: 25      # Limit concurrent connections
  max_idle: 5       # Keep 5 connections ready
  max_lifetime: "30m"  # Recycle connections every 30 minutes
```

<tip>
Establezca <code>max_idle</code> menor o igual a <code>max_open</code>. Las conexiones que excedan <code>max_lifetime</code> se cierran y reemplazan, ayudando a recuperarse de conexiones obsoletas.
</tip>

## Formatos DSN

Cada tipo de base de datos construye un DSN desde la configuración. Las `options` se añaden ordenadas por clave; ninguna se incluye de forma predeterminada.

### PostgreSQL {id="dsn-postgresql"}

```
host=host port=port user=username password=password dbname=database [option=value ...]
```

### MySQL {id="dsn-mysql"}

```
username:password@tcp(host:port)/database[?option=value&...]
```

### SQLite {id="dsn-sqlite"}

```
file:/path/to/database.db?mode=rwc
:memory:
```

## Opciones de Base de Datos

Opciones comunes específicas de base de datos:

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

SQLite no aplica el mapa `options` a su DSN. Las bases de datos en archivo siempre se abren con `mode=rwc` y el modo de journal siempre se configura como `WAL`. El campo `options` se acepta pero se ignora.

## Ejemplos

### PostgreSQL con SSL

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

### Réplica de Lectura MySQL

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

### SQLite En Memoria

```yaml
- name: test_db
  kind: db.sql.sqlite
  file: ":memory:"
```

### Configuración de Múltiples Bases de Datos

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

## Registro en Tiempo de Ejecución

Las bases de datos pueden registrarse en tiempo de ejecución mediante el [módulo registry](../lua/core/registry.md).

## API Lua

Consulte el [módulo SQL](../lua/storage/sql.md) para las operaciones de consulta, transacción y conexión.

## Ver También

- [Módulo SQL](../lua/storage/sql.md) - Referencia de la API Lua
- [Store](./store.md) - Almacén clave-valor respaldado por una base de datos `db.sql.*`
- [Queue](./queue.md) - Handler de cola respaldado por SQL
