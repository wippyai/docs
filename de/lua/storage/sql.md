# SQL-Datenbank
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>
<secondary-label ref="permissions"/>

Führen Sie SQL-Abfragen gegen PostgreSQL-, MySQL-, SQLite-, MSSQL- und Oracle-Datenbanken aus. Features umfassen parametrisierte Abfragen, Transaktionen, Prepared Statements und einen Fluent Query Builder.

Für Datenbankkonfiguration siehe [Datenbank](system-database.md).

## Laden

```lua
local sql = require("sql")
```

## Verbindung abrufen

Holen Sie eine Datenbankverbindung aus der Ressourcen-Registry:

```lua
local db, err = sql.get("app.db:main")
if err then
    return nil, err
end

local rows = db:query("SELECT * FROM users WHERE active = ?", {1})

db:release()
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `id` | string | Ressourcen-ID (z.B. "app.db:main") |

**Gibt zurück:** `DB, error`

<note>
Verbindungen werden automatisch an den Pool zurückgegeben, wenn die Funktion beendet wird, aber explizites Aufrufen von `db:release()` wird für lang laufende Operationen empfohlen.
</note>

## Konstanten

### Datenbanktypen

```lua
sql.type.POSTGRES    -- "postgres"
sql.type.MYSQL       -- "mysql"
sql.type.SQLITE      -- "sqlite"
sql.type.MSSQL       -- "mssql"
sql.type.ORACLE      -- "oracle"
sql.type.UNKNOWN     -- "unknown"
```

### Isolationsebenen

```lua
sql.isolation.DEFAULT           -- "default"
sql.isolation.READ_UNCOMMITTED  -- "read_uncommitted"
sql.isolation.READ_COMMITTED    -- "read_committed"
sql.isolation.WRITE_COMMITTED   -- "write_committed"
sql.isolation.REPEATABLE_READ   -- "repeatable_read"
sql.isolation.SERIALIZABLE      -- "serializable"
```

### NULL-Wert

```lua
local insert = sql.builder.insert("users")
    :columns("name", "email")
    :values("alice", sql.NULL)
```

## Typ-Konvertierung

### as.int

```lua
local value = sql.as.int(42)
```

**Gibt zurück:** `userdata`

## as.float

Konvertiert Wert zu SQL-Float-Typ.

```lua
local value = sql.as.float(19.99)
```

**Gibt zurück:** `userdata`

## as.text

Konvertiert Wert zu SQL-Text-Typ.

```lua
local value = sql.as.text("hello")
```

**Gibt zurück:** `userdata`

## as.binary

Konvertiert Wert zu SQL-Binary-Typ.

```lua
local value = sql.as.binary("binary data")
```

**Gibt zurück:** `userdata`

## as.null

Gibt SQL-NULL-Marker zurück.

```lua
local value = sql.as.null()
```

**Gibt zurück:** `userdata`

## Query Builder

### Abfragen erstellen

```lua
local query = sql.builder.select("id", "name")
    :from("users")
    :where({active = 1})
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `columns` | ...string | Spaltennamen (optional) |

**Gibt zurück:** `SelectBuilder`

## builder.insert

Erstellt INSERT Query Builder.

```lua
local query = sql.builder.insert("users")
    :columns("name", "email")
    :values("alice", "alice@example.com")
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `table` | string | Tabellenname (optional) |

**Gibt zurück:** `InsertBuilder`

## builder.update

Erstellt UPDATE Query Builder.

```lua
local query = sql.builder.update("users")
    :set("status", "active")
    :where({id = 123})
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `table` | string | Tabellenname (optional) |

**Gibt zurück:** `UpdateBuilder`

## builder.delete

Erstellt DELETE Query Builder.

```lua
local query = sql.builder.delete("users")
    :where({active = 0})
    :limit(100)
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `table` | string | Tabellenname (optional) |

**Gibt zurück:** `DeleteBuilder`

## builder.expr

Erstellt rohen SQL-Ausdruck zur Verwendung in WHERE/HAVING-Klauseln.

```lua
local expr = sql.builder.expr("score BETWEEN ? AND ?", 80, 90)
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `sql` | string | SQL-Ausdruck mit ?-Platzhaltern |
| `args` | ...any | Bind-Argumente (optional) |

