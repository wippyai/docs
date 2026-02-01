# Очередь сообщений
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>
<secondary-label ref="permissions"/>

Публикация и потребление сообщений из распределённых очередей. Поддержка нескольких бэкендов, включая RabbitMQ и другие AMQP-совместимые брокеры.

Настройку очередей см. в [Queue](system-queue.md).

## Загрузка

```lua
local queue = require("queue")
```

## Публикация сообщений

Отправка сообщений в очередь по ID:

```lua
local ok, err = queue.publish("app:tasks", {
    action = "send_email",
    user_id = 456,
    template = "welcome"
})
if err then
    return nil, err
end
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `queue_id` | string | Идентификатор очереди (формат: "namespace:name") |
| `data` | any | Данные сообщения (таблицы, строки, числа, булевы) |
| `headers` | table | Опциональные заголовки сообщения |

**Возвращает:** `boolean, error`

### Заголовки сообщений

Заголовки обеспечивают маршрутизацию, приоритезацию и трассировку:

```lua
queue.publish("app:notifications", {
    type = "order_shipped",
    order_id = order.id
}, {
    priority = "high",
    correlation_id = request_id
})
```

## Доступ к контексту доставки

В консьюмере очереди доступ к текущему сообщению:

```lua
local msg, err = queue.message()
if err then
    return nil, err
end

local msg_id = msg:id()
local priority = msg:header("priority")
local all_headers = msg:headers()
```

**Возвращает:** `Message, error`

Доступен только при обработке сообщений в контексте консьюмера.

## Методы Message

| Метод | Возвращает | Описание |
|-------|------------|----------|
| `id()` | `string, error` | Уникальный идентификатор сообщения |
| `header(key)` | `any, error` | Одно значение заголовка (nil если отсутствует) |
| `headers()` | `table, error` | Все заголовки сообщения |

## Паттерн консьюмера

Консьюмеры очередей определяются как точки входа, получающие payload напрямую:

```yaml
entries:
  - kind: queue.consumer
    id: email_worker
    queue: app:emails
    method: handle_email
```

```lua
function handle_email(payload)
    local msg = queue.message()

    logger:info("Processing", {
        message_id = msg:id(),
        to = payload.to
    })

    local ok, err = email.send(payload.to, payload.template, payload.data)
    if err then
        return nil, err  -- Сообщение будет возвращено в очередь или отправлено в dead-letter
    end
end
```

## Разрешения

Операции очереди подчиняются вычислению политики безопасности.

| Действие | Ресурс | Описание |
|----------|--------|----------|
| `queue.publish` | - | Общее разрешение на публикацию сообщений |
| `queue.publish.queue` | ID очереди | Публикация в конкретную очередь |

Проверяются оба разрешения: сначала общее, затем для конкретной очереди.

## Ошибки

| Условие | Kind | Повторяемо |
|---------|------|------------|
| Пустой ID очереди | `errors.INVALID` | нет |
| Пустые данные сообщения | `errors.INVALID` | нет |
| Нет контекста доставки | `errors.INVALID` | нет |
| Доступ запрещён | `errors.PERMISSION_DENIED` | нет |
| Ошибка публикации | `errors.INTERNAL` | да |

См. [Обработка ошибок](lua/core/errors.md) для работы с ошибками.

## См. также

- [Настройка очередей](system/queue.md) — драйверы очередей и определения точек входа
- [Руководство по консьюмерам](guides/queue-consumers.md) — паттерны консьюмеров и пулы воркеров
- [Управление процессами](lua/core/process.md) — создание процессов и коммуникация
- [Каналы](lua/core/channel.md) — паттерны межпроцессной коммуникации
- [Функции](lua/core/funcs.md) — асинхронный вызов функций
