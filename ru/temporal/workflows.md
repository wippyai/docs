# Workflow

Workflow — это устойчивые функции, оркеструющие activity и сохраняющие состояние при сбоях и перезапусках. Определяются с помощью типа записи `workflow.lua`.

## Определение

```yaml
- name: order_workflow
  kind: workflow.lua
  source: file://order_workflow.lua
  method: main
  modules:
    - funcs
    - time
    - workflow
  meta:
    temporal:
      workflow:
        worker: app:worker
```

### Поля метаданных

| Поле | Обязательно | Описание |
|------|-------------|----------|
| `worker` | Да | Ссылка на запись `temporal.worker` |
| `name` | Нет | Пользовательское имя типа workflow (по умолчанию ID записи) |

## Базовая реализация

```lua
local funcs = require("funcs")
local time = require("time")

local function main(order)
    local payment, err = funcs.call("app:charge_payment", {
        amount = order.total,
        customer = order.customer_id
    })
    if err then
        return {status = "failed", error = tostring(err)}
    end

    time.sleep("1h")

    local shipment, err = funcs.call("app:ship_order", {
        order_id = order.id,
        address = order.shipping_address
    })
    if err then
        funcs.call("app:refund_payment", payment.id)
        return {status = "failed", error = tostring(err)}
    end

    return {
        status = "completed",
        payment_id = payment.id,
        tracking = shipment.tracking_number
    }
end

return { main = main }
```

## Модуль workflow

Модуль `workflow` предоставляет специфичные для workflow операции.

### workflow.info()

Получение информации о текущем выполнении workflow:

```lua
local workflow = require("workflow")

local info = workflow.info()
print(info.workflow_id)    -- Workflow execution ID
print(info.run_id)         -- Current run ID
print(info.workflow_type)  -- Workflow type name
print(info.task_queue)     -- Task queue name
print(info.namespace)      -- Temporal namespace
print(info.attempt)        -- Current attempt number
print(info.history_length) -- Number of history events
print(info.history_size)   -- History size in bytes
```

### workflow.exec()

Синхронный запуск дочернего workflow с ожиданием результата:

```lua
local result, err = workflow.exec("app:child_workflow", input_data)
if err then
    return nil, err
end
```

Простейший способ запуска дочерних workflow, когда нужно дождаться результата в текущем потоке.

### workflow.version()

Обработка изменений кода с детерминированным версионированием:

```lua
local version = workflow.version("payment-v2", 1, 2)

if version == 1 then
    result = funcs.call("app:old_payment", input)
else
    result = funcs.call("app:new_payment", input)
end
```

Параметры:
- `change_id` — уникальный идентификатор изменения
- `min_supported` — минимальная поддерживаемая версия
- `max_supported` — максимальная (текущая) версия

Номер версии детерминирован для каждого выполнения workflow. Уже запущенные workflow продолжают использовать записанную версию, а новые используют `max_supported`.

### workflow.attrs()

Обновление поисковых атрибутов и memo:

```lua
workflow.attrs({
    search = {
        status = "processing",
        customer_id = order.customer_id,
        order_total = order.total
    },
    memo = {
        notes = "Priority customer",
        source = "web"
    }
})
```

Поисковые атрибуты индексируются и доступны для запросов через Temporal visibility API. Memo — произвольные неиндексированные данные, прикреплённые к workflow.

### workflow.history_length() / workflow.history_size()

Мониторинг роста истории workflow:

```lua
local length = workflow.history_length()
local size = workflow.history_size()

if length > 10000 then
    -- Consider continue-as-new to reset history
end
```

## Запуск workflow

### Базовый spawn

Запуск workflow из любого кода с помощью `process.spawn()`:

```lua
local pid, err = process.spawn(
    "app:order_workflow",    -- workflow entry
    "app:worker",            -- temporal worker
    {order_id = "123"}       -- input
)
```

Второй параметр указывает на temporal worker (не на обычный хост процессов). Workflow выполняется устойчиво в инфраструктуре Temporal.

### Spawn с мониторингом

Мониторинг workflow для получения событий EXIT при завершении:

