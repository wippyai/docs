# Workflows

Workflows — устойчивые, долгоживущие операции, которые переживают падения и перезапуски. Они обеспечивают гарантии надёжности для критических бизнес-процессов: платежей, выполнения заказов, многошаговых согласований.

## Зачем Workflows?

Функции эфемерны — если хост падает, выполняемая работа теряется. Workflows сохраняют состояние:

| Аспект | Функции | Workflows |
|--------|---------|-----------|
| Состояние | В памяти | Персистентное |
| Падение | Потеря работы | Возобновление |
| Длительность | Секунды-минуты | Часы-месяцы |
| Завершение | Best effort | Гарантированное |

## Как работают Workflows

Код workflow выглядит как обычный Lua:

```lua
local funcs = require("funcs")
local time = require("time")

local result = funcs.call("app.api:charge_card", payment)
time.sleep("24h")
local status = funcs.call("app.api:check_status", result.id)

if status == "failed" then
    funcs.call("app.api:refund", result.id)
end
```

Движок workflow перехватывает вызовы и записывает результаты. Если процесс падает, выполнение воспроизводится из истории — тот же код, те же результаты.

<note>
Wippy автоматически обрабатывает детерминизм. Операции вроде <code>funcs.call()</code>, <code>time.sleep()</code>, <code>uuid.v4()</code> и <code>time.now()</code> перехватываются, их результаты записываются. При replay возвращаются записанные значения вместо повторного выполнения.
</note>

## Паттерны Workflows

### Паттерн Saga

Компенсация при сбое:

```lua
local funcs = require("funcs")

local inventory = funcs.call("app.inventory:reserve", items)
if inventory.error then
    return nil, inventory.error
end

local payment = funcs.call("app.payments:charge", amount)
if payment.error then
    funcs.call("app.inventory:release", inventory.id)
    return nil, payment.error
end

local shipping = funcs.call("app.shipping:create", order)
if shipping.error then
    funcs.call("app.payments:refund", payment.id)
    funcs.call("app.inventory:release", inventory.id)
    return nil, shipping.error
end

return {inventory = inventory, payment = payment, shipping = shipping}
```

### Ожидание сигналов

Ожидание внешних событий (решений по согласованию, вебхуков, действий пользователя):

```lua
local funcs = require("funcs")

funcs.call("app.approvals:submit", request)

local inbox = process.inbox()
local msg = inbox:receive()  -- блокируется до прихода сигнала

if msg.approved then
    funcs.call("app.orders:fulfill", request.order_id)
else
    funcs.call("app.notifications:send_rejection", request)
end
```

## Когда что использовать

| Сценарий | Выбор |
|----------|-------|
| Обработка HTTP-запросов | Функции |
| Трансформация данных | Функции |
| Фоновые задачи | Процессы |
| Состояние пользовательской сессии | Процессы |
| Real-time сообщения | Процессы |
| Обработка платежей | Workflows |
| Выполнение заказов | Workflows |
| Многодневные согласования | Workflows |

## Запуск Workflows

Workflows порождаются так же, как процессы — через `process.spawn()` с другим хостом:

```lua
-- Spawn workflow на temporal worker
local pid = process.spawn("app.workflows:order_processor", "app:temporal_worker", order_data)

-- Отправка сигналов в workflow
process.send(pid, "update", {status = "approved"})
```

С точки зрения вызывающего API идентичен. Разница в хосте: workflows выполняются на `temporal.worker`, а не на `process.host`.

<tip>
Когда workflow порождает потомков через <code>process.spawn()</code>, они становятся дочерними workflows на том же провайдере, сохраняя гарантии надёжности.
</tip>

## Сбои и супервизия

Процессы могут работать как супервизируемые сервисы через `process.service`:

```yaml
# Определение процесса
- name: session_handler
  kind: process.lua
  source: file://session_handler.lua
  method: main

# Супервизируемый сервис, оборачивающий процесс
- name: session_manager
  kind: process.service
  process: app:session_handler
  host: app:processes
  lifecycle:
    auto_start: true
    restart:
      max_attempts: 10
```

Workflows не используют деревья супервизии — ими автоматически управляет провайдер workflows (Temporal). Провайдер обрабатывает персистентность, повторы и восстановление.

## Конфигурация

Определение процесса (порождается динамически):

```yaml
- name: order_processor
  kind: workflow.lua
  source: file://order_processor.lua
  method: main
  modules:
    - funcs
    - time
```

Провайдер workflows:

```yaml
- name: temporal_worker
  kind: temporal.worker
  client: app:temporal_client
  task_queue: "orders"
  lifecycle:
    auto_start: true
```

См. [Temporal](https://temporal.io) для продакшен-инфраструктуры workflows.

## См. также

- [Функции](concept-functions.md) — обработка запросов без состояния
- [Модель процессов](concept-process-model.md) — фоновая работа с состоянием
- [Супервизия](guide-supervision.md) — политики перезапуска процессов
