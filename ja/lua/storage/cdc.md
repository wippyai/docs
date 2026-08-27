---
title: "CDC"
description: "PostgreSQL の変更データキャプチャストリームを購読し、行レベルのイベントを受信します。"
---

# CDC
<secondary-label ref="storage"/>
<secondary-label ref="stream"/>
<secondary-label ref="nondeterministic"/>

`cdc` モジュールは、[`db.cdc.postgres`](../../system/cdc.md) ソースから PostgreSQL の変更データキャプチャストリームを購読します。設定済みソースの一覧取得、ストリームのオープン、チャネルを介した行レベル変更イベントの配信を行います。

このページは、部分的な購読レシピを含む API リファレンスです。スニペットを使用するには、CDC ソースが設定済みで稼働している必要があります。配信チャネルを開くには、さらに実行中のプロセスコンテキストが必要です。`handle_new_user` などのアプリケーションコールバックは、呼び出し側が用意するプレースホルダーです。

## 読み込み

```lua
local cdc = require("cdc")
```

## `list_sources`

設定済みの CDC ソースを一覧表示します。

```lua
local sources, err = cdc.list_sources()
if err then return nil, err end
for _, s in ipairs(sources) do
    print(s.name, s.slot, s.streaming)
end
```

各ソースは `name`、`slot`、`publication`、`tables`、`streaming`、`failover`、`temporary`、`snapshot` を持つテーブルです。[CDC ソース](../../system/cdc.md#ソース情報)を参照してください。

**戻り値：** `table, error`

## `source`

レジストリエントリ ID またはレプリケーションスロット名で 1 つのソースを取得します。

```lua
local info, err = cdc.source("app:pg_cdc")
if err then return nil, err end
if info == nil then
    -- no such source
end
```

**戻り値：** `table, error`（ソース情報。見つからない場合は `nil`）

## `stream`

ソースの変更ストリームを開きます。返された `cdc.Stream` は、変更イベントを配信するチャネルを公開します。

```lua
local stream, err = cdc.stream("app:pg_cdc", {
    tables = { "public.users", "public.orders" },
    ops    = { "insert", "update" },
    buffer = 128,
})
if err then return nil, err end

-- The caller owns stream until close(), release(), or task cleanup.
```

| パラメーター | 型 | 説明 |
|--------------|----|------|
| `name` | string | ソースのレジストリ ID またはレプリケーションスロット名 |
| `opts.tables` | []string | 対象をこれらのテーブルに限定（設定済みの全テーブルを対象にする場合は省略） |
| `opts.ops` | []string | 対象を次の操作に限定：`insert`、`update`、`delete`、`truncate`、`snapshot` |
| `opts.buffer` | int | ソース購読バッファーのサイズ（1〜65536、デフォルト：128） |

**戻り値：** `Stream, error`

Lua の配信チャネルには、これとは別に固定容量 64 があります。`buffer` オプションが制御するのは PostgreSQL ソースの購読であり、このチャネルではありません。

## Stream のメソッド

### `channel`

変更イベントを受信するチャネルを返します。最初の呼び出しはソースを購読して yield し、以降の呼び出しは同じチャネルを返します。最初の呼び出しは購読エラーを返すことがあります。チャネルの `:receive()` は、変更に対して `value, true`、ストリーム終了時に `nil, false` を返します。

```lua
local stream, stream_err = cdc.stream("app:pg_cdc")
if stream_err then return nil, stream_err end
local ch, subscribe_err = stream:channel()
if subscribe_err then
    stream:close()
    return nil, subscribe_err
end

while true do
    local change, ok = ch:receive()
    if not ok then break end

    if change.op == "insert" then
        handle_new_user(change.table, change.after)
    elseif change.op == "update" then
        handle_update(change.table, change.before, change.after)
    elseif change.op == "delete" then
        handle_delete(change.table, change.before)
    end
end

local _, close_err = stream:close()
if close_err then return nil, close_err end
```

`receive` は `channel` のエイリアスです。

### `close`

購読を停止してストリームを解放します。このメソッドは冪等であり、ランタイムもタスクスコープの終了時にストリームを閉じます。`release` は `close` のエイリアスです。

```lua
local _, err = stream:close()
if err then return nil, err end
```

## 変更イベント

チャネルで受信する各メッセージは変更テーブルです。

| フィールド | 説明 |
|------------|------|
| `op` | 操作：`insert`、`update`、`delete`、`truncate`、`snapshot` |
| `schema` | テーブルスキーマ |
| `table` | テーブル名 |
| `relation` | `schema.table` |
| `before` | 変更前の行状態（`update`、`delete`。`insert` では存在しない） |
| `after` | 変更後の行状態（`insert`、`update`、`snapshot`。`delete` では存在しない） |
| `source` | ソース名 |
| `lsn` | 変更のログシーケンス番号 |
| `commit_lsn` | コミットしたトランザクションの LSN（該当する場合） |
| `xid` | トランザクション ID（該当する場合） |

`before` と `after` は、列名をキーとする行マップです。

## エラー

| 条件 | Kind |
|------|------|
| ストリーム作成時に Lua コンテキストがない | `errors.INTERNAL` |
| 最初の購読時にプロセス PID がない | 発生する Lua エラー |
| ソース名が必要 | `errors.INVALID` |
| バッファーサイズが不正 | `errors.INVALID` |
| 最初の `channel()` / `receive()` 呼び出しでソースが見つからない | `errors.NOT_FOUND` |
| `list_sources()` / `source()` からソースインスペクターを利用できない | `errors.INTERNAL` |
| 購読後にプロセスバインディングを利用できない | `errors.INTERNAL` |
| 最初の `channel()` / `receive()` 呼び出しでソース購読に失敗 | ソース依存の構造化エラー |

エラーの扱い方は[エラー処理](../core/errors.md)を参照してください。

## 関連項目

- [変更データキャプチャ](../../system/cdc.md) - `db.cdc.postgres` ソースの設定
- [チャネル](../core/channel.md) - チャネルのセマンティクス
- [データベース](../../system/database.md) - SQL データベースサービス
