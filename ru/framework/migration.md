---
title: "Migrations"
description: "Модуль wippy/migration предоставляет фреймворк миграций базы данных с компактным DSL для описания изменений схемы, раннер, который обнаруживает и…"
---

# Migrations

Модуль `wippy/migration` предоставляет фреймворк миграций базы данных с компактным DSL для описания изменений схемы, раннер, который обнаруживает и выполняет их, и загрузчик, запускающий ожидающие миграции для каждого `target_db`, зарегистрированного в проекте.

Миграции поддерживают SQLite, PostgreSQL и MySQL, с реализациями `up`/`down` для каждого драйвера, определёнными рядом.

## Настройка

Добавьте модуль в проект:

```bash
wippy add wippy/migration
wippy install
```

Объявите зависимость и базу данных приложения, на которую нацелены миграции:

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

Загрузчик миграций регистрируется в `wippy/bootloader` с порядком `20`. При запуске приложения он обнаруживает каждую запись миграции в реестре, группирует их по `meta.target_db` и выполняет ожидающие миграции для каждой базы данных.

## Определение миграции

Миграция -- это запись `function.lua` с `meta.type: migration`. Запись возвращает функцию, созданную `migration.define(...)`.

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

### Обязательные метаданные

| Поле | Обязательное | Описание |
|------|--------------|----------|
| `meta.type` | да | Должно быть `"migration"` для обнаружения |
| `meta.target_db` | да | Идентификатор реестра базы данных для выполнения |
| `meta.timestamp` | нет | Метка времени ISO-8601, используемая для упорядочивания, когда несколько миграций нацелены на одну базу данных |
| `meta.tags` | нет | Массив тегов; раннер может фильтровать миграции по тегам |

Миграции для одной базы данных выполняются по возрастанию `meta.timestamp`. `meta.timestamp` необязателен; полный идентификатор записи служит разрешителем ничьей, поэтому миграции с одинаковыми или отсутствующими метками времени всё равно выполняются в стабильном детерминированном порядке.

## DSL

Внутри функции, переданной в `migration.define`, доступны следующие вложенные функции:

| Функция | Описание |
|---------|----------|
| `migration(description, fn)` | Открыть новую миграцию с человекочитаемым описанием |
| `database(type, fn)` | Объявить реализацию для `"sqlite"`, `"postgres"` или `"mysql"` |
| `up(fn)` / `down(fn)` | Определить функции применения и отката |
| `after(fn)` | Опциональный хук после миграции (та же транзакция) |

Каждая функция `up`/`down`/`after` получает объект транзакции, а не сырое соединение. Все три операции выполняются в одной транзакции, которая откатывается при ошибке.

### Методы транзакции

```lua
local rows, err  = db:query(sql, params)    -- SELECT, returns array of rows
local result, err = db:execute(sql, params) -- INSERT/UPDATE/DDL, returns { rows_affected, last_insert_id }
local stmt, err  = db:prepare(sql)          -- prepared statement
```

Всегда используйте параметризованные запросы:

```lua
db:execute("INSERT INTO users (name, email) VALUES (?, ?)", { "Alice", "alice@example.com" })
```

### Обработка ошибок

Вызов `error(...)` прерывает миграцию и откатывает транзакцию. Оборачивайте каждый оператор, который может завершиться неудачей:

```lua
up(function(db)
    local _, err = db:execute("CREATE TABLE ...")
    if err then error(err) end
end)
```

## API раннера

Раннер экспонируется как библиотека для программного использования:

```yaml
imports:
  runner: wippy.migration:runner
```

```lua
local runner = require("runner").setup("app:app_db")

local result = runner:run()      -- apply all pending migrations
local result = runner:run_next() -- apply the next pending migration
local result = runner:rollback() -- roll back the most recently applied migration
local status = runner:status()   -- list applied + pending migrations
```

### `runner:run(options)`

Применяет все ожидающие миграции для настроенной базы данных. Возвращает сводку:

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

Опции:

| Опция | Описание |
|-------|----------|
| `tags` | Массив тегов; рассматриваются только миграции, у которых `meta.tags` пересекаются |

### `runner:rollback(options)`

Откатывает применённые миграции в порядке, обратном порядку применения. Без опций откатывает единственную последнюю применённую миграцию:

```lua
runner:rollback()                                            -- roll back the last migration
runner:rollback({ count = 3 })                               -- roll back the last 3
runner:rollback({ allowed_ids = { "app:01_create_users_table" } }) -- restrict to specific ids
```

Опции:

| Опция | Описание |
|-------|----------|
| `count` | Количество откатываемых миграций; по умолчанию `1` |
| `allowed_ids` | Массив идентификаторов миграций; только они допускаются к откату |

### `runner:status(options)`

Возвращает отчёт о состоянии, описывающий каждую миграцию для базы данных:

```lua
{
    database_id        = "app:app_db",
    db_type            = "sqlite",
    total_migrations   = 3,
    applied_migrations = 2,
    pending_migrations = 1,
    migrations = {
        { id = "app:01_...", description = "...", timestamp = "...",
          tags = {}, status = "applied", applied_at = ... },
        -- ...
    },
}
```

Применённые миграции перечисляются первыми (упорядочены по `applied_at`), затем ожидающие (упорядочены по `meta.timestamp`, затем по идентификатору).

## API реестра

`wippy.migration:registry` предоставляет прямые запросы к реестру:

| Функция | Описание |
|---------|----------|
| `registry.find({ target_db, tags })` | Вернуть все записи миграций, соответствующие критериям |
| `registry.get(id)` | Вернуть одну запись миграции по идентификатору |
| `registry.get_target_dbs()` | Вернуть все уникальные `meta.target_db`, присутствующие в миграциях |
| `registry.get_tags()` | Вернуть все уникальные теги, присутствующие в миграциях |

Загрузчик использует их для обнаружения полного набора целевых баз данных при запуске.

## Отслеживание миграций

Раннер создаёт таблицу `_migrations` в каждой целевой базе данных при первом запуске. Применённые миграции записываются по идентификатору, чтобы последующие запуски пропускали их. Таблица отслеживания создаётся автоматически; не пишите собственную миграцию для её создания.

## Рекомендации

- **Одно логическое изменение на миграцию** -- создать одну таблицу, добавить один столбец, создать один индекс.
- **Пишите настоящий `down`** -- если откат невозможен (потеря данных), задокументируйте это и вызовите ошибку, а не молчаливо завершайте успехом.
- **Предпочитайте идемпотентность** -- `CREATE TABLE IF NOT EXISTS` и `DROP TABLE IF EXISTS` переживают повторные запуски без специальной обработки.
- **Разделяйте DDL и DML** -- по возможности не засевайте данные в той же миграции, где создаётся таблица.
- **Тестируйте оба направления** -- примените миграцию, откатите её и убедитесь, что схема соответствует начальному состоянию.

## См. также

- [SQL-драйвер](system/database.md) -- Конфигурация ресурса базы данных
- [Загрузчик](framework/bootloader.md) -- Порядок и хуки загрузчика
- [Обзор фреймворка](framework/overview.md) -- Использование модулей фреймворка
