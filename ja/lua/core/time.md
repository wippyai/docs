# 時間と期間
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

時間値、期間、タイムゾーン、スケジューリングを扱う。タイマーの作成、指定期間のスリープ、タイムスタンプの解析とフォーマット。

ワークフローでは、`time.now()`は決定論的リプレイのために記録された時間参照を返します。

## ロード

```lua
local time = require("time")
```

## 現在時刻

### now

現在時刻を返す。ワークフローでは、決定論的リプレイのためにワークフローの時間参照から記録された時刻を返す。

```lua
local t = time.now()
print(t:format_rfc3339())  -- "2024-12-29T15:04:05Z"

-- 経過時間を測定
local start = time.now()
do_work()
local elapsed = time.now():sub(start)
print("Took " .. elapsed:milliseconds() .. "ms")
```

**戻り値:** `Time`

## 時間値の作成

### コンポーネントから

```lua
-- UTCで特定の日時を作成
local t = time.date(2024, time.DECEMBER, 25, 10, 30, 0, 0, time.utc)
print(t:format_rfc3339())  -- "2024-12-25T10:30:00Z"

-- 特定のタイムゾーンで作成
local ny, _ = time.load_location("America/New_York")
local meeting = time.date(2024, time.JANUARY, 15, 14, 0, 0, 0, ny)

-- 指定しない場合はローカルタイムゾーンがデフォルト
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

### Unixタイムスタンプから

```lua
-- エポックからの秒数から
local t = time.unix(1703862245, 0)
print(t:utc():format_rfc3339())  -- "2023-12-29T15:04:05Z"

-- ナノ秒付き
local t = time.unix(1703862245, 500000000)  -- +500ms

