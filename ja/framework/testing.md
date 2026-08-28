---
title: "テストフレームワーク"
description: "BDD suite、assertion、lifecycle hook、mock、simple test function を使用して Wippy test を定義し、実行します。"
---

# テストフレームワーク

`wippy/test` モジュールは BDD suite、assertion、lifecycle hook、mock、test entry 用 runner を提供します。

このページは API 入門です。Lua、YAML、output、project layout の block は既存の Wippy プロジェクトで組み合わせて使用するリファレンススニペットであり、まとめてコピーして実行できる 1 つのプロジェクトではありません。`validate`、`format_name`、`db`、`connect`、`notify_user` などの名前は、テスト対象が提供するアプリケーション関数またはモジュールを表します。実行可能な完全な例については、[Wippy アプリケーションのテスト](../tutorials/testing.md)に従ってください。

## セットアップ

依存関係を追加します:

```bash
wippy add wippy/test
wippy install
```

このモジュールはテストエントリポイント（`use_case: test`を持つコマンド）を自動的に登録します。インストール後、`wippy test`でプロジェクト内の全テストエントリを検出して実行します。

## テストの定義

テストは`meta.type: test`を持つ`function.lua`エントリです:

```yaml
version: "1.0"
namespace: app.test

entries:
  - name: math
    kind: function.lua
    meta:
      type: test
      suite: math
      name: Math operations
    source: file://math_test.lua
    method: main
    imports:
      test: wippy.test:test
```

### テストメタデータ

| フィールド | 必須 | 説明 |
|-----------|------|------|
| `type` | はい | ランナーが検出するために`"test"`である必要がある |
| `suite` | いいえ | ランナー出力でテストをグループ化する |
| `name` | いいえ | ランナー出力に表示される表示名 |
| `order` | いいえ | スイート内のソート順（小さい値が先に実行される） |

## テストの記述

### BDDスタイル

`describe`と`it`ブロックを使用してテストを構造化します:

```lua
local test = require("test")

local function define_tests()
    test.describe("calculator", function()
        test.it("adds numbers", function()
            test.eq(1 + 1, 2)
        end)

        test.it("multiplies numbers", function()
            test.eq(3 * 4, 12)
        end)
    end)
end

local run_cases = test.run_cases(define_tests)

local function run(options)
    local result = run_cases(options)
    if result.failed_tests > 0 then
        error("tests failed: " .. result.failed_tests)
    end
    return result
end

return { run = run }
```

### ネストされたスイート

関連する動作を group 化するため、suite を nest できます。

```lua
test.describe("user", function()
    test.describe("validation", function()
        test.it("requires name", function()
            test.ok(validate({}).error)
        end)

        test.it("accepts valid input", function()
            test.is_nil(validate({name = "Alice"}).error)
        end)
    end)

    test.describe("formatting", function()
        test.it("formats display name", function()
            test.eq(format_name("alice"), "Alice")
        end)
    end)
end)
```

### テストのスキップ

```lua
test.it_skip("not implemented yet", function()
    test.fail("TODO")
end)
```

skip された test は output に表示されますが、failure には数えられません。

### スイートエイリアス

`test.spec`と`test.context`は`test.describe`のエイリアスです:

```lua
test.spec("feature", function()
    test.context("when valid input", function()
        test.it("succeeds", function()
            test.ok(true)
        end)
    end)
end)
```

## アサーション

### 等値

```lua
test.eq(actual, expected, msg?)       -- actual == expected
test.neq(actual, expected, msg?)      -- actual ~= expected
```

### 真偽値

```lua
test.ok(val, msg?)                    -- val is truthy
test.fail(msg?)                       -- unconditional failure
```

### Nilチェック

```lua
test.is_nil(val, msg?)                -- val == nil
test.not_nil(val, msg?)               -- val ~= nil
```

### 型チェック

```lua
test.is_true(val, msg?)               -- val == true
test.is_false(val, msg?)              -- val == false
test.is_string(val, msg?)
test.is_number(val, msg?)
test.is_table(val, msg?)
test.is_function(val, msg?)
test.is_boolean(val, msg?)
```

### 文字列とコレクション

```lua
test.contains(str, substr, msg?)      -- substring match
test.matches(str, pattern, msg?)      -- Lua pattern match
test.has_key(tbl, key, msg?)          -- table key exists
test.len(val, expected, msg?)         -- #val == expected
```

### 数値比較

```lua
test.gt(a, b, msg?)                   -- a > b
test.gte(a, b, msg?)                  -- a >= b
test.lt(a, b, msg?)                   -- a < b
test.lte(a, b, msg?)                  -- a <= b
```