**Gibt zurück:** `Sqlizer`

## builder.eq

Erstellt Gleichheitsbedingung aus Table.

```lua
local cond = sql.builder.eq({active = 1, status = "open"})
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `map` | table | {spalte = wert}-Paare |

**Gibt zurück:** `Sqlizer`

## builder.not_eq

Erstellt Ungleichheitsbedingung aus Table.

```lua
local cond = sql.builder.not_eq({status = "closed"})
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `map` | table | {spalte = wert}-Paare |

**Gibt zurück:** `Sqlizer`

## builder.lt

Erstellt Kleiner-als-Bedingung aus Table.

```lua
local cond = sql.builder.lt({age = 18})
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `map` | table | {spalte = wert}-Paare |

**Gibt zurück:** `Sqlizer`

## builder.lte

Erstellt Kleiner-gleich-Bedingung aus Table.

```lua
local cond = sql.builder.lte({price = 100})
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `map` | table | {spalte = wert}-Paare |

**Gibt zurück:** `Sqlizer`

## builder.gt

Erstellt Größer-als-Bedingung aus Table.

```lua
local cond = sql.builder.gt({score = 80})
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `map` | table | {spalte = wert}-Paare |

**Gibt zurück:** `Sqlizer`

## builder.gte

Erstellt Größer-gleich-Bedingung aus Table.

```lua
local cond = sql.builder.gte({age = 21})
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `map` | table | {spalte = wert}-Paare |

**Gibt zurück:** `Sqlizer`

## builder.like

Erstellt LIKE-Bedingung aus Table.

```lua
local cond = sql.builder.like({name = "john%"})
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `map` | table | {spalte = wert}-Paare |

**Gibt zurück:** `Sqlizer`

## builder.not_like

Erstellt NOT LIKE-Bedingung aus Table.

```lua
local cond = sql.builder.not_like({email = "%@spam.com"})
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `map` | table | {spalte = wert}-Paare |

**Gibt zurück:** `Sqlizer`

## builder.and_

Kombiniert mehrere Bedingungen mit AND.

```lua
local cond = sql.builder.and_({
    sql.builder.eq({active = 1}),
    sql.builder.gt({score = 80})
})
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `conditions` | table | Array von Sqlizer- oder Table-Bedingungen |

**Gibt zurück:** `Sqlizer`

## builder.or_

Kombiniert mehrere Bedingungen mit OR.

```lua
local cond = sql.builder.or_({
    sql.builder.eq({status = "pending"}),
    sql.builder.eq({status = "active"})
})
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `conditions` | table | Array von Sqlizer- oder Table-Bedingungen |

**Gibt zurück:** `Sqlizer`

## builder.question

Platzhalterformat für ?-Platzhalter (Standard).

```lua
local query = sql.builder.select("*")
    :from("users")
    :placeholder_format(sql.builder.question)
```

## builder.dollar

Platzhalterformat für $1, $2, ...-Platzhalter.

```lua
local query = sql.builder.select("*")
    :from("users")
    :placeholder_format(sql.builder.dollar)
```

## builder.at

Platzhalterformat für @p1, @p2, ...-Platzhalter.

```lua
local query = sql.builder.select("*")
    :from("users")
    :placeholder_format(sql.builder.at)
```

## builder.colon

Platzhalterformat für :1, :2, ...-Platzhalter.

```lua
local query = sql.builder.select("*")
    :from("users")
    :placeholder_format(sql.builder.colon)
```

## Verbindungsmethoden

Datenbankverbindungs-Handle zurückgegeben von `sql.get()`.

### db:type

Gibt Datenbanktyp-Konstante zurück.

```lua
local dbtype, err = db:type()
```

**Gibt zurück:** `string, error`

### db:query

Führt SELECT-Abfrage aus und gibt Zeilen zurück.

