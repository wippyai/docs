# Activity

Activity — это функции, выполняющие недетерминированные операции. Любую запись `function.lua` или `process.lua` можно зарегистрировать как Temporal activity, добавив метаданные.

## Регистрация activity

Добавьте `meta.temporal.activity` для регистрации функции как activity:

```yaml
- name: charge_payment
  kind: function.lua
  source: file://payment.lua
  method: charge
  modules:
    - http_client
    - json
  meta:
    temporal:
      activity:
        worker: app:worker
```

### Поля метаданных

| Поле | Обязательно | Описание |
|------|-------------|----------|
| `worker` | Да | Ссылка на запись `temporal.worker` |
| `local` | Нет | Выполнять как локальную activity (по умолчанию: false) |

## Реализация

Activity — это обычные функции Lua:

```lua
-- payment.lua
local http = require("http_client")
local json = require("json")

local function charge(input)
    local response, err = http.post("https://api.stripe.com/v1/charges", {
        headers = {
            ["Authorization"] = "Bearer " .. input.api_key,
            ["Content-Type"] = "application/json"
        },
        body = json.encode({
            amount = input.amount,
            currency = input.currency,
            source = input.token
        })
    })

    if err then
        return nil, err
    end

    return json.decode(response:body())
end

return { charge = charge }
```

## Вызов activity

Из workflow используйте модуль `funcs`:

```lua
local funcs = require("funcs")

local result, err = funcs.call("app:charge_payment", {
    amount = 5000,
    currency = "usd",
    token = "tok_visa",
    api_key = ctx.stripe_key
})

if err then
    return nil, err
end
```

## Параметры activity

Настройка тайм-аутов, повторных попыток и других параметров выполнения через построитель executor:

```lua
local funcs = require("funcs")

local executor = funcs.new():with_options({
    ["activity.start_to_close_timeout"] = "30s",
    ["activity.schedule_to_close_timeout"] = "5m",
    ["activity.heartbeat_timeout"] = "10s",
    ["activity.retry_policy"] = {
        maximum_attempts = 3,
        initial_interval = 1000,
        backoff_coefficient = 2.0,
        maximum_interval = 60000,
    }
})

local result, err = executor:call("app:charge_payment", input)
```

Executor неизменяем и может использоваться повторно. Создайте его один раз и используйте для нескольких вызовов:

```lua
local reliable = funcs.new():with_options({
    ["activity.start_to_close_timeout"] = "60s",
    ["activity.retry_policy"] = {
        maximum_attempts = 5,
        initial_interval = 2000,
        backoff_coefficient = 2.0,
        maximum_interval = 120000,
    }
})

local a, err = reliable:call("app:step_one", input)
local b, err = reliable:call("app:step_two", a)
```

### Справочник параметров

| Параметр | Тип | По умолчанию | Описание |
|----------|-----|--------------|----------|
| `activity.start_to_close_timeout` | duration | 10m | Максимальное время выполнения activity |
| `activity.schedule_to_close_timeout` | duration | - | Максимальное время от планирования до завершения |
| `activity.schedule_to_start_timeout` | duration | - | Максимальное время до начала activity |
| `activity.heartbeat_timeout` | duration | - | Максимальное время между heartbeat |
| `activity.id` | string | - | Пользовательский ID выполнения activity |
| `activity.task_queue` | string | - | Переопределение очереди задач для данного вызова |
| `activity.wait_for_cancellation` | boolean | false | Ожидание завершения отмены activity |
| `activity.disable_eager_execution` | boolean | false | Отключение немедленного выполнения |
| `activity.retry_policy` | table | - | Конфигурация повторных попыток (см. ниже) |

Значения длительности принимают строки (`"5s"`, `"10m"`, `"1h"`) или числа в миллисекундах.

### Политика повторных попыток

Настройка автоматических повторных попыток для неуспешных activity:

```lua
["activity.retry_policy"] = {
    initial_interval = 1000,         -- миллисекунды до первой повторной попытки
    backoff_coefficient = 2.0,       -- множитель для каждой попытки
    maximum_interval = 300000,       -- максимальный интервал между попытками (мс)
    maximum_attempts = 10,           -- максимальное число попыток (0 = без ограничений)
    non_retryable_error_types = {    -- ошибки, для которых повтор не выполняется
        "INVALID",
        "PERMISSION_DENIED"
    }
}
```

| Поле | Тип | По умолчанию | Описание |
|------|-----|--------------|----------|
| `initial_interval` | number | 1000 | Миллисекунды до первой повторной попытки |
| `backoff_coefficient` | number | 2.0 | Множитель интервала для каждой попытки |
| `maximum_interval` | number | - | Максимальный интервал между попытками (мс) |
| `maximum_attempts` | number | 0 | Максимальное число попыток (0 = без ограничений) |
| `non_retryable_error_types` | array | - | Типы ошибок, для которых повторные попытки не выполняются |

