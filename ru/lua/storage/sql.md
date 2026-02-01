# База данных SQL
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>
<secondary-label ref="permissions"/>

Выполнение SQL-запросов к базам данных PostgreSQL, MySQL, SQLite, MSSQL и Oracle. Поддержка параметризованных запросов, транзакций, подготовленных выражений и fluent-конструктора запросов.

Настройку базы данных см. в [Database](system/database.md).

## Загрузка

```lua
local sql = require("sql")
```

## Получение соединения

Получить соединение с базой данных из реестра ресурсов:

```lua
local db, err = sql.get("app.db:main")
if err then
    return nil, err
end

local rows = db:query("SELECT * FROM users WHERE active = ?", {1})

db:release()
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `id` | string | ID ресурса (например, "app.db:main") |

**Возвращает:** `DB, error`

<note>
Соединения автоматически возвращаются в пул при выходе из функции, но рекомендуется явно вызывать `db:release()` для длительных операций.
</note>

## Константы

### Типы баз данных

```lua
sql.type.POSTGRES    -- "postgres"
sql.type.MYSQL       -- "mysql"
sql.type.SQLITE      -- "sqlite"
sql.type.MSSQL       -- "mssql"
sql.type.ORACLE      -- "oracle"
sql.type.UNKNOWN     -- "unknown"
```

### Уровни изоляции

```lua
sql.isolation.DEFAULT           -- "default"
sql.isolation.READ_UNCOMMITTED  -- "read_uncommitted"
sql.isolation.READ_COMMITTED    -- "read_committed"
sql.isolation.WRITE_COMMITTED   -- "write_committed"
sql.isolation.REPEATABLE_READ   -- "repeatable_read"
sql.isolation.SERIALIZABLE      -- "serializable"
```

### Значение NULL

```lua
local insert = sql.builder.insert("users")
    :columns("name", "email")
    :values("alice", sql.NULL)
```

## Приведение типов

### as.int

```lua
local value = sql.as.int(42)
```

**Возвращает:** `userdata`

## as.float

Приведение значения к SQL-типу float.

```lua
local value = sql.as.float(19.99)
```

**Возвращает:** `userdata`

## as.text

Приведение значения к SQL-типу text.

```lua
local value = sql.as.text("hello")
```

**Возвращает:** `userdata`

## as.binary

Приведение значения к SQL-типу binary.

```lua
local value = sql.as.binary("binary data")
```

**Возвращает:** `userdata`

## as.null

Возвращает маркер SQL NULL.

```lua
local value = sql.as.null()
```

**Возвращает:** `userdata`

## Конструктор запросов

### Создание запросов

```lua
local query = sql.builder.select("id", "name")
    :from("users")
    :where({active = 1})
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `columns` | ...string | Имена колонок (опционально) |

**Возвращает:** `SelectBuilder`

## builder.insert

Создаёт конструктор INSERT-запроса.

```lua
local query = sql.builder.insert("users")
    :columns("name", "email")
    :values("alice", "alice@example.com")
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `table` | string | Имя таблицы (опционально) |

**Возвращает:** `InsertBuilder`

## builder.update

Создаёт конструктор UPDATE-запроса.

```lua
local query = sql.builder.update("users")
    :set("status", "active")
    :where({id = 123})
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `table` | string | Имя таблицы (опционально) |

**Возвращает:** `UpdateBuilder`

## builder.delete

Создаёт конструктор DELETE-запроса.

```lua
local query = sql.builder.delete("users")
    :where({active = 0})
    :limit(100)
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `table` | string | Имя таблицы (опционально) |

**Возвращает:** `DeleteBuilder`

## builder.expr

Создаёт сырое SQL-выражение для использования в where/having.

```lua
local expr = sql.builder.expr("score BETWEEN ? AND ?", 80, 90)
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `sql` | string | SQL-выражение с плейсхолдерами ? |
| `args` | ...any | Аргументы привязки (опционально) |

**Возвращает:** `Sqlizer`

## builder.eq

Создаёт условие равенства из таблицы.

```lua
local cond = sql.builder.eq({active = 1, status = "open"})
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `map` | table | Пары {колонка = значение} |

**Возвращает:** `Sqlizer`

## builder.not_eq

Создаёт условие неравенства из таблицы.

```lua
local cond = sql.builder.not_eq({status = "closed"})
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `map` | table | Пары {колонка = значение} |