```lua
local rows, err = db:query("SELECT id, name FROM users WHERE active = ?", {1})
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `sql` | string | SQL-Abfrage mit ?-Platzhaltern |
| `params` | table | Array von Bind-Parametern (optional) |

**Gibt zurück:** `table[], error`

### db:execute

Führt INSERT/UPDATE/DELETE-Abfrage aus.

```lua
local result, err = db:execute("INSERT INTO users (name) VALUES (?)", {"alice"})
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `sql` | string | SQL-Anweisung mit ?-Platzhaltern |
| `params` | table | Array von Bind-Parametern (optional) |

**Gibt zurück:** `table, error`

Gibt Table mit Feldern zurück:
- `last_insert_id` - Zuletzt eingefügte ID
- `rows_affected` - Anzahl betroffener Zeilen

### db:prepare

Erstellt Prepared Statement für wiederholte Ausführung.

```lua
local stmt, err = db:prepare("SELECT * FROM users WHERE id = ?")
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `sql` | string | SQL mit ?-Platzhaltern |

**Gibt zurück:** `Statement, error`

### db:begin

Beginnt Datenbanktransaktion.

```lua
local tx, err = db:begin({
    isolation = sql.isolation.SERIALIZABLE,
    read_only = false
})
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `options` | table | Transaktionsoptionen (optional) |

Options-Table-Felder:
- `isolation` - Isolationsebene aus sql.isolation.* (Standard: DEFAULT)
- `read_only` - Nur-Lesen-Transaktions-Flag (Standard: false)

**Gibt zurück:** `Transaction, error`

### db:release

Gibt Datenbankressource an Pool zurück.

```lua
local ok, err = db:release()
```

**Gibt zurück:** `boolean, error`

### db:stats

Gibt Verbindungspool-Statistiken zurück.

```lua
local stats, err = db:stats()
```

**Gibt zurück:** `table, error`

Gibt Table mit Feldern zurück:
- `max_open_connections` - Max. erlaubte offene Verbindungen
- `open_connections` - Aktuelle offene Verbindungen
- `in_use` - Aktuell verwendete Verbindungen
- `idle` - Ungenutzte Verbindungen im Pool
- `wait_count` - Gesamte Verbindungs-Warteanzahl
- `wait_duration` - Gesamte Wartezeit
- `max_idle_closed` - Wegen max idle geschlossene Verbindungen
- `max_idle_time_closed` - Wegen idle Timeout geschlossene Verbindungen
- `max_lifetime_closed` - Wegen max lifetime geschlossene Verbindungen

## Prepared Statements

Prepared Statement zurückgegeben von `db:prepare()`.

### stmt:query

Führt Prepared Statement als SELECT aus.

```lua
local rows, err = stmt:query({123})
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `params` | table | Array von Bind-Parametern (optional) |

**Gibt zurück:** `table[], error`

### stmt:execute

Führt Prepared Statement als INSERT/UPDATE/DELETE aus.

```lua
local result, err = stmt:execute({"alice"})
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `params` | table | Array von Bind-Parametern (optional) |

**Gibt zurück:** `table, error`

Gibt Table mit Feldern zurück:
- `last_insert_id` - Zuletzt eingefügte ID
- `rows_affected` - Anzahl betroffener Zeilen

### stmt:close

Schließt Prepared Statement.

```lua
local ok, err = stmt:close()
```

**Gibt zurück:** `boolean, error`

## Transaktionen

Datenbanktransaktion zurückgegeben von `db:begin()`.

### tx:db_type

Gibt Datenbanktyp-Konstante zurück.

```lua
local dbtype, err = tx:db_type()
```

**Gibt zurück:** `string, error`

### tx:query

Führt SELECT-Abfrage innerhalb der Transaktion aus.

```lua
local rows, err = tx:query("SELECT id, name FROM users WHERE active = ?", {1})
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `sql` | string | SQL-Abfrage mit ?-Platzhaltern |
| `params` | table | Array von Bind-Parametern (optional) |

**Gibt zurück:** `table[], error`

### tx:execute

Führt INSERT/UPDATE/DELETE innerhalb der Transaktion aus.

```lua
local result, err = tx:execute("INSERT INTO users (name) VALUES (?)", {"alice"})
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `sql` | string | SQL-Anweisung mit ?-Platzhaltern |
| `params` | table | Array von Bind-Parametern (optional) |

