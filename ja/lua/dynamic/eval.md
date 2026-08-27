---
title: "動的評価"
description: "設定したモジュールおよびレジストリアクセスを使って、式または能力を制限した Lua コードを評価します。"
---

# 動的評価

Wippy は、実行時に提供されたコード向けに、式評価と能力を制限した Lua 実行を提供します。このページは API ガイドです。例は既存の Wippy Lua プロセス内で動作し、呼び出し側のエントリが使用するモジュールを宣言しているものとします。レジストリ ID、ポリシー、アプリケーションデータは周囲のアプリケーションが提供するプレースホルダーです。

`eval_runner` は評価対象コードが到達できる Wippy モジュールを制限しますが、敵対的コードを完全には封じ込めません。特に `limits.max_steps` が数えるのは Lua 命令ではなくスケジューラーの再開回数です。yield しない無限ループはこの制限では中断されません。

## 評価システムの選択

Wippyは2つの評価システムを提供しています:

| システム | 目的 | ユースケース |
|--------|---------|----------|
| `expr` | 式評価 | 設定、テンプレート、シンプルな計算 |
| `eval_runner` | 能力を制限した Lua 実行 | 信頼できるプラグインと制御された動的コード |

## `expr` による式評価

`expr` モジュールは expr-lang 構文の式を評価します。完全な Lua プログラムではなく式に使用してください。完全な Lua API と構文のリファレンスは[式言語](./expression.md)です。

```lua
local expr = require("expr")

local result, err = expr.eval("x + y * 2", {x = 10, y = 5})
if err then
    return nil, err
end
-- result = 20
```

### コンパイル済み式の再利用

一度コンパイルして何度も実行:

```lua
local program, err = expr.compile("price * quantity")
if err then
    return nil, err
end

local total1, first_err = program:run({price = 10, quantity = 5})
if first_err then
    return nil, first_err
end

local total2, second_err = program:run({price = 20, quantity = 3})
if second_err then
    return nil, second_err
end
```

### 構文の概要

| 機能 | 式 | 結果 |
|---------|------------|--------|
| 算術 | `1 + 2 * 3` | `7` |
| 剰余 | `10 % 3` | `1` |
| 比較 | `{x = 10}` で `x > 5` | `true` |
| 真偽値 | `{a = true, b = false}` で `a && b` | `false` |
| 三項演算子 | `{x = 5}` で `x > 0 ? 'positive' : 'negative'` | `"positive"` |
| 関数 | `max(1, 5, 3)` | `5` |
| 配列インデックス | `[1, 2, 3][0]` | `1` |
| 連結 | `'hello' + ' ' + 'world'` | `"hello world"` |

## `eval_runner` による能力制限付き Lua

`eval_runner` モジュールは、設定されたモジュールおよびレジストリアクセスで Lua を実行します。

```lua
local runner = require("eval_runner")

local result, err = runner.run({
    source = [[
        local function double(x)
            return x * 2
        end
        return { double = double }
    ]],
    method = "double",
    args = {21}
})
if err then
    return nil, err
end
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
| `limits` | table | 評価の実行制限 |

`modules` を省略するか空にすると、ホストは既定フィルターを通過するクラスを持つ利用可能な全モジュールを提供します。この暗黙モードでは `allow_classes` がフィルターを拡張し、指定したクラスのモジュールを追加できます。明示的な `modules` リストがある場合は、そうでなければ除外されるクラスを持つ、リスト内のモジュールだけを許可します。評価プログラムの能力が呼び出しから明確になるよう、明示的で最小限のリストを推奨します。

ランタイム v0.3.32a では、`eval.module` ポリシー検査の対象は `modules` に明示した名前であり、既定フィルターが暗黙に選んだモジュールではありません。暗黙の既定モジュールを `eval.module` ポリシーで除外できると考えず、明示的なリストを渡してください。

### ステップ制限

`limits.max_steps` で評価中のスケジューラー再開回数を制限します。

```lua
local result, err = runner.run({
    source = user_code,
    modules = {"json"},
    limits = {max_steps = 1000}
})
if err then
    return nil, err
