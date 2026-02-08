# Процессы и обмен сообщениями

Создание изолированных процессов и взаимодействие через передачу сообщений.

## Обзор

Процессы предоставляют изолированные единицы выполнения, которые взаимодействуют через передачу сообщений. Каждый процесс имеет собственный почтовый ящик и может подписываться на конкретные темы сообщений.

Основные концепции:
- Создание процессов с помощью `process.spawn()` и его вариантов
- Отправка сообщений по PID или зарегистрированным именам через темы
- Получение сообщений через `process.listen()` или `process.inbox()`
- Мониторинг жизненного цикла процессов через события
- Связывание процессов для координированной обработки отказов

## Создание процессов

Создание нового процесса по ссылке на запись.

```lua
local pid, err = process.spawn("app.test.process:echo_worker", "app:processes", "hello")
if err then
    return false, "spawn failed: " .. err
end

-- pid is a string identifier for the spawned process
print("Started worker:", pid)
```

Параметры:
- Ссылка на запись (например, `"app.test.process:echo_worker"`)
- Ссылка на хост (например, `"app:processes"`)
- Необязательные аргументы, передаваемые в функцию main воркера

### Получение собственного PID

```lua
local my_pid = process.pid()
-- Returns string PID of current process
```

## Передача сообщений

Сообщения используют маршрутизацию на основе тем. Отправляйте сообщения на PID с указанием темы, затем получайте через подписку на тему или через почтовый ящик.

### Отправка сообщений

```lua
-- Send to process by PID
local sent, err = process.send(worker_pid, "messages", "hello from parent")
if err then
    return false, "send failed: " .. err
end

-- send returns (bool, error)
```

### Получение через подписку на тему

Подписывайтесь на конкретные темы с помощью `process.listen()`:

```lua
-- Worker that listens for messages on "messages" topic
local function main()
    local ch = process.listen("messages")

    local msg = ch:receive()
    if msg then
        -- msg is the payload directly
        print("Received:", msg)
        return true
    end

    return false
end

return { main = main }
```

### Получение через почтовый ящик

Почтовый ящик получает сообщения, не соответствующие ни одному слушателю тем:

```lua
local function main()
    local inbox_ch = process.inbox()
    local specific_ch = process.listen("specific_topic")

    while true do
        local result = channel.select({
            specific_ch:case_receive(),
            inbox_ch:case_receive()
        })

        if result.channel == specific_ch then
            -- Messages to "specific_topic" arrive here
            local payload = result.value
        elseif result.channel == inbox_ch then
            -- Messages to any OTHER topic arrive here
            local msg = result.value
            print("Inbox got:", msg.topic, msg.payload)
        end
    end
end
```

### Режим сообщений для информации об отправителе

Используйте `{ message = true }` для доступа к PID отправителя и теме:

```lua
-- Worker that echoes messages back to sender
local function main()
    local ch = process.listen("echo", { message = true })

    local msg = ch:receive()
    if msg then
        local sender = msg:from()
        local payload = msg:payload()

        if sender then
            process.send(sender, "reply", payload)
        end
        return true
    end

    return false
end

return { main = main }
```

## Мониторинг процессов

Мониторинг процессов для получения событий EXIT при их завершении.

### Создание с мониторингом

```lua
local events_ch = process.events()

local worker_pid, err = process.spawn_monitored(
    "app.test.process:events_exit_worker",
    "app:processes"
)
if err then
    return false, "spawn failed: " .. err
end

-- Wait for EXIT event
local timeout = time.after("3s")
local result = channel.select {
    events_ch:case_receive(),
    timeout:case_receive(),
}

if result.channel == timeout then
    return false, "timeout waiting for EXIT event"
end

local event = result.value
if event.kind == process.event.EXIT then
    print("Worker exited:", event.from)
    if event.error then
        print("Exit error:", event.error)
    end
    -- Access return value via event.result
end
```

### Явный мониторинг

Мониторинг уже запущенного процесса:

```lua
local events_ch = process.events()

-- Spawn without monitoring
local worker_pid, err = process.spawn("app.test.process:long_worker", "app:processes")
if err then
    return false, "spawn failed: " .. err
end

-- Add monitoring explicitly
local ok, monitor_err = process.monitor(worker_pid)
if monitor_err then
    return false, "monitor failed: " .. monitor_err
end

-- Now will receive EXIT events for this worker
```

Прекращение мониторинга:

```lua
local ok, err = process.unmonitor(worker_pid)
```

## Связывание процессов

Связывание процессов для координированного управления жизненным циклом. Связанные процессы получают события LINK_DOWN, когда связанный процесс завершается с ошибкой.

### Создание связанного процесса

```lua
-- Child terminates if parent crashes (unless trap_links is set)
local pid, err = process.spawn_linked("app.test.process:child_worker", "app:processes")
if err then
    return false, "spawn_linked failed: " .. err
end
```

### Явное связывание

```lua
-- Link to existing process
local ok, err = process.link(target_pid)
if err then
    return false, "link failed: " .. err
end

-- Unlink
local ok, err = process.unlink(target_pid)
```

### Обработка событий LINK_DOWN

По умолчанию LINK_DOWN приводит к завершению процесса с ошибкой. Включите `trap_links` для получения события вместо падения:

