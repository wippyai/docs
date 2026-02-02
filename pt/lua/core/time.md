# Time e Duracao
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

Trabalhe com valores de tempo, duracoes, fusos horarios e agendamento. Crie timers, pause execução por periodos especificos, parse e formate timestamps.

Em workflows, `time.now()` retorna uma referencia de tempo gravada para replay deterministico.

## Carregamento

```lua
local time = require("time")
```

## Tempo Atual

### now

Retorna o tempo atual. Em workflows, retorna o tempo gravado da referencia de tempo do workflow para replay deterministico.

```lua
local t = time.now()
print(t:format_rfc3339())  -- "2024-12-29T15:04:05Z"

-- Medir tempo decorrido
local start = time.now()
do_work()
local elapsed = time.now():sub(start)
print("Levou " .. elapsed:milliseconds() .. "ms")
```

**Retorna:** `Time`

## Criando Valores de Tempo

### De Componentes

```lua
-- Criar data/hora especifica em UTC
local t = time.date(2024, time.DECEMBER, 25, 10, 30, 0, 0, time.utc)
print(t:format_rfc3339())  -- "2024-12-25T10:30:00Z"

-- Criar em fuso horario especifico
local ny, _ = time.load_location("America/New_York")
local meeting = time.date(2024, time.JANUARY, 15, 14, 0, 0, 0, ny)

-- Padrão e fuso horario local se não especificado
local t = time.date(2024, 1, 15, 12, 0, 0, 0)
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `year` | number | Ano |
| `month` | number | Mes (1-12 ou `time.JANUARY` etc) |
| `day` | number | Dia do mes |
| `hour` | number | Hora (0-23) |
| `minute` | number | Minuto (0-59) |
| `second` | number | Segundo (0-59) |
| `nanosecond` | number | Nanossegundo (0-999999999) |
| `location` | Location | Fuso horario (opcional, padrão e local) |

**Retorna:** `Time`

### De Unix Timestamp

```lua
-- De segundos desde epoch
local t = time.unix(1703862245, 0)
print(t:utc():format_rfc3339())  -- "2023-12-29T15:04:05Z"

-- Com nanossegundos
local t = time.unix(1703862245, 500000000)  -- +500ms

