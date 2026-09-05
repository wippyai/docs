---
title: "データベースシステム"
description: "SQL データベース接続プーリングと設定。PostgreSQL、MySQL、SQLiteをサポート。"
---

# データベースシステム

SQL データベース接続プーリングと設定。PostgreSQL、MySQL、SQLiteをサポート。

## エントリ種別

| 種別 | 説明 |
|------|------|
| `db.sql.postgres` | PostgreSQLデータベース |
| `db.sql.mysql` | MySQLデータベース |
| `db.sql.sqlite` | SQLiteデータベース |

## 設定

### 標準データベース（PostgreSQL、MySQL）

```yaml
# src/data/_index.yaml
version: "1.0"
namespace: app.data

entries:
  - name: main_db
    kind: db.sql.postgres
    host: "localhost"
    port: 5432
    database: "myapp"
    username: "dbuser"
    password: "dbpass"
    pool:
      max_open: 25
      max_idle: 5
      max_lifetime: "1h"
    options:
      sslmode: "disable"
    lifecycle:
      auto_start: true
```

### SQLite

```yaml
  - name: cache_db
    kind: db.sql.sqlite
    file: "/var/data/cache.db"  # インメモリには:memory:を使用
    pool:
      max_open: 4
      max_idle: 2
      max_lifetime: "1h"
    lifecycle:
      auto_start: true
```

<note>
プライベートなインメモリSQLiteデータベース（<code>file: ":memory:"</code>）は1本の物理接続にスコープされるため、<code>max_open</code>と<code>max_idle</code>は<code>1</code>に強制されます。ファイルベースのデータベースは設定された<code>pool</code>の値をそのまま使用します。CDCのスナップショット読み取りトランザクションが唯一のライター接続を占有しないために、これが必要です。ジャーナルモードは常に<code>WAL</code>です。
</note>

## 接続フィールド

### 標準データベースフィールド

| フィールド | 型 | 説明 |
|------------|-----|------|
| `host` | string | データベースホストアドレス |
| `port` | int | データベースポート番号 |
| `database` | string | データベース名 |
| `username` | string | データベースユーザー |
| `password` | string | データベースパスワード |
| `pool` | object | 接続プール設定 |
| `options` | map | データベース固有のオプション |
| `lifecycle` | object | ライフサイクル設定 |

### SQLiteフィールド

| フィールド | 型 | デフォルト | 説明 |
|------------|-----|-----------|------|
| `file` | string | 必須 | データベースファイルパスまたは`:memory:` |
| `pool` | object | - | 接続プール設定。`:memory:`では`max_open`と`max_idle`は`1`に強制される |
| `max_mutation_changes` | int | 100000 | コミット済みミューテーションオブザーバーで1トランザクションが保持できる行数 |
| `max_mutation_bytes` | int | 67108864 | オブザーバーで1トランザクションが保持できる論理バイト数（64 MiB） |
| `options` | map | - | 受け付けられるが無視される |
| `lifecycle` | object | - | ライフサイクル設定 |

`max_mutation_changes`と`max_mutation_bytes`は、[`db.cdc.sqlite`](system/cdc.md)ソースに供給するインメモリのコミット済みミューテーションオブザーバーの上限を定めます。いずれのフィールドも0を指定するとデフォルトが選択され、負の値は拒否されます。この上限は厳密ではなく保守的なものです。SQLiteはpre-updateフックに行全体を渡すため、上限が候補を拒否する前に1行が実体化することがあります。

### シークレットと環境変数の値

接続値は`${env:NAME}`プレースホルダで[環境レジストリ](system/env.md)から取得され、デコード時に解決されます。`NAME`は登録済み変数の公開名またはそのエントリID（例: `app.secrets:db_password`）であり、生のOS環境変数ではありません。

```yaml
- name: prod_db
  kind: db.sql.postgres
  host: ${env:DB_HOST}
  port: ${env:DB_PORT}
  database: ${env:DB_NAME}
  username: ${env:DB_USER}
  password: ${env:app.secrets:db_password}
```

<note>
古い設定では、同じ方法で解決される兄弟の<code>&lt;field&gt;_env</code>ディレクティブ（<code>host_env</code>、<code>port_env</code>、<code>database_env</code>、<code>username_env</code>、<code>password_env</code>）を使用します。この形式は<b>非推奨</b>です — 上記の<code>${env:NAME}</code>プレースホルダに移行してください。
</note>

<warning>
設定にパスワードをハードコードしないでください。認証情報には<code>env.variable</code>エントリを使用してください。セキュアなシークレット管理については<a href="system/env.md">環境変数</a>を参照してください。
</warning>

## 接続プール

