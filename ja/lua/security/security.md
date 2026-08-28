---
title: "セキュリティ & アクセス制御"
description: "現在のアクターとスコープの確認、ポリシー評価、認証トークン管理を行います。"
---

# セキュリティ & アクセス制御
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="permissions"/>

`security`モジュールは、認証アクター、認可スコープ、ポリシー、トークンストアを公開します。このページは、部分的な認可レシピを含むAPIリファレンスです。レジストリID、アクター、リクエストメタデータ、トークン値、`user`や`doc`などのアプリケーションオブジェクト、`show_admin_features`などのコールバックは周囲のアプリケーションから渡されます。例は完全な認証デプロイではありません。

Wippyはデフォルトで厳格なセキュリティモードで動作します。実行エントリでは`security`を有効にし、アクターとスコープを設定して、呼び出す操作を正確に認可する必要があります。特に、アクター作成とスコープ変更には`security.actor.create`または`security.scope.create`、レジストリ検索には`security.policy.get`または`security.policy_group.get`、トークン操作には`security.token_store.get`と操作固有のトークン権限が必要です。`new_actor`、`new_scope`、`scope:with`、`scope:without`、権限拒否となる`token_store`取得は、構造化`error`を返さずLuaエラーを発生させます。拒否後の復旧を試みるのではなく、これらの前提条件をエントリのセキュリティコンテキストで付与してください。設定については[セキュリティモデル](system/security.md)を参照してください。

## ロード

```lua
local security = require("security")
```

## `actor`

実行コンテキストから現在のセキュリティアクターを返します。

```lua
local actor = security.actor()
if actor then
    local id = actor:id()
    local meta = actor:meta()
    -- Use only the fields required for authorization or application logic.
    local role = meta.role
end
```

アクターのメタデータには識別子や個人データが含まれる場合があります。メタデータテーブル全体をログに記録せず、シークレットを格納しないでください。

**戻り値:** `Actor|nil`

## `scope`

実行コンテキストから現在のセキュリティスコープを返します。

```lua
local scope = security.scope()
if scope then
    local policies = scope:policies()
    for _, policy in ipairs(policies) do
        print("Active policy:", policy:id())
    end
end
```

**戻り値:** `Scope|nil`

## `can`

現在のコンテキストがリソースに対するアクションを許可するかチェックします。

```lua
-- Check read permission
if not security.can("read", "user:" .. user_id) then
    return nil, errors.new({
        message = "Cannot read user data",
        kind = errors.PERMISSION_DENIED
    })
end

-- Check write permission
if not security.can("write", "order:" .. order_id) then
    return nil, errors.new({
        message = "Cannot modify order",
        kind = errors.PERMISSION_DENIED
    })
end

-- Check with metadata
local allowed = security.can("delete", "document:" .. doc_id, {
    owner_id = doc.owner_id,
    department = doc.department
})
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `action` | string | チェックするアクション |
| `resource` | string | リソース識別子 |
| `meta` | table | 追加メタデータ（オプション） |

**戻り値:** `boolean`

## `new_actor`

IDとメタデータで新しいアクターを作成します。

```lua
-- Create user actor
local actor = security.new_actor("user:" .. user.id, {
    role = user.role,
    department = user.department,
    email = user.email
})

-- Create service actor
local service_actor = security.new_actor("service:payment-processor", {
    type = "service",
    version = "1.0.0"
})
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `id` | string | 一意のアクター識別子 |
| `meta` | table | メタデータのキーバリューペア |

**戻り値:** `Actor`

## `new_scope`

新しいカスタムスコープを作成します。

```lua
-- Empty scope
local scope = security.new_scope()

-- Scope with policies
local read_policy, read_err = security.policy("app:read-only")
if read_err then
    return nil, read_err
end
local scope = security.new_scope({read_policy})

-- Build scope incrementally
local scope = security.new_scope()
local policy1, policy1_err = security.policy("app:read")
if policy1_err then
    return nil, policy1_err
end
local policy2, policy2_err = security.policy("app:write")
if policy2_err then
    return nil, policy2_err
end
scope = scope:with(policy1):with(policy2)
```

