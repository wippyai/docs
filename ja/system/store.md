---
title: "ストア（キーバリュー）"
description: "TTL をサポートする、インメモリ、SQL バックエンド、クラスターレプリケーション（Raft と CRDT）のキーバリューストア。"
---

# ストア（キーバリュー）

Wippy は、メモリ、SQL、Raft、または CRDT をバックエンドとする、TTL 対応のキーバリューストアを提供します。

このページはエントリ設定のリファレンスです。YAML のコードブロックは既存のエントリリストに配置する断片であり、SQL のコードブロックは `store.sql` エントリを起動する前に実行する必要があるスキーマ設定です。

## エントリ種別

| 種別 | 説明 |
|------|------|
| `store.memory` | 自動クリーンアップ付きのインメモリストア |
| `store.sql` | 永続化される SQL バックエンドのストア |
| `store.kv.raft` | 共有 Raft 上でクラスターレプリケーションされる、強整合性 KV |
| `store.kv.crdt` | ゴシップを介してクラスターレプリケーションされる、結果整合性 KV（CRDT） |

## メモリストア

```yaml
- name: sessions
  kind: store.memory
  max_size: 10000
  cleanup_interval: "5m"
  lifecycle:
    auto_start: true
```

| フィールド | 型 | デフォルト | 説明 |
|------------|-----|------------|------|
| `max_size` | int | 10000 | 最大エントリ数。0 はデフォルト値（10000）に置き換えられる |
| `cleanup_interval` | duration | 5m | 期限切れエントリのクリーンアップ間隔 |

`max_size` に達すると、新しいエントリは拒否されます。データは再起動時に失われます。

## SQL ストア

```yaml
- name: cache
  kind: store.sql
  database: app:postgres
  table_name: kv_store
  cleanup_interval: "10m"
  lifecycle:
    auto_start: true
```

| フィールド | 型 | デフォルト | 説明 |
|------------|-----|------------|------|
| `database` | reference | 必須 | データベースエントリの参照 |
| `table_name` | string | 必須 | ストレージ用のテーブル名 |
| `id_column_name` | string | key | キー用のカラム |
| `payload_column_name` | string | value | 値用のカラム |
| `expire_column_name` | string | expires_at | 有効期限用のカラム |
| `cleanup_interval` | duration | 0 | 期限切れエントリのクリーンアップ間隔 |

カラム名は SQL インジェクションを防ぐために検証されます。次の前提スキーマは PostgreSQL の DDL です。MySQL または SQLite では、同等のバイナリ／BLOB 型とタイムスタンプ型を使用してください。

```sql
CREATE TABLE kv_store (
    key VARCHAR(255) PRIMARY KEY,
    value BYTEA NOT NULL,
    expires_at TIMESTAMPTZ NULL
);

CREATE INDEX idx_expires_at ON kv_store(expires_at) WHERE expires_at IS NOT NULL;
```

## クラスター KV ストア {id="cluster-kv-stores"}

`store.kv.raft` と `store.kv.crdt` は、クラスターノード間でキーバリューデータをレプリケーションします。どちらも[クラスタリング](guides/cluster.md)を有効にする必要があり、同じ[ストアモジュール](lua/storage/store.md)の Lua API を再利用します。各エントリは、ノード全体で共有される単一のエンジンに対する名前空間付きのビューです。`namespace` はこのエントリのキーを分離し、`^[a-z][a-z0-9._-]*$` に一致する必要があります（`_` で始めることはできません）。

### Raft（強整合性）

```yaml
- name: deployments
  kind: store.kv.raft
  namespace: deploy
```

| フィールド | 型 | 必須 | 説明 |
|------------|-----|------|------|
| `namespace` | string | はい | 共有エンジン内のキー名前空間 |

書き込みは共有 Raft を通じて提案され（フォロワーはリーダーに転送）、読み取りは線形化可能です。条件付き書き込み（`put` で `only_if_absent`／`if_version` を指定）もサポートされます。Raft の状態はデフォルトで `cluster.raft.data_dir`（デフォルト: `~/.wippy/store`）の下にファイルシステムへ永続化されます。[設定](guides/configuration.md#cluster)を参照してください。

### CRDT（結果整合性）

```yaml
- name: sessions
  kind: store.kv.crdt
  namespace: sess
  durable: false
```

| フィールド | 型 | 必須 | デフォルト | 説明 |
|------------|-----|------|------------|------|
| `namespace` | string | はい | - | キー名前空間 |
| `durable` | bool | いいえ | false | ファイルシステムにスナップショットを永続化し、クラスター全体の再起動後も名前空間を維持 |

書き込みはローカル状態を変更し、ゴシップを介して伝播します。競合する同時書き込みは last-writer-wins で収束します。読み取りはローカルです。条件付き書き込みはサポートされません。`durable: false` の場合、ストアはインメモリでピアから再構築されます。`durable: true` の場合は `<data_dir>/_sys/kvcrdt` にスナップショットを保存します。

<note>
<code>data_dir</code> はエントリごとではなく、ノードレベル（<code>cluster.raft.data_dir</code>）の設定です。共有 Raft の状態と永続 CRDT スナップショットは <code>&lt;data_dir&gt;/_sys/</code> の下に保存されます。
</note>

## TTL の動作

4 種類すべてのストアで time-to-live 値を指定できますが、有効期限の見え方はバックエンドによって異なります。

- `store.memory` は、期限切れのキーを読み取り時に存在しないものとして扱い、`cleanup_interval`（デフォルト `5m`）で期限切れエントリを削除します。設定値が 0 の場合は、このデフォルト値に置き換えられます。
- `store.sql` は読み取り時に期限切れの行を除外し、`cleanup_interval` で削除します。デフォルトの `0` はバックグラウンドクリーンアップを無効にしますが、期限切れの行が読み取り可能になるわけではありません。
- `store.kv.raft` は、期限付きキーをリーダー駆動のリースに関連付けます。約 1 秒ごとのリーススイープが Raft を通じて削除を提案するため、その合意済みの削除が適用されるまでキーを読み取れる場合があります。
- `store.kv.crdt` も約 1 秒ごとのリーススイープで期限切れのキーを削除し、その結果のトゥームストーンをゴシップします。リース期限は書き込みを受け付けたノードにのみ存在します。その発生元が期限切れ前に停止した場合、別のノードは独自に期限を再現しないため、後続の状態更新や管理者によるクリーンアップで削除されるまでキーが残ることがあります。

## Lua API

操作については、[ストアモジュール](lua/storage/store.md)を参照してください。`get`、`set`、`has`、`delete` に加え、バージョン付きおよび条件付きアクセス用の `put`、`entry`、`list`、`info` を提供します。

## 関連項目

- [ストアモジュール](lua/storage/store.md) - Lua API リファレンス
- [データベース](system/database.md) - `store.sql` の SQL バックエンド
