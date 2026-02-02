# Time & Duration
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

Work with time values, durations, timezones, and scheduling. Create timers, sleep for specified periods, parse and format timestamps.

In workflows, `time.now()` returns a recorded time reference for deterministic replay.

## Loading

```lua
local time = require("time")
```

## Current Time

### now

Returns the current time. In workflows, returns the recorded time from the workflow's time reference for deterministic replay.

```lua
local t = time.now()
print(t:format_rfc3339())  -- "2024-12-29T15:04:05Z"

-- Measure elapsed time
local start = time.now()
do_work()
local elapsed = time.now():sub(start)
print("Took " .. elapsed:milliseconds() .. "ms")
```

**Returns:** `Time`

## Creating Time Values

### From Components

```lua
-- Create specific date/time in UTC
local t = time.date(2024, time.DECEMBER, 25, 10, 30, 0, 0, time.utc)
print(t:format_rfc3339())  -- "2024-12-25T10:30:00Z"

-- Create in specific timezone
local ny, _ = time.load_location("America/New_York")
local meeting = time.date(2024, time.JANUARY, 15, 14, 0, 0, 0, ny)

-- Defaults to local timezone if not specified
local t = time.date(2024, 1, 15, 12, 0, 0, 0)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `year` | number | Year |
| `month` | number | Month (1-12 or `time.JANUARY` etc) |
| `day` | number | Day of month |
| `hour` | number | Hour (0-23) |
| `minute` | number | Minute (0-59) |
| `second` | number | Second (0-59) |
| `nanosecond` | number | Nanosecond (0-999999999) |
| `location` | Location | Timezone (optional, defaults to local) |

**Returns:** `Time`

### From Unix Timestamp

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

| Parameter | Type | Description |
|-----------|------|-------------|
| `sec` | number | Unix seconds |
| `nsec` | number | Nanoseconds offset |

**Returns:** `Time`

### From String

Parse time strings using Go's reference time format: `Mon Jan 2 15:04:05 MST 2006`.

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

| Parameter | Type | Description |
|-----------|------|-------------|
| `layout` | string | Go time format layout |
| `value` | string | String to parse |
| `location` | Location | Default timezone (optional) |

**Returns:** `Time, error`

## Time Methods

### Arithmetic

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

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `add(duration)` | number/string/Duration | Time | Add duration |
| `sub(time)` | Time | Duration | Difference between times |
| `add_date(years, months, days)` | numbers | Time | Add calendar units |

### Comparison

```lua
local t1 = time.date(2024, 1, 1, 0, 0, 0, 0, time.utc)
local t2 = time.date(2024, 1, 2, 0, 0, 0, 0, time.utc)

t1:before(t2)   -- true
t2:after(t1)    -- true
t1:equal(t1)    -- true
```

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `before(time)` | Time | boolean | Is this time before other? |
| `after(time)` | Time | boolean | Is this time after other? |
| `equal(time)` | Time | boolean | Are times equal? |

### Formatting

```lua
local t = time.now()

t:format_rfc3339()              -- "2024-12-29T15:04:05Z"
t:format(time.DATE_ONLY)        -- "2024-12-29"
t:format(time.TIME_ONLY)        -- "15:04:05"
t:format("Mon Jan 2, 2006")     -- "Sun Dec 29, 2024"
```

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `format(layout)` | string | string | Format using Go layout |
| `format_rfc3339()` | - | string | Format as RFC3339 |

### Unix Timestamps

```lua
local t = time.now()

t:unix()       -- seconds since epoch
t:unix_nano()  -- nanoseconds since epoch
```

### Components

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

### Timezone Conversion

```lua
local t = time.now()

t:utc()                    -- convert to UTC
t:in_local()               -- convert to local timezone
t:in_location(ny)          -- convert to specific timezone
t:location()               -- get current Location
t:location():string()      -- get timezone name
```

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `utc()` | - | Time | Convert to UTC |
| `in_local()` | - | Time | Convert to local timezone |
| `in_location(loc)` | Location | Time | Convert to timezone |
| `location()` | - | Location | Get current timezone |

### Rounding

Round or truncate to duration boundaries. **Requires Duration userdata** (not number or string).

```lua
local t = time.now()
local hour_duration, _ = time.parse_duration("1h")
local minute_duration, _ = time.parse_duration("15m")

