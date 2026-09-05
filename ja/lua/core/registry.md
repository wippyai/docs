---
title: "エントリレジストリ"
description: "<secondary-label ref='function'/ <secondary-label ref='process'/ <secondary-label ref='permissions'/"
---

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

`registry.get`、`registry.find`、`snap:entries()`、`snap:get()`、`snap:namespace()`、`snap:find()`から読み取られるエントリは、これら4つの作者向けフィールドのみを保持する。

`dependency_root`は`changes:create()`と`changes:update()`が受け付ける書き込み側フィールド。`ns.dependency`エントリをデプロイメントルートとしてマークするブール値。エントリAPIから返されることはなく、レジストリ所有の状態は[`snap:state()`](lua/core/registry.md#snapshot-state)を通じて読み取る。

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
| `snap:state()` | `State, error` | レジストリ所有のメタデータ付きのエントリと、解決されたモジュールグラフ |
| `snap:get(id)` | `Entry, error` | IDで単一エントリを取得 |
| `snap:find(filter)` | `Entry[]` | エントリをフィルター |
| `snap:namespace(ns)` | `Entry[]` | 名前空間内のエントリ |
| `snap:version()` | `Version` | スナップショットバージョン |
| `snap:changes()` | `Changes` | チェンジセットを作成 |

### スナップショットの状態

`snap:state()`は、エントリの状態と、そのスナップショットバージョンに対して選択されたモジュールグラフを合わせて返す。レジストリ所有の来歴は`meta`にマージされるのではなく各エントリ上に保持されるため、作者が記述したメタデータと混同されることはない。

```lua
local snap, err = registry.snapshot()
local state, err = snap:state()

for _, entry in ipairs(state.entries) do
    print(entry.id, entry.registry.owner, entry.registry.root)
end

if state.resolution then
    print(state.resolution.digest, state.resolution.input_digest)
    for _, module in ipairs(state.resolution.modules) do
        print(module.name, module.version)
    end
end
```

`state.entries`内の各エントリは、4つの作者向けフィールドに加えて次を持つ:

- `registry.owner` - エントリを供給したデプロイメントソース
- `registry.root` - エントリがデプロイメントによって選択された依存関係の宣言である場合に`true`

`state.resolution`は`registry.snapshot()`のビューにおけるモジュールグラフを表す。`registry.snapshot_at()`やオーバーレイのスナップショットを含め、自身のグラフを持たないスナップショットでは存在しない:

| フィールド | 型 | 説明 |
|-------|------|-------------|
| `digest` | string | 不変な選択結果全体のコンテンツダイジェスト |
| `input_digest` | string | 宣言されたルート集合のダイジェスト |
| `baseline_digest` | string | グラフの解決対象となったデプロイメントベースラインのダイジェスト。未束縛の場合は省略 |
| `roots` | array | ソルバーの入力として使われた、記述された依存関係の宣言 |
| `references` | array | 同一コンポーネントの既存ルートに畳み込まれた、ルート形式の宣言。空の場合は省略 |
| `modules` | array | 選択されたモジュール |

`roots`と`references`の各要素は`id`、`component`、`version`を持つ。`modules`の各要素は`name`と`version`を持ち、設定されている場合はさらに`version_id`、`source`、`digest`、`size_bytes`、`protected`を持つ。

## バージョン

```lua
local version, err = registry.current_version()
local versions, err = registry.versions()

print(version:id())       -- 数値ID
print(version:string())   -- 表示文字列
local prev = version:previous()  -- 前のバージョンまたはnil
local next = version:next()      -- 次のバージョンまたはnil
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

### エントリの削除

`changes:delete()`は、ID文字列、`id`文字列を持つテーブル、`ns`と`name`の文字列を持つテーブル、またはそれらいずれかの配列を受け付ける。配列はネスト可能で、重複したIDは単一のdelete操作にまとめられる。

```lua
changes:delete("test:old_entry")
changes:delete({id = "test:old_entry"})
changes:delete({ns = "test", name = "old_entry"})
changes:delete({"test:a", {ns = "test", name = "b"}, {"test:c"}})
```

空のリスト、自身を参照するテーブル、文字列でもテーブルでもない値は`errors.INVALID`として拒否される。

### Changesメソッド

| メソッド | 説明 |
|--------|-------------|
| `changes:create(entry)` | create操作を追加 |
| `changes:update(entry)` | update操作を追加 |
| `changes:delete(id)` | delete操作を追加 |
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

## オーバーレイ

オーバーレイは、論理的なアイデンティティが所有するプロセスローカルなレジストリエントリの集合。オーバーレイエントリは通常のトポロジーとハンドラ遷移に参加するため、サービスは永続エントリとまったく同様に起動・停止するが、レジストリ履歴を進めることはなく、バージョンに現れることもない。実行中のプロセス内にのみ存在し、コールドブート後は空になるため、所有する制御サービスが起動時にこれを整合させる。

```lua
local snap, err = registry.overlay("data-sources:crm")
```

**戻り値:** `Snapshot, error`

このスナップショットは通常のメソッドを通じてオーナーのオーバーレイエントリを公開し、`snap:version()`から現在のレジストリバージョンを報告する。また、開かれた時点のオーバーレイ世代を取得しており、これが書き込みの安全性を担保する。

```lua
local snap, err = registry.overlay("data-sources:crm")
if err then return nil, err end

local changes = snap:changes()
changes:create({
    id = "data.crm:connection",
    kind = "registry.entry",
    meta = {},
    data = {endpoint = "https://crm.internal"}
})

local version, err = changes:apply()
```

オーバーレイスナップショット上の`changes:apply()`はオーバーレイに書き込み、現在のレジストリバージョンを返す。履歴バージョンは作成されないため、並行して永続的な変更が起きない限り、返されるバージョンは変わらない。

### 並行性

各オーバーレイは、適用が成功するたびに増加する世代カウンタを持つ。`changes:apply()`は、その世代がスナップショットを開いた時点で取得したものと一致する場合にのみ成功する。同じオーバーレイへの並行した適用は、リトライ可能とマークされた`errors.CONFLICT`で失敗する。オーバーレイを開き直してチェンジセットを組み立て直すこと。

```lua
local last_err
for _ = 1, 3 do
    local snap, err = registry.overlay("data-sources:crm")
    if err then return nil, err end

    local _, apply_err = snap:changes():delete("data.crm:connection"):apply()
    if not apply_err then return true end
    if not apply_err:retryable() then return nil, apply_err end
    last_err = apply_err
end
return nil, last_err
```

### 制約

- オーナー文字列は必須であり、空であってはならない。
- チェンジセットは空であってはならず、同じエントリを二度指定してはならない。
- IDが永続状態またはいずれかのオーバーレイにすでに存在する場合、`create`は失敗する。
- `update`と`delete`は、このオーナーが作成したエントリに対してのみ機能する。それ以外のIDは`errors.NOT_FOUND`で失敗する。
- オーバーレイエントリは`dependency_root`やその他のレジストリ所有のメタデータを設定できない。
- オーバーレイエントリは`ns.dependency`のような、レジストリディレクティブが所有する種別を使用できない。
- 生存する他のエントリが依存しているエントリを取り除く削除は拒否される。
- 依存関係はオーバーレイのオーナー境界を越えられず、永続エントリはオーバーレイエントリに依存できない。

残りは`errors.CONFLICT`または`errors.INVALID`として現れ、いずれもリトライ不可。リトライ可能なのは上記の世代の不一致のみ。

**権限:** 開いて読み取るにはオーナーに対する`registry.overlay.get`、書き込むにはオーナーに対する`registry.overlay.apply`、そしてチェンジセット内の各エントリIDに対する`registry.overlay.<create|update|delete>.<kind>`。

## 権限

| 権限 | リソース | 説明 |
|------------|----------|-------------|
| `registry.get` | entry ID | エントリを読み取り（find/entries結果もフィルター） |
| `registry.apply` | - | チェンジセットを適用 |
| `registry.apply_version` | - | バージョンを適用/ロールバック |
| `registry.overlay.get` | オーナーID | オーバーレイスナップショットを開いて読み取り |
| `registry.overlay.apply` | オーナーID | オーバーレイのチェンジセットを適用 |
| `registry.overlay.create.<kind>` | エントリID | その種別のオーバーレイエントリを作成 |
| `registry.overlay.update.<kind>` | エントリID | その種別のオーバーレイエントリを更新 |
| `registry.overlay.delete.<kind>` | エントリID | その種別のオーバーレイエントリを削除 |

## エラー

| 条件 | 種別 |
|-----------|------|
| エントリが見つからない | `errors.NOT_FOUND` |
| バージョンが見つからない | `errors.NOT_FOUND` |
| 権限拒否 | `errors.PERMISSION_DENIED` |
| 無効なパラメータ | `errors.INVALID` |
| 適用する変更がない | `errors.INVALID` |
| 適用中にオーバーレイが変更された | `errors.CONFLICT`（リトライ可能） |
| オーバーレイエントリが他所に所有されている、または永続状態と競合する | `errors.CONFLICT` |
| レジストリが利用不可 | `errors.INTERNAL` |

エラーの処理については[エラー処理](lua/core/errors.md)を参照。

