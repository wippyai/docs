# SQL-Datenbank
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>
<secondary-label ref="permissions"/>

Fuhren Sie SQL-Abfragen gegen PostgreSQL-, MySQL-, SQLite-, MSSQL- und Oracle-Datenbanken aus. Features umfassen parametrisierte Abfragen, Transaktionen, Prepared Statements und einen Fluent Query Builder.

Fur Datenbankkonfiguration siehe [Datenbank](system-database.md).

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

**Gibt zuruck:** `DB, error`

<note>
Verbindungen werden automatisch an den Pool zuruckgegeben, wenn die Funktion beendet wird, aber explizites Aufrufen von `db:release()` wird fur lang laufende Operationen empfohlen.
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

**Gibt zuruck:** `userdata`

## as.float

Konvertiert Wert zu SQL-Float-Typ.

```lua
local value = sql.as.float(19.99)
```

**Gibt zuruck:** `userdata`

## as.text

Konvertiert Wert zu SQL-Text-Typ.

```lua
local value = sql.as.text("hello")
```

**Gibt zuruck:** `userdata`

## as.binary

Konvertiert Wert zu SQL-Binary-Typ.

```lua
local value = sql.as.binary("binary data")
```

**Gibt zuruck:** `userdata`

## as.null

Gibt SQL-NULL-Marker zuruck.

```lua
local value = sql.as.null()
```

**Gibt zuruck:** `userdata`

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

**Gibt zuruck:** `SelectBuilder`

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

**Gibt zuruck:** `InsertBuilder`

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

**Gibt zuruck:** `UpdateBuilder`

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

**Gibt zuruck:** `DeleteBuilder`

## builder.expr

Erstellt rohen SQL-Ausdruck zur Verwendung in WHERE/HAVING-Klauseln.

```lua
local expr = sql.builder.expr("score BETWEEN ? AND ?", 80, 90)
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `sql` | string | SQL-Ausdruck mit ?-Platzhaltern |
| `args` | ...any | Bind-Argumente (optional) |

**Gibt zuruck:** `Sqlizer`

## builder.eq

Erstellt Gleichheitsbedingung aus Table.

```lua
local cond = sql.builder.eq({active = 1, status = "open"})
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `map` | table | {spalte = wert}-Paare |

**Gibt zuruck:** `Sqlizer`

## builder.not_eq

Erstellt Ungleichheitsbedingung aus Table.

```lua
local cond = sql.builder.not_eq({status = "closed"})
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `map` | table | {spalte = wert}-Paare |

**Gibt zuruck:** `Sqlizer`

## builder.lt

Erstellt Kleiner-als-Bedingung aus Table.

```lua
local cond = sql.builder.lt({age = 18})
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `map` | table | {spalte = wert}-Paare |

**Gibt zuruck:** `Sqlizer`

## builder.lte

Erstellt Kleiner-gleich-Bedingung aus Table.

```lua
local cond = sql.builder.lte({price = 100})
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `map` | table | {spalte = wert}-Paare |

**Gibt zuruck:** `Sqlizer`

## builder.gt

Erstellt Grosser-als-Bedingung aus Table.

```lua
local cond = sql.builder.gt({score = 80})
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `map` | table | {spalte = wert}-Paare |

**Gibt zuruck:** `Sqlizer`

## builder.gte

Erstellt Grosser-gleich-Bedingung aus Table.

```lua
local cond = sql.builder.gte({age = 21})
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `map` | table | {spalte = wert}-Paare |

**Gibt zuruck:** `Sqlizer`

## builder.like

Erstellt LIKE-Bedingung aus Table.

```lua
local cond = sql.builder.like({name = "john%"})
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `map` | table | {spalte = wert}-Paare |

**Gibt zuruck:** `Sqlizer`

## builder.not_like

Erstellt NOT LIKE-Bedingung aus Table.

