---
title: "キーバリューストア"
description: "有効期限と条件付き書き込みを必要に応じて指定し、値を保存・取得します。"
---

# キーバリューストア
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>
<secondary-label ref="permissions"/>

`store` モジュールは、必要に応じて TTL を指定できるキーバリューストレージを提供します。キャッシュデータ、セッション、その他の一時的な状態を保持できます。

このページは API リファレンスです。スニペットでは、構成済みのストア、後述する権限、アプリケーションが提供する `owner` や `new_value` などの値を前提としています。取得後のスニペットは既存の有効な `cache` ハンドルを使用するため、単独で実行できる関数ではありません。

ストアの構成については、[ストア](../../system/store.md)を参照してください。

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

local _, set_err = cache:set("user:123", {name = "Alice"}, 3600)
if set_err then
    cache:release()
    return nil, set_err
end

local user, get_err = cache:get("user:123")

cache:release()
if get_err then return nil, get_err end
return user
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `id` | string | ストアリソースID |

**戻り値:** `Store, error`

## 値の保存

オプションのTTL付きで値を保存:

```lua
-- Simple set
local _, err = cache:set("user:123:name", "Alice")
if err then return nil, err end

-- Set with TTL (expires in 300 seconds)
local ok, ttl_err = cache:set("session:abc", {user_id = 123, role = "admin"}, 300)
if ttl_err then return nil, ttl_err end
return ok
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
local errors = require("errors")

local user, err = cache:get("user:123")
if err then
    if err:kind() == errors.NOT_FOUND then
        return nil -- key missing or expired
    end
    return nil, err
end
return user
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `key` | string | 取得するキー |

**戻り値:** `any, error`

キーが存在しないか有効期限が切れている場合、このメソッドは `nil` と `errors.NOT_FOUND` エラーを返します。

## 存在確認

取得せずにキーが存在するか確認:

```lua
local errors = require("errors")

local exists, err = cache:has("lock:" .. resource_id)
if err then return nil, err end
if exists then
    return nil, errors.new({
        message = "Resource is locked",
        kind = errors.CONFLICT
    })
end
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `key` | string | 確認するキー |

**戻り値:** `boolean, error`

## キーの削除

ストアからキーを削除:

```lua
local deleted, err = cache:delete("session:" .. session_id)
if err then return nil, err end
return deleted
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `key` | string | 削除するキー |

**戻り値:** `boolean, error`

削除された場合は`true`、キーが存在しなかった場合は`false`を返す。

## エントリメタデータの読み取り

`entry` は値と、その楽観的並行性制御に使われる不透明なバージョン文字列 `version` を返します:

```lua
local e, err = cache:entry("user:123")
if err then return nil, err end
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
if err then return nil, err end
for _, e in ipairs(page.items) do
    print(e.key, e.value)
end

-- next page
if page.has_more then
    local next_page, next_err = cache:list({ prefix = "session:", after = page.cursor })
    if next_err then return nil, next_err end
    page = next_page
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
local errors = require("errors")

-- create only if the key does not exist
local e, err = cache:put("lock:job-1", owner, { only_if_absent = true })
if err and err:kind() == errors.ALREADY_EXISTS then
    -- someone else holds it
elseif err then
    return nil, err
end

-- compare-and-set: write only if the version still matches
local cur, read_err = cache:entry("config")
if read_err then return nil, read_err end
local e2, err2 = cache:put("config", new_value, { if_version = cur.version })
if err2 and err2:kind() == errors.CONFLICT then
    -- a concurrent writer changed it; re-read and retry
elseif err2 then
    return nil, err2
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
local info, err = cache:info()
if err then return nil, err end
-- info.backend      -> one of store.backend.* (e.g. "kv.raft")
-- info.consistency  -> one of store.consistency.* (e.g. "linearizable")
-- info.durable / info.list / info.versioned / info.conditional_put / info.ttl  (booleans)
```

**戻り値:** `Info, error` — `{id, backend, consistency, durable, list, versioned, conditional_put, ttl}`

### 定数

| 定数 | 値 |
|----------|--------|
| `store.backend` | `MEMORY`, `SQL`, `KV_RAFT`, `KV_CRDT`, `UNKNOWN` |
| `store.consistency` | `LINEARIZABLE`, `EVENTUAL`, `LOCAL`, `UNKNOWN` |

```lua
local info, err = cache:info()
if err then return nil, err end
if info.consistency == store.consistency.LINEARIZABLE then
    -- safe to use compare-and-set
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
| `store.info` | Store ID | - | ストアの機能を確認 |
| `store.key.get` | Store ID | `key` | キー値を読み取り（`entry` も対象） |
| `store.key.set` | Store ID | `key` | キー値を書き込み（`put` も対象） |
| `store.key.delete` | Store ID | `key` | キーを削除 |
| `store.key.has` | Store ID | `key` | キーの存在を確認 |
| `store.key.list` | Store ID | `prefix` | エントリを一覧表示 |

`store.get`、`get`、`set`、`delete`、`has` で権限が拒否されると Lua エラーが送出されます。一方、`info`、`entry`、`list`、`put` メソッドは `errors.PERMISSION_DENIED` エラーを返します。送出された拒否を処理できないコードを呼び出す前に、必要なアクションを付与してください。

## エラー

入力、検索、バックエンド、機能に関する失敗は構造化エラーとして返されます（`err:kind()` を使用）。権限拒否については、前述した二通りの動作に従います。

| 条件 | 種別 | 再試行可能 |
|-----------|------|-----------|
| リソースIDが空 | `errors.INVALID` | いいえ |
| リソースレジストリを利用できない | `errors.NOT_FOUND` | いいえ |
| リソースが見つからない場合を含む、ストア取得の失敗 | `errors.INTERNAL` | いいえ |
| ストアが解放済み | `errors.INVALID` | いいえ |
| `info`、`entry`、`list`、`put` による権限拒否 | `errors.PERMISSION_DENIED` | いいえ |
| `store.get`、`get`、`set`、`delete`、`has` による権限拒否 | Lua エラーを送出 | 該当なし |
| `only_if_absent` でキーが存在する | `errors.ALREADY_EXISTS` | いいえ |
| `if_version` 不一致 | `errors.CONFLICT` | はい |
| サポートのないストアでの条件付き書き込み | `errors.INVALID` | いいえ |

エラーの処理については、[エラー処理](../core/errors.md)を参照してください。