```lua
local pid, err = process.spawn_monitored(
    "app:order_workflow",
    "app:worker",
    {order_id = "123"}
)

local events = process.events()
local event = events:receive()

if event.kind == process.event.EXIT then
    local result = event.result.value
    local error = event.result.error
end
```

### Spawn с именем

Назначение имени workflow для идемпотентных запусков:

```lua
local spawner = process
    .with_options({})
    :with_name("order-" .. order.id)

local pid, err = spawner:spawn_monitored(
    "app:order_workflow",
    "app:worker",
    {order_id = order.id}
)
```

Если указано имя, Temporal использует его для дедупликации запусков. Запуск с тем же именем при работающем workflow по умолчанию возвращает PID существующего workflow.

### Spawn с явным workflow ID

Установка конкретного Temporal workflow ID:

```lua
local spawner = process
    .with_options({
        ["temporal.workflow.id"] = "order-" .. order.id,
    })

local pid, err = spawner:spawn_monitored(
    "app:order_workflow",
    "app:worker",
    order
)
```

### Политики конфликтов ID

Управление поведением при запуске workflow с уже существующим ID:

```lua
-- Fail if workflow already exists
local spawner = process
    .with_options({
        ["temporal.workflow.id"] = "order-123",
        ["temporal.workflow.id_conflict_policy"] = "fail",
    })

local pid, err = spawner:spawn("app:order_workflow", "app:worker", order)
if err then
    -- Workflow already running with this ID
end
```

```lua
-- Error when already started (alternative approach)
local spawner = process
    .with_options({
        ["temporal.workflow.id"] = "order-123",
        ["temporal.workflow.execution_error_when_already_started"] = true,
    })

local pid, err = spawner:spawn("app:order_workflow", "app:worker", order)
```

```lua
-- Reuse existing (default behavior with explicit ID)
local spawner = process
    .with_options({
        ["temporal.workflow.id"] = "order-123",
    })

local pid, err = spawner:spawn("app:order_workflow", "app:worker", order)
-- Returns existing workflow PID if already running
```

| Политика | Поведение |
|----------|-----------|
| `"use_existing"` | Вернуть PID существующего workflow (по умолчанию при явном ID) |
| `"fail"` | Вернуть ошибку, если workflow существует |
| `"terminate_existing"` | Завершить существующий и запустить новый |

### Параметры запуска workflow

Передача параметров Temporal workflow через `with_options()`:

```lua
local spawner = process.with_options({
    ["temporal.workflow.id"] = "order-123",
    ["temporal.workflow.execution_timeout"] = "24h",
    ["temporal.workflow.run_timeout"] = "1h",
    ["temporal.workflow.task_timeout"] = "30s",
    ["temporal.workflow.id_conflict_policy"] = "fail",
    ["temporal.workflow.retry_policy"] = {
        initial_interval = 1000,
        backoff_coefficient = 2.0,
        maximum_interval = 300000,
        maximum_attempts = 3,
    },
    ["temporal.workflow.cron_schedule"] = "0 */6 * * *",
    ["temporal.workflow.search_attributes"] = {
        customer_id = "cust-123"
    },
    ["temporal.workflow.memo"] = {
        source = "api"
    },
    ["temporal.workflow.start_delay"] = "5m",
    ["temporal.workflow.parent_close_policy"] = "terminate",
})
```

#### Полный справочник параметров

