# Каналы и корутины
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

Каналы в стиле Go для коммуникации между корутинами. Создание буферизованных и небуферизованных каналов, отправка и получение значений, координация между конкурентными процессами с помощью select.

Глобальная переменная `channel` всегда доступна.

## Создание каналов

Небуферизованные каналы (размер 0) требуют готовности и отправителя, и получателя для завершения передачи. Буферизованные каналы позволяют отправке завершаться немедленно, пока есть свободное место:

```lua
-- Небуферизованный: синхронизирует отправителя и получателя
local sync_ch = channel.new()

-- Буферизованный: очередь до 10 сообщений
local work_queue = channel.new(10)
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `size` | integer | Размер буфера (по умолчанию: 0 для небуферизованного) |

**Возвращает:** `channel`

## Отправка значений

Отправить значение в канал. Блокируется до готовности получателя (небуферизованный) или наличия места в буфере (буферизованный):

```lua
-- Отправка работы в пул воркеров
local jobs = channel.new(100)
for i, task in ipairs(tasks) do
    jobs:send(task)  -- Блокируется если буфер полон
end
jobs:close()  -- Сигнал о завершении работы
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `value` | any | Значение для отправки |

**Возвращает:** `boolean`

Выбрасывает ошибку если канал закрыт.

## Получение значений

Получить значение из канала. Блокируется до появления значения или закрытия канала:

```lua
-- Воркер, потребляющий из очереди задач
while true do
    local job, ok = work:receive()
    if not ok then
        break  -- Канал закрыт, больше нет работы
    end
    process(job)
end
```

**Возвращает:** `any, boolean`

- `value, true` — получено значение
- `nil, false` — канал закрыт и пуст

## Закрытие каналов

Закрыть канал. Ожидающие отправители получают ошибку, ожидающие получатели получают `nil, false`. Выбрасывает ошибку если уже закрыт:

```lua
local results = channel.new(10)

-- Производитель заполняет результаты
for _, item in ipairs(data) do
    results:send(process(item))
end
results:close()  -- Сигнал о завершении
```

## Выбор из нескольких каналов

Ожидание нескольких операций с каналами одновременно. Необходим для обработки нескольких источников событий, реализации таймаутов и построения отзывчивых систем:

```lua
local result = channel.select(cases)
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `cases` | table | Массив случаев select |
| `default` | boolean | Если true, возвращает немедленно когда ни один случай не готов |

**Возвращает:** `table` с полями: `channel`, `value`, `ok`, `default`

### Паттерн таймаута

Ожидание результата с таймаутом через `time.after()`.

```lua
local time = require("time")

local result_ch = worker:response()
local timeout = time.after("5s")

local r = channel.select {
    result_ch:case_receive(),
    timeout:case_receive()
}

if r.channel == timeout then
    return nil, errors.new("TIMEOUT", "Operation timed out")
end
return r.value
```

### Паттерн fan-in

Объединение нескольких источников в один обработчик.

```lua
local events = process.events()
local inbox = process.inbox()
local shutdown = channel.new()

while true do
    local r = channel.select {
        events:case_receive(),
        inbox:case_receive(),
        shutdown:case_receive()
    }

    if r.channel == shutdown then
        break
    elseif r.channel == events then
        handle_event(r.value)
    else
        handle_message(r.value)
    end
end
```

### Неблокирующая проверка

Проверка наличия данных без блокировки.

```lua
local r = channel.select {
    ch:case_receive(),
    default = true
}

if r.default then
    -- Ничего нет, делаем что-то другое
else
    process(r.value)
end
```

## Создание случаев select

Создание случаев для использования с `channel.select`:

```lua
-- Случай отправки — завершается когда канал может принять значение
ch:case_send(value)

-- Случай получения — завершается когда значение доступно
ch:case_receive()
```

## Паттерн пула воркеров

```lua
local work = channel.new(100)
local results = channel.new(100)

-- Запуск воркеров
for i = 1, num_workers do
    process.spawn("app.workers:processor", "app:processes", work, results)
end

-- Подача работы
for _, item in ipairs(items) do
    work:send(item)
end
work:close()

-- Сбор результатов
local processed = {}
while #processed < #items do
    local result, ok = results:receive()
    if not ok then break end
    table.insert(processed, result)
end
```

## Ошибки

| Условие | Kind | Повторяемо |
|---------|------|------------|
| Отправка в закрытый канал | runtime error | нет |
| Закрытие закрытого канала | runtime error | нет |
| Неверный случай в select | runtime error | нет |

## См. также

- [Управление процессами](lua/core/process.md) — создание и коммуникация процессов
- [Очереди сообщений](lua/storage/queue.md) — сообщения через очереди
- [Функции](lua/core/funcs.md) — вызов функций
