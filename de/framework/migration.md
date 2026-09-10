---
title: "Migrations"
description: "Das Modul wippy/migration stellt ein Datenbankmigrations-Framework bereit mit einer kleinen DSL zur Definition von Schema-Änderungen, einem Runner,…"
---

# Migrations

Das Modul `wippy/migration` stellt ein Datenbankmigrations-Framework bereit mit einer kleinen DSL zur Definition von Schema-Änderungen, einem Runner, der sie entdeckt und ausführt, sowie einem Bootloader, der ausstehende Migrationen für jede im Projekt registrierte `target_db` ausführt.

Migrationen unterstützen SQLite, PostgreSQL und MySQL mit treiberspezifischen `up`/`down`-Implementierungen, die nebeneinander definiert werden.

## Einrichtung

Füge das Modul deinem Projekt hinzu:

```bash
wippy add wippy/migration
wippy install
```

Deklariere die Abhängigkeit und die Anwendungsdatenbank, auf die die Migrationen abzielen:

```yaml
version: "1.0"
namespace: app

entries:
  - name: app_db
    kind: db.sql.sqlite
    path: ./data/app.db

  - name: dep.migration
    kind: ns.dependency
    component: wippy/migration
    version: "*"
```

Der Migrations-Bootloader registriert sich bei `wippy/bootloader` mit Order `20`. Wenn die Anwendung startet, entdeckt er jeden Migrationseintrag in der Registry, gruppiert sie nach `meta.target_db` und führt ausstehende Migrationen gegen jede Datenbank aus.

## Eine Migration definieren

Eine Migration ist ein `function.lua`-Eintrag mit `meta.type: migration`. Der Eintrag gibt eine von `migration.define(...)` erzeugte Funktion zurück.

```yaml
entries:
  - name: 01_create_users_table
    kind: function.lua
    meta:
      type: migration
      target_db: app:app_db
      timestamp: "2025-01-15T10:00:00Z"
    source: file://01_create_users_table.lua
    imports:
      migration: wippy.migration:migration
```

```lua
return require("migration").define(function()
    migration("Create users table", function()
        database("sqlite", function()
            up(function(db)
                local ok, err = db:execute([[
                    CREATE TABLE users (
                        id    INTEGER PRIMARY KEY,
                        name  TEXT NOT NULL,
                        email TEXT NOT NULL UNIQUE
                    )
                ]])
                if err then error(err) end
            end)

            down(function(db)
                db:execute("DROP TABLE IF EXISTS users")
            end)
        end)

        database("postgres", function()
            up(function(db)
                db:execute([[
                    CREATE TABLE users (
                        id    SERIAL PRIMARY KEY,
                        name  TEXT NOT NULL,
                        email TEXT NOT NULL UNIQUE
                    )
                ]])
            end)

            down(function(db)
                db:execute("DROP TABLE IF EXISTS users")
            end)
        end)
    end)
end)
```

### Erforderliche Metadaten

| Feld | Erforderlich | Beschreibung |
|------|--------------|--------------|
| `meta.type` | ja | Muss für die Erkennung `"migration"` sein |
| `meta.target_db` | ja | Registry-ID der Zieldatenbank |
| `meta.timestamp` | nein | ISO-8601-Zeitstempel zur Sortierung, wenn mehrere Migrationen dieselbe Datenbank betreffen |
| `meta.tags` | nein | Array von Tags; der Runner kann Migrationen nach Tag filtern |

Migrationen für eine Datenbank laufen in aufsteigender `meta.timestamp`-Reihenfolge. `meta.timestamp` ist optional; die vollständige Entry-ID entscheidet bei Gleichstand, sodass Migrationen mit gleichem oder fehlendem Zeitstempel dennoch in stabiler, deterministischer Reihenfolge laufen.

## DSL

Innerhalb der an `migration.define` übergebenen Funktion stehen die folgenden verschachtelten Funktionen zur Verfügung:

| Funktion | Beschreibung |
|----------|--------------|
| `migration(description, fn)` | Eine neue Migration mit menschenlesbarer Beschreibung öffnen |
| `database(type, fn)` | Eine Implementierung für `"sqlite"`, `"postgres"` oder `"mysql"` deklarieren |
| `up(fn)` / `down(fn)` | Vorwärts- und Rollback-Funktionen definieren |
| `after(fn)` | Optionaler Post-Migration-Hook (gleiche Transaktion) |

Jede `up`/`down`/`after`-Funktion erhält ein Transaktionsobjekt, keine Rohverbindung. Alle drei Operationen laufen in einer einzigen Transaktion, die bei Fehlern zurückgerollt wird.

### Transaktionsmethoden

```lua
local rows, err  = db:query(sql, params)    -- SELECT, gibt ein Array von Zeilen zurück
local result, err = db:execute(sql, params) -- INSERT/UPDATE/DDL, gibt { rows_affected, last_insert_id } zurück
local stmt, err  = db:prepare(sql)          -- Prepared Statement
```

Verwende stets parametrisierte Abfragen:

```lua
db:execute("INSERT INTO users (name, email) VALUES (?, ?)", { "Alice", "alice@example.com" })
```