接続プーリング動作を設定。プール設定はGoの[database/sql接続プール](https://pkg.go.dev/database/sql#DB.SetMaxOpenConns)にマップされます。

| フィールド | 型 | デフォルト | 説明 |
|------------|-----|------------|------|
| `max_open` | int | 0 | 最大オープン接続数（0 = 無制限） |
| `max_idle` | int | 0 | 最大アイドル接続数（0 = アイドル接続を保持しない） |
| `max_lifetime` | duration | 1h | 最大接続寿命 |

```yaml
pool:
  max_open: 25      # 同時接続を制限
  max_idle: 5       # 5接続を準備状態に維持
  max_lifetime: "30m"  # 30分ごとに接続をリサイクル
```

<tip>
<code>max_idle</code>は<code>max_open</code>以下に設定してください。<code>max_lifetime</code>を超えた接続は閉じられて置き換えられ、古い接続からの回復に役立ちます。
</tip>

## DSN形式

各データベースタイプは設定からDSNを構築します。`options`はすべて（キー順にソートして）付加されます。デフォルトで含まれるものはありません。

### PostgreSQL {id="dsn-postgresql"}

```
host='host' port=port user='username' password='password' dbname='database' [option='value' ...]
```

ポート以外のすべての値はシングルクォートで囲まれ、埋め込まれた`'`と`\`はバックスラッシュでエスケープされます。そのため、スペースやクォートを含むホスト、パスワード、オプション値もそのまま渡されます。

### MySQL {id="dsn-mysql"}

```
username:password@tcp(host:port)/database[?option=value&...]
```

### SQLite {id="dsn-sqlite"}

```
file:/path/to/database.db?mode=rwc
:memory:
```

## データベースオプション

一般的なデータベース固有のオプション：

### PostgreSQL {id="options-postgresql"}

```yaml
options:
  sslmode: "require"      # disable, require, verify-ca, verify-full
  connect_timeout: "10"   # 接続タイムアウト（秒）
  application_name: "myapp"
```

### MySQL {id="options-mysql"}

```yaml
options:
  charset: "utf8mb4"
  parseTime: "true"       # 時間値をtime.Timeにパース
  loc: "Local"            # タイムゾーン
```

### SQLite {id="options-sqlite"}

SQLiteは`options`マップをDSNに適用しません。ファイルデータベースは常に`mode=rwc`で開かれ、ジャーナルモードは常に`WAL`に設定されます。`options`フィールドは受け付けられますが無視されます。

## 例

### SSL付きPostgreSQL

```yaml
- name: secure_postgres
  kind: db.sql.postgres
  host: "db.example.com"
  port: 5432
  database: "production"
  username: "app_user"
  password: ${env:app.secrets:db_password}
  pool:
    max_open: 50
    max_idle: 10
    max_lifetime: "1h"
  options:
    sslmode: "verify-full"
    sslcert: "/certs/client.crt"
    sslkey: "/certs/client.key"
    sslrootcert: "/certs/ca.crt"
  lifecycle:
    auto_start: true
```

### MySQLリードレプリカ

```yaml
- name: mysql_replica
  kind: db.sql.mysql
  host: "replica.db.example.com"
  port: 3306
  database: "app"
  username: "readonly"
  password: ${env:app.secrets:replica_password}
  pool:
    max_open: 20
    max_idle: 5
    max_lifetime: "30m"
  options:
    charset: "utf8mb4"
    parseTime: "true"
    readTimeout: "30s"
```

### SQLiteインメモリ

```yaml
- name: test_db
  kind: db.sql.sqlite
  file: ":memory:"
```

### 複数データベースセットアップ

```yaml
entries:
  # プライマリデータベース
  - name: users_db
    kind: db.sql.postgres
    host: ${env:USERS_DB_HOST}
    port: 5432
    database: "users"
    username: ${env:USERS_DB_USER}
    password: ${env:app.secrets:users_db_password}
    lifecycle:
      auto_start: true

  # 分析データベース
  - name: analytics_db
    kind: db.sql.mysql
    host: ${env:ANALYTICS_DB_HOST}
    port: 3306
    database: "analytics"
    username: ${env:ANALYTICS_DB_USER}
    password: ${env:app.secrets:analytics_db_password}
    lifecycle:
      auto_start: true

  # ローカルキャッシュ
  - name: cache
    kind: db.sql.sqlite
    file: "/var/cache/app.db"
    lifecycle:
      auto_start: true
```

## ランタイム登録

データベースは[レジストリモジュール](lua/core/registry.md)を使用してランタイムで登録でき、アプリケーション状態や外部設定に基づいた動的なデータベース設定が可能です。

## Lua API

データベース操作APIについては[SQLモジュール](lua/storage/sql.md)を参照してください。

## 関連項目

- [SQLモジュール](lua/storage/sql.md) - Lua APIリファレンス
- [ストア](system/store.md) - `db.sql.*`データベースをバックエンドとするキーバリューストア
- [キュー](system/queue.md) - SQLバックエンドのキューハンドラ
- [変更データキャプチャ](system/cdc.md) - `db.sql.sqlite`またはPostgresデータベースからの行レベル変更のストリーミング
