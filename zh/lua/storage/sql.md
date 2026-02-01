# SQL 数据库
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>
<secondary-label ref="permissions"/>

对 PostgreSQL、MySQL、SQLite、MSSQL 和 Oracle 数据库执行 SQL 查询。支持参数化查询、事务、预处理语句和流式查询构建器。

数据库配置请参阅 [数据库](system/database.md)。

## 加载

```lua
local sql = require("sql")
```

## 获取连接

从资源注册表获取数据库连接：

```lua
local db, err = sql.get("app.db:main")
if err then
    return nil, err
end

local rows = db:query("SELECT * FROM users WHERE active = ?", {1})

db:release()
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `id` | string | 资源 ID（例如 "app.db:main"） |

**返回:** `DB, error`

<note>
函数退出时连接会自动返回连接池，但对于长时间运行的操作，建议显式调用 `db:release()`。
</note>

## 常量

### 数据库类型

```lua
sql.type.POSTGRES    -- "postgres"
sql.type.MYSQL       -- "mysql"
sql.type.SQLITE      -- "sqlite"
sql.type.MSSQL       -- "mssql"
sql.type.ORACLE      -- "oracle"
sql.type.UNKNOWN     -- "unknown"
```

### 隔离级别

```lua
sql.isolation.DEFAULT           -- "default"
sql.isolation.READ_UNCOMMITTED  -- "read_uncommitted"
sql.isolation.READ_COMMITTED    -- "read_committed"
sql.isolation.WRITE_COMMITTED   -- "write_committed"
sql.isolation.REPEATABLE_READ   -- "repeatable_read"
sql.isolation.SERIALIZABLE      -- "serializable"
```

### NULL 值

```lua
local insert = sql.builder.insert("users")
    :columns("name", "email")
    :values("alice", sql.NULL)
```

## 类型转换

### as.int

```lua
local value = sql.as.int(42)
```

**返回:** `userdata`

## as.float

将值转换为 SQL float 类型。

```lua
local value = sql.as.float(19.99)
```

**返回:** `userdata`

## as.text

将值转换为 SQL text 类型。

```lua
local value = sql.as.text("hello")
```

**返回:** `userdata`

## as.binary

将值转换为 SQL binary 类型。

```lua
local value = sql.as.binary("binary data")
```

**返回:** `userdata`

## as.null

返回 SQL NULL 标记。

```lua
local value = sql.as.null()
```

**返回:** `userdata`

## 查询构建器

### 创建查询

```lua
local query = sql.builder.select("id", "name")
    :from("users")
    :where({active = 1})
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `columns` | ...string | 列名（可选） |

**返回:** `SelectBuilder`

## builder.insert

创建 INSERT 查询构建器。

```lua
local query = sql.builder.insert("users")
    :columns("name", "email")
    :values("alice", "alice@example.com")
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `table` | string | 表名（可选） |

**返回:** `InsertBuilder`

## builder.update

创建 UPDATE 查询构建器。

```lua
local query = sql.builder.update("users")
    :set("status", "active")
    :where({id = 123})
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `table` | string | 表名（可选） |

**返回:** `UpdateBuilder`

## builder.delete

创建 DELETE 查询构建器。

```lua
local query = sql.builder.delete("users")
    :where({active = 0})
    :limit(100)
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `table` | string | 表名（可选） |

**返回:** `DeleteBuilder`

## builder.expr

创建用于 where/having 子句的原始 SQL 表达式。

```lua
local expr = sql.builder.expr("score BETWEEN ? AND ?", 80, 90)
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `sql` | string | 带 ? 占位符的 SQL 表达式 |
| `args` | ...any | 绑定参数（可选） |

**返回:** `Sqlizer`

## builder.eq

从表创建等值条件。

```lua
local cond = sql.builder.eq({active = 1, status = "open"})
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `map` | table | {列名 = 值} 键值对 |

**返回:** `Sqlizer`

## builder.not_eq

从表创建不等条件。

```lua
local cond = sql.builder.not_eq({status = "closed"})
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `map` | table | {列名 = 值} 键值对 |

**返回:** `Sqlizer`

## builder.lt

从表创建小于条件。

```lua
local cond = sql.builder.lt({age = 18})
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `map` | table | {列名 = 值} 键值对 |

**返回:** `Sqlizer`

## builder.lte

从表创建小于等于条件。

```lua
local cond = sql.builder.lte({price = 100})
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `map` | table | {列名 = 值} 键值对 |

**返回:** `Sqlizer`

