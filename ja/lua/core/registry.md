# エントリレジストリ
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="permissions"/>

登録されたエントリのクエリと変更。メタデータ、スナップショット、バージョン履歴にアクセス。

## ロード

```lua
local registry = require("registry")
```

## エントリ構造

```lua
{
    id = "app.lib:assert",     -- string: "namespace:name"
    kind = "function.lua",     -- string: エントリタイプ
    meta = {type = "test"},    -- table: 検索可能なメタデータ
    data = {...}               -- any: エントリペイロード
}
```

## エントリの取得

```lua
local entry, err = registry.get("app.lib:assert")
```

**権限:** エントリIDに対する`registry.get`

## エントリの検索

```lua
local entries, err = registry.find({kind = "function.lua"})
local entries, err = registry.find({kind = "http.endpoint", namespace = "app.api"})
```

フィルターフィールドはエントリメタデータと照合。

## IDの解析

```lua
local id = registry.parse_id("app.lib:assert")
-- id.ns = "app.lib", id.name = "assert"
```

## スナップショット

レジストリのポイントインタイムビュー：

```lua
local snap, err = registry.snapshot()           -- 現在の状態
local snap, err = registry.snapshot_at(5)       -- バージョン5時点
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

## バージョン

```lua
local version, err = registry.current_version()
local versions, err = registry.versions()

print(version:id())       -- 数値ID
print(version:string())   -- 表示文字列
local prev = version:previous()  -- 前のバージョンまたはnil
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

## エラー

| 条件 | 種別 |
|-----------|------|
| エントリが見つからない | `errors.NOT_FOUND` |
| バージョンが見つからない | `errors.NOT_FOUND` |
| 権限拒否 | `errors.PERMISSION_DENIED` |
| 無効なパラメータ | `errors.INVALID` |
| 適用する変更がない | `errors.INVALID` |
| レジストリが利用不可 | `errors.INTERNAL` |

エラーの処理については[エラー処理](lua/core/errors.md)を参照。

