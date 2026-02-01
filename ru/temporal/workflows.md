# Workflow

Workflow — это устойчивые функции, оркестрирующие activity и сохраняющие состояние при сбоях и перезапусках. Определяются с помощью типа записи `workflow.lua`.

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
| `name` | Нет | Пользовательское имя workflow (по умолчанию ID записи) |

## Базовая реализация

```lua
local funcs = require("funcs")
local time = require("time")

local function main(order)
    -- Вызов activity
    local payment, err = funcs.call("app:charge_payment", {
        amount = order.total,
        customer = order.customer_id
    })
    if err then
        return {status = "failed", error = tostring(err)}
    end

    -- Устойчивая пауза (переживает перезапуски)
    time.sleep("1h")

    -- Ещё одна activity
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

Получение информации о текущем выполнении:

```lua
local workflow = require("workflow")

local info = workflow.info()
print(info.workflow_id)    -- ID выполнения workflow
print(info.run_id)         -- ID текущего запуска
print(info.workflow_type)  -- Тип workflow
print(info.task_queue)     -- Имя очереди задач
print(info.namespace)      -- Пространство имён Temporal
print(info.attempt)        -- Номер текущей попытки
print(info.history_length) -- Количество событий в истории
print(info.history_size)   -- Размер истории в байтах
```

### workflow.version()

Обработка изменений кода с детерминированным версионированием:

```lua
local version = workflow.version("payment-v2", 1, 2)

if version == 1 then
    -- Старое поведение (для существующих выполнений)
    result = funcs.call("app:old_payment", input)
else
    -- Новое поведение (версия 2)
    result = funcs.call("app:new_payment", input)
end
```

Параметры:
- `change_id` — уникальный идентификатор изменения
- `min_supported` — минимальная поддерживаемая версия
- `max_supported` — максимальная (текущая) версия

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
        notes = "Приоритетный клиент",
        source = "web"
    }
})
```

### workflow.history_length()

Количество событий в истории workflow:

```lua
local length = workflow.history_length()
if length > 10000 then
    -- Рассмотреть continue-as-new
end
```

### workflow.history_size()

Размер истории workflow в байтах:

```lua
local size = workflow.history_size()
```

### workflow.call()

Запуск дочернего workflow:

```lua
local result, err = workflow.call("app:child_workflow", input_data)
```

## Сигналы

Отправка данных работающим workflow через входящую очередь процесса.

**Отправка сигналов:**

```lua
process.send(workflow_pid, "approve", {
    approved_by = "admin",
    comment = "Всё в порядке"
})
```

**Получение сигналов в workflow:**

```lua
local function main(order)
    local inbox = process.inbox()

    while true do
        local msg = inbox:receive()
        local topic = msg:topic()

        if topic == "approve" then
            local data = msg:payload():data()
            break
        elseif topic == "cancel" then
            local data = msg:payload():data()
            return {status = "cancelled", reason = data.reason}
        end
    end

    return process_order(order)
end
```

## Таймеры

Устойчивые таймеры переживают перезапуски:

```lua
local time = require("time")

time.sleep("24h")
time.sleep("5m")
time.sleep("30s")
```

## Детерминизм

Код workflow должен быть детерминированным — одинаковые входные данные должны порождать одинаковую последовательность команд.

### Можно

```lua
-- Использовать информацию о workflow для контекста времени
local info = workflow.info()

-- Использовать устойчивые паузы
time.sleep("1h")

-- Использовать activity для ввода-вывода
local data = funcs.call("app:fetch_data", id)

-- Использовать версионирование для изменений кода
local v = workflow.version("change-1", 1, 2)
```

### Нельзя

```lua
-- Нельзя использовать системное время
local now = os.time()  -- Недетерминировано

-- Нельзя использовать random напрямую
local r = math.random()  -- Недетерминировано

-- Нельзя делать ввод-вывод в коде workflow
local file = io.open("data.txt")  -- Недетерминировано

-- Нельзя использовать глобальное изменяемое состояние
counter = counter + 1  -- Недетерминировано при воспроизведении
```

## Обработка ошибок

```lua
local function main(order)
    local result, err = funcs.call("app:risky_activity", order)

    if err then
        -- Логирование и компенсация
        funcs.call("app:send_alert", {
            error = tostring(err),
            order_id = order.id
        })

        return {status = "failed", error = tostring(err)}
    end

    return {status = "completed", result = result}
end
```

## Паттерн компенсации (Saga)

```lua
local function main(order)
    local compensations = {}

    -- Шаг 1: Резервирование товара
    local reservation, err = funcs.call("app:reserve_inventory", order.items)
    if err then
        return {status = "failed", step = "inventory", error = tostring(err)}
    end
    table.insert(compensations, 1, {
        action = "app:release_inventory",
        args = reservation.id
    })

    -- Шаг 2: Списание оплаты
    local payment, err = funcs.call("app:charge_payment", order.payment)
    if err then
        run_compensations(compensations)
        return {status = "failed", step = "payment", error = tostring(err)}
    end
    table.insert(compensations, 1, {
        action = "app:refund_payment",
        args = payment.id
    })

    -- Шаг 3: Отправка заказа
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

## Запуск workflow

Запуск workflow из любого кода:

```lua
local pid, err = process.spawn(
    "app:order_workflow",    -- запись workflow
    "app:worker",            -- воркер temporal
    {order_id = "123"}       -- входные данные
)
```

Из HTTP-обработчиков:

```lua
local function handler()
    local req = http.request()
    local order = json.decode(req:body())

    local pid, err = process.spawn(
        "app:order_workflow",
        "app:worker",
        order
    )

    if err then
        return http.response():status(500):json({error = tostring(err)})
    end

    return http.response():json({
        workflow_id = tostring(pid),
        status = "started"
    })
end
```

## См. также

- [Обзор](temporal/overview.md) — настройка
- [Activity](temporal/activities.md) — определение activity
- [Процессы](lua/core/process.md) — управление процессами
- [Функции](lua/core/funcs.md) — вызов функций