end
```

`max_steps` は 0 以上の整数でなければなりません。省略すると `lua.eval.max_steps`（既定値 `10000`）を継承し、明示的な `0` で制限を解除します。モジュール呼び出しによる yield など、スケジューラーが再開するたびに 1 ステップを消費します。通常の Lua ループ反復は消費しないため、yield しないコードに対する CPU または命令予算ではありません。

未知の `limits` フィールド、テーブル以外の `limits` 値、無効な `max_steps` 値は、再試行不可の `errors.INVALID` を返します。

### モジュールアクセス

許可されるモジュールをホワイトリスト化:

```lua
local encoded, err = runner.run({
    source = [[
        local json = require("json")
        return json.encode({hello = "world"})
    ]],
    modules = {"json"}
})
if err then
    return nil, err
end
```

明示的なリストがある場合、リスト外のモジュールは require できません。リスト内の各モジュールには `eval.module` 権限も必要です。

### レジストリインポート

レジストリからエントリをインポート:

```lua
local result, err = runner.run({
    source = [[
        local data = ...
        return utils.format(data)
    ]],
    imports = {
        utils = "app.lib:utilities"
    },
    args = {{key = "value"}}
})
if err then
    return nil, err
end
```

### 特権インポート

インポートには、eval対象のコード自体からは見えないモジュールを付与できます。`id`と`modules`を持つテーブル形式を使用します：

```lua
local quote, err = runner.run({
    source = [[
        return pricing.quote(...)
    ]],
    modules = {"json"},
    imports = {
        pricing = { id = "app.lib:pricing", modules = {"funcs"} }
    },
})
if err then
    return nil, err
end
```

`pricing`ライブラリは`funcs`が利用可能な独自のスコープ付き環境で実行されます。eval対象のソースは`funcs`を直接requireしたり到達したりできません。インポートにモジュールを付与するには、呼び出し元がそのモジュールに対する`eval.module`権限を保持している必要があります — 呼び出し元自身に許可されている範囲を超えてケイパビリティを委譲することはできません。

### カスタムモジュール

カスタムテーブルを注入します:

```lua
local version, err = runner.run({
    source = [[
        return sdk.version
    ]],
    custom_modules = {
        sdk = {version = "1.0.0"}
    }
})
if err then
    return nil, err
end
```

カスタムモジュールの値は評価対象コードから直接到達できます。そのコードへの開示を意図していないシークレットや特権ハンドルを、これらのテーブルに入れないでください。

### コンテキスト値

`ctx`としてアクセス可能なデータを渡す:

```lua
local greeting, err = runner.run({
    source = [[
        local user, ctx_err = ctx.get("user")
        if ctx_err then error(ctx_err) end
        return "Hello, " .. user
    ]],
    modules = {"ctx"},
    context = {user = "Alice"}
})
if err then
    return nil, err
end
```

### プログラムのコンパイル

`runner.compile` はソースを検証し、実行せずにそのエントリポイントとモジュールを報告します:

```lua
local program, err = runner.compile([[
    local function process(x)
        return x * 2
    end
    return { process = process }
]], "process", {modules = {"json"}})
if err then
    return nil, err
end

program:method()   -- "process"  (string)
program:modules()  -- {"json"}    (string[])
```

コンパイル済みプログラムは情報提供用です。実行するには、ソースとメソッドを指定して `runner.run` を呼び出します。

## 能力制御

### モジュールクラス

モジュールは機能によって分類:

| クラス | 説明 | デフォルト |
|-------|-------------|---------|
| `deterministic` | 純粋関数 | 許可 |
| `encoding` | データエンコーディング | 許可 |
| `time` | 時間操作 | 許可 |
| `nondeterministic` | ランダムなど | 許可 |
| `io` | 個別にブロックされるクラスを持たない入出力操作 | 許可 |
| `security` | セキュリティヘルパー | 許可 |
| `workflow` | ワークフローで安全な操作 | 許可 |
| `process` | spawn、レジストリ | ブロック |
| `storage` | ファイル、データベース | ブロック |
| `network` | HTTP、ソケット | ブロック |

「ブロック」は、呼び出し側がブロック対象クラスを `allow_classes` に指定し、その `eval.class` リソースを認可されていない限りブロックされる、という意味です。1 つのモジュールが複数クラスに属する場合、そのモジュールが持つブロック対象クラスをすべて列挙してください。

### ブロックされたクラスの有効化

```lua
local status, err = runner.run({
    source = [[
        local http = require("http_client")
        local response, err = http.get("https://api.example.com")
        if err then error(err) end
        return response.status_code
    ]],
    modules = {"http_client"},
    allow_classes = {"network"}
})
if err then
    return nil, err
