# セキュリティ & アクセス制御
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="permissions"/>

認証アクター、認可スコープ、アクセスポリシーを管理します。

## ロード

```lua
local security = require("security")
```

## actor

実行コンテキストから現在のセキュリティアクターを返します。

```lua
local actor = security.actor()
if actor then
    local id = actor:id()
    local meta = actor:meta()

    logger:info("Request from", {
        user_id = id,
        role = meta.role
    })
end
```

**戻り値:** `Actor|nil`

## scope

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

## can

現在のコンテキストがリソースに対するアクションを許可するかチェックします。

```lua
-- 読み取り権限をチェック
if not security.can("read", "user:" .. user_id) then
    return nil, errors.new("PERMISSION_DENIED", "Cannot read user data")
end

-- 書き込み権限をチェック
if not security.can("write", "order:" .. order_id) then
    return nil, errors.new("PERMISSION_DENIED", "Cannot modify order")
end

-- メタデータ付きでチェック
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

## new_actor

IDとメタデータで新しいアクターを作成します。

```lua
-- ユーザーアクターを作成
local actor = security.new_actor("user:" .. user.id, {
    role = user.role,
    department = user.department,
    email = user.email
})

-- サービスアクターを作成
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

## new_scope

新しいカスタムスコープを作成します。

```lua
-- 空のスコープ
local scope = security.new_scope()

-- ポリシー付きスコープ
local read_policy = security.policy("app:read-only")
local scope = security.new_scope({read_policy})

-- スコープを段階的に構築
local scope = security.new_scope()
local policy1 = security.policy("app:read")
local policy2 = security.policy("app:write")
scope = scope:with(policy1):with(policy2)
```

**戻り値:** `Scope`

## policy

レジストリからポリシーを取得します。

```lua
local policy, err = security.policy("app:admin-access")
if err then
    return nil, err
end

-- ポリシーを評価
local result = policy:evaluate(actor, "delete", "user:123")
if result == "allow" then
    -- 許可
elseif result == "deny" then
    -- 禁止
else
    -- 未定義、他のポリシーをチェック
end
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `id` | string | ポリシーID "namespace:name" |

**戻り値:** `Policy, error`

## named_scope

事前定義されたポリシーグループを取得します。

```lua
-- 管理者スコープを取得
local admin_scope, err = security.named_scope("app:admin")
if err then
    return nil, err
end

-- 昇格操作に使用
local result = admin_scope:evaluate(actor, "delete", "user:123")
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `id` | string | ポリシーグループID |

**戻り値:** `Scope, error`

## token_store

認証トークンを管理するためのトークンストアを取得します。

```lua
local store, err = security.token_store("app:tokens")
if err then
    return nil, err
end

-- ストアを使用...
store:close()
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `id` | string | トークンストアID "namespace:name" |

**戻り値:** `TokenStore, error`

## Actorメソッド

| メソッド | 戻り値 | 説明 |
|--------|---------|-------------|
| `actor:id()` | string | アクター識別子 |
| `actor:meta()` | table | アクターメタデータ |

## Scopeメソッド

### with / without

スコープにポリシーを追加または削除します。

```lua
local scope = security.new_scope()

-- ポリシーを追加
local write_policy = security.policy("app:write")
scope = scope:with(write_policy)

-- ポリシーを削除
scope = scope:without("app:read-only")
```

### evaluate

スコープ内のすべてのポリシーを評価します。

```lua
local result = scope:evaluate(actor, "read", "document:123")
-- "allow"、"deny"、または"undefined"

if result ~= "allow" then
    return nil, errors.new("PERMISSION_DENIED", "Access denied")
end
```

### contains

スコープにポリシーが含まれているかチェックします。

```lua
if scope:contains("app:admin") then
    show_admin_features()
end
```

### policies

スコープ内のすべてのポリシーを返します。

```lua
local policies = scope:policies()
for _, policy in ipairs(policies) do
    print(policy:id())
end
```

**戻り値:** `Policy[]`

## Policyメソッド

| メソッド | 戻り値 | 説明 |
|--------|---------|-------------|
| `policy:id()` | string | ポリシー識別子 |
| `policy:evaluate(actor, action, resource, meta?)` | string | `"allow"`、`"deny"`、または`"undefined"` |

## TokenStoreメソッド

### create

認証トークンを作成します。

```lua
local actor = security.new_actor("user:123", {role = "user"})
local scope = security.named_scope("app:default")

local token, err = store:create(actor, scope, {
    expiration = "24h",  -- またはミリ秒
    meta = {
        login_ip = request_ip,
        user_agent = user_agent
    }
})
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `actor` | Actor | トークン用のアクター |
| `scope` | Scope | 権限スコープ |
| `options.expiration` | string/number | 期間文字列またはms |
| `options.meta` | table | トークンメタデータ |

**戻り値:** `string, error`

### validate

トークンを検証してアクター/スコープを取得します。

```lua
local actor, scope, err = store:validate(token)
if err then
    return nil, errors.new("UNAUTHENTICATED", "Invalid token")
end
```

**戻り値:** `Actor, Scope, error`

### revoke

トークンを無効化します。

```lua
local ok, err = store:revoke(token)
```

**戻り値:** `boolean, error`

### close

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
| `security.scope.create` | `custom` | カスタムスコープの作成 |
| `security.actor.create` | アクターID | アクターの作成 |
| `security.token_store.get` | ストアID | トークンストアへのアクセス |
| `security.token.validate` | ストアID | トークンの検証 |
| `security.token.create` | ストアID | トークンの作成 |
| `security.token.revoke` | ストアID | トークンの取り消し |

ポリシー設定については[セキュリティモデル](system-security.md)を参照。

## エラー

| 条件 | 種別 | 再試行可能 |
|-----------|------|-----------|
| コンテキストなし | `errors.INTERNAL` | no |
| 空のトークンストアID | `errors.INVALID` | no |
| 権限拒否 | `errors.INVALID` | no |
| ポリシーが見つからない | `errors.INTERNAL` | no |
| トークンストアが見つからない | `errors.INTERNAL` | no |
| トークンストアがクローズ済み | `errors.INTERNAL` | no |
| 無効な有効期限フォーマット | `errors.INVALID` | no |
| トークン検証失敗 | `errors.INTERNAL` | no |

```lua
local store, err = security.token_store("app:tokens")
if err then
    if errors.is(err, errors.INVALID) then
        print("Invalid request:", err:message())
    end
    return nil, err
end
```

エラーの処理については[エラー処理](lua-errors.md)を参照。

## 関連項目

- [セキュリティモデル](system-security.md) - アクター、ポリシー、スコープの設定
- [HTTPミドルウェア](http-middleware.md) - エンドポイントとリソースファイアウォール

