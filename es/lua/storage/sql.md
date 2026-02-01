# Base de Datos SQL
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>
<secondary-label ref="permissions"/>

Ejecutar consultas SQL contra bases de datos PostgreSQL, MySQL, SQLite, MSSQL y Oracle. Las caracteristicas incluyen consultas parametrizadas, transacciones, sentencias preparadas y un constructor de consultas fluido.

Para configuracion de base de datos, consulte [Base de Datos](system-database.md).

## Carga

```lua
local sql = require("sql")
```

## Adquirir una Conexion

Obtener una conexion de base de datos del registro de recursos:

```lua
local db, err = sql.get("app.db:main")
if err then
    return nil, err
end

local rows = db:query("SELECT * FROM users WHERE active = ?", {1})

db:release()
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `id` | string | ID de recurso (ej., "app.db:main") |

**Devuelve:** `DB, error`

<note>
Las conexiones se devuelven automaticamente al pool cuando la funcion termina, pero llamar `db:release()` explicitamente es recomendado para operaciones de larga duracion.
</note>

## Constantes

### Tipos de Base de Datos

```lua
sql.type.POSTGRES    -- "postgres"
sql.type.MYSQL       -- "mysql"
sql.type.SQLITE      -- "sqlite"
sql.type.MSSQL       -- "mssql"
sql.type.ORACLE      -- "oracle"
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

## Coercion de Tipos

### as.int

```lua
local value = sql.as.int(42)
```

**Devuelve:** `userdata`

## as.float

Coerciona valor a tipo SQL float.

```lua
local value = sql.as.float(19.99)
```

**Devuelve:** `userdata`

## as.text

Coerciona valor a tipo SQL text.

```lua
local value = sql.as.text("hello")
```

**Devuelve:** `userdata`

## as.binary

Coerciona valor a tipo SQL binary.

```lua
local value = sql.as.binary("binary data")
```

**Devuelve:** `userdata`

## as.null

Devuelve marcador SQL NULL.

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

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `columns` | ...string | Nombres de columnas (opcional) |

**Devuelve:** `SelectBuilder`

## builder.insert

Crea constructor de consulta INSERT.

```lua
local query = sql.builder.insert("users")
    :columns("name", "email")
    :values("alice", "alice@example.com")
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `table` | string | Nombre de tabla (opcional) |

**Devuelve:** `InsertBuilder`

## builder.update

Crea constructor de consulta UPDATE.

```lua
local query = sql.builder.update("users")
    :set("status", "active")
    :where({id = 123})
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `table` | string | Nombre de tabla (opcional) |

**Devuelve:** `UpdateBuilder`

## builder.delete

Crea constructor de consulta DELETE.

```lua
local query = sql.builder.delete("users")
    :where({active = 0})
    :limit(100)
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `table` | string | Nombre de tabla (opcional) |

**Devuelve:** `DeleteBuilder`

## builder.expr

Crea expresion SQL cruda para usar en clausulas where/having.

```lua
local expr = sql.builder.expr("score BETWEEN ? AND ?", 80, 90)
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `sql` | string | Expresion SQL con marcadores ? |
| `args` | ...any | Argumentos de enlace (opcional) |

**Devuelve:** `Sqlizer`

## builder.eq

Crea condicion de igualdad desde tabla.

```lua
local cond = sql.builder.eq({active = 1, status = "open"})
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `map` | table | pares {columna = valor} |

**Devuelve:** `Sqlizer`

## builder.not_eq

Crea condicion de desigualdad desde tabla.

```lua
local cond = sql.builder.not_eq({status = "closed"})
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `map` | table | pares {columna = valor} |

**Devuelve:** `Sqlizer`

## builder.lt

Crea condicion menor-que desde tabla.

```lua
local cond = sql.builder.lt({age = 18})
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `map` | table | pares {columna = valor} |

**Devuelve:** `Sqlizer`

## builder.lte

Crea condicion menor-o-igual desde tabla.

```lua
local cond = sql.builder.lte({price = 100})
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `map` | table | pares {columna = valor} |