## builder.gt

从表创建大于条件。

```lua
local cond = sql.builder.gt({score = 80})
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `map` | table | {列名 = 值} 键值对 |

**返回:** `Sqlizer`

## builder.gte

从表创建大于等于条件。

```lua
local cond = sql.builder.gte({age = 21})
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `map` | table | {列名 = 值} 键值对 |

**返回:** `Sqlizer`

## builder.like

从表创建 LIKE 条件。

```lua
local cond = sql.builder.like({name = "john%"})
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `map` | table | {列名 = 值} 键值对 |

**返回:** `Sqlizer`

## builder.not_like

从表创建 NOT LIKE 条件。

```lua
local cond = sql.builder.not_like({email = "%@spam.com"})
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `map` | table | {列名 = 值} 键值对 |

**返回:** `Sqlizer`

## builder.and_

用 AND 组合多个条件。

```lua
local cond = sql.builder.and_({
    sql.builder.eq({active = 1}),
    sql.builder.gt({score = 80})
})
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `conditions` | table | Sqlizer 或表条件数组 |

**返回:** `Sqlizer`

## builder.or_

用 OR 组合多个条件。

```lua
local cond = sql.builder.or_({
    sql.builder.eq({status = "pending"}),
    sql.builder.eq({status = "active"})
})
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `conditions` | table | Sqlizer 或表条件数组 |

**返回:** `Sqlizer`

## builder.question

? 占位符格式（默认）。

```lua
local query = sql.builder.select("*")
    :from("users")
    :placeholder_format(sql.builder.question)
```

## builder.dollar

$1, $2, ... 占位符格式。

```lua
local query = sql.builder.select("*")
    :from("users")
    :placeholder_format(sql.builder.dollar)
```

## builder.at

@p1, @p2, ... 占位符格式。

```lua
local query = sql.builder.select("*")
    :from("users")
    :placeholder_format(sql.builder.at)
```

## builder.colon

:1, :2, ... 占位符格式。

```lua
local query = sql.builder.select("*")
    :from("users")
    :placeholder_format(sql.builder.colon)
```

## 连接方法

`sql.get()` 返回的数据库连接句柄。

### db:type

返回数据库类型常量。

```lua
local dbtype, err = db:type()
```

**返回:** `string, error`

### db:query

执行 SELECT 查询并返回行。

```lua
local rows, err = db:query("SELECT id, name FROM users WHERE active = ?", {1})
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `sql` | string | 带 ? 占位符的 SQL 查询 |
| `params` | table | 绑定参数数组（可选） |

**返回:** `table[], error`

### db:execute

执行 INSERT/UPDATE/DELETE 查询。

```lua
local result, err = db:execute("INSERT INTO users (name) VALUES (?)", {"alice"})
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `sql` | string | 带 ? 占位符的 SQL 语句 |
| `params` | table | 绑定参数数组（可选） |

**返回:** `table, error`

返回包含以下字段的表：
- `last_insert_id` - 最后插入的 ID
- `rows_affected` - 受影响的行数

### db:prepare

创建可重复执行的预处理语句。

```lua
local stmt, err = db:prepare("SELECT * FROM users WHERE id = ?")
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `sql` | string | 带 ? 占位符的 SQL |

**返回:** `Statement, error`

### db:begin

开始数据库事务。

```lua
local tx, err = db:begin({
    isolation = sql.isolation.SERIALIZABLE,
    read_only = false
})
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `options` | table | 事务选项（可选） |

选项表字段：
- `isolation` - 来自 sql.isolation.* 的隔离级别（默认：DEFAULT）
- `read_only` - 只读事务标志（默认：false）

**返回:** `Transaction, error`

### db:release

将数据库资源释放回连接池。

```lua
local ok, err = db:release()
```

**返回:** `boolean, error`

### db:stats

返回连接池统计信息。

```lua
local stats, err = db:stats()
```

**返回:** `table, error`

返回包含以下字段的表：
- `max_open_connections` - 最大允许的打开连接数
- `open_connections` - 当前打开的连接数
- `in_use` - 当前正在使用的连接数
- `idle` - 池中的空闲连接数
- `wait_count` - 总连接等待计数
- `wait_duration` - 总等待时间
- `max_idle_closed` - 因达到最大空闲数而关闭的连接数
- `max_idle_time_closed` - 因空闲超时而关闭的连接数
- `max_lifetime_closed` - 因达到最大生命周期而关闭的连接数

## 预处理语句

`db:prepare()` 返回的预处理语句。

