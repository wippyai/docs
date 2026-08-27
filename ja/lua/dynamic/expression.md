---
title: "式言語"
description: "Lua から expr-lang 式をコンパイルして評価します。"
---

# 式言語
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

`expr` モジュールは、[expr-lang](https://expr-lang.org/) の式をコンパイルして評価し、Lua ソースを実行せずにフィルタリング、検証、計算、ルール評価を行います。このページが正規の Lua API リファレンスです。例は `expr` モジュールを宣言したエントリを持つ既存の Wippy Lua プロセス内で実行しますが、単独で動く Wippy アプリケーションではありません。式と能力を制限した Lua のどちらを使うかは、[動的評価](./eval.md)を参照してください。

## ロード

```lua
local expr = require("expr")
```

## キャッシュ

`expr.eval` はコンパイル済み式を内部 LRU キャッシュに保持します（既定容量 1000）。キャッシュはモジュールに組み込まれており、設定は不要です。

## 式の評価

式文字列を評価して結果を返します。この関数はコンパイル済み式の内部キャッシュを使用します。

```lua
-- Simple math
local result, err = expr.eval("1 + 2 * 3")
if err then
    return nil, err
end
-- result == 7

-- With variables
local total, total_err = expr.eval("price * quantity", {
    price = 29.99,
    quantity = 3
})
if total_err then
    return nil, total_err
end
-- total == 89.97

-- Ternary operator
local label, label_err = expr.eval('score > 90 ? "A" : score > 80 ? "B" : "C"', {
    score = 85
})
if label_err then
    return nil, label_err
end
-- label == "B"
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `expression` | string | expr-lang構文の式 |
| `env` | `any` | 式の変数環境（オプション。通常はテーブル） |

**戻り値:** `any, error`

## 式のコンパイル

繰り返し評価できる再利用可能な `Program` に式をコンパイルします。

```lua
-- Compile once for repeated use
local discount_calc, err = expr.compile("price * (1 - discount_rate)")
if err then
    return nil, err
end

-- Reuse with different inputs
local price1, run_err = discount_calc:run({price = 100, discount_rate = 0.1})
if run_err then
    return nil, run_err
end

local price2, second_run_err = discount_calc:run({price = 50, discount_rate = 0.2})
if second_run_err then
    return nil, second_run_err
end
-- price1 == 90 and price2 == 40
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `expression` | string | expr-lang構文の式 |
| `env` | `any` | コンパイル用の型ヒント環境（オプション。通常はテーブル） |

**戻り値:** `Program, error`

## コンパイル済みプログラムの実行

指定した環境でコンパイル済み式を実行します。

```lua
-- Validation rule
local validator, compile_err = expr.compile("len(password) >= 8 and len(password) <= 128")
if compile_err then
    return nil, compile_err
end

local valid, run_err = validator:run({password = "securepass123"})
if run_err then
    return nil, run_err
end
-- valid == true

-- Pricing rule
local pricer, pricing_compile_err = expr.compile([[
    base_price * quantity * (1 - bulk_discount) + shipping
]])
if pricing_compile_err then
    return nil, pricing_compile_err
end

local order_total, pricing_run_err = pricer:run({
    base_price = 25.00,
    quantity = 10,
    bulk_discount = 0.15,
    shipping = 12.50
})
if pricing_run_err then
    return nil, pricing_run_err
end
-- order_total == 225.00
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `env` | `any` | 式の変数環境（オプション。通常はテーブル） |

**戻り値:** `any, error`

## 組み込み関数

Expr-lang には一般的な操作のための組み込み関数があります。

```lua
local maximum, max_err = expr.eval("max(1, 5, 3)")
if max_err then
    return nil, max_err
end

local uppercase, upper_err = expr.eval('upper("hello")')
if upper_err then
    return nil, upper_err
end

local total, sum_err = expr.eval("sum(values)", {values = {1, 2, 3, 4}})
if sum_err then
    return nil, sum_err
end
-- maximum == 5, uppercase == "HELLO", and total == 10
```

ほかにも `min`、`abs`、`ceil`、`floor`、`len`、`lower`、`trim` などの組み込み関数があります。Expr-lang は文字列用の `contains` やメンバーシップ判定用の `in` などの演算子も提供します。

## エラー

| 条件 | 種別 | 再試行可能 |
|-----------|------|-----------|
| 式が空 | `errors.INVALID` | no |
| 式の構文が無効 | `errors.INTERNAL` | no |
| 式の評価が失敗 | `errors.INTERNAL` | no |
| 結果の変換が失敗 | `errors.INTERNAL` | no |

エラーの処理については[エラー処理](../core/errors.md)を参照してください。
