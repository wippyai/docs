---
title: "Base de Datos SQL"
description: "<secondary-label ref='function'/ <secondary-label ref='process'/ <secondary-label ref='io'/ <secondary-label ref='permissions'/"
---

# Base de Datos SQL
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>
<secondary-label ref="permissions"/>

Ejecuta consultas SQL contra bases de datos PostgreSQL, MySQL y SQLite. Incluye consultas parametrizadas, transacciones, sentencias preparadas y un constructor de consultas fluido.

Para la configuración de la base de datos, consulte [Base de Datos](system/database.md).

## Carga

```lua
local sql = require("sql")
```

## Adquirir una Conexión

Obtener una conexión a la base de datos desde el registro de recursos:

```lua
local db, err = sql.get("app.db:main")
if err then
    return nil, err
end

local rows = db:query("SELECT * FROM users WHERE active = ?", {1})

db:release()
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `id` | string | ID de recurso (p. ej., "app.db:main") |

**Devuelve:** `DB, error`

<note>
Las conexiones se devuelven automáticamente al pool cuando termina la función, pero se recomienda llamar a `db:release()` explícitamente en operaciones de larga duración.
</note>

<note>
Los marcadores de posición se pasan al controlador de base de datos sin cambios; el runtime no los reescribe. SQLite y MySQL usan `?`, PostgreSQL usa `$1, $2`: escríbalos en la forma que espera su controlador. Los ejemplos siguientes usan `?` (SQLite/MySQL). Para consultas dirigidas a más de un motor, constrúyalas con el Constructor de Consultas y establezca el `placeholder_format` del dialecto.
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

### as.int

```lua
local value = sql.as.int(42)
```

**Devuelve:** `userdata`

## as.float

Convierte un valor al tipo SQL float.

```lua
local value = sql.as.float(19.99)
```

**Devuelve:** `userdata`

## as.text

Convierte un valor al tipo SQL text.

```lua
local value = sql.as.text("hello")
```

**Devuelve:** `userdata`

## as.binary

Convierte un valor al tipo SQL binary.

```lua
local value = sql.as.binary("binary data")
```

**Devuelve:** `userdata`

## as.null

Devuelve el marcador SQL NULL.

```lua
local value = sql.as.null()
```

**Devuelve:** `userdata`

## Constructor de Consultas

### Crear Consultas

```lua
local query = sql.builder.select("id", "name")
    :from("users")
    :where({active = 1})
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `columns` | ...string | Nombres de columnas (opcional) |

**Devuelve:** `SelectBuilder`

## builder.insert

Crea un constructor de consulta INSERT.

```lua
local query = sql.builder.insert("users")
    :columns("name", "email")
    :values("alice", "alice@example.com")
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `table` | string | Nombre de tabla (opcional) |

**Devuelve:** `InsertBuilder`

## builder.update

Crea un constructor de consulta UPDATE.

```lua
local query = sql.builder.update("users")
    :set("status", "active")
    :where({id = 123})
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `table` | string | Nombre de tabla (opcional) |

**Devuelve:** `UpdateBuilder`

## builder.delete

Crea un constructor de consulta DELETE.

```lua
local query = sql.builder.delete("users")
    :where({active = 0})
    :limit(100)
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `table` | string | Nombre de tabla (opcional) |

**Devuelve:** `DeleteBuilder`

## builder.expr

Crea una expresión SQL cruda para usar en cláusulas where/having.

```lua
local expr = sql.builder.expr("score BETWEEN ? AND ?", 80, 90)
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `sql` | string | Expresión SQL con marcadores ? |
| `args` | ...any | Argumentos de enlace (opcional) |

**Devuelve:** `Sqlizer`

## builder.eq

Crea una condición de igualdad desde una tabla.

```lua
local cond = sql.builder.eq({active = 1, status = "open"})
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `map` | table | Pares {column = value} |

**Devuelve:** `Sqlizer`

## builder.not_eq

Crea una condición de desigualdad desde una tabla.

```lua
local cond = sql.builder.not_eq({status = "closed"})
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `map` | table | Pares {column = value} |

**Devuelve:** `Sqlizer`