```lua
local cond = sql.builder.not_like({email = "%@spam.com"})
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `map` | table | {spalte = wert}-Paare |

**Gibt zuruck:** `Sqlizer`

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

**Gibt zuruck:** `Sqlizer`

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

**Gibt zuruck:** `Sqlizer`

## builder.question

Platzhalterformat fur ?-Platzhalter (Standard).

```lua
local query = sql.builder.select("*")
    :from("users")
    :placeholder_format(sql.builder.question)
```

## builder.dollar

Platzhalterformat fur $1, $2, ...-Platzhalter.

```lua
local query = sql.builder.select("*")
    :from("users")
    :placeholder_format(sql.builder.dollar)
```

## builder.at

Platzhalterformat fur @p1, @p2, ...-Platzhalter.

```lua
local query = sql.builder.select("*")
    :from("users")
    :placeholder_format(sql.builder.at)
```

## builder.colon

Platzhalterformat fur :1, :2, ...-Platzhalter.

```lua
local query = sql.builder.select("*")
    :from("users")
    :placeholder_format(sql.builder.colon)
```

## Verbindungsmethoden

Datenbankverbindungs-Handle zuruckgegeben von `sql.get()`.

### db:type

Gibt Datenbanktyp-Konstante zuruck.

```lua
local dbtype, err = db:type()
```

**Gibt zuruck:** `string, error`

### db:query

Fuhrt SELECT-Abfrage aus und gibt Zeilen zuruck.

```lua
local rows, err = db:query("SELECT id, name FROM users WHERE active = ?", {1})
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `sql` | string | SQL-Abfrage mit ?-Platzhaltern |
| `params` | table | Array von Bind-Parametern (optional) |

**Gibt zuruck:** `table[], error`

### db:execute

Fuhrt INSERT/UPDATE/DELETE-Abfrage aus.

```lua
local result, err = db:execute("INSERT INTO users (name) VALUES (?)", {"alice"})
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `sql` | string | SQL-Anweisung mit ?-Platzhaltern |
| `params` | table | Array von Bind-Parametern (optional) |

**Gibt zuruck:** `table, error`

Gibt Table mit Feldern zuruck:
- `last_insert_id` - Zuletzt eingefugte ID
- `rows_affected` - Anzahl betroffener Zeilen

### db:prepare

Erstellt Prepared Statement fur wiederholte Ausfuhrung.

```lua
local stmt, err = db:prepare("SELECT * FROM users WHERE id = ?")
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `sql` | string | SQL mit ?-Platzhaltern |

**Gibt zuruck:** `Statement, error`

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

**Gibt zuruck:** `Transaction, error`

### db:release

Gibt Datenbankressource an Pool zuruck.

```lua
local ok, err = db:release()
```

**Gibt zuruck:** `boolean, error`

### db:stats

Gibt Verbindungspool-Statistiken zuruck.

```lua
local stats, err = db:stats()
```

**Gibt zuruck:** `table, error`

Gibt Table mit Feldern zuruck:
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

Prepared Statement zuruckgegeben von `db:prepare()`.

### stmt:query

Fuhrt Prepared Statement als SELECT aus.

```lua
local rows, err = stmt:query({123})
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `params` | table | Array von Bind-Parametern (optional) |

**Gibt zuruck:** `table[], error`

### stmt:execute

Fuhrt Prepared Statement als INSERT/UPDATE/DELETE aus.

```lua
local result, err = stmt:execute({"alice"})
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `params` | table | Array von Bind-Parametern (optional) |

**Gibt zuruck:** `table, error`

Gibt Table mit Feldern zuruck:
- `last_insert_id` - Zuletzt eingefugte ID
- `rows_affected` - Anzahl betroffener Zeilen

### stmt:close

Schliesst Prepared Statement.

```lua
local ok, err = stmt:close()
```

**Gibt zuruck:** `boolean, error`

## Transaktionen

