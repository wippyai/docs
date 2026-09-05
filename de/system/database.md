---
title: "Datenbanksystem"
description: "SQL-Datenbankverbindungs-Pooling und Konfiguration. Unterstützt PostgreSQL, MySQL und SQLite."
---

# Datenbanksystem

SQL-Datenbankverbindungs-Pooling und Konfiguration. Unterstützt PostgreSQL, MySQL und SQLite.

## Entry-Typen

| Kind | Beschreibung |
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
      max_open: 4
      max_idle: 2
      max_lifetime: "1h"
    lifecycle:
      auto_start: true
```

<note>
Eine private In-Memory-SQLite-Datenbank (<code>file: ":memory:"</code>) ist auf eine physische Verbindung beschränkt, daher werden <code>max_open</code> und <code>max_idle</code> auf <code>1</code> gesetzt. Eine dateibasierte Datenbank berücksichtigt die konfigurierten <code>pool</code>-Einstellungen, was eine CDC-Snapshot-Lesetransaktion benötigt, damit sie nicht die einzige Schreibverbindung belegt. Der Journal-Modus ist immer <code>WAL</code>.
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

| Feld | Typ | Standard | Beschreibung |
|------|-----|----------|--------------|
| `file` | string | erforderlich | Datenbankdateipfad oder `:memory:` |
| `pool` | object | - | Connection-Pool-Einstellungen; `max_open` und `max_idle` werden für `:memory:` auf `1` gesetzt |
| `max_mutation_changes` | int | 100000 | Zeilen, die eine Transaktion im Beobachter für committete Mutationen halten darf |
| `max_mutation_bytes` | int | 67108864 | Logische Bytes, die eine Transaktion im Beobachter halten darf (64 MiB) |
| `options` | map | - | Akzeptiert, aber ignoriert |
| `lifecycle` | object | - | Lebenszyklus-Konfiguration |

`max_mutation_changes` und `max_mutation_bytes` begrenzen den In-Memory-Beobachter für committete Mutationen, der eine [`db.cdc.sqlite`](system/cdc.md)-Quelle speist. Null bei einem der Felder wählt den Standardwert; negative Werte werden abgelehnt. Die Grenzen sind konservativ statt exakt: SQLite liefert eine vollständige Zeile an den Pre-Update-Hook, sodass eine Zeile materialisiert werden kann, bevor die Grenze den Kandidaten ablehnt.

### Geheimnis- und Umgebungswerte

Hole Verbindungswerte über `${env:NAME}`-Platzhalter aus der [Umgebungs-Registry](system/env.md); sie werden beim Dekodieren aufgelöst. `NAME` ist der öffentliche Name einer registrierten Variable oder deren Entry-ID (z. B. `app.secrets:db_password`); es ist keine rohe Betriebssystem-Umgebungsvariable.

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
Ältere Konfigurationen verwenden eine benachbarte <code>&lt;field&gt;_env</code>-Direktive (<code>host_env</code>, <code>port_env</code>, <code>database_env</code>, <code>username_env</code>, <code>password_env</code>), die auf dieselbe Weise aufgelöst wird. Diese Form ist <b>veraltet</b> — migriere sie auf den oben gezeigten <code>${env:NAME}</code>-Platzhalter.
</note>

<warning>
Vermeiden Sie das Hardcodieren von Passwörtern in der Konfiguration. Verwenden Sie <code>env.variable</code>-Einträge für Anmeldedaten. Siehe <a href="system/env.md">Umgebung</a> für sicheres Geheimnis-Management.
</warning>

## Connection-Pool

Konfigurieren Sie das Connection-Pooling-Verhalten. Pool-Einstellungen werden auf Gos [database/sql Connection-Pool](https://pkg.go.dev/database/sql#DB.SetMaxOpenConns) abgebildet.

| Feld | Typ | Standard | Beschreibung |
|------|-----|----------|--------------|
| `max_open` | int | 0 | Maximale offene Verbindungen (0 = unbegrenzt) |
| `max_idle` | int | 0 | Maximale untätige Verbindungen (0 = keine untätigen Verbindungen werden gehalten) |
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

Jeder Datenbanktyp konstruiert einen DSN aus der Konfiguration. Etwaige `options` werden angehängt (nach Schlüssel sortiert); standardmäßig ist keine enthalten.

### PostgreSQL {id="dsn-postgresql"}

```
host='host' port=port user='username' password='password' dbname='database' [option='value' ...]
```

Jeder Wert außer dem Port wird in einfache Anführungszeichen gesetzt, und eingebettete `'` und `\` werden mit Backslash escaped, sodass Hosts, Passwörter und Optionswerte mit Leerzeichen oder Anführungszeichen unverändert durchgereicht werden.

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

SQLite wendet die `options`-Map nicht auf seinen DSN an. Dateidatenbanken öffnen immer mit `mode=rwc`, und der Journal-Modus ist immer auf `WAL` gesetzt. Das `options`-Feld wird akzeptiert, aber ignoriert.

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
  # Primäre Datenbank
  - name: users_db
    kind: db.sql.postgres
    host: ${env:USERS_DB_HOST}
    port: 5432
    database: "users"
    username: ${env:USERS_DB_USER}
    password: ${env:app.secrets:users_db_password}
    lifecycle:
      auto_start: true

  # Analytics-Datenbank
  - name: analytics_db
    kind: db.sql.mysql
    host: ${env:ANALYTICS_DB_HOST}
    port: 3306
    database: "analytics"
    username: ${env:ANALYTICS_DB_USER}
    password: ${env:app.secrets:analytics_db_password}
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

## Siehe auch

- [SQL-Modul](lua/storage/sql.md) - Lua-API-Referenz
- [Store](system/store.md) - Key-Value-Store auf Basis einer `db.sql.*`-Datenbank
- [Queue](system/queue.md) - SQL-gestützter Queue-Handler
- [Change Data Capture](system/cdc.md) - Zeilenweise Änderungen aus einer `db.sql.sqlite`- oder Postgres-Datenbank streamen
