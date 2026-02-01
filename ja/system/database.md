# データベースシステム

SQL データベース接続プーリングと設定。PostgreSQL、MySQL、SQLite、Microsoft SQL Server、Oracleをサポート。

## エントリ種別

| 種別 | 説明 |
|------|------|
| `db.sql.postgres` | PostgreSQLデータベース |
| `db.sql.mysql` | MySQLデータベース |
| `db.sql.sqlite` | SQLiteデータベース |
| `db.sql.mssql` | Microsoft SQL Server |
| `db.sql.oracle` | Oracleデータベース |

## 設定

### 標準データベース（PostgreSQL、MySQL、MSSQL、Oracle）

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
      max_open: 1
      max_idle: 1
      max_lifetime: "1h"
    options:
      cache: "shared"
    lifecycle:
      auto_start: true
```

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

| フィールド | 型 | 説明 |
|------------|-----|------|
| `file` | string | データベースファイルパスまたは`:memory:` |
| `pool` | object | 接続プール設定 |
| `options` | map | SQLite固有のオプション |
| `lifecycle` | object | ライフサイクル設定 |

### 環境変数フィールド

環境変数または[env.variable](system-env.md)エントリから値をロードするには`_env`サフィックスを使用：

| フィールド | 説明 |
|------------|------|
| `host_env` | 環境変数からのホスト |
| `port_env` | 環境変数からのポート |
| `database_env` | 環境変数からのデータベース名 |
| `username_env` | 環境変数からのユーザー名 |
| `password_env` | 環境変数からのパスワード |

```yaml
- name: prod_db
  kind: db.sql.postgres
  host_env: "DB_HOST"
  port_env: "DB_PORT"
  database_env: "DB_NAME"
  username_env: "DB_USER"
  password_env: "app.secrets:db_password"  # env.variableエントリを参照
```

<warning>
設定にパスワードをハードコードしないでください。認証情報には環境変数または<code>env.variable</code>エントリを使用してください。セキュアなシークレット管理については<a href="system-env.md">環境変数</a>を参照してください。
</warning>

## 接続プール

接続プーリング動作を設定。プール設定はGoの[database/sql接続プール](https://pkg.go.dev/database/sql#DB.SetMaxOpenConns)にマップされます。

| フィールド | 型 | デフォルト | 説明 |
|------------|-----|------------|------|
| `max_open` | int | 0 | 最大オープン接続数（0 = 無制限） |
| `max_idle` | int | 0 | 最大アイドル接続数（0 = 無制限） |
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

各データベースタイプは設定からDSNを構築します：

### PostgreSQL {id="dsn-postgresql"}

```
postgres://username:password@host:port/database?sslmode=disable
```

### MySQL {id="dsn-mysql"}

```
username:password@tcp(host:port)/database?charset=utf8mb4
```

### SQLite {id="dsn-sqlite"}

```
file:/path/to/database.db?cache=shared
:memory:?mode=memory
```

### Microsoft SQL Server {id="dsn-mssql"}

```
sqlserver://username:password@host:port?database=dbname
```

### Oracle {id="dsn-oracle"}

```
oracle://username:password@host:port/service_name
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

```yaml
options:
  cache: "shared"         # shared, private
  mode: "rwc"            # ro, rw, rwc, memory
  _journal_mode: "WAL"   # DELETE, TRUNCATE, PERSIST, MEMORY, WAL, OFF
```

### Microsoft SQL Server {id="options-mssql"}

```yaml
options:
  encrypt: "true"
  TrustServerCertificate: "false"
```

### Oracle {id="options-oracle"}

```yaml
options:
  poolMinSessions: "1"
  poolMaxSessions: "10"
  poolIncrement: "1"
```

## 例

### SSL付きPostgreSQL

```yaml
- name: secure_postgres
  kind: db.sql.postgres
  host: "db.example.com"
  port: 5432
  database: "production"
  username: "app_user"
  password: "${DB_PASSWORD}"
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
  password_env: "REPLICA_PASSWORD"
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
  pool:
    max_open: 1
    max_idle: 1
  options:
    cache: "shared"
    mode: "memory"
```

### 複数データベースセットアップ

```yaml
entries:
  # プライマリデータベース
  - name: users_db
    kind: db.sql.postgres
    host_env: "USERS_DB_HOST"
    port: 5432
    database: "users"
    username_env: "USERS_DB_USER"
    password_env: "USERS_DB_PASSWORD"
    lifecycle:
      auto_start: true

  # 分析データベース
  - name: analytics_db
    kind: db.sql.mysql
    host_env: "ANALYTICS_DB_HOST"
    port: 3306
    database: "analytics"
    username_env: "ANALYTICS_DB_USER"
    password_env: "ANALYTICS_DB_PASSWORD"
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

データベースは[レジストリモジュール](lua-registry.md)を使用してランタイムで登録でき、アプリケーション状態や外部設定に基づいた動的なデータベース設定が可能です。

## Lua API

データベース操作APIについては[SQLモジュール](lua-sql.md)を参照してください。
