# テスト

組み込みテストフレームワークを使用してWippyアプリケーションのテストを作成・実行します。

## テストの発見

テストはメタデータによって発見されます。テストランナーは`meta.type = "test"`を持つすべてのレジストリエントリを見つけて実行します。

```bash
wippy run app:test_runner app:terminal
```

ランナーは`registry.find({["meta.type"] = "test"})`を使用してテストを検索し、`funcs.call(entry.id)`で呼び出します。

## テストの定義

`_index.yaml`で`meta.type = "test"`を付けてテスト関数を登録：

```yaml
version: "1.0"
namespace: app.test.errors

entries:
  - name: new
    kind: function.lua
    meta:
      type: test
      suite: errors
      description: errors.newは構造化エラーを作成する
    source: file://new.lua
    method: main
    imports:
      assert2: app.lib:assert
```

**メタデータフィールド：**

- `meta.type`: テスト発見のために`"test"`である必要あり
- `meta.suite`: 関連テストをグループ化（例: "errors", "json"）
- `meta.order`: スイート内の実行順序（デフォルト: 0）
- `meta.description`: テストの説明（出力に表示）

## テスト関数の作成

テスト関数は成功時に`true`を返すか、失敗時にエラーをスローする必要があります：

```lua
-- tests/test/errors/new.lua
local assert = require("assert2")

local function main()
    local e1 = errors.new("simple error")
    assert.ok(e1, "errors.new returns error")
    assert.eq(e1:message(), "simple error", "message matches")
    assert.eq(e1:kind(), "", "default kind is empty")
    assert.is_nil(e1:retryable(), "default retryable is nil")

    local e2 = errors.new({
        message = "not found",
        kind = errors.NOT_FOUND,
        retryable = false,
        details = {resource = "user", id = 123}
    })
    assert.eq(e2:message(), "not found", "message from table")
    assert.eq(e2:kind(), errors.NOT_FOUND, "kind from table")

    local d = e2:details()
    assert.eq(d.resource, "user", "details.resource")
    assert.eq(d.id, 123, "details.id")

    return true
end

return { main = main }
```

## アサーションライブラリ

`tests/lib/assert.lua`に再利用可能なアサーションモジュールを作成：

```lua
local M = {}

function M.eq(actual: any, expected: any, msg: string?)
    if actual ~= expected then
        error((msg or "assertion failed") .. ": expected " .. tostring(expected) .. ", got " .. tostring(actual), 2)
    end
end

function M.neq(actual: any, expected: any, msg: string?)
    if actual == expected then
        error((msg or "assertion failed") .. ": expected not " .. tostring(expected), 2)
    end
end

function M.ok(val: any?, msg: string?): asserts val
    if not val then
        error((msg or "assertion failed") .. ": expected truthy value", 2)
    end
end

function M.fail(msg)
    error(msg or "assertion failed", 2)
end

function M.is_nil(val, msg)
    if val ~= nil then
        error((msg or "assertion failed") .. ": expected nil, got " .. tostring(val), 2)
    end
end

function M.not_nil(val: any?, msg: string?): asserts val
    if val == nil then
        error((msg or "assertion failed") .. ": expected non-nil value", 2)
    end
end

function M.is_string(val: any, msg: string?): asserts val is string
    if type(val) ~= "string" then
        error((msg or "assertion failed") .. ": expected string, got " .. type(val), 2)
    end
end

function M.is_number(val: any, msg: string?): asserts val is number
    if type(val) ~= "number" then
        error((msg or "assertion failed") .. ": expected number, got " .. type(val), 2)
    end
end

function M.is_table(val: any, msg: string?)
    if type(val) ~= "table" then
        error((msg or "assertion failed") .. ": expected table, got " .. type(val), 2)
    end
end

function M.is_boolean(val: any, msg: string?): asserts val is boolean
    if type(val) ~= "boolean" then
        error((msg or "assertion failed") .. ": expected boolean, got " .. type(val), 2)
    end
end

function M.contains(str, substr, msg)
    if type(str) ~= "string" or not string.find(str, substr, 1, true) then
        error((msg or "assertion failed") .. ": expected string to contain '" .. tostring(substr) .. "'", 2)
    end
end

function M.has_error(val, err, msg)
    if val ~= nil then
        error((msg or "has_error failed") .. ": expected nil result, got " .. tostring(val), 2)
    end
    if err == nil then
        error((msg or "has_error failed") .. ": expected error, got nil", 2)
    end
end

function M.no_error(val, err, msg)
    if err ~= nil then
        error((msg or "no_error failed") .. ": unexpected error: " .. tostring(err), 2)
    end
end

function M.throws(fn, msg)
    local ok, err = pcall(fn)
    if ok then
        error((msg or "throws failed") .. ": expected function to throw", 2)
    end
    return err
end

function M.not_throws(fn, msg)
    local ok, err = pcall(fn)
    if not ok then
        error((msg or "not_throws failed") .. ": unexpected error: " .. tostring(err), 2)
    end
end

function M.error_kind(err, expected_kind, msg)
    if err == nil then
        error((msg or "error_kind failed") .. ": error is nil", 2)
    end
    if type(err) ~= "table" then
        error((msg or "error_kind failed") .. ": error is not structured (got " .. type(err) .. ")", 2)
    end
    if err.kind ~= expected_kind then
        error((msg or "error_kind failed") .. ": expected kind '" .. tostring(expected_kind) .. "', got '" .. tostring(err.kind) .. "'", 2)
    end
end

function M.error_message(err, expected_msg, msg)
    if err == nil then
        error((msg or "error_message failed") .. ": error is nil", 2)
    end
    local actual_msg = type(err) == "table" and err.message or tostring(err)
    if actual_msg ~= expected_msg then
        error((msg or "error_message failed") .. ": expected message '" .. tostring(expected_msg) .. "', got '" .. tostring(actual_msg) .. "'", 2)
    end
end

function M.error_contains(err, substr, msg)
    if err == nil then
        error((msg or "error_contains failed") .. ": error is nil", 2)
    end
    local actual_msg = type(err) == "table" and err.message or tostring(err)
    if not string.find(actual_msg, substr, 1, true) then
        error((msg or "error_contains failed") .. ": expected error to contain '" .. tostring(substr) .. "', got '" .. tostring(actual_msg) .. "'", 2)
    end
end

return M
```

