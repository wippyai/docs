---
title: "時間と期間"
description: "時間値の作成、比較、解析、書式設定、期間とタイムゾーンの操作、スリープとタイマーのスケジュール。"
---

# 時間と期間
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

`time` モジュールは、時間値、期間、タイムゾーン処理、解析、書式設定、スリープ、タイマーを提供します。サポートされるワークフローの時間呼び出しは、決定的にリプレイできるよう記録されます。

このページはAPIリファレンスです。コードブロックは独立した例または部分的なスケジューリングパターンであり、完全なエントリではありません。`do_work`、`try_operation`、`make_request`、`send_reminder`、`user_activity`、`check_health`、`process` などの名前は、アプリケーションのコールバック、チャネル、データを表します。エラー戻り値を `_` に代入しているスニペットは、示されたリテラルが有効であることを前提とします。値が入力や設定から来る場合はエラーを処理してください。

## ロード

```lua
local time = require("time")
```

読み込む前に、実行可能エントリの `modules:` リストへ `time` を追加してください。スケジューリング例で使用するグローバルの `channel` と `errors` にモジュール宣言は不要です。

## 現在時刻

### `now`

現在時刻を返します。ワークフローでは、実行を決定的にリプレイできるよう、記録されたワークフロー時間の参照を返します。

```lua
local t = time.now()
print(t:format_rfc3339())  -- "2024-12-29T15:04:05Z"

-- Measure elapsed time
local start = time.now()
do_work()
local elapsed = time.now():sub(start)
print("Took " .. elapsed:milliseconds() .. "ms")
```

タイムスタンプと経過時間の出力は例示です。`time.now()` は現在時刻、または記録されたワークフロー時間を返します。

**戻り値:** `Time`

## 時間値の作成

### コンポーネントから作成

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

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `year` | number | 年 |
| `month` | number | 月（1-12または`time.JANUARY`など） |
| `day` | number | 日 |
| `hour` | number | 時（0-23） |
| `minute` | number | 分（0-59） |
| `second` | number | 秒（0-59） |
| `nanosecond` | number | ナノ秒（0-999999999） |
| `location` | Location | タイムゾーン（オプション、デフォルトはlocal） |

**戻り値:** `Time`

### Unixタイムスタンプから作成

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

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `sec` | number | Unix秒 |
| `nsec` | number | ナノ秒オフセット |

**戻り値:** `Time`

### 文字列を解析

Goの参照時刻フォーマットを使用して時刻文字列を解析：`Mon Jan 2 15:04:05 MST 2006`。

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

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `layout` | string | Go時刻フォーマットレイアウト |
| `value` | string | 解析する文字列 |
| `location` | Location | デフォルトのタイムゾーン（オプション） |

**戻り値:** `Time, error`

## Timeメソッド

### 算術

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

| メソッド | パラメータ | 戻り値 | 説明 |
|--------|------------|---------|-------------|
| `add(duration)` | number/string/Duration | Time | 期間を追加 |
| `sub(time)` | Time | Duration | 時間の差分 |
| `add_date(years, months, days)` | numbers | Time | カレンダー単位を追加 |

### 比較

```lua
local t1 = time.date(2024, 1, 1, 0, 0, 0, 0, time.utc)
local t2 = time.date(2024, 1, 2, 0, 0, 0, 0, time.utc)

t1:before(t2)   -- true
t2:after(t1)    -- true
t1:equal(t1)    -- true
```

| メソッド | パラメータ | 戻り値 | 説明 |
|--------|------------|---------|-------------|
| `before(time)` | Time | boolean | この時間は他より前か？ |
| `after(time)` | Time | boolean | この時間は他より後か？ |
| `equal(time)` | Time | boolean | 時間は等しいか？ |

### フォーマット

```lua
local t = time.now()

t:format_rfc3339()              -- "2024-12-29T15:04:05Z"
t:format(time.DATE_ONLY)        -- "2024-12-29"
t:format(time.TIME_ONLY)        -- "15:04:05"
t:format("Mon Jan 2, 2006")     -- "Sun Dec 29, 2024"
```

| メソッド | パラメータ | 戻り値 | 説明 |
|--------|------------|---------|-------------|
| `format(layout)` | string | string | Goレイアウトでフォーマット |
| `format_rfc3339()` | - | string | RFC3339としてフォーマット |

### Unixタイムスタンプ

```lua
local t = time.now()

t:unix()       -- seconds since epoch
t:unix_nano()  -- nanoseconds since epoch
```

### コンポーネント

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

### タイムゾーン変換

```lua
local t = time.now()

t:utc()                    -- convert to UTC
t:in_local()               -- convert to local timezone
t:in_location(ny)          -- convert to specific timezone
t:location()               -- get current Location
t:location():string()      -- get timezone name
```

