---
title: "データベースシステム"
description: "SQL データベースの接続プールと設定。PostgreSQL、MySQL、SQLite をサポートします。"
---

# データベースシステム

Wippy は、PostgreSQL と MySQL 用の接続プール付き SQL データベースエントリ、および単一接続の SQLite エントリを提供します。

このページは設定リファレンスです。コードブロックに `version`、`namespace`、`entries` が含まれていない場合は、既存のエントリリスト内に配置する断片として扱ってください。

## エントリ種別

| 種別 | 説明 |
|------|------|
| `db.sql.postgres` | PostgreSQL データベース |
| `db.sql.mysql` | MySQL データベース |
| `db.sql.sqlite` | SQLite データベース |

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
    password: ${env:app.secrets:db_password}
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
    file: "/var/data/cache.db"  # Use :memory: for in-memory
    pool:
      max_lifetime: "1h"
    lifecycle:
      auto_start: true
```

<note>
SQLite は常に単一接続で動作し（<code>max_open</code> と <code>max_idle</code> は <code>1</code> に固定）、ジャーナルモードは <code>WAL</code> です。<code>max_lifetime</code> だけが <code>pool</code> から適用されます。
</note>

## 接続フィールド

### 標準データベースフィールド

| フィールド | 型 | 説明 |
|------------|-----|------|
| `host` | string | データベースホストのアドレス |
| `port` | int | データベースのポート番号 |
| `database` | string | データベース名 |
| `username` | string | データベースユーザー |
| `password` | string | データベースパスワード |
| `pool` | object | 接続プールの設定 |
| `options` | map | データベース固有のオプション |
| `lifecycle` | object | ライフサイクル設定 |

### SQLite フィールド

| フィールド | 型 | 説明 |
|------------|-----|------|
| `file` | string | データベースファイルのパスまたは `:memory:` |
| `pool` | object | `max_lifetime` のみ適用（接続数は 1 に固定） |
| `options` | map | 受け付けるが無視される |
| `lifecycle` | object | ライフサイクル設定 |

### シークレットと環境変数の値

接続値は、デコード時に解決される `${env:NAME}` プレースホルダーを使用して[環境変数レジストリ](./env.md)から取得します。`NAME` は登録済み変数の公開名またはエントリ ID（例: `app.secrets:db_password`）であり、生の OS 環境変数ではありません。

```yaml
- name: prod_db
  kind: db.sql.postgres
  host: ${env:DB_HOST}
  port: ${env:DB_PORT|5432}
  database: ${env:DB_NAME}
  username: ${env:DB_USER}
  password: ${env:app.secrets:db_password}
```

<note>
古い設定では、同じ方法で解決される兄弟キーの <code>&lt;field&gt;_env</code> ディレクティブ（<code>host_env</code>、<code>port_env</code>、<code>database_env</code>、<code>username_env</code>、<code>password_env</code>）を使用します。この形式は<b>非推奨</b>です。上記の <code>${env:NAME}</code> プレースホルダーに移行してください。
</note>

<warning>
設定にパスワードをハードコードしないでください。認証情報には <code>env.variable</code> エントリを使用します。シークレットの設定については、<a href="./env.md">環境変数</a>を参照してください。
</warning>

## 接続プール

接続プールの動作を設定します。プール設定は Go の [database/sql 接続プール](https://pkg.go.dev/database/sql#DB.SetMaxOpenConns)に対応します。

| フィールド | 型 | デフォルト | 説明 |
|------------|-----|------------|------|
| `max_open` | int | 0 | 最大オープン接続数（0 = 無制限） |
| `max_idle` | int | 0 | 最大アイドル接続数（0 = アイドル接続を保持しない） |
| `max_lifetime` | duration | 1h | 接続の最大存続時間 |

```yaml
pool:
  max_open: 25      # Limit concurrent connections
  max_idle: 5       # Keep 5 connections ready
  max_lifetime: "30m"  # Recycle connections every 30 minutes
```

<tip>
<code>max_idle</code> は <code>max_open</code> 以下に設定してください。<code>max_lifetime</code> を超えた接続は閉じられて置き換えられるため、古くなった接続からの回復に役立ちます。
</tip>

## DSN 形式

各データベース種別は設定から DSN を構築します。`options` はキーでソートされて追加されます。デフォルトではオプションは含まれません。

### PostgreSQL {id="dsn-postgresql"}

```
host=host port=port user=username password=password dbname=database [option=value ...]
```

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

一般的なデータベース固有のオプション:

### PostgreSQL {id="options-postgresql"}

```yaml
options:
  sslmode: "require"      # disable, require, verify-ca, verify-full
  connect_timeout: "10"   # Connection timeout in seconds
  application_name: "myapp"
```

### MySQL {id="options-mysql"}

```yaml
options:
  charset: "utf8mb4"
  parseTime: "true"       # Parse time values to time.Time
  loc: "Local"            # Timezone
```

### SQLite {id="options-sqlite"}

SQLite は `options` マップを DSN に適用しません。ファイルデータベースは常に `mode=rwc` で開かれ、ジャーナルモードは常に `WAL` に設定されます。`options` フィールドは受け付けられますが、無視されます。

## 例

### SSL を使用する PostgreSQL

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

### MySQL 読み取りレプリカ

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

### SQLite インメモリ

```yaml
- name: test_db
  kind: db.sql.sqlite
  file: ":memory:"
```

### 複数データベースの設定

```yaml
entries:
  # Primary database
  - name: users_db
    kind: db.sql.postgres
    host: ${env:USERS_DB_HOST}
    port: 5432
    database: "users"
    username: ${env:USERS_DB_USER}
    password: ${env:app.secrets:users_db_password}
    lifecycle:
      auto_start: true

  # Analytics database
  - name: analytics_db
    kind: db.sql.mysql
    host: ${env:ANALYTICS_DB_HOST}
    port: 3306
    database: "analytics"
    username: ${env:ANALYTICS_DB_USER}
    password: ${env:app.secrets:analytics_db_password}
    lifecycle:
      auto_start: true

  # Local cache
  - name: cache
    kind: db.sql.sqlite
    file: "/var/cache/app.db"
    lifecycle:
      auto_start: true
```

## ランタイム登録

データベースは、[レジストリモジュール](../lua/core/registry.md)を使用して実行時に登録できます。

## Lua API

クエリ、トランザクション、接続の操作については、[SQL モジュール](../lua/storage/sql.md)を参照してください。

## 関連項目

- [SQL モジュール](../lua/storage/sql.md) - Lua API リファレンス
- [ストア](./store.md) - `db.sql.*` データベースをバックエンドとするキーバリューストア
- [キュー](./queue.md) - SQL をバックエンドとするキューハンドラー
