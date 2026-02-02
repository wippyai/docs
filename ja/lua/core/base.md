# 標準Luaライブラリ
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

すべてのWippyプロセスで自動的に利用可能なコアLuaライブラリ。`require()`不要。

## グローバル関数

### 型と変換

```lua
type(value)         -- 戻り値: "nil", "number", "string", "boolean", "table", "function", "thread", "userdata"
tonumber(s [,base]) -- 数値に変換、オプションで基数(2-36)
tostring(value)     -- 文字列に変換、__tostringメタメソッドを呼び出し
```

### アサーションとエラー

```lua
assert(v [,msg])    -- vがfalse/nilの場合エラーを発生、それ以外はvを返す
error(msg [,level]) -- 指定されたスタックレベルでエラーを発生（デフォルト1）
pcall(fn, ...)      -- 保護された呼び出し、ok, result_or_errorを返す
xpcall(fn, errh)    -- エラーハンドラ関数付き保護された呼び出し
```

### テーブルイテレーション

```lua
pairs(t)            -- すべてのキー/値ペアをイテレート
ipairs(t)           -- 配列部分をイテレート（1, 2, 3, ...）
next(t [,index])    -- indexの後の次のキー/値ペアを取得
```

### メタテーブル

```lua
getmetatable(obj)       -- メタテーブルを取得（保護されている場合は__metatableフィールド）
setmetatable(t, mt)     -- メタテーブルを設定、tを返す
```

### 生テーブルアクセス

メタメソッドをバイパスして直接テーブルアクセス：

```lua
rawget(t, k)        -- __indexなしでt[k]を取得
rawset(t, k, v)     -- __newindexなしでt[k]=vを設定
rawequal(a, b)      -- __eqなしで比較
```

### ユーティリティ

```lua
select(index, ...)  -- index以降の引数を返す
select("#", ...)    -- 引数の数を返す
unpack(t [,i [,j]]) -- t[i]からt[j]を複数の値として返す
print(...)          -- 値を出力（Wippyでは構造化ロギングを使用）
```

### グローバル変数

```lua
_G        -- グローバル環境テーブル
_VERSION  -- Luaバージョン文字列
```

## テーブル操作

テーブルを変更する関数：

```lua
table.insert(t, [pos,] value)  -- pos位置に値を挿入（デフォルト: 末尾）
table.remove(t [,pos])         -- pos位置の要素を削除して返す（デフォルト: 最後）
table.concat(t [,sep [,i [,j]]]) -- 配列要素をセパレータで連結
table.sort(t [,comp])          -- インプレースでソート、comp(a,b)はa < bならtrueを返す
table.pack(...)                -- 可変長引数を'n'フィールド付きテーブルにパック
table.unpack(t [,i [,j]])      -- テーブル要素を複数の値としてアンパック
```

```lua
local items = {"a", "b", "c"}

table.insert(items, "d")           -- {"a", "b", "c", "d"}
table.insert(items, 2, "x")        -- {"a", "x", "b", "c", "d"}
table.remove(items, 2)             -- {"a", "b", "c", "d"}, "x"を返す

local csv = table.concat(items, ",")  -- "a,b,c,d"

table.sort(items, function(a, b)
    return a > b  -- 降順
end)
```

## 文字列操作

文字列操作関数。文字列値のメソッドとしても利用可能：

### パターンマッチング

```lua
string.find(s, pattern [,init [,plain]])   -- パターンを検索、start, end, capturesを返す
string.match(s, pattern [,init])           -- マッチするサブ文字列を抽出
string.gmatch(s, pattern)                  -- すべてのマッチに対するイテレータ
string.gsub(s, pattern, repl [,n])         -- マッチを置換、string, countを返す
```

### 大文字/小文字変換

```lua
string.upper(s)   -- 大文字に変換
string.lower(s)   -- 小文字に変換
```

### サブ文字列と文字

