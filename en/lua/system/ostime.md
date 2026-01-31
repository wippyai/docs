# OS Time
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

Standard Lua `os` time functions. Provides real wall-clock time for timestamps, date formatting, and time calculations.

## Loading

Global `os` table. No require needed.

```lua
os.time()
os.date()
os.clock()
os.difftime()
```

## Getting Timestamps

Get Unix timestamp (seconds since Jan 1, 1970 UTC):

```lua
-- Current timestamp
local now = os.time()  -- 1718462445

-- Specific date/time
local t = os.time({
    year = 2024,
    month = 12,
    day = 25,
    hour = 10,
    min = 30,
    sec = 0
})
```

**Signature:** `os.time([spec]) -> integer`

**Parameters:**

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `year` | integer | current year | Four-digit year (e.g., 2024) |
| `month` | integer | current month | Month 1-12 |
| `day` | integer | current day | Day of month 1-31 |
| `hour` | integer | 0 | Hour 0-23 |
| `min` | integer | 0 | Minute 0-59 |
| `sec` | integer | 0 | Second 0-59 |

When called with no arguments, returns current Unix timestamp.

When called with a table, any missing field uses defaults shown above. The `year`, `month`, and `day` fields default to current date if not specified.

```lua
-- Just date (time defaults to midnight)
os.time({year = 2024, month = 6, day = 15})

-- Partial (fills in current year/month)
os.time({day = 1})  -- first of current month
```

## Formatting Dates

Format a timestamp as string or return a date table:

<code-block lang="lua">
local now = os.time()

-- Default format
os.date()  -- "Sat Jun 15 14:30:45 2024"

-- Custom format
os.date("%Y-%m-%d", now)           -- "2024-06-15"
os.date("%H:%M:%S", now)           -- "14:30:45"
os.date("%Y-%m-%dT%H:%M:%S", now)  -- "2024-06-15T14:30:45"

-- UTC time (prefix format with !)
os.date("!%Y-%m-%d %H:%M:%S", now)  -- UTC instead of local

-- Date table
local t = os.date("*t", now)
</code-block>

**Signature:** `os.date([format], [timestamp]) -> string | table`

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `format` | string | `"%c"` | Format string, `"*t"` for table |
| `timestamp` | integer | current time | Unix timestamp to format |

### Format Specifiers

| Code | Output | Example |
|------|--------|---------|
| `%Y` | 4-digit year | 2024 |
| `%y` | 2-digit year | 24 |
| `%m` | Month (01-12) | 06 |
| `%d` | Day (01-31) | 15 |
| `%H` | Hour 24h (00-23) | 14 |
| `%I` | Hour 12h (01-12) | 02 |
| `%M` | Minute (00-59) | 30 |
| `%S` | Second (00-59) | 45 |
| `%p` | AM/PM | PM |
| `%A` | Weekday name | Saturday |
| `%a` | Weekday short | Sat |
| `%B` | Month name | June |
| `%b` | Month short | Jun |
| `%w` | Weekday (0-6, Sunday=0) | 6 |
| `%j` | Day of year (001-366) | 167 |
| `%U` | Week number (00-53) | 24 |
| `%z` | Timezone offset | -0700 |
| `%Z` | Timezone name | PDT |
| `%c` | Full date/time | Sat Jun 15 14:30:45 2024 |
| `%x` | Date only | 06/15/24 |
| `%X` | Time only | 14:30:45 |
| `%%` | Literal % | % |

### Date Table

When format is `"*t"`, returns a table:

```lua
local t = os.date("*t")
```

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `year` | integer | Four-digit year | 2024 |
| `month` | integer | Month (1-12) | 6 |
| `day` | integer | Day of month (1-31) | 15 |
| `hour` | integer | Hour (0-23) | 14 |
| `min` | integer | Minute (0-59) | 30 |
| `sec` | integer | Second (0-59) | 45 |
| `wday` | integer | Weekday (1-7, Sunday=1) | 7 |
| `yday` | integer | Day of year (1-366) | 167 |
| `isdst` | boolean | Daylight saving time | false |

Use `"!*t"` for UTC date table.

## Measuring Elapsed Time

Get seconds elapsed since Lua runtime started:

```lua
local start = os.clock()

-- do work
for i = 1, 1000000 do end

local elapsed = os.clock() - start
print(string.format("Took %.3f seconds", elapsed))
```

**Signature:** `os.clock() -> number`

## Time Difference

Get difference between two timestamps in seconds:

```lua
local t1 = os.time({year = 2024, month = 1, day = 1})
local t2 = os.time({year = 2024, month = 12, day = 31})

local diff = os.difftime(t2, t1)  -- t2 - t1
local days = diff / 86400
print(days)  -- 365
```

**Signature:** `os.difftime(t2, t1) -> number`

| Parameter | Type | Description |
|-----------|------|-------------|
| `t2` | integer | Later timestamp |
| `t1` | integer | Earlier timestamp |

Returns `t2 - t1` in seconds. Can be negative if `t1 > t2`.

## Platform Constant

Constant identifying the runtime:

```lua
os.platform  -- "wippy"
```