### stmt:query

将预处理语句作为 SELECT 执行。

```lua
local rows, err = stmt:query({123})
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `params` | table | 绑定参数数组（可选） |

**返回:** `table[], error`

### stmt:execute

将预处理语句作为 INSERT/UPDATE/DELETE 执行。

```lua
local result, err = stmt:execute({"alice"})
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `params` | table | 绑定参数数组（可选） |

**返回:** `table, error`

返回包含以下字段的表：
- `last_insert_id` - 最后插入的 ID
- `rows_affected` - 受影响的行数

### stmt:close

关闭预处理语句。

```lua
local ok, err = stmt:close()
```

**返回:** `boolean, error`

## 事务

`db:begin()` 返回的数据库事务。

### tx:db_type

返回数据库类型常量。

```lua
local dbtype, err = tx:db_type()
```

**返回:** `string, error`

### tx:query

在事务中执行 SELECT 查询。

```lua
local rows, err = tx:query("SELECT id, name FROM users WHERE active = ?", {1})
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `sql` | string | 带 ? 占位符的 SQL 查询 |
| `params` | table | 绑定参数数组（可选） |

**返回:** `table[], error`

### tx:execute

在事务中执行 INSERT/UPDATE/DELETE。

```lua
local result, err = tx:execute("INSERT INTO users (name) VALUES (?)", {"alice"})
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `sql` | string | 带 ? 占位符的 SQL 语句 |
| `params` | table | 绑定参数数组（可选） |

**返回:** `table, error`

返回包含以下字段的表：
- `last_insert_id` - 最后插入的 ID
- `rows_affected` - 受影响的行数

### tx:prepare

在事务中创建预处理语句。

```lua
local stmt, err = tx:prepare("SELECT * FROM users WHERE id = ?")
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `sql` | string | 带 ? 占位符的 SQL |

**返回:** `Statement, error`

### tx:commit

提交事务。

```lua
local ok, err = tx:commit()
```

**返回:** `boolean, error`

### tx:rollback

回滚事务。

```lua
local ok, err = tx:rollback()
```

**返回:** `boolean, error`

### tx:savepoint

在事务中创建命名保存点。

```lua
local ok, err = tx:savepoint("sp1")
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `name` | string | 保存点名称（仅限字母数字和下划线） |

**返回:** `boolean, error`

### tx:rollback_to

回滚到命名保存点。

```lua
local ok, err = tx:rollback_to("sp1")
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `name` | string | 保存点名称 |

**返回:** `boolean, error`

### tx:release

释放保存点。

```lua
local ok, err = tx:release("sp1")
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `name` | string | 保存点名称 |

**返回:** `boolean, error`

## SELECT 构建器

用于构建 SELECT 查询的流式接口。

### select:from

设置 FROM 子句。

```lua
local query = sql.builder.select("id", "name"):from("users")
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `table` | string | 表名 |

**返回:** `SelectBuilder`

### select:join

添加 JOIN 子句。

```lua
local query = sql.builder.select("*")
    :from("users")
    :join("orders ON orders.user_id = users.id")
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `join` | string | 带 ? 占位符的 JOIN 子句 |
| `args` | ...any | 绑定参数（可选） |

**返回:** `SelectBuilder`

### select:left_join

添加 LEFT JOIN 子句。

```lua
local query = sql.builder.select("*")
    :from("users")
    :left_join("orders ON orders.user_id = users.id")
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `join` | string | 带 ? 占位符的 JOIN 子句 |
| `args` | ...any | 绑定参数（可选） |

**返回:** `SelectBuilder`

### select:right_join

添加 RIGHT JOIN 子句。

```lua
local query = sql.builder.select("*")
    :from("users")
    :right_join("orders ON orders.user_id = users.id")
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `join` | string | 带 ? 占位符的 JOIN 子句 |
| `args` | ...any | 绑定参数（可选） |

**返回:** `SelectBuilder`

### select:inner_join

添加 INNER JOIN 子句。

```lua
local query = sql.builder.select("*")
    :from("users")
    :inner_join("orders ON orders.user_id = users.id")
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `join` | string | 带 ? 占位符的 JOIN 子句 |
| `args` | ...any | 绑定参数（可选） |

**返回:** `SelectBuilder`

### select:where

添加 WHERE 条件。

```lua
local query = sql.builder.select("*")
    :from("users")
    :where({active = 1})
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `condition` | string\|table\|Sqlizer | WHERE 条件 |
| `args` | ...any | 绑定参数（可选，使用字符串时） |