-- JavaScriptタイムスタンプ（ミリ秒）を変換
local js_timestamp = 1703862245000
local t = time.unix(js_timestamp // 1000, (js_timestamp % 1000) * 1000000)
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `sec` | number | Unix秒 |
| `nsec` | number | ナノ秒オフセット |

**戻り値:** `Time`

### 文字列から

Goの参照時刻フォーマットを使用して時刻文字列を解析：`Mon Jan 2 15:04:05 MST 2006`。

```lua
-- RFC3339を解析
local t, err = time.parse(time.RFC3339, "2024-12-29T15:04:05Z")
if err then
    return nil, err
end

-- カスタムフォーマットを解析
local t, err = time.parse("2006-01-02", "2024-12-29")
local t, err = time.parse("15:04:05", "14:30:00")
local t, err = time.parse("2006-01-02 15:04:05 MST", "2024-12-29 14:30:00 EST")

-- 特定のタイムゾーンで解析
local ny, _ = time.load_location("America/New_York")
local t, err = time.parse("2006-01-02 15:04", "2024-12-29 14:30", ny)
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `layout` | string | Go時刻フォーマットレイアウト |
| `value` | string | 解析する文字列 |
| `location` | Location | デフォルトタイムゾーン（オプション） |

**戻り値:** `Time, error`

## Timeメソッド

### 算術

```lua
local t = time.now()

-- 期間を追加（数値、文字列、またはDurationを受け付け）
local tomorrow = t:add("24h")
local later = t:add(5 * time.MINUTE)
local d, _ = time.parse_duration("1h30m")
local future = t:add(d)

-- 時間を減算して期間を取得
local diff = tomorrow:sub(t)  -- Durationを返す
print(diff:hours())           -- 24

-- カレンダー単位を追加（月境界を正しく処理）
local next_month = t:add_date(0, 1, 0)   -- 1ヶ月追加
local next_year = t:add_date(1, 0, 0)    -- 1年追加
local last_week = t:add_date(0, 0, -7)   -- 7日減算
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

t:unix()       -- エポックからの秒数
t:unix_nano()  -- エポックからのナノ秒
```

### コンポーネント

```lua
local t = time.now()

-- 日付部分を取得
local year, month, day = t:date()

-- 時刻部分を取得
local hour, min, sec = t:clock()

-- 個別のアクセサ
t:year()        -- 例：2024
t:month()       -- 1-12
t:day()         -- 1-31
t:hour()        -- 0-23
t:minute()      -- 0-59
t:second()      -- 0-59
t:nanosecond()  -- 0-999999999
t:weekday()     -- 0=日曜 .. 6=土曜
t:year_day()    -- 1-366
t:is_zero()     -- ゼロ値の場合true
```

### タイムゾーン変換

```lua
local t = time.now()

t:utc()                    -- UTCに変換
t:in_local()               -- ローカルタイムゾーンに変換
t:in_location(ny)          -- 特定のタイムゾーンに変換
t:location()               -- 現在のLocationを取得
t:location():string()      -- タイムゾーン名を取得
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

t:round(hour_duration)       -- 最も近い時間に丸め
t:truncate(minute_duration)  -- 15分境界に切り捨て
```

| メソッド | パラメータ | 戻り値 | 説明 |
|--------|------------|---------|-------------|
| `round(duration)` | Duration | Time | 最も近い倍数に丸め |
| `truncate(duration)` | Duration | Time | 倍数に切り捨て |

## Duration

### Durationの作成

```lua
-- 文字列から解析
local d, err = time.parse_duration("1h30m45s")
local d, err = time.parse_duration("500ms")
local d, err = time.parse_duration("2h30m45s500ms")

-- 数値から（ナノ秒）
local d, err = time.parse_duration(time.SECOND)
local d, err = time.parse_duration(5 * time.MINUTE)

-- 有効な単位: ns, us, ms, s, m, h
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

### 名前でロード

IANA名でタイムゾーンをロード（例："America/New_York"、"Europe/London"、"Asia/Tokyo"）。

```lua
local ny, err = time.load_location("America/New_York")
if err then
    return nil, err
end

local tokyo, _ = time.load_location("Asia/Tokyo")
local london, _ = time.load_location("Europe/London")

-- タイムゾーン間で変換
local t = time.now():utc()
print("UTC:", t:format(time.TIME_ONLY))
print("New York:", t:in_location(ny):format(time.TIME_ONLY))
print("Tokyo:", t:in_location(tokyo):format(time.TIME_ONLY))
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `name` | string | IANAタイムゾーン名 |

**戻り値:** `Location, error`

### 固定オフセット

固定UTCオフセットでタイムゾーンを作成。

```lua
-- UTC+5:30（インド標準時）
local ist = time.fixed_zone("IST", 5*3600 + 30*60)

-- UTC-8（太平洋標準時）
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
time.utc      -- UTCタイムゾーン
time.localtz  -- ローカルシステムタイムゾーン
```

## スケジューリング

### sleep

指定期間だけ実行を一時停止。ワークフローでは、正しく記録・リプレイされます。

```lua
time.sleep("5s")
time.sleep(500 * time.MILLISECOND)

-- バックオフパターン
for attempt = 1, 3 do
    local ok = try_operation()
    if ok then break end
    time.sleep(tostring(attempt) .. "s")
end
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `duration` | number/string/Duration | スリープ時間 |

### after

期間後に一度受信するチャネルを返す。`channel.select`と連携。

```lua
-- シンプルなタイムアウト
local timeout = time.after("5s")
timeout:receive()  -- 5秒間ブロック

-- selectでタイムアウト
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

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `duration` | number/string/Duration | 待機時間 |

**戻り値:** `Channel`

### timer

期間後に発火するワンショットタイマー。停止またはリセット可能。

```lua
local timer = time.timer("5s")

-- タイマーを待機
timer:response():receive()
send_reminder()

-- アクティビティでリセット
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

-- タイマーを停止
timer:stop()
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `duration` | number/string/Duration | 発火までの時間 |

**戻り値:** `Timer, error`

| Timerメソッド | パラメータ | 戻り値 | 説明 |
|--------------|------------|---------|-------------|
| `response()` | - | Channel | タイマーチャネルを取得 |
| `channel()` | - | Channel | response()のエイリアス |
| `stop()` | - | boolean | タイマーをキャンセル |
| `reset(duration)` | number/string/Duration | boolean | 新しい期間でリセット |

### ticker

定期的な間隔で発火する繰り返しタイマー。

```lua
-- 定期タスク
local ticker = time.ticker("30s")
local ch = ticker:response()

while true do
    local tick_time = ch:receive()
    check_health()
end

-- レート制限
local ticker = time.ticker("100ms")
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

| Tickerメソッド | パラメータ | 戻り値 | 説明 |
|---------------|------------|---------|-------------|
| `response()` | - | Channel | tickerチャネルを取得 |
| `channel()` | - | Channel | response()のエイリアス |
| `stop()` | - | boolean | tickerを停止 |

## 定数

### 期間単位

期間定数はナノ秒単位。算術で使用。

```lua
time.NANOSECOND    -- 1
time.MICROSECOND   -- 1,000
time.MILLISECOND   -- 1,000,000
time.SECOND        -- 1,000,000,000
time.MINUTE        -- 60 * SECOND
time.HOUR          -- 60 * MINUTE

-- 使用例
time.sleep(5 * time.SECOND)
local timeout = time.after(30 * time.SECOND)
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

エラーの処理については[エラー処理](lua-errors.md)を参照。