**Возвращает:** `Sqlizer`

## builder.lt

Создаёт условие «меньше» из таблицы.

```lua
local cond = sql.builder.lt({age = 18})
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `map` | table | Пары {колонка = значение} |

**Возвращает:** `Sqlizer`

## builder.lte

Создаёт условие «меньше или равно» из таблицы.

```lua
local cond = sql.builder.lte({price = 100})
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `map` | table | Пары {колонка = значение} |

**Возвращает:** `Sqlizer`

## builder.gt

Создаёт условие «больше» из таблицы.

```lua
local cond = sql.builder.gt({score = 80})
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `map` | table | Пары {колонка = значение} |

**Возвращает:** `Sqlizer`

## builder.gte

Создаёт условие «больше или равно» из таблицы.

```lua
local cond = sql.builder.gte({age = 21})
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `map` | table | Пары {колонка = значение} |

**Возвращает:** `Sqlizer`

## builder.like

Создаёт условие LIKE из таблицы.

```lua
local cond = sql.builder.like({name = "john%"})
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `map` | table | Пары {колонка = значение} |

**Возвращает:** `Sqlizer`

## builder.not_like

Создаёт условие NOT LIKE из таблицы.

```lua
local cond = sql.builder.not_like({email = "%@spam.com"})
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `map` | table | Пары {колонка = значение} |

**Возвращает:** `Sqlizer`

## builder.and_

Объединяет несколько условий через AND.

```lua
local cond = sql.builder.and_({
    sql.builder.eq({active = 1}),
    sql.builder.gt({score = 80})
})
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `conditions` | table | Массив Sqlizer или табличных условий |

**Возвращает:** `Sqlizer`

## builder.or_

Объединяет несколько условий через OR.

```lua
local cond = sql.builder.or_({
    sql.builder.eq({status = "pending"}),
    sql.builder.eq({status = "active"})
})
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `conditions` | table | Массив Sqlizer или табличных условий |

**Возвращает:** `Sqlizer`

## builder.question

Формат плейсхолдеров ? (по умолчанию).

```lua
local query = sql.builder.select("*")
    :from("users")
    :placeholder_format(sql.builder.question)
```

## builder.dollar

Формат плейсхолдеров $1, $2, ...

```lua
local query = sql.builder.select("*")
    :from("users")
    :placeholder_format(sql.builder.dollar)
```

## builder.at

Формат плейсхолдеров @p1, @p2, ...

```lua
local query = sql.builder.select("*")
    :from("users")
    :placeholder_format(sql.builder.at)
```

## builder.colon

Формат плейсхолдеров :1, :2, ...

```lua
local query = sql.builder.select("*")
    :from("users")
    :placeholder_format(sql.builder.colon)
```

## Методы соединения

Дескриптор соединения, возвращаемый `sql.get()`.

### db:type

Возвращает константу типа базы данных.

```lua
local dbtype, err = db:type()
```

**Возвращает:** `string, error`

### db:query

Выполняет SELECT-запрос и возвращает строки.

```lua
local rows, err = db:query("SELECT id, name FROM users WHERE active = ?", {1})
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `sql` | string | SQL-запрос с плейсхолдерами ? |
| `params` | table | Массив параметров привязки (опционально) |

**Возвращает:** `table[], error`

### db:execute

Выполняет INSERT/UPDATE/DELETE-запрос.

```lua
local result, err = db:execute("INSERT INTO users (name) VALUES (?)", {"alice"})
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `sql` | string | SQL-выражение с плейсхолдерами ? |
| `params` | table | Массив параметров привязки (опционально) |

**Возвращает:** `table, error`

Возвращаемая таблица содержит поля:
- `last_insert_id` — ID последней вставленной записи
- `rows_affected` — количество затронутых строк

### db:prepare

Создаёт подготовленное выражение для многократного выполнения.

```lua
local stmt, err = db:prepare("SELECT * FROM users WHERE id = ?")
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `sql` | string | SQL с плейсхолдерами ? |

**Возвращает:** `Statement, error`

### db:begin

Начинает транзакцию базы данных.

```lua
local tx, err = db:begin({
    isolation = sql.isolation.SERIALIZABLE,
    read_only = false
})
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `options` | table | Опции транзакции (опционально) |

