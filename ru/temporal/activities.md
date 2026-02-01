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
| `local` | Нет | Выполнять как локальную activity (по умолчанию false) |

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

### Параметры activity

Настройка тайм-аутов и повторных попыток:

```lua
local funcs = require("funcs")

local executor = funcs.new()
executor = executor:with_options({
    start_to_close_timeout = "30s",
    schedule_to_close_timeout = "5m",
    heartbeat_timeout = "10s",
    retry_policy = {
        max_attempts = 3,
        initial_interval = "1s",
        backoff_coefficient = 2.0,
        max_interval = "1m"
    }
})

local result, err = executor:call("app:charge_payment", input)
```

## Локальные activity

Локальные activity выполняются в процессе воркера workflow без отдельного опроса очереди. Используйте для быстрых и коротких операций:

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
- Меньшая задержка
- Нет накладных расходов на отдельную очередь
- Ограничены по времени выполнения
- Нет heartbeat

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

## Обработка ошибок

Возвращайте ошибки стандартным способом Lua:

```lua
local function charge(input)
    if not input.amount or input.amount <= 0 then
        return nil, errors.new("INVALID", "сумма должна быть положительной")
    end

    local response, err = http.post(url, options)
    if err then
        return nil, errors.wrap(err, "ошибка платёжного API")
    end

    if response:status() >= 400 then
        return nil, errors.new("FAILED", "платёж отклонён")
    end

    return json.decode(response:body())
end
```

## Процессы как activity

Записи `process.lua` тоже можно регистрировать как activity:

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