**Gibt zurück:** `table, error`

Gibt Table mit Feldern zurück:
- `last_insert_id` - Zuletzt eingefügte ID
- `rows_affected` - Anzahl betroffener Zeilen

### tx:prepare

Erstellt Prepared Statement innerhalb der Transaktion.

```lua
local stmt, err = tx:prepare("SELECT * FROM users WHERE id = ?")
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `sql` | string | SQL mit ?-Platzhaltern |

**Gibt zurück:** `Statement, error`

### tx:commit

Committet die Transaktion.

```lua
local ok, err = tx:commit()
```

**Gibt zurück:** `boolean, error`

### tx:rollback

Rollt die Transaktion zurück.

```lua
local ok, err = tx:rollback()
```

**Gibt zurück:** `boolean, error`

### tx:savepoint

Erstellt benannten Savepoint innerhalb der Transaktion.

```lua
local ok, err = tx:savepoint("sp1")
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `name` | string | Savepoint-Name (nur alphanumerisch und Unterstrich) |

**Gibt zurück:** `boolean, error`

### tx:rollback_to

Rollt zum benannten Savepoint zurück.

```lua
local ok, err = tx:rollback_to("sp1")
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `name` | string | Savepoint-Name |

**Gibt zurück:** `boolean, error`

### tx:release

Gibt Savepoint frei.

```lua
local ok, err = tx:release("sp1")
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `name` | string | Savepoint-Name |

**Gibt zurück:** `boolean, error`

## SELECT Builder

Fluent-Interface zum Erstellen von SELECT-Abfragen.

### select:from

Setzt FROM-Klausel.

```lua
local query = sql.builder.select("id", "name"):from("users")
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `table` | string | Tabellenname |

**Gibt zurück:** `SelectBuilder`

### select:join

Fügt JOIN-Klausel hinzu.

```lua
local query = sql.builder.select("*")
    :from("users")
    :join("orders ON orders.user_id = users.id")
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `join` | string | JOIN-Klausel mit ?-Platzhaltern |
| `args` | ...any | Bind-Argumente (optional) |

**Gibt zurück:** `SelectBuilder`

### select:left_join

Fügt LEFT JOIN-Klausel hinzu.

```lua
local query = sql.builder.select("*")
    :from("users")
    :left_join("orders ON orders.user_id = users.id")
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `join` | string | JOIN-Klausel mit ?-Platzhaltern |
| `args` | ...any | Bind-Argumente (optional) |

**Gibt zurück:** `SelectBuilder`

### select:right_join

Fügt RIGHT JOIN-Klausel hinzu.

```lua
local query = sql.builder.select("*")
    :from("users")
    :right_join("orders ON orders.user_id = users.id")
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `join` | string | JOIN-Klausel mit ?-Platzhaltern |
| `args` | ...any | Bind-Argumente (optional) |

**Gibt zurück:** `SelectBuilder`

### select:inner_join

Fügt INNER JOIN-Klausel hinzu.

```lua
local query = sql.builder.select("*")
    :from("users")
    :inner_join("orders ON orders.user_id = users.id")
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `join` | string | JOIN-Klausel mit ?-Platzhaltern |
| `args` | ...any | Bind-Argumente (optional) |

**Gibt zurück:** `SelectBuilder`

### select:where

Fügt WHERE-Bedingung hinzu.

```lua
local query = sql.builder.select("*")
    :from("users")
    :where({active = 1})
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `condition` | string\|table\|Sqlizer | WHERE-Bedingung |
| `args` | ...any | Bind-Argumente (optional, bei String-Verwendung) |

Unterstützt drei Formate:
- String: `where("status = ?", "active")`
- Table: `where({status = "active"})`
- Sqlizer: `where(sql.builder.gt({score = 80}))`

**Gibt zurück:** `SelectBuilder`

### select:order_by

Fügt ORDER BY-Klausel hinzu.

