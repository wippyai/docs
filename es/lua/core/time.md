# Tiempo y Duracion
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

Trabajar con valores de tiempo, duraciones, zonas horarias y programacion. Crear temporizadores, dormir por periodos especificados, parsear y formatear marcas de tiempo.

En flujos de trabajo, `time.now()` devuelve una referencia de tiempo grabada para reproduccion deterministica.

## Carga

```lua
local time = require("time")
```

## Tiempo Actual

### now

Devuelve el tiempo actual. En flujos de trabajo, devuelve el tiempo grabado de la referencia de tiempo del flujo de trabajo para reproduccion deterministica.

```lua
local t = time.now()
print(t:format_rfc3339())  -- "2024-12-29T15:04:05Z"

-- Medir tiempo transcurrido
local start = time.now()
do_work()
local elapsed = time.now():sub(start)
print("Took " .. elapsed:milliseconds() .. "ms")
```

**Devuelve:** `Time`

## Crear Valores de Tiempo

### Desde Componentes

```lua
-- Crear fecha/hora especifica en UTC
local t = time.date(2024, time.DECEMBER, 25, 10, 30, 0, 0, time.utc)
print(t:format_rfc3339())  -- "2024-12-25T10:30:00Z"

-- Crear en zona horaria especifica
local ny, _ = time.load_location("America/New_York")
local meeting = time.date(2024, time.JANUARY, 15, 14, 0, 0, 0, ny)

-- Por defecto zona horaria local si no se especifica
local t = time.date(2024, 1, 15, 12, 0, 0, 0)
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `year` | number | Ano |
| `month` | number | Mes (1-12 o `time.JANUARY` etc) |
| `day` | number | Dia del mes |
| `hour` | number | Hora (0-23) |
| `minute` | number | Minuto (0-59) |
| `second` | number | Segundo (0-59) |
| `nanosecond` | number | Nanosegundo (0-999999999) |
| `location` | Location | Zona horaria (opcional, por defecto local) |

**Devuelve:** `Time`

### Desde Timestamp Unix

```lua
-- Desde segundos desde la epoca
local t = time.unix(1703862245, 0)
print(t:utc():format_rfc3339())  -- "2023-12-29T15:04:05Z"

-- Con nanosegundos
local t = time.unix(1703862245, 500000000)  -- +500ms

