---
title: "変更データキャプチャ"
description: "db.cdc.postgres を使用して、Postgres の論理レプリケーションから行レベルの変更をストリーミングします。"
---

# 変更データキャプチャ

`db.cdc.postgres` ソースは、`pgoutput` プラグインを介して Postgres の論理レプリケーションから行レベルの変更をストリーミングします。レプリケーションスロットを作成し、既存行のスナップショットを取得した後、insert、update、delete の変更を送出できます。このページは設定リファレンスです。例では、既存のデータベース、publication またはテーブルセット、レプリケーション用資格情報、環境値が用意されていることを前提とします。ソースはエントリ ID で指定し、Lua からは [`cdc` モジュール](../lua/storage/cdc.md)を通じて利用します。

## 設定

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
|------------|----|------------|------|
| `host` | string | 必須 | Postgres ホスト |
| `port` | int | 必須 | Postgres ポート（0 より大きい値） |
| `database` | string | 必須 | データベース名 |
| `username` | string | 必須 | レプリケーションユーザー（`REPLICATION` 権限が必要） |
| `password` | string | 必須 | パスワード（インラインまたは `${env:NAME}`） |
| `slot_name` | string | 必須 | 論理レプリケーションスロット名 |
| `publication` | string | - | Postgres publication。`tables` が空の場合は必須 |
| `tables` | []string | - | キャプチャ対象テーブル（`schema.table`）。publication のテーブルを使用する場合は省略 |
| `snapshot` | bool | false | ストリーミング前に、既存行を初期スナップショットとして送出 |
| `streaming` | bool | false | スナップショット後の継続的な変更をストリーミング |
| `temporary` | bool | false | 一時レプリケーションスロットを使用（切断時に削除） |
| `failover` | bool | false | フェイルオーバースロットモードを有効化（`temporary` とは排他的） |
| `standby_interval` | duration | `10s` | スタンバイステータスメッセージの間隔 |
| `status_interval` | duration | `30s` | 保持 WAL およびレプリケーション遅延メトリクスのサンプリング間隔 |
| `snapshot_fetch_size` | int | `1000` | スナップショットのバッチごとに取得する行数。`0` はデフォルトを使用 |
| `options` | map | - | 追加の接続オプション |
| `lifecycle` | object | - | ライフサイクル設定 |

資格情報に含まれる `${env:NAME}` プレースホルダーは、デコード時に[環境レジストリ](./env.md)を通じて解決されます。

## 動作の仕組み

1. ソースはレプリケーションユーザーとして Postgres に接続し、`slot_name` で指定したレプリケーションスロットを作成（または再開）します。
2. `snapshot` が設定されている場合、設定したテーブルの既存行を `op = "r"`（read）の変更イベントとして最初に送出します。
3. `streaming` が設定されている場合、継続的な行変更（`insert`、`update`、`delete`、`truncate`）を `pgoutput` プラグイン経由で WAL からストリーミングします。
4. スタンバイステータスループが定期的に LSN を確認応答し、Postgres が WAL セグメントを保持できるようにします（`standby_interval`）。
5. ソースは自身のエントリ ID で登録され、Lua コードは [`cdc.stream`](../lua/storage/cdc.md) で購読します。

## ソース情報

各ソースは次の情報レコードで表されます。

| フィールド | 説明 |
|------------|------|
| `name` | ソース名（エントリ ID） |
| `slot` | レプリケーションスロット名 |
| `publication` | Postgres publication（設定されている場合） |
| `tables` | キャプチャ対象テーブル（設定されている場合） |
| `streaming` | ストリーミングが有効か |
| `failover` | フェイルオーバーモードが有効か |
| `temporary` | スロットが一時的か |
| `snapshot` | スナップショットが有効か |

## 関連項目

- [CDC モジュール](../lua/storage/cdc.md) - Lua ストリーミング API
- [データベース](./database.md) - SQL データベースサービス
- [環境](./env.md) - `${env:NAME}` による資格情報の解決
