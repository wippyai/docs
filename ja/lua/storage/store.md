# キーバリューストア
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>
<secondary-label ref="permissions"/>

TTLサポート付きの高速キーバリューストレージ。キャッシュ、セッション、一時的な状態に最適。

ストア設定については[ストア](system-store.md)を参照。

## ロード

```lua
local store = require("store")
```

## ストアの取得

レジストリIDでストアリソースを取得:

```lua
local cache, err = store.get("app:cache")
if err then
    return nil, err
end

cache:set("user:123", {name = "Alice"}, 3600)
local user = cache:get("user:123")

cache:release()
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `id` | string | ストアリソースID |

**戻り値:** `Store, error`

## 値の保存

オプションのTTL付きで値を保存:

```lua
local cache = store.get("app:cache")

-- シンプルなset
cache:set("user:123:name", "Alice")

-- TTL付きでset（300秒で期限切れ）
cache:set("session:abc", {user_id = 123, role = "admin"}, 300)
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `key` | string | キー |
| `value` | any | 値（テーブル、文字列、数値、ブール値） |
| `ttl` | number | TTL（秒）（オプション、0 = 期限なし） |

**戻り値:** `boolean, error`

## 値の取得

キーで値を取得:

```lua
local user = cache:get("user:123")
if not user then
    -- キーが見つからないか期限切れ
end
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `key` | string | 取得するキー |

**戻り値:** `any, error`

キーが存在しない場合は`nil`を返す。

## 存在確認

取得せずにキーが存在するか確認:

```lua
if cache:has("lock:" .. resource_id) then
    return nil, errors.new("CONFLICT", "Resource is locked")
end
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `key` | string | 確認するキー |

**戻り値:** `boolean, error`

## キーの削除

ストアからキーを削除:

```lua
cache:delete("session:" .. session_id)
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `key` | string | 削除するキー |

**戻り値:** `boolean, error`

削除された場合は`true`、キーが存在しなかった場合は`false`を返す。

## ストアメソッド

| メソッド | 戻り値 | 説明 |
|--------|---------|-------------|
| `get(key)` | `any, error` | キーで値を取得 |
| `set(key, value, ttl?)` | `boolean, error` | オプションのTTL付きで値を保存 |
| `has(key)` | `boolean, error` | キーが存在するか確認 |
| `delete(key)` | `boolean, error` | キーを削除 |
| `release()` | `boolean` | ストアをプールに戻す |

## 権限

ストア操作はセキュリティポリシー評価の対象。

| アクション | リソース | 属性 | 説明 |
|--------|----------|------------|-------------|
| `store.get` | Store ID | - | ストアリソースを取得 |
| `store.key.get` | Store ID | `key` | キー値を読み取り |
| `store.key.set` | Store ID | `key` | キー値を書き込み |
| `store.key.delete` | Store ID | `key` | キーを削除 |
| `store.key.has` | Store ID | `key` | キーの存在を確認 |

## エラー

| 条件 | 種別 | 再試行可能 |
|-----------|------|-----------|
| リソースIDが空 | `errors.INVALID` | no |
| リソースが見つからない | `errors.NOT_FOUND` | no |
| ストアが解放済み | `errors.INVALID` | no |
| 権限拒否 | `errors.PERMISSION_DENIED` | no |

エラーの処理については[エラー処理](lua-errors.md)を参照。

