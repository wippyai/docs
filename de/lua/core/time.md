# Zeit & Dauer
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

Arbeiten Sie mit Zeitwerten, Dauern, Zeitzonen und Scheduling. Erstellen Sie Timer, pausieren Sie fur bestimmte Zeitraume, parsen und formatieren Sie Zeitstempel.

In Workflows gibt `time.now()` eine aufgezeichnete Zeitreferenz fur deterministisches Replay zuruck.

## Laden

```lua
local time = require("time")
```

## Aktuelle Zeit

### now

Gibt die aktuelle Zeit zuruck. In Workflows wird die aufgezeichnete Zeit aus der Zeitreferenz des Workflows fur deterministisches Replay zuruckgegeben.

```lua
local t = time.now()
print(t:format_rfc3339())  -- "2024-12-29T15:04:05Z"

-- Verstrichene Zeit messen
local start = time.now()
do_work()
local elapsed = time.now():sub(start)
print("Took " .. elapsed:milliseconds() .. "ms")
```

**Gibt zuruck:** `Time`

## Zeitwerte erstellen

### Aus Komponenten

```lua
-- Bestimmtes Datum/Zeit in UTC erstellen
local t = time.date(2024, time.DECEMBER, 25, 10, 30, 0, 0, time.utc)
print(t:format_rfc3339())  -- "2024-12-25T10:30:00Z"

-- In bestimmter Zeitzone erstellen
local ny, _ = time.load_location("America/New_York")
local meeting = time.date(2024, time.JANUARY, 15, 14, 0, 0, 0, ny)

-- Standardmassig lokale Zeitzone wenn nicht angegeben
local t = time.date(2024, 1, 15, 12, 0, 0, 0)
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `year` | number | Jahr |
| `month` | number | Monat (1-12 oder `time.JANUARY` etc.) |
| `day` | number | Tag des Monats |
| `hour` | number | Stunde (0-23) |
| `minute` | number | Minute (0-59) |
| `second` | number | Sekunde (0-59) |
| `nanosecond` | number | Nanosekunde (0-999999999) |
| `location` | Location | Zeitzone (optional, Standard ist lokal) |

**Gibt zuruck:** `Time`

### Aus Unix-Zeitstempel

```lua
-- Aus Sekunden seit Epoch
local t = time.unix(1703862245, 0)
print(t:utc():format_rfc3339())  -- "2023-12-29T15:04:05Z"

-- Mit Nanosekunden
local t = time.unix(1703862245, 500000000)  -- +500ms