Datenbanktransaktion zuruckgegeben von `db:begin()`.

### tx:db_type

Gibt Datenbanktyp-Konstante zuruck.

```lua
local dbtype, err = tx:db_type()
```

**Gibt zuruck:** `string, error`

### tx:query

Fuhrt SELECT-Abfrage innerhalb der Transaktion aus.

```lua
local rows, err = tx:query("SELECT id, name FROM users WHERE active = ?", {1})
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `sql` | string | SQL-Abfrage mit ?-Platzhaltern |
| `params` | table | Array von Bind-Parametern (optional) |

**Gibt zuruck:** `table[], error`

### tx:execute

Fuhrt INSERT/UPDATE/DELETE innerhalb der Transaktion aus.

```lua
local result, err = tx:execute("INSERT INTO users (name) VALUES (?)", {"alice"})
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `sql` | string | SQL-Anweisung mit ?-Platzhaltern |
| `params` | table | Array von Bind-Parametern (optional) |

**Gibt zuruck:** `table, error`

Gibt Table mit Feldern zuruck:
- `last_insert_id` - Zuletzt eingefugte ID
- `rows_affected` - Anzahl betroffener Zeilen

### tx:prepare

Erstellt Prepared Statement innerhalb der Transaktion.

```lua
local stmt, err = tx:prepare("SELECT * FROM users WHERE id = ?")
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `sql` | string | SQL mit ?-Platzhaltern |

**Gibt zuruck:** `Statement, error`

### tx:commit

Committet die Transaktion.

```lua
local ok, err = tx:commit()
```

**Gibt zuruck:** `boolean, error`

### tx:rollback

Rollt die Transaktion zuruck.

```lua
local ok, err = tx:rollback()
```

**Gibt zuruck:** `boolean, error`

### tx:savepoint

Erstellt benannten Savepoint innerhalb der Transaktion.

```lua
local ok, err = tx:savepoint("sp1")
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `name` | string | Savepoint-Name (nur alphanumerisch und Unterstrich) |

**Gibt zuruck:** `boolean, error`

### tx:rollback_to

Rollt zum benannten Savepoint zuruck.

```lua
local ok, err = tx:rollback_to("sp1")
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `name` | string | Savepoint-Name |

**Gibt zuruck:** `boolean, error`

### tx:release

Gibt Savepoint frei.

```lua
local ok, err = tx:release("sp1")
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `name` | string | Savepoint-Name |

**Gibt zuruck:** `boolean, error`

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

**Gibt zuruck:** `SelectBuilder`

### select:join

Fugt JOIN-Klausel hinzu.

```lua
local query = sql.builder.select("*")
    :from("users")
    :join("orders ON orders.user_id = users.id")
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `join` | string | JOIN-Klausel mit ?-Platzhaltern |
| `args` | ...any | Bind-Argumente (optional) |

**Gibt zuruck:** `SelectBuilder`

### select:left_join

Fugt LEFT JOIN-Klausel hinzu.

```lua
local query = sql.builder.select("*")
    :from("users")
    :left_join("orders ON orders.user_id = users.id")
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `join` | string | JOIN-Klausel mit ?-Platzhaltern |
| `args` | ...any | Bind-Argumente (optional) |

**Gibt zuruck:** `SelectBuilder`

### select:right_join

Fugt RIGHT JOIN-Klausel hinzu.

```lua
local query = sql.builder.select("*")
    :from("users")
    :right_join("orders ON orders.user_id = users.id")
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `join` | string | JOIN-Klausel mit ?-Platzhaltern |
| `args` | ...any | Bind-Argumente (optional) |

**Gibt zuruck:** `SelectBuilder`

### select:inner_join

Fugt INNER JOIN-Klausel hinzu.

```lua
local query = sql.builder.select("*")
    :from("users")
    :inner_join("orders ON orders.user_id = users.id")
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `join` | string | JOIN-Klausel mit ?-Platzhaltern |
| `args` | ...any | Bind-Argumente (optional) |

