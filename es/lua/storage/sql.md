---
title: "Base de datos SQL"
description: "Ejecuta consultas SQL parametrizadas, transacciones y sentencias preparadas en bases de datos configuradas."
---

# Base de datos SQL
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>
<secondary-label ref="permissions"/>

El módulo `sql` ejecuta consultas en bases de datos PostgreSQL, MySQL y SQLite configuradas. Admite consultas parametrizadas, transacciones, sentencias preparadas y constructores de consultas.

Esta página es una referencia de API. Sus fragmentos presuponen una base de datos configurada, permiso para adquirirla y las tablas mencionadas por la consulta. Ilustran llamadas individuales, no una aplicación independiente. La receta combinada del final indica sus supuestos adicionales de esquema y controlador.

Para configurar la base de datos, consulta [Base de datos](system/database.md).

## Carga

```lua
local sql = require("sql")
```

## `sql.get`

Adquiere una conexión a la base de datos desde el registro de recursos:

```lua
local db, err = sql.get("app.db:main")
if err then
    return nil, err
end

local function finish(value, primary_err)
    local _, release_err = db:release()
    if primary_err then return nil, primary_err end
    if release_err then return nil, release_err end
    return value
end

local rows, err = db:query("SELECT * FROM users WHERE active = ?", {1})
if err then
    return finish(nil, err)
end

return finish(rows)
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `id` | string | ID de recurso (p. ej., "app.db:main") |

**Devuelve:** `DB, error`

<note>
Los leases de base de datos se liberan durante la limpieza del frame de ejecución. Llama explícitamente a `db:release()` cuando termine el trabajo con la base de datos, especialmente en operaciones de larga duración.
</note>

<note>
Las consultas directas de `db` y de transacciones pasan los placeholders al driver de base de datos sin cambios. SQLite y MySQL usan `?`; PostgreSQL usa `$1`, `$2`, etc. Las llamadas `run_with` del builder seleccionan automáticamente placeholders de dólar para PostgreSQL. Los demás tipos de base de datos conservan el formato elegido por el builder, que de forma predeterminada es `?`. Establece `placeholder_format` al generar SQL con `to_sql` o cuando se necesite otro formato.
</note>

## Constantes

### Tipos de Base de Datos

```lua
sql.type.POSTGRES    -- "postgres"
sql.type.MYSQL       -- "mysql"
sql.type.SQLITE      -- "sqlite"
sql.type.UNKNOWN     -- "unknown"
```

### Niveles de Aislamiento

```lua
sql.isolation.DEFAULT           -- "default"
sql.isolation.READ_UNCOMMITTED  -- "read_uncommitted"
sql.isolation.READ_COMMITTED    -- "read_committed"
sql.isolation.WRITE_COMMITTED   -- "write_committed"
sql.isolation.REPEATABLE_READ   -- "repeatable_read"
sql.isolation.SERIALIZABLE      -- "serializable"
```

### Valor NULL

```lua
local insert = sql.builder.insert("users")
    :columns("name", "email")
    :values("alice", sql.NULL)
```

## Coerción de Tipos

### `sql.as.int`

Convierte un valor al tipo entero SQL.

```lua
local value = sql.as.int(42)
```

**Devuelve:** `userdata`

### `sql.as.float`

Convierte un valor al tipo SQL float.

```lua
local value = sql.as.float(19.99)
```

**Devuelve:** `userdata`

### `sql.as.text`

Convierte un valor al tipo SQL text.

```lua
local value = sql.as.text("hello")
```

**Devuelve:** `userdata`

### `sql.as.binary`

Convierte un valor al tipo SQL binary.

```lua
local value = sql.as.binary("binary data")
```

**Devuelve:** `userdata`

### `sql.as.null`

Devuelve el marcador SQL `NULL`.

```lua
local value = sql.as.null()
```

**Devuelve:** `userdata`

## Constructor de consultas :id=builder-de-consultas

### `sql.builder.select`

Crea un constructor de consultas `SELECT`.

```lua
local query = sql.builder.select("id", "name")
    :from("users")
    :where({active = 1})
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `columns` | ...string | Nombres de columnas (opcional) |

**Devuelve:** `SelectBuilder`

### `sql.builder.insert`