アサーションライブラリを登録：

```yaml
# tests/lib/_index.yaml
version: "1.0"
namespace: app.lib

entries:
  - name: assert
    kind: function.lua
    source: file://assert.lua
```

## エラー処理のテスト

Wippy関数は`(result, error)`ペアを返します。成功パスとエラーパスの両方をテスト：

```lua
local assert = require("assert2")

local function main()
    -- 成功パスをテスト
    local t, err = time.parse("2006-01-02 15:04:05", "2024-12-29 15:04:05")
    assert.is_nil(err, "parse succeeds")
    assert.not_nil(t, "parse returns time")
    assert.eq(t:year(), 2024, "parsed year")

    -- エラーパスをテスト
    local bad_t, bad_err = time.parse("2006-01-02", "invalid-date")
    assert.is_nil(bad_t, "invalid parse returns nil")
    assert.not_nil(bad_err, "invalid parse returns error")

    return true
end

return { main = main }
```

**エラーパターンのアサーション：**

```lua
local function main()
    -- エラー種別をチェック
    local user, err = fetch_user(-1)
    assert.is_nil(user, "no user on error")
    assert.eq(err:kind(), errors.INVALID, "INVALID kind")
    assert.eq(err:retryable(), false, "not retryable")

    -- エラーメッセージにテキストが含まれるかチェック
    local _, compress_err = compress.gzip.encode("")
    assert.not_nil(compress_err, "error returned")
    assert.contains(tostring(compress_err), "empty", "error mentions empty")

    -- 関数がスローするかチェック
    assert.throws(function()
        error("something went wrong")
    end, "should throw")

    return true
end
```

## テストスイート

`meta.suite`を使用して関連テストをグループ化：

```yaml
version: "1.0"
namespace: app.test.channel

entries:
  - name: basic
    kind: function.lua
    meta:
      type: test
      suite: channel
      order: 1
    source: file://basic.lua
    method: main
    imports:
      assert2: app.lib:assert

  - name: buffered
    kind: function.lua
    meta:
      type: test
      suite: channel
      order: 2
    source: file://buffered.lua
    method: main
    imports:
      assert2: app.lib:assert

  - name: close
    kind: function.lua
    meta:
      type: test
      suite: channel
      order: 3
    source: file://close.lua
    method: main
    imports:
      assert2: app.lib:assert
```

同じスイート内のテストは出力でグループ化され、`meta.order`で順序付けできます。

## テストランナーの実装

テストランナーはテストを発見・実行するプロセスです：

```yaml
# src/_index.yaml
entries:
  - name: test_runner
    kind: process.lua
    meta:
      comment: meta.type=testのすべてのテストを実行
    source: file://runner.lua
    method: main
    modules:
      - io
      - registry
      - funcs
      - time
```

基本的なランナー実装：