**Gibt zuruck:** `SelectBuilder`

### select:where

Fugt WHERE-Bedingung hinzu.

```lua
local query = sql.builder.select("*")
    :from("users")
    :where({active = 1})
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `condition` | string\|table\|Sqlizer | WHERE-Bedingung |
| `args` | ...any | Bind-Argumente (optional, bei String-Verwendung) |

Unterstutzt drei Formate:
- String: `where("status = ?", "active")`
- Table: `where({status = "active"})`
- Sqlizer: `where(sql.builder.gt({score = 80}))`

**Gibt zuruck:** `SelectBuilder`

### select:order_by

Fugt ORDER BY-Klausel hinzu.

```lua
local query = sql.builder.select("*")
    :from("users")
    :order_by("name ASC", "created_at DESC")
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `columns` | ...string | Spaltennamen mit optionalem ASC/DESC |

**Gibt zuruck:** `SelectBuilder`

### select:group_by

Fugt GROUP BY-Klausel hinzu.

```lua
local query = sql.builder.select("status", "COUNT(*)")
    :from("users")
    :group_by("status")
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `columns` | ...string | Spaltennamen |

**Gibt zuruck:** `SelectBuilder`

### select:having

Fugt HAVING-Bedingung hinzu.

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

**Gibt zuruck:** `SelectBuilder`

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

**Gibt zuruck:** `SelectBuilder`

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

**Gibt zuruck:** `SelectBuilder`

### select:columns

Fugt Spalten zu SELECT hinzu.

```lua
local query = sql.builder.select():columns("id", "name", "email")
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `columns` | ...string | Spaltennamen |

**Gibt zuruck:** `SelectBuilder`

### select:distinct

Fugt DISTINCT-Modifikator hinzu.

```lua
local query = sql.builder.select("status")
    :from("users")
    :distinct()
```

**Gibt zuruck:** `SelectBuilder`

### select:suffix

Fugt SQL-Suffix hinzu.

```lua
local query = sql.builder.select("*")
    :from("users")
    :suffix("FOR UPDATE")
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `sql` | string | SQL-Suffix mit ?-Platzhaltern |
| `args` | ...any | Bind-Argumente (optional) |

**Gibt zuruck:** `SelectBuilder`

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

**Gibt zuruck:** `SelectBuilder`

### select:to_sql

Generiert SQL-String und Bind-Argumente.

```lua
local sql_str, args = query:to_sql()
```

**Gibt zuruck:** `string, table`

### select:run_with

Erstellt Executor fur Abfrage.

```lua
local executor = query:run_with(db)
local rows, err = executor:query()
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `db` | DB\|Transaction | Datenbank- oder Transaktions-Handle |

**Gibt zuruck:** `QueryExecutor`

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

**Gibt zuruck:** `InsertBuilder`

### insert:columns

Setzt Spaltennamen.

```lua
local query = sql.builder.insert("users"):columns("name", "email")
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `columns` | ...string | Spaltennamen |

**Gibt zuruck:** `InsertBuilder`

### insert:values

Fugt Zeilenwerte hinzu.

```lua
local query = sql.builder.insert("users")
    :columns("name", "email")
    :values("alice", "alice@example.com")
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `values` | ...any | Zeilenwerte |

**Gibt zuruck:** `InsertBuilder`

### insert:set_map

Setzt Spalten und Werte aus Table.

```lua
local query = sql.builder.insert("users")
    :set_map({name = "alice", email = "alice@example.com"})
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `map` | table | {spalte = wert}-Paare |

**Gibt zuruck:** `InsertBuilder`

### insert:select

Fugt aus SELECT-Abfrage ein.

```lua
local select_query = sql.builder.select("name", "email"):from("temp_users")
local query = sql.builder.insert("users")
    :columns("name", "email")
    :select(select_query)
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `query` | SelectBuilder | SELECT-Abfrage |