```lua
local query = sql.builder.select("*")
    :from("users")
    :order_by("name ASC", "created_at DESC")
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `columns` | ...string | Spaltennamen mit optionalem ASC/DESC |

**Gibt zurück:** `SelectBuilder`

### select:group_by

Fügt GROUP BY-Klausel hinzu.

```lua
local query = sql.builder.select("status", "COUNT(*)")
    :from("users")
    :group_by("status")
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `columns` | ...string | Spaltennamen |

**Gibt zurück:** `SelectBuilder`

### select:having

Fügt HAVING-Bedingung hinzu.

```lua
local query = sql.builder.select("status", "COUNT(*) as cnt")
    :from("users")
    :group_by("status")
    :having(sql.builder.gt({cnt = 10}))
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `condition` | string\|table\|Sqlizer | HAVING-Bedingung |
| `args` | ...any | Bind-Argumente (optional, bei String-Verwendung) |

**Gibt zurück:** `SelectBuilder`

### select:limit

Setzt LIMIT.

```lua
local query = sql.builder.select("*")
    :from("users")
    :limit(10)
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `n` | integer | Limit-Wert |

**Gibt zurück:** `SelectBuilder`

### select:offset

Setzt OFFSET.

```lua
local query = sql.builder.select("*")
    :from("users")
    :offset(20)
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `n` | integer | Offset-Wert |

**Gibt zurück:** `SelectBuilder`

### select:columns

Fügt Spalten zu SELECT hinzu.

```lua
local query = sql.builder.select():columns("id", "name", "email")
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `columns` | ...string | Spaltennamen |

**Gibt zurück:** `SelectBuilder`

### select:distinct

Fügt DISTINCT-Modifikator hinzu.

```lua
local query = sql.builder.select("status")
    :from("users")
    :distinct()
```

**Gibt zurück:** `SelectBuilder`

### select:suffix

Fügt SQL-Suffix hinzu.

```lua
local query = sql.builder.select("*")
    :from("users")
    :suffix("FOR UPDATE")
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `sql` | string | SQL-Suffix mit ?-Platzhaltern |
| `args` | ...any | Bind-Argumente (optional) |

**Gibt zurück:** `SelectBuilder`

### select:placeholder_format

Setzt Platzhalterformat.

```lua
local query = sql.builder.select("*")
    :from("users")
    :placeholder_format(sql.builder.dollar)
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `format` | userdata | Platzhalterformat (sql.builder.*) |

**Gibt zurück:** `SelectBuilder`

### select:to_sql

Generiert SQL-String und Bind-Argumente.

```lua
local sql_str, args = query:to_sql()
```

**Gibt zurück:** `string, table`

### select:run_with

Erstellt Executor für Abfrage.

```lua
local executor = query:run_with(db)
local rows, err = executor:query()
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `db` | DB\|Transaction | Datenbank- oder Transaktions-Handle |

**Gibt zurück:** `QueryExecutor`

## INSERT Builder

Fluent-Interface zum Erstellen von INSERT-Abfragen.

### insert:into

Setzt Tabellennamen.

```lua
local query = sql.builder.insert():into("users")
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `table` | string | Tabellenname |

**Gibt zurück:** `InsertBuilder`

### insert:columns

Setzt Spaltennamen.

```lua
local query = sql.builder.insert("users"):columns("name", "email")
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `columns` | ...string | Spaltennamen |

**Gibt zurück:** `InsertBuilder`

### insert:values

Fügt Zeilenwerte hinzu.

```lua
local query = sql.builder.insert("users")
    :columns("name", "email")
    :values("alice", "alice@example.com")
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `values` | ...any | Zeilenwerte |

**Gibt zurück:** `InsertBuilder`

### insert:set_map

Setzt Spalten und Werte aus Table.

```lua
local query = sql.builder.insert("users")
    :set_map({name = "alice", email = "alice@example.com"})
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `map` | table | {spalte = wert}-Paare |

**Gibt zurück:** `InsertBuilder`

### insert:select

Fügt aus SELECT-Abfrage ein.

```lua
local select_query = sql.builder.select("name", "email"):from("temp_users")
local query = sql.builder.insert("users")
    :columns("name", "email")
    :select(select_query)
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `query` | SelectBuilder | SELECT-Abfrage |