### Взаимосвязь тайм-аутов

```
|--- schedule_to_close_timeout --------------------------------|
|--- schedule_to_start_timeout ---|--- start_to_close_timeout -|
     (waiting in queue)                (executing)
```

- `start_to_close_timeout`: максимальное время выполнения самой activity. Наиболее часто используемый тайм-аут.
- `schedule_to_close_timeout`: общее время от момента планирования activity до её завершения, включая ожидание в очереди и повторные попытки.
- `schedule_to_start_timeout`: максимальное время ожидания activity в очереди задач до подхвата воркером.
- `heartbeat_timeout`: для долгоживущих activity — максимальное время между отчётами heartbeat.

## Локальные activity

Локальные activity выполняются в процессе воркера workflow без отдельного опроса очереди задач:

```yaml
- name: validate_input
  kind: function.lua
  source: file://validate.lua
  method: validate
  modules:
    - json
  meta:
    temporal:
      activity:
        worker: app:worker
        local: true
```

Особенности:
- Выполняются в процессе воркера workflow
- Меньшая задержка (без обращения к очереди задач)
- Нет накладных расходов на отдельную очередь
- Ограничены коротким временем выполнения
- Нет heartbeat

Используйте локальные activity для быстрых и коротких операций: валидация входных данных, преобразование данных, обращения к кешу.

## Именование activity

Activity регистрируются с полным ID записи в качестве имени:

```yaml
namespace: app
entries:
  - name: charge_payment
    kind: function.lua
    # ...
```

Имя activity: `app:charge_payment`

## Передача контекста

Значения контекста, установленные при запуске workflow, доступны внутри activity:

```lua
-- Spawner устанавливает контекст
local spawner = process.with_context({
    user_id = "user-1",
    tenant = "tenant-1",
})
local pid = spawner:spawn("app:order_workflow", "app:worker", order)
```

```lua
-- Activity читает контекст
local ctx = require("ctx")

local function process_order(input)
    local user_id = ctx.get("user_id")   -- "user-1"
    local tenant = ctx.get("tenant")     -- "tenant-1"
    -- используйте контекст для авторизации, логирования и т.д.
end
```

Activity, вызванные из workflow через `funcs.new():with_context()`, также передают контекст:

```lua
-- Внутри workflow
local executor = funcs.new():with_context({trace_id = "abc-123"})
local result, err = executor:call("app:charge_payment", input)
```

## Обработка ошибок

Возвращайте ошибки стандартным способом Lua:

```lua
local errors = require("errors")

local function charge(input)
    if not input.amount or input.amount <= 0 then
        return nil, errors.new("INVALID", "amount must be positive")
    end

    local response, err = http.post(url, options)
    if err then
        return nil, errors.wrap(err, "payment API failed")
    end

    if response:status() >= 400 then
        return nil, errors.new("FAILED", "payment declined")
    end

    return json.decode(response:body())
end
```

### Объекты ошибок

Ошибки activity, переданные в workflow, содержат структурированные метаданные:

```lua
local result, err = funcs.call("app:charge_payment", input)
if err then
    err:kind()       -- error classification string
    err:retryable()  -- boolean, whether retry makes sense
    err:message()    -- human-readable error message
end
```

### Режимы сбоя

| Сбой | Тип ошибки | Повторяемая | Описание |
|------|------------|-------------|----------|
| Ошибка приложения | разный | разная | Ошибка, возвращённая кодом activity |
| Падение среды выполнения | `INTERNAL` | да | Необработанная ошибка Lua в activity |
| Отсутствующая activity | `NOT_FOUND` | нет | Activity не зарегистрирована в воркере |
| Тайм-аут | `TIMEOUT` | да | Activity превысила настроенный тайм-аут |

```lua
local executor = funcs.new():with_options({
    ["activity.retry_policy"] = {maximum_attempts = 1}
})

local result, err = executor:call("app:missing_activity", input)
if err then
    print(err:kind())      -- "NOT_FOUND"
    print(err:retryable())  -- false
end
```

## Процессы как activity

Записи `process.lua` тоже можно регистрировать как activity для долгоживущих операций:

```yaml
- name: long_task
  kind: process.lua
  source: file://long_task.lua
  method: main
  modules:
    - http_client
  meta:
    temporal:
      activity:
        worker: app:worker
```

## См. также

- [Обзор](temporal/overview.md) — настройка
- [Workflow](temporal/workflows.md) — реализация workflow
- [Функции](lua/core/funcs.md) — модуль функций
- [Обработка ошибок](lua/core/errors.md) — типы ошибок и паттерны
