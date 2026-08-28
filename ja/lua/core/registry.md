---
title: "エントリレジストリ"
description: "レジストリエントリとメタデータの読み取り、バージョンとスナップショットの検査、認可された変更の適用を行います。"
---

# エントリレジストリ
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="permissions"/>

`registry` モジュールはエントリの読み取りと変更を行い、スナップショットとバージョン履歴へのアクセスを提供します。このページは API リファレンスです。変更例の ID は説明用であり、実行にはそのリソースとエントリ種別を明示的に許可するポリシーが必要です。

## ロード

```lua
local registry = require("registry")
```

## エントリ構造

```lua
{
    id = "app.lib:assert",     -- string: "namespace:name"
    kind = "function.lua",     -- string: entry type
    meta = {type = "test"},    -- table: searchable metadata
    data = {...}               -- any: entry payload
}
```

## エントリの取得

```lua
local entry, err = registry.get("app.lib:assert")
```

**権限:** エントリIDに対する`registry.get`

## エントリの検索

```lua
local entries, err = registry.find({[".kind"] = "function.lua"})
local entries, err = registry.find({[".kind"] = "http.endpoint", [".ns"] = "app.api"})
```

ルートセレクターは `.kind`、`.name`、`.ns`、`.id` で、値には glob マッチを使用できます。メタデータのフィルターには `meta.` 接頭辞を付けます。例: `{["meta.type"] = "test"}`。

## IDの解析

```lua
local id = registry.parse_id("app.lib:assert")
-- id.ns = "app.lib", id.name = "assert"
```

## スナップショット

レジストリのポイントインタイムビュー：

```lua
local snap, err = registry.snapshot()           -- current state
local snap, err = registry.snapshot_at(5)       -- at version 5
```

### スナップショットメソッド

| メソッド | 戻り値 | 説明 |
|--------|---------|-------------|
| `snap:entries()` | `Entry[], error` | アクセス可能なすべてのエントリ |
| `snap:get(id)` | `Entry, error` | IDで単一エントリを取得 |
| `snap:find(filter)` | `Entry[]` | エントリをフィルター |
| `snap:namespace(ns)` | `Entry[]` | 名前空間内のエントリ |
| `snap:version()` | `Version` | スナップショットバージョン |
| `snap:changes()` | `Changes` | チェンジセットを作成 |

## プロセスローカルオーバーレイ

`registry.overlay(owner_id)` は論理オーナーのプロセスローカルオーバーレイを開きます。戻り値は有効なレジストリの通常のスナップショットです。そのスナップショットからチェンジセットを作成し、永続変更と同じ方法で適用します。

```lua
local snap, err = registry.overlay("controllers:customer-db")
if err then
    return nil, err
end

local changes = snap:changes()
changes:create({
    id = "runtime.data_sources:customer-db",
    kind = "db.sql.postgres",
    data = {host = "db.example.com", database = "customer"}
})

local current_version, err = changes:apply()
```

オーバーレイの変更はこのプロセス内のレジストリトポロジーとリソースに反映されますが、永続的な履歴バージョンは作成しません。そのため `changes:apply()` は、変更されていない現在の永続バージョンを返します。オーバーレイは通常の履歴コミットやバージョン選択後も維持されます。コールドブートまたは明示的なレジストリ状態の読み込みで消去され、その後オーナーによって再調整されます。

オーバーレイスナップショットは世代ベースの楽観的並行制御を使用します。古いスナップショットの変更を適用すると、再試行可能な `errors.CONFLICT` で原子的に失敗します。オーバーレイを開き直してチェンジセットを再構築してください。1 つのチェンジセットに含められる操作は、エントリ ID ごとに最大 1 つです。オーナー ID はトリムされて正規の識別子になります。オーナーはエントリメタデータではなくレジストリ状態であり、展開ディレクティブが所有するエントリ種別はオーバーレイから変更できません。

通常の `registry.get`、`find`、`snapshot` は合成された有効なレジストリを参照し、各エントリには引き続き `registry.get` 権限が必要です。オーナーレベルのオーバーレイ権限は読み取り認可の代わりにはなりません。

## バージョン

```lua
local version, err = registry.current_version()
local versions, err = registry.versions()

print(version:id())       -- numeric ID
print(version:string())   -- display string
local prev = version:previous()  -- previous version or nil
local next = version:next()      -- next version or nil
```

## 履歴

```lua
local hist, err = registry.history()
local versions, err = hist:versions()
local version, err = hist:get_version(5)
local snap, err = hist:snapshot_at(version)
```

## チェンジセット

変更を構築して適用：

```lua
local snap, err = registry.snapshot()
local changes = snap:changes()

changes:create({
    id = "test:new_entry",
    kind = "test.kind",
    meta = {type = "test"},
    data = {config = "value"}
})

changes:update({
    id = "test:existing",
    kind = "test.kind",
    meta = {updated = true},
    data = {new_value = true}
})

changes:delete("test:old_entry")

local new_version, err = changes:apply()
```

**権限:** `changes:apply()`に対する`registry.apply`

### Changesメソッド

| メソッド | 説明 |
|--------|-------------|
| `changes:create(entry)` | create操作を追加 |
| `changes:update(entry)` | update操作を追加 |
| `changes:delete(id)` | delete操作を追加（文字列または`{ns, name}`） |
| `changes:ops()` | 保留中の操作を取得 |
| `changes:apply()` | 変更を適用、新しいVersionを返す |

## バージョンの適用

特定のバージョンにロールバックまたはロールフォワード：

```lua
local prev = current_version:previous()
local ok, err = registry.apply_version(prev)
```

**権限:** `registry.apply_version`

## デルタの構築

状態間を遷移する操作を計算：

```lua
local from = {{id = "test:a", kind = "test", meta = {}, data = {}}}
local to = {{id = "test:b", kind = "test", meta = {}, data = {}}}

local ops, err = registry.build_delta(from, to)
for _, op in ipairs(ops) do
    print(op.kind, op.entry.id)  -- "entry.create", "entry.update", "entry.delete"
end
```

## 権限

| 権限 | リソース | 説明 |
|------------|----------|-------------|
| `registry.get` | entry ID | エントリを読み取り（find/entries結果もフィルター） |
| `registry.apply` | - | チェンジセットを適用 |
| `registry.apply_version` | - | バージョンを適用/ロールバック |
| `registry.overlay.get` | owner ID | オーナーのオーバーレイを開く |
| `registry.overlay.apply` | owner ID | オーバーレイのチェンジセットを適用 |
| `registry.overlay.create.<kind>` | entry ID | 指定した種別のエントリをオーバーレイに作成 |
| `registry.overlay.update.<kind>` | entry ID | 指定した種別のエントリをオーバーレイで更新 |
| `registry.overlay.delete.<kind>` | entry ID | 指定した種別のエントリをオーバーレイから削除 |

## エラー

| 条件 | 種別 |
|-----------|------|
| エントリが見つからない | `errors.NOT_FOUND` |
| バージョンが見つからない | `errors.NOT_FOUND` |
| 権限拒否 | `errors.PERMISSION_DENIED` |
| 無効なパラメータ | `errors.INVALID` |
| 適用する変更がない | `errors.INVALID` |
| 空のオーバーレイオーナーまたはディレクティブ所有の種別 | `errors.INVALID` |
| 古いオーバーレイスナップショット | `errors.CONFLICT`（再試行可能） |
| レジストリが利用不可 | `errors.INTERNAL` |

エラーの処理については[エラー処理](lua/core/errors.md)を参照してください。
