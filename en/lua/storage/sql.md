# SQL Database
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>
<secondary-label ref="permissions"/>

Execute SQL queries against PostgreSQL, MySQL, SQLite, MSSQL, and Oracle databases. Features include parameterized queries, transactions, prepared statements, and a fluent query builder.

For database configuration, see [Database](system/database.md).

## Loading

```lua
local sql = require("sql")
```

## Acquiring a Connection

Get a database connection from the resource registry:

```lua
local db, err = sql.get("app.db:main")
if err then
    return nil, err
end

local rows = db:query("SELECT * FROM users WHERE active = ?", {1})

db:release()
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Resource ID (e.g., "app.db:main") |

**Returns:** `DB, error`

<note>
Connections are automatically returned to the pool when the function exits, but calling `db:release()` explicitly is recommended for long-running operations.
</note>

## Constants

### Database Types

```lua
sql.type.POSTGRES    -- "postgres"
sql.type.MYSQL       -- "mysql"
sql.type.SQLITE      -- "sqlite"
sql.type.MSSQL       -- "mssql"
sql.type.ORACLE      -- "oracle"
sql.type.UNKNOWN     -- "unknown"
```

### Isolation Levels

```lua
sql.isolation.DEFAULT           -- "default"
sql.isolation.READ_UNCOMMITTED  -- "read_uncommitted"
sql.isolation.READ_COMMITTED    -- "read_committed"
sql.isolation.WRITE_COMMITTED   -- "write_committed"
sql.isolation.REPEATABLE_READ   -- "repeatable_read"
sql.isolation.SERIALIZABLE      -- "serializable"
```

### NULL Value

```lua
local insert = sql.builder.insert("users")
    :columns("name", "email")
    :values("alice", sql.NULL)
```

## Type Coercion

### as.int

```lua
local value = sql.as.int(42)
```

**Returns:** `userdata`

## as.float

Coerces value to SQL float type.

```lua
local value = sql.as.float(19.99)
```

**Returns:** `userdata`

## as.text

Coerces value to SQL text type.

```lua
local value = sql.as.text("hello")
```

**Returns:** `userdata`

## as.binary

Coerces value to SQL binary type.

```lua
local value = sql.as.binary("binary data")
```

**Returns:** `userdata`

## as.null

Returns SQL NULL marker.

```lua
local value = sql.as.null()
```

**Returns:** `userdata`

## Query Builder

### Creating Queries

```lua
local query = sql.builder.select("id", "name")
    :from("users")
    :where({active = 1})
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `columns` | ...string | Column names (optional) |

**Returns:** `SelectBuilder`

## builder.insert

Creates INSERT query builder.

```lua
local query = sql.builder.insert("users")
    :columns("name", "email")
    :values("alice", "alice@example.com")
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `table` | string | Table name (optional) |

**Returns:** `InsertBuilder`

## builder.update

Creates UPDATE query builder.

```lua
local query = sql.builder.update("users")
    :set("status", "active")
    :where({id = 123})
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `table` | string | Table name (optional) |

**Returns:** `UpdateBuilder`

## builder.delete

Creates DELETE query builder.

```lua
local query = sql.builder.delete("users")
    :where({active = 0})
    :limit(100)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `table` | string | Table name (optional) |

**Returns:** `DeleteBuilder`

## builder.expr

Creates raw SQL expression for use in where/having clauses.

```lua
local expr = sql.builder.expr("score BETWEEN ? AND ?", 80, 90)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `sql` | string | SQL expression with ? placeholders |
| `args` | ...any | Bind arguments (optional) |

**Returns:** `Sqlizer`

## builder.eq

Creates equality condition from table.

```lua
local cond = sql.builder.eq({active = 1, status = "open"})
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `map` | table | {column = value} pairs |

**Returns:** `Sqlizer`

## builder.not_eq

Creates inequality condition from table.

```lua
local cond = sql.builder.not_eq({status = "closed"})
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `map` | table | {column = value} pairs |

**Returns:** `Sqlizer`

## builder.lt

Creates less-than condition from table.

```lua
local cond = sql.builder.lt({age = 18})
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `map` | table | {column = value} pairs |

**Returns:** `Sqlizer`

## builder.lte

Creates less-than-or-equal condition from table.

```lua
local cond = sql.builder.lte({price = 100})
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `map` | table | {column = value} pairs |