**Devuelve:** `Sqlizer`

## builder.gt

Crea condicion mayor-que desde tabla.

```lua
local cond = sql.builder.gt({score = 80})
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `map` | table | pares {columna = valor} |

**Devuelve:** `Sqlizer`

## builder.gte

Crea condicion mayor-o-igual desde tabla.

```lua
local cond = sql.builder.gte({age = 21})
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `map` | table | pares {columna = valor} |

**Devuelve:** `Sqlizer`

## builder.like

Crea condicion LIKE desde tabla.

```lua
local cond = sql.builder.like({name = "john%"})
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `map` | table | pares {columna = valor} |

**Devuelve:** `Sqlizer`

## builder.not_like

Crea condicion NOT LIKE desde tabla.

```lua
local cond = sql.builder.not_like({email = "%@spam.com"})
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `map` | table | pares {columna = valor} |

**Devuelve:** `Sqlizer`

## builder.and_

Combina multiples condiciones con AND.

```lua
local cond = sql.builder.and_({
    sql.builder.eq({active = 1}),
    sql.builder.gt({score = 80})
})
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `conditions` | table | Array de condiciones Sqlizer o table |

**Devuelve:** `Sqlizer`

## builder.or_

Combina multiples condiciones con OR.

```lua
local cond = sql.builder.or_({
    sql.builder.eq({status = "pending"}),
    sql.builder.eq({status = "active"})
})
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `conditions` | table | Array de condiciones Sqlizer o table |

**Devuelve:** `Sqlizer`

## builder.question

Formato de marcador para marcadores ? (predeterminado).

```lua
local query = sql.builder.select("*")
    :from("users")
    :placeholder_format(sql.builder.question)
```

## builder.dollar

Formato de marcador para marcadores $1, $2, ...

```lua
local query = sql.builder.select("*")
    :from("users")
    :placeholder_format(sql.builder.dollar)
```

## builder.at

Formato de marcador para marcadores @p1, @p2, ...

```lua
local query = sql.builder.select("*")
    :from("users")
    :placeholder_format(sql.builder.at)
```

## builder.colon

Formato de marcador para marcadores :1, :2, ...

```lua
local query = sql.builder.select("*")
    :from("users")
    :placeholder_format(sql.builder.colon)
```

## Metodos de Conexion

Handle de conexion de base de datos devuelto por `sql.get()`.

### db:type

Devuelve constante de tipo de base de datos.

```lua
local dbtype, err = db:type()
```

**Devuelve:** `string, error`

### db:query

Ejecuta consulta SELECT y devuelve filas.

```lua
local rows, err = db:query("SELECT id, name FROM users WHERE active = ?", {1})
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `sql` | string | Consulta SQL con marcadores ? |
| `params` | table | Array de parametros de enlace (opcional) |

**Devuelve:** `table[], error`

### db:execute

Ejecuta consulta INSERT/UPDATE/DELETE.

```lua
local result, err = db:execute("INSERT INTO users (name) VALUES (?)", {"alice"})
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `sql` | string | Sentencia SQL con marcadores ? |
| `params` | table | Array de parametros de enlace (opcional) |

**Devuelve:** `table, error`

Devuelve tabla con campos:
- `last_insert_id` - Ultimo ID insertado
- `rows_affected` - Numero de filas afectadas

### db:prepare

Crea sentencia preparada para ejecucion repetida.

```lua
local stmt, err = db:prepare("SELECT * FROM users WHERE id = ?")
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `sql` | string | SQL con marcadores ? |

**Devuelve:** `Statement, error`

### db:begin

Inicia transaccion de base de datos.

```lua
local tx, err = db:begin({
    isolation = sql.isolation.SERIALIZABLE,
    read_only = false
})
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `options` | table | Opciones de transaccion (opcional) |

Campos de tabla de opciones:
- `isolation` - Nivel de aislamiento de sql.isolation.* (predeterminado: DEFAULT)
- `read_only` - Flag de transaccion de solo lectura (predeterminado: false)

