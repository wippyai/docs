---
title: "コントラクト"
description: "<secondary-label ref='function'/ <secondary-label ref='process'/ <secondary-label ref='workflow'/ <secondary-label ref='permissions'/"
---

# コントラクト
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>
<secondary-label ref="permissions"/>

型付きコントラクトを通じてサービスを呼び出し。スキーマ検証と非同期実行サポート付きでリモートAPI、ワークフロー、関数を呼び出し。

## ロード

```lua
local contract = require("contract")
```

## バインディングを開く

IDで直接バインディングを開く：

```lua
local greeter, err = contract.open("app.services:greeter")
if err then
    return nil, err
end

local result, err = greeter:say_hello("Alice")
if err then
    return nil, err
end
```

スコープコンテキストまたはクエリパラメータ付き：

```lua
-- With scope table
local svc, err = contract.open("app.services:user", {
    tenant_id = "acme",
    region = "us-east"
})

-- With query parameters (auto-converted: "true"→bool, numbers→int/float)
local api, err = contract.open("app.services:api?debug=true&timeout=5000")

-- With call options (third argument)
local inst, err = contract.open("app.services:flaky", nil, {
    retry = { max_attempts = 5, initial_delay = 100 }
})
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `binding_id` | string | バインディングID、クエリパラメータをサポート |
| `scope` | table | コンテキスト値（オプション、クエリパラメータをオーバーライド） |
| `options` | table | 呼び出しオプション（オプション）— 例: `retry.max_attempts`, `retry.initial_delay` |

**戻り値:** `Instance, error`

## コントラクトを取得

イントロスペクション用のコントラクト定義を取得：

```lua
local c, err = contract.get("app.services:greeter")
if err then
    return nil, err
end

print(c:id())  -- "app.services:greeter"

local methods = c:methods()
for _, m in ipairs(methods) do
    print(m.name, m.description)
end

local method, err = c:method("say_hello")
if err then
    return nil, err
end
```

### メソッド定義

| フィールド | 型 | 説明 |
|-------|------|-------------|
| `name` | string | メソッド名 |
| `description` | string | メソッドの説明 |
| `input_schemas` | table[] | 入力スキーマ定義 |
| `output_schemas` | table[] | 出力スキーマ定義 |

## 実装を検索

コントラクトを実装するすべてのバインディングをリスト：

```lua
local bindings, err = contract.find_implementations("app.services:greeter")
if err then
    return nil, err
end

for _, binding_id in ipairs(bindings) do
    print(binding_id)
end
```

またはコントラクトオブジェクト経由：

```lua
local c, err = contract.get("app.services:greeter")
if err then
    return nil, err
end
local bindings, err = c:implementations()
if err then
    return nil, err
end
```

## 実装をチェック

インスタンスがコントラクトを実装しているかチェック：

```lua
if contract.is(instance, "app.services:greeter") then
    instance:say_hello("World")
end
```

## メソッドの呼び出し

同期呼び出し - 完了までブロック：

```lua
local calc, err = contract.open("app.services:calculator")
if err then
    return nil, err
end

local sum, err = calc:add(10, 20)
if err then
    return nil, err
end
local product, err = calc:multiply(5, 6)
if err then
    return nil, err
end
```

## 非同期呼び出し

非同期実行には`_async`サフィックスを追加：

```lua
local processor, err = contract.open("app.services:processor")
if err then
    return nil, err
end

local future, err = processor:process_async(large_dataset)
if err then
    return nil, err
end

-- Do other work...

-- Wait for result
local ch = future:response()
local _, open = ch:receive()
if not open then
    return nil, errors.new("future response channel closed")
end

local payload, result_err = future:result()
if result_err then return nil, result_err end
local result, data_err = payload:data()
if data_err then return nil, data_err end
```

Futureメソッドについては[Future](./future.md)を参照。

## コントラクト経由で開く

コントラクトオブジェクトを通じてバインディングを開く：

```lua
local c, err = contract.get("app.services:user")
if err then
    return nil, err
end

-- Default binding
local instance, err = c:open()

-- Specific binding
local instance, err = c:open("app.services:user_impl")

-- With scope
local instance, err = c:open(nil, {user_id = 123})
local instance, err = c:open("app.services:user_impl", {user_id = 123})
```

## コンテキストを追加

事前設定されたコンテキスト付きラッパーを作成：

```lua
local ctx = require("ctx")
local c, err = contract.get("app.services:user")
if err then return nil, err end

local request_id, ctx_err = ctx.get("request_id")
if ctx_err then return nil, ctx_err end

local wrapped, err = c:with_context({
    request_id = request_id,
    user_id = current_user.id
})
if err then return nil, err end

local instance, err = wrapped:open()
```

## 呼び出しオプション

`with_options` でリトライおよびその他の呼び出し動作を構成します:

```lua
local c, err = contract.get("app.services:flaky")
if err then return nil, err end

local configured = c:with_options({
    retry = { max_attempts = 5, initial_delay = 100 }
})
local inst, err = configured:open("app.services:flaky_impl")
if err then return nil, err end

local result, err = inst:call()
```

オプションは返されるインスタンスのすべてのメソッド呼び出しに適用されます。リトライ可能なエラーのみがリトライをトリガーします。リトライ不可能なエラーは即座に返されます。`with_context`、`with_actor`、`with_scope` とチェーン可能です。

| オプション | 型 | 説明 |
|--------|------|-------------|
| `retry.max_attempts` | int | 最初を含む最大試行回数 (1 はリトライを無効化) |
| `retry.initial_delay` | int/duration | 最初のリトライ前の遅延（ミリ秒または duration 文字列） |

## セキュリティコンテキスト

認可用のアクターとスコープを設定：

```lua
local security = require("security")
local c, err = contract.get("app.services:admin")
if err then return nil, err end

local secured, err = c:with_actor(security.actor())
if err then return nil, err end

secured, err = secured:with_scope(security.scope())
if err then return nil, err end

local admin, err = secured:open()
if err then return nil, err end
```

明示的な`with_actor`/`with_scope`がない場合、開かれたコントラクトは呼び出し元のアンビエントなアクターとスコープを継承します。設定した場合、それらはバインドされた実装関数に伝播します — インスタンスに対するすべてのメソッド呼び出しがそのアイデンティティのもとで実行されます。

## 権限

| 権限 | リソース | 関数 |
|------------|----------|-----------|
| `contract.get` | contract id | `get()` |
| `contract.open` | binding id | `open()`、`Contract:open()` |
| `contract.implementations` | contract id | `find_implementations()`、`Contract:implementations()` |
| `contract.call` | method name | 同期および非同期メソッド呼び出し |
| `contract.context` | "context" | `Contract:with_context()` |
| `contract.security` | "security" | `Contract:with_actor()`、`Contract:with_scope()` |

## エラー

| 条件 | 種別 |
|-----------|------|
| 無効なバインディングIDフォーマット | `errors.INVALID` |
| コントラクトが見つからない | `errors.NOT_FOUND` |
| バインディングが見つからない | `errors.NOT_FOUND` |
| メソッドが見つからない | `errors.NOT_FOUND` |
| デフォルトバインディングがない | `errors.NOT_FOUND` |
| 権限拒否 | `errors.PERMISSION_DENIED` |
| 呼び出し失敗 | `errors.INTERNAL` |