## builder.lt

Crea una condición "menor que" desde una tabla.

```lua
local cond = sql.builder.lt({age = 18})
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `map` | table | Pares {column = value} |

**Devuelve:** `Sqlizer`

## builder.lte

Crea una condición "menor o igual que" desde una tabla.

```lua
local cond = sql.builder.lte({price = 100})
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `map` | table | Pares {column = value} |

**Devuelve:** `Sqlizer`

## builder.gt

Crea una condición "mayor que" desde una tabla.

```lua
local cond = sql.builder.gt({score = 80})
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `map` | table | Pares {column = value} |

**Devuelve:** `Sqlizer`

## builder.gte

Crea una condición "mayor o igual que" desde una tabla.

```lua
local cond = sql.builder.gte({age = 21})
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `map` | table | Pares {column = value} |

**Devuelve:** `Sqlizer`

## builder.like

Crea una condición LIKE desde una tabla.

```lua
local cond = sql.builder.like({name = "john%"})
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `map` | table | Pares {column = value} |

**Devuelve:** `Sqlizer`

## builder.not_like

Crea una condición NOT LIKE desde una tabla.

```lua
local cond = sql.builder.not_like({email = "%@spam.com"})
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `map` | table | Pares {column = value} |

**Devuelve:** `Sqlizer`

## builder.and_

Combina múltiples condiciones con AND.

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

## builder.or_

Combina múltiples condiciones con OR.

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

## builder.question

Formato de marcador para ? (predeterminado). Disponible como alias `sql.builder.default_placeholder`.

```lua
local query = sql.builder.select("*")
    :from("users")
    :placeholder_format(sql.builder.question)
```

## builder.dollar

Formato de marcador para $1, $2, ...

```lua
local query = sql.builder.select("*")
    :from("users")
    :placeholder_format(sql.builder.dollar)
```

## builder.at

Formato de marcador para `@p1, @p2, ...` (estilo SQL Server). Se pasa a `placeholder_format` como los formatos anteriores.

## builder.colon

Formato de marcador para `:1, :2, ...`. Se pasa a `placeholder_format` como los formatos anteriores.

## Métodos de Conexión

Handle de conexión a la base de datos devuelto por `sql.get()`.

### db:type

Devuelve la constante del tipo de base de datos.

```lua
local dbtype, err = db:type()
```

**Devuelve:** `string, error`

### db:query

Ejecuta una consulta SELECT y devuelve filas.

```lua
local rows, err = db:query("SELECT id, name FROM users WHERE active = ?", {1})
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `sql` | string | Consulta SQL con marcadores ? |
| `params` | table | Arreglo de parámetros de enlace (opcional) |

**Devuelve:** `table[], error`

### db:execute

Ejecuta una consulta INSERT/UPDATE/DELETE.

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

### db:prepare

Crea una sentencia preparada para ejecución repetida.

```lua
local stmt, err = db:prepare("SELECT * FROM users WHERE id = ?")
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `sql` | string | SQL con marcadores ? |

**Devuelve:** `Statement, error`

### db:begin

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

### db:release

Devuelve el recurso de base de datos al pool.

```lua
local ok, err = db:release()
```

**Devuelve:** `boolean, error`

### db:stats

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

## Sentencias Preparadas

Sentencia preparada devuelta por `db:prepare()`.

### stmt:query

Ejecuta la sentencia preparada como SELECT.

```lua
local rows, err = stmt:query({123})
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `params` | table | Arreglo de parámetros de enlace (opcional) |

**Devuelve:** `table[], error`

### stmt:execute

Ejecuta la sentencia preparada como INSERT/UPDATE/DELETE.

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

### stmt:close

Cierra la sentencia preparada.

```lua
local ok, err = stmt:close()
```

**Devuelve:** `boolean, error`

## Transacciones

Transacción de base de datos devuelta por `db:begin()`.

### tx:db_type

Devuelve la constante del tipo de base de datos.

```lua
local dbtype, err = tx:db_type()
```

**Devuelve:** `string, error`

### tx:query

Ejecuta una consulta SELECT dentro de la transacción.

```lua
local rows, err = tx:query("SELECT id, name FROM users WHERE active = ?", {1})
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `sql` | string | Consulta SQL con marcadores ? |
| `params` | table | Arreglo de parámetros de enlace (opcional) |