-- Convertir timestamp JavaScript (milisegundos)
local js_timestamp = 1703862245000
local t = time.unix(js_timestamp // 1000, (js_timestamp % 1000) * 1000000)
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `sec` | number | Segundos Unix |
| `nsec` | number | Desplazamiento en nanosegundos |

**Devuelve:** `Time`

### Desde String

Parsear strings de tiempo usando el formato de tiempo de referencia de Go: `Mon Jan 2 15:04:05 MST 2006`.

```lua
-- Parsear RFC3339
local t, err = time.parse(time.RFC3339, "2024-12-29T15:04:05Z")
if err then
    return nil, err
end

-- Parsear formato personalizado
local t, err = time.parse("2006-01-02", "2024-12-29")
local t, err = time.parse("15:04:05", "14:30:00")
local t, err = time.parse("2006-01-02 15:04:05 MST", "2024-12-29 14:30:00 EST")

-- Parsear en zona horaria especifica
local ny, _ = time.load_location("America/New_York")
local t, err = time.parse("2006-01-02 15:04", "2024-12-29 14:30", ny)
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `layout` | string | Layout de formato de tiempo Go |
| `value` | string | String a parsear |
| `location` | Location | Zona horaria por defecto (opcional) |

**Devuelve:** `Time, error`

## Metodos de Time

### Aritmetica

```lua
local t = time.now()

-- Agregar duracion (acepta numero, string o Duration)
local tomorrow = t:add("24h")
local later = t:add(5 * time.MINUTE)
local d, _ = time.parse_duration("1h30m")
local future = t:add(d)

-- Restar tiempo para obtener duracion
local diff = tomorrow:sub(t)  -- devuelve Duration
print(diff:hours())           -- 24

-- Agregar unidades de calendario (maneja limites de mes correctamente)
local next_month = t:add_date(0, 1, 0)   -- agregar 1 mes
local next_year = t:add_date(1, 0, 0)    -- agregar 1 ano
local last_week = t:add_date(0, 0, -7)   -- restar 7 dias
```

| Metodo | Parametros | Devuelve | Descripcion |
|--------|------------|----------|-------------|
| `add(duration)` | number/string/Duration | Time | Agregar duracion |
| `sub(time)` | Time | Duration | Diferencia entre tiempos |
| `add_date(years, months, days)` | numbers | Time | Agregar unidades de calendario |

### Comparacion

```lua
local t1 = time.date(2024, 1, 1, 0, 0, 0, 0, time.utc)
local t2 = time.date(2024, 1, 2, 0, 0, 0, 0, time.utc)

t1:before(t2)   -- true
t2:after(t1)    -- true
t1:equal(t1)    -- true
```

| Metodo | Parametros | Devuelve | Descripcion |
|--------|------------|----------|-------------|
| `before(time)` | Time | boolean | Es este tiempo antes del otro? |
| `after(time)` | Time | boolean | Es este tiempo despues del otro? |
| `equal(time)` | Time | boolean | Son los tiempos iguales? |

### Formateo

```lua
local t = time.now()

t:format_rfc3339()              -- "2024-12-29T15:04:05Z"
t:format(time.DATE_ONLY)        -- "2024-12-29"
t:format(time.TIME_ONLY)        -- "15:04:05"
t:format("Mon Jan 2, 2006")     -- "Sun Dec 29, 2024"
```

| Metodo | Parametros | Devuelve | Descripcion |
|--------|------------|----------|-------------|
| `format(layout)` | string | string | Formatear usando layout Go |
| `format_rfc3339()` | - | string | Formatear como RFC3339 |

### Timestamps Unix

```lua
local t = time.now()

t:unix()       -- segundos desde la epoca
t:unix_nano()  -- nanosegundos desde la epoca
```

### Componentes

```lua
local t = time.now()

-- Obtener partes de fecha
local year, month, day = t:date()

-- Obtener partes de hora
local hour, min, sec = t:clock()

-- Accesores individuales
t:year()        -- ej., 2024
t:month()       -- 1-12
t:day()         -- 1-31
t:hour()        -- 0-23
t:minute()      -- 0-59
t:second()      -- 0-59
t:nanosecond()  -- 0-999999999
t:weekday()     -- 0=Domingo .. 6=Sabado
t:year_day()    -- 1-366
t:is_zero()     -- true si valor cero
```

### Conversion de Zona Horaria

```lua
local t = time.now()

t:utc()                    -- convertir a UTC
t:in_local()               -- convertir a zona horaria local
t:in_location(ny)          -- convertir a zona horaria especifica
t:location()               -- obtener Location actual
t:location():string()      -- obtener nombre de zona horaria
```

| Metodo | Parametros | Devuelve | Descripcion |
|--------|------------|----------|-------------|
| `utc()` | - | Time | Convertir a UTC |
| `in_local()` | - | Time | Convertir a zona horaria local |
| `in_location(loc)` | Location | Time | Convertir a zona horaria |
| `location()` | - | Location | Obtener zona horaria actual |

### Redondeo

Redondear o truncar a limites de duracion. **Requiere userdata Duration** (no numero o string).

```lua
local t = time.now()
local hour_duration, _ = time.parse_duration("1h")
local minute_duration, _ = time.parse_duration("15m")

t:round(hour_duration)       -- redondear a hora mas cercana
t:truncate(minute_duration)  -- truncar a limite de 15 minutos
```

| Metodo | Parametros | Devuelve | Descripcion |
|--------|------------|----------|-------------|
| `round(duration)` | Duration | Time | Redondear a multiplo mas cercano |
| `truncate(duration)` | Duration | Time | Truncar a multiplo |

## Duracion

### Crear Duraciones

```lua
-- Parsear desde string
local d, err = time.parse_duration("1h30m45s")
local d, err = time.parse_duration("500ms")
local d, err = time.parse_duration("2h30m45s500ms")

-- Desde numero (nanosegundos)
local d, err = time.parse_duration(time.SECOND)
local d, err = time.parse_duration(5 * time.MINUTE)

-- Unidades validas: ns, us, ms, s, m, h
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `value` | number/string/Duration | Duracion a parsear |

**Devuelve:** `Duration, error`

### Metodos de Duration

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

### Cargar por Nombre

Cargar zona horaria por nombre IANA (ej., "America/New_York", "Europe/London", "Asia/Tokyo").

```lua
local ny, err = time.load_location("America/New_York")
if err then
    return nil, err
end

local tokyo, _ = time.load_location("Asia/Tokyo")
local london, _ = time.load_location("Europe/London")

-- Convertir entre zonas horarias
local t = time.now():utc()
print("UTC:", t:format(time.TIME_ONLY))
print("New York:", t:in_location(ny):format(time.TIME_ONLY))
print("Tokyo:", t:in_location(tokyo):format(time.TIME_ONLY))
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `name` | string | Nombre de zona horaria IANA |

**Devuelve:** `Location, error`

### Desplazamiento Fijo

Crear zona horaria con desplazamiento UTC fijo.

```lua
-- UTC+5:30 (India Standard Time)
local ist = time.fixed_zone("IST", 5*3600 + 30*60)

-- UTC-8 (Pacific Standard Time)
local pst = time.fixed_zone("PST", -8*3600)

local t = time.date(2024, 1, 15, 12, 0, 0, 0, ist)
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `name` | string | Nombre de zona |
| `offset` | number | Desplazamiento UTC en segundos |

**Devuelve:** `Location`

### Ubicaciones Incorporadas

```lua
time.utc      -- Zona horaria UTC
time.localtz  -- Zona horaria local del sistema
```

## Programacion

### sleep

Pausar ejecucion por duracion especificada. En flujos de trabajo, grabado y reproducido correctamente.

```lua
time.sleep("5s")
time.sleep(500 * time.MILLISECOND)

-- Patron de backoff
for attempt = 1, 3 do
    local ok = try_operation()
    if ok then break end
    time.sleep(tostring(attempt) .. "s")
end
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `duration` | number/string/Duration | Tiempo de dormir |

### after

Devuelve un canal que recibe una vez despues de la duracion. Funciona con `channel.select`.

```lua
-- Timeout simple
local timeout = time.after("5s")
timeout:receive()  -- bloquea por 5 segundos

-- Timeout con select
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

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `duration` | number/string/Duration | Tiempo a esperar |

**Devuelve:** `Channel`

### timer

Temporizador de disparo unico que se activa despues de duracion. Puede detenerse o reiniciarse.

```lua
local timer = time.timer("5s")

-- Esperar temporizador
timer:response():receive()
send_reminder()

-- Reiniciar en actividad
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

-- Detener temporizador
timer:stop()
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `duration` | number/string/Duration | Tiempo hasta disparo |

**Devuelve:** `Timer, error`

| Metodo Timer | Parametros | Devuelve | Descripcion |
|--------------|------------|----------|-------------|
| `response()` | - | Channel | Obtener canal de temporizador |
| `channel()` | - | Channel | Alias para response() |
| `stop()` | - | boolean | Cancelar temporizador |
| `reset(duration)` | number/string/Duration | boolean | Reiniciar con nueva duracion |

### ticker

Temporizador repetitivo que se activa a intervalos regulares.

```lua
-- Tarea periodica
local ticker = time.ticker("30s")
local ch = ticker:response()

while true do
    local tick_time = ch:receive()
    check_health()
end

-- Limitacion de tasa
local ticker = time.ticker("100ms")
for _, item in ipairs(items) do
    ticker:response():receive()
    process(item)
end
ticker:stop()
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `duration` | number/string/Duration | Intervalo entre ticks |

**Devuelve:** `Ticker, error`

| Metodo Ticker | Parametros | Devuelve | Descripcion |
|---------------|------------|----------|-------------|
| `response()` | - | Channel | Obtener canal de ticker |
| `channel()` | - | Channel | Alias para response() |
| `stop()` | - | boolean | Detener ticker |

## Constantes

### Unidades de Duracion

Las constantes de duracion estan en nanosegundos. Usar con aritmetica.

```lua
time.NANOSECOND    -- 1
time.MICROSECOND   -- 1,000
time.MILLISECOND   -- 1,000,000
time.SECOND        -- 1,000,000,000
time.MINUTE        -- 60 * SECOND
time.HOUR          -- 60 * MINUTE

-- Ejemplo de uso
time.sleep(5 * time.SECOND)
local timeout = time.after(30 * time.SECOND)
```

### Layouts de Formato

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

### Dias de la Semana

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

| Condicion | Tipo | Reintentable |
|-----------|------|--------------|
| Formato de duracion invalido | `errors.INVALID` | no |
| Parseo fallido | `errors.INVALID` | no |
| Nombre de ubicacion vacio | `errors.INVALID` | no |
| Ubicacion no encontrada | `errors.NOT_FOUND` | no |
| Duracion <= 0 (timer/ticker) | `errors.INVALID` | no |

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

Consulte [Manejo de Errores](lua-errors.md) para trabajar con errores.
