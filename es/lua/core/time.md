---
title: "Tiempo y Duración"
description: "Crea, compara, analiza y formatea valores de tiempo; trabaja con duraciones y zonas horarias; y programa esperas y temporizadores."
---

# Tiempo y Duración
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

El módulo `time` proporciona valores de tiempo, duraciones, manejo de zonas horarias, análisis, formato, esperas y temporizadores. Las llamadas de tiempo compatibles con workflows se registran para que puedan reproducirse de forma determinista.

Esta es una referencia de API. Los bloques de código son ejemplos aislados o patrones parciales de programación, no una entrada completa. Nombres como `do_work`, `try_operation`, `make_request`, `send_reminder`, `user_activity`, `check_health` y `process` representan callbacks, canales o datos de la aplicación. Cuando un fragmento asigna a `_` un error devuelto, presupone que el literal mostrado es válido; maneja los errores si los valores pueden proceder de la entrada o la configuración.

## Carga

```lua
local time = require("time")
```

Añade `time` a la lista `modules:` de la entrada ejecutable antes de requerirlo. Los globales ambientales `channel` y `errors` que usan los ejemplos de programación no necesitan declararse como módulos.

## Tiempo actual

### `now`

Devuelve la hora actual. En los workflows, devuelve la referencia de tiempo registrada del workflow para que la ejecución pueda reproducirse de forma determinista.

```lua
local t = time.now()
print(t:format_rfc3339())  -- "2024-12-29T15:04:05Z"

-- Measure elapsed time
local start = time.now()
do_work()
local elapsed = time.now():sub(start)
print("Took " .. elapsed:milliseconds() .. "ms")
```

La marca de tiempo y la salida de tiempo transcurrido son ilustrativas; `time.now()` proporciona la hora actual o la registrada por el workflow.

**Devuelve:** `Time`

## Creación de valores de tiempo

### Creación a partir de componentes

```lua
-- Create specific date/time in UTC
local t = time.date(2024, time.DECEMBER, 25, 10, 30, 0, 0, time.utc)
print(t:format_rfc3339())  -- "2024-12-25T10:30:00Z"

-- Create in specific timezone
local ny, err = time.load_location("America/New_York")
if err then
    return nil, err
end
local meeting = time.date(2024, time.JANUARY, 15, 14, 0, 0, 0, ny)

-- Defaults to local timezone if not specified
local t = time.date(2024, 1, 15, 12, 0, 0, 0)
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `year` | number | Año |
| `month` | number | Mes (1-12 o `time.JANUARY` etc) |
| `day` | number | Día del mes |
| `hour` | number | Hora (0-23) |
| `minute` | number | Minuto (0-59) |
| `second` | number | Segundo (0-59) |
| `nanosecond` | number | Nanosegundo (0-999999999) |
| `location` | Location | Zona horaria (opcional, por defecto local) |

**Devuelve:** `Time`

### Creación a partir de una marca de tiempo Unix

```lua
-- From seconds since epoch
local t = time.unix(1703862245, 0)
print(t:utc():format_rfc3339())  -- "2023-12-29T15:04:05Z"

-- With nanoseconds
local t = time.unix(1703862245, 500000000)  -- +500ms