```lua
-- runner.lua
local io = require("io")
local registry = require("registry")
local funcs = require("funcs")
local time = require("time")

local function run_test(entry)
    local ok, result, err = pcall(function()
        return funcs.call(entry.id)
    end)

    if not ok then
        return false, result
    elseif err then
        return false, err
    elseif result == false then
        return false, "test returned false"
    else
        return true, nil
    end
end

local function main()
    local args = io.args()

    io.print("Running Tests")
    io.print("")

    -- すべてのテストを検索
    local entries, err = registry.find({["meta.type"] = "test"})
    if err then
        io.eprint("Error: " .. tostring(err))
        return 1
    end

    if not entries or #entries == 0 then
        io.print("No tests found")
        return 0
    end

    -- パターンでフィルタ
    if #args > 0 then
        local filtered = {}
        for _, entry in ipairs(entries) do
            for _, pattern in ipairs(args) do
                if entry.id:find(pattern, 1, true) then
                    table.insert(filtered, entry)
                    break
                end
            end
        end
        entries = filtered
    end

    local passed = 0
    local failed = 0
    local failures = {}
    local start = time.now()

    -- テストを実行
    for _, entry in ipairs(entries) do
        local name = entry.id:match(":([^:]+)$") or entry.id
        io.write("  " .. name .. " ... ")

        local ok, err_obj = run_test(entry)

        if ok then
            io.print("ok")
            passed = passed + 1
        else
            io.print("FAILED")
            failed = failed + 1
            table.insert(failures, {id = entry.id, error = err_obj})
        end
    end

    local elapsed = time.now():sub(start):milliseconds()

    -- 失敗を表示
    if #failures > 0 then
        io.print("")
        io.print("Failures:")
        for _, f in ipairs(failures) do
            io.print("")
            io.print("  " .. f.id)
            io.print("  " .. tostring(f.error))
        end
    end

    -- サマリー
    io.print("")
    if failed > 0 then
        io.print("FAILED: " .. passed .. " passed, " .. failed .. " failed  " .. elapsed .. "ms")
        return 1
    else
        io.print("PASSED: " .. passed .. " tests  " .. elapsed .. "ms")
        return 0
    end
end

return { main = main }
```

## テストの実行

すべてのテストを実行：

```bash
wippy run app:test_runner app:terminal
```

パターンでテストをフィルタ：

```bash
# "errors"を含むテストを実行
wippy run app:test_runner app:terminal -- errors

# "channel"または"time"を含むテストを実行
wippy run app:test_runner app:terminal -- channel time
```

ランナーは`entry.id:find(pattern, 1, true)`を使用してテストエントリIDとパターンをマッチングします。

## テスト出力例

```
  Running Tests

  12 tests in 3 suites

  ● errors (9) 9/9  15ms
  ● channel (8) 8/8  23ms
  ● time (6) 5/6  12ms
      ✗ parse_invalid

  Failures

    app.test.time:parse_invalid
    assertion failed: expected error, got nil

  FAILED  [████████████████████░]

  22 passed  1 failed  50ms
```

## テストパターン

**チャネル操作：**

```lua
local function main()
    local ch = channel.new(1)
    ch:send("hello")
    local val, ok = ch:receive()
    assert.eq(val, "hello", "received correct value")
    assert.eq(ok, true, "receive ok is true")
    return true
end
```

**関数呼び出し：**

```lua
local function main()
    local result, err = funcs.call("app.test.funcs:echo", "test input")
    assert.is_nil(err, "call echo no error")
    assert.eq(result.ok, true, "echo result ok")
    assert.eq(result.echo, "test input", "echo result has input")
    return true
end
```

**レジストリクエリ：**

```lua
local function main()
    local entries, err = registry.find({kind = "function.lua"})
    assert.is_nil(err, "find by kind no error")
    assert.not_nil(entries, "find returns entries")
    assert.ok(#entries > 0, "find has results")

    for _, entry in ipairs(entries) do
        assert.not_nil(entry.id, "entry has id")
        assert.eq(type(entry.id), "string", "id is string")
    end

    return true
end
```

## プロジェクト構造

```
myapp/
├── tests/
│   ├── lib/
│   │   ├── _index.yaml        # アサートライブラリ登録
│   │   └── assert.lua         # アサーション関数
│   ├── test/
│   │   ├── errors/
│   │   │   ├── _index.yaml    # エラーテストメタデータ
│   │   │   ├── new.lua        # エラー作成のテスト
│   │   │   ├── patterns.lua   # エラーパターンのテスト
│   │   │   └── wrap.lua       # エラーラッピングのテスト
│   │   ├── channel/
│   │   │   ├── _index.yaml    # チャネルテストメタデータ
│   │   │   ├── basic.lua      # 基本操作のテスト
│   │   │   └── buffered.lua   # バッファ付きチャネルのテスト
│   │   └── ...
│   ├── _index.yaml            # テストランナー登録
│   └── runner.lua             # テストランナー実装
└── src/
    └── ...                     # アプリケーションコード
```

## ポイント

1. テストはレジストリエントリの`meta.type = "test"`で発見される
2. テスト関数は`true`を返すかエラーをスローする必要がある
3. `meta.suite`を使用して関連テストをグループ化
4. `meta.order`を使用してスイート内の実行順序を制御
5. `(result, error)`の戻りパターンで成功パスとエラーパスの両方をテスト
6. コマンドライン引数としてパターンを渡してテストをフィルタ
7. テストランナーは`registry.find()`と`funcs.call()`を使用してテストを実行

## 次のステップ

- [エラー処理](lua-errors.md) - エラーパターンとアサーション
- [レジストリ](lua-registry.md) - レジストリクエリとフィルタリング
- [関数](concept-functions.md) - 関数呼び出しと実行