```lua
string.sub(s, i [,j])      -- iからjまでのサブ文字列（負のインデックスは末尾から）
string.len(s)              -- 文字列長（または#sを使用）
string.byte(s [,i [,j]])   -- 文字の数値コード
string.char(...)           -- 文字コードから文字列を作成
string.rep(s, n [,sep])    -- 文字列をn回繰り返しセパレータ付き
string.reverse(s)          -- 文字列を反転
```

### フォーマット

```lua
string.format(fmt, ...)    -- printfスタイルのフォーマット
```

フォーマット指定子：`%d`（整数）、`%f`（浮動小数点）、`%s`（文字列）、`%q`（クォート付き）、`%x`（16進数）、`%o`（8進数）、`%e`（科学的表記）、`%%`（リテラル%）

```lua
local s = "Hello, World!"

-- パターンマッチング
local start, stop = string.find(s, "World")  -- 8, 12
local word = string.match(s, "%w+")          -- "Hello"

-- 置換
local new = string.gsub(s, "World", "Wippy") -- "Hello, Wippy!"

-- メソッド構文
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

数学関数と定数：

### 定数 {id="math-constants"}

```lua
math.pi       -- 3.14159...
math.huge     -- 無限大
math.mininteger  -- 最小整数
math.maxinteger  -- 最大整数
```

### 基本操作

```lua
math.abs(x)           -- 絶対値
math.min(...)         -- 引数の最小値
math.max(...)         -- 引数の最大値
math.floor(x)         -- 切り捨て
math.ceil(x)          -- 切り上げ
math.modf(x)          -- 整数部と小数部
math.fmod(x, y)       -- 浮動小数点剰余
```

### べき乗と平方根

```lua
math.sqrt(x)          -- 平方根
math.pow(x, y)        -- x^y（またはx^y演算子を使用）
math.exp(x)           -- e^x
math.log(x [,base])   -- 自然対数（またはbase底の対数）
```

### 三角関数

```lua
math.sin(x)   math.cos(x)   math.tan(x)    -- ラジアン
math.asin(x)  math.acos(x)  math.atan(y [,x])
math.sinh(x)  math.cosh(x)  math.tanh(x)   -- 双曲線
math.deg(r)   -- ラジアンから度
math.rad(d)   -- 度からラジアン
```

### 乱数

```lua
math.random()         -- ランダム浮動小数点 [0,1)
math.random(n)        -- ランダム整数 [1,n]
math.random(m, n)     -- ランダム整数 [m,n]
math.randomseed(x)    -- 乱数シードを設定
```

### 型変換

```lua
math.tointeger(x)     -- 整数に変換またはnil
math.type(x)          -- "integer"、"float"、またはnil
math.ult(m, n)        -- 符号なし小なり比較
```

## コルーチン

コルーチンの作成と制御。チャネルと並行パターンについては[チャネルとコルーチン](lua/core/channel.md)を参照：

```lua
coroutine.create(fn)        -- 関数からコルーチンを作成
coroutine.resume(co, ...)   -- コルーチンを開始/続行
coroutine.yield(...)        -- コルーチンを中断、resumeに値を返す
coroutine.status(co)        -- "running"、"suspended"、"normal"、"dead"
coroutine.running()         -- 現在のコルーチン（メインスレッドならnil）
coroutine.wrap(fn)          -- 呼び出し可能な関数としてコルーチンを作成
```

### 並行コルーチンのスポーン

独立して実行される並行コルーチンをスポーン（Wippy固有）：

```lua
coroutine.spawn(fn)         -- 関数を並行コルーチンとしてスポーン
```

```lua
-- バックグラウンドタスクをスポーン
coroutine.spawn(function()
    while true do
        check_health()
        time.sleep("30s")
    end
end)