Поля таблицы опций:
- `isolation` — уровень изоляции из sql.isolation.* (по умолчанию: DEFAULT)
- `read_only` — флаг транзакции только для чтения (по умолчанию: false)

**Возвращает:** `Transaction, error`

### db:release

Возвращает ресурс базы данных в пул.

```lua
local ok, err = db:release()
```

**Возвращает:** `boolean, error`

### db:stats

Возвращает статистику пула соединений.

```lua
local stats, err = db:stats()
```

**Возвращает:** `table, error`

Возвращаемая таблица содержит поля:
- `max_open_connections` — максимум открытых соединений
- `open_connections` — текущих открытых соединений
- `in_use` — соединений в использовании
- `idle` — простаивающих соединений в пуле
- `wait_count` — всего ожиданий соединения
- `wait_duration` — общее время ожидания
- `max_idle_closed` — соединений закрыто из-за max idle
- `max_idle_time_closed` — соединений закрыто по таймауту простоя
- `max_lifetime_closed` — соединений закрыто по max lifetime

## Подготовленные выражения

Подготовленное выражение, возвращаемое `db:prepare()`.

### stmt:query

Выполняет подготовленное выражение как SELECT.

```lua
local rows, err = stmt:query({123})
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `params` | table | Массив параметров привязки (опционально) |

**Возвращает:** `table[], error`

### stmt:execute

Выполняет подготовленное выражение как INSERT/UPDATE/DELETE.

```lua
local result, err = stmt:execute({"alice"})
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `params` | table | Массив параметров привязки (опционально) |

**Возвращает:** `table, error`

Возвращаемая таблица содержит поля:
- `last_insert_id` — ID последней вставленной записи
- `rows_affected` — количество затронутых строк

### stmt:close

Закрывает подготовленное выражение.

```lua
local ok, err = stmt:close()
```

**Возвращает:** `boolean, error`

## Транзакции

Транзакция базы данных, возвращаемая `db:begin()`.

### tx:db_type

Возвращает константу типа базы данных.

```lua
local dbtype, err = tx:db_type()
```

**Возвращает:** `string, error`

### tx:query

Выполняет SELECT-запрос внутри транзакции.

```lua
local rows, err = tx:query("SELECT id, name FROM users WHERE active = ?", {1})
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `sql` | string | SQL-запрос с плейсхолдерами ? |
| `params` | table | Массив параметров привязки (опционально) |

**Возвращает:** `table[], error`

### tx:execute

Выполняет INSERT/UPDATE/DELETE внутри транзакции.

```lua
local result, err = tx:execute("INSERT INTO users (name) VALUES (?)", {"alice"})
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `sql` | string | SQL-выражение с плейсхолдерами ? |
| `params` | table | Массив параметров привязки (опционально) |

**Возвращает:** `table, error`

Возвращаемая таблица содержит поля:
- `last_insert_id` — ID последней вставленной записи
- `rows_affected` — количество затронутых строк

### tx:prepare

Создаёт подготовленное выражение внутри транзакции.

```lua
local stmt, err = tx:prepare("SELECT * FROM users WHERE id = ?")
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `sql` | string | SQL с плейсхолдерами ? |

**Возвращает:** `Statement, error`

### tx:commit

Фиксирует транзакцию.

```lua
local ok, err = tx:commit()
```

**Возвращает:** `boolean, error`

### tx:rollback

Откатывает транзакцию.

```lua
local ok, err = tx:rollback()
```

**Возвращает:** `boolean, error`

### tx:savepoint

Создаёт именованную точку сохранения внутри транзакции.

```lua
local ok, err = tx:savepoint("sp1")
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `name` | string | Имя точки сохранения (только буквы, цифры и подчёркивание) |

**Возвращает:** `boolean, error`

### tx:rollback_to

Откатывает к именованной точке сохранения.

```lua
local ok, err = tx:rollback_to("sp1")
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `name` | string | Имя точки сохранения |

**Возвращает:** `boolean, error`

### tx:release

Освобождает точку сохранения.

```lua
local ok, err = tx:release("sp1")
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `name` | string | Имя точки сохранения |