上記の各選択肢は、それぞれ独立した構築パターンです。`new_scope`と`scope:with`は、コンテキストがない場合や権限が拒否された場合にエラーを発生させます。これらの確認では`nil, error`を返しません。

**戻り値:** `Scope`

## `policy`

レジストリからポリシーを取得します。

```lua
local policy, err = security.policy("app:admin-access")
if err then
    return nil, err
end

-- Evaluate policy
local result = policy:evaluate(actor, "delete", "user:123")
if result == "allow" then
    -- permitted
elseif result == "deny" then
    -- forbidden
else
    -- undefined, check other policies
end
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `id` | string | ポリシーID "namespace:name" |

**戻り値:** `Policy, error`

## `named_scope`

事前定義されたポリシーグループを取得します。

```lua
-- Get admin scope
local admin_scope, err = security.named_scope("app:admin")
if err then
    return nil, err
end

-- Use for elevated operations
local result = admin_scope:evaluate(actor, "delete", "user:123")
```

スコープを読み込んでも、現在の実行コンテキストの権限は昇格しません。明示的な評価、またはスコープを受け取るAPIへ渡す値が生成されるだけです。呼び出し側には、保護された操作を実行する権限が引き続き必要です。

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `id` | string | ポリシーグループID |

**戻り値:** `Scope, error`

## `token_store`

認証トークンを管理するためのトークンストアを取得します。

```lua
local store, err = security.token_store("app:tokens")
if err then
    return nil, err
end

-- Use store...
return store:close()
```

取得したトークンストアは`close()`を呼ぶまで呼び出し側が所有します。最後の操作後、確認済みの成功経路とエラー経路のすべてで閉じてください。複数回閉じても安全です。取得時の権限拒否はLuaエラーを発生させますが、検索エラーとリソースエラーは`nil, error`を返します。

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `id` | string | トークンストアID "namespace:name" |

**戻り値:** `TokenStore, error`

## `Actor`メソッド

| メソッド | 戻り値 | 説明 |
|--------|---------|-------------|
| `actor:id()` | string | アクター識別子 |
| `actor:meta()` | table | アクターメタデータ |

## `Scope`メソッド

### `with` / `without`

スコープにポリシーを追加または削除します。

```lua
local scope = security.new_scope()

-- Add policy
local write_policy, err = security.policy("app:write")
if err then
    return nil, err
end
scope = scope:with(write_policy)

-- Remove policy
scope = scope:without("app:read-only")
```

`with`と`without`は新しい不変のスコープ値を返します。`with`または`without`リソースに対して`security.scope.create`が許可されていない場合はエラーを発生させます。

### `evaluate`

スコープ内のすべてのポリシーを評価します。

```lua
local result = scope:evaluate(actor, "read", "document:123")
-- "allow", "deny", or "undefined"

if result ~= "allow" then
    return nil, errors.new({
        message = "Access denied",
        kind = errors.PERMISSION_DENIED
    })
end
```

### `contains`

スコープにポリシーが含まれているかチェックします。

```lua
if scope:contains("app:admin") then
    show_admin_features()
end
```

### `policies`

スコープ内のすべてのポリシーを返します。

```lua
local policies = scope:policies()
for _, policy in ipairs(policies) do
    print(policy:id())
end
```

**戻り値:** `Policy[]`

## `Policy`メソッド

| メソッド | 戻り値 | 説明 |
|--------|---------|-------------|
| `policy:id()` | string | ポリシー識別子 |
| `policy:evaluate(actor, action, resource, meta?)` | string | `"allow"`、`"deny"`、または`"undefined"` |

## `TokenStore`メソッド

### `create`

認証トークンを作成します。

```lua
local actor = security.new_actor("user:123", {role = "user"})
local scope, scope_err = security.named_scope("app:default")
if scope_err then
    return nil, scope_err
