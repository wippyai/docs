---
title: "Sistema de Base de Datos"
description: "Pool de conexiones y configuración de bases de datos SQL. Soporta PostgreSQL, MySQL y SQLite."
---

# Sistema de Base de Datos

Pool de conexiones y configuración de bases de datos SQL. Soporta PostgreSQL, MySQL y SQLite.

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
    file: "/var/data/cache.db"  # Use :memory: para bases de datos en memoria
    pool:
      max_open: 4
      max_idle: 2
      max_lifetime: "1h"
    lifecycle:
      auto_start: true
```

<note>
Una base de datos SQLite privada en memoria (<code>file: ":memory:"</code>) está limitada a una sola conexión física, por lo que <code>max_open</code> y <code>max_idle</code> se fuerzan a <code>1</code>. Una base de datos respaldada por archivo respeta la configuración de <code>pool</code> establecida, que una transacción de lectura de snapshot CDC necesita para no consumir la única conexión de escritura. El modo de journal siempre es <code>WAL</code>.
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

| Campo | Tipo | Por Defecto | Descripción |
|-------|------|-------------|-------------|
| `file` | string | requerido | Ruta del archivo de base de datos o `:memory:` |
| `pool` | object | - | Configuración del pool de conexiones; `max_open` y `max_idle` se fuerzan a `1` para `:memory:` |
| `max_mutation_changes` | int | 100000 | Filas que una transacción puede retener en el observador de mutaciones confirmadas |
| `max_mutation_bytes` | int | 67108864 | Bytes lógicos que una transacción puede retener en el observador (64 MiB) |
| `options` | map | - | Aceptado pero ignorado |
| `lifecycle` | object | - | Configuración de ciclo de vida |

`max_mutation_changes` y `max_mutation_bytes` acotan el observador en memoria de mutaciones confirmadas que alimenta una fuente [`db.cdc.sqlite`](system/cdc.md). Cero en cualquiera de los campos selecciona el valor por defecto; los valores negativos se rechazan. Los límites son conservadores en lugar de exactos: SQLite entrega una fila completa al hook pre-update, por lo que una fila puede materializarse antes de que el límite rechace la candidata.

### Valores de Secretos y de Entorno

Obtenga valores de conexión del [registro de entorno](system/env.md) con placeholders `${env:NAME}`, resueltos en tiempo de decodificación. `NAME` es el nombre público de una variable registrada o su ID de entrada (ej. `app.secrets:db_password`); no es una variable de entorno cruda del SO.

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
Las configuraciones antiguas usan una directiva hermana <code>&lt;campo&gt;_env</code> (<code>host_env</code>, <code>port_env</code>, <code>database_env</code>, <code>username_env</code>, <code>password_env</code>) que se resuelve de la misma forma. Esta forma está <b>obsoleta</b> — mígrela al placeholder <code>${env:NAME}</code> mostrado arriba.
</note>

<warning>
Evite codificar contraseñas en la configuración. Use entradas <code>env.variable</code> para credenciales. Consulte <a href="system/env.md">Entorno</a> para gestión segura de secretos.
</warning>

## Pool de Conexiones

Configure el comportamiento del pool de conexiones. La configuración del pool se mapea al [pool de conexiones de database/sql](https://pkg.go.dev/database/sql#DB.SetMaxOpenConns) de Go.

| Campo | Tipo | Por Defecto | Descripción |
|-------|------|---------|-------------|
| `max_open` | int | 0 | Conexiones máximas abiertas (0 = ilimitado) |
| `max_idle` | int | 0 | Conexiones máximas inactivas (0 = no se retienen conexiones inactivas) |
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

Cada tipo de base de datos construye un DSN desde la configuración. Cualquier `options` se añade (ordenado por clave); ninguna se incluye por defecto.

### PostgreSQL {id="dsn-postgresql"}

```
host='host' port=port user='username' password='password' dbname='database' [option='value' ...]
```

Todos los valores excepto el puerto van entre comillas simples, y los caracteres `'` y `\` incrustados se escapan con barra invertida, de modo que hosts, contraseñas y valores de opciones que contengan espacios o comillas se transmiten intactos.

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

SQLite no aplica el mapa `options` a su DSN. Las bases de datos en archivo siempre se abren con `mode=rwc`, y el modo de journal siempre se establece en `WAL`. El campo `options` se acepta pero se ignora.

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
  # Base de datos principal
  - name: users_db
    kind: db.sql.postgres
    host: ${env:USERS_DB_HOST}
    port: 5432
    database: "users"
    username: ${env:USERS_DB_USER}
    password: ${env:app.secrets:users_db_password}
    lifecycle:
      auto_start: true

  # Base de datos de analíticas
  - name: analytics_db
    kind: db.sql.mysql
    host: ${env:ANALYTICS_DB_HOST}
    port: 3306
    database: "analytics"
    username: ${env:ANALYTICS_DB_USER}
    password: ${env:app.secrets:analytics_db_password}
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

## Ver También

- [Módulo SQL](lua/storage/sql.md) - Referencia de la API Lua
- [Store](system/store.md) - Almacén clave-valor respaldado por una base de datos `db.sql.*`
- [Queue](system/queue.md) - Handler de cola respaldado por SQL
- [Change Data Capture](system/cdc.md) - Transmisión de cambios a nivel de fila desde una base de datos `db.sql.sqlite` o Postgres