**Returns:** `Sqlizer`

## builder.gt

Creates greater-than condition from table.

```lua
local cond = sql.builder.gt({score = 80})
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `map` | table | {column = value} pairs |

**Returns:** `Sqlizer`

## builder.gte

Creates greater-than-or-equal condition from table.

```lua
local cond = sql.builder.gte({age = 21})
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `map` | table | {column = value} pairs |

**Returns:** `Sqlizer`

## builder.like

Creates LIKE condition from table.

```lua
local cond = sql.builder.like({name = "john%"})
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `map` | table | {column = value} pairs |

**Returns:** `Sqlizer`

## builder.not_like

Creates NOT LIKE condition from table.

```lua
local cond = sql.builder.not_like({email = "%@spam.com"})
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `map` | table | {column = value} pairs |

**Returns:** `Sqlizer`

## builder.and_

Combines multiple conditions with AND.

```lua
local cond = sql.builder.and_({
    sql.builder.eq({active = 1}),
    sql.builder.gt({score = 80})
})
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `conditions` | table | Array of Sqlizer or table conditions |

**Returns:** `Sqlizer`

## builder.or_

Combines multiple conditions with OR.

```lua
local cond = sql.builder.or_({
    sql.builder.eq({status = "pending"}),
    sql.builder.eq({status = "active"})
})
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `conditions` | table | Array of Sqlizer or table conditions |

**Returns:** `Sqlizer`

## builder.question

Placeholder format for ? placeholders (default).

```lua
local query = sql.builder.select("*")
    :from("users")
    :placeholder_format(sql.builder.question)
```

## builder.dollar

Placeholder format for $1, $2, ... placeholders.

```lua
local query = sql.builder.select("*")
    :from("users")
    :placeholder_format(sql.builder.dollar)
```

## builder.at

Placeholder format for @p1, @p2, ... placeholders.

```lua
local query = sql.builder.select("*")
    :from("users")
    :placeholder_format(sql.builder.at)
```

## builder.colon

Placeholder format for :1, :2, ... placeholders.

```lua
local query = sql.builder.select("*")
    :from("users")
    :placeholder_format(sql.builder.colon)
```

## Connection Methods

Database connection handle returned by `sql.get()`.

### db:type

Returns database type constant.

```lua
local dbtype, err = db:type()
```

**Returns:** `string, error`

### db:query

Executes SELECT query and returns rows.

```lua
local rows, err = db:query("SELECT id, name FROM users WHERE active = ?", {1})
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `sql` | string | SQL query with ? placeholders |
| `params` | table | Array of bind parameters (optional) |

**Returns:** `table[], error`

### db:execute

Executes INSERT/UPDATE/DELETE query.

```lua
local result, err = db:execute("INSERT INTO users (name) VALUES (?)", {"alice"})
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `sql` | string | SQL statement with ? placeholders |
| `params` | table | Array of bind parameters (optional) |

**Returns:** `table, error`

Returns table with fields:
- `last_insert_id` - Last inserted ID
- `rows_affected` - Number of rows affected

### db:prepare

Creates prepared statement for repeated execution.

```lua
local stmt, err = db:prepare("SELECT * FROM users WHERE id = ?")
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `sql` | string | SQL with ? placeholders |

**Returns:** `Statement, error`

### db:begin

Begins database transaction.

```lua
local tx, err = db:begin({
    isolation = sql.isolation.SERIALIZABLE,
    read_only = false
})
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `options` | table | Transaction options (optional) |

Options table fields:
- `isolation` - Isolation level from sql.isolation.* (default: DEFAULT)
- `read_only` - Read-only transaction flag (default: false)

**Returns:** `Transaction, error`

### db:release

Releases database resource back to pool.

```lua
local ok, err = db:release()
```

**Returns:** `boolean, error`

### db:stats

Returns connection pool statistics.

```lua
local stats, err = db:stats()
```

**Returns:** `table, error`

Returns table with fields:
- `max_open_connections` - Max allowed open connections
- `open_connections` - Current open connections
- `in_use` - Connections currently in use
- `idle` - Idle connections in pool
- `wait_count` - Total connection wait count
- `wait_duration` - Total wait duration
- `max_idle_closed` - Connections closed due to max idle
- `max_idle_time_closed` - Connections closed due to idle timeout
- `max_lifetime_closed` - Connections closed due to max lifetime

## Prepared Statements