**Devuelve:** `Transaction, error`

### db:release

Libera recurso de base de datos de vuelta al pool.

```lua
local ok, err = db:release()
```

**Devuelve:** `boolean, error`

### db:stats

Devuelve estadisticas del pool de conexiones.

```lua
local stats, err = db:stats()
```

**Devuelve:** `table, error`

Devuelve tabla con campos:
- `max_open_connections` - Conexiones abiertas maximas permitidas
- `open_connections` - Conexiones abiertas actuales
- `in_use` - Conexiones actualmente en uso
- `idle` - Conexiones inactivas en pool
- `wait_count` - Conteo total de esperas de conexion
- `wait_duration` - Duracion total de espera
- `max_idle_closed` - Conexiones cerradas por max idle
- `max_idle_time_closed` - Conexiones cerradas por timeout de inactividad
- `max_lifetime_closed` - Conexiones cerradas por tiempo de vida maximo

## Sentencias Preparadas

Sentencia preparada devuelta por `db:prepare()`.

### stmt:query

Ejecuta sentencia preparada como SELECT.

```lua
local rows, err = stmt:query({123})
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `params` | table | Array de parametros de enlace (opcional) |

**Devuelve:** `table[], error`

### stmt:execute

Ejecuta sentencia preparada como INSERT/UPDATE/DELETE.

```lua
local result, err = stmt:execute({"alice"})
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `params` | table | Array de parametros de enlace (opcional) |

**Devuelve:** `table, error`

Devuelve tabla con campos:
- `last_insert_id` - Ultimo ID insertado
- `rows_affected` - Numero de filas afectadas

### stmt:close

Cierra sentencia preparada.

```lua
local ok, err = stmt:close()
```

**Devuelve:** `boolean, error`

## Transacciones

Transaccion de base de datos devuelta por `db:begin()`.

### tx:db_type

Devuelve constante de tipo de base de datos.

```lua
local dbtype, err = tx:db_type()
```

**Devuelve:** `string, error`

### tx:query

Ejecuta consulta SELECT dentro de transaccion.

```lua
local rows, err = tx:query("SELECT id, name FROM users WHERE active = ?", {1})
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `sql` | string | Consulta SQL con marcadores ? |
| `params` | table | Array de parametros de enlace (opcional) |

**Devuelve:** `table[], error`

### tx:execute

Ejecuta INSERT/UPDATE/DELETE dentro de transaccion.

```lua
local result, err = tx:execute("INSERT INTO users (name) VALUES (?)", {"alice"})
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `sql` | string | Sentencia SQL con marcadores ? |
| `params` | table | Array de parametros de enlace (opcional) |

**Devuelve:** `table, error`

Devuelve tabla con campos:
- `last_insert_id` - Ultimo ID insertado
- `rows_affected` - Numero de filas afectadas

### tx:prepare

Crea sentencia preparada dentro de transaccion.

```lua
local stmt, err = tx:prepare("SELECT * FROM users WHERE id = ?")
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `sql` | string | SQL con marcadores ? |

**Devuelve:** `Statement, error`

### tx:commit

Confirma transaccion.

```lua
local ok, err = tx:commit()
```

**Devuelve:** `boolean, error`

### tx:rollback

Revierte transaccion.

```lua
local ok, err = tx:rollback()
```

**Devuelve:** `boolean, error`

### tx:savepoint

Crea savepoint nombrado dentro de transaccion.

```lua
local ok, err = tx:savepoint("sp1")
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `name` | string | Nombre de savepoint (solo alfanumerico y guion bajo) |

**Devuelve:** `boolean, error`

### tx:rollback_to

Revierte a savepoint nombrado.

```lua
local ok, err = tx:rollback_to("sp1")
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `name` | string | Nombre de savepoint |

**Devuelve:** `boolean, error`

### tx:release

Libera savepoint.

```lua
local ok, err = tx:release("sp1")
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `name` | string | Nombre de savepoint |

