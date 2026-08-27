---
title: "Migrationen"
description: "Geordnete Datenbankmigrationen für SQLite, PostgreSQL und MySQL definieren, anwenden, prüfen und zurückrollen."
---

# Migrationen

Das Modul `wippy/migration` stellt eine DSL für Schemaänderungen, einen Runner zum
Entdecken und Ausführen von Migrationen sowie einen Bootloader bereit, der ausstehende
Migrationen auf jede registrierte `target_db` anwendet.

Migrationen unterstützen SQLite, PostgreSQL und MySQL. Treiberspezifische
`up`- und `down`-Implementierungen können gemeinsam definiert werden.

Diese Seite ist ein Teilrezept für Migrationen und eine Runner-Referenz, keine
vollständige Anwendung. Die Definition lässt sich anpassen, nachdem Modul und
Datenbank verbunden wurden; spätere Runner-Aufrufe und Ergebnistabellen sind
Referenz-Snippets. Erstellen Sie vor Migrationen schützenswerter Daten ein Backup und
testen Sie `up` und `down` zunächst gegen eine temporäre Datenbank.

## Einrichtung

Fügen Sie das Modul zum Projekt hinzu:

```bash
wippy add wippy/migration
wippy install
```

Deklarieren Sie die Abhängigkeit und die Anwendungsdatenbank, auf die sich die
Migrationen beziehen:

```yaml
version: "1.0"
namespace: app

entries:
  - name: app_db
    kind: db.sql.sqlite
    file: ./data/app.db

  - name: dep.migration
    kind: ns.dependency
    component: wippy/migration
    version: "*"
```

Der Migrations-Bootloader registriert sich bei `wippy/bootloader` mit der Reihenfolge
`20`. Beim Anwendungsstart entdeckt er alle Migrationseinträge in der Registry,
gruppiert sie nach `meta.target_db` und führt die ausstehenden Migrationen auf jeder
Datenbank aus.

Wenn Sie den gezeigten relativen SQLite-Pfad verwenden, erstellen Sie vor dem Start
das Verzeichnis `data`. Prüfen Sie das Ergebnis mit `runner:status()` und verwenden
Sie `runner:rollback()` nur, wenn die `down`-Implementierung für die Testdaten sicher ist.

## Eine Migration definieren

