# 動的評価

サンドボックス環境と制御されたモジュールアクセスでコードを実行時に動的に実行。

## 2つのシステム

Wippyは2つの評価システムを提供:

| システム | 目的 | ユースケース |
|--------|---------|----------|
| `expr` | 式評価 | 設定、テンプレート、シンプルな計算 |
| `eval_runner` | 完全なLua実行 | プラグイン、ユーザースクリプト、動的コード |

## exprモジュール

expr-lang構文を使用した軽量な式評価。

```lua
local expr = require("expr")

local result, err = expr.eval("x + y * 2", {x = 10, y = 5})
-- result = 20
```

### 式のコンパイル

一度コンパイルして何度も実行:

```lua
local program, err = expr.compile("price * quantity")

local total1 = program:run({price = 10, quantity = 5})
local total2 = program:run({price = 20, quantity = 3})
```

### サポートされる構文

```lua
-- 算術
expr.eval("1 + 2 * 3")           -- 7
expr.eval("10 / 2 - 1")          -- 4
expr.eval("10 % 3")              -- 1

-- 比較
expr.eval("x > 5", {x = 10})     -- true
expr.eval("x == y", {x = 1, y = 1}) -- true

-- ブール
expr.eval("a && b", {a = true, b = false})  -- false
expr.eval("a || b", {a = true, b = false})  -- true
expr.eval("!a", {a = false})     -- true

-- 三項演算子
expr.eval("x > 0 ? 'positive' : 'negative'", {x = 5})

-- 関数
expr.eval("max(1, 5, 3)")        -- 5
expr.eval("min(1, 5, 3)")        -- 1
expr.eval("len([1, 2, 3])")      -- 3

-- 配列
expr.eval("[1, 2, 3][0]")        -- 1

-- 文字列連結
expr.eval("'hello' + ' ' + 'world'")
```

## eval_runnerモジュール

セキュリティ制御付きの完全なLua実行。

```lua
local runner = require("eval_runner")

local result, err = runner.run({
    source = [[
        local function double(x)
            return x * 2
        end
        return double(input)
    ]],
    args = {21}
})
-- result = 42
```

### 設定

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `source` | string | Luaソースコード（必須） |
| `method` | string | 返されたテーブル内で呼び出す関数 |
| `args` | any[] | 関数に渡す引数 |
| `modules` | string[] | 許可される組み込みモジュール |
| `imports` | table | インポートするレジストリエントリ |
| `context` | table | `ctx`として利用可能な値 |
| `allow_classes` | string[] | 追加のモジュールクラス |
| `custom_modules` | table | モジュールとしてのカスタムテーブル |

### モジュールアクセス

許可されるモジュールをホワイトリスト化:

```lua
runner.run({
    source = [[
        local json = require("json")
        return json.encode({hello = "world"})
    ]],
    modules = {"json"}
})
```

リストにないモジュールはrequireできない。

### レジストリインポート

レジストリからエントリをインポート:

```lua
runner.run({
    source = [[
        local utils = require("utils")
        return utils.format(data)
    ]],
    imports = {
        utils = "app.lib:utilities"
    },
    args = {{key = "value"}}
})
```

### カスタムモジュール

カスタムテーブルを注入:

```lua
runner.run({
    source = [[
        return sdk.version
    ]],
    custom_modules = {
        sdk = {version = "1.0.0", api_key = "xxx"}
    }
})
```

### コンテキスト値

`ctx`としてアクセス可能なデータを渡す:

```lua
runner.run({
    source = [[
        return "Hello, " .. ctx.user
    ]],
    context = {user = "Alice"}
})
```

### プログラムのコンパイル

繰り返しの実行のために一度コンパイル:

```lua
local program, err = runner.compile([[
    local function process(x)
        return x * 2
    end
    return { process = process }
]], "process", {modules = {"json"}})

local result = program:run({10})  -- 20
```

## セキュリティモデル

### モジュールクラス

モジュールは機能によって分類:

| クラス | 説明 | デフォルト |
|-------|-------------|---------|
| `deterministic` | 純粋関数 | 許可 |
| `encoding` | データエンコーディング | 許可 |
| `time` | 時間操作 | 許可 |
| `nondeterministic` | ランダムなど | 許可 |
| `process` | spawn、レジストリ | ブロック |
| `storage` | ファイル、データベース | ブロック |
| `network` | HTTP、ソケット | ブロック |

### ブロックされたクラスの有効化

```lua
runner.run({
    source = [[
        local http = require("http_client")
        return http.get("https://api.example.com")
    ]],
    modules = {"http_client"},
    allow_classes = {"network"}
})
```

### 権限チェック

システムは以下の権限をチェック:

- `eval.compile` - コンパイル前
- `eval.run` - 実行前
- `eval.module` - ホワイトリスト内の各モジュール
- `eval.import` - 各レジストリインポート
- `eval.class` - 各許可されたクラス

セキュリティポリシーで設定。

## エラー処理

```lua
local result, err = runner.run({...})
if err then
    if err:kind() == errors.PERMISSION_DENIED then
        -- セキュリティポリシーによりアクセス拒否
    elseif err:kind() == errors.INVALID then
        -- 無効なソースまたは設定
    elseif err:kind() == errors.INTERNAL then
        -- 実行またはコンパイルエラー
    end
end
```

## ユースケース

### プラグインシステム

```lua
local plugins = registry.find({meta = {type = "plugin"}})

for _, plugin in ipairs(plugins) do
    local source = plugin:data().source
    runner.run({
        source = source,
        method = "init",
        modules = {"json", "time"},
        context = {config = app_config}
    })
end
```

### テンプレート評価

```lua
local template = "Hello, {{name}}! You have {{count}} messages."
local compiled = expr.compile("name")

-- 高速な繰り返し評価
for _, user in ipairs(users) do
    local greeting = compiled:run({name = user.name})
end
```

### ユーザースクリプト

```lua
local user_code = request:body()

local result, err = runner.run({
    source = user_code,
    modules = {"json", "text"},  -- 安全なモジュールのみ
    context = {data = input_data}
})
```

## 関連項目

- [式言語](lua/dynamic/expression.md) - 式言語リファレンス
- [コマンド実行](lua/dynamic/exec.md) - システムコマンド実行
- [セキュリティ](lua/security/security.md) - セキュリティポリシー