Prepared statement returned by `db:prepare()`.

### stmt:query

Executes prepared statement as SELECT.

```lua
local rows, err = stmt:query({123})
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `params` | table | Array of bind parameters (optional) |

**Returns:** `table[], error`

### stmt:execute

Executes prepared statement as INSERT/UPDATE/DELETE.

```lua
local result, err = stmt:execute({"alice"})
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `params` | table | Array of bind parameters (optional) |

**Returns:** `table, error`

Returns table with fields:
- `last_insert_id` - Last inserted ID
- `rows_affected` - Number of rows affected

### stmt:close

Closes prepared statement.

```lua
local ok, err = stmt:close()
```

**Returns:** `boolean, error`

## Transactions

Database transaction returned by `db:begin()`.

### tx:db_type

Returns database type constant.

```lua
local dbtype, err = tx:db_type()
```

**Returns:** `string, error`

### tx:query

Executes SELECT query within transaction.

```lua
local rows, err = tx:query("SELECT id, name FROM users WHERE active = ?", {1})
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `sql` | string | SQL query with ? placeholders |
| `params` | table | Array of bind parameters (optional) |

**Returns:** `table[], error`

### tx:execute

Executes INSERT/UPDATE/DELETE within transaction.

```lua
local result, err = tx:execute("INSERT INTO users (name) VALUES (?)", {"alice"})
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `sql` | string | SQL statement with ? placeholders |
| `params` | table | Array of bind parameters (optional) |

**Returns:** `table, error`

Returns table with fields:
- `last_insert_id` - Last inserted ID
- `rows_affected` - Number of rows affected

### tx:prepare

Creates prepared statement within transaction.

```lua
local stmt, err = tx:prepare("SELECT * FROM users WHERE id = ?")
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `sql` | string | SQL with ? placeholders |

**Returns:** `Statement, error`

### tx:commit

Commits transaction.

```lua
local ok, err = tx:commit()
```

**Returns:** `boolean, error`

### tx:rollback

Rolls back transaction.

```lua
local ok, err = tx:rollback()
```

**Returns:** `boolean, error`

### tx:savepoint

Creates named savepoint within transaction.

```lua
local ok, err = tx:savepoint("sp1")
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `name` | string | Savepoint name (alphanumeric and underscore only) |

**Returns:** `boolean, error`

### tx:rollback_to

Rolls back to named savepoint.

```lua
local ok, err = tx:rollback_to("sp1")
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `name` | string | Savepoint name |

**Returns:** `boolean, error`

### tx:release

Releases savepoint.

```lua
local ok, err = tx:release("sp1")
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `name` | string | Savepoint name |

**Returns:** `boolean, error`

## SELECT Builder

Fluent interface for building SELECT queries.

### select:from

Sets FROM clause.

```lua
local query = sql.builder.select("id", "name"):from("users")
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `table` | string | Table name |

**Returns:** `SelectBuilder`

### select:join

Adds JOIN clause.

```lua
local query = sql.builder.select("*")
    :from("users")
    :join("orders ON orders.user_id = users.id")
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `join` | string | JOIN clause with ? placeholders |
| `args` | ...any | Bind arguments (optional) |

**Returns:** `SelectBuilder`

### select:left_join

Adds LEFT JOIN clause.

```lua
local query = sql.builder.select("*")
    :from("users")
    :left_join("orders ON orders.user_id = users.id")
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `join` | string | JOIN clause with ? placeholders |
| `args` | ...any | Bind arguments (optional) |

**Returns:** `SelectBuilder`

### select:right_join

Adds RIGHT JOIN clause.

```lua
local query = sql.builder.select("*")
    :from("users")
    :right_join("orders ON orders.user_id = users.id")
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `join` | string | JOIN clause with ? placeholders |
| `args` | ...any | Bind arguments (optional) |

**Returns:** `SelectBuilder`

### select:inner_join

Adds INNER JOIN clause.

```lua
local query = sql.builder.select("*")
    :from("users")
    :inner_join("orders ON orders.user_id = users.id")
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `join` | string | JOIN clause with ? placeholders |
| `args` | ...any | Bind arguments (optional) |

**Returns:** `SelectBuilder`

### select:where

Adds WHERE condition.

```lua
local query = sql.builder.select("*")
    :from("users")
    :where({active = 1})
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `condition` | string\|table\|Sqlizer | WHERE condition |
| `args` | ...any | Bind arguments (optional, when using string) |

