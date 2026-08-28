---
title: "OS時間"
description: "Lua のグローバル os テーブルでランタイム時刻を読み取り、日付を整形し、時刻差を計算します。"
---

# OS時間
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

グローバル `os` テーブルは、タイムスタンプ、日付書式、経過時間の測定、時刻差の計算を提供します。ワークフロー内の現在時刻の読み取りにはワークフローの時刻基準を使用し、ワークフロー外ではシステムクロックを使用します。

このページは API リファレンスです。タイムスタンプのリテラルと書式済み出力は例示であり、実際の値はランタイムまたはワークフローのクロックとタイムゾーンによって変わります。

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

**シグネチャ:** `os.time([spec]) -> number`

**パラメータ:**

| フィールド | 型 | デフォルト | 説明 |
|-------|------|---------|-------------|
| `year` | number | 現在の年 | 4桁の年（例: 2024） |
| `month` | number | 現在の月 | 月 1-12 |
| `day` | number | 現在の日 | 日 1-31 |
| `hour` | number | 0 | 時 0-23 |
| `min` | number | 0 | 分 0-59 |
| `sec` | number | 0 | 秒 0-59 |

引数なしで呼び出すと、現在のUnixタイムスタンプを返す。

テーブルで呼び出すと、不足しているフィールドは上記のデフォルト値を使用。`year`、`month`、`day`フィールドは指定されない場合、現在の日付がデフォルト。

```lua
-- Just date (time defaults to midnight)
os.time({year = 2024, month = 6, day = 15})

-- Partial (fills in current year/month)
os.time({day = 1})  -- first of current month
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
| `timestamp` | number | 現在時刻 | フォーマットするUnixタイムスタンプ |

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
| `%U` | ISO 8601 週番号 (01-53、月曜始まり) | 24 |
| `%W` | ISO 8601 週番号 (01-53、月曜始まり) | 24 |
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
| `year` | number | 4桁の年 | 2024 |
| `month` | number | 月 (1-12) | 6 |
| `day` | number | 日 (1-31) | 15 |
| `hour` | number | 時 (0-23) | 14 |
| `min` | number | 分 (0-59) | 30 |
| `sec` | number | 秒 (0-59) | 45 |
| `wday` | number | 曜日 (1-7, 日曜=1) | 7 |
| `yday` | number | 年間日 (1-366) | 167 |
| `isdst` | boolean | このリリースではゾーンの UTC オフセットが 0 以外なら `true`。信頼できる DST 指標ではない | false |

UTC日付テーブルには`"!*t"`を使用。

## 経過時間の測定

現在のランタイム時刻基準と OS-time モジュールの初期化時刻との間の秒数を取得します。

```lua
local start = os.clock()

-- do work
for i = 1, 1000000 do end

local elapsed = os.clock() - start
print(string.format("Took %.3f seconds", elapsed))
```

**シグネチャ:** `os.clock() -> number`

標準 Lua の CPU 時間という定義とは異なり、この実装は経過時間に基づきます。ワークフロー内ではワークフローの時刻基準を使用します。

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
| `t2` | number | 後のタイムスタンプ |
| `t1` | number | 前のタイムスタンプ |

秒単位で`t2 - t1`を返す。`t1 > t2`の場合は負になる。

## プラットフォーム定数

ランタイムを識別する定数:

```lua
os.platform  -- "wippy"
```
