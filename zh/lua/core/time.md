# 时间与时长
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

处理时间值、时长、时区和调度。创建定时器、休眠指定时间、解析和格式化时间戳。

在工作流中，`time.now()` 返回记录的时间引用以实现确定性重放。

## 加载

```lua
local time = require("time")
```

## 当前时间

### now

返回当前时间。在工作流中，返回工作流时间引用中记录的时间以实现确定性重放。

```lua
local t = time.now()
print(t:format_rfc3339())  -- "2024-12-29T15:04:05Z"

-- 测量经过时间
local start = time.now()
do_work()
local elapsed = time.now():sub(start)
print("耗时 " .. elapsed:milliseconds() .. "ms")
```

**返回:** `Time`

## 创建时间值

### 从组件创建

```lua
-- 在 UTC 创建特定日期/时间
local t = time.date(2024, time.DECEMBER, 25, 10, 30, 0, 0, time.utc)
print(t:format_rfc3339())  -- "2024-12-25T10:30:00Z"

-- 在特定时区创建
local ny, _ = time.load_location("America/New_York")
local meeting = time.date(2024, time.JANUARY, 15, 14, 0, 0, 0, ny)

-- 未指定时默认使用本地时区
local t = time.date(2024, 1, 15, 12, 0, 0, 0)
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `year` | number | 年份 |
| `month` | number | 月份 (1-12 或 `time.JANUARY` 等) |
| `day` | number | 日 |
| `hour` | number | 小时 (0-23) |
| `minute` | number | 分钟 (0-59) |
| `second` | number | 秒 (0-59) |
| `nanosecond` | number | 纳秒 (0-999999999) |
| `location` | Location | 时区（可选，默认本地） |

**返回:** `Time`

### 从 Unix 时间戳创建

```lua
-- 从纪元秒数创建
local t = time.unix(1703862245, 0)
print(t:utc():format_rfc3339())  -- "2023-12-29T15:04:05Z"

-- 带纳秒
local t = time.unix(1703862245, 500000000)  -- +500ms

