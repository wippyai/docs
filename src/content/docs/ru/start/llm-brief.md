---
title: "Краткая справка для LLM"
---

# Краткая справка для LLM

Эта страница предназначена для ИИ-агентов и LLM. Если вы разрабатываете на Wippy или генерируете код для проекта Wippy, прочтите это в первую очередь.

## Что такое Wippy

Wippy — это среда выполнения приложений в виде одного бинарника, построенная на модели акторов. Она запускает код Lua в изолированных процессах с передачей сообщений — без разделяемой памяти, без блокировок. Существует три вычислительные модели: функции (без состояния, в рамках запроса), процессы (долгоживущие акторы с состоянием) и рабочие процессы (durable-акторы на базе Temporal, переживающие сбои). Система спроектирована так, чтобы агенты могли генерировать код, регистрировать его и улучшать приложения без повторного развёртывания.

## Ментальная модель

Всё в Wippy — это **запись реестра** (registry entry). Записи имеют ID (`namespace:name`), вид (определяющий поведение), метаданные и данные. YAML-файлы — один из способов объявления записей, но реестр является источником истины во время выполнения, и записи могут создаваться, обновляться или удаляться во время работы системы.

Виды определяют, что делает запись:

- `function.lua` — вызываемая функция без состояния
- `process.lua` — долгоживущий актор
- `workflow.lua` — durable-воркфлоу (Temporal)
- `http.service` — HTTP-сервер
- `http.router` — группа маршрутов с middleware
- `http.endpoint` — HTTP-обработчик
- `db.sql.postgres` / `mysql` / `sqlite` — подключение к БД
- `store.memory` / `store.sql` — key-value хранилище
- `queue.queue` — очередь сообщений
- `process.host` — хост выполнения процессов
- `process.service` — контролируемый процесс
- `contract.definition` / `contract.binding` — типизированные интерфейсы сервисов
- `registry.entry` — данные конфигурации

## Структура проекта

```
myapp/
├── .wippy.yaml              # Runtime configuration
├── wippy.lock               # Source directories
└── src/
    ├── _index.yaml          # Entry definitions (namespace: app)
    ├── api/
    │   ├── _index.yaml      # namespace: app.api
    │   └── handler.lua
    └── workers/
        ├── _index.yaml      # namespace: app.workers
        └── task.lua
```

Определения записей находятся в файлах `_index.yaml`:

```yaml
version: "1.0"
namespace: app.api

entries:
  - name: get_user
    kind: function.lua
    source: file://handler.lua
    method: get_user
    modules: [sql, json]

  - name: get_user.endpoint
    kind: http.endpoint
    meta:
      router: app:api_router
    method: GET
    path: /users/{id}
    func: app.api:get_user
```

## Написание функций

Функции не имеют состояния. Они получают аргументы, выполняют работу и возвращают результаты. Они наследуют контекст вызывающего и отменяются, если вызывающий отменён.

```lua
local sql = require("sql")
local json = require("json")
local http = require("http")

local function get_user(id)
    local db, err = sql.get("app:main_db")
    if err then return nil, err end

    local rows, err = db:query("SELECT * FROM users WHERE id = $1", id)
    if err then return nil, err end
    if #rows == 0 then return nil, errors.new(errors.NOT_FOUND, "user not found") end

    return rows[1]
end

return get_user
```

Для HTTP-обработчиков используйте модуль `http`:

```lua
local http = require("http")
local json = require("json")

local function handler()
    local req = http.request()
    local res = http.response()

    local id = req:param("id")
    local user, err = funcs.call("app.api:get_user", id)
    if err then
        res:set_status(404)
        res:write_json({error = err:message()})
        return
    end

    res:write_json(user)
end

return handler
```

## Написание процессов

Процессы — это акторы. У них есть собственный PID, они получают сообщения через inbox и сохраняют состояние между сообщениями. Они уступают выполнение при блокирующем I/O, что позволяет тысячам из них работать одновременно.