t:round(hour_duration)       -- round to nearest hour
t:truncate(minute_duration)  -- truncate to 15-minute boundary
```

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `round(duration)` | Duration | Time | Round to nearest multiple |
| `truncate(duration)` | Duration | Time | Truncate to multiple |

## Duration

### Creating Durations

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

| Parameter | Type | Description |
|-----------|------|-------------|
| `value` | number/string/Duration | Duration to parse |

**Returns:** `Duration, error`

### Duration Methods

```lua
local d, _ = time.parse_duration("1h30m45s500ms")

d:hours()         -- 1.5125...
d:minutes()       -- 90.75...
d:seconds()       -- 5445.5
d:milliseconds()  -- 5445500
d:microseconds()  -- 5445500000
d:nanoseconds()   -- 5445500000000
```

## Timezones

### Load by Name

Load timezone by IANA name (e.g., "America/New_York", "Europe/London", "Asia/Tokyo").

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

| Parameter | Type | Description |
|-----------|------|-------------|
| `name` | string | IANA timezone name |

**Returns:** `Location, error`

### Fixed Offset

Create timezone with fixed UTC offset.

```lua
-- UTC+5:30 (India Standard Time)
local ist = time.fixed_zone("IST", 5*3600 + 30*60)

-- UTC-8 (Pacific Standard Time)
local pst = time.fixed_zone("PST", -8*3600)

local t = time.date(2024, 1, 15, 12, 0, 0, 0, ist)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `name` | string | Zone name |
| `offset` | number | UTC offset in seconds |

**Returns:** `Location`

### Built-in Locations

```lua
time.utc      -- UTC timezone
time.localtz  -- Local system timezone
```

## Scheduling

### sleep

Pause execution for specified duration. In workflows, recorded and replayed correctly.

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

| Parameter | Type | Description |
|-----------|------|-------------|
| `duration` | number/string/Duration | Sleep time |

### after

Returns a channel that receives once after the duration. Works with `channel.select`.

```lua
-- Simple timeout
local timeout = time.after("5s")
timeout:receive()  -- blocks for 5 seconds

-- Timeout with select
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

| Parameter | Type | Description |
|-----------|------|-------------|
| `duration` | number/string/Duration | Time to wait |

**Returns:** `Channel`

### timer

One-shot timer that fires after duration. Can be stopped or reset.

```lua
local timer = time.timer("5s")

-- Wait for timer
timer:response():receive()
send_reminder()

-- Reset on activity
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

-- Stop timer
timer:stop()
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `duration` | number/string/Duration | Time until fire |

**Returns:** `Timer, error`

| Timer Method | Parameters | Returns | Description |
|--------------|------------|---------|-------------|
| `response()` | - | Channel | Get timer channel |
| `channel()` | - | Channel | Alias for response() |
| `stop()` | - | boolean | Cancel timer |
| `reset(duration)` | number/string/Duration | boolean | Reset with new duration |

### ticker

Repeating timer that fires at regular intervals.

```lua
-- Periodic task
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

| Parameter | Type | Description |
|-----------|------|-------------|
| `duration` | number/string/Duration | Interval between ticks |

**Returns:** `Ticker, error`

| Ticker Method | Parameters | Returns | Description |
|---------------|------------|---------|-------------|
| `response()` | - | Channel | Get ticker channel |
| `channel()` | - | Channel | Alias for response() |
| `stop()` | - | boolean | Stop ticker |

## Constants

### Duration Units

Duration constants are in nanoseconds. Use with arithmetic.

```lua
time.NANOSECOND    -- 1
time.MICROSECOND   -- 1,000
time.MILLISECOND   -- 1,000,000
time.SECOND        -- 1,000,000,000
time.MINUTE        -- 60 * SECOND
time.HOUR          -- 60 * MINUTE

-- Example usage
time.sleep(5 * time.SECOND)
local timeout = time.after(30 * time.SECOND)
```

### Format Layouts

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

### Months

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

### Weekdays

```lua
time.SUNDAY     -- 0
time.MONDAY     -- 1
time.TUESDAY    -- 2
time.WEDNESDAY  -- 3
time.THURSDAY   -- 4
time.FRIDAY     -- 5
time.SATURDAY   -- 6
```

## Errors

| Condition | Kind | Retryable |
|-----------|------|-----------|
| Invalid duration format | `errors.INVALID` | no |
| Parse failed | `errors.INVALID` | no |
| Empty location name | `errors.INVALID` | no |
| Location not found | `errors.NOT_FOUND` | no |
| Duration <= 0 (timer/ticker) | `errors.INVALID` | no |

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

See [Error Handling](lua/core/errors.md) for working with errors.