| Параметр | Тип | Описание |
|----------|-----|----------|
| `temporal.workflow.id` | string | Явный ID выполнения workflow |
| `temporal.workflow.task_queue` | string | Переопределение очереди задач |
| `temporal.workflow.execution_timeout` | duration | Общий тайм-аут выполнения workflow |
| `temporal.workflow.run_timeout` | duration | Тайм-аут одного запуска |
| `temporal.workflow.task_timeout` | duration | Тайм-аут обработки задачи workflow |
| `temporal.workflow.id_conflict_policy` | string | `use_existing`, `fail`, `terminate_existing` |
| `temporal.workflow.id_reuse_policy` | string | `allow_duplicate`, `allow_duplicate_failed_only`, `reject_duplicate` |
| `temporal.workflow.execution_error_when_already_started` | boolean | Ошибка, если workflow уже запущен |
| `temporal.workflow.retry_policy` | table | Политика повторных попыток (см. ниже) |
| `temporal.workflow.cron_schedule` | string | Cron-выражение для периодических workflow |
| `temporal.workflow.memo` | table | Неиндексированные метаданные workflow |
| `temporal.workflow.search_attributes` | table | Индексированные атрибуты для поиска |
| `temporal.workflow.enable_eager_start` | boolean | Немедленный запуск выполнения |
| `temporal.workflow.start_delay` | duration | Задержка перед началом workflow |
| `temporal.workflow.parent_close_policy` | string | Поведение дочернего при закрытии родителя |
| `temporal.workflow.wait_for_cancellation` | boolean | Ожидание завершения отмены |
| `temporal.workflow.namespace` | string | Переопределение пространства имён Temporal |

Значения длительности принимают строки (`"5s"`, `"10m"`, `"1h"`) или числа в миллисекундах.

#### Политика закрытия родителя

Определяет поведение дочерних workflow при закрытии родителя:

| Политика | Поведение |
|----------|-----------|
| `"terminate"` | Завершить дочерний workflow |
| `"abandon"` | Позволить дочернему продолжить независимо |
| `"request_cancel"` | Отправить запрос на отмену дочернему |

### Сообщения при запуске

Добавление сигналов в очередь для отправки в workflow сразу после запуска. Сообщения доставляются до любых внешних сигналов:

```lua
local spawner = process
    .with_options({})
    :with_name("counter-workflow")
    :with_message("increment", {amount = 2})
    :with_message("increment", {amount = 1})
    :with_message("increment", {amount = 4})

local pid, err = spawner:spawn_monitored(
    "app:counter_workflow",
    "app:worker",
    {initial = 0}
)
```

Этот подход особенно полезен с политикой конфликтов `use_existing`. Когда второй spawn разрешается в существующий workflow, начальные сообщения всё равно доставляются:

```lua
-- First spawn starts the workflow with initial messages
local first = process
    .with_options({})
    :with_name("my-counter")
    :with_message("increment", {amount = 3})

local pid, err = first:spawn("app:counter_workflow", "app:worker", {initial = 0})

-- Second spawn reuses existing workflow and delivers new messages
local second = process
    .with_options({})
    :with_name("my-counter")
    :with_message("increment", {amount = 2})

local pid2, err = second:spawn("app:counter_workflow", "app:worker", {initial = 999})
-- pid2 == pid (same workflow), input {initial = 999} is ignored
-- But the increment message with amount=2 is delivered
```

### Передача контекста

Передача значений контекста, доступных внутри workflow и его activity:

```lua
local spawner = process.with_context({
    user_id = "user-1",
    tenant = "tenant-1",
    request_id = "req-abc",
})

local pid, err = spawner:spawn_monitored(
    "app:order_workflow",
    "app:worker",
    order
)
```

Внутри workflow (или любой вызванной activity) чтение контекста через модуль `ctx`:

```lua
local ctx = require("ctx")

local user_id = ctx.get("user_id")       -- "user-1"
local tenant = ctx.get("tenant")         -- "tenant-1"
local all = ctx.all()                    -- {user_id="user-1", tenant="tenant-1", request_id="req-abc"}
```

### Из HTTP-обработчиков

```lua
local function handler()
    local req = http.request()
    local order = json.decode(req:body())

    local spawner = process
        .with_context({request_id = req:header("X-Request-ID")})
        :with_options({
            ["temporal.workflow.id"] = "order-" .. order.id,
            ["temporal.workflow.id_conflict_policy"] = "fail",
        })

    local pid, err = spawner:spawn(
        "app:order_workflow",
        "app:worker",
        order
    )

    if err then
        return http.response():status(409):json({error = tostring(err)})
    end

    return http.response():status(202):json({
        workflow_id = tostring(pid),
        status = "started"
    })
end
```

## Сигналы