**Gibt zurück:** `InsertBuilder`

### insert:prefix

Fügt SQL-Präfix hinzu.

```lua
local query = sql.builder.insert("users")
    :prefix("INSERT IGNORE INTO")
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `sql` | string | SQL-Präfix mit ?-Platzhaltern |
| `args` | ...any | Bind-Argumente (optional) |

**Gibt zurück:** `InsertBuilder`

### insert:suffix

Fügt SQL-Suffix hinzu.

```lua
local query = sql.builder.insert("users")
    :columns("name")
    :values("alice")
    :suffix("RETURNING id")
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `sql` | string | SQL-Suffix mit ?-Platzhaltern |
| `args` | ...any | Bind-Argumente (optional) |

**Gibt zurück:** `InsertBuilder`

### insert:options

Fügt INSERT-Optionen hinzu.

```lua
local query = sql.builder.insert("users")
    :options("DELAYED", "IGNORE")
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `options` | ...string | INSERT-Optionen |

**Gibt zurück:** `InsertBuilder`

### insert:placeholder_format

Setzt Platzhalterformat.

```lua
local query = sql.builder.insert("users")
    :placeholder_format(sql.builder.dollar)
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `format` | userdata | Platzhalterformat (sql.builder.*) |

**Gibt zurück:** `InsertBuilder`

### insert:to_sql

Generiert SQL-String und Bind-Argumente.

```lua
local sql_str, args = query:to_sql()
```

**Gibt zurück:** `string, table`

### insert:run_with

Erstellt Executor für Abfrage.

```lua
local executor = query:run_with(db)
local result, err = executor:exec()
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `db` | DB\|Transaction | Datenbank- oder Transaktions-Handle |

**Gibt zurück:** `QueryExecutor`

## UPDATE Builder

Fluent-Interface zum Erstellen von UPDATE-Abfragen.

### update:table

Setzt Tabellennamen.

```lua
local query = sql.builder.update():table("users")
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `table` | string | Tabellenname |

**Gibt zurück:** `UpdateBuilder`

### update:set

Setzt Spaltenwert.

```lua
local query = sql.builder.update("users")
    :set("status", "active")
    :set("updated_at", sql.builder.expr("NOW()"))
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `column` | string | Spaltenname |
| `value` | any | Spaltenwert |

**Gibt zurück:** `UpdateBuilder`

### update:set_map

Setzt mehrere Spalten aus Table.

```lua
local query = sql.builder.update("users")
    :set_map({status = "active", updated_at = sql.builder.expr("NOW()")})
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `map` | table | {spalte = wert}-Paare |

**Gibt zurück:** `UpdateBuilder`

### update:where

Fügt WHERE-Bedingung hinzu.

```lua
local query = sql.builder.update("users")
    :set("status", "active")
    :where({id = 123})
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `condition` | string\|table\|Sqlizer | WHERE-Bedingung |
| `args` | ...any | Bind-Argumente (optional, bei String-Verwendung) |

**Gibt zurück:** `UpdateBuilder`

### update:order_by

Fügt ORDER BY-Klausel hinzu.

```lua
local query = sql.builder.update("users")
    :set("rank", 1)
    :order_by("score DESC")
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `columns` | ...string | Spaltennamen mit optionalem ASC/DESC |

**Gibt zurück:** `UpdateBuilder`

### update:limit

Setzt LIMIT.

```lua
local query = sql.builder.update("users")
    :set("status", "active")
    :limit(10)
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `n` | integer | Limit-Wert |

**Gibt zurück:** `UpdateBuilder`

### update:offset

Setzt OFFSET.

```lua
local query = sql.builder.update("users")
    :set("status", "active")
    :offset(5)
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `n` | integer | Offset-Wert |

**Gibt zurück:** `UpdateBuilder`

### update:suffix

Fügt SQL-Suffix hinzu.

