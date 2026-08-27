---
title: "Zeit & Dauer"
description: "Zeitwerte erstellen, vergleichen, parsen und formatieren; Dauern und Zeitzonen verwenden sowie Sleeps und Timer planen."
---

# Zeit & Dauer
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

Das Modul `time` stellt Zeitwerte, Dauern, Zeitzonenbehandlung, Parsing, Formatierung, Sleeps und Timer bereit. Unterstützte Workflow-Zeitaufrufe werden aufgezeichnet, damit sie deterministisch wiedergegeben werden können.

Diese Seite ist eine API-Referenz. Codeblöcke sind isolierte Beispiele oder partielle Scheduling-Muster und kein vollständiger Eintrag. Namen wie `do_work`, `try_operation`, `make_request`, `send_reminder`, `user_activity`, `check_health` und `process` stehen für Callbacks, Channels oder Daten der Anwendung. Wenn ein Snippet einen Fehlerrückgabewert `_` zuweist, setzt es voraus, dass das gezeigte Literal gültig ist; behandeln Sie Fehler, wenn Werte aus Eingaben oder Konfiguration stammen können.

## Laden

```lua
local time = require("time")
```

Fügen Sie `time` zur `modules:`-Liste des ausführbaren Eintrags hinzu, bevor Sie das Modul laden. Die in den Scheduling-Beispielen verwendeten ambienten globalen Werte `channel` und `errors` benötigen keine Moduldeklaration.

## Aktuelle Zeit

### `now`

Gibt die aktuelle Zeit zurück. In Workflows liefert die Funktion die aufgezeichnete Workflow-Zeitreferenz, damit die Ausführung deterministisch wiedergegeben werden kann.

```lua
local t = time.now()
print(t:format_rfc3339())  -- "2024-12-29T15:04:05Z"

-- Measure elapsed time
local start = time.now()
do_work()
local elapsed = time.now():sub(start)
print("Took " .. elapsed:milliseconds() .. "ms")
```

Zeitstempel und Ausgabe der verstrichenen Zeit sind illustrativ; `time.now()` liefert die aktuelle oder aufgezeichnete Workflow-Zeit.

**Rückgabewert:** `Time`

## Zeitwerte erstellen

### Aus Komponenten

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

**Gibt zurück:** `Time`

### Aus Unix-Zeitstempel

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

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `sec` | number | Unix-Sekunden |
| `nsec` | number | Nanosekunden-Offset |

**Gibt zurück:** `Time`

### Aus String

Zeitstrings mit Gos Referenzzeitformat parsen: `Mon Jan 2 15:04:05 MST 2006`.

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

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `layout` | string | Go-Zeitformat-Layout |
| `value` | string | Zu parsender String |
| `location` | Location | Standard-Zeitzone (optional) |

**Gibt zurück:** `Time, error`

## Zeit-Methoden

### Arithmetik

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

| Methode | Parameter | Gibt zurück | Beschreibung |
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

| Methode | Parameter | Gibt zurück | Beschreibung |
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

| Methode | Parameter | Gibt zurück | Beschreibung |
|--------|------------|---------|-------------|
| `format(layout)` | string | string | Mit Go-Layout formatieren |
| `format_rfc3339()` | - | string | Als RFC3339 formatieren |

### Unix-Zeitstempel

```lua
local t = time.now()

t:unix()       -- seconds since epoch
t:unix_nano()  -- nanoseconds since epoch
```

### Komponenten

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

### Zeitzonen-Konvertierung

```lua
local t = time.now()

t:utc()                    -- convert to UTC
t:in_local()               -- convert to local timezone
t:in_location(ny)          -- convert to specific timezone
t:location()               -- get current Location
t:location():string()      -- get timezone name
```

| Methode | Parameter | Gibt zurück | Beschreibung |
|--------|------------|---------|-------------|
| `utc()` | - | Time | Zu UTC konvertieren |
| `in_local()` | - | Time | Zur lokalen Zeitzone konvertieren |
| `in_location(loc)` | Location | Time | Zur Zeitzone konvertieren |
| `location()` | - | Location | Aktuelle Zeitzone holen |

### Runden

Auf Dauergrenzen runden oder abschneiden. **Benötigt Duration userdata** (nicht Zahl oder String).

```lua
local t = time.now()
local hour_duration, _ = time.parse_duration("1h")
local minute_duration, _ = time.parse_duration("15m")

t:round(hour_duration)       -- round to nearest hour
t:truncate(minute_duration)  -- truncate to 15-minute boundary
```

| Methode | Parameter | Gibt zurück | Beschreibung |
|--------|------------|---------|-------------|
| `round(duration)` | Duration | Time | Auf nächstes Vielfaches runden |
| `truncate(duration)` | Duration | Time | Auf Vielfaches abschneiden |

## Dauer

### Dauern erstellen

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

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `value` | number/string/Duration | Zu parsende Dauer |

**Gibt zurück:** `Duration, error`

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

-- Convert between timezones
local t = time.now():utc()
print("UTC:", t:format(time.TIME_ONLY))
print("New York:", t:in_location(ny):format(time.TIME_ONLY))
print("Tokyo:", t:in_location(tokyo):format(time.TIME_ONLY))
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `name` | string | IANA-Zeitzonenname |

**Gibt zurück:** `Location, error`

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

**Gibt zurück:** `Location`

### Eingebaute Locations

```lua
time.utc      -- UTC timezone
time.localtz  -- Local system timezone
```

## Scheduling

### `sleep`

Pausiert die Ausführung für die angegebene Dauer. Bei Workflows wird der Sleep für deterministisches Replay aufgezeichnet.

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

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `duration` | number/string/Duration | Schlafzeit |

### `after`

Gibt einen Channel zurück, der einmal nach der Dauer empfängt. Funktioniert mit `channel.select`.

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

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `duration` | number/string/Duration | Wartezeit |

**Rückgabewerte:** `Channel, error`

### `timer`

Einmaliger Timer, der nach der Dauer auslöst. Kann gestoppt oder zurückgesetzt werden.

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

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `duration` | number/string/Duration | Zeit bis zum Auslösen |

**Gibt zurück:** `Timer, error`

| Timer-Methode | Parameter | Gibt zurück | Beschreibung |
|--------------|------------|---------|-------------|
| `response()` | - | Channel | Timer-Channel holen |
| `channel()` | - | Channel | Alias für response() |
| `stop()` | - | boolean | Timer abbrechen |
| `reset(duration)` | number/string/Duration | boolean | Mit neuer Dauer zurücksetzen |

### `ticker`

Wiederholender Timer, der in regelmäßigen Intervallen auslöst.

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

Die obige Schleife ist für einen lang laufenden Prozess gedacht. Ein separates, endliches Muster zur Ratenbegrenzung lautet:

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

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `duration` | number/string/Duration | Intervall zwischen Ticks |

**Gibt zurück:** `Ticker, error`

| Ticker-Methode | Parameter | Gibt zurück | Beschreibung |
|---------------|------------|---------|-------------|
| `response()` | - | Channel | Ticker-Channel holen |
| `channel()` | - | Channel | Alias für response() |
| `stop()` | - | boolean | Ticker stoppen |

## Konstanten

### Dauer-Einheiten

Dauer-Konstanten sind in Nanosekunden. Mit Arithmetik verwenden.

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
| Ungültiges Dauerformat | `errors.INVALID` | nein |
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

Siehe [Fehlerbehandlung](errors.md) für die Arbeit mit Fehlern.