**Devuelve:** `table[], error`

### tx:execute

Ejecuta INSERT/UPDATE/DELETE dentro de la transacción.

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

### tx:prepare

Crea una sentencia preparada dentro de la transacción.

```lua
local stmt, err = tx:prepare("SELECT * FROM users WHERE id = ?")
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `sql` | string | SQL con marcadores ? |

**Devuelve:** `Statement, error`

### tx:commit

Confirma la transacción.

```lua
local ok, err = tx:commit()
```

**Devuelve:** `boolean, error`

### tx:rollback

Revierte la transacción.

```lua
local ok, err = tx:rollback()
```

**Devuelve:** `boolean, error`

### tx:savepoint

Crea un savepoint nombrado dentro de la transacción.

```lua
local ok, err = tx:savepoint("sp1")
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `name` | string | Nombre del savepoint (solo alfanuméricos y guion bajo) |

**Devuelve:** `boolean, error`

### tx:rollback_to

Revierte hasta el savepoint nombrado.

```lua
local ok, err = tx:rollback_to("sp1")
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `name` | string | Nombre del savepoint |

**Devuelve:** `boolean, error`

### tx:release

Libera el savepoint.

```lua
local ok, err = tx:release("sp1")
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `name` | string | Nombre del savepoint |

**Devuelve:** `boolean, error`

## Constructor SELECT

Interfaz fluida para construir consultas SELECT.

### select:from

Establece la cláusula FROM.

```lua
local query = sql.builder.select("id", "name"):from("users")
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `table` | string | Nombre de tabla |

**Devuelve:** `SelectBuilder`

### select:join

Añade una cláusula JOIN.

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

### select:left_join

Añade una cláusula LEFT JOIN.

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

### select:right_join

Añade una cláusula RIGHT JOIN.

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

### select:inner_join

Añade una cláusula INNER JOIN.

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

### select:where

Añade una condición WHERE.

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

### select:order_by

Añade una cláusula ORDER BY.

```lua
local query = sql.builder.select("*")
    :from("users")
    :order_by("name ASC", "created_at DESC")
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `columns` | ...string | Nombres de columnas con ASC/DESC opcional |

**Devuelve:** `SelectBuilder`

### select:group_by

Añade una cláusula GROUP BY.

```lua
local query = sql.builder.select("status", "COUNT(*)")
    :from("users")
    :group_by("status")
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `columns` | ...string | Nombres de columnas |

**Devuelve:** `SelectBuilder`

### select:having

Añade una condición HAVING.

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

### select:limit

Establece el LIMIT.

```lua
local query = sql.builder.select("*")
    :from("users")
    :limit(10)
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `n` | integer | Valor del límite |

**Devuelve:** `SelectBuilder`

### select:offset

Establece el OFFSET.

```lua
local query = sql.builder.select("*")
    :from("users")
    :offset(20)
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `n` | integer | Valor del offset |

**Devuelve:** `SelectBuilder`

### select:columns

Añade columnas al SELECT.

```lua
local query = sql.builder.select():columns("id", "name", "email")
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `columns` | ...string | Nombres de columnas |

**Devuelve:** `SelectBuilder`

### select:distinct

Añade el modificador DISTINCT.

```lua
local query = sql.builder.select("status")
    :from("users")
    :distinct()
```

**Devuelve:** `SelectBuilder`

### select:suffix

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

### select:placeholder_format

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

### select:to_sql

Genera la cadena SQL y los argumentos de enlace.

```lua
local sql_str, args = query:to_sql()
```

**Devuelve:** `string, table`

### select:run_with

Crea un ejecutor para la consulta.

```lua
local executor = query:run_with(db)
local rows, err = executor:query()
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `db` | DB\|Transaction | Handle de base de datos o transacción |

**Devuelve:** `QueryExecutor`

## Constructor INSERT

Interfaz fluida para construir consultas INSERT.

### insert:into

Establece el nombre de la tabla.

```lua
local query = sql.builder.insert():into("users")
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `table` | string | Nombre de tabla |