支持三种格式：
- 字符串：`where("status = ?", "active")`
- 表：`where({status = "active"})`
- Sqlizer：`where(sql.builder.gt({score = 80}))`

**返回:** `SelectBuilder`

### select:order_by

添加 ORDER BY 子句。

```lua
local query = sql.builder.select("*")
    :from("users")
    :order_by("name ASC", "created_at DESC")
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `columns` | ...string | 列名（可选带 ASC/DESC） |

**返回:** `SelectBuilder`

### select:group_by

添加 GROUP BY 子句。

```lua
local query = sql.builder.select("status", "COUNT(*)")
    :from("users")
    :group_by("status")
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `columns` | ...string | 列名 |

**返回:** `SelectBuilder`

### select:having

添加 HAVING 条件。

```lua
local query = sql.builder.select("status", "COUNT(*) as cnt")
    :from("users")
    :group_by("status")
    :having(sql.builder.gt({cnt = 10}))
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `condition` | string\|table\|Sqlizer | HAVING 条件 |
| `args` | ...any | 绑定参数（可选，使用字符串时） |

**返回:** `SelectBuilder`

### select:limit

设置 LIMIT。

```lua
local query = sql.builder.select("*")
    :from("users")
    :limit(10)
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `n` | integer | 限制值 |

**返回:** `SelectBuilder`

### select:offset

设置 OFFSET。

```lua
local query = sql.builder.select("*")
    :from("users")
    :offset(20)
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `n` | integer | 偏移值 |

**返回:** `SelectBuilder`

### select:columns

向 SELECT 添加列。

```lua
local query = sql.builder.select():columns("id", "name", "email")
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `columns` | ...string | 列名 |

**返回:** `SelectBuilder`

### select:distinct

添加 DISTINCT 修饰符。

```lua
local query = sql.builder.select("status")
    :from("users")
    :distinct()
```

**返回:** `SelectBuilder`

### select:suffix

添加 SQL 后缀。

```lua
local query = sql.builder.select("*")
    :from("users")
    :suffix("FOR UPDATE")
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `sql` | string | 带 ? 占位符的 SQL 后缀 |
| `args` | ...any | 绑定参数（可选） |

**返回:** `SelectBuilder`

### select:placeholder_format

设置占位符格式。

```lua
local query = sql.builder.select("*")
    :from("users")
    :placeholder_format(sql.builder.dollar)
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `format` | userdata | 占位符格式（sql.builder.*） |

**返回:** `SelectBuilder`

### select:to_sql

生成 SQL 字符串和绑定参数。

```lua
local sql_str, args = query:to_sql()
```

**返回:** `string, table`

### select:run_with

创建查询执行器。

```lua
local executor = query:run_with(db)
local rows, err = executor:query()
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `db` | DB\|Transaction | 数据库或事务句柄 |

**返回:** `QueryExecutor`

## INSERT 构建器

用于构建 INSERT 查询的流式接口。

### insert:into

设置表名。

```lua
local query = sql.builder.insert():into("users")
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `table` | string | 表名 |

**返回:** `InsertBuilder`

### insert:columns

设置列名。

```lua
local query = sql.builder.insert("users"):columns("name", "email")
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `columns` | ...string | 列名 |

**返回:** `InsertBuilder`

### insert:values

添加行值。

```lua
local query = sql.builder.insert("users")
    :columns("name", "email")
    :values("alice", "alice@example.com")
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `values` | ...any | 行值 |

**返回:** `InsertBuilder`

### insert:set_map

从表设置列和值。

```lua
local query = sql.builder.insert("users")
    :set_map({name = "alice", email = "alice@example.com"})
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `map` | table | {列名 = 值} 键值对 |

**返回:** `InsertBuilder`

### insert:select

从 SELECT 查询插入。

```lua
local select_query = sql.builder.select("name", "email"):from("temp_users")
local query = sql.builder.insert("users")
    :columns("name", "email")
    :select(select_query)
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `query` | SelectBuilder | SELECT 查询 |

**返回:** `InsertBuilder`

### insert:prefix

添加 SQL 前缀。

```lua
local query = sql.builder.insert("users")
    :prefix("INSERT IGNORE INTO")
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `sql` | string | 带 ? 占位符的 SQL 前缀 |
| `args` | ...any | 绑定参数（可选） |

**返回:** `InsertBuilder`

### insert:suffix

添加 SQL 后缀。

```lua
local query = sql.builder.insert("users")
    :columns("name")
    :values("alice")
    :suffix("RETURNING id")
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `sql` | string | 带 ? 占位符的 SQL 后缀 |
| `args` | ...any | 绑定参数（可选） |