Supports three formats:
- String: `where("status = ?", "active")`
- Table: `where({status = "active"})`
- Sqlizer: `where(sql.builder.gt({score = 80}))`

**Returns:** `SelectBuilder`

### select:order_by

Adds ORDER BY clause.

```lua
local query = sql.builder.select("*")
    :from("users")
    :order_by("name ASC", "created_at DESC")
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `columns` | ...string | Column names with optional ASC/DESC |

**Returns:** `SelectBuilder`

### select:group_by

Adds GROUP BY clause.

```lua
local query = sql.builder.select("status", "COUNT(*)")
    :from("users")
    :group_by("status")
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `columns` | ...string | Column names |

**Returns:** `SelectBuilder`

### select:having

Adds HAVING condition.

```lua
local query = sql.builder.select("status", "COUNT(*) as cnt")
    :from("users")
    :group_by("status")
    :having(sql.builder.gt({cnt = 10}))
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `condition` | string\|table\|Sqlizer | HAVING condition |
| `args` | ...any | Bind arguments (optional, when using string) |

**Returns:** `SelectBuilder`

### select:limit

Sets LIMIT.

```lua
local query = sql.builder.select("*")
    :from("users")
    :limit(10)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `n` | integer | Limit value |

**Returns:** `SelectBuilder`

### select:offset

Sets OFFSET.

```lua
local query = sql.builder.select("*")
    :from("users")
    :offset(20)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `n` | integer | Offset value |

**Returns:** `SelectBuilder`

### select:columns

Adds columns to SELECT.

```lua
local query = sql.builder.select():columns("id", "name", "email")
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `columns` | ...string | Column names |

**Returns:** `SelectBuilder`

### select:distinct

Adds DISTINCT modifier.

```lua
local query = sql.builder.select("status")
    :from("users")
    :distinct()
```

**Returns:** `SelectBuilder`

### select:suffix

Adds SQL suffix.

```lua
local query = sql.builder.select("*")
    :from("users")
    :suffix("FOR UPDATE")
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `sql` | string | SQL suffix with ? placeholders |
| `args` | ...any | Bind arguments (optional) |

**Returns:** `SelectBuilder`

### select:placeholder_format

Sets placeholder format.

```lua
local query = sql.builder.select("*")
    :from("users")
    :placeholder_format(sql.builder.dollar)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `format` | userdata | Placeholder format (sql.builder.*) |

**Returns:** `SelectBuilder`

### select:to_sql

Generates SQL string and bind arguments.

```lua
local sql_str, args = query:to_sql()
```

**Returns:** `string, table`

### select:run_with

Creates executor for query.

```lua
local executor = query:run_with(db)
local rows, err = executor:query()
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `db` | DB\|Transaction | Database or transaction handle |

**Returns:** `QueryExecutor`

## INSERT Builder

Fluent interface for building INSERT queries.

### insert:into

Sets table name.

```lua
local query = sql.builder.insert():into("users")
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `table` | string | Table name |

**Returns:** `InsertBuilder`

### insert:columns

Sets column names.

```lua
local query = sql.builder.insert("users"):columns("name", "email")
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `columns` | ...string | Column names |

**Returns:** `InsertBuilder`

### insert:values

Adds row values.

```lua
local query = sql.builder.insert("users")
    :columns("name", "email")
    :values("alice", "alice@example.com")
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `values` | ...any | Row values |

**Returns:** `InsertBuilder`

### insert:set_map

Sets columns and values from table.

```lua
local query = sql.builder.insert("users")
    :set_map({name = "alice", email = "alice@example.com"})
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `map` | table | {column = value} pairs |

**Returns:** `InsertBuilder`

### insert:select

Inserts from SELECT query.

```lua
local select_query = sql.builder.select("name", "email"):from("temp_users")
local query = sql.builder.insert("users")
    :columns("name", "email")
    :select(select_query)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `query` | SelectBuilder | SELECT query |

**Returns:** `InsertBuilder`

### insert:prefix

Adds SQL prefix.

```lua
local query = sql.builder.insert("users")
    :prefix("INSERT IGNORE INTO")
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `sql` | string | SQL prefix with ? placeholders |
| `args` | ...any | Bind arguments (optional) |

**Returns:** `InsertBuilder`

### insert:suffix

Adds SQL suffix.

```lua
local query = sql.builder.insert("users")
    :columns("name")
    :values("alice")
    :suffix("RETURNING id")
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `sql` | string | SQL suffix with ? placeholders |
| `args` | ...any | Bind arguments (optional) |

