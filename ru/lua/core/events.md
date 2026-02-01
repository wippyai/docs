# Шина событий
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="permissions"/>

Публикация и подписка на события для построения событийно-ориентированных архитектур.

## Загрузка

```lua
local events = require("events")
```

## Подписка на события

Подписка на события из шины:

```lua
-- Подписка на все события заказов
local sub, err = events.subscribe("orders.*")
if err then
    return nil, err
end

-- Подписка на конкретный тип события
local sub = events.subscribe("users", "user.created")

-- Подписка на все события системы
local sub = events.subscribe("payments")

-- Обработка событий
local ch = sub:channel()
while true do
    local evt, ok = ch:receive()
    if not ok then break end

    logger:info("Received event", {
        system = evt.system,
        kind = evt.kind,
        path = evt.path
    })
    handle_event(evt)
end
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `system` | string | Паттерн системы (поддерживает маски типа "test.*") |
| `kind` | string | Фильтр типа события (опционально) |

**Возвращает:** `Subscription, error`

## Отправка событий

Отправить событие в шину:

```lua
-- Событие создания заказа
local ok, err = events.send("orders", "order.created", "/orders/123", {
    order_id = "123",
    customer_id = "456",
    total = 99.99
})
if err then
    return nil, err
end

-- Событие регистрации пользователя
events.send("users", "user.registered", "/users/" .. user.id, {
    user_id = user.id,
    email = user.email,
    created_at = time.now():format("2006-01-02T15:04:05Z07:00")
})

-- Событие платежа
events.send("payments", "payment.completed", "/payments/" .. payment.id, {
    payment_id = payment.id,
    order_id = payment.order_id,
    amount = payment.amount,
    method = payment.method
})

-- Отправка без данных
events.send("system", "heartbeat", "/health")
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `system` | string | Идентификатор системы |
| `kind` | string | Тип события |
| `path` | string | Путь для маршрутизации |
| `data` | any | Данные события (опционально) |

**Возвращает:** `boolean, error`

## Методы подписки

### Получение канала

Получить канал для приёма событий:

```lua
local ch = sub:channel()

local evt, ok = ch:receive()
if ok then
    print("System:", evt.system)
    print("Kind:", evt.kind)
    print("Path:", evt.path)
    print("Data:", json.encode(evt.data))
end
```

Поля события: `system`, `kind`, `path`, `data`

### Закрытие подписки

Отписаться и закрыть канал:

```lua
sub:close()
```

## Разрешения

| Действие | Ресурс | Описание |
|----------|--------|----------|
| `events.subscribe` | system | Подписка на события системы |
| `events.send` | system | Отправка событий в систему |

## Ошибки

| Условие | Kind | Повторяемо |
|---------|------|------------|
| Пустая система | `errors.INVALID` | нет |
| Пустой тип | `errors.INVALID` | нет |
| Пустой путь | `errors.INVALID` | нет |
| Запрещено политикой | `errors.INVALID` | нет |

См. [Обработка ошибок](lua/core/errors.md) для работы с ошибками.