-- Converter timestamp JavaScript (milissegundos)
local js_timestamp = 1703862245000
local t = time.unix(js_timestamp // 1000, (js_timestamp % 1000) * 1000000)
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `sec` | number | Segundos Unix |
| `nsec` | number | Offset em nanossegundos |

**Retorna:** `Time`

### De String

Parse strings de tempo usando formato de tempo de referencia do Go: `Mon Jan 2 15:04:05 MST 2006`.

```lua
-- Parse RFC3339
local t, err = time.parse(time.RFC3339, "2024-12-29T15:04:05Z")
if err then
    return nil, err
end

-- Parse formato customizado
local t, err = time.parse("2006-01-02", "2024-12-29")
local t, err = time.parse("15:04:05", "14:30:00")
local t, err = time.parse("2006-01-02 15:04:05 MST", "2024-12-29 14:30:00 EST")

-- Parse em fuso horario especifico
local ny, _ = time.load_location("America/New_York")
local t, err = time.parse("2006-01-02 15:04", "2024-12-29 14:30", ny)
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `layout` | string | Layout de formato de tempo Go |
| `value` | string | String para parse |
| `location` | Location | Fuso horario padrão (opcional) |

**Retorna:** `Time, error`

## Metodos de Time

### Aritmetica

```lua
local t = time.now()

-- Adicionar duracao (aceita number, string ou Duration)
local tomorrow = t:add("24h")
local later = t:add(5 * time.MINUTE)
local d, _ = time.parse_duration("1h30m")
local future = t:add(d)

-- Subtrair tempo para obter duracao
local diff = tomorrow:sub(t)  -- retorna Duration
print(diff:hours())           -- 24

-- Adicionar unidades de calendario (trata limites de mes corretamente)
local next_month = t:add_date(0, 1, 0)   -- adicionar 1 mes
local next_year = t:add_date(1, 0, 0)    -- adicionar 1 ano
local last_week = t:add_date(0, 0, -7)   -- subtrair 7 dias
```

| Método | Parametros | Retorna | Descrição |
|--------|------------|---------|-----------|
| `add(duration)` | number/string/Duration | Time | Adicionar duracao |
| `sub(time)` | Time | Duration | Diferenca entre tempos |
| `add_date(years, months, days)` | numbers | Time | Adicionar unidades de calendario |

### Comparacao

```lua
local t1 = time.date(2024, 1, 1, 0, 0, 0, 0, time.utc)
local t2 = time.date(2024, 1, 2, 0, 0, 0, 0, time.utc)

t1:before(t2)   -- true
t2:after(t1)    -- true
t1:equal(t1)    -- true
```

| Método | Parametros | Retorna | Descrição |
|--------|------------|---------|-----------|
| `before(time)` | Time | boolean | Este tempo e anterior ao outro? |
| `after(time)` | Time | boolean | Este tempo e posterior ao outro? |
| `equal(time)` | Time | boolean | Os tempos sao iguais? |

### Formatacao

```lua
local t = time.now()

t:format_rfc3339()              -- "2024-12-29T15:04:05Z"
t:format(time.DATE_ONLY)        -- "2024-12-29"
t:format(time.TIME_ONLY)        -- "15:04:05"
t:format("Mon Jan 2, 2006")     -- "Sun Dec 29, 2024"
```

| Método | Parametros | Retorna | Descrição |
|--------|------------|---------|-----------|
| `format(layout)` | string | string | Formatar usando layout Go |
| `format_rfc3339()` | - | string | Formatar como RFC3339 |

### Unix Timestamps

```lua
local t = time.now()

t:unix()       -- segundos desde epoch
t:unix_nano()  -- nanossegundos desde epoch
```

### Componentes

```lua
local t = time.now()

-- Obter partes da data
local year, month, day = t:date()

-- Obter partes do horario
local hour, min, sec = t:clock()

-- Acessores individuais
t:year()        -- ex: 2024
t:month()       -- 1-12
t:day()         -- 1-31
t:hour()        -- 0-23
t:minute()      -- 0-59
t:second()      -- 0-59
t:nanosecond()  -- 0-999999999
t:weekday()     -- 0=Domingo .. 6=Sabado
t:year_day()    -- 1-366
t:is_zero()     -- true se valor zero
```

### Conversao de Fuso Horario

```lua
local t = time.now()

t:utc()                    -- converter para UTC
t:in_local()               -- converter para fuso horario local
t:in_location(ny)          -- converter para fuso horario especifico
t:location()               -- obter Location atual
t:location():string()      -- obter nome do fuso horario
```

| Método | Parametros | Retorna | Descrição |
|--------|------------|---------|-----------|
| `utc()` | - | Time | Converter para UTC |
| `in_local()` | - | Time | Converter para fuso horario local |
| `in_location(loc)` | Location | Time | Converter para fuso horario |
| `location()` | - | Location | Obter fuso horario atual |

### Arredondamento

Arredondar ou truncar para limites de duracao. **Requer userdata Duration** (não number ou string).

```lua
local t = time.now()
local hour_duration, _ = time.parse_duration("1h")
local minute_duration, _ = time.parse_duration("15m")

t:round(hour_duration)       -- arredondar para hora mais proxima
t:truncate(minute_duration)  -- truncar para limite de 15 minutos
```

| Método | Parametros | Retorna | Descrição |
|--------|------------|---------|-----------|
| `round(duration)` | Duration | Time | Arredondar para multiplo mais proximo |
| `truncate(duration)` | Duration | Time | Truncar para multiplo |

## Duration

### Criando Duracoes

```lua
-- Parse de string
local d, err = time.parse_duration("1h30m45s")
local d, err = time.parse_duration("500ms")
local d, err = time.parse_duration("2h30m45s500ms")

-- De number (nanossegundos)
local d, err = time.parse_duration(time.SECOND)
local d, err = time.parse_duration(5 * time.MINUTE)

-- Unidades validas: ns, us, ms, s, m, h
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `value` | number/string/Duration | Duracao para parse |

**Retorna:** `Duration, error`

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

## Fusos Horarios

### Carregar por Nome

Carregar fuso horario por nome IANA (ex: "America/New_York", "Europe/London", "Asia/Tokyo").

```lua
local ny, err = time.load_location("America/New_York")
if err then
    return nil, err
end

local tokyo, _ = time.load_location("Asia/Tokyo")
local london, _ = time.load_location("Europe/London")

-- Converter entre fusos horarios
local t = time.now():utc()
print("UTC:", t:format(time.TIME_ONLY))
print("New York:", t:in_location(ny):format(time.TIME_ONLY))
print("Tokyo:", t:in_location(tokyo):format(time.TIME_ONLY))
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `name` | string | Nome do fuso horario IANA |

**Retorna:** `Location, error`

### Offset Fixo

Criar fuso horario com offset UTC fixo.

```lua
-- UTC+5:30 (India Standard Time)
local ist = time.fixed_zone("IST", 5*3600 + 30*60)

-- UTC-8 (Pacific Standard Time)
local pst = time.fixed_zone("PST", -8*3600)

local t = time.date(2024, 1, 15, 12, 0, 0, 0, ist)
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `name` | string | Nome da zona |
| `offset` | number | Offset UTC em segundos |

**Retorna:** `Location`

### Locations Embutidas

```lua
time.utc      -- Fuso horario UTC
time.localtz  -- Fuso horario local do sistema
```

## Agendamento

### sleep

Pausar execução pela duracao especificada. Em workflows, gravado e reproduzido corretamente.

```lua
time.sleep("5s")
time.sleep(500 * time.MILLISECOND)

-- Padrão de backoff
for attempt = 1, 3 do
    local ok = try_operation()
    if ok then break end
    time.sleep(tostring(attempt) .. "s")
end
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `duration` | number/string/Duration | Tempo de sleep |

### after

Retorna um channel que recebe uma vez apos a duracao. Funciona com `channel.select`.

```lua
-- Timeout simples
local timeout = time.after("5s")
timeout:receive()  -- bloqueia por 5 segundos

-- Timeout com select
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

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `duration` | number/string/Duration | Tempo de espera |

**Retorna:** `Channel`

### timer

Timer de disparo único que dispara apos duracao. Pode ser parado ou resetado.

```lua
local timer = time.timer("5s")

-- Aguardar timer
timer:response():receive()
send_reminder()

-- Resetar em atividade
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

-- Parar timer
timer:stop()
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `duration` | number/string/Duration | Tempo ate disparar |

**Retorna:** `Timer, error`

| Método Timer | Parametros | Retorna | Descrição |
|--------------|------------|---------|-----------|
| `response()` | - | Channel | Obter channel do timer |
| `channel()` | - | Channel | Alias para response() |
| `stop()` | - | boolean | Cancelar timer |
| `reset(duration)` | number/string/Duration | boolean | Resetar com nova duracao |

### ticker

Timer repetitivo que dispara em intervalos regulares.

```lua
-- Tarefa periodica
local ticker = time.ticker("30s")
local ch = ticker:response()

while true do
    local tick_time = ch:receive()
    check_health()
end

-- Rate limiting
local ticker = time.ticker("100ms")
for _, item in ipairs(items) do
    ticker:response():receive()
    process(item)
end
ticker:stop()
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `duration` | number/string/Duration | Intervalo entre ticks |

**Retorna:** `Ticker, error`

| Método Ticker | Parametros | Retorna | Descrição |
|---------------|------------|---------|-----------|
| `response()` | - | Channel | Obter channel do ticker |
| `channel()` | - | Channel | Alias para response() |
| `stop()` | - | boolean | Parar ticker |

## Constantes

### Unidades de Duracao

Constantes de duracao estao em nanossegundos. Use com aritmetica.

```lua
time.NANOSECOND    -- 1
time.MICROSECOND   -- 1,000
time.MILLISECOND   -- 1,000,000
time.SECOND        -- 1,000,000,000
time.MINUTE        -- 60 * SECOND
time.HOUR          -- 60 * MINUTE

-- Exemplo de uso
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

### Dias da Semana

```lua
time.SUNDAY     -- 0
time.MONDAY     -- 1
time.TUESDAY    -- 2
time.WEDNESDAY  -- 3
time.THURSDAY   -- 4
time.FRIDAY     -- 5
time.SATURDAY   -- 6
```

## Erros

| Condição | Tipo | Retentavel |
|----------|------|------------|
| Formato de duracao invalido | `errors.INVALID` | não |
| Parse falhou | `errors.INVALID` | não |
| Nome de location vazio | `errors.INVALID` | não |
| Location não encontrada | `errors.NOT_FOUND` | não |
| Duracao <= 0 (timer/ticker) | `errors.INVALID` | não |

```lua
local t, err = time.parse(time.RFC3339, "invalid")
if err then
    if errors.is(err, errors.INVALID) then
        print("Formato invalido:", err:message())
    end
    return nil, err
end

local loc, err = time.load_location("Unknown/Zone")
if err then
    if errors.is(err, errors.NOT_FOUND) then
        print("Location não encontrada:", err:message())
    end
    return nil, err
end
```

Veja [Error Handling](lua-errors.md) para trabalhar com erros.
