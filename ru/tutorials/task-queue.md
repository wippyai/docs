# Task Queue

Создание REST API, которое ставит задачи в очередь для фоновой обработки с сохранением в базе данных.

## Обзор

В этом руководстве создаётся API управления задачами, демонстрирующее:

- **REST-эндпоинты** — POST для создания задач, GET для получения результатов
- **Публикация в очередь** — асинхронная отправка заданий
- **Консьюмеры очереди** — фоновые воркеры
- **Персистентность в БД** — хранение в SQLite
- **Миграции** — одноразовый процесс, завершающийся после выполнения

```mermaid
flowchart LR
    subgraph api["HTTP Server"]
        POST["/tasks POST"]
        GET["/tasks GET"]
    end

    subgraph queue["Queue"]
        Q[("tasks queue")]
    end

    subgraph workers["Workers"]
        W1["Consumer 1"]
        W2["Consumer 2"]
    end

    subgraph storage["Storage"]
        DB[(SQLite)]
    end

    POST -->|publish| Q
    Q --> W1
    Q --> W2
    W1 -->|INSERT| DB
    W2 -->|INSERT| DB
    GET -->|SELECT| DB
```

## Структура проекта

```
task-queue/
├── wippy.lock
└── src/
    ├── _index.yaml
    ├── migrate.lua
    ├── create_task.lua
    ├── list_tasks.lua
    └── process_task.lua
```

## Определения записей

Создайте `src/_index.yaml`:

```yaml
version: "1.0"
namespace: app

entries:
  # База данных SQLite
  - name: db
    kind: db.sql.sqlite
    file: "./data/tasks.db"
    lifecycle:
      auto_start: true

  # Драйвер очереди в памяти
  - name: queue_driver
    kind: queue.driver.memory
    lifecycle:
      auto_start: true

  # Очередь задач
  - name: tasks_queue
    kind: queue.queue
    driver: app:queue_driver

  # HTTP-сервер
  - name: gateway
    kind: http.service
    addr: ":8080"
    lifecycle:
      auto_start: true

  # Роутер
  - name: router
    kind: http.router
    meta:
      server: app:gateway

  # Процесс миграции (выполняется один раз, завершается)
  - name: migrate
    kind: process.lua
    source: file://migrate.lua
    method: main
    modules:
      - sql
      - logger

  # Сервис миграции (автозапуск, завершается при успехе)
  - name: migrate-service
    kind: process.service
    process: app:migrate
    host: app:processes
    lifecycle:
      auto_start: true

  # Хост процессов
  - name: processes
    kind: process.host
    lifecycle:
      auto_start: true

  # Обработчики API
  - name: create_task
    kind: function.lua
    source: file://create_task.lua
    method: handler
    modules:
      - http
      - queue
      - uuid

  - name: list_tasks
    kind: function.lua
    source: file://list_tasks.lua
    method: handler
    modules:
      - http
      - sql

  # Воркер очереди
  - name: process_task
    kind: function.lua
    source: file://process_task.lua
    method: main
    modules:
      - queue
      - sql
      - logger
      - time
      - json

  # Эндпоинты
  - name: create_task.endpoint
    kind: http.endpoint
    meta:
      router: app:router
    method: POST
    path: /tasks
    func: app:create_task

  - name: list_tasks.endpoint
    kind: http.endpoint
    meta:
      router: app:router
    method: GET
    path: /tasks
    func: app:list_tasks

  # Консьюмер очереди
  - name: task_consumer
    kind: queue.consumer
    queue: app:tasks_queue
    func: app:process_task
    concurrency: 2
    prefetch: 5
    lifecycle:
      auto_start: true
```

## Процесс миграции

Создайте `src/migrate.lua`:

```lua
local sql = require("sql")
local logger = require("logger")

local function main()
    local db, err = sql.get("app:db")
    if err then
        logger:error("failed to connect", {error = tostring(err)})
        return 1
    end

    local _, exec_err = db:execute([[
        CREATE TABLE IF NOT EXISTS tasks (
            id TEXT PRIMARY KEY,
            payload TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            result TEXT,
            created_at INTEGER NOT NULL,
            processed_at INTEGER
        )
    ]])

    db:release()

    if exec_err then
        logger:error("migration failed", {error = tostring(exec_err)})
        return 1
    end

    logger:info("migration complete")
    return 0
end

return { main = main }
```

<tip>
Возврат 0 сигнализирует об успехе. Супервизор не перезапустит процесс, который завершился нормально с кодом 0.
</tip>

## Эндпоинт создания задачи

Создайте `src/create_task.lua`:

```lua
local http = require("http")
local queue = require("queue")
local uuid = require("uuid")

local function handler()
    local req, req_err = http.request()
    local res, res_err = http.response()

    if not req or not res then
        return nil, "failed to get HTTP context"
    end

    local body, parse_err = req:body_json()
    if parse_err then
        res:set_status(http.STATUS.BAD_REQUEST)
        res:write_json({error = "invalid JSON"})
        return
    end

    if not body.action then
        res:set_status(http.STATUS.BAD_REQUEST)
        res:write_json({error = "action required"})
        return
    end

    local task_id = uuid.v4()
    local task = {
        id = task_id,
        action = body.action,
        data = body.data or {},
        created_at = os.time()
    }

    local ok, err = queue.publish("app:tasks_queue", task)
    if err then
        res:set_status(http.STATUS.INTERNAL_SERVER_ERROR)
        res:write_json({error = "failed to queue task"})
        return
    end

    res:set_status(http.STATUS.ACCEPTED)
    res:write_json({
        id = task_id,
        status = "queued"
    })
end

return { handler = handler }
```

