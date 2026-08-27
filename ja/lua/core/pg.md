---
title: "プロセスグループ"
description: "クラスタ全体のプロセスグループ、メンバーシップ、ブロードキャスト、メンバーシップ購読を管理する方法。"
---

# プロセスグループ
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="permissions"/>

プロセスグループは、動的な名前の下にプロセスをまとめ、クラスタ全体のグループメンバーへメッセージをブロードキャストします。1つのプロセスは複数のグループに参加でき、クラスタ全体のメンバーシップは最終的整合性を持ちます。

このページはAPIリファレンスです。スニペットでは、既存の `pg.scope`、プロセスコンテキストで動作する実行可能エントリ、文書化された操作を許可するポリシーがあることを前提とします。各ブロックは、単独で完結するアプリケーションではなく、個別の呼び出しや部分的な購読フローを示します。

スコープエントリ種別とその設定については[プロセスグループ](../../system/process-groups.md)を参照してください。クラスタリングモデル全体については[クラスタガイド](../../guides/cluster.md)を参照してください。

## ロード

```lua
local pg = require("pg")
```

読み込む前に、実行可能エントリの `modules:` リストへ `pg` を追加してください。

## スコープを開く

プロセスグループは、`pg.scope` レジストリエントリで表される**スコープ**に属します。グループ操作用のインスタンスを取得するには、スコープを開きます。

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

インスタンスは実行フレームのクリーンアップ時に自動解放されます。早く解放するには `release()` を呼び出してください。他の操作はインスタンスのメソッドであり、`:` 構文を使用します。

## 参加と離脱

次の呼び出しはそれぞれ独立しています。アプリケーションに必要な単一グループまたはバッチ参加を選び、対応するleave操作と組み合わせてください。

```lua
local ok, err = group:join("workers")           -- single group
if err then return nil, err end
```

```lua
local ok, err = group:join({"workers", "all"})  -- batch
if err then return nil, err end
```

```lua
local ok, err = group:leave("workers")
if err then return nil, err end
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `group` | string \| string[] | グループ名、またはバッチ操作の名前リスト |

**戻り値:** `boolean, error`

プロセスは同じグループへ複数回参加でき、完全に離脱するには同じ回数leaveする必要があります。バッチに対する `leave` はベストエフォートで、プロセスが指定されたどのグループのメンバーでもなかった場合にだけエラーを返します。

**権限:** 各グループ名に対する `pg.join` / `pg.leave`

## メンバーの一覧取得

```lua
local members, err = group:get_members("workers")        -- all nodes
if err then return nil, err end

local local_members, err = group:get_local_members("workers")  -- this node only
if err then return nil, err end
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `group` | string | グループ名 |

**戻り値:** `string[], error` — PID文字列の配列（不明なグループは空）

**権限:** グループ名に対する `pg.get_members` / `pg.get_local_members`

## グループの一覧取得

```lua
local groups, err = group:which_groups()         -- all groups in the cluster
if err then return nil, err end

local local_groups, err = group:which_local_groups()  -- groups with a local member
if err then return nil, err end
```

**戻り値:** `string[], error` — 現在少なくとも1つのメンバーを持つグループ名

**権限:** `pg.which_groups` / `pg.which_local_groups`

## ブロードキャスト

ブロードキャストは、呼び出しプロセスからすべてのグループメンバーへ `topic` 名でメッセージを送信します。メンバーは `process.listen(topic)` で受信します。

```lua
local ok, err = group:broadcast("workers", "task", {id = 42})   -- all nodes
if err then return nil, err end

ok, err = group:broadcast_local("workers", "task", {id = 42})  -- this node only
if err then return nil, err end
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `group` | string | 対象グループ |
| `topic` | string | メッセージトピック |
| `...` | any | ゼロ個以上のペイロード値 |

**戻り値:** `boolean, error`

**権限:** グループ名に対する `pg.broadcast` / `pg.broadcast_local`

## グループの監視

`monitor` は1つのグループの参加／離脱イベントを購読し、現在のメンバーのアトミックなスナップショットを返します。スナップショットと購読の設定の間に起きたメンバーシップ変更も見落とされません。

```lua
local sub, members, err = group:monitor("workers")
if err then
    return nil, err
end

for _, pid in ipairs(members) do
    -- current members at subscription time
end

local ch = sub:channel()
local event, open = ch:receive()  -- {kind = "member.joined" | "member.left", path = "workers", data = {...}}
if not open then
    return nil, errors.new("Process-group subscription closed")
end

sub:close()  -- unsubscribe; sub:close({flush = true}) drains queued events first
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `group` | string | 監視するグループ |

**戻り値:** `pg.Subscription, string[], error` — サブスクリプションと現在のメンバーのスナップショット

**権限:** グループ名に対する `pg.monitor`

## 全グループの監視

`events` はスコープ内のすべてのグループのメンバーシップ変更を購読し、グループからメンバーへのマッピングを表すスナップショットを返します。

```lua
local sub, snapshot, err = group:events()
if err then
    return nil, err
end
-- snapshot: { ["workers"] = {pid, ...}, ["all"] = {pid, ...} }

local event, open = sub:channel():receive()
if not open then
    return nil, errors.new("Process-group subscription closed")
end
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

`release` はインスタンスを直ちに解放し、冪等です。解放後は、他のすべてのグループ操作がエラーを返します。実行フレームの終了時にもクリーンアップが自動的に行われます。

**戻り値:** `boolean`

## 権限

| 権限 | メソッド | リソース |
|------------|--------|----------|
| `pg.open` | `pg.open()` | scope id |
| `pg.join` | `join()` | group name |
| `pg.leave` | `leave()` | group name |
| `pg.get_members` | `get_members()` | group name |
| `pg.get_local_members` | `get_local_members()` | group name |
| `pg.which_groups` | `which_groups()` | - |
| `pg.which_local_groups` | `which_local_groups()` | - |
| `pg.broadcast` | `broadcast()` | group name |
| `pg.broadcast_local` | `broadcast_local()` | group name |
| `pg.monitor` | `monitor()` | group name |
| `pg.events` | `events()` | - |

## エラー

| 条件 | 種別 |
|-----------|------|
| 権限拒否 | `errors.PERMISSION_DENIED` |
| 引数が欠損または空 | `errors.INVALID` |
| スコープが見つからない | `errors.INTERNAL` |
| メンバーでないグループからの離脱 | `errors.NOT_FOUND` |
| インスタンスが解放済み | `errors.INVALID` |
| グループ／メンバーまたはアクションキューの上限到達 | `errors.RATE_LIMITED`（再試行可能） |
| サービス停止、バックプレッシャー、回路オープン | `errors.UNAVAILABLE` |
| ブロードキャストのタイムアウト | `errors.TIMEOUT`（再試行可能） |

エラーの処理については[エラー処理](errors.md)を参照してください。

## 関連項目

- [プロセスグループ](../../system/process-groups.md) - スコープエントリ種別と設定
- [クラスタ](../../guides/cluster.md) - メンバーシップ、命名、クラスタリングモデル
- [プロセス管理](process.md) - 個別プロセスのスポーンとメッセージング
