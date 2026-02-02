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
```

スコープコンテキストまたはクエリパラメータ付き：

```lua
-- スコープテーブル付き
local svc, err = contract.open("app.services:user", {
    tenant_id = "acme",
    region = "us-east"
})

-- クエリパラメータ付き（自動変換: "true"→bool, numbers→int/float）
local api, err = contract.open("app.services:api?debug=true&timeout=5000")
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `binding_id` | string | バインディングID、クエリパラメータをサポート |
| `scope` | table | コンテキスト値（オプション、クエリパラメータをオーバーライド） |

**戻り値:** `Instance, error`

## コントラクトを取得

イントロスペクション用のコントラクト定義を取得：

```lua
local c, err = contract.get("app.services:greeter")

print(c:id())  -- "app.services:greeter"

local methods = c:methods()
for _, m in ipairs(methods) do
    print(m.name, m.description)
end

local method, err = c:method("say_hello")
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

for _, binding_id in ipairs(bindings) do
    print(binding_id)
end
```

またはコントラクトオブジェクト経由：

```lua
local c, err = contract.get("app.services:greeter")
local bindings, err = c:implementations()
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

local sum, err = calc:add(10, 20)
local product, err = calc:multiply(5, 6)
```

## 非同期呼び出し

非同期実行には`_async`サフィックスを追加：

```lua
local processor, err = contract.open("app.services:processor")

local future, err = processor:process_async(large_dataset)

-- 他の処理を実行...

-- 結果を待機
local ch = future:response()
local payload, ok = ch:receive()
if ok then
    local result = payload:data()
end
```

Futureメソッドについては[Future](lua/core/future.md)を参照。

## コントラクト経由で開く

コントラクトオブジェクトを通じてバインディングを開く：

```lua
local c, err = contract.get("app.services:user")

-- デフォルトバインディング
local instance, err = c:open()

-- 特定のバインディング
local instance, err = c:open("app.services:user_impl")

-- スコープ付き
local instance, err = c:open(nil, {user_id = 123})
local instance, err = c:open("app.services:user_impl", {user_id = 123})
```

## コンテキストを追加

事前設定されたコンテキスト付きラッパーを作成：

```lua
local c, err = contract.get("app.services:user")

local wrapped = c:with_context({
    request_id = ctx.get("request_id"),
    user_id = current_user.id
})

local instance, err = wrapped:open()
```

## セキュリティコンテキスト

認可用のアクターとスコープを設定：

```lua
local security = require("security")
local c, err = contract.get("app.services:admin")

local secured = c:with_actor(security.actor()):with_scope(security.scope())

local admin, err = secured:open()
```

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