**返回:** `InsertBuilder`

### insert:options

添加 INSERT 选项。

```lua
local query = sql.builder.insert("users")
    :options("DELAYED", "IGNORE")
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `options` | ...string | INSERT 选项 |

**返回:** `InsertBuilder`

### insert:placeholder_format

设置占位符格式。

```lua
local query = sql.builder.insert("users")
    :placeholder_format(sql.builder.dollar)
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `format` | userdata | 占位符格式（sql.builder.*） |

**返回:** `InsertBuilder`

### insert:to_sql

生成 SQL 字符串和绑定参数。

```lua
local sql_str, args = query:to_sql()
```

**返回:** `string, table`

### insert:run_with

创建查询执行器。

```lua
local executor = query:run_with(db)
local result, err = executor:exec()
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `db` | DB\|Transaction | 数据库或事务句柄 |

**返回:** `QueryExecutor`

## UPDATE 构建器

用于构建 UPDATE 查询的流式接口。

### update:table

设置表名。

```lua
local query = sql.builder.update():table("users")
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `table` | string | 表名 |

**返回:** `UpdateBuilder`

### update:set

设置列值。

```lua
local query = sql.builder.update("users")
    :set("status", "active")
    :set("updated_at", sql.builder.expr("NOW()"))
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `column` | string | 列名 |
| `value` | any | 列值 |

**返回:** `UpdateBuilder`

### update:set_map

从表设置多个列。

```lua
local query = sql.builder.update("users")
    :set_map({status = "active", updated_at = sql.builder.expr("NOW()")})
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `map` | table | {列名 = 值} 键值对 |

**返回:** `UpdateBuilder`

### update:where

添加 WHERE 条件。

```lua
local query = sql.builder.update("users")
    :set("status", "active")
    :where({id = 123})
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `condition` | string\|table\|Sqlizer | WHERE 条件 |
| `args` | ...any | 绑定参数（可选，使用字符串时） |

**返回:** `UpdateBuilder`

### update:order_by

添加 ORDER BY 子句。

```lua
local query = sql.builder.update("users")
    :set("rank", 1)
    :order_by("score DESC")
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `columns` | ...string | 列名（可选带 ASC/DESC） |

**返回:** `UpdateBuilder`

### update:limit

设置 LIMIT。

```lua
local query = sql.builder.update("users")
    :set("status", "active")
    :limit(10)
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `n` | integer | 限制值 |

**返回:** `UpdateBuilder`

### update:offset

设置 OFFSET。

```lua
local query = sql.builder.update("users")
    :set("status", "active")
    :offset(5)
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `n` | integer | 偏移值 |

**返回:** `UpdateBuilder`

### update:suffix

添加 SQL 后缀。

```lua
local query = sql.builder.update("users")
    :set("status", "active")
    :suffix("RETURNING id")
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `sql` | string | 带 ? 占位符的 SQL 后缀 |
| `args` | ...any | 绑定参数（可选） |

**返回:** `UpdateBuilder`

### update:from

添加 FROM 子句。

```lua
local query = sql.builder.update("users")
    :set("status", "active")
    :from("other_table")
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `table` | string | 表名 |

**返回:** `UpdateBuilder`

### update:from_select

从 SELECT 查询更新。

```lua
local select_query = sql.builder.select("*"):from("temp_users")
local query = sql.builder.update("users")
    :set("status", "active")
    :from_select(select_query, "t")
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `query` | SelectBuilder | SELECT 查询 |
| `alias` | string | 表别名 |

**返回:** `UpdateBuilder`

### update:placeholder_format

设置占位符格式。

```lua
local query = sql.builder.update("users")
    :placeholder_format(sql.builder.dollar)
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `format` | userdata | 占位符格式（sql.builder.*） |

**返回:** `UpdateBuilder`

### update:to_sql

生成 SQL 字符串和绑定参数。

```lua
local sql_str, args = query:to_sql()
```

**返回:** `string, table`

### update:run_with

创建查询执行器。

```lua
local executor = query:run_with(db)
local result, err = executor:exec()
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `db` | DB\|Transaction | 数据库或事务句柄 |

**返回:** `QueryExecutor`

## DELETE 构建器

用于构建 DELETE 查询的流式接口。

### delete:from

设置表名。

```lua
local query = sql.builder.delete():from("users")
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `table` | string | 表名 |

