# 迁移

`wippy/migration` 模块提供了数据库迁移框架，包含用于定义模式变更的小型 DSL、用于发现和执行迁移的运行器，以及一个为项目中每个已注册 `target_db` 运行待执行迁移的引导加载器。

迁移支持 SQLite、PostgreSQL 和 MySQL，每个驱动的 `up`/`down` 实现可并列定义。

## 配置

将模块添加到项目：

```bash
wippy add wippy/migration
wippy install
```

声明依赖以及迁移所针对的应用数据库：

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

迁移引导加载器以顺序 `20` 注册到 `wippy/bootloader`。当应用启动时，它会发现注册表中的每个迁移条目，按 `meta.target_db` 分组，并针对每个数据库运行待执行迁移。

## 定义迁移

迁移是带有 `meta.type: migration` 的 `function.lua` 条目。该条目返回由 `migration.define(...)` 生成的函数。

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

### 必需元数据

| 字段 | 必填 | 说明 |
|-------|----------|-------------|
| `meta.type` | 是 | 必须为 `"migration"` 以便被发现 |
| `meta.target_db` | 是 | 要执行的数据库的注册表 ID |
| `meta.timestamp` | 否 | ISO-8601 时间戳，用于在多个迁移针对同一数据库时排序 |
| `meta.tags` | 否 | 标签数组；运行器可按标签过滤迁移 |

某个数据库的迁移按 `meta.timestamp` 升序运行。

## DSL

在传递给 `migration.define` 的函数内部，可使用三个嵌套函数：

| 函数 | 说明 |
|----------|-------------|
| `migration(description, fn)` | 打开一个新的迁移，附带人类可读的描述 |
| `database(type, fn)` | 为 `"sqlite"`、`"postgres"` 或 `"mysql"` 声明实现 |
| `up(fn)` / `down(fn)` | 定义正向和回滚函数 |
| `after(fn)` | 可选的迁移后钩子（同一事务） |

每个 `up`/`down`/`after` 函数接收的是事务对象，而非原始连接。三个操作都在单一事务中运行，出错时会回滚。

### 事务方法

```lua
local rows, err  = db:query(sql, params)    -- SELECT, returns array of rows
local result, err = db:execute(sql, params) -- INSERT/UPDATE/DDL, returns { rows_affected, last_insert_id }
local stmt, err  = db:prepare(sql)          -- prepared statement
```

始终使用参数化查询：

```lua
db:execute("INSERT INTO users (name, email) VALUES (?, ?)", { "Alice", "alice@example.com" })
```

### 错误处理

调用 `error(...)` 将中止迁移并回滚事务。对每条可能失败的语句进行包装：

```lua
up(function(db)
    local _, err = db:execute("CREATE TABLE ...")
    if err then error(err) end
end)
```

## 运行器 API

运行器以库的形式暴露，供程序化使用：

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

对所配置数据库应用每个待执行迁移。返回摘要：

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

选项：

| 选项 | 说明 |
|--------|-------------|
| `tags` | 标签数组；仅考虑 `meta.tags` 与之有交集的迁移 |

### `runner:rollback(options)`

按 id 回滚单个迁移（必填）：

```lua
runner:rollback({ id = "app:01_create_users_table" })
```

### `runner:status(options)`

返回 `{ applied = {...}, pending = {...} }`，分别按 `applied_at` 和 `meta.timestamp` 排序。

## 注册表 API

`wippy.migration:registry` 提供直接的注册表查询：

| 函数 | 说明 |
|----------|-------------|
| `registry.find({ target_db, tags })` | 返回所有匹配条件的迁移条目 |
| `registry.get(id)` | 按 id 返回单个迁移条目 |
| `registry.get_target_dbs()` | 返回迁移中出现的每个唯一 `meta.target_db` |
| `registry.get_tags()` | 返回迁移上出现的每个唯一标签 |

引导加载器使用这些函数在启动时发现目标数据库的完整集合。

## 迁移跟踪

运行器首次执行时会在每个目标数据库中创建 `wippy_migrations` 表。已应用的迁移按 id 记录，后续运行会跳过它们。该跟踪表会自动创建；请勿编写自己的迁移来创建它。

## 最佳实践

- **每次迁移做一项逻辑变更** - 创建一张表、添加一列、创建一个索引。
- **写一个真实的 `down`** - 如果回滚不可能（数据丢失），请将其记录下来并抛出错误，而不是无声地成功。
- **优先考虑幂等性** - `CREATE TABLE IF NOT EXISTS` 和 `DROP TABLE IF EXISTS` 可在重复执行时保持稳定，无需特殊处理。
- **将 DDL 与 DML 分开** - 当可以避免时，不要在创建表的同一迁移中播种数据。
- **双向测试** - 应用迁移，回滚它，并验证模式与初始状态一致。

## 另请参阅

- [SQL 驱动](system/database.md) - 数据库资源配置
- [引导加载器](framework/bootloader.md) - 引导加载器顺序和钩子
- [框架概述](framework/overview.md) - 框架模块用法
