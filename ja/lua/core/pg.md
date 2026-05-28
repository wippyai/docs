# プロセスグループ
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="permissions"/>

プロセスを名前付きグループに参加させ、クラスタ全体のすべてのメンバーにブロードキャストします。Erlang/OTP `pg` をモデルにしています: グループは動的で、プロセスは複数のグループに所属でき、メンバーシップはゴシップを通じてクラスタ全体で追跡されます。

スコープエントリ種別とその設定については[プロセスグループ](system/process-groups.md)を参照。クラスタリングモデル全体については[クラスタガイド](guides/cluster.md)を参照。

## ロード

```lua
local pg = require("pg")
```

## スコープを開く

プロセスグループは**スコープ** — `pg.scope` レジストリエントリ — の中に存在します。インスタンスを取得するにはそれを開きます:

```lua
local group, err = pg.open("app:pg")
if err then
    return nil, err
end
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `id` | string | スコープエントリID（形式: `"namespace:name"`） |

**戻り値:** `pg.Instance, error`

**権限:** スコープ `id` に対する `pg.open`

インスタンスはプロセス終了時に自動的に解放されます。早期に解放するには `release()` を呼び出します。他の操作はすべてインスタンスのメソッドで、`:` で呼び出します。

## 参加と離脱

```lua
local ok, err = group:join("workers")           -- 単一グループ
local ok, err = group:join({"workers", "all"})  -- バッチ
local ok, err = group:leave("workers")
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `group` | string \| string[] | グループ名、またはバッチ操作の名前リスト |

**戻り値:** `boolean, error`

プロセスは同じグループに複数回参加できます。完全に離脱するには同じ回数 leave する必要があります（マルチ参加セマンティクス）。`leave` はバッチ全体でベストエフォートで、指定されたいずれのグループにもメンバーでない場合のみエラーを返します。

**権限:** 各グループ名に対する `pg.join` / `pg.leave`

## メンバーの一覧取得

```lua
local members, err = group:get_members("workers")        -- 全ノード
local local_members, err = group:get_local_members("workers")  -- このノードのみ
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `group` | string | グループ名 |

**戻り値:** `string[], error` — PID文字列の配列（不明なグループは空）

**権限:** グループ名に対する `pg.get_members` / `pg.get_local_members`

## グループの一覧取得

```lua
local groups, err = group:which_groups()         -- クラスタ内の全グループ
local local_groups, err = group:which_local_groups()  -- ローカルメンバーを持つグループ
```

**戻り値:** `string[], error` — 現在少なくとも1つのメンバーを持つグループ名

**権限:** `pg.which_groups` / `pg.which_local_groups`

## ブロードキャスト

グループのすべてのメンバーにメッセージを送信します。各メンバーは呼び出しプロセスから `topic` 名でメッセージを受け取ります — `process.listen(topic)` で処理します。

```lua
local ok, err = group:broadcast("workers", "task", {id = 42})   -- 全ノード
local ok, err = group:broadcast_local("workers", "task", {id = 42})  -- このノードのみ
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `group` | string | 対象グループ |
| `topic` | string | メッセージトピック |
| `...` | any | ゼロ個以上のペイロード値 |

**戻り値:** `boolean, error`

**権限:** グループ名に対する `pg.broadcast` / `pg.broadcast_local`

## グループの監視

`monitor` は1つのグループの参加/離脱イベントをサブスクライブし、現在のメンバーをアトミックに返します — サブスクリプションとスナップショットの間でメンバーシップ変更が抜け落ちることはありません。

```lua
local sub, members, err = group:monitor("workers")
if err then
    return nil, err
end

for _, pid in ipairs(members) do
    -- サブスクリプション時の現在のメンバー
end

local ch = sub:channel()
local event = ch:receive()  -- {kind = "member.joined" | "member.left", path = "workers", data = {...}}

sub:close()  -- アンサブスクライブ。sub:close({flush = true}) でキューされたイベントを先にドレイン
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `group` | string | 監視するグループ |

**戻り値:** `pg.Subscription, string[], error` — サブスクリプションと現在のメンバーのスナップショット

**権限:** グループ名に対する `pg.monitor`

## 全グループの監視

`events` はスコープ内のすべてのグループにまたがるメンバーシップ変更をサブスクライブし、すべてのグループとそのメンバーのスナップショットを返します。

```lua
local sub, snapshot, err = group:events()
-- snapshot: { ["workers"] = {pid, ...}, ["all"] = {pid, ...} }

local event = sub:channel():receive()
sub:close()
```

**戻り値:** `pg.Subscription, table, error`

**権限:** `pg.events`

### イベントフィールド

サブスクリプションチャネルで配信されるイベントには以下が含まれます:

| フィールド | 型 | 説明 |
|-------|------|-------------|
| `system` | string | 常に `"pg"` |
| `kind` | string | `"member.joined"` または `"member.left"` |
| `path` | string | グループ名 |
| `data` | table | `{Group = string, PIDs = string[]}` — 影響を受けるメンバー |

サブスクリプションチャネルはバッファ付き（容量64）。遅いコンシューマがバッファを満たすと、そのサブスクリプションへのイベントはドロップされます。

## 解放

```lua
group:release()
```

インスタンスを即座に解放します。冪等です。解放後はすべてのメソッドがエラーを返します。プロセス終了時にもクリーンアップは自動的に実行されます。

**戻り値:** `boolean`

## 権限

| 権限 | メソッド | リソース |
|------------|--------|----------|
| `pg.open` | `pg.open()` | scope id |
| `pg.join` | `join()` | group name |
| `pg.leave` | `leave()` | group name |
| `pg.get_members` | `get_members()` | group name |
| `pg.get_local_members` | `get_local_members()` | group name |
| `pg.which_groups` | `which_groups()` | (scope) |
| `pg.which_local_groups` | `which_local_groups()` | (scope) |
| `pg.broadcast` | `broadcast()` | group name |
| `pg.broadcast_local` | `broadcast_local()` | group name |
| `pg.monitor` | `monitor()` | group name |
| `pg.events` | `events()` | (scope) |

## エラー

| 条件 | 種別 |
|-----------|------|
| 権限拒否 | `errors.PERMISSION_DENIED` |
| 引数が欠損または空 | `errors.INVALID` |
| スコープが見つからない | `errors.NOT_FOUND` |
| メンバーでないグループからの離脱 | `errors.INVALID` |
| インスタンスが解放済み | `errors.INVALID` |

エラーの処理については[エラー処理](lua/core/errors.md)を参照。

## 関連項目

- [プロセスグループ](system/process-groups.md) - スコープエントリ種別と設定
- [クラスタ](guides/cluster.md) - メンバーシップとクラスタリングモデル
- [プロセス管理](lua/core/process.md) - 個別プロセスのスポーンとメッセージング