| メソッド | パラメータ | 戻り値 | 説明 |
|--------|------------|---------|-------------|
| `utc()` | - | Time | UTCに変換 |
| `in_local()` | - | Time | ローカルタイムゾーンに変換 |
| `in_location(loc)` | Location | Time | タイムゾーンに変換 |
| `location()` | - | Location | 現在のタイムゾーンを取得 |

### 丸め

期間境界に丸めまたは切り捨て。**Duration userdataが必要**（数値や文字列ではない）。

```lua
local t = time.now()
local hour_duration, _ = time.parse_duration("1h")
local minute_duration, _ = time.parse_duration("15m")

t:round(hour_duration)       -- round to nearest hour
t:truncate(minute_duration)  -- truncate to 15-minute boundary
```

| メソッド | パラメータ | 戻り値 | 説明 |
|--------|------------|---------|-------------|
| `round(duration)` | Duration | Time | 最も近い倍数に丸め |
| `truncate(duration)` | Duration | Time | 倍数に切り捨て |

## Duration

### Durationの作成

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

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `value` | number/string/Duration | 解析する期間 |

**戻り値:** `Duration, error`

### Durationメソッド

```lua
local d, _ = time.parse_duration("1h30m45s500ms")

d:hours()         -- 1.5125...
d:minutes()       -- 90.75...
d:seconds()       -- 5445.5
d:milliseconds()  -- 5445500
d:microseconds()  -- 5445500000
d:nanoseconds()   -- 5445500000000
```

## タイムゾーン

### 名前付きLocation

`America/New_York`、`Europe/London`、`Asia/Tokyo` などのIANA名でタイムゾーンを読み込みます。

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

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `name` | string | IANAタイムゾーン名 |

**戻り値:** `Location, error`

### 固定オフセットLocation

固定UTCオフセットのタイムゾーンを作成します。

```lua
-- UTC+5:30 (India Standard Time)
local ist = time.fixed_zone("IST", 5*3600 + 30*60)

-- UTC-8 (Pacific Standard Time)
local pst = time.fixed_zone("PST", -8*3600)

local t = time.date(2024, 1, 15, 12, 0, 0, 0, ist)
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `name` | string | ゾーン名 |
| `offset` | number | 秒単位のUTCオフセット |

**戻り値:** `Location`

### 組み込みLocation

```lua
time.utc      -- UTC timezone
time.localtz  -- Local system timezone
```

## スケジューリング

### `sleep`

指定した期間だけ実行を中断します。ワークフロー実行では、決定的なリプレイのためにスリープが記録されます。

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

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `duration` | number/string/Duration | スリープ時間 |

### `after`

指定期間後に値を1つ受信するチャネルを返します。このチャネルは `channel.select` で使用できます。

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

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `duration` | number/string/Duration | 待機時間 |

**戻り値:** `Channel, error`

### `timer`

指定期間後に発火し、停止またはリセットできるワンショットタイマーを作成します。

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

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `duration` | number/string/Duration | 発火までの時間 |

**戻り値:** `Timer, error`

| Timer メソッド | パラメーター | 戻り値 | 説明 |
|--------------|------------|---------|-------------|
| `response()` | - | Channel | タイマーチャネルを取得 |
| `channel()` | - | Channel | response()のエイリアス |
| `stop()` | - | boolean | タイマーをキャンセル |
| `reset(duration)` | number/string/Duration | boolean | 新しい期間でリセット |

### `ticker`

一定間隔で発火する繰り返しタイマーを作成します。

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

上のループは長時間実行プロセス向けです。有限のレート制限パターンは次のとおりです。

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

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `duration` | number/string/Duration | ティック間の間隔 |

**戻り値:** `Ticker, error`

| Ticker メソッド | パラメーター | 戻り値 | 説明 |
|---------------|------------|---------|-------------|
| `response()` | - | Channel | tickerチャネルを取得 |
| `channel()` | - | Channel | response()のエイリアス |
| `stop()` | - | boolean | tickerを停止 |

## 定数

### 期間単位

期間定数はナノ秒単位で表され、算術と組み合わせて使用できます。

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

### フォーマットレイアウト

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

### 月

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

### 曜日

```lua
time.SUNDAY     -- 0
time.MONDAY     -- 1
time.TUESDAY    -- 2
time.WEDNESDAY  -- 3
time.THURSDAY   -- 4
time.FRIDAY     -- 5
time.SATURDAY   -- 6
```

## エラー

| 条件 | 種別 | 再試行可能 |
|-----------|------|-----------|
| 無効な期間フォーマット | `errors.INVALID` | no |
| 解析失敗 | `errors.INVALID` | no |
| 空のlocation名 | `errors.INVALID` | no |
| Locationが見つからない | `errors.NOT_FOUND` | no |
| Duration <= 0（timer/ticker） | `errors.INVALID` | no |

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

エラーの処理については[エラー処理](errors.md)を参照してください。
