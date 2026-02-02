# Datenbanksystem

SQL-Datenbankverbindungs-Pooling und Konfiguration. Unterstützt PostgreSQL, MySQL, SQLite, Microsoft SQL Server und Oracle.

## Entry-Typen

| Kind | Beschreibung |
|------|--------------|
| `db.sql.postgres` | PostgreSQL-Datenbank |
| `db.sql.mysql` | MySQL-Datenbank |
| `db.sql.sqlite` | SQLite-Datenbank |
| `db.sql.mssql` | Microsoft SQL Server |
| `db.sql.oracle` | Oracle-Datenbank |

## Konfiguration

### Standard-Datenbanken (PostgreSQL, MySQL, MSSQL, Oracle)

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
    file: "/var/data/cache.db"  # :memory: für In-Memory verwenden
    pool:
      max_open: 1
      max_idle: 1
      max_lifetime: "1h"
    options:
      cache: "shared"
    lifecycle:
      auto_start: true
```

## Verbindungsfelder

### Standard-Datenbankfelder

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `host` | string | Datenbank-Host-Adresse |
| `port` | int | Datenbank-Portnummer |
| `database` | string | Datenbankname |
| `username` | string | Datenbankbenutzer |
| `password` | string | Datenbankpasswort |
| `pool` | object | Connection-Pool-Einstellungen |
| `options` | map | Datenbankspezifische Optionen |
| `lifecycle` | object | Lebenszyklus-Konfiguration |

### SQLite-Felder

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `file` | string | Datenbankdateipfad oder `:memory:` |
| `pool` | object | Connection-Pool-Einstellungen |
| `options` | map | SQLite-spezifische Optionen |
| `lifecycle` | object | Lebenszyklus-Konfiguration |

### Umgebungsvariablen-Felder

Verwenden Sie das Suffix `_env` um Werte aus Umgebungsvariablen oder [env.variable](system/env.md)-Einträgen zu laden:

| Feld | Beschreibung |
|------|--------------|
| `host_env` | Host aus Umgebungsvariable |
| `port_env` | Port aus Umgebungsvariable |
| `database_env` | Datenbankname aus Umgebung |
| `username_env` | Benutzername aus Umgebung |
| `password_env` | Passwort aus Umgebung |

```yaml
- name: prod_db
  kind: db.sql.postgres
  host_env: "DB_HOST"
  port_env: "DB_PORT"
  database_env: "DB_NAME"
  username_env: "DB_USER"
  password_env: "app.secrets:db_password"  # Referenz auf env.variable-Eintrag
```

<warning>
Vermeiden Sie das Hardcodieren von Passwörtern in der Konfiguration. Verwenden Sie Umgebungsvariablen oder <code>env.variable</code>-Einträge für Anmeldedaten. Siehe <a href="system/env.md">Umgebung</a> für sicheres Geheimnis-Management.
</warning>

## Connection-Pool

Konfigurieren Sie das Connection-Pooling-Verhalten. Pool-Einstellungen werden auf Gos [database/sql Connection-Pool](https://pkg.go.dev/database/sql#DB.SetMaxOpenConns) abgebildet.

| Feld | Typ | Standard | Beschreibung |
|------|-----|----------|--------------|
| `max_open` | int | 0 | Maximale offene Verbindungen (0 = unbegrenzt) |
| `max_idle` | int | 0 | Maximale untätige Verbindungen (0 = unbegrenzt) |
| `max_lifetime` | duration | 1h | Maximale Verbindungslebensdauer |

```yaml
pool:
  max_open: 25      # Gleichzeitige Verbindungen begrenzen
  max_idle: 5       # 5 Verbindungen bereithalten
  max_lifetime: "30m"  # Verbindungen alle 30 Minuten recyceln
```

<tip>
Setzen Sie <code>max_idle</code> kleiner oder gleich <code>max_open</code>. Verbindungen, die <code>max_lifetime</code> überschreiten, werden geschlossen und ersetzt, was bei der Wiederherstellung von veralteten Verbindungen hilft.
</tip>

## DSN-Formate

Jeder Datenbanktyp konstruiert einen DSN aus der Konfiguration:

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

## Datenbankoptionen

Häufige datenbankspezifische Optionen:

### PostgreSQL {id="options-postgresql"}

```yaml
options:
  sslmode: "require"      # disable, require, verify-ca, verify-full
  connect_timeout: "10"   # Verbindungs-Timeout in Sekunden
  application_name: "myapp"
```

### MySQL {id="options-mysql"}

```yaml
options:
  charset: "utf8mb4"
  parseTime: "true"       # Zeitwerte zu time.Time parsen
  loc: "Local"            # Zeitzone
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

## Beispiele

### PostgreSQL mit SSL

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

### Mehrere Datenbanken Setup

```yaml
entries:
  # Primäre Datenbank
  - name: users_db
    kind: db.sql.postgres
    host_env: "USERS_DB_HOST"
    port: 5432
    database: "users"
    username_env: "USERS_DB_USER"
    password_env: "USERS_DB_PASSWORD"
    lifecycle:
      auto_start: true

  # Analytics-Datenbank
  - name: analytics_db
    kind: db.sql.mysql
    host_env: "ANALYTICS_DB_HOST"
    port: 3306
    database: "analytics"
    username_env: "ANALYTICS_DB_USER"
    password_env: "ANALYTICS_DB_PASSWORD"
    lifecycle:
      auto_start: true

  # Lokaler Cache
  - name: cache
    kind: db.sql.sqlite
    file: "/var/cache/app.db"
    lifecycle:
      auto_start: true
```

## Laufzeitregistrierung

Datenbanken können zur Laufzeit mit dem [Registry-Modul](lua/core/registry.md) registriert werden, was dynamische Datenbankkonfiguration basierend auf Anwendungszustand oder externer Konfiguration ermöglicht.

## Lua-API

Siehe [SQL-Modul](lua/storage/sql.md) für die Datenbankoperationen-API.