```lua
local query = sql.builder.update("users")
    :set("status", "active")
    :suffix("RETURNING id")
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `sql` | string | SQL-Suffix mit ?-Platzhaltern |
| `args` | ...any | Bind-Argumente (optional) |

**Gibt zurück:** `UpdateBuilder`

### update:from

Fügt FROM-Klausel hinzu.

```lua
local query = sql.builder.update("users")
    :set("status", "active")
    :from("other_table")
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `table` | string | Tabellenname |

**Gibt zurück:** `UpdateBuilder`

### update:from_select

Aktualisiert aus SELECT-Abfrage.

```lua
local select_query = sql.builder.select("*"):from("temp_users")
local query = sql.builder.update("users")
    :set("status", "active")
    :from_select(select_query, "t")
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `query` | SelectBuilder | SELECT-Abfrage |
| `alias` | string | Tabellen-Alias |

**Gibt zurück:** `UpdateBuilder`

### update:placeholder_format

Setzt Platzhalterformat.

```lua
local query = sql.builder.update("users")
    :placeholder_format(sql.builder.dollar)
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `format` | userdata | Platzhalterformat (sql.builder.*) |

**Gibt zurück:** `UpdateBuilder`

### update:to_sql

Generiert SQL-String und Bind-Argumente.

```lua
local sql_str, args = query:to_sql()
```

**Gibt zurück:** `string, table`

### update:run_with

Erstellt Executor für Abfrage.

```lua
local executor = query:run_with(db)
local result, err = executor:exec()
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `db` | DB\|Transaction | Datenbank- oder Transaktions-Handle |

**Gibt zurück:** `QueryExecutor`

## DELETE Builder

Fluent-Interface zum Erstellen von DELETE-Abfragen.

### delete:from

Setzt Tabellennamen.

```lua
local query = sql.builder.delete():from("users")
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `table` | string | Tabellenname |

**Gibt zurück:** `DeleteBuilder`

### delete:where

Fügt WHERE-Bedingung hinzu.

```lua
local query = sql.builder.delete("users")
    :where({active = 0})
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `condition` | string\|table\|Sqlizer | WHERE-Bedingung |
| `args` | ...any | Bind-Argumente (optional, bei String-Verwendung) |

**Gibt zurück:** `DeleteBuilder`

### delete:order_by

Fügt ORDER BY-Klausel hinzu.

```lua
local query = sql.builder.delete("users")
    :where({active = 0})
    :order_by("created_at ASC")
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `columns` | ...string | Spaltennamen mit optionalem ASC/DESC |

**Gibt zurück:** `DeleteBuilder`

### delete:limit

Setzt LIMIT.

```lua
local query = sql.builder.delete("users")
    :where({active = 0})
    :limit(100)
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `n` | integer | Limit-Wert |

**Gibt zurück:** `DeleteBuilder`

### delete:offset

Setzt OFFSET.

```lua
local query = sql.builder.delete("users")
    :where({active = 0})
    :offset(10)
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `n` | integer | Offset-Wert |

**Gibt zurück:** `DeleteBuilder`

### delete:suffix

Fügt SQL-Suffix hinzu.

```lua
local query = sql.builder.delete("users")
    :where({active = 0})
    :suffix("RETURNING id")
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `sql` | string | SQL-Suffix mit ?-Platzhaltern |
| `args` | ...any | Bind-Argumente (optional) |

**Gibt zurück:** `DeleteBuilder`

### delete:placeholder_format

Setzt Platzhalterformat.

```lua
local query = sql.builder.delete("users")
    :placeholder_format(sql.builder.dollar)
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `format` | userdata | Platzhalterformat (sql.builder.*) |

**Gibt zurück:** `DeleteBuilder`

### delete:to_sql

Generiert SQL-String und Bind-Argumente.

```lua
local sql_str, args = query:to_sql()
```

**Gibt zurück:** `string, table`

### delete:run_with

Erstellt Executor für Abfrage.