### Fehlerbehandlung

Ein Aufruf von `error(...)` bricht die Migration ab und rollt die Transaktion zurück. Umhülle jedes Statement, das fehlschlagen kann:

```lua
up(function(db)
    local _, err = db:execute("CREATE TABLE ...")
    if err then error(err) end
end)
```

## Runner-API

Der Runner wird als Bibliothek für die programmatische Nutzung bereitgestellt:

```yaml
imports:
  runner: wippy.migration:runner
```

```lua
local runner = require("runner").setup("app:app_db")

local result = runner:run()      -- alle ausstehenden Migrationen anwenden
local result = runner:run_next() -- die nächste ausstehende Migration anwenden
local result = runner:rollback() -- die zuletzt angewendete Migration zurückrollen
local status = runner:status()   -- angewendete und ausstehende Migrationen auflisten
```

### `runner:run(options)`

Wendet jede ausstehende Migration für die konfigurierte Datenbank an. Gibt eine Zusammenfassung zurück:

```lua
{
    status = "complete",            -- "complete" oder "error"
    migrations_found = 3,
    migrations_applied = 2,
    migrations_skipped = 1,
    migrations_failed = 0,
    duration = 0.123,
    migrations = { ... },           -- Status je Migration
    skipped_details = { ... },
}
```

Optionen:

| Option | Beschreibung |
|--------|--------------|
| `tags` | Array von Tags; nur Migrationen, deren `meta.tags` sich schneiden, werden berücksichtigt |

### `runner:rollback(options)`

Rollt angewendete Migrationen in umgekehrter Reihenfolge ihrer Anwendung zurück. Ohne Optionen wird genau die zuletzt angewendete Migration rückgängig gemacht:

```lua
runner:rollback()                                            -- die letzte Migration zurückrollen
runner:rollback({ count = 3 })                               -- die letzten 3 zurückrollen
runner:rollback({ allowed_ids = { "app:01_create_users_table" } }) -- auf bestimmte IDs beschränken
```

Optionen:

| Option | Beschreibung |
|--------|--------------|
| `count` | Anzahl der zurückzurollenden Migrationen; Standardwert ist `1` |
| `allowed_ids` | Array von Migrations-IDs; nur diese kommen für ein Rollback in Frage |

### `runner:status(options)`

Gibt einen Statusbericht zurück, der jede Migration der Datenbank beschreibt:

```lua
{
    database_id        = "app:app_db",
    db_type            = "sqlite",
    total_migrations   = 3,
    applied_migrations = 2,
    pending_migrations = 1,
    migrations = {
        { id = "app:01_...", description = "...", timestamp = "...",
          tags = {}, status = "applied", applied_at = ... },
        -- ...
    },
}
```

Angewendete Migrationen werden zuerst aufgelistet (sortiert nach `applied_at`), gefolgt von den ausstehenden (sortiert nach `meta.timestamp`, dann nach ID).

## Registry-API

`wippy.migration:registry` bietet direkte Registry-Abfragen:

| Funktion | Beschreibung |
|----------|--------------|
| `registry.find({ target_db, tags })` | Alle Migrationseinträge zurückgeben, die den Kriterien entsprechen |
| `registry.get(id)` | Einen einzelnen Migrationseintrag per ID zurückgeben |
| `registry.get_target_dbs()` | Jede eindeutige `meta.target_db` zurückgeben, die in Migrationen vorkommt |
| `registry.get_tags()` | Jeden eindeutigen Tag zurückgeben, der in Migrationen vorkommt |

Der Bootloader verwendet diese, um beim Start die vollständige Menge an Zieldatenbanken zu entdecken.

## Migrations-Tracking

Der Runner erzeugt bei der ersten Ausführung in jeder Zieldatenbank eine Tabelle `_migrations`. Angewendete Migrationen werden per ID aufgezeichnet, sodass nachfolgende Läufe sie überspringen. Die Tracking-Tabelle wird automatisch erzeugt; schreibe keine eigene Migration, um sie anzulegen.

## Best Practices

- **Eine logische Änderung pro Migration** - eine Tabelle anlegen, eine Spalte hinzufügen, einen Index erstellen.
- **Ein echtes `down` schreiben** - wenn ein Rollback unmöglich ist (Datenverlust), dokumentiere das und wirf einen Fehler, anstatt stillschweigend Erfolg zurückzumelden.
- **Idempotenz bevorzugen** - `CREATE TABLE IF NOT EXISTS` und `DROP TABLE IF EXISTS` überstehen wiederholte Ausführungen ohne besondere Behandlung.
- **DDL und DML trennen** - vermeide es nach Möglichkeit, Daten in derselben Migration zu seeden, die eine Tabelle anlegt.
- **Beide Richtungen testen** - wende die Migration an, rolle sie zurück und verifiziere, dass das Schema dem Ausgangszustand entspricht.

## Siehe auch

- [SQL-Treiber](system/database.md) - Konfiguration der Datenbank-Ressource
- [Bootloader](framework/bootloader.md) - Bootloader-Reihenfolge und Hooks
- [Framework-Übersicht](framework/overview.md) - Nutzung der Framework-Module