Crea un constructor de consultas `INSERT`.

```lua
local query = sql.builder.insert("users")
    :columns("name", "email")
    :values("alice", "alice@example.com")
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `table` | string | Nombre de tabla (opcional) |

**Devuelve:** `InsertBuilder`

### `sql.builder.update`

Crea un constructor de consultas `UPDATE`.

```lua
local query = sql.builder.update("users")
    :set("status", "active")
    :where({id = 123})
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `table` | string | Nombre de tabla (opcional) |

**Devuelve:** `UpdateBuilder`

### `sql.builder.delete`

Crea un constructor de consultas `DELETE`.

```lua
local query = sql.builder.delete("users")
    :where({active = 0})
    :limit(100)
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `table` | string | Nombre de tabla (opcional) |

**Devuelve:** `DeleteBuilder`

### `sql.builder.expr`

Crea una expresión SQL sin procesar para usar en cláusulas `WHERE` o `HAVING`.

```lua
local expr = sql.builder.expr("score BETWEEN ? AND ?", 80, 90)
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `sql` | string | Expresión SQL con marcadores ? |
| `args` | ...any | Argumentos de enlace (opcional) |

**Devuelve:** `Sqlizer`

### `sql.builder.eq`

Crea una condición de igualdad desde una tabla.

```lua
local cond = sql.builder.eq({active = 1, status = "open"})
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `map` | table | Pares {column = value} |

**Devuelve:** `Sqlizer`

### `sql.builder.not_eq`

Crea una condición de desigualdad desde una tabla.

```lua
local cond = sql.builder.not_eq({status = "closed"})
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `map` | table | Pares {column = value} |

**Devuelve:** `Sqlizer`

### `sql.builder.lt`

Crea una condición "menor que" desde una tabla.

```lua
local cond = sql.builder.lt({age = 18})
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `map` | table | Pares {column = value} |

**Devuelve:** `Sqlizer`

### `sql.builder.lte`

Crea una condición "menor o igual que" desde una tabla.

```lua
local cond = sql.builder.lte({price = 100})
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `map` | table | Pares {column = value} |

**Devuelve:** `Sqlizer`

### `sql.builder.gt`

Crea una condición "mayor que" desde una tabla.

```lua
local cond = sql.builder.gt({score = 80})
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `map` | table | Pares {column = value} |

**Devuelve:** `Sqlizer`

### `sql.builder.gte`

Crea una condición "mayor o igual que" desde una tabla.

```lua
local cond = sql.builder.gte({age = 21})
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `map` | table | Pares {column = value} |

**Devuelve:** `Sqlizer`

### `sql.builder.like`

Crea condiciones `LIKE` a partir de una tabla.

```lua
local cond = sql.builder.like({name = "john%"})
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `map` | table | Pares {column = value} |

**Devuelve:** `Sqlizer`

### `sql.builder.not_like`

Crea condiciones `NOT LIKE` a partir de una tabla.

```lua
local cond = sql.builder.not_like({email = "%@spam.com"})
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `map` | table | Pares {column = value} |

**Devuelve:** `Sqlizer`

### `sql.builder.and_`

Combina varias condiciones con `AND`.

```lua
local cond = sql.builder.and_({
    sql.builder.eq({active = 1}),
    sql.builder.gt({score = 80})
})
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `conditions` | table | Arreglo de condiciones Sqlizer o tabla |

**Devuelve:** `Sqlizer`

### `sql.builder.or_`

Combina varias condiciones con `OR`.

```lua
local cond = sql.builder.or_({
    sql.builder.eq({status = "pending"}),
    sql.builder.eq({status = "active"})
})
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `conditions` | table | Arreglo de condiciones Sqlizer o tabla |

**Devuelve:** `Sqlizer`

### `sql.builder.question`

Usa marcadores `?` (predeterminado). Este formato también está disponible como `sql.builder.default_placeholder`.

```lua
local query = sql.builder.select("*")
    :from("users")
    :placeholder_format(sql.builder.question)
```

### `sql.builder.dollar`

Usa marcadores `$1, $2, ...`.

```lua
local query = sql.builder.select("*")
    :from("users")
    :placeholder_format(sql.builder.dollar)
```

### `sql.builder.at`