**Devuelve:** `boolean, error`

## Constructor SELECT

Interfaz fluida para construir consultas SELECT.

### select:from

Establece clausula FROM.

```lua
local query = sql.builder.select("id", "name"):from("users")
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `table` | string | Nombre de tabla |

**Devuelve:** `SelectBuilder`

### select:join

Agrega clausula JOIN.

```lua
local query = sql.builder.select("*")
    :from("users")
    :join("orders ON orders.user_id = users.id")
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `join` | string | Clausula JOIN con marcadores ? |
| `args` | ...any | Argumentos de enlace (opcional) |

**Devuelve:** `SelectBuilder`

### select:left_join

Agrega clausula LEFT JOIN.

```lua
local query = sql.builder.select("*")
    :from("users")
    :left_join("orders ON orders.user_id = users.id")
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `join` | string | Clausula JOIN con marcadores ? |
| `args` | ...any | Argumentos de enlace (opcional) |

**Devuelve:** `SelectBuilder`

### select:where

Agrega condicion WHERE.

```lua
local query = sql.builder.select("*")
    :from("users")
    :where({active = 1})
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `condition` | string\|table\|Sqlizer | Condicion WHERE |
| `args` | ...any | Argumentos de enlace (opcional, cuando se usa string) |

Soporta tres formatos:
- String: `where("status = ?", "active")`
- Table: `where({status = "active"})`
- Sqlizer: `where(sql.builder.gt({score = 80}))`

**Devuelve:** `SelectBuilder`

### select:order_by

Agrega clausula ORDER BY.

```lua
local query = sql.builder.select("*")
    :from("users")
    :order_by("name ASC", "created_at DESC")
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `columns` | ...string | Nombres de columnas con ASC/DESC opcional |

**Devuelve:** `SelectBuilder`

### select:group_by

Agrega clausula GROUP BY.

```lua
local query = sql.builder.select("status", "COUNT(*)")
    :from("users")
    :group_by("status")
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `columns` | ...string | Nombres de columnas |

**Devuelve:** `SelectBuilder`

### select:limit

Establece LIMIT.

```lua
local query = sql.builder.select("*")
    :from("users")
    :limit(10)
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `n` | integer | Valor de limite |

**Devuelve:** `SelectBuilder`

### select:offset

Establece OFFSET.

```lua
local query = sql.builder.select("*")
    :from("users")
    :offset(20)
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `n` | integer | Valor de offset |

**Devuelve:** `SelectBuilder`

### select:to_sql

Genera string SQL y argumentos de enlace.

```lua
local sql_str, args = query:to_sql()
```

**Devuelve:** `string, table`

### select:run_with

Crea ejecutor para consulta.

```lua
local executor = query:run_with(db)
local rows, err = executor:query()
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `db` | DB\|Transaction | Handle de base de datos o transaccion |

**Devuelve:** `QueryExecutor`

## Permisos

El acceso a base de datos esta sujeto a evaluacion de politica de seguridad.

| Accion | Recurso | Descripcion |
|--------|---------|-------------|
| `db.get` | ID de Database | Adquirir conexion de base de datos |

## Errores

| Condicion | Tipo | Reintentable |
|-----------|------|--------------|
| ID de recurso vacio | `errors.INVALID` | no |
| Permiso denegado | `errors.PERMISSION_DENIED` | no |
| Recurso no encontrado | `errors.NOT_FOUND` | no |
| Recurso no es base de datos | `errors.INVALID` | no |
| Parametros invalidos | `errors.INVALID` | no |
| Error de sintaxis SQL | `errors.INVALID` | no |
| Sentencia cerrada | `errors.INVALID` | no |
| Transaccion no activa | `errors.INVALID` | no |
| Nombre de savepoint invalido | `errors.INVALID` | no |
| Error de ejecucion de consulta | varia | varia |

Consulte [Manejo de Errores](lua-errors.md) para trabajar con errores.
