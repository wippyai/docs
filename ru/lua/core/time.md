# Время и длительности
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

Работа со значениями времени, длительностями, часовыми поясами и планированием. Создание таймеров, паузы на заданные периоды, парсинг и форматирование временных меток.

В workflows `time.now()` возвращает записанную ссылку времени для детерминированного воспроизведения.

## Загрузка

```lua
local time = require("time")
```

## Текущее время

### now

Возвращает текущее время. В workflows возвращает записанное время из ссылки времени workflow для детерминированного воспроизведения.

```lua
local t = time.now()
print(t:format_rfc3339())  -- "2024-12-29T15:04:05Z"

-- Измерение прошедшего времени
local start = time.now()
do_work()
local elapsed = time.now():sub(start)
print("Заняло " .. elapsed:milliseconds() .. "ms")
```

**Возвращает:** `Time`

## Создание значений времени

### Из компонентов

```lua
-- Создать конкретную дату/время в UTC
local t = time.date(2024, time.DECEMBER, 25, 10, 30, 0, 0, time.utc)
print(t:format_rfc3339())  -- "2024-12-25T10:30:00Z"

-- Создать в конкретном часовом поясе
local ny, _ = time.load_location("America/New_York")
local meeting = time.date(2024, time.JANUARY, 15, 14, 0, 0, 0, ny)

-- По умолчанию локальный часовой пояс, если не указан
local t = time.date(2024, 1, 15, 12, 0, 0, 0)
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `year` | number | Год |
| `month` | number | Месяц (1-12 или `time.JANUARY` и т.д.) |
| `day` | number | День месяца |
| `hour` | number | Час (0-23) |
| `minute` | number | Минута (0-59) |
| `second` | number | Секунда (0-59) |
| `nanosecond` | number | Наносекунда (0-999999999) |
| `location` | Location | Часовой пояс (опционально, по умолчанию локальный) |

**Возвращает:** `Time`

### Из Unix timestamp

```lua
-- Из секунд с эпохи
local t = time.unix(1703862245, 0)
print(t:utc():format_rfc3339())  -- "2023-12-29T15:04:05Z"

-- С наносекундами
local t = time.unix(1703862245, 500000000)  -- +500ms