**Возвращает:** `boolean, error`

## SELECT Builder

Fluent-интерфейс для построения SELECT-запросов.

### select:from

Устанавливает FROM-часть.

```lua
local query = sql.builder.select("id", "name"):from("users")
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `table` | string | Имя таблицы |

**Возвращает:** `SelectBuilder`

### select:join

Добавляет JOIN-часть.

```lua
local query = sql.builder.select("*")
    :from("users")
    :join("orders ON orders.user_id = users.id")
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `join` | string | JOIN-часть с плейсхолдерами ? |
| `args` | ...any | Аргументы привязки (опционально) |

**Возвращает:** `SelectBuilder`

### select:left_join

Добавляет LEFT JOIN-часть.

```lua
local query = sql.builder.select("*")
    :from("users")
    :left_join("orders ON orders.user_id = users.id")
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `join` | string | JOIN-часть с плейсхолдерами ? |
| `args` | ...any | Аргументы привязки (опционально) |

**Возвращает:** `SelectBuilder`

### select:right_join

Добавляет RIGHT JOIN-часть.

```lua
local query = sql.builder.select("*")
    :from("users")
    :right_join("orders ON orders.user_id = users.id")
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `join` | string | JOIN-часть с плейсхолдерами ? |
| `args` | ...any | Аргументы привязки (опционально) |

**Возвращает:** `SelectBuilder`

### select:inner_join

Добавляет INNER JOIN-часть.

```lua
local query = sql.builder.select("*")
    :from("users")
    :inner_join("orders ON orders.user_id = users.id")
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `join` | string | JOIN-часть с плейсхолдерами ? |
| `args` | ...any | Аргументы привязки (опционально) |

**Возвращает:** `SelectBuilder`

### select:where

Добавляет WHERE-условие.

```lua
local query = sql.builder.select("*")
    :from("users")
    :where({active = 1})
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `condition` | string\|table\|Sqlizer | WHERE-условие |
| `args` | ...any | Аргументы привязки (опционально, при использовании строки) |

Поддерживает три формата:
- Строка: `where("status = ?", "active")`
- Таблица: `where({status = "active"})`
- Sqlizer: `where(sql.builder.gt({score = 80}))`

**Возвращает:** `SelectBuilder`

### select:order_by

Добавляет ORDER BY-часть.

```lua
local query = sql.builder.select("*")
    :from("users")
    :order_by("name ASC", "created_at DESC")
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `columns` | ...string | Имена колонок с опциональным ASC/DESC |

**Возвращает:** `SelectBuilder`

### select:group_by

Добавляет GROUP BY-часть.

```lua
local query = sql.builder.select("status", "COUNT(*)")
    :from("users")
    :group_by("status")
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `columns` | ...string | Имена колонок |

**Возвращает:** `SelectBuilder`

### select:having

Добавляет HAVING-условие.

```lua
local query = sql.builder.select("status", "COUNT(*) as cnt")
    :from("users")
    :group_by("status")
    :having(sql.builder.gt({cnt = 10}))
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `condition` | string\|table\|Sqlizer | HAVING-условие |
| `args` | ...any | Аргументы привязки (опционально, при использовании строки) |

**Возвращает:** `SelectBuilder`

### select:limit

Устанавливает LIMIT.

```lua
local query = sql.builder.select("*")
    :from("users")
    :limit(10)
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `n` | integer | Значение лимита |

**Возвращает:** `SelectBuilder`

### select:offset

Устанавливает OFFSET.

```lua
local query = sql.builder.select("*")
    :from("users")
    :offset(20)
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `n` | integer | Значение смещения |

**Возвращает:** `SelectBuilder`

### select:columns

Добавляет колонки в SELECT.

```lua
local query = sql.builder.select():columns("id", "name", "email")
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `columns` | ...string | Имена колонок |

**Возвращает:** `SelectBuilder`

### select:distinct

Добавляет модификатор DISTINCT.

```lua
local query = sql.builder.select("status")
    :from("users")
    :distinct()
```

**Возвращает:** `SelectBuilder`

### select:suffix

Добавляет SQL-суффикс.

