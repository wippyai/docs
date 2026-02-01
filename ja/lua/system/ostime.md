# OS時間
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

標準Lua `os`時間関数。タイムスタンプ、日付フォーマット、時間計算のための実際のウォールクロック時間を提供。

## ロード

グローバル`os`テーブル。requireは不要。

```lua
os.time()
os.date()
os.clock()
os.difftime()
```

## タイムスタンプの取得

Unixタイムスタンプ（1970年1月1日UTC以降の秒数）を取得:

```lua
-- 現在のタイムスタンプ
local now = os.time()  -- 1718462445

-- 特定の日時
local t = os.time({
    year = 2024,
    month = 12,
    day = 25,
    hour = 10,
    min = 30,
    sec = 0
})
```

**シグネチャ:** `os.time([spec]) -> integer`

**パラメータ:**

| フィールド | 型 | デフォルト | 説明 |
|-------|------|---------|-------------|
| `year` | integer | 現在の年 | 4桁の年（例: 2024） |
| `month` | integer | 現在の月 | 月 1-12 |
| `day` | integer | 現在の日 | 日 1-31 |
| `hour` | integer | 0 | 時 0-23 |
| `min` | integer | 0 | 分 0-59 |
| `sec` | integer | 0 | 秒 0-59 |

引数なしで呼び出すと、現在のUnixタイムスタンプを返す。

テーブルで呼び出すと、不足しているフィールドは上記のデフォルト値を使用。`year`、`month`、`day`フィールドは指定されない場合、現在の日付がデフォルト。

```lua
-- 日付のみ（時間はデフォルトで深夜0時）
os.time({year = 2024, month = 6, day = 15})

-- 部分的（現在の年/月を補完）
os.time({day = 1})  -- 現在の月の1日
```

## 日付のフォーマット

タイムスタンプを文字列にフォーマットするか、日付テーブルを返す:

<code-block lang="lua">
local now = os.time()

-- デフォルトフォーマット
os.date()  -- "Sat Jun 15 14:30:45 2024"

-- カスタムフォーマット
os.date("%Y-%m-%d", now)           -- "2024-06-15"
os.date("%H:%M:%S", now)           -- "14:30:45"
os.date("%Y-%m-%dT%H:%M:%S", now)  -- "2024-06-15T14:30:45"

-- UTC時間（フォーマットの前に!を付ける）
os.date("!%Y-%m-%d %H:%M:%S", now)  -- ローカルの代わりにUTC

-- 日付テーブル
local t = os.date("*t", now)
</code-block>

**シグネチャ:** `os.date([format], [timestamp]) -> string | table`

| パラメータ | 型 | デフォルト | 説明 |
|-----------|------|---------|-------------|
| `format` | string | `"%c"` | フォーマット文字列、テーブルには`"*t"` |
| `timestamp` | integer | 現在時刻 | フォーマットするUnixタイムスタンプ |

### フォーマット指定子

| コード | 出力 | 例 |
|------|--------|---------|
| `%Y` | 4桁の年 | 2024 |
| `%y` | 2桁の年 | 24 |
| `%m` | 月 (01-12) | 06 |
| `%d` | 日 (01-31) | 15 |
| `%H` | 24時間制の時 (00-23) | 14 |
| `%I` | 12時間制の時 (01-12) | 02 |
| `%M` | 分 (00-59) | 30 |
| `%S` | 秒 (00-59) | 45 |
| `%p` | AM/PM | PM |
| `%A` | 曜日名 | Saturday |
| `%a` | 曜日略称 | Sat |
| `%B` | 月名 | June |
| `%b` | 月略称 | Jun |
| `%w` | 曜日 (0-6, 日曜=0) | 6 |
| `%j` | 年間日 (001-366) | 167 |
| `%U` | 週番号 (00-53) | 24 |
| `%z` | タイムゾーンオフセット | -0700 |
| `%Z` | タイムゾーン名 | PDT |
| `%c` | 完全な日時 | Sat Jun 15 14:30:45 2024 |
| `%x` | 日付のみ | 06/15/24 |
| `%X` | 時刻のみ | 14:30:45 |
| `%%` | リテラル% | % |

### 日付テーブル

フォーマットが`"*t"`の場合、テーブルを返す:

```lua
local t = os.date("*t")
```

| フィールド | 型 | 説明 | 例 |
|-------|------|-------------|---------|
| `year` | integer | 4桁の年 | 2024 |
| `month` | integer | 月 (1-12) | 6 |
| `day` | integer | 日 (1-31) | 15 |
| `hour` | integer | 時 (0-23) | 14 |
| `min` | integer | 分 (0-59) | 30 |
| `sec` | integer | 秒 (0-59) | 45 |
| `wday` | integer | 曜日 (1-7, 日曜=1) | 7 |
| `yday` | integer | 年間日 (1-366) | 167 |
| `isdst` | boolean | 夏時間 | false |

UTC日付テーブルには`"!*t"`を使用。

## 経過時間の測定

Luaランタイム開始からの経過秒数を取得:

```lua
local start = os.clock()

-- 作業を実行
for i = 1, 1000000 do end

local elapsed = os.clock() - start
print(string.format("Took %.3f seconds", elapsed))
```

**シグネチャ:** `os.clock() -> number`

## 時間差

2つのタイムスタンプ間の差を秒で取得:

```lua
local t1 = os.time({year = 2024, month = 1, day = 1})
local t2 = os.time({year = 2024, month = 12, day = 31})

local diff = os.difftime(t2, t1)  -- t2 - t1
local days = diff / 86400
print(days)  -- 365
```

**シグネチャ:** `os.difftime(t2, t1) -> number`

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `t2` | integer | 後のタイムスタンプ |
| `t1` | integer | 前のタイムスタンプ |

秒単位で`t2 - t1`を返す。`t1 > t2`の場合は負になる。

## プラットフォーム定数

ランタイムを識別する定数:

```lua
os.platform  -- "wippy"
```

