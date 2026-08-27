---
title: "標準Luaライブラリ"
description: "Wippyエントリで利用できる組み込みLuaグローバル、table、string、math、coroutine、構造化エラーAPI。"
---

# 標準Luaライブラリ
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

これらのコアLuaライブラリは、すべての実行可能Luaエントリで `require()` なしに利用できます。

このページはAPIリファレンスです。シグネチャのブロックは利用可能な関数を列挙し、長いブロックは完全なエントリではなく、独立した例または部分的なパターンです。`check_health` や `process_request` などの名前はアプリケーションのコールバックを表します。

## 組み込みグローバル関数

### 型と変換

```lua
type(value)         -- Returns: "nil", "number", "string", "boolean", "table", "function", "thread", "userdata"
tonumber(s [,base]) -- Convert to number, optional base (2-36)
tostring(value)     -- Convert to string, calls __tostring metamethod
```

### アサーションとエラー

```lua
assert(v [,msg])    -- Raises error if v is false/nil, returns v otherwise
error(msg [,level]) -- Raises error at specified stack level (default 1)
pcall(fn, ...)      -- Protected call, returns ok, result_or_error
xpcall(fn, errh)    -- Protected call with error handler function
```

### テーブルイテレーション

```lua
pairs(t)            -- Iterate all key-value pairs
ipairs(t)           -- Iterate array portion (1, 2, 3, ...)
next(t [,index])    -- Get next key-value pair after index
```

### メタテーブル

```lua
getmetatable(obj)       -- Get metatable (or __metatable field if protected)
setmetatable(t, mt)     -- Set metatable, returns t
```

### 生テーブルアクセス

メタメソッドをバイパスして直接テーブルアクセス：

```lua
rawget(t, k)        -- Get t[k] without __index
rawset(t, k, v)     -- Set t[k]=v without __newindex
rawequal(a, b)      -- Compare without __eq
```

### ユーティリティ

```lua
select(index, ...)  -- Return args from index onwards
select("#", ...)    -- Return number of args
unpack(t [,i [,j]]) -- Return t[i] through t[j] as multiple values
print(...)          -- Print values (uses structured logging in Wippy)
```

### グローバル変数

```lua
_G        -- The global environment table
_VERSION  -- Lua version string
```

## テーブル操作

`table` ライブラリは、配列のインプレース操作、ソート、連結、展開を提供します。

```lua
table.insert(t, [pos,] value)  -- Insert value at pos (default: end)
table.remove(t [,pos])         -- Remove and return element at pos (default: last)
table.concat(t [,sep [,i [,j]]]) -- Concatenate array elements with separator
table.sort(t [,comp])          -- Sort in place, comp(a,b) returns true if a < b
table.unpack(t [,i [,j]])      -- Unpack table elements as multiple values
```

```lua
local items = {"a", "b", "c"}

table.insert(items, "d")           -- {"a", "b", "c", "d"}
table.insert(items, 2, "x")        -- {"a", "x", "b", "c", "d"}
table.remove(items, 2)             -- {"a", "b", "c", "d"}, returns "x"

local csv = table.concat(items, ",")  -- "a,b,c,d"

table.sort(items, function(a, b)
    return a > b  -- Descending order
end)
```

## 文字列操作

文字列関数は、文字列値のメソッドとしても利用できます。

### パターンマッチング

```lua
string.find(s, pattern [,init [,plain]])   -- Find pattern, returns start, end, captures
string.match(s, pattern [,init])           -- Extract matching substring
string.gmatch(s, pattern)                  -- Iterator over all matches
string.gsub(s, pattern, repl [,n])         -- Replace matches, returns string, count
```

### 大文字/小文字変換

```lua
string.upper(s)   -- Convert to uppercase
string.lower(s)   -- Convert to lowercase
```

### サブ文字列と文字