-- JavaScript-Zeitstempel konvertieren (Millisekunden)
local js_timestamp = 1703862245000
local t = time.unix(js_timestamp // 1000, (js_timestamp % 1000) * 1000000)
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `sec` | number | Unix-Sekunden |
| `nsec` | number | Nanosekunden-Offset |

**Gibt zuruck:** `Time`

### Aus String

Zeitstrings mit Gos Referenzzeitformat parsen: `Mon Jan 2 15:04:05 MST 2006`.

```lua
-- RFC3339 parsen
local t, err = time.parse(time.RFC3339, "2024-12-29T15:04:05Z")
if err then
    return nil, err
end

-- Benutzerdefiniertes Format parsen
local t, err = time.parse("2006-01-02", "2024-12-29")
local t, err = time.parse("15:04:05", "14:30:00")
local t, err = time.parse("2006-01-02 15:04:05 MST", "2024-12-29 14:30:00 EST")

-- In bestimmter Zeitzone parsen
local ny, _ = time.load_location("America/New_York")
local t, err = time.parse("2006-01-02 15:04", "2024-12-29 14:30", ny)
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `layout` | string | Go-Zeitformat-Layout |
| `value` | string | Zu parsender String |
| `location` | Location | Standard-Zeitzone (optional) |

**Gibt zuruck:** `Time, error`

## Zeit-Methoden

### Arithmetik

```lua
local t = time.now()

-- Dauer addieren (akzeptiert Zahl, String oder Duration)
local tomorrow = t:add("24h")
local later = t:add(5 * time.MINUTE)
local d, _ = time.parse_duration("1h30m")
local future = t:add(d)

-- Zeit subtrahieren um Dauer zu erhalten
local diff = tomorrow:sub(t)  -- gibt Duration zuruck
print(diff:hours())           -- 24

-- Kalendereinheiten addieren (behandelt Monatsgrenzen korrekt)
local next_month = t:add_date(0, 1, 0)   -- 1 Monat addieren
local next_year = t:add_date(1, 0, 0)    -- 1 Jahr addieren
local last_week = t:add_date(0, 0, -7)   -- 7 Tage subtrahieren
```

| Methode | Parameter | Gibt zuruck | Beschreibung |
|--------|------------|---------|-------------|
| `add(duration)` | number/string/Duration | Time | Dauer addieren |
| `sub(time)` | Time | Duration | Differenz zwischen Zeiten |
| `add_date(years, months, days)` | numbers | Time | Kalendereinheiten addieren |

### Vergleich

```lua
local t1 = time.date(2024, 1, 1, 0, 0, 0, 0, time.utc)
local t2 = time.date(2024, 1, 2, 0, 0, 0, 0, time.utc)

t1:before(t2)   -- true
t2:after(t1)    -- true
t1:equal(t1)    -- true
```

| Methode | Parameter | Gibt zuruck | Beschreibung |
|--------|------------|---------|-------------|
| `before(time)` | Time | boolean | Ist diese Zeit vor der anderen? |
| `after(time)` | Time | boolean | Ist diese Zeit nach der anderen? |
| `equal(time)` | Time | boolean | Sind die Zeiten gleich? |

### Formatierung

```lua
local t = time.now()

t:format_rfc3339()              -- "2024-12-29T15:04:05Z"
t:format(time.DATE_ONLY)        -- "2024-12-29"
t:format(time.TIME_ONLY)        -- "15:04:05"
t:format("Mon Jan 2, 2006")     -- "Sun Dec 29, 2024"
```

| Methode | Parameter | Gibt zuruck | Beschreibung |
|--------|------------|---------|-------------|
| `format(layout)` | string | string | Mit Go-Layout formatieren |
| `format_rfc3339()` | - | string | Als RFC3339 formatieren |

### Unix-Zeitstempel

```lua
local t = time.now()

t:unix()       -- Sekunden seit Epoch
t:unix_nano()  -- Nanosekunden seit Epoch
```

### Komponenten

```lua
local t = time.now()

-- Datumsteile holen
local year, month, day = t:date()

-- Zeitteile holen
local hour, min, sec = t:clock()

-- Einzelne Zugriffsmethoden
t:year()        -- z.B. 2024
t:month()       -- 1-12
t:day()         -- 1-31
t:hour()        -- 0-23
t:minute()      -- 0-59
t:second()      -- 0-59
t:nanosecond()  -- 0-999999999
t:weekday()     -- 0=Sonntag .. 6=Samstag
t:year_day()    -- 1-366
t:is_zero()     -- true wenn Nullwert
```

### Zeitzonen-Konvertierung

```lua
local t = time.now()

t:utc()                    -- zu UTC konvertieren
t:in_local()               -- zur lokalen Zeitzone konvertieren
t:in_location(ny)          -- zu bestimmter Zeitzone konvertieren
t:location()               -- aktuelle Location holen
t:location():string()      -- Zeitzonennamen holen
```

| Methode | Parameter | Gibt zuruck | Beschreibung |
|--------|------------|---------|-------------|
| `utc()` | - | Time | Zu UTC konvertieren |
| `in_local()` | - | Time | Zur lokalen Zeitzone konvertieren |
| `in_location(loc)` | Location | Time | Zur Zeitzone konvertieren |
| `location()` | - | Location | Aktuelle Zeitzone holen |

### Runden

Auf Dauergrenzen runden oder abschneiden. **Benotigt Duration userdata** (nicht Zahl oder String).

```lua
local t = time.now()
local hour_duration, _ = time.parse_duration("1h")
local minute_duration, _ = time.parse_duration("15m")

t:round(hour_duration)       -- auf nachste Stunde runden
t:truncate(minute_duration)  -- auf 15-Minuten-Grenze abschneiden
```

| Methode | Parameter | Gibt zuruck | Beschreibung |
|--------|------------|---------|-------------|
| `round(duration)` | Duration | Time | Auf nachstes Vielfaches runden |
| `truncate(duration)` | Duration | Time | Auf Vielfaches abschneiden |

## Dauer

### Dauern erstellen

```lua
-- Aus String parsen
local d, err = time.parse_duration("1h30m45s")
local d, err = time.parse_duration("500ms")
local d, err = time.parse_duration("2h30m45s500ms")

-- Aus Zahl (Nanosekunden)
local d, err = time.parse_duration(time.SECOND)
local d, err = time.parse_duration(5 * time.MINUTE)

-- Gultige Einheiten: ns, us, ms, s, m, h
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `value` | number/string/Duration | Zu parsende Dauer |

**Gibt zuruck:** `Duration, error`

### Dauer-Methoden

```lua
local d, _ = time.parse_duration("1h30m45s500ms")

d:hours()         -- 1.5125...
d:minutes()       -- 90.75...
d:seconds()       -- 5445.5
d:milliseconds()  -- 5445500
d:microseconds()  -- 5445500000
d:nanoseconds()   -- 5445500000000
```

## Zeitzonen

### Nach Name laden

Zeitzone nach IANA-Name laden (z.B. "America/New_York", "Europe/London", "Asia/Tokyo").

```lua
local ny, err = time.load_location("America/New_York")
if err then
    return nil, err
end

local tokyo, _ = time.load_location("Asia/Tokyo")
local london, _ = time.load_location("Europe/London")

-- Zwischen Zeitzonen konvertieren
local t = time.now():utc()
print("UTC:", t:format(time.TIME_ONLY))
print("New York:", t:in_location(ny):format(time.TIME_ONLY))
print("Tokyo:", t:in_location(tokyo):format(time.TIME_ONLY))
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `name` | string | IANA-Zeitzonenname |

**Gibt zuruck:** `Location, error`

### Fester Offset

Zeitzone mit festem UTC-Offset erstellen.

```lua
-- UTC+5:30 (India Standard Time)
local ist = time.fixed_zone("IST", 5*3600 + 30*60)

-- UTC-8 (Pacific Standard Time)
local pst = time.fixed_zone("PST", -8*3600)

local t = time.date(2024, 1, 15, 12, 0, 0, 0, ist)
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `name` | string | Zonenname |
| `offset` | number | UTC-Offset in Sekunden |

**Gibt zuruck:** `Location`

### Eingebaute Locations

```lua
time.utc      -- UTC-Zeitzone
time.localtz  -- Lokale System-Zeitzone
```

## Scheduling

### sleep

Ausfuhrung fur angegebene Dauer pausieren. In Workflows korrekt aufgezeichnet und wiedergegeben.

```lua
time.sleep("5s")
time.sleep(500 * time.MILLISECOND)

-- Backoff-Muster
for attempt = 1, 3 do
    local ok = try_operation()
    if ok then break end
    time.sleep(tostring(attempt) .. "s")
end
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `duration` | number/string/Duration | Schlafzeit |

### after

Gibt einen Channel zuruck, der einmal nach der Dauer empfangt. Funktioniert mit `channel.select`.

```lua
-- Einfaches Timeout
local timeout = time.after("5s")
timeout:receive()  -- blockiert fur 5 Sekunden

-- Timeout mit select
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

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `duration` | number/string/Duration | Wartezeit |

**Gibt zuruck:** `Channel`

### timer

Einmaliger Timer, der nach der Dauer auslost. Kann gestoppt oder zuruckgesetzt werden.

```lua
local timer = time.timer("5s")

-- Auf Timer warten
timer:response():receive()
send_reminder()

-- Bei Aktivitat zurucksetzen
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

-- Timer stoppen
timer:stop()
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `duration` | number/string/Duration | Zeit bis zum Auslosen |

**Gibt zuruck:** `Timer, error`

| Timer-Methode | Parameter | Gibt zuruck | Beschreibung |
|--------------|------------|---------|-------------|
| `response()` | - | Channel | Timer-Channel holen |
| `channel()` | - | Channel | Alias fur response() |
| `stop()` | - | boolean | Timer abbrechen |
| `reset(duration)` | number/string/Duration | boolean | Mit neuer Dauer zurucksetzen |

### ticker

Wiederholender Timer, der in regelmassigen Intervallen auslost.

```lua
-- Periodische Aufgabe
local ticker = time.ticker("30s")
local ch = ticker:response()

while true do
    local tick_time = ch:receive()
    check_health()
end

-- Rate-Limiting
local ticker = time.ticker("100ms")
for _, item in ipairs(items) do
    ticker:response():receive()
    process(item)
end
ticker:stop()
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `duration` | number/string/Duration | Intervall zwischen Ticks |

**Gibt zuruck:** `Ticker, error`

| Ticker-Methode | Parameter | Gibt zuruck | Beschreibung |
|---------------|------------|---------|-------------|
| `response()` | - | Channel | Ticker-Channel holen |
| `channel()` | - | Channel | Alias fur response() |
| `stop()` | - | boolean | Ticker stoppen |

## Konstanten

### Dauer-Einheiten

Dauer-Konstanten sind in Nanosekunden. Mit Arithmetik verwenden.

```lua
time.NANOSECOND    -- 1
time.MICROSECOND   -- 1.000
time.MILLISECOND   -- 1.000.000
time.SECOND        -- 1.000.000.000
time.MINUTE        -- 60 * SECOND
time.HOUR          -- 60 * MINUTE

-- Beispielverwendung
time.sleep(5 * time.SECOND)
local timeout = time.after(30 * time.SECOND)
```

### Format-Layouts

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

### Monate

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

### Wochentage

```lua
time.SUNDAY     -- 0
time.MONDAY     -- 1
time.TUESDAY    -- 2
time.WEDNESDAY  -- 3
time.THURSDAY   -- 4
time.FRIDAY     -- 5
time.SATURDAY   -- 6
```

## Fehler

| Bedingung | Art | Wiederholbar |
|-----------|------|-----------|
| Ungultiges Dauerformat | `errors.INVALID` | nein |
| Parsen fehlgeschlagen | `errors.INVALID` | nein |
| Leerer Location-Name | `errors.INVALID` | nein |
| Location nicht gefunden | `errors.NOT_FOUND` | nein |
| Dauer <= 0 (timer/ticker) | `errors.INVALID` | nein |

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

Siehe [Fehlerbehandlung](lua-errors.md) fur die Arbeit mit Fehlern.