```lua
local query = sql.builder.select("*")
    :from("users")
    :suffix("FOR UPDATE")
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `sql` | string | SQL-суффикс с плейсхолдерами ? |
| `args` | ...any | Аргументы привязки (опционально) |

**Возвращает:** `SelectBuilder`

### select:placeholder_format

Устанавливает формат плейсхолдеров.

```lua
local query = sql.builder.select("*")
    :from("users")
    :placeholder_format(sql.builder.dollar)
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `format` | userdata | Формат плейсхолдеров (sql.builder.*) |

**Возвращает:** `SelectBuilder`

### select:to_sql

Генерирует SQL-строку и аргументы привязки.

```lua
local sql_str, args = query:to_sql()
```

**Возвращает:** `string, table`

### select:run_with

Создаёт исполнитель для запроса.

```lua
local executor = query:run_with(db)
local rows, err = executor:query()
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `db` | DB\|Transaction | Дескриптор базы данных или транзакции |

**Возвращает:** `QueryExecutor`

## INSERT Builder

Fluent-интерфейс для построения INSERT-запросов.

### insert:into

Устанавливает имя таблицы.

```lua
local query = sql.builder.insert():into("users")
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `table` | string | Имя таблицы |

**Возвращает:** `InsertBuilder`

### insert:columns

Устанавливает имена колонок.

```lua
local query = sql.builder.insert("users"):columns("name", "email")
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `columns` | ...string | Имена колонок |

**Возвращает:** `InsertBuilder`

### insert:values

Добавляет значения строки.

```lua
local query = sql.builder.insert("users")
    :columns("name", "email")
    :values("alice", "alice@example.com")
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `values` | ...any | Значения строки |

**Возвращает:** `InsertBuilder`

### insert:set_map

Устанавливает колонки и значения из таблицы.

```lua
local query = sql.builder.insert("users")
    :set_map({name = "alice", email = "alice@example.com"})
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `map` | table | Пары {колонка = значение} |

**Возвращает:** `InsertBuilder`

### insert:select

Вставляет из SELECT-запроса.

```lua
local select_query = sql.builder.select("name", "email"):from("temp_users")
local query = sql.builder.insert("users")
    :columns("name", "email")
    :select(select_query)
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `query` | SelectBuilder | SELECT-запрос |

**Возвращает:** `InsertBuilder`

### insert:prefix

Добавляет SQL-префикс.

```lua
local query = sql.builder.insert("users")
    :prefix("INSERT IGNORE INTO")
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `sql` | string | SQL-префикс с плейсхолдерами ? |
| `args` | ...any | Аргументы привязки (опционально) |

**Возвращает:** `InsertBuilder`

### insert:suffix

Добавляет SQL-суффикс.

```lua
local query = sql.builder.insert("users")
    :columns("name")
    :values("alice")
    :suffix("RETURNING id")
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `sql` | string | SQL-суффикс с плейсхолдерами ? |
| `args` | ...any | Аргументы привязки (опционально) |

**Возвращает:** `InsertBuilder`

### insert:options

Добавляет опции INSERT.

```lua
local query = sql.builder.insert("users")
    :options("DELAYED", "IGNORE")
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `options` | ...string | Опции INSERT |

**Возвращает:** `InsertBuilder`

### insert:placeholder_format

Устанавливает формат плейсхолдеров.

```lua
local query = sql.builder.insert("users")
    :placeholder_format(sql.builder.dollar)
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `format` | userdata | Формат плейсхолдеров (sql.builder.*) |

**Возвращает:** `InsertBuilder`

### insert:to_sql

Генерирует SQL-строку и аргументы привязки.

```lua
local sql_str, args = query:to_sql()
```

**Возвращает:** `string, table`

### insert:run_with

Создаёт исполнитель для запроса.

```lua
local executor = query:run_with(db)
local result, err = executor:exec()
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `db` | DB\|Transaction | Дескриптор базы данных или транзакции |

**Возвращает:** `QueryExecutor`

## UPDATE Builder

Fluent-интерфейс для построения UPDATE-запросов.

### update:table

Устанавливает имя таблицы.

```lua
local query = sql.builder.update():table("users")
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `table` | string | Имя таблицы |

**Возвращает:** `UpdateBuilder`