```lua
string.sub(s, i [,j])      -- Substring from i to j (negative indexes from end)
string.len(s)              -- String length (or use #s)
string.byte(s [,i [,j]])   -- Numeric codes of characters
string.char(...)           -- Create string from character codes
string.rep(s, n)           -- Repeat string n times
string.reverse(s)          -- Reverse string
```

### フォーマット

```lua
string.format(fmt, ...)    -- Printf-style formatting
```

フォーマット指定子：`%d`（整数）、`%f`（浮動小数点）、`%s`（文字列）、`%q`（クォート付き）、`%x`（16進数）、`%o`（8進数）、`%e`（科学的表記）、`%%`（リテラル%）

```lua
local s = "Hello, World!"

-- Pattern matching
local start, stop = string.find(s, "World")  -- 8, 12
local word = string.match(s, "%w+")          -- "Hello"

-- Substitution
local new = string.gsub(s, "World", "Wippy") -- "Hello, Wippy!"

-- Method syntax
local upper = s:upper()                       -- "HELLO, WORLD!"
local part = s:sub(1, 5)                      -- "Hello"
```

### パターン

| パターン | マッチ |
|---------|---------|
| `.` | 任意の文字 |
| `%a` | 文字 |
| `%d` | 数字 |
| `%w` | 英数字 |
| `%s` | 空白 |
| `%p` | 句読点 |
| `%c` | 制御文字 |
| `%x` | 16進数字 |
| `%z` | ゼロ（null） |
| `[set]` | 文字クラス |
| `[^set]` | 否定クラス |
| `*` | 0回以上（貪欲） |
| `+` | 1回以上（貪欲） |
| `-` | 0回以上（非貪欲） |
| `?` | 0回または1回 |
| `^` | 文字列の先頭 |
| `$` | 文字列の末尾 |
| `%b()` | バランスペア |
| `(...)` | キャプチャグループ |

大文字バージョン（`%A`、`%D`など）は補集合にマッチ。

## Math関数

`math` ライブラリは、数値定数と一般的な数学演算を提供します。

### 定数 {id="math-constants"}

```lua
math.pi       -- 3.14159...
math.huge     -- Infinity
math.mininteger  -- Minimum integer
math.maxinteger  -- Maximum integer
```

### 基本操作

```lua
math.abs(x)           -- Absolute value
math.min(...)         -- Minimum of arguments
math.max(...)         -- Maximum of arguments
math.floor(x)         -- Round down
math.ceil(x)          -- Round up
math.modf(x)          -- Integer and fractional parts
math.fmod(x, y)       -- Floating-point remainder
```

### べき乗と平方根

```lua
math.sqrt(x)          -- Square root
math.pow(x, y)        -- x^y (or use x^y operator)
math.exp(x)           -- e^x
math.log(x)           -- Natural log
math.log10(x)         -- Base-10 log
```

### 三角関数

```lua
math.sin(x)   math.cos(x)   math.tan(x)    -- Radians
math.asin(x)  math.acos(x)  math.atan(x)
math.atan2(y, x)                            -- Arc tangent of y/x
math.sinh(x)  math.cosh(x)  math.tanh(x)   -- Hyperbolic
math.deg(r)   -- Radians to degrees
math.rad(d)   -- Degrees to radians
```

### 乱数

```lua
math.random()         -- Random float [0,1)
math.random(n)        -- Random integer [1,n]
math.random(m, n)     -- Random integer [m,n]
math.randomseed(x)    -- Compatibility no-op; does not seed math.random
```

`math.random` は非決定的です。ワークフローで同一にリプレイする必要がある判断には使用しないでください。`math.randomseed` で決定的にすることはできません。

### 型変換

```lua
math.tointeger(x)     -- Convert to integer or nil
math.type(x)          -- "integer", "float", or nil
math.ult(m, n)        -- Unsigned less-than comparison
```

## コルーチン

`coroutine` ライブラリは、コルーチンの作成と制御を提供します。チャネルを使った並行処理パターンについては[チャネルとコルーチン](channel.md)を参照してください。