Workflow-процессы получают сигналы через систему сообщений. Сигналы устойчивы — они переживают replay workflow.

### Паттерн inbox

Получение всех сообщений через inbox процесса:

```lua
local function main(order)
    local inbox = process.inbox()

    while true do
        local msg = inbox:receive()
        local topic = msg:topic()
        local data = msg:payload():data()

        if topic == "approve" then
            break
        elseif topic == "cancel" then
            return {status = "cancelled", reason = data.reason}
        end
    end

    return process_order(order)
end
```

### Подписка по топикам

Подписка на конкретные топики с помощью `process.listen()`:

```lua
local function main(input)
    local results = {}
    local job_ch = process.listen("add_job")
    local exit_ch = process.listen("exit")

    while true do
        local result = channel.select{
            job_ch:case_receive(),
            exit_ch:case_receive()
        }

        if result.channel == exit_ch then
            break
        elseif result.channel == job_ch then
            local job_data = result.value
            local activity_result, err = funcs.call(
                "app:echo_activity",
                {job_id = job_data.id, data = job_data}
            )
            table.insert(results, {
                job_id = job_data.id,
                result = activity_result
            })
        end
    end

    return {total_jobs = #results, results = results}
end
```

По умолчанию `process.listen()` возвращает необработанные данные payload. Используйте `{message = true}` для получения объектов Message с информацией об отправителе:

```lua
local ch = process.listen("request", {message = true})
local msg = ch:receive()
local sender = msg:from()
local data = msg:payload():data()
```

### Множественные обработчики сигналов

Используйте `coroutine.spawn()` для параллельной обработки различных типов сигналов:

```lua
local function main(input)
    local counter = input.initial or 0
    local done = false

    coroutine.spawn(function()
        local ch = process.listen("increment", {message = true})
        while not done do
            local msg, ok = ch:receive()
            if not ok then break end

            local data = msg:payload():data()
            local reply_to = msg:from()

            if type(data) ~= "table" or type(data.amount) ~= "number" then
                process.send(reply_to, "nak", "amount must be a number")
            else
                process.send(reply_to, "ack")
                counter = counter + data.amount
                process.send(reply_to, "ok", {value = counter})
            end
        end
    end)

    coroutine.spawn(function()
        local ch = process.listen("decrement", {message = true})
        while not done do
            local msg, ok = ch:receive()
            if not ok then break end

            local data = msg:payload():data()
            local reply_to = msg:from()

            if counter - data.amount < 0 then
                process.send(reply_to, "nak", "would result in negative value")
            else
                process.send(reply_to, "ack")
                counter = counter - data.amount
                process.send(reply_to, "ok", {value = counter})
            end
        end
    end)

    -- Main coroutine waits for finish signal
    local finish_ch = process.listen("finish", {message = true})
    local msg = finish_ch:receive()
    process.send(msg:from(), "ack")
    process.send(msg:from(), "ok", {message = "finishing"})
    done = true

    return {final_counter = counter}
end
```

### Подтверждение сигналов

Реализация паттерна запрос-ответ через отправку ответов обратно отправителю:

```lua
-- Workflow side
local ch = process.listen("get_status", {message = true})
local msg = ch:receive()
process.send(msg:from(), "status_response", {status = "processing", progress = 75})
```

```lua
-- Caller side
local response_ch = process.listen("status_response")
process.send(workflow_pid, "get_status", {})

local timeout = time.after("5s")
local result = channel.select{
    response_ch:case_receive(),
    timeout:case_receive()
}

if result.channel == response_ch then
    local status = result.value
end
```

### Передача сигналов между workflow

Workflow могут отправлять сигналы другим workflow по PID:

```lua
-- Sender workflow
local function main(input)
    local target_pid = input.target
    local ok, err = process.send(target_pid, "cross_host_ping", {data = "hello"})
    if err then
        return {ok = false, error = tostring(err)}
    end

    local response_ch = process.listen("cross_host_pong")
    local response = response_ch:receive()
    return {ok = true, received = response}
end
```

## Дочерние workflow