## Эндпоинт списка задач

Создайте `src/list_tasks.lua`:

```lua
local http = require("http")
local sql = require("sql")

local function handler()
    local req, req_err = http.request()
    local res, res_err = http.response()

    if not req or not res then
        return nil, "failed to get HTTP context"
    end

    local db, db_err = sql.get("app:db")
    if db_err then
        res:set_status(http.STATUS.INTERNAL_SERVER_ERROR)
        res:write_json({error = "database unavailable"})
        return
    end

    local status_filter = req:query("status")

    local query = sql.builder.select("id", "payload", "status", "result", "created_at", "processed_at")
        :from("tasks")
        :order_by("created_at DESC")
        :limit(100)

    if status_filter then
        query = query:where({status = status_filter})
    end

    local rows, query_err = query:run_with(db):query()
    db:release()

    if query_err then
        res:set_status(http.STATUS.INTERNAL_SERVER_ERROR)
        res:write_json({error = "query failed"})
        return
    end

    res:set_status(http.STATUS.OK)
    res:write_json({
        tasks = rows,
        count = #rows
    })
end

return { handler = handler }
```

## Воркер очереди

Создайте `src/process_task.lua`:

```lua
local queue = require("queue")
local sql = require("sql")
local logger = require("logger")
local time = require("time")
local json = require("json")

local function main(task)
    local msg, msg_err = queue.message()
    if msg_err then
        logger:error("failed to get message", {error = tostring(msg_err)})
        return false
    end

    logger:info("processing task", {
        id = task.id,
        action = task.action
    })

    -- Симуляция работы
    time.sleep("100ms")

    -- Обработка по типу действия
    local result
    if task.action == "uppercase" then
        result = {output = string.upper(task.data.text or "")}
    elseif task.action == "sum" then
        local nums = task.data.numbers or {}
        local total = 0
        for _, n in ipairs(nums) do
            total = total + n
        end
        result = {output = total}
    else
        result = {output = "processed"}
    end

    -- Сохранение в базу данных
    local db, db_err = sql.get("app:db")
    if db_err then
        logger:error("database unavailable", {error = tostring(db_err)})
        return false
    end

    local insert = sql.builder.insert("tasks")
        :columns("id", "payload", "status", "result", "created_at", "processed_at")
        :values(
            task.id,
            json.encode(task),
            "completed",
            json.encode(result),
            task.created_at,
            os.time()
        )

    local _, exec_err = insert:run_with(db):exec()
    db:release()

    if exec_err then
        logger:error("failed to store result", {error = tostring(exec_err)})
        return false
    end

    logger:info("task completed", {id = task.id})
    return true
end

return { main = main }
```

<note>
Возврат `true` подтверждает сообщение. Возврат `false` приводит к возврату сообщения в очередь или отправке в dead-letter queue.
</note>

## Запуск сервиса

Инициализация и запуск:

```bash
mkdir -p data
wippy init
wippy run
```

Тестирование API:

```bash
# Создание задачи
curl -X POST http://localhost:8080/tasks \
  -H "Content-Type: application/json" \
  -d '{"action": "uppercase", "data": {"text": "hello world"}}'

# Ответ: {"id": "550e8400-...", "status": "queued"}

# Подождите немного для обработки, затем получите список задач
curl http://localhost:8080/tasks

# Ответ: {"tasks": [...], "count": 1}

# Фильтр по статусу
curl "http://localhost:8080/tasks?status=completed"
```

## Поток сообщений

1. **POST /tasks** получает запрос, генерирует UUID, публикует в очередь
2. **Консьюмер очереди** забирает сообщение (2 параллельных воркера)
3. **Воркер** обрабатывает задачу, записывает результат в SQLite
4. **GET /tasks** читает завершённые задачи из базы данных

## Продемонстрированные концепции

| Концепция | API | Описание |
|-----------|-----|----------|
| REST-эндпоинты | `http.request()`, `http.response()` | Обработка HTTP-запросов |
| Публикация в очередь | `queue.publish(id, data)` | Отправка асинхронных заданий |
| Потребление из очереди | `queue.message()` | Доступ к сообщению в обработчике |
| Запросы к БД | `sql.get()`, `db:query()` | Чтение данных |
| Query builder | `sql.builder.insert()` | Безопасное построение SQL |
| Миграции | Процесс, возвращающий 0 | Одноразовые задачи настройки |
| Параллелизм | `concurrency: 2` | Параллельные воркеры |

## Следующие шаги

- [Модуль HTTP](lua/http/http.md) — обработка запросов/ответов
- [Модуль Queue](lua/storage/queue.md) — операции с очередями
- [Модуль SQL](lua/storage/sql.md) — доступ к базе данных
- [Консьюмеры очередей](guides/queue-consumers.md) — конфигурация очередей