Eine Migration ist ein `function.lua`-Eintrag mit `meta.type: migration`. Der Eintrag
gibt eine von `migration.define(...)` erzeugte Funktion zurück.

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
                local _, err = db:execute([[
                    CREATE TABLE users (
                        id    INTEGER PRIMARY KEY,
                        name  TEXT NOT NULL,
                        email TEXT NOT NULL UNIQUE
                    )
                ]])
                if err then error(err) end
            end)

            down(function(db)
                local _, err = db:execute("DROP TABLE IF EXISTS users")
                if err then error(err) end
            end)
        end)

        database("postgres", function()
            up(function(db)
                local _, err = db:execute([[
                    CREATE TABLE users (
                        id    SERIAL PRIMARY KEY,
                        name  TEXT NOT NULL,
                        email TEXT NOT NULL UNIQUE
                    )
                ]])
                if err then error(err) end
            end)

            down(function(db)
                local _, err = db:execute("DROP TABLE IF EXISTS users")
                if err then error(err) end
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

Migrationen für eine Datenbank laufen in aufsteigender Reihenfolge von
`meta.timestamp`. Das Feld ist optional; bei gleichem oder fehlendem Zeitstempel dient
die vollständige Eintrags-ID als Tie-Breaker und sorgt für eine stabile,
deterministische Reihenfolge.

## DSL

Innerhalb der an `migration.define` übergebenen Funktion stehen die folgenden
verschachtelten Funktionen bereit:

| Funktion | Beschreibung |
|----------|--------------|
| `migration(description, fn)` | Eine neue Migration mit menschenlesbarer Beschreibung öffnen |
| `database(type, fn)` | Eine Implementierung für `"sqlite"`, `"postgres"` oder `"mysql"` deklarieren |
| `up(fn)` / `down(fn)` | Vorwärts- und Rollback-Funktionen definieren |
| `after(fn)` | Optionaler Post-Migration-Hook (gleiche Transaktion) |

Jede `up`-, `down`- und `after`-Funktion erhält ein Transaktionsobjekt statt einer
Rohverbindung. Alle drei Operationen laufen in einer gemeinsamen Transaktion, die bei
einem Fehler zurückgerollt wird.

### Transaktionsmethoden

```lua
local rows, err  = db:query(sql, params)    -- SELECT, returns array of rows
local result, err = db:execute(sql, params) -- INSERT/UPDATE/DDL, returns { rows_affected, last_insert_id }
local stmt, err  = db:prepare(sql)          -- prepared statement
```

Verwenden Sie stets parametrisierte Abfragen:

```lua
db:execute("INSERT INTO users (name, email) VALUES (?, ?)", { "Alice", "alice@example.com" })
```

### Fehlerbehandlung

Ein Aufruf von `error(...)` bricht die Migration ab und rollt die Transaktion zurück.
Prüfen Sie jede Anweisung, die fehlschlagen kann:

```lua
up(function(db)
    local _, err = db:execute("CREATE TABLE ...")
    if err then error(err) end
end)
```

## Runner-API

Der Runner steht als Bibliothek für die programmatische Verwendung bereit:

```yaml
imports:
  runner: wippy.migration:runner
```

```lua
local runner = require("runner").setup("app:app_db")

local result = runner:run()      -- apply all pending migrations
local result = runner:run_next() -- apply the next pending migration
local result = runner:rollback() -- roll back the most recently applied migration
local status = runner:status()   -- list applied + pending migrations
```

### `runner:run(options)`

Wendet alle ausstehenden Migrationen der konfigurierten Datenbank an und gibt eine
Zusammenfassung zurück:

```lua
{
    status = "complete",            -- "complete" or "error"
    migrations_found = 3,
    migrations_applied = 2,
    migrations_skipped = 1,
    migrations_failed = 0,
    duration = 0.123,
    migrations = { ... },           -- per-migration status
    skipped_details = { ... },
}
```

Optionen:

| Option | Beschreibung |
|--------|--------------|
| `tags` | Array von Tags; berücksichtigt werden nur Migrationen, deren `meta.tags` eine Schnittmenge bilden |

### `runner:rollback(options)`

Rollt angewendete Migrationen in umgekehrter Ausführungsreihenfolge zurück. Ohne
Optionen wird nur die zuletzt angewendete Migration zurückgerollt:

```lua
runner:rollback()                                            -- roll back the last migration
runner:rollback({ count = 3 })                               -- roll back the last 3
runner:rollback({ allowed_ids = { "app:01_create_users_table" } }) -- restrict to specific ids
```

Optionen:

| Option | Beschreibung |
|--------|--------------|
| `count` | Anzahl zurückzurollender Migrationen; Standard ist `1` |
| `allowed_ids` | Array von Migrations-IDs; nur diese können zurückgerollt werden |

### `runner:status(options)`

Gibt einen Statusbericht für alle Migrationen der Datenbank zurück.

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

Angewendete Migrationen erscheinen zuerst nach `applied_at`; ausstehende folgen nach
`meta.timestamp` und anschließend nach ID sortiert.

## Registry-API

`wippy.migration:registry` bietet direkte Registry-Abfragen:

| Funktion | Beschreibung |
|----------|--------------|
| `registry.find({ target_db, tags })` | Alle Migrationseinträge zurückgeben, die den Kriterien entsprechen |
| `registry.get(id)` | Einen einzelnen Migrationseintrag per ID zurückgeben |
| `registry.get_target_dbs()` | Jede eindeutige `meta.target_db` aus Migrationen zurückgeben |
| `registry.get_tags()` | Jeden eindeutigen Tag aus Migrationen zurückgeben |

Der Bootloader verwendet diese Abfragen, um beim Start alle Zieldatenbanken zu entdecken.

## Migrations-Tracking

Der Runner erstellt beim ersten Lauf in jeder Zieldatenbank die Tabelle `_migrations`.
Angewendete Migrationen werden nach ID aufgezeichnet, sodass spätere Läufe sie
überspringen. Die Tracking-Tabelle entsteht automatisch; legen Sie dafür keine eigene
Migration an.

## Best Practices

- **Eine logische Änderung pro Migration** — erstellen Sie eine Tabelle, eine Spalte oder einen Index pro Migration.
- **Ein echtes `down` schreiben** — würde ein Rollback Daten verlieren oder ist er unmöglich, dokumentieren Sie diese Einschränkung und lösen einen Fehler aus, statt Erfolg zu melden.
- **Idempotenz bevorzugen** — `CREATE TABLE IF NOT EXISTS` und `DROP TABLE IF EXISTS` tolerieren erneute Ausführungen.
- **DDL und DML trennen** — vermeiden Sie Daten-Seeding in derselben Migration, die eine Tabelle erstellt.
- **Beide Richtungen testen** — wenden Sie die Migration an, rollen Sie sie zurück und prüfen Sie, ob das Schema dem Ausgangszustand entspricht.

## Siehe auch

- [SQL-Treiber](../system/database.md) — Konfiguration der Datenbankressource
- [Bootloader](./bootloader.md) — Bootloader-Reihenfolge und Hooks
- [Framework-Übersicht](./overview.md) — Verwendung von Framework-Modulen