Formato de marcador para `@p1, @p2, ...` (estilo SQL Server). Se pasa a `placeholder_format` como los formatos anteriores.

### `sql.builder.colon`

Formato de marcador para `:1, :2, ...`. Se pasa a `placeholder_format` como los formatos anteriores.

## Métodos de Conexión

Handle de conexión a la base de datos devuelto por `sql.get()`.

### `db:type`

Devuelve la constante del tipo de base de datos.

```lua
local dbtype, err = db:type()
```

**Devuelve:** `string, error`

### `db:query`

Ejecuta una consulta `SELECT` y devuelve sus filas.

```lua
local rows, err = db:query("SELECT id, name FROM users WHERE active = ?", {1})
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `sql` | string | Consulta SQL con marcadores ? |
| `params` | table | Arreglo de parámetros de enlace (opcional) |

**Devuelve:** `table[], error`

### `db:execute`

Ejecuta una sentencia `INSERT`, `UPDATE` o `DELETE`.

```lua
local result, err = db:execute("INSERT INTO users (name) VALUES (?)", {"alice"})
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `sql` | string | Sentencia SQL con marcadores ? |
| `params` | table | Arreglo de parámetros de enlace (opcional) |

**Devuelve:** `table, error`

Devuelve una tabla con los campos:
- `last_insert_id` - Último ID insertado
- `rows_affected` - Número de filas afectadas

### `db:prepare`

Crea una sentencia preparada para ejecución repetida.

```lua
local stmt, err = db:prepare("SELECT * FROM users WHERE id = ?")
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `sql` | string | SQL con marcadores ? |

**Devuelve:** `Statement, error`

### `db:begin`

Inicia una transacción en la base de datos.

```lua
local tx, err = db:begin({
    isolation = sql.isolation.SERIALIZABLE,
    read_only = false
})
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `options` | table | Opciones de transacción (opcional) |

Campos de la tabla options:
- `isolation` - Nivel de aislamiento de sql.isolation.* (predeterminado: DEFAULT)
- `read_only` - Indicador de transacción de solo lectura (predeterminado: false)

**Devuelve:** `Transaction, error`

### `db:release`

Devuelve el recurso de base de datos al pool.

```lua
local ok, err = db:release()
```

**Devuelve:** `boolean, error`

La operación es idempotente.

### `db:stats`

Devuelve estadísticas del pool de conexiones.

```lua
local stats, err = db:stats()
```

**Devuelve:** `table, error`

Devuelve una tabla con los campos:
- `max_open_connections` - Máximo de conexiones abiertas permitidas
- `open_connections` - Conexiones abiertas actualmente
- `in_use` - Conexiones actualmente en uso
- `idle` - Conexiones inactivas en el pool
- `wait_count` - Número total de esperas de conexión
- `wait_duration` - Duración total de espera
- `max_idle_closed` - Conexiones cerradas por máximo de inactivas
- `max_idle_time_closed` - Conexiones cerradas por timeout de inactividad
- `max_lifetime_closed` - Conexiones cerradas por tiempo de vida máximo

## Sentencias preparadas

Una sentencia preparada devuelta por `db:prepare()` puede consultarse o ejecutarse repetidamente.

### `stmt:query`

Ejecuta la sentencia preparada como consulta `SELECT`.

```lua
local rows, err = stmt:query({123})
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `params` | table | Arreglo de parámetros de enlace (opcional) |

**Devuelve:** `table[], error`

### `stmt:execute`

Ejecuta la sentencia preparada como sentencia `INSERT`, `UPDATE` o `DELETE`.

```lua
local result, err = stmt:execute({"alice"})
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `params` | table | Arreglo de parámetros de enlace (opcional) |

**Devuelve:** `table, error`

Devuelve una tabla con los campos:
- `last_insert_id` - Último ID insertado
- `rows_affected` - Número de filas afectadas

### `stmt:close`

Cierra la sentencia preparada.

```lua
local ok, err = stmt:close()
```

**Devuelve:** `boolean, error`

## Transacciones

Una transacción devuelta por `db:begin()` proporciona operaciones de consulta, sentencias, puntos de guardado, confirmación y reversión.