**Devuelve:** `InsertBuilder`

### insert:columns

Establece los nombres de las columnas.

```lua
local query = sql.builder.insert("users"):columns("name", "email")
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `columns` | ...string | Nombres de columnas |

**Devuelve:** `InsertBuilder`

### insert:values

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

### insert:set_map

Establece columnas y valores desde una tabla.

```lua
local query = sql.builder.insert("users")
    :set_map({name = "alice", email = "alice@example.com"})
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `map` | table | Pares {column = value} |

**Devuelve:** `InsertBuilder`

### insert:select

Inserta desde una consulta SELECT.

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

### insert:prefix

Añade un prefijo SQL.

```lua
local query = sql.builder.insert("users")
    :prefix("INSERT IGNORE INTO")
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `sql` | string | Prefijo SQL con marcadores ? |
| `args` | ...any | Argumentos de enlace (opcional) |

**Devuelve:** `InsertBuilder`

### insert:suffix

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

### insert:options

Añade opciones de INSERT.

```lua
local query = sql.builder.insert("users")
    :options("DELAYED", "IGNORE")
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `options` | ...string | Opciones de INSERT |

**Devuelve:** `InsertBuilder`

### insert:placeholder_format

Establece el formato de marcadores.

```lua
local query = sql.builder.insert("users")
    :placeholder_format(sql.builder.dollar)
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `format` | userdata | Formato de marcadores (sql.builder.*) |

**Devuelve:** `InsertBuilder`

### insert:to_sql

Genera la cadena SQL y los argumentos de enlace.

```lua
local sql_str, args = query:to_sql()
```

**Devuelve:** `string, table`

### insert:run_with

Crea un ejecutor para la consulta.

```lua
local executor = query:run_with(db)
local result, err = executor:exec()
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `db` | DB\|Transaction | Handle de base de datos o transacción |

**Devuelve:** `QueryExecutor`

## Constructor UPDATE

Interfaz fluida para construir consultas UPDATE.

### update:table

Establece el nombre de la tabla.

```lua
local query = sql.builder.update():table("users")
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `table` | string | Nombre de tabla |

**Devuelve:** `UpdateBuilder`

### update:set

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

### update:set_map

Establece múltiples columnas desde una tabla.

```lua
local query = sql.builder.update("users")
    :set_map({status = "active", updated_at = sql.builder.expr("NOW()")})
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `map` | table | Pares {column = value} |

**Devuelve:** `UpdateBuilder`

### update:where

Añade una condición WHERE.

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

### update:order_by

Añade una cláusula ORDER BY.

```lua
local query = sql.builder.update("users")
    :set("rank", 1)
    :order_by("score DESC")
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `columns` | ...string | Nombres de columnas con ASC/DESC opcional |

**Devuelve:** `UpdateBuilder`

### update:limit

Establece el LIMIT.

```lua
local query = sql.builder.update("users")
    :set("status", "active")
    :limit(10)
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `n` | integer | Valor del límite |

**Devuelve:** `UpdateBuilder`

### update:offset

Establece el OFFSET.

```lua
local query = sql.builder.update("users")
    :set("status", "active")
    :offset(5)
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `n` | integer | Valor del offset |

**Devuelve:** `UpdateBuilder`

### update:suffix

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

### update:from

Añade una cláusula FROM.

```lua
local query = sql.builder.update("users")
    :set("status", "active")
    :from("other_table")
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `table` | string | Nombre de tabla |

**Devuelve:** `UpdateBuilder`

### update:from_select

Actualiza desde una consulta SELECT.

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

### update:placeholder_format

Establece el formato de marcadores.

```lua
local query = sql.builder.update("users")
    :placeholder_format(sql.builder.dollar)
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `format` | userdata | Formato de marcadores (sql.builder.*) |

**Devuelve:** `UpdateBuilder`

### update:to_sql

Genera la cadena SQL y los argumentos de enlace.

```lua
local sql_str, args = query:to_sql()
```

**Devuelve:** `string, table`

### update:run_with

Crea un ejecutor para la consulta.

```lua
local executor = query:run_with(db)
local result, err = executor:exec()
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `db` | DB\|Transaction | Handle de base de datos o transacción |

