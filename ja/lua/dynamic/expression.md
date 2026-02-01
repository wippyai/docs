# 式言語
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

[expr-lang](https://expr-lang.org/)構文を使用して動的式を評価します。完全なLua実行なしで、フィルタリング、検証、ルール評価のための安全な式をコンパイルして実行できます。

## 設定

式キャッシュは起動時に設定します:

```yaml
lua:
  expr:
    cache_enabled: true   # 式キャッシュを有効化
    capacity: 5000        # キャッシュ容量
```

## ロード

```lua
local expr = require("expr")
```

## 式の評価

式文字列を評価して結果を返します。コンパイル済み式には内部LRUキャッシュを使用します:

```lua
-- シンプルな計算
local result = expr.eval("1 + 2 * 3")  -- 7

-- 変数付き
local total = expr.eval("price * quantity", {
    price = 29.99,
    quantity = 3
})  -- 89.97

-- ブール式
local is_adult = expr.eval("age >= 18", {age = 21})  -- true

-- 文字列操作
local greeting = expr.eval('name + " is " + status', {
    name = "Alice",
    status = "online"
})  -- "Alice is online"

-- 三項演算子
local label = expr.eval('score > 90 ? "A" : score > 80 ? "B" : "C"', {
    score = 85
})  -- "B"

-- 配列操作
local has_admin = expr.eval('"admin" in roles', {
    roles = {"user", "admin", "viewer"}
})  -- true
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `expression` | string | expr-lang構文の式 |
| `env` | table | 式の変数環境（オプション） |

**戻り値:** `any, error`

## 式のコンパイル

繰り返しの評価用に、再利用可能なProgramオブジェクトに式をコンパイルします:

```lua
-- 繰り返し使用のために一度コンパイル
local discount_calc, err = expr.compile("price * (1 - discount_rate)")
if err then
    return nil, err
end

-- 異なる入力で再利用
local price1 = discount_calc:run({price = 100, discount_rate = 0.1})  -- 90
local price2 = discount_calc:run({price = 50, discount_rate = 0.2})   -- 40
local price3 = discount_calc:run({price = 200, discount_rate = 0.15}) -- 170
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `expression` | string | expr-lang構文の式 |
| `env` | table | コンパイル用の型ヒント環境（オプション） |

**戻り値:** `Program, error`

## コンパイル済みプログラムの実行

提供された環境でコンパイル済み式を実行します:

```lua
-- 検証ルール
local validator, _ = expr.compile("len(password) >= 8 and len(password) <= 128")

local valid1 = validator:run({password = "short"})       -- false
local valid2 = validator:run({password = "securepass123"}) -- true

-- 価格設定ルール
local pricer, _ = expr.compile([[
    base_price * quantity * (1 - bulk_discount) + shipping
]])

local order_total = pricer:run({
    base_price = 25.00,
    quantity = 10,
    bulk_discount = 0.15,
    shipping = 12.50
})  -- 225.00
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `env` | table | 式の変数環境（オプション） |

**戻り値:** `any, error`

## 組み込み関数

Expr-langは多くの組み込み関数を提供しています:

```lua
-- 数学関数
expr.eval("max(1, 5, 3)")        -- 5
expr.eval("min(10, 2, 8)")       -- 2
expr.eval("abs(-42)")            -- 42
expr.eval("ceil(3.2)")           -- 4
expr.eval("floor(3.8)")          -- 3

-- 文字列関数
expr.eval('len("hello")')        -- 5
expr.eval('upper("hello")')      -- "HELLO"
expr.eval('lower("HELLO")')      -- "hello"
expr.eval('trim("  hi  ")')      -- "hi"
expr.eval('contains("hello", "ell")')  -- true

-- 配列関数
expr.eval("len(items)", {items = {1,2,3}})  -- 3
expr.eval("sum(values)", {values = {1,2,3,4}})  -- 10
```

## エラー

| 条件 | 種別 | 再試行可能 |
|-----------|------|-----------|
| 式が空 | `errors.INVALID` | no |
| 式の構文が無効 | `errors.INTERNAL` | no |
| 式の評価が失敗 | `errors.INTERNAL` | no |
| 結果の変換が失敗 | `errors.INTERNAL` | no |

エラーの処理については[エラー処理](lua-errors.md)を参照。