Una transacción activa se revierte automáticamente durante la limpieza del marco de ejecución. Confírmala o reviértela explícitamente en cuanto termine su trabajo.

### `tx:db_type`

Devuelve la constante del tipo de base de datos.

```lua
local dbtype, err = tx:db_type()
```

**Devuelve:** `string, error`

### `tx:query`

Ejecuta una consulta `SELECT` dentro de la transacción.

```lua
local rows, err = tx:query("SELECT id, name FROM users WHERE active = ?", {1})
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `sql` | string | Consulta SQL con marcadores ? |
| `params` | table | Arreglo de parámetros de enlace (opcional) |

**Devuelve:** `table[], error`

### `tx:execute`

Ejecuta una sentencia `INSERT`, `UPDATE` o `DELETE` dentro de la transacción.

```lua
local result, err = tx:execute("INSERT INTO users (name) VALUES (?)", {"alice"})
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `sql` | string | Sentencia SQL con marcadores ? |
| `params` | table | Arreglo de parámetros de enlace (opcional) |

**Devuelve:** `table, error`

Devuelve una tabla con los campos:
- `last_insert_id` - Último ID insertado
- `rows_affected` - Número de filas afectadas

### `tx:prepare`

Crea una sentencia preparada dentro de la transacción.

```lua
local stmt, err = tx:prepare("SELECT * FROM users WHERE id = ?")
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `sql` | string | SQL con marcadores ? |

**Devuelve:** `Statement, error`

### `tx:commit`

Confirma la transacción.

```lua
local ok, err = tx:commit()
```

**Devuelve:** `boolean, error`

### `tx:rollback`

Revierte la transacción.

```lua
local ok, err = tx:rollback()
```

**Devuelve:** `boolean, error`

### `tx:savepoint`

Crea un savepoint nombrado dentro de la transacción.

```lua
local ok, err = tx:savepoint("sp1")
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `name` | string | Nombre del savepoint (solo alfanuméricos y guion bajo) |

**Devuelve:** `boolean, error`

### `tx:rollback_to`

Revierte hasta el savepoint nombrado.

```lua
local ok, err = tx:rollback_to("sp1")
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `name` | string | Nombre del savepoint |

**Devuelve:** `boolean, error`

### `tx:release`

Libera el savepoint.

```lua
local ok, err = tx:release("sp1")
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `name` | string | Nombre del savepoint |

**Devuelve:** `boolean, error`

## Constructor SELECT

Construye una consulta `SELECT` cláusula por cláusula.

### `select:from`

Establece la cláusula `FROM`.

```lua
local query = sql.builder.select("id", "name"):from("users")
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `table` | string | Nombre de tabla |

**Devuelve:** `SelectBuilder`

### `select:join`

Añade una cláusula `JOIN`.

```lua
local query = sql.builder.select("*")
    :from("users")
    :join("orders ON orders.user_id = users.id")
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `join` | string | Cláusula JOIN con marcadores ? |
| `args` | ...any | Argumentos de enlace (opcional) |

**Devuelve:** `SelectBuilder`

### `select:left_join`

Añade una cláusula `LEFT JOIN`.

```lua
local query = sql.builder.select("*")
    :from("users")
    :left_join("orders ON orders.user_id = users.id")
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `join` | string | Cláusula JOIN con marcadores ? |
| `args` | ...any | Argumentos de enlace (opcional) |

**Devuelve:** `SelectBuilder`

### `select:right_join`

Añade una cláusula `RIGHT JOIN`.

```lua
local query = sql.builder.select("*")
    :from("users")
    :right_join("orders ON orders.user_id = users.id")
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `join` | string | Cláusula JOIN con marcadores ? |
| `args` | ...any | Argumentos de enlace (opcional) |

**Devuelve:** `SelectBuilder`

### `select:inner_join`

Añade una cláusula `INNER JOIN`.

```lua
local query = sql.builder.select("*")
    :from("users")
    :inner_join("orders ON orders.user_id = users.id")
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `join` | string | Cláusula JOIN con marcadores ? |
| `args` | ...any | Argumentos de enlace (opcional) |

**Devuelve:** `SelectBuilder`

### `select:where`

Añade una condición `WHERE`.

```lua
local query = sql.builder.select("*")
    :from("users")
    :where({active = 1})
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `condition` | string\|table\|Sqlizer | Condición WHERE |
| `args` | ...any | Argumentos de enlace (opcional, cuando se usa string) |