-- メイン実行を即座に続行
process_request()
```

## エラー処理

構造化エラーの作成と分類。完全なドキュメントについては[エラー処理](lua/core/errors.md)を参照：

### 定数 {id="error-constants"}

```lua
errors.UNKNOWN           -- 未分類エラー
errors.INVALID           -- 無効な引数または入力
errors.NOT_FOUND         -- リソースが見つからない
errors.ALREADY_EXISTS    -- リソースが既に存在
errors.PERMISSION_DENIED -- 権限拒否
errors.TIMEOUT           -- 操作がタイムアウト
errors.CANCELED          -- 操作がキャンセル
errors.UNAVAILABLE       -- サービス利用不可
errors.INTERNAL          -- 内部エラー
errors.CONFLICT          -- コンフリクト（例：並行変更）
errors.RATE_LIMITED      -- レート制限超過
```

### 関数 {id="error-functions"}

```lua
-- 文字列からエラーを作成
local err = errors.new("something went wrong")

-- メタデータ付きエラーを作成
local err = errors.new({
    message = "User not found",
    kind = errors.NOT_FOUND,
    retryable = false,
    details = {user_id = 123}
})

-- 既存のエラーをコンテキスト付きでラップ
local wrapped = errors.wrap(err, "failed to load profile")

-- エラー種別をチェック
if errors.is(err, errors.NOT_FOUND) then
    -- not foundを処理
end

-- エラーからコールスタックを取得
local stack = errors.call_stack(err)
```

### エラーメソッド

```lua
err:message()    -- エラーメッセージ文字列を取得
err:kind()       -- エラー種別を取得（例："NOT_FOUND"）
err:retryable()  -- true、false、またはnil（不明）
err:details()    -- 詳細テーブルまたはnilを取得
err:stack()      -- スタックトレースを文字列として取得
```

## UTF-8 Unicode

Unicode UTF-8文字列処理：

### 定数 {id="utf8-constants"}

```lua
utf8.charpattern  -- 単一のUTF-8文字にマッチするパターン
```

### 関数 {id="utf8-functions"}

```lua
utf8.char(...)           -- Unicodeコードポイントから文字列を作成
utf8.codes(s)            -- コードポイントに対するイテレータ: for pos, code in utf8.codes(s)
utf8.codepoint(s [,i [,j]]) -- 位置iからjのコードポイントを取得
utf8.len(s [,i [,j]])    -- UTF-8文字数をカウント（バイトではない）
utf8.offset(s, n [,i])   -- 位置iからn番目の文字のバイト位置
```

```lua
local s = "Hello, 世界"

-- 文字数をカウント（バイトではない）
print(utf8.len(s))  -- 9

-- コードポイントをイテレート
for pos, code in utf8.codes(s) do
    print(pos, code, utf8.char(code))
end

-- 位置のコードポイントを取得
local code = utf8.codepoint(s, 8)  -- 最初の中国語文字

-- コードポイントから文字列を作成
local emoji = utf8.char(0x1F600)  -- 笑顔
```

## 制限された機能

セキュリティのため以下の標準Lua機能は利用不可：

| 機能 | 代替 |
|---------|-------------|
| `load`、`loadstring`、`loadfile`、`dofile` | [動的評価](lua/dynamic/eval.md)モジュールを使用 |
| `collectgarbage` | 自動GC |
| `rawlen` | `#`演算子を使用 |
| `io.*` | [ファイルシステム](lua/storage/filesystem.md)モジュールを使用 |
| `os.execute`、`os.exit`、`os.remove`、`os.rename`、`os.tmpname` | [コマンド実行](lua/dynamic/exec.md)、[環境](lua/system/env.md)モジュールを使用 |
| `debug.*`（tracebackを除く） | 利用不可 |
| `package.loadlib` | ネイティブライブラリはサポートされていない |

## 関連項目

- [チャネルとコルーチン](lua/core/channel.md) - 並行処理のためのGo形式チャネル
- [エラー処理](lua/core/errors.md) - 構造化エラーの作成と処理
- [OS Time](lua/system/ostime.md) - システム時間関数

