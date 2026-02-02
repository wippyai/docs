# ストア（キーバリュー）

TTLサポート付きのインメモリおよびSQLバックエンドキーバリューストア。

## エントリ種別

| 種別 | 説明 |
|------|------|
| `store.memory` | 自動クリーンアップ付きインメモリストア |
| `store.sql` | 永続化付きSQLバックエンドストア |

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

## TTL動作

両方のストアがtime-to-liveをサポートします。期限切れエントリは`cleanup_interval`でクリーンアップが実行されるまで一時的に残ります。自動クリーンアップを無効にするには`0`に設定してください。

## Lua API

操作（get、set、delete、exists、clear）については[ストアモジュール](lua/storage/store.md)を参照してください。