end
local store, store_err = security.token_store("app:tokens")
if store_err then
    return nil, store_err
end

local token, err = store:create(actor, scope, {
    expiration = "24h",  -- or milliseconds
    meta = {
        login_ip = request_ip,
        user_agent = user_agent
    }
})
store:close()
if err then
    return nil, err
end
return token
```

`request_ip`と`user_agent`は、アプリケーションから渡されるリクエスト値です。セキュリティ上の判断に必要なメタデータだけを保存し、保持期限を適用してください。返されたBearerトークンを、意図した認証情報ストアの外でログ記録または永続化しないでください。

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `actor` | Actor | トークン用のアクター |
| `scope` | Scope | 権限スコープ |
| `options.expiration` | string/number | 期間文字列またはms |
| `options.meta` | table | トークンメタデータ |

**戻り値:** `string, error`

### `validate`

トークンを検証してアクター/スコープを取得します。

```lua
local actor, scope, err = store:validate(token)
store:close()
if err then
    return nil, err
end
```

ここ、および以下では、`store`は所有中の有効なハンドルであり、`token`は呼び出し側から渡される信頼できないBearer認証情報です。検証または失効時のエラーを含め、トークンをログに記録しないでください。

**戻り値:** `Actor, Scope, error`

### `revoke`

トークンを無効化します。

```lua
local ok, err = store:revoke(token)
store:close()
if err then
    return nil, err
end
```

**戻り値:** `boolean, error`

### `close`

トークンストアリソースを解放します。

```lua
store:close()
```

**戻り値:** `boolean`

## 権限

セキュリティ操作はセキュリティポリシー評価の対象です。

### セキュリティアクション

| アクション | リソース | 説明 |
|--------|----------|-------------|
| `security.policy.get` | ポリシーID | ポリシー定義へのアクセス |
| `security.policy_group.get` | グループID | 名前付きスコープへのアクセス |
| `security.scope.create` | `custom` | `new_scope`でカスタムスコープを作成 |
| `security.scope.create` | `with` | `scope:with`でポリシーを追加 |
| `security.scope.create` | `without` | `scope:without`でポリシーを削除 |
| `security.actor.create` | アクターID | アクターの作成 |
| `security.token_store.get` | ストアID | トークンストアへのアクセス |
| `security.token.validate` | ストアID | トークンの検証 |
| `security.token.create` | ストアID | トークンの作成 |
| `security.token.revoke` | ストアID | トークンの取り消し |

ポリシー設定については、[セキュリティモデル](system/security.md)を参照してください。

## エラー

| 条件 | 種別 | 再試行可能 |
|-----------|------|-----------|
| コンテキストなし | `errors.INTERNAL` | いいえ |
| 空のトークンストアID | `errors.INVALID` | いいえ |
| ポリシー、名前付きスコープ、またはトークン操作の権限拒否 | `errors.INVALID` | いいえ |
| アクターまたはスコープの作成、スコープ変更、トークンストア取得の拒否 | Luaエラーを発生 | いいえ |
| ポリシーが見つからない | `errors.INTERNAL` | いいえ |
| トークンストアが見つからない | `errors.INTERNAL` | いいえ |
| トークンストアがクローズ済み | `errors.INTERNAL` | いいえ |
| 無効な有効期限フォーマット | `errors.INVALID` | いいえ |
| トークン検証失敗 | `errors.INTERNAL` | いいえ |

```lua
local store, err = security.token_store("app:tokens")
if err then
    if errors.is(err, errors.INVALID) then
        print("Invalid request:", err:message())
    end
    return nil, err
end
store:close()
```

エラーの扱いについては、[エラー処理](lua/core/errors.md)を参照してください。

## 関連項目

- [セキュリティモデル](../../system/security.md) - アクター、ポリシー、スコープの設定
- [HTTPミドルウェア](http/middleware.md) - エンドポイントとリソースファイアウォール
