---
title: "ストア（キーバリュー）"
description: "TTLサポート付きのキーバリューストア: インメモリ、SQLバックエンド、クラスタレプリケート（Raft および CRDT）。"
---

# ストア（キーバリュー）

TTLサポート付きのキーバリューストア: インメモリ、SQLバックエンド、クラスタレプリケート（Raft および CRDT）。

## エントリ種別

| 種別 | 説明 |
|------|------|
| `store.memory` | 自動クリーンアップ付きインメモリストア |
| `store.sql` | 永続化付きSQLバックエンドストア |
| `store.kv.raft` | 共有 Raft 上のクラスタレプリケート、強整合性 KV |
| `store.kv.crdt` | ゴシップ上のクラスタレプリケート、最終的整合性 KV（CRDT） |

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
| `max_size` | int | 10000 | 最大エントリ数（0 = 無制限） |
| `cleanup_interval` | duration | 5m | 期限切れエントリのクリーンアップ間隔 |

`max_size`に達すると、新しいエントリは拒否されます。データは再起動時に失われます。

## SQLストア

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
| `database` | reference | 必須 | データベースエントリ参照 |
| `table_name` | string | 必須 | ストレージ用テーブル名 |
| `id_column_name` | string | key | キー用カラム |
| `payload_column_name` | string | value | 値用カラム |
| `expire_column_name` | string | expires_at | 有効期限用カラム |
| `cleanup_interval` | duration | 0 | 期限切れエントリのクリーンアップ間隔 |

カラム名はSQLインジェクションに対して検証されます。使用前にテーブルを作成してください：

```sql
CREATE TABLE kv_store (
    key VARCHAR(255) PRIMARY KEY,
    value BYTEA NOT NULL,
    expires_at BIGINT
);

CREATE INDEX idx_expires_at ON kv_store(expires_at) WHERE expires_at IS NOT NULL;
```

## クラスタ KV ストア {id="cluster-kv-stores"}

`store.kv.raft` と `store.kv.crdt` はキーバリューデータをクラスタノード間でレプリケートします。どちらも[クラスタリング](guides/cluster.md)が有効である必要があり、同じ[ストアモジュール](lua/storage/store.md)の Lua API を再利用します。各エントリはノード全体の単一エンジンへの名前空間付きビューです。`namespace` はこのエントリのキーを分離し、`^[a-z][a-z0-9._-]*$` に一致する必要があります（`_` で始めることはできません）。

### Raft（強整合性）

```yaml
- name: deployments
  kind: store.kv.raft
  namespace: deploy
```

| フィールド | 型 | 必須 | 説明 |
|------------|-----|------|------|
| `namespace` | string | Yes | 共有エンジン内のキー名前空間 |

書き込みは共有 Raft を通じて提案され（フォロワーはリーダーに転送）、読み取りは線形化可能です。条件付き書き込み（`only_if_absent`/`if_version` 付きの `put`）がサポートされます。Raft 状態はデフォルトで `cluster.raft.data_dir`（デフォルト `~/.wippy/store`）の下に fs 永続化されます。[設定](guides/configuration.md#cluster)を参照。

### CRDT（最終的整合性）

```yaml
- name: sessions
  kind: store.kv.crdt
  namespace: sess
  durable: false
```

| フィールド | 型 | 必須 | デフォルト | 説明 |
|------------|-----|------|------------|------|
| `namespace` | string | Yes | - | キー名前空間 |
| `durable` | bool | No | false | fs スナップショットを永続化し、クラスタ全体の再起動後も名前空間が存続するようにする |

書き込みはローカル状態を変更しゴシップ経由で伝播します。競合する並行書き込みは last-writer-wins で収束します。読み取りはローカルです。条件付き書き込みはサポートされません。`durable: false` ではストアはインメモリでありピアから再構築されます。`durable: true` では `<data_dir>/_sys/kvcrdt` にスナップショットされます。

<note>
<code>data_dir</code> はノードレベル（<code>cluster.raft.data_dir</code>）であり、エントリごとではありません。共有 Raft 状態と永続 CRDT スナップショットは <code>&lt;data_dir&gt;/_sys/</code> の下に存在します。
</note>

## TTL動作

両方のストアがtime-to-liveをサポートします。期限切れエントリは`cleanup_interval`でクリーンアップが実行されるまで一時的に残ります。自動クリーンアップを無効にするには`0`に設定してください。

## Lua API

操作については[ストアモジュール](lua/storage/store.md)を参照してください: `get`、`set`、`has`、`delete`、加えてバージョン管理付き・条件付きアクセスのための `put`、`entry`、`list`、`info`。

## 関連項目

- [ストアモジュール](lua/storage/store.md) - Lua APIリファレンス
- [データベース](system/database.md) - `store.sql`のSQLバックエンド