**Gibt zuruck:** `InsertBuilder`

### insert:prefix

Fugt SQL-Prafix hinzu.

```lua
local query = sql.builder.insert("users")
    :prefix("INSERT IGNORE INTO")
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `sql` | string | SQL-Prafix mit ?-Platzhaltern |
| `args` | ...any | Bind-Argumente (optional) |

**Gibt zuruck:** `InsertBuilder`

### insert:suffix

Fugt SQL-Suffix hinzu.

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

**Gibt zuruck:** `InsertBuilder`

### insert:options

Fugt INSERT-Optionen hinzu.

```lua
local query = sql.builder.insert("users")
    :options("DELAYED", "IGNORE")
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `options` | ...string | INSERT-Optionen |

**Gibt zuruck:** `InsertBuilder`

### insert:placeholder_format

Setzt Platzhalterformat.

```lua
local query = sql.builder.insert("users")
    :placeholder_format(sql.builder.dollar)
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `format` | userdata | Platzhalterformat (sql.builder.*) |

**Gibt zuruck:** `InsertBuilder`

### insert:to_sql

Generiert SQL-String und Bind-Argumente.

```lua
local sql_str, args = query:to_sql()
```

**Gibt zuruck:** `string, table`

### insert:run_with

Erstellt Executor fur Abfrage.

```lua
local executor = query:run_with(db)
local result, err = executor:exec()
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `db` | DB\|Transaction | Datenbank- oder Transaktions-Handle |

**Gibt zuruck:** `QueryExecutor`

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

**Gibt zuruck:** `UpdateBuilder`

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

**Gibt zuruck:** `UpdateBuilder`

### update:set_map

Setzt mehrere Spalten aus Table.

```lua
local query = sql.builder.update("users")
    :set_map({status = "active", updated_at = sql.builder.expr("NOW()")})
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `map` | table | {spalte = wert}-Paare |

**Gibt zuruck:** `UpdateBuilder`

### update:where

Fugt WHERE-Bedingung hinzu.

```lua
local query = sql.builder.update("users")
    :set("status", "active")
    :where({id = 123})
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `condition` | string\|table\|Sqlizer | WHERE-Bedingung |
| `args` | ...any | Bind-Argumente (optional, bei String-Verwendung) |

**Gibt zuruck:** `UpdateBuilder`

### update:order_by

Fugt ORDER BY-Klausel hinzu.

```lua
local query = sql.builder.update("users")
    :set("rank", 1)
    :order_by("score DESC")
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `columns` | ...string | Spaltennamen mit optionalem ASC/DESC |

**Gibt zuruck:** `UpdateBuilder`

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

**Gibt zuruck:** `UpdateBuilder`

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

**Gibt zuruck:** `UpdateBuilder`

### update:suffix

Fugt SQL-Suffix hinzu.

```lua
local query = sql.builder.update("users")
    :set("status", "active")
    :suffix("RETURNING id")
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `sql` | string | SQL-Suffix mit ?-Platzhaltern |
| `args` | ...any | Bind-Argumente (optional) |

**Gibt zuruck:** `UpdateBuilder`

### update:from

Fugt FROM-Klausel hinzu.

```lua
local query = sql.builder.update("users")
    :set("status", "active")
    :from("other_table")
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `table` | string | Tabellenname |

**Gibt zuruck:** `UpdateBuilder`

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

**Gibt zuruck:** `UpdateBuilder`

### update:placeholder_format

Setzt Platzhalterformat.

```lua
local query = sql.builder.update("users")
    :placeholder_format(sql.builder.dollar)
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `format` | userdata | Platzhalterformat (sql.builder.*) |

**Gibt zuruck:** `UpdateBuilder`

### update:to_sql

Generiert SQL-String und Bind-Argumente.

```lua
local sql_str, args = query:to_sql()
```