```lua
local function main()
    -- Enable trap_links to receive LINK_DOWN events instead of crashing
    local ok, err = process.set_options({ trap_links = true })
    if not ok then
        return false, "set_options failed: " .. err
    end

    -- Verify trap_links is enabled
    local opts = process.get_options()
    if not opts.trap_links then
        return false, "trap_links should be true"
    end

    local events_ch = process.events()

    -- Spawn a linked process that will fail
    local error_pid, err2 = process.spawn_linked(
        "app.test.process:error_exit_worker",
        "app:processes"
    )
    if err2 then
        return false, "spawn error worker failed: " .. err2
    end

    -- Wait for LINK_DOWN event
    local timeout = time.after("2s")
    local result = channel.select {
        events_ch:case_receive(),
        timeout:case_receive(),
    }

    if result.channel == timeout then
        return false, "timeout waiting for LINK_DOWN"
    end

    local event = result.value
    if event.kind == process.event.LINK_DOWN then
        print("Linked process died:", event.from)
        -- Handle gracefully instead of crashing
        return true
    end

    return false, "expected LINK_DOWN, got: " .. tostring(event.kind)
end

return { main = main }
```

## Реестр процессов

Регистрация имён для процессов для поиска и обмена сообщениями по имени.

### Регистрация имён

```lua
local function main()
    local test_name = "my_service_" .. tostring(os.time())

    -- Register current process with a name
    local ok, err = process.registry.register(test_name)
    if err then
        return false, "register failed: " .. err
    end

    -- Lookup the registered name
    local pid, lookup_err = process.registry.lookup(test_name)
    if lookup_err then
        return false, "lookup failed: " .. lookup_err
    end

    -- Verify it resolves to our PID
    if pid ~= process.pid() then
        return false, "lookup returned wrong pid"
    end

    return true
end

return { main = main }
```

### Снятие регистрации

```lua
-- Unregister explicitly
local unregistered = process.registry.unregister(test_name)
if not unregistered then
    print("Name was not registered")
end

-- Lookup after unregister returns nil + error
local pid, err = process.registry.lookup(test_name)
-- pid will be nil, err will be non-nil
```

Имена автоматически освобождаются при завершении процесса.

## Полный пример: пул воркеров с мониторингом

Этот пример показывает родительский процесс, создающий несколько воркеров с мониторингом и отслеживающий их завершение.

```lua
-- Parent process
local time = require("time")

local function main()
    local events_ch = process.events()

    -- Track spawned workers
    local workers = {}
    local worker_count = 5

    -- Spawn multiple monitored workers
    for i = 1, worker_count do
        local worker_pid, err = process.spawn_monitored(
            "app.test.process:task_worker",
            "app:processes",
            { task_id = i, value = i * 10 }
        )

        if err then
            return false, "spawn worker " .. i .. " failed: " .. err
        end

        workers[worker_pid] = { task_id = i, started = os.time() }
    end

    -- Wait for all workers to complete
    local completed = 0
    local timeout = time.after("10s")

    while completed < worker_count do
        local result = channel.select {
            events_ch:case_receive(),
            timeout:case_receive(),
        }

        if result.channel == timeout then
            return false, "timeout waiting for workers"
        end

        local event = result.value
        if event.kind == process.event.EXIT then
            local worker = workers[event.from]
            if worker then
                if event.error then
                    print("Worker " .. worker.task_id .. " failed:", event.error)
                else
                    print("Worker " .. worker.task_id .. " completed:", event.result)
                end
                completed = completed + 1
            end
        end
    end

    return true
end

return { main = main }
```

Процесс-воркер:

```lua
-- task_worker.lua
local time = require("time")

local function main(task)
    -- Simulate work
    time.sleep("100ms")

    -- Process task
    local result = task.value * 2

    return result
end

return { main = main }
```

## Сводка

Создание процессов:
- `process.spawn()` - Базовое создание, возвращает PID
- `process.spawn_monitored()` - Создание с автоматическим мониторингом
- `process.spawn_linked()` - Создание со связыванием жизненных циклов
- `process.pid()` - Получить PID текущего процесса

Обмен сообщениями:
- `process.send(pid, topic, payload)` - Отправить сообщение на PID
- `process.listen(topic)` - Подписаться на тему, получать полезную нагрузку
- `process.listen(topic, { message = true })` - Получать полное сообщение с `:from()`, `:payload()`, `:topic()`
- `process.inbox()` - Получать сообщения, не соответствующие слушателям

Мониторинг:
- `process.events()` - Канал для событий EXIT и LINK_DOWN
- `process.monitor(pid)` - Мониторить существующий процесс
- `process.unmonitor(pid)` - Прекратить мониторинг

Связывание:
- `process.link(pid)` - Связать с процессом
- `process.unlink(pid)` - Отвязать от процесса
- `process.set_options({ trap_links = true })` - Получать LINK_DOWN как событие вместо падения
- `process.get_options()` - Получить текущие параметры процесса

Реестр:
- `process.registry.register(name)` - Зарегистрировать имя для текущего процесса
- `process.registry.lookup(name)` - Найти PID по имени
- `process.registry.unregister(name)` - Удалить регистрацию имени

## Смотрите также

- [Справочник модуля процессов](lua/core/process.md) - Полная документация API
- [Каналы](channels.md) - Операции с каналами для обработки сообщений