### update:set

Устанавливает значение колонки.

```lua
local query = sql.builder.update("users")
    :set("status", "active")
    :set("updated_at", sql.builder.expr("NOW()"))
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `column` | string | Имя колонки |
| `value` | any | Значение колонки |

**Возвращает:** `UpdateBuilder`

### update:set_map

Устанавливает несколько колонок из таблицы.

```lua
local query = sql.builder.update("users")
    :set_map({status = "active", updated_at = sql.builder.expr("NOW()")})
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `map` | table | Пары {колонка = значение} |

**Возвращает:** `UpdateBuilder`

### update:where

Добавляет WHERE-условие.

```lua
local query = sql.builder.update("users")
    :set("status", "active")
    :where({id = 123})
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `condition` | string\|table\|Sqlizer | WHERE-условие |
| `args` | ...any | Аргументы привязки (опционально, при использовании строки) |

**Возвращает:** `UpdateBuilder`

### update:order_by

Добавляет ORDER BY-часть.

```lua
local query = sql.builder.update("users")
    :set("rank", 1)
    :order_by("score DESC")
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `columns` | ...string | Имена колонок с опциональным ASC/DESC |

**Возвращает:** `UpdateBuilder`

### update:limit

Устанавливает LIMIT.

```lua
local query = sql.builder.update("users")
    :set("status", "active")
    :limit(10)
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `n` | integer | Значение лимита |

**Возвращает:** `UpdateBuilder`

### update:offset

Устанавливает OFFSET.

```lua
local query = sql.builder.update("users")
    :set("status", "active")
    :offset(5)
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `n` | integer | Значение смещения |

**Возвращает:** `UpdateBuilder`

### update:suffix

Добавляет SQL-суффикс.

```lua
local query = sql.builder.update("users")
    :set("status", "active")
    :suffix("RETURNING id")
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `sql` | string | SQL-суффикс с плейсхолдерами ? |
| `args` | ...any | Аргументы привязки (опционально) |

**Возвращает:** `UpdateBuilder`

### update:from

Добавляет FROM-часть.

```lua
local query = sql.builder.update("users")
    :set("status", "active")
    :from("other_table")
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `table` | string | Имя таблицы |

**Возвращает:** `UpdateBuilder`

### update:from_select

Обновляет из SELECT-запроса.

```lua
local select_query = sql.builder.select("*"):from("temp_users")
local query = sql.builder.update("users")
    :set("status", "active")
    :from_select(select_query, "t")
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `query` | SelectBuilder | SELECT-запрос |
| `alias` | string | Алиас таблицы |

**Возвращает:** `UpdateBuilder`

### update:placeholder_format

Устанавливает формат плейсхолдеров.

```lua
local query = sql.builder.update("users")
    :placeholder_format(sql.builder.dollar)
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `format` | userdata | Формат плейсхолдеров (sql.builder.*) |

**Возвращает:** `UpdateBuilder`

### update:to_sql

Генерирует SQL-строку и аргументы привязки.

```lua
local sql_str, args = query:to_sql()
```

**Возвращает:** `string, table`

### update:run_with

Создаёт исполнитель для запроса.

```lua
local executor = query:run_with(db)
local result, err = executor:exec()
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `db` | DB\|Transaction | Дескриптор базы данных или транзакции |

**Возвращает:** `QueryExecutor`

## DELETE Builder

Fluent-интерфейс для построения DELETE-запросов.

### delete:from

Устанавливает имя таблицы.

```lua
local query = sql.builder.delete():from("users")
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `table` | string | Имя таблицы |

**Возвращает:** `DeleteBuilder`

### delete:where

Добавляет WHERE-условие.

```lua
local query = sql.builder.delete("users")
    :where({active = 0})
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `condition` | string\|table\|Sqlizer | WHERE-условие |
| `args` | ...any | Аргументы привязки (опционально, при использовании строки) |

**Возвращает:** `DeleteBuilder`

### delete:order_by

Добавляет ORDER BY-часть.

```lua
local query = sql.builder.delete("users")
    :where({active = 0})
    :order_by("created_at ASC")
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `columns` | ...string | Имена колонок с опциональным ASC/DESC |

**Возвращает:** `DeleteBuilder`

