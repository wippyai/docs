# Migrations

Das Modul `wippy/migration` stellt ein Datenbankmigrations-Framework bereit mit einer kleinen DSL zur Definition von Schema-Aenderungen, einem Runner, der sie entdeckt und ausfuehrt, sowie einem Bootloader, der ausstehende Migrationen fuer jede im Projekt registrierte `target_db` ausfuehrt.

Migrationen unterstuetzen SQLite, PostgreSQL und MySQL mit treiberspezifischen `up`/`down`-Implementierungen, die nebeneinander definiert werden.

## Einrichtung

Fuege das Modul deinem Projekt hinzu:

```bash
wippy add wippy/migration
wippy install
```

Deklariere die Abhaengigkeit und die Anwendungsdatenbank, auf die die Migrationen abzielen:

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

Der Migrations-Bootloader registriert sich bei `wippy/bootloader` mit Order `20`. Wenn die Anwendung startet, entdeckt er jeden Migrationseintrag in der Registry, gruppiert sie nach `meta.target_db` und fuehrt ausstehende Migrationen gegen jede Datenbank aus.

## Eine Migration definieren

Eine Migration ist ein `function.lua`-Eintrag mit `meta.type: migration`. Der Eintrag gibt eine von `migration.define(...)` erzeugte Funktion zurueck.

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
| `meta.type` | ja | Muss fuer die Erkennung `"migration"` sein |
| `meta.target_db` | ja | Registry-ID der Zieldatenbank |
| `meta.timestamp` | nein | ISO-8601-Zeitstempel zur Sortierung, wenn mehrere Migrationen dieselbe Datenbank betreffen |
| `meta.tags` | nein | Array von Tags; der Runner kann Migrationen nach Tag filtern |

Migrationen fuer eine Datenbank laufen in aufsteigender `meta.timestamp`-Reihenfolge.

## DSL

Innerhalb der an `migration.define` uebergebenen Funktion stehen drei verschachtelte Funktionen zur Verfuegung:

| Funktion | Beschreibung |
|----------|--------------|
| `migration(description, fn)` | Eine neue Migration mit menschenlesbarer Beschreibung oeffnen |
| `database(type, fn)` | Eine Implementierung fuer `"sqlite"`, `"postgres"` oder `"mysql"` deklarieren |
| `up(fn)` / `down(fn)` | Vorwaerts- und Rollback-Funktionen definieren |
| `after(fn)` | Optionaler Post-Migration-Hook (gleiche Transaktion) |

Jede `up`/`down`/`after`-Funktion erhaelt ein Transaktionsobjekt, keine Rohverbindung. Alle drei Operationen laufen in einer einzigen Transaktion, die bei Fehlern zurueckgerollt wird.

### Transaktionsmethoden

```lua
local rows, err  = db:query(sql, params)    -- SELECT, returns array of rows
local result, err = db:execute(sql, params) -- INSERT/UPDATE/DDL, returns { rows_affected, last_insert_id }
local stmt, err  = db:prepare(sql)          -- prepared statement
```

Verwende stets parametrisierte Abfragen:

```lua
db:execute("INSERT INTO users (name, email) VALUES (?, ?)", { "Alice", "alice@example.com" })
```

### Fehlerbehandlung

Ein Aufruf von `error(...)` bricht die Migration ab und rollt die Transaktion zurueck. Umhuelle jedes Statement, das fehlschlagen kann:

```lua
up(function(db)
    local _, err = db:execute("CREATE TABLE ...")
    if err then error(err) end
end)
```

## Runner-API

Der Runner wird als Bibliothek fuer die programmatische Nutzung bereitgestellt:

```yaml
imports:
  runner: wippy.migration:runner
```

```lua
local runner = require("runner").setup("app:app_db")

local result = runner:run()      -- apply all pending migrations
local result = runner:run_next() -- apply the next pending migration
local result = runner:rollback({ id = "app:01_create_users_table" })
local status = runner:status()   -- list applied + pending migrations
```

### `runner:run(options)`

Wendet jede ausstehende Migration fuer die konfigurierte Datenbank an. Gibt eine Zusammenfassung zurueck:

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
| `tags` | Array von Tags; nur Migrationen, deren `meta.tags` sich schneiden, werden beruecksichtigt |

### `runner:rollback(options)`

Rollt eine einzelne Migration per ID zurueck (erforderlich):

```lua
runner:rollback({ id = "app:01_create_users_table" })
```

### `runner:status(options)`

Gibt `{ applied = {...}, pending = {...} }` zurueck, sortiert nach `applied_at` bzw. `meta.timestamp`.

## Registry-API

`wippy.migration:registry` bietet direkte Registry-Abfragen:

| Funktion | Beschreibung |
|----------|--------------|
| `registry.find({ target_db, tags })` | Alle Migrationseintraege zurueckgeben, die den Kriterien entsprechen |
| `registry.get(id)` | Einen einzelnen Migrationseintrag per ID zurueckgeben |
| `registry.get_target_dbs()` | Jede eindeutige `meta.target_db` zurueckgeben, die in Migrationen vorkommt |
| `registry.get_tags()` | Jeden eindeutigen Tag zurueckgeben, der in Migrationen vorkommt |

Der Bootloader verwendet diese, um beim Start die vollstaendige Menge an Zieldatenbanken zu entdecken.

## Migrations-Tracking

Der Runner erzeugt bei der ersten Ausfuehrung in jeder Zieldatenbank eine Tabelle `wippy_migrations`. Angewendete Migrationen werden per ID aufgezeichnet, sodass nachfolgende Laeufe sie ueberspringen. Die Tracking-Tabelle wird automatisch erzeugt; schreibe keine eigene Migration, um sie anzulegen.

## Best Practices

- **Eine logische Aenderung pro Migration** - eine Tabelle anlegen, eine Spalte hinzufuegen, einen Index erstellen.
- **Ein echtes `down` schreiben** - wenn ein Rollback unmoeglich ist (Datenverlust), dokumentiere das und wirf einen Fehler, anstatt stillschweigend Erfolg zurueckzumelden.
- **Idempotenz bevorzugen** - `CREATE TABLE IF NOT EXISTS` und `DROP TABLE IF EXISTS` ueberstehen wiederholte Ausfuehrungen ohne besondere Behandlung.
- **DDL und DML trennen** - vermeide es nach Moeglichkeit, Daten in derselben Migration zu seeden, die eine Tabelle anlegt.
- **Beide Richtungen testen** - wende die Migration an, rolle sie zurueck und verifiziere, dass das Schema dem Ausgangszustand entspricht.

## Siehe auch

- [SQL-Treiber](../system/database.md) - Konfiguration der Datenbank-Ressource
- [Bootloader](../system/bootloader.md) - Bootloader-Reihenfolge und Hooks
- [Framework-Uebersicht](overview.md) - Nutzung der Framework-Module