**返回:** `DeleteBuilder`

### delete:where

添加 WHERE 条件。

```lua
local query = sql.builder.delete("users")
    :where({active = 0})
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `condition` | string\|table\|Sqlizer | WHERE 条件 |
| `args` | ...any | 绑定参数（可选，使用字符串时） |

**返回:** `DeleteBuilder`

### delete:order_by

添加 ORDER BY 子句。

```lua
local query = sql.builder.delete("users")
    :where({active = 0})
    :order_by("created_at ASC")
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `columns` | ...string | 列名（可选带 ASC/DESC） |

**返回:** `DeleteBuilder`

### delete:limit

设置 LIMIT。

```lua
local query = sql.builder.delete("users")
    :where({active = 0})
    :limit(100)
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `n` | integer | 限制值 |

**返回:** `DeleteBuilder`

### delete:offset

设置 OFFSET。

```lua
local query = sql.builder.delete("users")
    :where({active = 0})
    :offset(10)
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `n` | integer | 偏移值 |

**返回:** `DeleteBuilder`

### delete:suffix

添加 SQL 后缀。

```lua
local query = sql.builder.delete("users")
    :where({active = 0})
    :suffix("RETURNING id")
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `sql` | string | 带 ? 占位符的 SQL 后缀 |
| `args` | ...any | 绑定参数（可选） |

**返回:** `DeleteBuilder`

### delete:placeholder_format

设置占位符格式。

```lua
local query = sql.builder.delete("users")
    :placeholder_format(sql.builder.dollar)
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `format` | userdata | 占位符格式（sql.builder.*） |

**返回:** `DeleteBuilder`

### delete:to_sql

生成 SQL 字符串和绑定参数。

```lua
local sql_str, args = query:to_sql()
```

**返回:** `string, table`

### delete:run_with

创建查询执行器。

```lua
local executor = query:run_with(db)
local result, err = executor:exec()
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `db` | DB\|Transaction | 数据库或事务句柄 |

**返回:** `QueryExecutor`

## 执行查询

查询执行器运行构建器生成的查询。

### executor:query

执行查询并返回行（用于 SELECT）。

```lua
local rows, err = executor:query()
```

**返回:** `table[], error`

### executor:exec

执行查询并返回结果（用于 INSERT/UPDATE/DELETE）。

```lua
local result, err = executor:exec()
```

**返回:** `table, error`

返回包含以下字段的表：
- `last_insert_id` - 最后插入的 ID
- `rows_affected` - 受影响的行数

### executor:to_sql

返回生成的 SQL 和参数但不执行。

```lua
local sql_str, args = executor:to_sql()
```

**返回:** `string, table`

## 权限

数据库访问受安全策略评估约束。

| 操作 | 资源 | 描述 |
|--------|----------|-------------|
| `db.get` | 数据库 ID | 获取数据库连接 |

## 错误

| 条件 | 类型 | 可重试 |
|-----------|------|-----------|
| 资源 ID 为空 | `errors.INVALID` | 否 |
| 权限被拒绝 | `errors.PERMISSION_DENIED` | 否 |
| 资源未找到 | `errors.NOT_FOUND` | 否 |
| 资源不是数据库 | `errors.INVALID` | 否 |
| 参数无效 | `errors.INVALID` | 否 |
| SQL 语法错误 | `errors.INVALID` | 否 |
| 语句已关闭 | `errors.INVALID` | 否 |
| 事务未激活 | `errors.INVALID` | 否 |
| 保存点名称无效 | `errors.INVALID` | 否 |
| 查询执行错误 | 各种 | 各种 |

错误处理请参阅 [错误处理](lua/core/errors.md)。

## 示例

```lua
local sql = require("sql")

-- 获取数据库连接
local db, err = sql.get("app.db:main")
if err then error(err) end

-- 检查数据库类型
local dbtype, _ = db:type()
print("Database type:", dbtype)

-- 直接查询
local users, err = db:query("SELECT id, name FROM users WHERE active = ?", {1})
if err then error(err) end

for _, user in ipairs(users) do
    print(user.id, user.name)
end

-- 构建器模式
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

-- 带保存点的事务
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

-- 预处理语句
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

-- NULL 和类型化值
local insert = sql.builder.insert("products")
    :columns("name", "price", "description")
    :values("Widget", sql.as.float(19.99), sql.NULL)

local executor = insert:run_with(db)
local result, err = executor:exec()
if err then error(err) end

print("Inserted ID:", result.last_insert_id)

db:release()
```
