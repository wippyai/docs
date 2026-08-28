---
title: "Datenbanksystem"
description: "SQL-Datenbankverbindungs-Pooling und Konfiguration. Unterstützt PostgreSQL, MySQL und SQLite."
---

# Datenbanksystem

Wippy stellt gepoolte SQL-Datenbankeinträge für PostgreSQL und MySQL sowie einen SQLite-Eintrag mit einer einzelnen Verbindung bereit.

Diese Seite ist eine Konfigurationsreferenz. Wenn ein Block nicht `version`, `namespace` und `entries` enthält, behandeln Sie ihn als Fragment für eine bestehende Entry-Liste.

## Entry-Typen

| Art | Beschreibung |
|------|--------------|
| `db.sql.postgres` | PostgreSQL-Datenbank |
| `db.sql.mysql` | MySQL-Datenbank |
| `db.sql.sqlite` | SQLite-Datenbank |

## Konfiguration

### Standard-Datenbanken (PostgreSQL, MySQL)

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
SQLite verwendet immer eine einzelne Verbindung (<code>max_open</code> und <code>max_idle</code> werden auf <code>1</code> erzwungen) sowie den Journal-Modus <code>WAL</code>. Aus <code>pool</code> wird ausschließlich <code>max_lifetime</code> angewendet.
</note>

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
| `pool` | object | Nur `max_lifetime` wird angewendet (Verbindungen sind auf 1 festgelegt) |
| `options` | map | Wird akzeptiert, aber ignoriert |
| `lifecycle` | object | Lebenszyklus-Konfiguration |

### Secrets und Umgebungswerte

Übernehmen Sie Verbindungswerte mit `${env:NAME}`-Platzhaltern aus der [Umgebungs-Registry](./env.md); sie werden beim Dekodieren aufgelöst. `NAME` ist der öffentliche Name einer registrierten Variable oder ihre Entry-ID, zum Beispiel `app.secrets:db_password`, und keine rohe OS-Umgebungsvariable.

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
Ältere Konfigurationen verwenden eine benachbarte <code>&lt;field&gt;_env</code>-Direktive (<code>host_env</code>, <code>port_env</code>, <code>database_env</code>, <code>username_env</code>, <code>password_env</code>), die auf dieselbe Weise auflöst. Diese Form ist <b>veraltet</b> — migrieren Sie sie zum oben gezeigten <code>${env:NAME}</code>-Platzhalter.
</note>

<warning>
Vermeiden Sie fest codierte Passwörter in der Konfiguration. Verwenden Sie <code>env.variable</code>-Einträge für Zugangsdaten. Siehe <a href="./env.md">Umgebung</a> für die Secret-Konfiguration.
</warning>

## Connection-Pool

Konfigurieren Sie das Connection-Pooling-Verhalten. Pool-Einstellungen werden auf den [database/sql-Connection-Pool](https://pkg.go.dev/database/sql#DB.SetMaxOpenConns) von Go abgebildet.

| Feld | Typ | Standard | Beschreibung |
|------|-----|----------|--------------|
| `max_open` | int | 0 | Maximale offene Verbindungen (0 = unbegrenzt) |
| `max_idle` | int | 0 | Maximale ungenutzte Verbindungen (0 = keine ungenutzten Verbindungen beibehalten) |
| `max_lifetime` | duration | 1h | Maximale Verbindungslebensdauer |

```yaml
pool:
  max_open: 25      # Limit concurrent connections
  max_idle: 5       # Keep 5 connections ready
  max_lifetime: "30m"  # Recycle connections every 30 minutes
```

<tip>
Setzen Sie <code>max_idle</code> kleiner oder gleich <code>max_open</code>. Verbindungen, die <code>max_lifetime</code> überschreiten, werden geschlossen und ersetzt, was bei der Wiederherstellung von veralteten Verbindungen hilft.
</tip>

## DSN-Formate

Jeder Datenbanktyp konstruiert einen DSN aus der Konfiguration. Alle `options` werden nach Schlüssel sortiert angehängt; standardmäßig werden keine hinzugefügt.

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

## Datenbankoptionen

Häufige datenbankspezifische Optionen:

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

SQLite wendet die `options`-Map nicht auf den DSN an. Dateidatenbanken werden immer mit `mode=rwc` geöffnet und der Journal-Modus wird immer auf `WAL` gesetzt. Das Feld `options` wird akzeptiert, aber ignoriert.

## Beispiele

### PostgreSQL mit SSL

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

### MySQL Read Replica

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

### SQLite In-Memory

```yaml
- name: test_db
  kind: db.sql.sqlite
  file: ":memory:"
```

### Mehrere Datenbanken Setup

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

## Laufzeitregistrierung

Datenbanken können zur Laufzeit mit dem [Registry-Modul](../lua/core/registry.md) registriert werden.

## Lua-API

Siehe [SQL-Modul](../lua/storage/sql.md) für Abfragen, Transaktionen und Verbindungsoperationen.

## Siehe auch

- [SQL-Modul](../lua/storage/sql.md) - Lua-API-Referenz
- [Store](./store.md) - Key-Value-Store auf Basis einer `db.sql.*`-Datenbank
- [Queue](./queue.md) - SQL-gestützter Queue-Handler