```lua
local executor = query:run_with(db)
local result, err = executor:exec()
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `db` | DB\|Transaction | Datenbank- oder Transaktions-Handle |

**Gibt zurück:** `QueryExecutor`

## Abfragen ausführen

Der Query-Executor führt vom Builder generierte Abfragen aus.

### executor:query

Führt Abfrage aus und gibt Zeilen zurück (für SELECT).

```lua
local rows, err = executor:query()
```

**Gibt zurück:** `table[], error`

### executor:exec

Führt Abfrage aus und gibt Ergebnis zurück (für INSERT/UPDATE/DELETE).

```lua
local result, err = executor:exec()
```

**Gibt zurück:** `table, error`

Gibt Table mit Feldern zurück:
- `last_insert_id` - Zuletzt eingefügte ID
- `rows_affected` - Anzahl betroffener Zeilen

### executor:to_sql

Gibt generierten SQL und Argumente ohne Ausführung zurück.

```lua
local sql_str, args = executor:to_sql()
```

**Gibt zurück:** `string, table`

## Berechtigungen

Datenbankzugriff unterliegt der Sicherheitsrichtlinienauswertung.

| Aktion | Ressource | Beschreibung |
|--------|----------|-------------|
| `db.get` | Datenbank-ID | Datenbankverbindung abrufen |

## Fehler

| Bedingung | Art | Wiederholbar |
|-----------|------|-----------|
| Leere Ressourcen-ID | `errors.INVALID` | nein |
| Berechtigung verweigert | `errors.PERMISSION_DENIED` | nein |
| Ressource nicht gefunden | `errors.NOT_FOUND` | nein |
| Ressource keine Datenbank | `errors.INVALID` | nein |
| Ungültige Parameter | `errors.INVALID` | nein |
| SQL-Syntaxfehler | `errors.INVALID` | nein |
| Statement geschlossen | `errors.INVALID` | nein |
| Transaktion nicht aktiv | `errors.INVALID` | nein |
| Ungültiger Savepoint-Name | `errors.INVALID` | nein |
| Abfrageausführungsfehler | variiert | variiert |

Siehe [Fehlerbehandlung](lua-errors.md) für die Arbeit mit Fehlern.

## Beispiel

```lua
local sql = require("sql")

-- Datenbankverbindung holen
local db, err = sql.get("app.db:main")
if err then error(err) end

-- Datenbanktyp prüfen
local dbtype, _ = db:type()
print("Database type:", dbtype)

-- Direkte Abfrage
local users, err = db:query("SELECT id, name FROM users WHERE active = ?", {1})
if err then error(err) end

for _, user in ipairs(users) do
    print(user.id, user.name)
end

-- Builder-Muster
local query = sql.builder.select("u.id", "u.name", "COUNT(o.id) as order_count")
    :from("users u")
    :left_join("orders o ON o.user_id = u.id")
    :where(sql.builder.and_({
        sql.builder.eq({["u.active"] = 1}),
        sql.builder.gte({["u.score"] = 80})
    }))
    :group_by("u.id", "u.name")
    :having(sql.builder.gt({["COUNT(o.id)"] = 0}))
    :order_by("order_count DESC")
    :limit(10)

local executor = query:run_with(db)
local results, err = executor:query()
if err then error(err) end

-- Transaktion mit Savepoints
local tx, err = db:begin({isolation = sql.isolation.SERIALIZABLE})
if err then error(err) end

local _, err = tx:execute("INSERT INTO users (name) VALUES (?)", {"alice"})
if err then
    tx:rollback()
    error(err)
end

tx:savepoint("sp1")

local _, err = tx:execute("UPDATE users SET status = ? WHERE id = ?", {"active", 1})
if err then
    tx:rollback_to("sp1")
else
    tx:release("sp1")
end

local ok, err = tx:commit()
if err then error(err) end

-- Prepared Statements
local stmt, err = db:prepare("INSERT INTO logs (message, level) VALUES (?, ?)")
if err then error(err) end

for i = 1, 100 do
    local _, err = stmt:execute({"log message " .. i, "info"})
    if err then
        stmt:close()
        error(err)
    end
end

stmt:close()

-- NULL und typisierte Werte
local insert = sql.builder.insert("products")
    :columns("name", "price", "description")
    :values("Widget", sql.as.float(19.99), sql.NULL)

local executor = insert:run_with(db)
local result, err = executor:exec()
if err then error(err) end

print("Inserted ID:", result.last_insert_id)

db:release()
```