```lua
local function worker(initial_config)
    local inbox = process.inbox()
    local events = process.events()

    while true do
        local r = channel.select {
            inbox:case_receive(),
            events:case_receive()
        }

        if r.channel == events then
            local ev = r.value
            if ev.type == process.event.CANCEL then
                break
            end
        elseif r.channel == inbox then
            local msg = r.value
            local topic = msg:topic()
            local data = msg:payload():data()
            handle_message(topic, data)
        end
    end
end

return worker
```

Запускайте процессы из другого кода:

```lua
local pid = process.spawn("app.workers:task", "app:process_host", config)
process.send(pid, "work", {item_id = 123})
```

## Написание воркфлоу

Воркфлоу durable — они переживают сбои и перезапуски. Код выглядит как обычный Lua. Среда выполнения автоматически записывает результаты вызовов функций, сны и случайные значения, чтобы воспроизведение было детерминированным.

```lua
local function order_flow(order)
    local inventory = funcs.call("app:reserve_inventory", order.items)
    if not inventory then
        return nil, errors.new("out of stock")
    end

    local payment = funcs.call("app:charge_payment", order.total)
    if not payment then
        funcs.call("app:release_inventory", inventory.id)
        return nil, errors.new("payment failed")
    end

    -- Wait for approval signal (can block for days)
    local msg = process.inbox():receive()
    if not msg:payload():data().approved then
        funcs.call("app:refund_payment", payment.id)
        funcs.call("app:release_inventory", inventory.id)
        return nil, errors.new("rejected")
    end

    return funcs.call("app:fulfill_order", order.id)
end

return order_flow
```

## Ключевые API

### Вызов функций

```lua
local funcs = require("funcs")

-- Synchronous
local result, err = funcs.call("namespace:function_name", arg1, arg2)

-- Asynchronous (returns Future)
local future = funcs.async("namespace:function_name", arg1)
local result, err = future:result()

-- With context
local exec = funcs.new():with_context({user_id = "123"})
exec:call("namespace:function_name")
```

### Взаимодействие процессов

```lua
-- Send message (fire-and-forget)
process.send(pid, "topic", data)

-- Receive messages
local inbox = process.inbox()
local msg, ok = inbox:receive()
local topic = msg:topic()
local data = msg:payload():data()

-- Monitor another process (receive EXIT on death)
process.monitor(pid)

-- Link processes (bidirectional failure notification)
process.spawn_linked("namespace:name", "host")
```

### Каналы

Каналы в стиле Go для взаимодействия корутин:

```lua
local ch = channel.new(10)  -- buffered
ch:send(value)
local val, ok = ch:receive()

-- Select on multiple channels
local r = channel.select {
    ch1:case_receive(),
    ch2:case_receive(),
    timeout:case_receive()
}
```

### Обработка ошибок

Функции возвращают пары `result, error`. Ошибки — это типизированные объекты:

```lua
local result, err = some_operation()
if err then
    if errors.is(err, errors.NOT_FOUND) then
        -- handle not found
    end
    return nil, errors.wrap(err, "context message")
end
```

Виды ошибок: `UNKNOWN`, `INVALID`, `NOT_FOUND`, `ALREADY_EXISTS`, `PERMISSION_DENIED`, `TIMEOUT`, `CANCELED`, `UNAVAILABLE`, `INTERNAL`, `CONFLICT`, `RATE_LIMITED`.

### Доступ к данным

```lua
-- SQL
local sql = require("sql")
local db = sql.get("app:main_db")
local rows, err = db:query("SELECT * FROM users WHERE active = $1", true)
db:execute("INSERT INTO users (name) VALUES ($1)", name)

-- Key-value store
local store = require("store")
local cache = store.get("app:cache")
cache:set("key", value, 3600)  -- TTL in seconds
local val = cache:get("key")

-- Queue
local queue = require("queue")
queue.publish("app:tasks", {task = "process", id = 123})

-- Filesystem
local fs = require("fs")
local vol = fs.get("app:storage")
local data = vol:readfile("path/to/file.txt")
vol:writefile("output.txt", content)
```

### HTTP-клиент

```lua
local http_client = require("http_client")

local resp, err = http_client.get("https://api.example.com/data", {
    headers = {Authorization = "Bearer token"},
    timeout = "10s"
})
local body = resp.body
```