**Devuelve:** `QueryExecutor`

## Constructor DELETE

Interfaz fluida para construir consultas DELETE.

### delete:from

Establece el nombre de la tabla.

```lua
local query = sql.builder.delete():from("users")
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `table` | string | Nombre de tabla |

**Devuelve:** `DeleteBuilder`

### delete:where

Añade una condición WHERE.

```lua
local query = sql.builder.delete("users")
    :where({active = 0})
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `condition` | string\|table\|Sqlizer | Condición WHERE |
| `args` | ...any | Argumentos de enlace (opcional, cuando se usa string) |

**Devuelve:** `DeleteBuilder`

### delete:order_by

Añade una cláusula ORDER BY.

```lua
local query = sql.builder.delete("users")
    :where({active = 0})
    :order_by("created_at ASC")
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `columns` | ...string | Nombres de columnas con ASC/DESC opcional |

**Devuelve:** `DeleteBuilder`

### delete:limit

Establece el LIMIT.

```lua
local query = sql.builder.delete("users")
    :where({active = 0})
    :limit(100)
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `n` | integer | Valor del límite |

**Devuelve:** `DeleteBuilder`

### delete:offset

Establece el OFFSET.

```lua
local query = sql.builder.delete("users")
    :where({active = 0})
    :offset(10)
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `n` | integer | Valor del offset |

**Devuelve:** `DeleteBuilder`

### delete:suffix

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

### delete:placeholder_format

Establece el formato de marcadores.

```lua
local query = sql.builder.delete("users")
    :placeholder_format(sql.builder.dollar)
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `format` | userdata | Formato de marcadores (sql.builder.*) |

**Devuelve:** `DeleteBuilder`

### delete:to_sql

Genera la cadena SQL y los argumentos de enlace.

```lua
local sql_str, args = query:to_sql()
```

**Devuelve:** `string, table`

### delete:run_with

Crea un ejecutor para la consulta.

```lua
local executor = query:run_with(db)
local result, err = executor:exec()
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `db` | DB\|Transaction | Handle de base de datos o transacción |

**Devuelve:** `QueryExecutor`

## Ejecutar Consultas

El ejecutor de consultas ejecuta las consultas generadas por el constructor.

### executor:query

Ejecuta la consulta y devuelve filas (para SELECT).

```lua
local rows, err = executor:query()
```

**Devuelve:** `table[], error`

### executor:exec

Ejecuta la consulta y devuelve el resultado (para INSERT/UPDATE/DELETE).

```lua
local result, err = executor:exec()
```

**Devuelve:** `table, error`

Devuelve una tabla con los campos:
- `last_insert_id` - Último ID insertado
- `rows_affected` - Número de filas afectadas

### executor:to_sql

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
| Error de sintaxis SQL | `errors.INVALID` | no |
| Sentencia cerrada | `errors.INVALID` | no |
| Transacción no activa | `errors.INVALID` | no |
| Nombre de savepoint inválido | `errors.INVALID` | no |
| Error de ejecución de consulta | varía | varía |

Consulte [Manejo de Errores](lua/core/errors.md) para trabajar con errores.

## Ejemplo

```lua
local sql = require("sql")

-- Obtener conexión a la base de datos
local db, err = sql.get("app.db:main")
if err then error(err) end

-- Verificar tipo de base de datos
local dbtype, _ = db:type()
print("Database type:", dbtype)

-- Consulta directa
local users, err = db:query("SELECT id, name FROM users WHERE active = ?", {1})
if err then error(err) end

for _, user in ipairs(users) do
    print(user.id, user.name)
end

-- Patrón constructor
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

-- Transacción con savepoints
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

-- Sentencias preparadas
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

-- NULL y valores tipados
local insert = sql.builder.insert("products")
    :columns("name", "price", "description")
    :values("Widget", sql.as.float(19.99), sql.NULL)

local executor = insert:run_with(db)
local result, err = executor:exec()
if err then error(err) end

print("Inserted ID:", result.last_insert_id)

db:release()
```
