---
title: "시간과 기간"
description: "시간 값을 만들고 비교, 파싱, 서식화하며 기간 및 시간대를 다루고 sleep과 타이머를 예약합니다."
---

# 시간과 기간
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

`time` 모듈은 시간 값, 기간, 시간대 처리, 파싱, 서식화, sleep 및 타이머를 제공합니다. 지원되는 워크플로우 시간 호출은 결정론적으로 재생할 수 있도록 기록됩니다.

이 페이지는 API 참조입니다. 코드 블록은 독립적인 예제나 부분적인 예약 패턴이지 완전한 엔트리가 아닙니다. `do_work`, `try_operation`, `make_request`, `send_reminder`, `user_activity`, `check_health`, `process` 같은 이름은 애플리케이션 콜백, 채널 또는 데이터를 나타냅니다. 코드 조각에서 오류 반환을 `_`에 할당하면 표시된 리터럴이 유효하다고 가정합니다. 입력이나 구성에서 값이 올 수 있다면 오류를 처리하세요.

## 로딩

```lua
local time = require("time")
```

require하기 전에 실행 엔트리의 `modules:` 목록에 `time`을 추가하세요. 예약 예제에서 사용하는 주변 `channel`과 `errors` 전역에는 모듈 선언이 필요하지 않습니다.

## 현재 시간

### `now`

현재 시간을 반환합니다. 워크플로우에서는 결정론적 리플레이를 위해 워크플로우의 시간 참조에서 기록된 시간을 반환합니다.

```lua
local t = time.now()
print(t:format_rfc3339())  -- "2024-12-29T15:04:05Z"

-- Measure elapsed time
local start = time.now()
do_work()
local elapsed = time.now():sub(start)
print("Took " .. elapsed:milliseconds() .. "ms")
```

타임스탬프와 경과 시간 출력은 예시이며, `time.now()`는 현재 시간 또는 기록된 워크플로우 시간을 제공합니다.

**반환:** `Time`

## 시간 값 생성

### 구성요소로 만들기

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

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `year` | number | 연도 |
| `month` | number | 월 (1-12 또는 `time.JANUARY` 등) |
| `day` | number | 일 |
| `hour` | number | 시 (0-23) |
| `minute` | number | 분 (0-59) |
| `second` | number | 초 (0-59) |
| `nanosecond` | number | 나노초 (0-999999999) |
| `location` | Location | 타임존 (선택적, 기본값은 로컬) |

**반환:** `Time`

### Unix 타임스탬프로 만들기

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

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `sec` | number | Unix 초 |
| `nsec` | number | 나노초 오프셋 |

**반환:** `Time`

### 문자열 파싱

Go의 참조 시간 형식을 사용하여 시간 문자열 파싱: `Mon Jan 2 15:04:05 MST 2006`.

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

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `layout` | string | Go 시간 형식 레이아웃 |
| `value` | string | 파싱할 문자열 |
| `location` | Location | 기본 타임존 (선택적) |

**반환:** `Time, error`

## 시간 메서드

### 산술

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

| 메서드 | 파라미터 | 반환 | 설명 |
|--------|----------|------|------|
| `add(duration)` | number/string/Duration | Time | 기간 추가 |
| `sub(time)` | Time | Duration | 시간 간 차이 |
| `add_date(years, months, days)` | numbers | Time | 달력 단위 추가 |

### 비교

```lua
local t1 = time.date(2024, 1, 1, 0, 0, 0, 0, time.utc)
local t2 = time.date(2024, 1, 2, 0, 0, 0, 0, time.utc)

t1:before(t2)   -- true
t2:after(t1)    -- true
t1:equal(t1)    -- true
```

| 메서드 | 파라미터 | 반환 | 설명 |
|--------|----------|------|------|
| `before(time)` | Time | boolean | 이 시간이 다른 것보다 이전인가? |
| `after(time)` | Time | boolean | 이 시간이 다른 것보다 이후인가? |
| `equal(time)` | Time | boolean | 시간이 같은가? |

### 포맷팅

```lua
local t = time.now()

t:format_rfc3339()              -- "2024-12-29T15:04:05Z"
t:format(time.DATE_ONLY)        -- "2024-12-29"
t:format(time.TIME_ONLY)        -- "15:04:05"
t:format("Mon Jan 2, 2006")     -- "Sun Dec 29, 2024"
```

| 메서드 | 파라미터 | 반환 | 설명 |
|--------|----------|------|------|
| `format(layout)` | string | string | Go 레이아웃으로 포맷 |
| `format_rfc3339()` | - | string | RFC3339으로 포맷 |

### Unix 타임스탬프

```lua
local t = time.now()

t:unix()       -- seconds since epoch
t:unix_nano()  -- nanoseconds since epoch
```

### 구성요소

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

### 시간대 변환

```lua
local t = time.now()

t:utc()                    -- convert to UTC
t:in_local()               -- convert to local timezone
t:in_location(ny)          -- convert to specific timezone
t:location()               -- get current Location
t:location():string()      -- get timezone name
```

