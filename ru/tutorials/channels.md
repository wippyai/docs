# Каналы и конкурентность

Каналы в стиле Go для конкурентного программирования внутри процессов.

## Создание каналов

Каналы -- это коммуникационные трубы для корутин. Создаются с помощью `channel.new(capacity)`:

```lua
local ch = channel.new(1)  -- buffered channel, capacity 1
```

### Буферизированные каналы

Буферизированные каналы позволяют отправлять данные без блокировки, пока буфер не заполнен:

```lua
local ch = channel.new(3)  -- buffer holds 3 items

-- Send without blocking
ch:send(1)
ch:send(2)
ch:send(3)

-- Receive in FIFO order
local v1, ok1 = ch:receive()  -- 1, true
local v2, ok2 = ch:receive()  -- 2, true
local v3, ok3 = ch:receive()  -- 3, true
```

### Небуферизированные каналы

Небуферизированные каналы (ёмкость 0) синхронизируют отправителя и получателя:

```lua
local ch = channel.new(0)  -- unbuffered
local done = channel.new(1)

coroutine.spawn(function()
    ch:send("from spawn")  -- blocks until receiver ready
    done:send(true)
end)

local val = ch:receive()  -- receives "from spawn"
local completed = done:receive()
```

## Выбор из каналов

`channel.select` ожидает несколько каналов и возвращает первую готовую операцию:

```lua
local ch1 = channel.new(1)
local ch2 = channel.new(1)

ch1:send("ch1_value")

local result = channel.select{
    ch1:case_receive(),
    ch2:case_receive()
}

-- result is a table with: channel, value, ok
result.channel == ch1  -- true
result.value           -- "ch1_value"
result.ok              -- true
```

### Select с отправкой

Используйте `case_send` для неблокирующей отправки:

```lua
local ch = channel.new(1)

local result = channel.select{
    ch:case_send("sent")
}

result.ok  -- true (send succeeded)

local v = ch:receive()  -- "sent"
```

## Паттерн "производитель-потребитель"

Один производитель, один потребитель:

```lua
local ch = channel.new(5)
local done = channel.new(1)
local consumed = 0

-- Consumer
coroutine.spawn(function()
    while true do
        local v, ok = ch:receive()
        if not ok then break end
        consumed = consumed + 1
    end
    done:send(consumed)
end)

-- Producer
for i = 1, 10 do
    ch:send(i)
end
ch:close()

local total = done:receive()  -- 10
```

### Паттерн "пинг-понг"

Синхронизация двух корутин:

```lua
local ping = channel.new(0)
local pong = channel.new(0)
local rounds_done = channel.new(1)

coroutine.spawn(function()
    for i = 1, 5 do
        ping:receive()
        pong:send("pong")
    end
    rounds_done:send(true)
end)

for i = 1, 5 do
    ping:send("ping")
    pong:receive()
end

local completed = rounds_done:receive()
```

## Паттерн Fan-Out

Один производитель, несколько потребителей:

```lua
local work = channel.new(10)
local results = channel.new(10)

-- Spawn 3 workers
for w = 1, 3 do
    coroutine.spawn(function()
        while true do
            local job, ok = work:receive()
            if not ok then break end
            results:send(job * 2)
        end
    end)
end

-- Send work
for i = 1, 6 do
    work:send(i)
end
work:close()

-- Collect results
local sum = 0
for i = 1, 6 do
    local r = results:receive()
    sum = sum + r
end
-- sum = (1+2+3+4+5+6)*2 = 42
```

## Паттерн Fan-In

Несколько производителей, один потребитель:

```lua
local output = channel.new(10)
local producer_count = 4
local items_per_producer = 5

-- Spawn producers
for p = 1, producer_count do
    coroutine.spawn(function()
        for i = 1, items_per_producer do
            output:send({producer = p, item = i})
        end
    end)
end

-- Collect all messages
local received = {}
for i = 1, producer_count * items_per_producer do
    local msg = output:receive()
    table.insert(received, msg)
end

-- Verify all producers sent their items
local counts = {}
for _, msg in ipairs(received) do
    counts[msg.producer] = (counts[msg.producer] or 0) + 1
end
```

## Закрытие каналов

Закрывайте каналы для сигнализации завершения. Получатели получают `ok = false`, когда канал закрыт и пуст:

```lua
local ch = channel.new(5)
local done = channel.new(1)

coroutine.spawn(function()
    local count = 0
    while true do
        local v, ok = ch:receive()
        if not ok then break end  -- channel closed
        count = count + 1
    end
    done:send(count)
end)

for i = 1, 10 do
    ch:send(i)
end
ch:close()  -- signal no more values

local total = done:receive()
```

## Методы каналов

Доступные операции:

- `channel.new(capacity)` - Создать канал с заданным размером буфера
- `ch:send(value)` - Отправить значение (блокируется, если буфер полон)
- `ch:receive()` - Получить значение, возвращает `value, ok`
- `ch:close()` - Закрыть канал
- `ch:case_send(value)` - Создать случай отправки для select
- `ch:case_receive()` - Создать случай получения для select
- `channel.select{cases...}` - Ожидать несколько операций

## Дальнейшее чтение

- [Справочник модуля каналов](lua/core/channel.md) - Полная документация API
- [Процессы](processes.md) - Межпроцессное взаимодействие