-- Convert JavaScript timestamp (milliseconds)
local js_timestamp = 1703862245000
local t = time.unix(js_timestamp // 1000, (js_timestamp % 1000) * 1000000)
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `sec` | number | Segundos Unix |
| `nsec` | number | Desplazamiento en nanosegundos |

**Devuelve:** `Time`

### Análisis a partir de una cadena

Analiza cadenas de tiempo con el formato de hora de referencia de Go: `Mon Jan 2 15:04:05 MST 2006`.

```lua
-- Parse RFC3339
local t, err = time.parse(time.RFC3339, "2024-12-29T15:04:05Z")
if err then
    return nil, err
end

-- Parse custom format
local t, err = time.parse("2006-01-02", "2024-12-29")
local t, err = time.parse("15:04:05", "14:30:00")
local t, err = time.parse("2006-01-02 15:04:05 MST", "2024-12-29 14:30:00 EST")

-- Parse in specific timezone
local ny, _ = time.load_location("America/New_York")
local t, err = time.parse("2006-01-02 15:04", "2024-12-29 14:30", ny)
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `layout` | string | Patrón de formato de hora de Go |
| `value` | string | Cadena que se analizará |
| `location` | Location | Zona horaria por defecto (opcional) |

**Devuelve:** `Time, error`

## Métodos de Time

### Aritmética

```lua
local t = time.now()

-- Add duration (accepts number, string, or Duration)
local tomorrow = t:add("24h")
local later = t:add(5 * time.MINUTE)
local d, _ = time.parse_duration("1h30m")
local future = t:add(d)

-- Subtract time to get duration
local diff = tomorrow:sub(t)  -- returns Duration
print(diff:hours())           -- 24

-- Add calendar units (handles month boundaries correctly)
local next_month = t:add_date(0, 1, 0)   -- add 1 month
local next_year = t:add_date(1, 0, 0)    -- add 1 year
local last_week = t:add_date(0, 0, -7)   -- subtract 7 days
```

| Método | Parámetros | Devuelve | Descripción |
|--------|------------|----------|-------------|
| `add(duration)` | number/string/Duration | Time | Añadir duración |
| `sub(time)` | Time | Duration | Diferencia entre tiempos |
| `add_date(years, months, days)` | numbers | Time | Agregar unidades de calendario |

### Comparación

```lua
local t1 = time.date(2024, 1, 1, 0, 0, 0, 0, time.utc)
local t2 = time.date(2024, 1, 2, 0, 0, 0, 0, time.utc)

t1:before(t2)   -- true
t2:after(t1)    -- true
t1:equal(t1)    -- true
```

| Método | Parámetros | Devuelve | Descripción |
|--------|------------|----------|-------------|
| `before(time)` | Time | boolean | Si este tiempo es anterior al otro valor |
| `after(time)` | Time | boolean | Si este tiempo es posterior al otro valor |
| `equal(time)` | Time | boolean | Si ambos valores representan el mismo tiempo |

### Formateo

```lua
local t = time.now()

t:format_rfc3339()              -- "2024-12-29T15:04:05Z"
t:format(time.DATE_ONLY)        -- "2024-12-29"
t:format(time.TIME_ONLY)        -- "15:04:05"
t:format("Mon Jan 2, 2006")     -- "Sun Dec 29, 2024"
```

| Método | Parámetros | Devuelve | Descripción |
|--------|------------|----------|-------------|
| `format(layout)` | string | string | Formatear con el patrón de Go |
| `format_rfc3339()` | - | string | Formatear como RFC3339 |

### Marcas de tiempo Unix

```lua
local t = time.now()

t:unix()       -- seconds since epoch
t:unix_nano()  -- nanoseconds since epoch
```

### Componentes

```lua
local t = time.now()

-- Get date parts
local year, month, day = t:date()

-- Get time parts
local hour, min, sec = t:clock()

-- Individual accessors
t:year()        -- e.g., 2024
t:month()       -- 1-12
t:day()         -- 1-31
t:hour()        -- 0-23
t:minute()      -- 0-59
t:second()      -- 0-59
t:nanosecond()  -- 0-999999999
t:weekday()     -- 0=Sunday .. 6=Saturday
t:year_day()    -- 1-366
t:is_zero()     -- true if zero value
```

### Conversión de zona horaria

```lua
local t = time.now()

t:utc()                    -- convert to UTC
t:in_local()               -- convert to local timezone
t:in_location(ny)          -- convert to specific timezone
t:location()               -- get current Location
t:location():string()      -- get timezone name
```

| Método | Parámetros | Devuelve | Descripción |
|--------|------------|----------|-------------|
| `utc()` | - | Time | Convertir a UTC |
| `in_local()` | - | Time | Convertir a zona horaria local |
| `in_location(loc)` | Location | Time | Convertir a una zona horaria especificada |
| `location()` | - | Location | Devolver la zona horaria actual |

### Redondeo

Redondea o trunca en límites de duración. **Requiere userdata Duration** (no un número ni una cadena).

```lua
local t = time.now()
local hour_duration, _ = time.parse_duration("1h")
local minute_duration, _ = time.parse_duration("15m")

t:round(hour_duration)       -- round to nearest hour
t:truncate(minute_duration)  -- truncate to 15-minute boundary
```

| Método | Parámetros | Devuelve | Descripción |
|--------|------------|----------|-------------|
| `round(duration)` | Duration | Time | Redondear al múltiplo más cercano |
| `truncate(duration)` | Duration | Time | Truncar al múltiplo |

## Duración

### Creación de una duración

```lua
-- Parse from string
local d, err = time.parse_duration("1h30m45s")
local d, err = time.parse_duration("500ms")
local d, err = time.parse_duration("2h30m45s500ms")

-- From number (nanoseconds)
local d, err = time.parse_duration(time.SECOND)
local d, err = time.parse_duration(5 * time.MINUTE)

-- Valid units: ns, us, ms, s, m, h
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `value` | number/string/Duration | Duración que se analizará |

**Devuelve:** `Duration, error`

### Métodos de Duration

```lua
local d, _ = time.parse_duration("1h30m45s500ms")

d:hours()         -- 1.5125...
d:minutes()       -- 90.75...
d:seconds()       -- 5445.5
d:milliseconds()  -- 5445500
d:microseconds()  -- 5445500000
d:nanoseconds()   -- 5445500000000
```

## Zonas Horarias

### Ubicaciones con nombre

Carga una zona horaria por su nombre IANA, como `America/New_York`, `Europe/London` o `Asia/Tokyo`.

```lua
local ny, err = time.load_location("America/New_York")
if err then
    return nil, err
end

local tokyo, _ = time.load_location("Asia/Tokyo")
local london, _ = time.load_location("Europe/London")

-- Convert between timezones
local t = time.now():utc()
print("UTC:", t:format(time.TIME_ONLY))
print("New York:", t:in_location(ny):format(time.TIME_ONLY))
print("Tokyo:", t:in_location(tokyo):format(time.TIME_ONLY))
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `name` | string | Nombre de zona horaria IANA |

**Devuelve:** `Location, error`

### Ubicaciones con desplazamiento fijo

Crea una zona horaria con un desplazamiento UTC fijo.

```lua
-- UTC+5:30 (India Standard Time)
local ist = time.fixed_zone("IST", 5*3600 + 30*60)

-- UTC-8 (Pacific Standard Time)
local pst = time.fixed_zone("PST", -8*3600)

local t = time.date(2024, 1, 15, 12, 0, 0, 0, ist)
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `name` | string | Nombre de zona |
| `offset` | number | Desplazamiento UTC en segundos |

**Devuelve:** `Location`

### Ubicaciones integradas

```lua
time.utc      -- UTC timezone
time.localtz  -- Local system timezone
```

## Programación

### `sleep`

Suspende la ejecución durante la duración especificada. La ejecución de workflows registra la espera para su reproducción determinista.

```lua
time.sleep("5s")
time.sleep(500 * time.MILLISECOND)

-- Backoff pattern
for attempt = 1, 3 do
    local ok = try_operation()
    if ok then break end
    time.sleep(tostring(attempt) .. "s")
end
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `duration` | number/string/Duration | Tiempo de espera |

### `after`

Devuelve un canal que recibe un valor después de la duración. El canal puede usarse con `channel.select`.

```lua
-- Simple timeout
local timeout, err = time.after("5s")
if err then return nil, err end
timeout:receive()  -- blocks for 5 seconds

-- Timeout with select
local response_ch = make_request()
local timeout_ch, err = time.after("30s")
if err then return nil, err end

local result = channel.select{
    response_ch:case_receive(),
    timeout_ch:case_receive()
}

if result.channel == timeout_ch then
    return nil, errors.new({message = "Request timed out", kind = errors.TIMEOUT})
end
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `duration` | number/string/Duration | Tiempo a esperar |

**Devuelve:** `Channel, error`

### `timer`

Crea un temporizador de un solo disparo que se activa después de la duración y que puede detenerse o reiniciarse.

```lua
local timer, err = time.timer("5s")
if err then
    return nil, err
end

-- Wait for timer
timer:response():receive()
send_reminder()

-- Reset on activity
local idle_timer, err = time.timer("5m")
if err then
    return nil, err
end
local idle_ch = idle_timer:response()
while true do
    local r = channel.select{
        user_activity:case_receive(),
        idle_ch:case_receive()
    }
    if r.channel == idle_ch then
        logout_user()
        break
    end
    idle_timer:reset("5m")
end

-- Stop timer
timer:stop()
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `duration` | number/string/Duration | Tiempo hasta disparo |

**Devuelve:** `Timer, error`

| Método Timer | Parámetros | Devuelve | Descripción |
|--------------|------------|----------|-------------|
| `response()` | - | Channel | Obtener canal de temporizador |
| `channel()` | - | Channel | Alias para response() |
| `stop()` | - | boolean | Cancelar temporizador |
| `reset(duration)` | number/string/Duration | boolean | Reiniciar con nueva duración |

### `ticker`

Crea un temporizador repetitivo que se activa a intervalos regulares.

```lua
-- Periodic task
local ticker, err = time.ticker("30s")
if err then
    return nil, err
end
local ch = ticker:response()

while true do
    local tick_time = ch:receive()
    check_health()
end
```

El bucle anterior está pensado para un proceso de larga duración. Un patrón separado y finito de limitación de tasa es:

```lua
-- Rate limiting
local ticker, err = time.ticker("100ms")
if err then
    return nil, err
end
for _, item in ipairs(items) do
    ticker:response():receive()
    process(item)
end
ticker:stop()
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `duration` | number/string/Duration | Intervalo entre ticks |

**Devuelve:** `Ticker, error`

| Método Ticker | Parámetros | Devuelve | Descripción |
|---------------|------------|----------|-------------|
| `response()` | - | Channel | Obtener canal de ticker |
| `channel()` | - | Channel | Alias para response() |
| `stop()` | - | boolean | Detener ticker |

## Constantes

### Unidades de Duración

Las constantes de duración se expresan en nanosegundos y pueden combinarse mediante operaciones aritméticas.

```lua
time.NANOSECOND    -- 1
time.MICROSECOND   -- 1,000
time.MILLISECOND   -- 1,000,000
time.SECOND        -- 1,000,000,000
time.MINUTE        -- 60 * SECOND
time.HOUR          -- 60 * MINUTE

-- Example usage
time.sleep(5 * time.SECOND)
local timeout, err = time.after(30 * time.SECOND)
if err then return nil, err end
```

### Patrones de formato

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

### Meses

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

### Días de la semana

```lua
time.SUNDAY     -- 0
time.MONDAY     -- 1
time.TUESDAY    -- 2
time.WEDNESDAY  -- 3
time.THURSDAY   -- 4
time.FRIDAY     -- 5
time.SATURDAY   -- 6
```

## Errores

| Condición | Clase | Reintentable |
|-----------|------|--------------|
| Formato de duración no válido | `errors.INVALID` | no |
| Error de análisis | `errors.INVALID` | no |
| Nombre de ubicación vacío | `errors.INVALID` | no |
| Ubicación no encontrada | `errors.NOT_FOUND` | no |
| Duración <= 0 (timer/ticker) | `errors.INVALID` | no |

```lua
local t, err = time.parse(time.RFC3339, "invalid")
if err then
    if errors.is(err, errors.INVALID) then
        print("Invalid format:", err:message())
    end
    return nil, err
end

local loc, err = time.load_location("Unknown/Zone")
if err then
    if errors.is(err, errors.NOT_FOUND) then
        print("Location not found:", err:message())
    end
    return nil, err
end
```

Consulta [Manejo de errores](errors.md) para trabajar con errores.