| 메서드 | 파라미터 | 반환 | 설명 |
|--------|----------|------|------|
| `utc()` | - | Time | UTC로 변환 |
| `in_local()` | - | Time | 로컬 타임존으로 변환 |
| `in_location(loc)` | Location | Time | 타임존으로 변환 |
| `location()` | - | Location | 현재 타임존 가져오기 |

### 반올림

기간 경계로 반올림 또는 자르기. **Duration userdata 필요** (숫자나 문자열이 아님).

```lua
local t = time.now()
local hour_duration, _ = time.parse_duration("1h")
local minute_duration, _ = time.parse_duration("15m")

t:round(hour_duration)       -- round to nearest hour
t:truncate(minute_duration)  -- truncate to 15-minute boundary
```

| 메서드 | 파라미터 | 반환 | 설명 |
|--------|----------|------|------|
| `round(duration)` | Duration | Time | 가장 가까운 배수로 반올림 |
| `truncate(duration)` | Duration | Time | 배수로 자르기 |

## 기간

### 기간 만들기

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

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `value` | number/string/Duration | 파싱할 기간 |

**반환:** `Duration, error`

### 기간 메서드

```lua
local d, _ = time.parse_duration("1h30m45s500ms")

d:hours()         -- 1.5125...
d:minutes()       -- 90.75...
d:seconds()       -- 5445.5
d:milliseconds()  -- 5445500
d:microseconds()  -- 5445500000
d:nanoseconds()   -- 5445500000000
```

## 시간대

### 이름 있는 위치

`America/New_York`, `Europe/London`, `Asia/Tokyo` 같은 IANA 이름으로 시간대를 로드합니다.

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

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `name` | string | IANA 타임존 이름 |

**반환:** `Location, error`

### 고정 오프셋 위치

고정 UTC 오프셋으로 타임존 생성.

```lua
-- UTC+5:30 (India Standard Time)
local ist = time.fixed_zone("IST", 5*3600 + 30*60)

-- UTC-8 (Pacific Standard Time)
local pst = time.fixed_zone("PST", -8*3600)

local t = time.date(2024, 1, 15, 12, 0, 0, 0, ist)
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `name` | string | 존 이름 |
| `offset` | number | 초 단위 UTC 오프셋 |

**반환:** `Location`

### 기본 제공 위치

```lua
time.utc      -- UTC timezone
time.localtz  -- Local system timezone
```

## 스케줄링

### `sleep`

지정된 기간 동안 실행 일시 중지. 워크플로우에서 올바르게 기록되고 리플레이됩니다.

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

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `duration` | number/string/Duration | 슬립 시간 |

### `after`

기간 후 한 번 수신하는 채널을 반환합니다. `channel.select`와 함께 작동합니다.

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

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `duration` | number/string/Duration | 대기 시간 |

**반환:** `Channel, error`

### `timer`

기간 후 발생하는 일회성 타이머. 중지하거나 리셋할 수 있습니다.

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

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `duration` | number/string/Duration | 발생까지 시간 |

**반환:** `Timer, error`

| 타이머 메서드 | 파라미터 | 반환 | 설명 |
|--------------|----------|------|------|
| `response()` | - | Channel | 타이머 채널 가져오기 |
| `channel()` | - | Channel | response()의 별칭 |
| `stop()` | - | boolean | 타이머 취소 |
| `reset(duration)` | number/string/Duration | boolean | 새 기간으로 리셋 |

### `ticker`

정기적인 간격으로 발생하는 반복 타이머.

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

위 루프는 장기 실행 프로세스를 위한 것입니다. 별도의 유한한 속도 제한 패턴은 다음과 같습니다.

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

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `duration` | number/string/Duration | 틱 간 간격 |

**반환:** `Ticker, error`

| 티커 메서드 | 파라미터 | 반환 | 설명 |
|---------------|----------|------|------|
| `response()` | - | Channel | 티커 채널 가져오기 |
| `channel()` | - | Channel | response()의 별칭 |
| `stop()` | - | boolean | 티커 중지 |

## 상수

### 기간 단위

기간 상수는 나노초 단위입니다. 산술과 함께 사용합니다.

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

### 포맷 레이아웃

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

### 월

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

### 요일

```lua
time.SUNDAY     -- 0
time.MONDAY     -- 1
time.TUESDAY    -- 2
time.WEDNESDAY  -- 3
time.THURSDAY   -- 4
time.FRIDAY     -- 5
time.SATURDAY   -- 6
```

## 에러

| 조건 | 종류 | 재시도 가능 |
|------|------|-----------|
| 잘못된 기간 형식 | `errors.INVALID` | 아니오 |
| 파싱 실패 | `errors.INVALID` | 아니오 |
| 빈 location 이름 | `errors.INVALID` | 아니오 |
| Location을 찾을 수 없음 | `errors.NOT_FOUND` | 아니오 |
| 기간 <= 0 (timer/ticker) | `errors.INVALID` | 아니오 |

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

에러 처리는 [에러 처리](errors.md)를 참조하세요.