-- Преобразование JavaScript timestamp (миллисекунды)
local js_timestamp = 1703862245000
local t = time.unix(js_timestamp // 1000, (js_timestamp % 1000) * 1000000)
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `sec` | number | Unix секунды |
| `nsec` | number | Смещение в наносекундах |

**Возвращает:** `Time`

### Из строки

Парсинг строк времени с использованием формата Go reference time: `Mon Jan 2 15:04:05 MST 2006`.

```lua
-- Парсинг RFC3339
local t, err = time.parse(time.RFC3339, "2024-12-29T15:04:05Z")
if err then
    return nil, err
end

-- Парсинг пользовательского формата
local t, err = time.parse("2006-01-02", "2024-12-29")
local t, err = time.parse("15:04:05", "14:30:00")
local t, err = time.parse("2006-01-02 15:04:05 MST", "2024-12-29 14:30:00 EST")

-- Парсинг в конкретном часовом поясе
local ny, _ = time.load_location("America/New_York")
local t, err = time.parse("2006-01-02 15:04", "2024-12-29 14:30", ny)
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `layout` | string | Шаблон формата времени Go |
| `value` | string | Строка для парсинга |
| `location` | Location | Часовой пояс по умолчанию (опционально) |

**Возвращает:** `Time, error`

## Методы Time

### Арифметика

```lua
local t = time.now()

-- Добавить длительность (принимает число, строку или Duration)
local tomorrow = t:add("24h")
local later = t:add(5 * time.MINUTE)
local d, _ = time.parse_duration("1h30m")
local future = t:add(d)

-- Вычесть время для получения длительности
local diff = tomorrow:sub(t)  -- возвращает Duration
print(diff:hours())           -- 24

-- Добавить календарные единицы (правильно обрабатывает границы месяцев)
local next_month = t:add_date(0, 1, 0)   -- добавить 1 месяц
local next_year = t:add_date(1, 0, 0)    -- добавить 1 год
local last_week = t:add_date(0, 0, -7)   -- вычесть 7 дней
```

| Метод | Параметры | Возвращает | Описание |
|-------|-----------|------------|----------|
| `add(duration)` | number/string/Duration | Time | Добавить длительность |
| `sub(time)` | Time | Duration | Разница между временами |
| `add_date(years, months, days)` | numbers | Time | Добавить календарные единицы |

### Сравнение

```lua
local t1 = time.date(2024, 1, 1, 0, 0, 0, 0, time.utc)
local t2 = time.date(2024, 1, 2, 0, 0, 0, 0, time.utc)

t1:before(t2)   -- true
t2:after(t1)    -- true
t1:equal(t1)    -- true
```

| Метод | Параметры | Возвращает | Описание |
|-------|-----------|------------|----------|
| `before(time)` | Time | boolean | Это время раньше другого? |
| `after(time)` | Time | boolean | Это время позже другого? |
| `equal(time)` | Time | boolean | Времена равны? |

### Форматирование

```lua
local t = time.now()

t:format_rfc3339()              -- "2024-12-29T15:04:05Z"
t:format(time.DATE_ONLY)        -- "2024-12-29"
t:format(time.TIME_ONLY)        -- "15:04:05"
t:format("Mon Jan 2, 2006")     -- "Sun Dec 29, 2024"
```

| Метод | Параметры | Возвращает | Описание |
|-------|-----------|------------|----------|
| `format(layout)` | string | string | Форматировать по шаблону Go |
| `format_rfc3339()` | - | string | Форматировать как RFC3339 |

### Unix Timestamps

```lua
local t = time.now()

t:unix()       -- секунды с эпохи
t:unix_nano()  -- наносекунды с эпохи
```

### Компоненты

```lua
local t = time.now()

-- Получить части даты
local year, month, day = t:date()

-- Получить части времени
local hour, min, sec = t:clock()

-- Отдельные аксессоры
t:year()        -- например, 2024
t:month()       -- 1-12
t:day()         -- 1-31
t:hour()        -- 0-23
t:minute()      -- 0-59
t:second()      -- 0-59
t:nanosecond()  -- 0-999999999
t:weekday()     -- 0=Воскресенье .. 6=Суббота
t:year_day()    -- 1-366
t:is_zero()     -- true если нулевое значение
```

### Преобразование часовых поясов

```lua
local t = time.now()

t:utc()                    -- преобразовать в UTC
t:in_local()               -- преобразовать в локальный часовой пояс
t:in_location(ny)          -- преобразовать в конкретный часовой пояс
t:location()               -- получить текущий Location
t:location():string()      -- получить имя часового пояса
```

| Метод | Параметры | Возвращает | Описание |
|-------|-----------|------------|----------|
| `utc()` | - | Time | Преобразовать в UTC |
| `in_local()` | - | Time | Преобразовать в локальный пояс |
| `in_location(loc)` | Location | Time | Преобразовать в часовой пояс |
| `location()` | - | Location | Получить текущий часовой пояс |

### Округление

Округление или усечение до границ длительности. **Требуется userdata Duration** (не число или строка).

```lua
local t = time.now()
local hour_duration, _ = time.parse_duration("1h")
local minute_duration, _ = time.parse_duration("15m")

t:round(hour_duration)       -- округлить до ближайшего часа
t:truncate(minute_duration)  -- усечь до 15-минутной границы
```

| Метод | Параметры | Возвращает | Описание |
|-------|-----------|------------|----------|
| `round(duration)` | Duration | Time | Округлить до ближайшего кратного |
| `truncate(duration)` | Duration | Time | Усечь до кратного |

## Длительности

### Создание длительностей

```lua
-- Парсинг из строки
local d, err = time.parse_duration("1h30m45s")
local d, err = time.parse_duration("500ms")
local d, err = time.parse_duration("2h30m45s500ms")

-- Из числа (наносекунды)
local d, err = time.parse_duration(time.SECOND)
local d, err = time.parse_duration(5 * time.MINUTE)

-- Допустимые единицы: ns, us, ms, s, m, h
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `value` | number/string/Duration | Длительность для парсинга |

**Возвращает:** `Duration, error`

### Методы Duration

```lua
local d, _ = time.parse_duration("1h30m45s500ms")

d:hours()         -- 1.5125...
d:minutes()       -- 90.75...
d:seconds()       -- 5445.5
d:milliseconds()  -- 5445500
d:microseconds()  -- 5445500000
d:nanoseconds()   -- 5445500000000
```

## Часовые пояса

### Загрузка по имени

Загрузка часового пояса по IANA-имени (например, "America/New_York", "Europe/London", "Asia/Tokyo").

```lua
local ny, err = time.load_location("America/New_York")
if err then
    return nil, err
end

local tokyo, _ = time.load_location("Asia/Tokyo")
local london, _ = time.load_location("Europe/London")

-- Преобразование между часовыми поясами
local t = time.now():utc()
print("UTC:", t:format(time.TIME_ONLY))
print("New York:", t:in_location(ny):format(time.TIME_ONLY))
print("Tokyo:", t:in_location(tokyo):format(time.TIME_ONLY))
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `name` | string | IANA-имя часового пояса |

**Возвращает:** `Location, error`

### Фиксированное смещение

Создание часового пояса с фиксированным смещением UTC.

```lua
-- UTC+5:30 (India Standard Time)
local ist = time.fixed_zone("IST", 5*3600 + 30*60)

-- UTC-8 (Pacific Standard Time)
local pst = time.fixed_zone("PST", -8*3600)

local t = time.date(2024, 1, 15, 12, 0, 0, 0, ist)
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `name` | string | Имя зоны |
| `offset` | number | Смещение UTC в секундах |

**Возвращает:** `Location`

### Встроенные Location

```lua
time.utc      -- Часовой пояс UTC
time.localtz  -- Локальный системный часовой пояс
```

## Планирование

### sleep

Пауза выполнения на указанную длительность. В workflows записывается и воспроизводится корректно.

```lua
time.sleep("5s")
time.sleep(500 * time.MILLISECOND)

-- Паттерн backoff
for attempt = 1, 3 do
    local ok = try_operation()
    if ok then break end
    time.sleep(tostring(attempt) .. "s")
end
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `duration` | number/string/Duration | Время паузы |

### after

Возвращает канал, получающий значение один раз после истечения длительности. Работает с `channel.select`.

```lua
-- Простой таймаут
local timeout = time.after("5s")
timeout:receive()  -- блокируется на 5 секунд

-- Таймаут с select
local response_ch = make_request()
local timeout_ch = time.after("30s")

local result = channel.select{
    response_ch:case_receive(),
    timeout_ch:case_receive()
}

if result.channel == timeout_ch then
    return nil, errors.new("TIMEOUT", "Request timed out")
end
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `duration` | number/string/Duration | Время ожидания |

**Возвращает:** `Channel`

### timer

Одноразовый таймер, срабатывающий после длительности. Можно остановить или сбросить.

```lua
local timer = time.timer("5s")

-- Ждать таймер
timer:response():receive()
send_reminder()

-- Сброс при активности
local idle_timer = time.timer("5m")
while true do
    local r = channel.select{
        user_activity:case_receive(),
        idle_timer:response():case_receive()
    }
    if r.channel == idle_timer:response() then
        logout_user()
        break
    end
    idle_timer:reset("5m")
end

-- Остановить таймер
timer:stop()
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `duration` | number/string/Duration | Время до срабатывания |

**Возвращает:** `Timer, error`

| Метод Timer | Параметры | Возвращает | Описание |
|-------------|-----------|------------|----------|
| `response()` | - | Channel | Получить канал таймера |
| `channel()` | - | Channel | Псевдоним для response() |
| `stop()` | - | boolean | Отменить таймер |
| `reset(duration)` | number/string/Duration | boolean | Сбросить с новой длительностью |

### ticker

Повторяющийся таймер, срабатывающий через регулярные интервалы.

```lua
-- Периодическая задача
local ticker = time.ticker("30s")
local ch = ticker:response()

while true do
    local tick_time = ch:receive()
    check_health()
end

-- Ограничение частоты
local ticker = time.ticker("100ms")
for _, item in ipairs(items) do
    ticker:response():receive()
    process(item)
end
ticker:stop()
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `duration` | number/string/Duration | Интервал между тиками |

**Возвращает:** `Ticker, error`

| Метод Ticker | Параметры | Возвращает | Описание |
|--------------|-----------|------------|----------|
| `response()` | - | Channel | Получить канал тикера |
| `channel()` | - | Channel | Псевдоним для response() |
| `stop()` | - | boolean | Остановить тикер |

## Константы

### Единицы длительности

Константы длительности в наносекундах. Используйте в арифметике.

```lua
time.NANOSECOND    -- 1
time.MICROSECOND   -- 1,000
time.MILLISECOND   -- 1,000,000
time.SECOND        -- 1,000,000,000
time.MINUTE        -- 60 * SECOND
time.HOUR          -- 60 * MINUTE

-- Пример использования
time.sleep(5 * time.SECOND)
local timeout = time.after(30 * time.SECOND)
```

### Шаблоны форматов

```lua
time.RFC3339       -- "2006-01-02T15:04:05Z07:00"
time.RFC3339NANO   -- "2006-01-02T15:04:05.999999999Z07:00"
time.RFC822        -- "02 Jan 06 15:04 MST"
time.RFC822Z       -- "02 Jan 06 15:04 -0700"
time.RFC850        -- "Monday, 02-Jan-06 15:04:05 MST"
time.RFC1123       -- "Mon, 02 Jan 2006 15:04:05 MST"
time.RFC1123Z      -- "Mon, 02 Jan 2006 15:04:05 -0700"
time.DATE_TIME     -- "2006-01-02 15:04:05"
time.DATE_ONLY     -- "2006-01-02"
time.TIME_ONLY     -- "15:04:05"
time.KITCHEN       -- "3:04PM"
time.STAMP         -- "Jan _2 15:04:05"
time.STAMP_MILLI   -- "Jan _2 15:04:05.000"
time.STAMP_MICRO   -- "Jan _2 15:04:05.000000"
time.STAMP_NANO    -- "Jan _2 15:04:05.000000000"
```

### Месяцы

```lua
time.JANUARY    -- 1
time.FEBRUARY   -- 2
time.MARCH      -- 3
time.APRIL      -- 4
time.MAY        -- 5
time.JUNE       -- 6
time.JULY       -- 7
time.AUGUST     -- 8
time.SEPTEMBER  -- 9
time.OCTOBER    -- 10
time.NOVEMBER   -- 11
time.DECEMBER   -- 12
```

### Дни недели

```lua
time.SUNDAY     -- 0
time.MONDAY     -- 1
time.TUESDAY    -- 2
time.WEDNESDAY  -- 3
time.THURSDAY   -- 4
time.FRIDAY     -- 5
time.SATURDAY   -- 6
```

## Ошибки

| Условие | Kind | Повторяемо |
|---------|------|------------|
| Неверный формат длительности | `errors.INVALID` | нет |
| Парсинг не удался | `errors.INVALID` | нет |
| Пустое имя location | `errors.INVALID` | нет |
| Location не найден | `errors.NOT_FOUND` | нет |
| Duration <= 0 (timer/ticker) | `errors.INVALID` | нет |

```lua
local t, err = time.parse(time.RFC3339, "invalid")
if err then
    if errors.is(err, errors.INVALID) then
        print("Неверный формат:", err:message())
    end
    return nil, err
end

local loc, err = time.load_location("Unknown/Zone")
if err then
    if errors.is(err, errors.NOT_FOUND) then
        print("Location не найден:", err:message())
    end
    return nil, err
end
```

См. [Обработка ошибок](lua-errors.md) для работы с ошибками.