### Безопасность

```lua
local security = require("security")

local actor = security.actor()       -- who is calling
local scope = security.scope()       -- what permissions apply
local allowed = security.can("read", "resource:users")

-- Token management
local ts = security.token_store("app:tokens")
local token = ts:create(actor, scope, {expiration = "24h"})
local validated_actor, validated_scope = ts:validate(token)
```

### Время

```lua
local time = require("time")

time.sleep("5s")
local now = time.now()
local timeout = time.after("30s")  -- channel that fires once
local ticker = time.ticker("10s")  -- repeating channel
```

### Реестр

```lua
local registry = require("registry")

local entry = registry.get("app.api:get_user")
local tests = registry.find({["meta.type"] = "test"})

-- Create entries at runtime
local snap = registry.snapshot()
local changes = snap:changes()
changes:create({id = "app:new_func", kind = "function.lua", data = {...}})
changes:apply()
```

### События

```lua
local events = require("events")

-- Publish
events.send("orders", "order.created", "/orders/123", {order_id = "123"})

-- Subscribe (wildcards supported)
local sub = events.subscribe("orders.*")
local ch = sub:channel()
local evt = ch:receive()
```

## Контроль доступа к модулям

Каждая запись объявляет, какие модули она может `require()`. Модули, не указанные в списке, просто недоступны — нет `os.execute`, `io.open`, `debug.*` или `package.*`, если вы явно их не разрешили. Среда выполнения не сканирует и не валидирует исходный код; она контролирует доступ на уровне модуля. Если модуль не в списке, для данной записи он не существует.

```yaml
modules: [sql, json, http, time, funcs, store]
```

Так же работает и детерминизм воркфлоу — воркфлоу-записи получают только детерминированные модули. Среда выполнения перехватывает `time.now()`, `uuid.v4()` и другие недетерминированные вызовы на уровне модуля, записывая результаты для воспроизведения.

## Модули фреймворка

В Wippy есть модули фреймворка, устанавливаемые через зависимости:

- **wippy/llm** — интеграция LLM (OpenAI, Anthropic, Google). `llm.generate()`, структурированный вывод, эмбеддинги, стриминг.
- **wippy/agent** — агентный фреймворк с вызовом инструментов, делегированием, трейтами, памятью. Агенты определяются как записи реестра.
- **wippy/test** — BDD-тестирование. Блоки `describe/it`, утверждения, моки.
- **wippy/dataflow** — оркестрация воркфлоу на базе DAG. Узлы Function, Agent, Cycle, Parallel.
- **wippy/relay** — WebSocket-реле с центральным хабом, пользовательскими хабами, маршрутизацией плагинов.
- **wippy/views** — система страниц и компонентов с рендерингом шаблонов.
- **wippy/facade** — фронтенд iframe-фасад с мостом аутентификации.

## Соглашения

- ID записей используют формат `namespace:name`
- Имена используют точки для семантического разделения, подчёркивания для слов: `get_user.endpoint`
- Функции возвращают `result, error` — всегда проверяйте ошибку
- Процессы взаимодействуют через передачу сообщений, никогда через общее состояние
- Используйте `channel.select` для мультиплексирования нескольких источников событий
- Деревья супервизоров обрабатывают сбои — проектируйте по принципу "let it crash"
- Контекст (trace ID, информация о пользователе, безопасность) автоматически распространяется через вызовы функций
- Воркфлоу не должны напрямую использовать недетерминированные операции — среда выполнения обрабатывает это для `funcs.call`, `time.sleep`, `uuid.v4`, `time.now`

## Документация

Полная документация доступна на [wippy.ai/docs](https://wippy.ai/docs). Эндпоинты, удобные для LLM:

- Просмотр структуры: `https://wippy.ai/llm/toc`
- Поиск: `https://wippy.ai/llm/search?q=query`
- Получение страницы: `https://wippy.ai/llm/path/en/<path>`
- Пакетное получение: `https://wippy.ai/llm/context?paths=path1,path2`