Admite tres formatos:
- String: `where("status = ?", "active")`
- Table: `where({status = "active"})`
- Sqlizer: `where(sql.builder.gt({score = 80}))`

**Devuelve:** `SelectBuilder`

### `select:order_by`

Añade una cláusula `ORDER BY`.

```lua
local query = sql.builder.select("*")
    :from("users")
    :order_by("name ASC", "created_at DESC")
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `columns` | ...string | Nombres de columnas con ASC/DESC opcional |

**Devuelve:** `SelectBuilder`

### `select:group_by`

Añade una cláusula `GROUP BY`.

```lua
local query = sql.builder.select("status", "COUNT(*)")
    :from("users")
    :group_by("status")
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `columns` | ...string | Nombres de columnas |

**Devuelve:** `SelectBuilder`

### `select:having`

Añade una condición `HAVING`.

```lua
local query = sql.builder.select("status", "COUNT(*) as cnt")
    :from("users")
    :group_by("status")
    :having(sql.builder.gt({cnt = 10}))
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `condition` | string\|table\|Sqlizer | Condición HAVING |
| `args` | ...any | Argumentos de enlace (opcional, cuando se usa string) |

**Devuelve:** `SelectBuilder`

### `select:limit`

Establece el valor de `LIMIT`.

```lua
local query = sql.builder.select("*")
    :from("users")
    :limit(10)
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `n` | integer | Valor del límite |

**Devuelve:** `SelectBuilder`

### `select:offset`

Establece el valor de `OFFSET`.

```lua
local query = sql.builder.select("*")
    :from("users")
    :offset(20)
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `n` | integer | Valor del offset |

**Devuelve:** `SelectBuilder`

### `select:columns`

Añade columnas a la lista de `SELECT`.

```lua
local query = sql.builder.select():columns("id", "name", "email")
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `columns` | ...string | Nombres de columnas |

**Devuelve:** `SelectBuilder`

### `select:distinct`

Añade el modificador `DISTINCT`.

```lua
local query = sql.builder.select("status")
    :from("users")
    :distinct()
```

**Devuelve:** `SelectBuilder`

### `select:suffix`

Añade un sufijo SQL.

```lua
local query = sql.builder.select("*")
    :from("users")
    :suffix("FOR UPDATE")
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `sql` | string | Sufijo SQL con marcadores ? |
| `args` | ...any | Argumentos de enlace (opcional) |

**Devuelve:** `SelectBuilder`

### `select:placeholder_format`

Establece el formato de marcadores.

```lua
local query = sql.builder.select("*")
    :from("users")
    :placeholder_format(sql.builder.dollar)
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `format` | userdata | Formato de marcadores (sql.builder.*) |

**Devuelve:** `SelectBuilder`

### `select:to_sql`

Genera la cadena SQL y los argumentos de enlace.

```lua
local sql_str, args = query:to_sql()
```

**Devuelve:** `string, table` si tiene éxito; `nil, error` si el estado del constructor no es válido

### `select:run_with`

Crea un ejecutor para la consulta.

```lua
local executor, err = query:run_with(db)
if err then
    return nil, err
end
local rows, err = executor:query()
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `db` | DB\|Transaction | Handle de base de datos o transacción |

**Devuelve:** `QueryExecutor, error`

## Constructor INSERT

Construye una consulta `INSERT` cláusula por cláusula.

### `insert:into`

Establece el nombre de la tabla.

```lua
local query = sql.builder.insert():into("users")
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `table` | string | Nombre de tabla |

**Devuelve:** `InsertBuilder`

### `insert:columns`

Establece los nombres de las columnas.

```lua
local query = sql.builder.insert("users"):columns("name", "email")
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `columns` | ...string | Nombres de columnas |

**Devuelve:** `InsertBuilder`

### `insert:values`

Añade valores de fila.

```lua
local query = sql.builder.insert("users")
    :columns("name", "email")
    :values("alice", "alice@example.com")
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `values` | ...any | Valores de fila |

**Devuelve:** `InsertBuilder`

### `insert:set_map`