**Gibt zuruck:** `string, table`

### update:run_with

Erstellt Executor fur Abfrage.

```lua
local executor = query:run_with(db)
local result, err = executor:exec()
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `db` | DB\|Transaction | Datenbank- oder Transaktions-Handle |

**Gibt zuruck:** `QueryExecutor`

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

**Gibt zuruck:** `DeleteBuilder`

### delete:where

Fugt WHERE-Bedingung hinzu.

```lua
local query = sql.builder.delete("users")
    :where({active = 0})
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `condition` | string\|table\|Sqlizer | WHERE-Bedingung |
| `args` | ...any | Bind-Argumente (optional, bei String-Verwendung) |

**Gibt zuruck:** `DeleteBuilder`

### delete:order_by

Fugt ORDER BY-Klausel hinzu.

```lua
local query = sql.builder.delete("users")
    :where({active = 0})
    :order_by("created_at ASC")
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `columns` | ...string | Spaltennamen mit optionalem ASC/DESC |

**Gibt zuruck:** `DeleteBuilder`

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

**Gibt zuruck:** `DeleteBuilder`

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

**Gibt zuruck:** `DeleteBuilder`

### delete:suffix

Fugt SQL-Suffix hinzu.

```lua
local query = sql.builder.delete("users")
    :where({active = 0})
    :suffix("RETURNING id")
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `sql` | string | SQL-Suffix mit ?-Platzhaltern |
| `args` | ...any | Bind-Argumente (optional) |

**Gibt zuruck:** `DeleteBuilder`

### delete:placeholder_format

Setzt Platzhalterformat.

```lua
local query = sql.builder.delete("users")
    :placeholder_format(sql.builder.dollar)
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `format` | userdata | Platzhalterformat (sql.builder.*) |

**Gibt zuruck:** `DeleteBuilder`

### delete:to_sql

Generiert SQL-String und Bind-Argumente.

```lua
local sql_str, args = query:to_sql()
```

**Gibt zuruck:** `string, table`

### delete:run_with

Erstellt Executor fur Abfrage.

```lua
local executor = query:run_with(db)
local result, err = executor:exec()
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `db` | DB\|Transaction | Datenbank- oder Transaktions-Handle |

**Gibt zuruck:** `QueryExecutor`

## Abfragen ausfuhren

Der Query-Executor fuhrt vom Builder generierte Abfragen aus.

### executor:query

Fuhrt Abfrage aus und gibt Zeilen zuruck (fur SELECT).

```lua
local rows, err = executor:query()
```

**Gibt zuruck:** `table[], error`

### executor:exec

Fuhrt Abfrage aus und gibt Ergebnis zuruck (fur INSERT/UPDATE/DELETE).

```lua
local result, err = executor:exec()
```

**Gibt zuruck:** `table, error`

Gibt Table mit Feldern zuruck:
- `last_insert_id` - Zuletzt eingefugte ID
- `rows_affected` - Anzahl betroffener Zeilen

### executor:to_sql

Gibt generierten SQL und Argumente ohne Ausfuhrung zuruck.

```lua
local sql_str, args = executor:to_sql()
```

**Gibt zuruck:** `string, table`

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
| Ungultige Parameter | `errors.INVALID` | nein |
| SQL-Syntaxfehler | `errors.INVALID` | nein |
| Statement geschlossen | `errors.INVALID` | nein |
| Transaktion nicht aktiv | `errors.INVALID` | nein |
| Ungultiger Savepoint-Name | `errors.INVALID` | nein |
| Abfrageausfuhrungsfehler | variiert | variiert |

Siehe [Fehlerbehandlung](lua-errors.md) fur die Arbeit mit Fehlern.

## Beispiel

```lua
local sql = require("sql")

-- Datenbankverbindung holen
local db, err = sql.get("app.db:main")
if err then error(err) end

-- Datenbanktyp prufen
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