-- 转换 JavaScript 时间戳（毫秒）
local js_timestamp = 1703862245000
local t = time.unix(js_timestamp // 1000, (js_timestamp % 1000) * 1000000)
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `sec` | number | Unix 秒数 |
| `nsec` | number | 纳秒偏移 |

**返回:** `Time`

### 从字符串创建

使用 Go 的参考时间格式解析时间字符串：`Mon Jan 2 15:04:05 MST 2006`。

```lua
-- 解析 RFC3339
local t, err = time.parse(time.RFC3339, "2024-12-29T15:04:05Z")
if err then
    return nil, err
end

-- 解析自定义格式
local t, err = time.parse("2006-01-02", "2024-12-29")
local t, err = time.parse("15:04:05", "14:30:00")
local t, err = time.parse("2006-01-02 15:04:05 MST", "2024-12-29 14:30:00 EST")

-- 在特定时区解析
local ny, _ = time.load_location("America/New_York")
local t, err = time.parse("2006-01-02 15:04", "2024-12-29 14:30", ny)
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `layout` | string | Go 时间格式布局 |
| `value` | string | 要解析的字符串 |
| `location` | Location | 默认时区（可选） |

**返回:** `Time, error`

## Time 方法

### 算术运算

```lua
local t = time.now()

-- 添加时长（接受数字、字符串或 Duration）
local tomorrow = t:add("24h")
local later = t:add(5 * time.MINUTE)
local d, _ = time.parse_duration("1h30m")
local future = t:add(d)

-- 时间相减得到时长
local diff = tomorrow:sub(t)  -- 返回 Duration
print(diff:hours())           -- 24

-- 添加日历单位（正确处理月份边界）
local next_month = t:add_date(0, 1, 0)   -- 加 1 个月
local next_year = t:add_date(1, 0, 0)    -- 加 1 年
local last_week = t:add_date(0, 0, -7)   -- 减 7 天
```

| 方法 | 参数 | 返回 | 描述 |
|--------|------------|---------|-------------|
| `add(duration)` | number/string/Duration | Time | 添加时长 |
| `sub(time)` | Time | Duration | 时间差 |
| `add_date(years, months, days)` | numbers | Time | 添加日历单位 |

### 比较

```lua
local t1 = time.date(2024, 1, 1, 0, 0, 0, 0, time.utc)
local t2 = time.date(2024, 1, 2, 0, 0, 0, 0, time.utc)

t1:before(t2)   -- true
t2:after(t1)    -- true
t1:equal(t1)    -- true
```

| 方法 | 参数 | 返回 | 描述 |
|--------|------------|---------|-------------|
| `before(time)` | Time | boolean | 此时间是否在另一个之前？ |
| `after(time)` | Time | boolean | 此时间是否在另一个之后？ |
| `equal(time)` | Time | boolean | 时间是否相等？ |

### 格式化

```lua
local t = time.now()

t:format_rfc3339()              -- "2024-12-29T15:04:05Z"
t:format(time.DATE_ONLY)        -- "2024-12-29"
t:format(time.TIME_ONLY)        -- "15:04:05"
t:format("Mon Jan 2, 2006")     -- "Sun Dec 29, 2024"
```

| 方法 | 参数 | 返回 | 描述 |
|--------|------------|---------|-------------|
| `format(layout)` | string | string | 使用 Go 布局格式化 |
| `format_rfc3339()` | - | string | 格式化为 RFC3339 |

### Unix 时间戳

```lua
local t = time.now()

t:unix()       -- 纪元秒数
t:unix_nano()  -- 纪元纳秒数
```

### 组件

```lua
local t = time.now()

-- 获取日期部分
local year, month, day = t:date()

-- 获取时间部分
local hour, min, sec = t:clock()

-- 单独访问器
t:year()        -- 如 2024
t:month()       -- 1-12
t:day()         -- 1-31
t:hour()        -- 0-23
t:minute()      -- 0-59
t:second()      -- 0-59
t:nanosecond()  -- 0-999999999
t:weekday()     -- 0=周日 .. 6=周六
t:year_day()    -- 1-366
t:is_zero()     -- 若为零值则为 true
```

### 时区转换

```lua
local t = time.now()

t:utc()                    -- 转换为 UTC
t:in_local()               -- 转换为本地时区
t:in_location(ny)          -- 转换为特定时区
t:location()               -- 获取当前 Location
t:location():string()      -- 获取时区名称
```

| 方法 | 参数 | 返回 | 描述 |
|--------|------------|---------|-------------|
| `utc()` | - | Time | 转换为 UTC |
| `in_local()` | - | Time | 转换为本地时区 |
| `in_location(loc)` | Location | Time | 转换为指定时区 |
| `location()` | - | Location | 获取当前时区 |

### 舍入

舍入或截断到时长边界。**需要 Duration userdata**（非数字或字符串）。

```lua
local t = time.now()
local hour_duration, _ = time.parse_duration("1h")
local minute_duration, _ = time.parse_duration("15m")

t:round(hour_duration)       -- 舍入到最近的小时
t:truncate(minute_duration)  -- 截断到 15 分钟边界
```

| 方法 | 参数 | 返回 | 描述 |
|--------|------------|---------|-------------|
| `round(duration)` | Duration | Time | 舍入到最近的倍数 |
| `truncate(duration)` | Duration | Time | 截断到倍数 |

## Duration

### 创建时长

```lua
-- 从字符串解析
local d, err = time.parse_duration("1h30m45s")
local d, err = time.parse_duration("500ms")
local d, err = time.parse_duration("2h30m45s500ms")

-- 从数字（纳秒）
local d, err = time.parse_duration(time.SECOND)
local d, err = time.parse_duration(5 * time.MINUTE)

-- 有效单位: ns, us, ms, s, m, h
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `value` | number/string/Duration | 要解析的时长 |

**返回:** `Duration, error`

### Duration 方法

```lua
local d, _ = time.parse_duration("1h30m45s500ms")

d:hours()         -- 1.5125...
d:minutes()       -- 90.75...
d:seconds()       -- 5445.5
d:milliseconds()  -- 5445500
d:microseconds()  -- 5445500000
d:nanoseconds()   -- 5445500000000
```

## 时区

### 按名称加载

按 IANA 名称加载时区（如 "America/New_York"、"Europe/London"、"Asia/Tokyo"）。

```lua
local ny, err = time.load_location("America/New_York")
if err then
    return nil, err
end

local tokyo, _ = time.load_location("Asia/Tokyo")
local london, _ = time.load_location("Europe/London")

-- 时区转换
local t = time.now():utc()
print("UTC:", t:format(time.TIME_ONLY))
print("纽约:", t:in_location(ny):format(time.TIME_ONLY))
print("东京:", t:in_location(tokyo):format(time.TIME_ONLY))
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `name` | string | IANA 时区名称 |

**返回:** `Location, error`

### 固定偏移

创建固定 UTC 偏移的时区。

```lua
-- UTC+5:30（印度标准时间）
local ist = time.fixed_zone("IST", 5*3600 + 30*60)

-- UTC-8（太平洋标准时间）
local pst = time.fixed_zone("PST", -8*3600)

local t = time.date(2024, 1, 15, 12, 0, 0, 0, ist)
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `name` | string | 时区名称 |
| `offset` | number | UTC 偏移（秒） |

**返回:** `Location`

### 内置位置

```lua
time.utc      -- UTC 时区
time.localtz  -- 本地系统时区
```

## 调度

### sleep

暂停执行指定时长。在工作流中，正确记录和重放。

```lua
time.sleep("5s")
time.sleep(500 * time.MILLISECOND)

-- 退避模式
for attempt = 1, 3 do
    local ok = try_operation()
    if ok then break end
    time.sleep(tostring(attempt) .. "s")
end
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `duration` | number/string/Duration | 休眠时间 |

### after

返回一个在指定时长后接收一次的通道。可与 `channel.select` 配合使用。

```lua
-- 简单超时
local timeout = time.after("5s")
timeout:receive()  -- 阻塞 5 秒

-- 带 select 的超时
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

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `duration` | number/string/Duration | 等待时间 |

**返回:** `Channel`

### timer

在指定时长后触发的一次性定时器。可停止或重置。

```lua
local timer = time.timer("5s")

-- 等待定时器
timer:response():receive()
send_reminder()

-- 活动时重置
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

-- 停止定时器
timer:stop()
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `duration` | number/string/Duration | 触发前时间 |

**返回:** `Timer, error`

| Timer 方法 | 参数 | 返回 | 描述 |
|--------------|------------|---------|-------------|
| `response()` | - | Channel | 获取定时器通道 |
| `channel()` | - | Channel | response() 的别名 |
| `stop()` | - | boolean | 取消定时器 |
| `reset(duration)` | number/string/Duration | boolean | 用新时长重置 |

### ticker

按固定间隔重复触发的定时器。

```lua
-- 周期性任务
local ticker = time.ticker("30s")
local ch = ticker:response()

while true do
    local tick_time = ch:receive()
    check_health()
end

-- 速率限制
local ticker = time.ticker("100ms")
for _, item in ipairs(items) do
    ticker:response():receive()
    process(item)
end
ticker:stop()
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `duration` | number/string/Duration | 触发间隔 |

**返回:** `Ticker, error`

| Ticker 方法 | 参数 | 返回 | 描述 |
|---------------|------------|---------|-------------|
| `response()` | - | Channel | 获取 ticker 通道 |
| `channel()` | - | Channel | response() 的别名 |
| `stop()` | - | boolean | 停止 ticker |

## 常量

### 时长单位

时长常量以纳秒为单位。可用于算术运算。

```lua
time.NANOSECOND    -- 1
time.MICROSECOND   -- 1,000
time.MILLISECOND   -- 1,000,000
time.SECOND        -- 1,000,000,000
time.MINUTE        -- 60 * SECOND
time.HOUR          -- 60 * MINUTE

-- 使用示例
time.sleep(5 * time.SECOND)
local timeout = time.after(30 * time.SECOND)
```

### 格式布局

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

### 月份

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

### 星期

```lua
time.SUNDAY     -- 0
time.MONDAY     -- 1
time.TUESDAY    -- 2
time.WEDNESDAY  -- 3
time.THURSDAY   -- 4
time.FRIDAY     -- 5
time.SATURDAY   -- 6
```

## 错误

| 条件 | 类型 | 可重试 |
|-----------|------|-----------|
| 无效时长格式 | `errors.INVALID` | 否 |
| 解析失败 | `errors.INVALID` | 否 |
| 空位置名称 | `errors.INVALID` | 否 |
| 位置未找到 | `errors.NOT_FOUND` | 否 |
| 时长 <= 0（timer/ticker） | `errors.INVALID` | 否 |

```lua
local t, err = time.parse(time.RFC3339, "invalid")
if err then
    if errors.is(err, errors.INVALID) then
        print("无效格式:", err:message())
    end
    return nil, err
end

local loc, err = time.load_location("Unknown/Zone")
if err then
    if errors.is(err, errors.NOT_FOUND) then
        print("位置未找到:", err:message())
    end
    return nil, err
end
```

参见 [错误处理](lua/core/errors.md) 了解错误处理方法。