Establece columnas y valores desde una tabla.

```lua
local query = sql.builder.insert("users")
    :set_map({name = "alice", email = "alice@example.com"})
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `map` | table | Pares {column = value} |

**Devuelve:** `InsertBuilder`

### `insert:select`

Inserta filas desde una consulta `SELECT`.

```lua
local select_query = sql.builder.select("name", "email"):from("temp_users")
local query = sql.builder.insert("users")
    :columns("name", "email")
    :select(select_query)
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `query` | SelectBuilder | Consulta SELECT |

**Devuelve:** `InsertBuilder`

### `insert:prefix`

Añade un prefijo SQL.

```lua
local query = sql.builder.insert("users")
    :prefix("/* audit import */")
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `sql` | string | Prefijo SQL con marcadores ? |
| `args` | ...any | Argumentos de enlace (opcional) |

**Devuelve:** `InsertBuilder`

### `insert:suffix`

Añade un sufijo SQL.

```lua
local query = sql.builder.insert("users")
    :columns("name")
    :values("alice")
    :suffix("RETURNING id")
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `sql` | string | Sufijo SQL con marcadores ? |
| `args` | ...any | Argumentos de enlace (opcional) |

**Devuelve:** `InsertBuilder`

### `insert:options`

Añade opciones de `INSERT`.

```lua
local query = sql.builder.insert("users")
    :options("DELAYED", "IGNORE")
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `options` | ...string | Opciones de INSERT |

**Devuelve:** `InsertBuilder`

### `insert:placeholder_format`

Establece el formato de marcadores.

```lua
local query = sql.builder.insert("users")
    :placeholder_format(sql.builder.dollar)
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `format` | userdata | Formato de marcadores (sql.builder.*) |

**Devuelve:** `InsertBuilder`

### `insert:to_sql`

Genera la cadena SQL y los argumentos de enlace.

```lua
local sql_str, args = query:to_sql()
```

**Devuelve:** `string, table` si tiene éxito; `nil, error` si el estado del constructor no es válido

### `insert:run_with`

Crea un ejecutor para la consulta.

```lua
local executor, err = query:run_with(db)
if err then
    return nil, err
end
local result, err = executor:exec()
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `db` | DB\|Transaction | Handle de base de datos o transacción |

**Devuelve:** `QueryExecutor, error`

## Constructor UPDATE

Construye una consulta `UPDATE` cláusula por cláusula.

### `update:table`

Establece el nombre de la tabla.

```lua
local query = sql.builder.update():table("users")
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `table` | string | Nombre de tabla |

**Devuelve:** `UpdateBuilder`

### `update:set`

Establece el valor de una columna.

```lua
local query = sql.builder.update("users")
    :set("status", "active")
    :set("updated_at", sql.builder.expr("NOW()"))
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `column` | string | Nombre de la columna |
| `value` | any | Valor de la columna |

**Devuelve:** `UpdateBuilder`

### `update:set_map`

Establece múltiples columnas desde una tabla.

```lua
local query = sql.builder.update("users")
    :set_map({status = "active", updated_at = sql.builder.expr("NOW()")})
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `map` | table | Pares {column = value} |

**Devuelve:** `UpdateBuilder`

### `update:where`

Añade una condición `WHERE`.

```lua
local query = sql.builder.update("users")
    :set("status", "active")
    :where({id = 123})
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `condition` | string\|table\|Sqlizer | Condición WHERE |
| `args` | ...any | Argumentos de enlace (opcional, cuando se usa string) |

**Devuelve:** `UpdateBuilder`

### `update:order_by`

Añade una cláusula `ORDER BY`.

```lua
local query = sql.builder.update("users")
    :set("rank", 1)
    :order_by("score DESC")
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `columns` | ...string | Nombres de columnas con ASC/DESC opcional |

**Devuelve:** `UpdateBuilder`

### `update:limit`

Establece el valor de `LIMIT`.

```lua
local query = sql.builder.update("users")
    :set("status", "active")
    :limit(10)
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `n` | integer | Valor del límite |

**Devuelve:** `UpdateBuilder`

### `update:offset`

Establece el valor de `OFFSET`.

```lua
local query = sql.builder.update("users")
    :set("status", "active")
    :offset(5)
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `n` | integer | Valor del offset |