### Синхронный дочерний (workflow.exec)

Запуск дочернего workflow с ожиданием результата:

```lua
local result, err = workflow.exec("app:child_workflow", input_data)
if err then
    return nil, err
end
```

### Асинхронный дочерний (process.spawn)

Запуск дочернего workflow без блокировки с последующим ожиданием завершения через события:

```lua
local events_ch = process.events()

local child_pid, err = process.spawn(
    "app:child_workflow",
    "app:worker",
    {message = "hello from parent"}
)
if err then
    return {status = "spawn_failed", error = tostring(err)}
end

-- Wait for child EXIT event
local event = events_ch:receive()

if event.kind == process.event.EXIT then
    local child_result = event.result.value
    local child_error = event.result.error
end
```

### Передача ошибок от дочерних workflow

Если дочерний workflow возвращает ошибку, она появляется в событии EXIT:

```lua
local events_ch = process.events()
local child_pid, err = process.spawn(
    "app:error_child_workflow",
    "app:worker"
)

local event = events_ch:receive()
if event.result.error then
    local child_err = event.result.error
    -- Error objects have kind(), retryable(), message() methods
    print(child_err:kind())       -- e.g. "NOT_FOUND"
    print(child_err:retryable())  -- false
    print(child_err:message())    -- error message text
end
```

### Синхронное выполнение workflow (process.exec)

Запуск workflow и ожидание результата одним вызовом:

```lua
local result, err = process.exec(
    "app:hello_workflow",
    "app:worker",
    {name = "world"}
)
if err then
    return nil, err
end
-- result contains the workflow return value
```

## Мониторинг и связывание

### Мониторинг после запуска

Мониторинг workflow после его запуска:

```lua
local pid, err = process.spawn(
    "app:long_workflow",
    "app:worker",
    {iterations = 100}
)

-- Monitor later
local ok, err = process.monitor(pid)

local events_ch = process.events()
local event = events_ch:receive()  -- EXIT when workflow completes
```

### Связывание после запуска

Связывание с работающим workflow для получения LINK_DOWN при аварийном завершении:

```lua
local ok, err = process.set_options({trap_links = true})

local pid, err = process.spawn(
    "app:long_workflow",
    "app:worker",
    {iterations = 100}
)

-- Link after workflow has started
time.sleep("200ms")
local ok, err = process.link(pid)

-- If workflow is terminated, receive LINK_DOWN
process.terminate(pid)

local events_ch = process.events()
local event = events_ch:receive()
-- event.kind == process.event.LINK_DOWN
```

События LINK_DOWN требуют `trap_links = true` в параметрах процесса. Без этого завершение связанного процесса приводит к распространению ошибки.

### Отмена мониторинга / связывания

Снятие мониторинга или связывания:

```lua
process.unmonitor(pid)  -- stop receiving EXIT events
process.unlink(pid)     -- remove bidirectional link
```

После снятия мониторинга или связывания события для этого процесса больше не доставляются.

## Завершение и отмена

### Принудительное завершение

Принудительное завершение работающего workflow:

```lua
local ok, err = process.terminate(workflow_pid)
```

Мониторящие вызывающие стороны получают событие EXIT с ошибкой.

### Отмена

Запрос корректной отмены с опциональным дедлайном:

```lua
local ok, err = process.cancel(workflow_pid, "5s")
```

## Параллельная работа

Используйте `coroutine.spawn()` и каналы для параллельной работы внутри workflow:

```lua
local function main(input)
    local worker_count = input.workers or 3
    local job_count = input.jobs or 6

    local work_queue = channel.new(10)
    local results = channel.new(10)

    for w = 1, worker_count do
        coroutine.spawn(function()
            while true do
                local job, ok = work_queue:receive()
                if not ok then break end
                time.sleep(10 * time.MILLISECOND)
                results:send({worker = w, job = job, result = job * 2})
            end
        end)
    end

    for j = 1, job_count do
        work_queue:send(j)
    end
    work_queue:close()

    local total = 0
    local processed = {}
    for _ = 1, job_count do
        local r = results:receive()
        total = total + r.result
        table.insert(processed, r)
    end

    return {total = total, processed = processed}
end
```