**Returns:** `InsertBuilder`

### insert:options

Adds INSERT options.

```lua
local query = sql.builder.insert("users")
    :options("DELAYED", "IGNORE")
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `options` | ...string | INSERT options |

**Returns:** `InsertBuilder`

### insert:placeholder_format

Sets placeholder format.

```lua
local query = sql.builder.insert("users")
    :placeholder_format(sql.builder.dollar)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `format` | userdata | Placeholder format (sql.builder.*) |

**Returns:** `InsertBuilder`

### insert:to_sql

Generates SQL string and bind arguments.

```lua
local sql_str, args = query:to_sql()
```

**Returns:** `string, table`

### insert:run_with

Creates executor for query.

```lua
local executor = query:run_with(db)
local result, err = executor:exec()
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `db` | DB\|Transaction | Database or transaction handle |

**Returns:** `QueryExecutor`

## UPDATE Builder

Fluent interface for building UPDATE queries.

### update:table

Sets table name.

```lua
local query = sql.builder.update():table("users")
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `table` | string | Table name |

**Returns:** `UpdateBuilder`

### update:set

Sets column value.

```lua
local query = sql.builder.update("users")
    :set("status", "active")
    :set("updated_at", sql.builder.expr("NOW()"))
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `column` | string | Column name |
| `value` | any | Column value |

**Returns:** `UpdateBuilder`

### update:set_map

Sets multiple columns from table.

```lua
local query = sql.builder.update("users")
    :set_map({status = "active", updated_at = sql.builder.expr("NOW()")})
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `map` | table | {column = value} pairs |

**Returns:** `UpdateBuilder`

### update:where

Adds WHERE condition.

```lua
local query = sql.builder.update("users")
    :set("status", "active")
    :where({id = 123})
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `condition` | string\|table\|Sqlizer | WHERE condition |
| `args` | ...any | Bind arguments (optional, when using string) |

**Returns:** `UpdateBuilder`

### update:order_by

Adds ORDER BY clause.

```lua
local query = sql.builder.update("users")
    :set("rank", 1)
    :order_by("score DESC")
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `columns` | ...string | Column names with optional ASC/DESC |

**Returns:** `UpdateBuilder`

### update:limit

Sets LIMIT.

```lua
local query = sql.builder.update("users")
    :set("status", "active")
    :limit(10)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `n` | integer | Limit value |

**Returns:** `UpdateBuilder`

### update:offset

Sets OFFSET.

```lua
local query = sql.builder.update("users")
    :set("status", "active")
    :offset(5)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `n` | integer | Offset value |

**Returns:** `UpdateBuilder`

### update:suffix

Adds SQL suffix.

```lua
local query = sql.builder.update("users")
    :set("status", "active")
    :suffix("RETURNING id")
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `sql` | string | SQL suffix with ? placeholders |
| `args` | ...any | Bind arguments (optional) |

**Returns:** `UpdateBuilder`

### update:from

Adds FROM clause.

```lua
local query = sql.builder.update("users")
    :set("status", "active")
    :from("other_table")
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `table` | string | Table name |

**Returns:** `UpdateBuilder`

### update:from_select

Updates from SELECT query.

```lua
local select_query = sql.builder.select("*"):from("temp_users")
local query = sql.builder.update("users")
    :set("status", "active")
    :from_select(select_query, "t")
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `query` | SelectBuilder | SELECT query |
| `alias` | string | Table alias |

**Returns:** `UpdateBuilder`

### update:placeholder_format

Sets placeholder format.

```lua
local query = sql.builder.update("users")
    :placeholder_format(sql.builder.dollar)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `format` | userdata | Placeholder format (sql.builder.*) |

**Returns:** `UpdateBuilder`

### update:to_sql

Generates SQL string and bind arguments.

```lua
local sql_str, args = query:to_sql()
```

**Returns:** `string, table`

### update:run_with

Creates executor for query.

```lua
local executor = query:run_with(db)
local result, err = executor:exec()
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `db` | DB\|Transaction | Database or transaction handle |

**Returns:** `QueryExecutor`

## DELETE Builder

Fluent interface for building DELETE queries.

### delete:from

Sets table name.

```lua
local query = sql.builder.delete():from("users")
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `table` | string | Table name |