**Devuelve:** `UpdateBuilder`

### `update:suffix`

Añade un sufijo SQL.

```lua
local query = sql.builder.update("users")
    :set("status", "active")
    :suffix("RETURNING id")
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `sql` | string | Sufijo SQL con marcadores ? |
| `args` | ...any | Argumentos de enlace (opcional) |

**Devuelve:** `UpdateBuilder`

### `update:from`

Añade una cláusula `FROM`.

```lua
local query = sql.builder.update("users")
    :set("status", "active")
    :from("other_table")
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `table` | string | Nombre de tabla |

**Devuelve:** `UpdateBuilder`

### `update:from_select`

Actualiza filas a partir de una consulta `SELECT`.

```lua
local select_query = sql.builder.select("*"):from("temp_users")
local query = sql.builder.update("users")
    :set("status", "active")
    :from_select(select_query, "t")
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `query` | SelectBuilder | Consulta SELECT |
| `alias` | string | Alias de tabla |

**Devuelve:** `UpdateBuilder`

### `update:placeholder_format`

Establece el formato de marcadores.

```lua
local query = sql.builder.update("users")
    :placeholder_format(sql.builder.dollar)
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `format` | userdata | Formato de marcadores (sql.builder.*) |

**Devuelve:** `UpdateBuilder`

### `update:to_sql`

Genera la cadena SQL y los argumentos de enlace.

```lua
local sql_str, args = query:to_sql()
```

**Devuelve:** `string, table` si tiene éxito; `nil, error` si el estado del constructor no es válido

### `update:run_with`

Crea un ejecutor para la consulta.

```lua
local executor, err = query:run_with(db)
if err then
    return nil, err
end
local result, err = executor:exec()
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `db` | DB\|Transaction | Handle de base de datos o transacción |

**Devuelve:** `QueryExecutor, error`

## Constructor DELETE

Construye una consulta `DELETE` cláusula por cláusula.

### `delete:from`

Establece el nombre de la tabla.

```lua
local query = sql.builder.delete():from("users")
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `table` | string | Nombre de tabla |

**Devuelve:** `DeleteBuilder`

### `delete:where`

Añade una condición `WHERE`.

```lua
local query = sql.builder.delete("users")
    :where({active = 0})
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `condition` | string\|table\|Sqlizer | Condición WHERE |
| `args` | ...any | Argumentos de enlace (opcional, cuando se usa string) |

**Devuelve:** `DeleteBuilder`

### `delete:order_by`

Añade una cláusula `ORDER BY`.

```lua
local query = sql.builder.delete("users")
    :where({active = 0})
    :order_by("created_at ASC")
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `columns` | ...string | Nombres de columnas con ASC/DESC opcional |

**Devuelve:** `DeleteBuilder`

### `delete:limit`

Establece el valor de `LIMIT`.

```lua
local query = sql.builder.delete("users")
    :where({active = 0})
    :limit(100)
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `n` | integer | Valor del límite |

**Devuelve:** `DeleteBuilder`

### `delete:offset`

Establece el valor de `OFFSET`.

```lua
local query = sql.builder.delete("users")
    :where({active = 0})
    :offset(10)
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `n` | integer | Valor del offset |

**Devuelve:** `DeleteBuilder`

### `delete:suffix`

Añade un sufijo SQL.

```lua
local query = sql.builder.delete("users")
    :where({active = 0})
    :suffix("RETURNING id")
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `sql` | string | Sufijo SQL con marcadores ? |
| `args` | ...any | Argumentos de enlace (opcional) |

**Devuelve:** `DeleteBuilder`

### `delete:placeholder_format`

Establece el formato de marcadores.

```lua
local query = sql.builder.delete("users")
    :placeholder_format(sql.builder.dollar)
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `format` | userdata | Formato de marcadores (sql.builder.*) |

**Devuelve:** `DeleteBuilder`

### `delete:to_sql`

Genera la cadena SQL y los argumentos de enlace.

```lua
local sql_str, args = query:to_sql()
```

**Devuelve:** `string, table` si tiene éxito; `nil, error` si el estado del constructor no es válido

### `delete:run_with`

Crea un ejecutor para la consulta.