Все операции с каналами и sleep внутри корутин безопасны для replay.

## Таймеры

Устойчивые таймеры переживают перезапуски:

```lua
local time = require("time")

time.sleep("24h")
time.sleep("5m")
time.sleep("30s")
time.sleep(100 * time.MILLISECOND)
```

Отслеживание прошедшего времени:

```lua
local start = time.now()
time.sleep("1s")
local elapsed = time.now():sub(start):milliseconds()
```

## Детерминизм

Код workflow должен быть детерминированным. Одинаковые входные данные должны порождать одинаковую последовательность команд.

### Безопасные для replay операции

Эти операции автоматически перехватываются и их результаты записываются. При replay возвращаются записанные значения:

```lua
-- Activity calls
local data = funcs.call("app:fetch_data", id)

-- Durable sleep
time.sleep("1h")

-- Current time
local now = time.now()

-- UUID generation
local id = uuid.v4()

-- Crypto operations
local bytes = crypto.random_bytes(32)

-- Child workflows
local result = workflow.exec("app:child", input)

-- Versioning
local v = workflow.version("change-1", 1, 2)
```

### Недетерминированные операции (избегать)

```lua
-- Don't use wall clock time
local now = os.time()              -- non-deterministic

-- Don't use random directly
local r = math.random()            -- non-deterministic

-- Don't do I/O in workflow code
local file = io.open("data.txt")   -- non-deterministic

-- Don't use global mutable state
counter = counter + 1               -- non-deterministic across replays
```

## Обработка ошибок

### Ошибки activity

Ошибки activity содержат структурированные метаданные:

```lua
local result, err = funcs.call("app:risky_activity", order)
if err then
    print(err:kind())       -- error classification (e.g. "NOT_FOUND", "INTERNAL")
    print(err:retryable())  -- whether the error is retryable
    print(err:message())    -- human-readable error message
end
```

### Режимы сбоя activity

Настройка поведения повторных попыток для вызовов activity:

```lua
local executor = funcs.new():with_options({
    ["activity.retry_policy"] = {
        maximum_attempts = 1,
    }
})

local result, err = executor:call("app:unreliable_activity", input)
if err then
    local kind = err:kind()         -- "INTERNAL" for runtime errors
    local retryable = err:retryable()
end
```

### Ошибки дочерних workflow

Ошибки дочерних workflow (через `process.exec` или события EXIT) содержат те же метаданные:

```lua
local result, err = process.exec("app:error_workflow", "app:worker")
if err then
    print(err:kind())       -- e.g. "NOT_FOUND"
    print(err:retryable())  -- false
    print(err:message())    -- error details
end
```

## Паттерн компенсации (Saga)

```lua
local function main(order)
    local compensations = {}

    local reservation, err = funcs.call("app:reserve_inventory", order.items)
    if err then
        return {status = "failed", step = "inventory", error = tostring(err)}
    end
    table.insert(compensations, 1, {
        action = "app:release_inventory",
        args = reservation.id
    })

    local payment, err = funcs.call("app:charge_payment", order.payment)
    if err then
        run_compensations(compensations)
        return {status = "failed", step = "payment", error = tostring(err)}
    end
    table.insert(compensations, 1, {
        action = "app:refund_payment",
        args = payment.id
    })

    local shipment, err = funcs.call("app:ship_order", order.shipping)
    if err then
        run_compensations(compensations)
        return {status = "failed", step = "shipping", error = tostring(err)}
    end

    return {status = "completed", tracking = shipment.tracking}
end

local function run_compensations(compensations)
    for _, comp in ipairs(compensations) do
        funcs.call(comp.action, comp.args)
    end
end
```

## См. также

- [Обзор](temporal/overview.md) — настройка клиента и воркера
- [Activity](temporal/activities.md) — определение activity и параметры
- [Процессы](lua/core/process.md) — API управления процессами
- [Функции](lua/core/funcs.md) — вызов функций
- [Каналы](lua/core/channel.md) — операции с каналами