```lua
coroutine.create(fn)        -- Create coroutine from function
coroutine.resume(co, ...)   -- Start/continue coroutine
coroutine.yield(...)        -- Suspend coroutine, return values to resume
coroutine.status(co)        -- "running", "suspended", "normal", "dead"
coroutine.running()         -- Current coroutine (nil if main thread)
coroutine.wrap(fn)          -- Create coroutine as callable function
```

### 並行コルーチンのスポーン

Wippyは、スケジューラが管理する並行処理のために `coroutine.spawn` を追加しています。

```lua
coroutine.spawn(fn)         -- Spawn function as concurrent coroutine
```

```lua
local time = require("time")

-- Spawn background task
coroutine.spawn(function()
    while true do
        check_health()
        time.sleep("30s")
    end
end)

-- Continue main execution immediately
process_request()
```

この部分的なパターンでは、エントリの `modules:` に `time` が含まれ、`check_health` と `process_request` がアプリケーションから提供されるものとします。スポーンされたコルーチンは同じLuaプロセス内で並行して実行されるため、`process_request()` には直ちに到達し、各ヘルスチェック後に30秒間スリープします。

## エラー処理

グローバルな `errors` テーブルは、構造化エラーを作成し、分類します。完全なAPIについては[エラー処理](errors.md)を参照してください。

### 定数 {id="error-constants"}

```lua
errors.UNKNOWN           -- Unclassified error
errors.INVALID           -- Invalid argument or input
errors.NOT_FOUND         -- Resource not found
errors.ALREADY_EXISTS    -- Resource already exists
errors.PERMISSION_DENIED -- Permission denied
errors.TIMEOUT           -- Operation timed out
errors.CANCELED          -- Operation cancelled
errors.UNAVAILABLE       -- Service unavailable
errors.INTERNAL          -- Internal error
errors.CONFLICT          -- Conflict (e.g., concurrent modification)
errors.RATE_LIMITED      -- Rate limit exceeded
```

### 関数 {id="error-functions"}

```lua
-- Create error from string
local err = errors.new("something went wrong")

-- Create error with metadata
local err = errors.new({
    message = "User not found",
    kind = errors.NOT_FOUND,
    retryable = false,
    details = {user_id = 123}
})

-- Wrap existing error with context
local wrapped = errors.wrap(err, "failed to load profile")

-- Check error kind
if errors.is(err, errors.NOT_FOUND) then
    -- handle not found
end

-- Get call stack from error
local stack = errors.call_stack(err)
```

### エラーメソッド

```lua
err:message()    -- Get error message string
err:kind()       -- Get error kind (e.g., "NOT_FOUND")
err:retryable()  -- true, false, or nil (unknown)
err:details()    -- Get details table or nil
err:stack()      -- Get stack trace as string
```

## 制限された機能

次の標準Lua機能は、Wippyプロセスでは利用できません。

| 機能 | 代替 |
|---------|-------------|
| `load`、`loadstring`、`loadfile`、`dofile` | [動的評価](../dynamic/eval.md)モジュールを使用 |
| `collectgarbage` | 自動GC |
| `rawlen` | `#`演算子を使用 |
| `string.dump` | サポートなし |
| `io.*` | ファイルには[ファイルシステム](../storage/filesystem.md)、端末ストリームには[ターミナルI/O](../system/io.md)を使用 |
| `os.execute` | [コマンド実行](../dynamic/exec.md)を使用 |
| `os.remove`、`os.rename` | [ファイルシステム](../storage/filesystem.md)を使用 |
| `os.exit`、`os.tmpname` | 標準ライブラリに直接の代替なし |
| `debug.*` | 利用不可 |
| `utf8.*` | 利用不可 |
| `package.loadlib` | ネイティブライブラリはサポートされていません |

## 関連項目

- [チャネルとコルーチン](channel.md) - 並行処理のためのGo形式チャネル
- [エラー処理](errors.md) - 構造化エラーの作成と処理
- [OS Time](../system/ostime.md) - システム時間関数