### delete:limit

Устанавливает LIMIT.

```lua
local query = sql.builder.delete("users")
    :where({active = 0})
    :limit(100)
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `n` | integer | Значение лимита |

**Возвращает:** `DeleteBuilder`

### delete:offset

Устанавливает OFFSET.

```lua
local query = sql.builder.delete("users")
    :where({active = 0})
    :offset(10)
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `n` | integer | Значение смещения |

**Возвращает:** `DeleteBuilder`

### delete:suffix

Добавляет SQL-суффикс.

```lua
local query = sql.builder.delete("users")
    :where({active = 0})
    :suffix("RETURNING id")
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `sql` | string | SQL-суффикс с плейсхолдерами ? |
| `args` | ...any | Аргументы привязки (опционально) |

**Возвращает:** `DeleteBuilder`

### delete:placeholder_format

Устанавливает формат плейсхолдеров.

```lua
local query = sql.builder.delete("users")
    :placeholder_format(sql.builder.dollar)
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `format` | userdata | Формат плейсхолдеров (sql.builder.*) |

**Возвращает:** `DeleteBuilder`

### delete:to_sql

Генерирует SQL-строку и аргументы привязки.

```lua
local sql_str, args = query:to_sql()
```

**Возвращает:** `string, table`

### delete:run_with

Создаёт исполнитель для запроса.

```lua
local executor = query:run_with(db)
local result, err = executor:exec()
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `db` | DB\|Transaction | Дескриптор базы данных или транзакции |

**Возвращает:** `QueryExecutor`

## Выполнение запросов

Исполнитель запросов для запросов, построенных конструктором.

### executor:query

Выполняет запрос и возвращает строки (для SELECT).

```lua
local rows, err = executor:query()
```

**Возвращает:** `table[], error`

### executor:exec

Выполняет запрос и возвращает результат (для INSERT/UPDATE/DELETE).

```lua
local result, err = executor:exec()
```

**Возвращает:** `table, error`

Возвращаемая таблица содержит поля:
- `last_insert_id` — ID последней вставленной записи
- `rows_affected` — количество затронутых строк

### executor:to_sql

Возвращает сгенерированный SQL и аргументы без выполнения.

```lua
local sql_str, args = executor:to_sql()
```

**Возвращает:** `string, table`

## Разрешения

Доступ к базе данных подчиняется вычислению политики безопасности.

| Действие | Ресурс | Описание |
|----------|--------|----------|
| `db.get` | ID базы данных | Получить соединение с базой данных |

## Ошибки

| Условие | Kind | Повторяемо |
|---------|------|------------|
| Пустой ID ресурса | `errors.INVALID` | нет |
| Доступ запрещён | `errors.PERMISSION_DENIED` | нет |
| Ресурс не найден | `errors.NOT_FOUND` | нет |
| Ресурс не является базой данных | `errors.INVALID` | нет |
| Некорректные параметры | `errors.INVALID` | нет |
| Синтаксическая ошибка SQL | `errors.INVALID` | нет |
| Statement закрыт | `errors.INVALID` | нет |
| Транзакция не активна | `errors.INVALID` | нет |
| Некорректное имя точки сохранения | `errors.INVALID` | нет |
| Ошибка выполнения запроса | varies | varies |

См. [Обработка ошибок](lua/core/errors.md) для работы с ошибками.

## Пример

```lua
local sql = require("sql")

-- Получить соединение с базой данных
local db, err = sql.get("app.db:main")
if err then error(err) end

-- Проверить тип базы данных
local dbtype, _ = db:type()
print("Database type:", dbtype)

-- Прямой запрос
local users, err = db:query("SELECT id, name FROM users WHERE active = ?", {1})
if err then error(err) end

for _, user in ipairs(users) do
    print(user.id, user.name)
end

-- Паттерн конструктора
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

-- Транзакция с точками сохранения
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

-- Подготовленные выражения
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

-- NULL и типизированные значения
local insert = sql.builder.insert("products")
    :columns("name", "price", "description")
    :values("Widget", sql.as.float(19.99), sql.NULL)

local executor = insert:run_with(db)
local result, err = executor:exec()
if err then error(err) end

print("Inserted ID:", result.last_insert_id)

db:release()
```