end
```

クラスの認可は、評価環境へのモジュール導入だけを許可します。モジュール自身のセキュリティ検査と外部アクセス制御は引き続き適用されます。

### 権限チェック

システムは以下の権限をチェック:

- `eval.compile` - コンパイル前
- `eval.run` - 実行前
- `eval.module` - ホワイトリスト内の各モジュール、および特権インポートに付与された各モジュール
- `eval.import` - 各レジストリインポート
- `eval.class` - 各許可されたクラス

これらはセキュリティポリシーで設定します。

## コンパイルキャッシュ

コンパイル済みプログラムは、ソース、メソッド、モジュール、許可クラスをキーとする LRU にキャッシュされます。同一コードの繰り返し実行では再コンパイルを省略します。インポート、カスタムモジュール、引数、コンテキストは実行時にバインドされ、キャッシュキーには影響しません。

```yaml
# .wippy.yaml
lua:
  eval:
    cache_size: 256   # entries; 0 or less disables caching (default: 256)
    cache_ttl: 0      # expiry; 0 = no expiry (default: 0)
    max_steps: 10000  # inherited run limit; 0 = unlimited (default: 10000)
```

## エラー処理

```lua
local result, err = runner.run(run_config)
if err then
    if err:kind() == errors.PERMISSION_DENIED then
        -- Access denied by security policy
    elseif err:kind() == errors.INVALID then
        -- Missing source or invalid limits configuration
    elseif err:kind() == errors.INTERNAL then
        -- Syntax, compilation, import, or execution failure
    end
end
```

ここで `run_config` は、周囲のアプリケーションが組み立てた設定テーブルです。

## ユースケースによる選択

### プラグイン

```lua
local plugins, find_err = registry.find({["meta.type"] = "plugin"})
if find_err then
    return nil, find_err
end

for _, plugin in ipairs(plugins) do
    local _, run_err = runner.run({
        source = plugin.data.source,
        method = "init",
        modules = {"json", "time"},
        context = {config = app_config}
    })
    if run_err then
        return nil, run_err
    end
end
```

この部分的なパターンは、呼び出し側が `registry` と `eval_runner` を読み込み、`app_config` が定義済みで、一致するレジストリエントリが `data.source` に Lua ソースを格納していることを前提とします。`registry.find` はエントリテーブルを返すため、フィールドはエントリメソッドではなく `plugin.data` として読み取ります。

### 繰り返しルール

```lua
local compiled, compile_err = expr.compile("score >= minimum")
if compile_err then
    return nil, compile_err
end

for _, candidate in ipairs(candidates) do
    local accepted, run_err = compiled:run({
        score = candidate.score,
        minimum = 80
    })
    if run_err then
        return nil, run_err
    end
    candidate.accepted = accepted
end
```

この部分的なパターンは `candidates` がアプリケーションから提供されることを前提とします。出力が描画テキストの場合は `expr` ではなく template モジュールを使用してください。

### ユーザースクリプト

```lua
local result, err = runner.run({
    source = user_code, -- Supplied by the surrounding application
    modules = {"json", "text"},
    context = {data = input_data}
})
if err then
    return nil, err
end
```

これは部分的な統合パターンであり、敵対的コード向けのサンドボックスではありません。`user_code` を提供できる主体を検証し、必要なモジュールとポリシーだけを付与してください。信頼できないコードが yield しない可能性がある場合は、外部タイムアウトまたは隔離境界を適用します。

## 関連項目

- [式言語](./expression.md) - 式言語リファレンス
- [コマンド実行](./exec.md) - システムコマンド実行
- [セキュリティ](../security/security.md) - セキュリティポリシー
