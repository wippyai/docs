---
title: "CDC"
description: "db.cdc.postgresおよびdb.cdc.sqliteのソースから、Change Data Capture（変更データキャプチャ）ストリームを購読します。設定済みのソースを一覧し、ストリームを開き、行レベルの変更イベントをチャネル経由で受信します。APIはドライバー中立です。…"
---

# CDC
<secondary-label ref="storage"/>
<secondary-label ref="stream"/>
<secondary-label ref="nondeterministic"/>

[`db.cdc.postgres`](system/cdc.md)および[`db.cdc.sqlite`](system/cdc.md)のソースから、Change Data Capture（変更データキャプチャ）ストリームを購読します。設定済みのソースを一覧し、ストリームを開き、行レベルの変更イベントをチャネル経由で受信します。APIはドライバー中立です。どちらの種別も同じソース情報と同じ変更イベントを返し、公開する[ケイパビリティ](system/cdc.md#capabilities)だけが異なります。

## ロード

```lua
local cdc = require("cdc")
```

## list_sources

呼び出し元が参照を許可されている、設定済みのCDCソースを一覧します:

```lua
local sources, err = cdc.list_sources()
for _, s in ipairs(sources) do
    print(s.id, s.kind, s.state, s.capabilities.before_images)
end
```

呼び出し元が`cdc.source`を持たないソースは、エラーとして報告されるのではなく省略されます。

**戻り値:** `table, error`

## source

名前（エントリID）で単一のソースを取得します:

```lua
local info, err = cdc.source("app:pg_cdc")
if info == nil then
    -- そのようなソースは存在しない
end
```

**戻り値:** `table, error`（ソース情報、見つからない場合は`nil`）

## stream

ソース上の変更ストリームを開きます。チャネルが変更イベントを配信する`cdc.Stream`を返します:

```lua
local stream, err = cdc.stream("app:pg_cdc", {
    tables = { "public.users", "public.orders" },
    ops    = { "insert", "update" },
    buffer = 128,
})
```

| パラメータ | 型 | デフォルト | 説明 |
|-----------|------|---------|-------------|
| `name` | string | 必須 | ソース名（エントリID） |
| `opts.tables` | []string | - | これらのテーブルに絞り込む（省略するとキャプチャ対象の全テーブル） |
| `opts.ops` | []string | - | これらの操作に絞り込む: `insert`、`update`、`delete`、`truncate` |
| `opts.buffer` | int | 64 | バックログの項目容量（1〜65536） |
| `opts.max_bytes` | int | 1048576 | この購読者のバックログのバイト予算（1 MiB） |
| `opts.snapshot` | bool | エントリのデフォルト | このストリームでスナップショット/ライブの引き継ぎを要求する |
| `opts.after` | string | - | 直前のイベントの`cursor`から得た不透明な再開カーソル |

未知のオプションキーは`errors.INVALID`で拒否されます。テーブル名は、修飾されたリレーション名と裸のテーブル名の両方に対して大文字小文字を区別せずに照合されます。スナップショットの行は`tables`のみでフィルタされ、`ops`はライブの変更に適用されます。

ストリームは、`opts.snapshot`がtrueであるか、ソースエントリの`snapshot`フィールドが設定されている場合にスナップショットを受け取ります。スナップショットの行が`op = "snapshot"`で最初に到着し、その後ストリームは切れ目なくライブの変更へ続きます。`opts.after`はカーソルから再開するドライバー向けに予約されています。現在提供されているすべてのドライバーは、`capture_resume`を報告する`db.cdc.postgres`を含め、これに対して`errors.INVALID`（"cdc operation is not supported by this source"）を返します。

フィルタは配信を絞り込むだけです。ソースへのアクセスは`cdc.subscribe`権限によって付与されるのであり、フィルタによって付与されることはありません。

**戻り値:** `Stream, error`

## Streamのメソッド

### channel

変更イベントを受信するチャネルを返します。最初の呼び出しはソースを購読します（yieldします）。以降の呼び出しは同じチャネルを返します。`:receive()`は次の変更が到着するまでブロックし、ストリームが終了すると`nil`を返します:

```lua
local stream = cdc.stream("app:pg_cdc")
local ch = stream:channel()

while true do
    local change = ch:receive()
    if change == nil then break end   -- ストリームが閉じられた

    if change.op == "snapshot" then
        seed_row(change.table, change.after)
    elseif change.op == "insert" then
        handle_new_user(change.table, change.after)
    elseif change.op == "update" then
        handle_update(change.table, change.before, change.after)
    elseif change.op == "delete" then
        handle_delete(change.table, change.before)
    end
end
```

ストリームは遅延評価です。まず構築し、観測させたい書き込みを発生させる前に`channel()`を呼び出してください。これはライブの観測であり、購読前に行われた変更の再生ではありません。

ソースが失敗によってストリームを終了させる場合、チャネルは閉じる前にエラー値を配信します。`receive`は`channel`の別名です。

### close

購読を停止し、ストリームを解放します。冪等であり、タスクスコープでも自動的に閉じられます。`release`は`close`の別名です。

```lua
stream:close()
```

## 変更イベント

チャネルで受信する各メッセージは変更テーブルです:

| フィールド | 説明 |
|-------|-------------|
| `op` | 操作: `insert`、`update`、`delete`、`snapshot`、`truncate` |
| `schema` | テーブルのスキーマ |
| `table` | テーブル名 |
| `relation` | 修飾されたリレーション名 |
| `before` | 変更前の行の状態（`update`、`delete`）。完全な行イメージが保証されるのは、ソースが`before_images`ケイパビリティを持つ場合のみ。`db.cdc.postgres`はWALが運ぶ古いタプルからこれを埋め、その内容はテーブルの`REPLICA IDENTITY`が制御する |
| `after` | 変更後の行の状態（`insert`、`update`、`snapshot`。`delete`では存在しない） |
| `source` | ソースのエントリID |
| `source_id` | ソースのエントリID（レジストリIDとして） |
| `generation` | このイベントを生成したソースの世代 |
| `cursor` | ソース内における不透明なイベント単位の位置 |
| `transaction` | ドライバーが報告する場合のトランザクション識別子 |
| `lsn` | 変更のログシーケンス番号（`db.cdc.postgres`） |
| `commit_lsn` | コミットするトランザクションのLSN（該当する場合） |
| `xid` | トランザクションID（該当する場合） |
| `unchanged` | 値が送信されなかった列（変更されていないTOAST値） |
| `error` | イベントに載せられた、ドライバーが報告するエラーの説明 |

`before`と`after`は列名をキーとする行のマップです。

## ソース情報

`cdc.source`と`cdc.list_sources`の各要素は、同じレコードを返します:

| フィールド | 説明 |
|-------|-------------|
| `id` | エントリID |
| `kind` | `db.cdc.postgres`または`db.cdc.sqlite` |
| `name` | ソース名（エントリID） |
| `state` | `unknown`、`starting`、`running`、`faulted`、`stopped` |
| `generation` | 現在のソース世代 |
| `epoch` | `generation`と同じ値 |
| `engine` | ドライバーが報告する場合のエンジン名 |
| `db_resource` | 観測対象のSQLリソースのエントリID（`db.cdc.sqlite`） |
| `slot` | レプリケーションスロット名（`db.cdc.postgres`） |
| `publication` | 設定されている場合のPostgresのパブリケーション |
| `tables` | 設定されている場合のキャプチャ対象テーブル |
| `streaming` | `db.cdc.sqlite`: ソースが稼働中かどうか。`db.cdc.postgres`: エントリの`streaming`プロトコル設定 |
| `failover` | フェイルオーバースロットのモード（`db.cdc.postgres`） |
| `temporary` | 一時スロット（`db.cdc.postgres`） |
| `snapshot` | エントリレベルのスナップショットのデフォルト |
| `faulted` | ソースが`faulted`状態にあるかどうか |
| `error` | 記録されている場合の直近のソースエラー |
| `admission` | `active`、`snapshots`、`reserved_bytes`、`rejected` |
| `capabilities` | `snapshot`、`capture_resume`、`replayable`、`captures_external_writes`、`before_images`、`coalesced` |

`kind`ではなく`capabilities`で分岐してください:

```lua
local info = cdc.source("app:changes")
if not info.capabilities.before_images then
    -- beforeは完全な行イメージとして保証されない。自前で最後に判明した状態を保持すること
end
```

フィールドの意味については[CDCソース](system/cdc.md#source-info)を参照してください。

## 権限

| アクション | リソース | 説明 |
|--------|----------|-------------|
| `cdc.source` | ソースのエントリID | `cdc.source`。`cdc.list_sources`のフィルタにも使われる |
| `cdc.subscribe` | ソースのエントリID | `cdc.stream`。購読の確立時に再度チェックされる |

拒否されたアクションは`errors.PERMISSION_DENIED`を返します。

## エラー

| 条件 | 種別 |
|-----------|------|
| コンテキストなし | `errors.INTERNAL` |
| ソース名が必須 | `errors.INVALID` |
| 無効または未知のストリームオプション | `errors.INVALID` |
| `capture_resume`を持たないソースでの`after` | `errors.INVALID` |
| ソースが登録されていない | `errors.NOT_FOUND` |
| ソースが未起動または置き換え中 | `errors.UNAVAILABLE` |
| 購読の容量を使い切った | `errors.UNAVAILABLE` |
| 権限が拒否された | `errors.PERMISSION_DENIED` |

エラーの処理については[エラー処理](lua/core/errors.md)を参照。

## 関連項目

- [Change Data Capture](system/cdc.md) - ソースの設定とケイパビリティ
- [Channel](lua/core/channel.md) - チャネルのセマンティクス
- [データベース](system/database.md) - SQLデータベースサービス