**Returns:** `DeleteBuilder`

### delete:where

Adds WHERE condition.

```lua
local query = sql.builder.delete("users")
    :where({active = 0})
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `condition` | string\|table\|Sqlizer | WHERE condition |
| `args` | ...any | Bind arguments (optional, when using string) |

**Returns:** `DeleteBuilder`

### delete:order_by

Adds ORDER BY clause.

```lua
local query = sql.builder.delete("users")
    :where({active = 0})
    :order_by("created_at ASC")
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `columns` | ...string | Column names with optional ASC/DESC |

**Returns:** `DeleteBuilder`

### delete:limit

Sets LIMIT.

```lua
local query = sql.builder.delete("users")
    :where({active = 0})
    :limit(100)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `n` | integer | Limit value |

**Returns:** `DeleteBuilder`

### delete:offset

Sets OFFSET.

```lua
local query = sql.builder.delete("users")
    :where({active = 0})
    :offset(10)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `n` | integer | Offset value |

**Returns:** `DeleteBuilder`

### delete:suffix

Adds SQL suffix.

```lua
local query = sql.builder.delete("users")
    :where({active = 0})
    :suffix("RETURNING id")
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `sql` | string | SQL suffix with ? placeholders |
| `args` | ...any | Bind arguments (optional) |

**Returns:** `DeleteBuilder`

### delete:placeholder_format

Sets placeholder format.

```lua
local query = sql.builder.delete("users")
    :placeholder_format(sql.builder.dollar)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `format` | userdata | Placeholder format (sql.builder.*) |

**Returns:** `DeleteBuilder`

### delete:to_sql

Generates SQL string and bind arguments.

```lua
local sql_str, args = query:to_sql()
```

**Returns:** `string, table`

### delete:run_with

Creates executor for query.

```lua
local executor = query:run_with(db)
local result, err = executor:exec()
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `db` | DB\|Transaction | Database or transaction handle |

**Returns:** `QueryExecutor`

## Executing Queries

The query executor runs builder-generated queries.

### executor:query

Executes query and returns rows (for SELECT).

```lua
local rows, err = executor:query()
```

**Returns:** `table[], error`

### executor:exec

Executes query and returns result (for INSERT/UPDATE/DELETE).

```lua
local result, err = executor:exec()
```

**Returns:** `table, error`

Returns table with fields:
- `last_insert_id` - Last inserted ID
- `rows_affected` - Number of rows affected

### executor:to_sql

Returns generated SQL and arguments without executing.

```lua
local sql_str, args = executor:to_sql()
```

**Returns:** `string, table`

## Permissions

Database access is subject to security policy evaluation.

| Action | Resource | Description |
|--------|----------|-------------|
| `db.get` | Database ID | Acquire database connection |

## Errors

| Condition | Kind | Retryable |
|-----------|------|-----------|
| Empty resource ID | `errors.INVALID` | no |
| Permission denied | `errors.PERMISSION_DENIED` | no |
| Resource not found | `errors.NOT_FOUND` | no |
| Resource not database | `errors.INVALID` | no |
| Invalid parameters | `errors.INVALID` | no |
| SQL syntax error | `errors.INVALID` | no |
| Statement closed | `errors.INVALID` | no |
| Transaction not active | `errors.INVALID` | no |
| Invalid savepoint name | `errors.INVALID` | no |
| Query execution error | varies | varies |

See [Error Handling](lua/core/errors.md) for working with errors.

## Example

```lua
local sql = require("sql")

-- Get database connection
local db, err = sql.get("app.db:main")
if err then error(err) end

-- Check database type
local dbtype, _ = db:type()
print("Database type:", dbtype)

-- Direct query
local users, err = db:query("SELECT id, name FROM users WHERE active = ?", {1})
if err then error(err) end

for _, user in ipairs(users) do
    print(user.id, user.name)
end

-- Builder pattern
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

-- Transaction with savepoints
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

-- Prepared statements
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

-- NULL and typed values
local insert = sql.builder.insert("products")
    :columns("name", "price", "description")
    :values("Widget", sql.as.float(19.99), sql.NULL)

local executor = insert:run_with(db)
local result, err = executor:exec()
if err then error(err) end

print("Inserted ID:", result.last_insert_id)

db:release()
```