### エラー処理

```lua
test.throws(fn, msg?)                 -- fn() raises error, returns it
test.has_error(val, err, msg?)        -- val is nil, err is not nil
test.no_error(val, err, msg?)         -- err is nil
```

全てのアサーションは最後の引数としてオプションのメッセージを受け取ります。失敗時にこのメッセージがエラー出力に含まれます。

## ライフサイクルフック

```lua
test.describe("database", function()
    test.before_all(function()
        -- runs once before the suite
        db = connect()
    end)

    test.after_all(function()
        -- runs once after the suite
        db:close()
    end)

    test.before_each(function()
        -- runs before each test
        db:begin_transaction()
    end)

    test.after_each(function()
        -- runs after each test
        db:rollback()
    end)

    test.it("inserts a record", function()
        db:exec("INSERT INTO users (name) VALUES ('Alice')")
        local count = db:query_row("SELECT COUNT(*) FROM users")
        test.eq(count, 1)
    end)
end)
```

ネストされたスイートのフックは順番に実行されます: 親の`before_each`が子の`before_each`の前に実行され、子の`after_each`が親の`after_each`の前に実行されます。

## モッキング

mock system は global object field を置き換え、各 test の後に復元します。

### 基本的なモッキング

```lua
test.describe("notifications", function()
    test.it("sends message", function()
        local sent = false
        test.mock("process.send", function(pid, topic, payload)
            sent = true
        end)

        notify_user("hello")
        test.is_true(sent)
        -- mock is auto-restored after this test
    end)
end)
```

### モックAPI

```lua
test.mock("object.field", replacement)    -- replace a global field
test.mock_process("field", replacement)   -- shorthand for process fields
test.restore_mock("object.field")         -- restore one mock
test.restore_all_mocks()                  -- restore all mocks
```

モックパスはドット記法を使用します: `"process.send"`は`_G.process.send`を置き換えます。

`process.send`のモックは元の関数を通じてテストフレームワークメッセージを自動的にプロキシするため、process.sendがモックされていてもテストイベントレポートは機能し続けます。

全てのモックは`after_each`フックにより各テスト後に自動的に復元されます。

## テストの実行

### 全テストの実行

```bash
wippy test
```

### パターンによるフィルタ

```bash
wippy test math
wippy test user validation
```

filter は entry ID の literal substring に一致します。複数の pattern を指定した場合、ID がそのいずれかに一致する entry が実行されます。

### 出力例

```
3 tests in 1 suites

  calculator
    + adds numbers                           0ms
    + multiplies numbers                     0ms
    - divides by zero                        1ms
      Error: expected error, got nil

  1 suite | 2 passed | 1 failed | 0 skipped | 3ms
```

## シンプルテスト

BDD suite を必要としない test には、`true` を返すかエラーを発生させる関数を定義します。

```lua
local funcs = require("funcs")

local function main()
    local result, err = funcs.call("app:my_function", "input")
    if err then
        error("call failed: " .. tostring(err))
    end
    if result ~= "expected" then
        error("expected 'expected', got: " .. tostring(result))
    end
    return true
end

return { main = main }
```

```yaml
  - name: integration
    kind: function.lua
    meta:
      type: test
      suite: integration
    source: file://integration_test.lua
    method: main
    modules:
      - funcs
```

ランナーはテストがBDDケースイベントを使用しているか、シンプルな値を返しているかを検出します。両方のパターンが`wippy test`で動作します。

## プロジェクト構造

典型的なテストレイアウト:

```
src/
  _index.yaml
  app.lua
  test/
    _index.yaml          # test entries
    math_test.lua
    user_test.lua
    integration_test.lua
```

テスト用の`_index.yaml`はテスト名前空間とエントリを定義します:

```yaml
version: "1.0"
namespace: app.test

entries:
  - name: math
    kind: function.lua
    meta:
      type: test
      suite: math
    source: file://math_test.lua
    method: main
    imports:
      test: wippy.test:test

  - name: user
    kind: function.lua
    meta:
      type: test
      suite: user
    source: file://user_test.lua
    method: main
    imports:
      test: wippy.test:test
```

## ターミナルホスト :id=terminal-host

`wippy/test` は `wippy/terminal` に依存し、CLI runner が使用する auto-start の `wippy.terminal:host` はこのモジュールから提供されます。`wippy test` の実行だけを目的に、アプリケーションで別の process host や terminal host を宣言する必要はありません。

## 関連項目

- [Framework 概要](./overview.md) — Framework モジュールのインストールと import
- [CLI リファレンス](../guides/cli.md) — test command と flag
- [関数](../concepts/functions.md) — function entry と呼び出し