```lua
local executor, err = query:run_with(db)
if err then
    return nil, err
end
local result, err = executor:exec()
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `db` | DB\|Transaction | Handle de base de datos o transacción |

**Devuelve:** `QueryExecutor, error`

## Ejecución de consultas

El ejecutor de consultas ejecuta las consultas generadas por el constructor.

### `executor:query`

Ejecuta la consulta y devuelve filas para una sentencia `SELECT`.

```lua
local rows, err = executor:query()
```

**Devuelve:** `table[], error`

### `executor:exec`

Ejecuta la consulta y devuelve el resultado de una sentencia `INSERT`, `UPDATE` o `DELETE`.

```lua
local result, err = executor:exec()
```

**Devuelve:** `table, error`

Devuelve una tabla con los campos:
- `last_insert_id` - Último ID insertado
- `rows_affected` - Número de filas afectadas

### `executor:to_sql`

Devuelve el SQL generado y los argumentos sin ejecutar.

```lua
local sql_str, args = executor:to_sql()
```

**Devuelve:** `string, table`

## Permisos

El acceso a la base de datos está sujeto a la evaluación de políticas de seguridad.

| Acción | Recurso | Descripción |
|--------|---------|-------------|
| `db.get` | ID de base de datos | Adquirir conexión a la base de datos |

## Errores

| Condición | Tipo | Reintentable |
|-----------|------|--------------|
| ID de recurso vacío | `errors.INVALID` | no |
| Permiso denegado | `errors.PERMISSION_DENIED` | no |
| Recurso no encontrado | `errors.NOT_FOUND` | no |
| El recurso no es base de datos | `errors.INVALID` | no |
| Parámetros inválidos | `errors.INVALID` | no |
| Sentencia cerrada | `errors.INVALID` | no |
| Transacción no activa | `errors.INVALID` | no |
| Nombre de savepoint inválido | `errors.INVALID` | no |
| Error del controlador o de ejecución de la consulta | se conserva el del controlador cuando está disponible; de lo contrario, no se especifica | varía |

Consulte [Manejo de errores](lua/core/errors.md) para trabajar con errores.

## Receta parcial combinada

Esta receta supone que `app.db:main` es una base de datos SQLite o MySQL configurada y que ya contiene las tablas `users`, `orders` y `logs` con las columnas referenciadas. Usa marcadores `?`; para un recurso PostgreSQL, use `$1`, `$2` y así sucesivamente. Las filas devueltas dependen de los datos de la aplicación. La aplicación contenedora proporciona `report_cleanup_error(err)` para que los fallos de reversión o cierre sean observables sin reemplazar el error de la operación que los inició.

```lua
local sql = require("sql")

local db, err = sql.get("app.db:main")
if err then return nil, err end

local function finish(value, primary_err)
    local _, release_err = db:release()
    if primary_err then return nil, primary_err end
    if release_err then return nil, release_err end
    return value
end

-- Direct query
local users, err = db:query("SELECT id, name FROM users WHERE active = ?", {1})
if err then
    return finish(nil, err)
end

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

local executor, build_err = query:run_with(db)
if build_err then
    return finish(nil, build_err)
end
local results, err = executor:query()
if err then
    return finish(nil, err)
end

-- Transaction
local tx, err = db:begin({isolation = sql.isolation.SERIALIZABLE})
if err then
    return finish(nil, err)
end

local _, err = tx:execute("INSERT INTO users (name) VALUES (?)", {"alice"})
if err then
    local _, rollback_err = tx:rollback()
    if rollback_err then report_cleanup_error(rollback_err) end
    return finish(nil, err)
end

local _, commit_err = tx:commit()
if commit_err then
    return finish(nil, commit_err)
end

-- Prepared statements
local stmt, err = db:prepare("INSERT INTO logs (message, level) VALUES (?, ?)")
if err then
    return finish(nil, err)
end

for i = 1, 3 do
    local _, err = stmt:execute({"log message " .. i, "info"})
    if err then
        local _, close_err = stmt:close()
        if close_err then report_cleanup_error(close_err) end
        return finish(nil, err)
    end
end

local _, close_err = stmt:close()
if close_err then
    return finish(nil, close_err)
end

return finish({users = users, ranked_users = results})
```
