---
title: "キーバリューストア"
description: "<secondary-label ref='function'/ <secondary-label ref='process'/ <secondary-label ref='io'/ <secondary-label ref='permissions'/"
---

# キーバリューストア
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>
<secondary-label ref="permissions"/>

TTLサポート付きの高速キーバリューストレージ。キャッシュ、セッション、一時的な状態に最適。

ストア設定については[ストア](system/store.md)を参照。

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

## エントリメタデータの読み取り

`entry` は値とその `version` を返します。`version` は楽観的並行性制御に使われる不透明な文字列です:

```lua
local e, err = cache:entry("user:123")
if e then
    print(e.key, e.value, e.version)
end
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `key` | string | 読み取るキー |

**戻り値:** `Entry, error` — `{key: string, value: any, version: string}`

## キーの一覧

エントリを決定的なキー順でページング付きで一覧します:

```lua
local page, err = cache:list({ prefix = "session:", limit = 100 })
for _, e in ipairs(page.items) do
    print(e.key, e.value)
end

-- 次のページ
if page.has_more then
    page = cache:list({ prefix = "session:", after = page.cursor })
end
```

| オプション | 型 | 説明 |
|--------|------|-------------|
| `prefix` | string | このプレフィックスを持つキーのみ |
| `after` | string | このカーソル以降から継続（前のページから） |
| `limit` | integer | ページあたりの最大アイテム数 |

**戻り値:** `Page, error` — `{items: Entry[], cursor: string, has_more: boolean}`

## 条件付き書き込み

`put` は値を書き込み、新しい `Entry` を返します。オプションで楽観的並行性制御が可能です:

```lua
-- キーが存在しない場合のみ作成
local e, err = cache:put("lock:job-1", owner, { only_if_absent = true })
if err and err:kind() == "ALREADY_EXISTS" then
    -- 他の誰かが保持している
end

-- compare-and-set: バージョンがまだ一致する場合のみ書き込み
local cur = cache:entry("config")
local e2, err2 = cache:put("config", new_value, { if_version = cur.version })
if err2 and err2:kind() == "CONFLICT" then
    -- 並行ライターが変更した。再読み取りして再試行
end
```

| オプション | 型 | 説明 |
|--------|------|-------------|
| `ttl` | number | TTL（秒） |
| `only_if_absent` | boolean | キーが存在しない場合のみ書き込み |
| `if_version` | string | 現在のバージョンが一致する場合のみ書き込み |

`only_if_absent` と `if_version` は相互に排他的です。

**戻り値:** `Entry, error`

<warning>
条件付き書き込みには <code>info().conditional_put</code> が true のストアが必要です（メモリストアと <code>store.kv.raft</code> ストア）。<code>store.kv.crdt</code> と <code>store.sql</code> では <code>errors.INVALID</code> エラーを返します。条件付き書き込みが必要な場合は <code>store.kv.raft</code> を使用してください。
</warning>

## ストア機能

`info` はバックエンドとそのサポート内容を報告します。これによりコードはバインドされたストアに適応できます:

```lua
local info = cache:info()
-- info.backend      -> store.backend.* のいずれか（例: "kv.raft"）
-- info.consistency  -> store.consistency.* のいずれか（例: "linearizable"）
-- info.durable / info.list / info.versioned / info.conditional_put / info.ttl  （ブール値）
```

**戻り値:** `Info, error` — `{id, backend, consistency, durable, list, versioned, conditional_put, ttl}`

### 定数

| 定数 | 値 |
|----------|--------|
| `store.backend` | `MEMORY`, `SQL`, `KV_RAFT`, `KV_CRDT`, `UNKNOWN` |
| `store.consistency` | `LINEARIZABLE`, `EVENTUAL`, `LOCAL`, `UNKNOWN` |

```lua
if cache:info().consistency == store.consistency.LINEARIZABLE then
    -- compare-and-set を安全に使用できる
end
```

## ストアメソッド

| メソッド | 戻り値 | 説明 |
|--------|---------|-------------|
| `get(key)` | `any, error` | キーで値を取得 |
| `entry(key)` | `Entry, error` | バージョンメタデータ付きで値を取得 |
| `set(key, value, ttl?)` | `boolean, error` | オプションのTTL付きで値を保存 |
| `put(key, value, opts?)` | `Entry, error` | 条件付き/バージョン管理付き書き込み、新しいエントリを返す |
| `list(opts?)` | `Page, error` | キー順のページング付き一覧 |
| `has(key)` | `boolean, error` | キーが存在するか確認 |
| `delete(key)` | `boolean, error` | キーを削除 |
| `info()` | `Info, error` | バックエンド、整合性、機能フラグ |
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

`store.get()` とストアハンドルのすべてのメソッド（`get`、`set`、`has`、`delete`）は構造化エラーを返します（`err:kind()` を使用）。

| 条件 | 種別 | 再試行可能 |
|-----------|------|-----------|
| リソースIDが空 | `errors.INVALID` | no |
| リソースが見つからない | `errors.NOT_FOUND` | no |
| ストアが解放済み | `errors.INVALID` | no |
| 権限拒否 | `errors.PERMISSION_DENIED` | no |
| `only_if_absent` でキーが存在する | `errors.ALREADY_EXISTS` | no |
| `if_version` 不一致 | `errors.CONFLICT` | yes |
| サポートのないストアでの条件付き書き込み | `errors.INVALID` | no |

エラーの処理については[エラー処理](lua/core/errors.md)を参照。

