---
title: "Testing"
description: "wippy/test フレームワークで Lua コードのテストを記述して実行します。これはアサーション、ライフサイクルフック、モックを備えた BDD スタイルのランナーで、wippy test コマンドによって実行されます。"
---

# Testing

`wippy/test` フレームワークで Lua コードのテストを記述して実行します。これはアサーション、ライフサイクルフック、モックを備えた BDD スタイルのランナーで、`wippy test` コマンドによって実行されます。

## 構築するもの

小さなライブラリと、それをカバーするテストスイート：

1. `add` と `div` 関数を持つ `calc` ライブラリ。
2. ケースを記述し、動作をアサートし、保留中のケースをスキップするテストエントリ。
3. `wippy test` によるグリーンなテスト実行。

## 前提条件

- Wippy プロジェクト ([app-template](https://github.com/wippyai/app-template) をクローンするか、空のディレクトリで `wippy init` を実行)。
- テストフレームワークがインストールされていること：

  ```bash
  wippy add wippy/test
  wippy install
  ```

  ランナーはライブのターミナル UI を `wippy/terminal` 上でレンダリングしますが、これは
  `wippy/test` が自動的に取り込みます。

## テスト対象のコード

```lua
-- src/calc.lua
local function add(a, b)
    return a + b
end

local function div(a, b)
    if b == 0 then
        return nil, "division by zero"
    end
    return a / b
end

return { add = add, div = div }
```

## テスト

テストは `meta.type: test` でタグ付けされた通常の `function.lua` エントリです。そのメソッドは `test.run_cases(...)` が生成する値を返し、ランナーがそれを呼び出します：

```lua
-- src/calc_test.lua
local test = require("test")
local calc = require("calc")

local function define_tests()
    test.describe("calculator", function()
        local started = false

        test.before_all(function()
            started = true
        end)

        test.it("setup ran", function()
            test.is_true(started)
        end)

        test.it("adds numbers", function()
            test.eq(calc.add(2, 3), 5)
        end)

        test.it("returns error on divide by zero", function()
            local result, err = calc.div(1, 0)
            test.has_error(result, err)
            test.contains(err, "division by zero")
        end)

        test.it_skip("not implemented yet", function()
            test.fail("should not run")
        end)
    end)
end

return { run = test.run_cases(define_tests) }
```

両方のエントリを登録します。検出は `meta.type: test` をキーにします。`meta.suite` は出力で結果をグループ化します：

```yaml
# src/_index.yaml
version: "1.0"
namespace: app

entries:
  - name: test_framework
    kind: ns.dependency
    component: wippy/test
    version: "*"

  - name: calc
    kind: library.lua
    source: file://calc.lua

  - name: calc_test
    kind: function.lua
    meta:
      name: Calculator Test
      type: test
      suite: calculator
    source: file://calc_test.lua
    method: run
    imports:
      test: wippy.test:test
      calc: app:calc
```

`ns.dependency` エントリがアプリケーションに `wippy/test` をマウントします。これがないと
フレームワークの名前空間がレジストリに届かず、`wippy.test:test` を解決できません。`imports`
マップは、テスト内で `require(...)` が解決する対象を制御します。`test` はフレームワークを
バインドし、`calc` はテスト対象のユニットをバインドします。

## 実行

```bash
wippy test
```

上記スイートの出力：

```
  Running Tests

  1 tests in 1 suites

    o setup ran <1ms
    o adds numbers <1ms
    o returns error on divide by zero <1ms
    - not implemented yet (skipped)
  o calculator (4) 3/4 1 skipped 21ms

  PASSED  ██████████████████░░░░░░░

  3 tests  1 skipped  26ms
```

`wippy test` はすべてのケースが合格すると `0` で、失敗があれば `1` で終了するため、そのまま CI に組み込めます。

## アサーション

各アサーションは失敗時に例外を発生させます。型ガードは検証された値も返します。

| アサーション | チェック内容 |
|---|---|
| `test.eq(a, b)` / `test.neq(a, b)` | 等価 / 非等価 |
| `test.ok(v)` / `test.fail(msg)` | 真値 / 強制的に失敗させる |
| `test.is_nil(v)` / `test.not_nil(v)` | Nil / 非 nil |
| `test.is_true(v)` / `test.is_false(v)` | ブール値 |
| `test.is_string/number/table/function/boolean(v)` | 型ガード (`v` を返す) |
| `test.contains(str, sub)` / `test.matches(str, pattern)` | 部分文字列 / Lua パターン |
| `test.has_key(tbl, key)` / `test.len(v, n)` | マップキー / 長さ |
| `test.gt/gte/lt/lte(a, b)` | 数値比較 |
| `test.throws(fn)` / `test.has_error(val, err)` / `test.no_error(val, err)` | エラー処理 |

すべてオプションの末尾メッセージ引数を取ります。

## ライフサイクルとモック

これらは `describe` ブロック内で呼び出します：

- `test.before_all` / `test.after_all` — ブロックごとに 1 回実行。
- `test.before_each` / `test.after_each` — すべてのケースの前後で実行。
- `test.mock("module.field", fn)` — 現在のケースに対して関数を置き換えます。モックは各ケースの後に自動的に復元されます。早期にクリアするには `test.restore_all_mocks()` を使用します。

ネストされた `describe` ブロックは親のフックを継承します (外側の `before_*` が先、内側の `after_*` が先)。

## 次のステップ

- [Hello World](tutorials/hello-world.md) — 最小限のプロジェクトレイアウト
- [エントリの種類](guides/entry-kinds.md) — `function.lua`、`library.lua` など
- [テストフレームワーク](framework/testing.md) — ランナーとイベントプロトコルの完全なリファレンス
