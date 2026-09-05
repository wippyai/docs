---
title: "Change Data Capture"
description: "db.cdc.postgresとdb.cdc.sqliteを使って、Postgresの論理レプリケーションやSQLiteから行レベルの変更をストリーミングします。"
---

# Change Data Capture

データベースから行レベルの変更をストリーミングします。CDCソースはinsert、update、deleteをキャプチャし、任意で各購読者にまず既存行の一貫したスナップショットを渡し、すべてをドライバー中立の変更イベントとして配信します。ソースはエントリIDでアドレス指定でき、Luaからは[`cdc`モジュール](lua/storage/cdc.md)経由で利用します。

## エントリ種別

| 種別 | 説明 |
|------|-------------|
| `db.cdc.postgres` | Postgresの論理レプリケーション（`pgoutput`プラグイン） |
| `db.cdc.sqlite` | `db.sql.sqlite`リソースを通じて観測されるSQLiteへの書き込み |

どちらの種別も、同じLua API、同じソース情報レコード、同じ変更イベントの形を公開します。異なるのは保証の集合であり、これはソースごとに[ケイパビリティ](#capabilities)として公開されます。

## Postgresの設定

```yaml
- name: pg_cdc
  kind: db.cdc.postgres
  host: ${env:DB_HOST}
  port: 5432
  database: app
  username: ${env:DB_USER}
  password: ${env:app.secrets:db_password}
  slot_name: wippy_slot
  publication: wippy_pub
  tables:
    - public.users
    - public.orders
  snapshot: true
  streaming: true
  standby_interval: "10s"
  status_interval: "10s"
  lifecycle:
    auto_start: true
```

| フィールド | 型 | デフォルト | 説明 |
|-------|------|---------|-------------|
| `host` | string | 必須 | Postgresのホスト |
| `port` | int | 必須 | Postgresのポート（0より大きいこと） |
| `database` | string | 必須 | データベース名 |
| `username` | string | 必須 | レプリケーションユーザー（`REPLICATION`権限が必要） |
| `password` | string | 必須 | パスワード（インラインまたは`${env:NAME}`） |
| `slot_name` | string | 必須 | 論理レプリケーションスロット名 |
| `publication` | string | - | Postgresのパブリケーション。`tables`が空の場合は必須 |
| `tables` | []string | - | キャプチャ対象のテーブル（`schema.table`）。省略するとパブリケーションのテーブルを使用 |
| `snapshot` | bool | false | 購読者ごとのスナップショット引き継ぎのエントリデフォルト |
| `streaming` | bool | false | ストリーミング版の`pgoutput`プロトコルを使用する |
| `temporary` | bool | false | 一時レプリケーションスロットを使用する（切断時に削除される） |
| `failover` | bool | false | フェイルオーバースロットモードを有効にする（`temporary`と排他） |
| `standby_interval` | duration | - | スタンバイステータスメッセージの間隔（例: `10s`） |
| `status_interval` | duration | - | サーバーへのステータス更新の間隔 |
| `snapshot_fetch_size` | int | - | スナップショットのバッチごとに取得する行数（0以上であること） |
| `max_transaction_changes` | int | 1000000 | 1つのトランザクションをデコードする間にバッファリングする変更の最大数 |
| `max_transaction_bytes` | int | 268435456 | 1つのトランザクションをデコードする間にバッファリングする論理バイト数の最大値（256 MiB） |
| `max_inflight_changes` | int | 1000000 | 処理中の全トランザクションにわたって保持する変更の最大数 |
| `max_inflight_bytes` | int | 268435456 | 処理中の全トランザクションにわたって保持する論理バイト数の最大値（256 MiB） |
| `subscriptions` | object | - | 購読の受け入れ制限。[購読の制限](#subscription-limits)を参照 |
| `options` | map | - | 追加の接続オプション |
| `lifecycle` | object | - | ライフサイクル設定 |

いずれかの`max_*`フィールドに0を指定するとデフォルトが選択されます。デコーダーが無制限になることはありません。負の値は拒否されます。

認証情報の`${env:NAME}`プレースホルダーは、デコード時に[環境レジストリ](system/env.md)を通じて解決されます。

## SQLiteの設定

SQLiteソースは自前のデータベースを開きません。既存の[`db.sql.sqlite`](system/database.md)リソースを借用し、そのリソースのコミット済みミューテーションのオブザーバーを購読します。したがって、そのWippy SQLリソースを通じて行われた書き込みのみを正確にキャプチャします。別のプロセス、別のコネクション、外部ツールによる書き込みは観測されません。

```yaml
- name: cdcdb
  kind: db.sql.sqlite
  file: /var/data/app.db
  lifecycle:
    auto_start: true

- name: changes
  kind: db.cdc.sqlite
  db_resource: app:cdcdb
  tables:
    - users
    - orders
  snapshot: true
  status_interval: "30s"
  lifecycle:
    auto_start: true
```

| フィールド | 型 | デフォルト | 説明 |
|-------|------|---------|-------------|
| `db_resource` | string | 必須 | 観測対象の`db.sql.sqlite`リソースのエントリID |
| `name` | string | - | 受け付けられるが、ソース名は常にエントリID |
| `tables` | []string | - | キャプチャ対象のテーブル。省略すると全テーブル |
| `snapshot` | bool | false | 購読者ごとのスナップショット引き継ぎのエントリデフォルト |
| `status_interval` | duration | `30s` | ステータス更新の間隔 |
| `subscriptions` | object | - | 購読の受け入れ制限。[購読の制限](#subscription-limits)を参照 |
| `lifecycle` | object | - | ライフサイクル設定 |

ソースはSQLリソースをライフサイクル要件として宣言するため、スーパーバイザーは先にデータベースを起動し、データベースの世代が置き換えられるとソースを再起動します。

<note>
SQLiteのキャプチャには、<code>sqlite_preupdate_hook</code>ビルドタグ付きでビルドされたランタイムが必要です。公式ビルドにはこれが含まれています。タグがない場合、ドライバーはフェイルクローズドで動作します。<code>db.cdc.sqlite</code>エントリの作成は、何もキャプチャしないソースを起動する代わりに<code>sqlite cdc requires the sqlite_preupdate_hook build tag</code>を返します。
</note>

## 購読の制限

各ソースは限られた数の購読者を受け入れ、その最悪ケースのバックログを事前に予約します。スナップショットのスロットは、スナップショットを有効にしたストリームが閉じるまで予約されたままです。

```yaml
subscriptions:
  max_subscriptions: 1024
  max_snapshot_subscriptions: 4
  max_bytes: 268435456
```

| フィールド | 型 | デフォルト | 説明 |
|-------|------|---------|-------------|
| `max_subscriptions` | int | 1024 | ソースが受け入れる同時購読数 |
| `max_snapshot_subscriptions` | int | 4 | スナップショットを有効にした同時購読数 |
| `max_bytes` | int | 268435456 | 予約される購読者バックログの合計バイト数（256 MiB） |

0を指定するとデフォルトが選択され、負の値は拒否されます。制限を使い切ると、購読は再試行可能な`errors.UNAVAILABLE`で失敗します。

## 仕組み

1. Postgresソースはレプリケーションユーザーとして接続し、`slot_name`で指定されたスロットを作成（または再開）します。SQLiteソースは`db_resource`を借用し、そのリソースのコミット済みミューテーションのオブザーバーを購読します。
2. 行の変更は、`op`が`insert`、`update`、`delete`、`truncate`のドライバー中立な変更イベントへデコードされます。
3. ストリームで`snapshot`が有効な購読者は（エントリの`snapshot`フィールド、またはストリームの`opts.snapshot`により）、まず既存行を`op = "snapshot"`のイベントとして受け取り、その後、両者の間に切れ目なくライブの変更へ続きます。
4. Postgresソースは定期的にLSNを確認応答し、サーバーがWALセグメントを解放できるようにします（`standby_interval`）。
5. ソースは自身のエントリIDで登録されます。Luaコードは[`cdc.stream`](lua/storage/cdc.md)で購読します。

## ケイパビリティ

すべてのソースは自身が保証する内容を公開するため、コンシューマーはエントリ種別ではなくケイパビリティで分岐します。

| ケイパビリティ | `db.cdc.postgres` | `db.cdc.sqlite` | 意味 |
|------------|:-----------------:|:---------------:|---------|
| `snapshot` | 可 | 可 | アトミックなスナップショット/ライブの引き継ぎをサポートする |
| `capture_resume` | 可（`temporary`でない場合） | 不可 | ソースの進捗が再接続をまたいで保持される |
| `replayable` | 不可 | 不可 | 個々の購読者が過去のイベントを再生できる |
| `captures_external_writes` | 可 | 不可 | このランタイムの外で行われた書き込みをキャプチャする |
| `before_images` | 不可 | 可 | 変更前の行イメージを配信する |
| `coalesced` | 不可 | 可 | トランザクション内で同じ行への書き込みが繰り返された場合、まとめられて到着することがある |

ケイパビリティのフラグはソースの進捗を表すものであり、永続的な配信を表すものではありません。遅れをとった、あるいは切断した個々の購読者に対してイベントを再生するドライバーはありません。

## ソース情報

各ソースは情報レコードで記述され、`cdc.source`と`cdc.list_sources`が返します。

| フィールド | 型 | 説明 |
|-------|------|-------------|
| `id` | string | エントリID |
| `kind` | string | `db.cdc.postgres`または`db.cdc.sqlite` |
| `name` | string | ソース名（エントリID） |
| `state` | string | `unknown`、`starting`、`running`、`faulted`、`stopped` |
| `generation` | string | 現在のソース世代。ソースが置き換えられると変化する |
| `epoch` | string | `generation`と同じ値 |
| `engine` | string | エンジン名（`sqlite`） |
| `db_resource` | string | 観測対象のSQLリソースのエントリID（`db.cdc.sqlite`） |
| `slot` | string | レプリケーションスロット名（`db.cdc.postgres`） |
| `publication` | string | 設定されている場合のPostgresのパブリケーション |
| `tables` | []string | 設定されている場合のキャプチャ対象テーブル |
| `streaming` | bool | ソースが現在稼働中かどうか |
| `failover` | bool | フェイルオーバースロットのモード（`db.cdc.postgres`） |
| `temporary` | bool | 一時スロット（`db.cdc.postgres`） |
| `snapshot` | bool | エントリレベルのスナップショットのデフォルト |
| `faulted` | bool | ソースが`faulted`状態にあるかどうか |
| `error` | string | 記録されている場合の直近のソースエラー |
| `admission` | object | `active`、`snapshots`、`reserved_bytes`、`rejected` |
| `capabilities` | object | [ケイパビリティ](#capabilities)を参照 |

`admission`はキューの充填量ではなく予約を数えます。`active`は受け入れられた購読数、`snapshots`はそのうちスナップショットを有効にした数、`reserved_bytes`は予約されたバックログ予算、`rejected`は制限によって拒否された購読の累計数です。

## 権限

| アクション | リソース | 説明 |
|--------|----------|-------------|
| `cdc.source` | ソースのエントリID | ソース情報を読む。`cdc.list_sources`のフィルタにも使われる |
| `cdc.subscribe` | ソースのエントリID | 変更ストリームを開く |

CDCの権限はデータベースへのアクセスとは別です。ソースは、変更前イメージを含め、キャプチャしたすべての行を公開しうるからです。ストリームのフィルタは配信を絞り込むだけであり、ソースへのアクセスを付与することは決してありません。

```yaml
- name: cdc_reader
  kind: security.policy
  policy:
    effect: allow
    actions: [cdc.source, cdc.subscribe]
    resources: [app:changes]
```

## 関連項目

- [CDCモジュール](lua/storage/cdc.md) - LuaのストリーミングAPI
- [データベース](system/database.md) - SQLデータベースサービス
- [環境](system/env.md) - `${env:NAME}`による認証情報の解決
- [セキュリティ](system/security.md) - ポリシーとアクション
