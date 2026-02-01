# エントリ種別リファレンス

Wippyで利用可能なすべてのエントリ種別の完全なリファレンス。

> エントリは`namespace:name`形式で相互参照します。レジストリはこれらの参照に基づいて依存関係を自動的に接続し、リソースが正しい順序で初期化されることを保証します。

## 関連項目

- [レジストリ](concept-registry.md) - エントリの保存と解決方法
- [設定](guide-configuration.md) - YAML設定形式

## Luaランタイム

| 種別 | 説明 |
|------|------|
| `function.lua` | Lua関数エントリポイント |
| `process.lua` | 長時間実行Luaプロセス |
| `workflow.lua` | Temporalワークフロー（決定論的） |
| `library.lua` | 共有Luaライブラリ |

```yaml
- name: handler
  kind: function.lua
  source: file://handler.lua
  method: main
  modules:
    - http
    - json
  imports:
    utils: app.lib:helpers  # 別のエントリをモジュールとしてインポート
```

<tip>
<code>imports</code>を使用して他のLuaエントリを参照します。コード内で<code>require("alias_name")</code>を通じて利用可能になります。
</tip>

## HTTPサービス

| 種別 | 説明 |
|------|------|
| `http.service` | HTTPサーバー（ポートをバインド） |
| `http.router` | ルートプレフィックスとミドルウェア |
| `http.endpoint` | HTTPエンドポイント（メソッド + パス） |
| `http.static` | 静的ファイル配信 |

```yaml
# HTTPサーバー
- name: gateway
  kind: http.service
  addr: ":8080"
  lifecycle:
    auto_start: true

# ミドルウェア付きルーター
- name: api
  kind: http.router
  meta:
    server: gateway
  prefix: /api
  middleware:
    - cors
    - rate_limit

# エンドポイント
- name: users_list
  kind: http.endpoint
  meta:
    router: app:api
  method: GET
  path: /users
  func: list_handler
```

**Lua API:** [HTTPモジュール](lua-http.md)を参照

```lua
local http = require("http")
local req = http.request()
local resp = http.response()

resp:status(200):json({users = get_users()})
```

## データベース

| 種別 | 説明 |
|------|------|
| `db.sql.sqlite` | SQLiteデータベース |
| `db.sql.postgres` | PostgreSQLデータベース |
| `db.sql.mysql` | MySQLデータベース |
| `db.sql.mssql` | Microsoft SQL Server |
| `db.sql.oracle` | Oracleデータベース |

### SQLite

```yaml
- name: database
  kind: db.sql.sqlite
  file: "./data/app.db"
  lifecycle:
    auto_start: true

# テスト用インメモリ
- name: testdb
  kind: db.sql.sqlite
  file: ":memory:"
```

### PostgreSQL

```yaml
- name: database
  kind: db.sql.postgres
  dsn: "postgres://user:pass@localhost:5432/dbname?sslmode=disable"
  pool:
    max_open: 25
    max_idle: 5
    max_lifetime: "30m"
  lifecycle:
    auto_start: true
```

### MySQL

```yaml
- name: database
  kind: db.sql.mysql
  dsn: "user:pass@tcp(localhost:3306)/dbname?parseTime=true"
  lifecycle:
    auto_start: true
```

### MSSQL

```yaml
- name: database
  kind: db.sql.mssql
  dsn: "sqlserver://user:pass@localhost:1433?database=dbname"
  lifecycle:
    auto_start: true
```

**Lua API:** [SQLモジュール](lua-sql.md)を参照

```lua
local sql = require("sql")
local db, err = sql.get("app:database")

local rows, err = db:query("SELECT * FROM users WHERE id = ?", user_id)
db:execute("INSERT INTO logs (msg) VALUES (?)", message)
```


## キーバリューストア

| 種別 | 説明 |
|------|------|
| `store.memory` | インメモリキーバリューストア |
| `store.sql` | SQLバックエンドキーバリューストア |

```yaml
# メモリストア
- name: cache
  kind: store.memory
  lifecycle:
    auto_start: true

# SQLバックエンドストア
- name: persistent_store
  kind: store.sql
  database: app:database
  table: kv_store
  lifecycle:
    auto_start: true
```

**Lua API:** [ストアモジュール](lua-store.md)を参照

```lua
local store = require("store")
local s, err = store.get("app:cache")

s:set("user:123", user_data, 3600)  -- TTL（秒）
local data = s:get("user:123")
```

## キュー

| 種別 | 説明 |
|------|------|
| `queue.driver.memory` | インメモリキュードライバ |
| `queue.queue` | キュー宣言 |
| `queue.consumer` | キューコンシューマ |

```yaml
# ドライバ
- name: queue_driver
  kind: queue.driver.memory
  lifecycle:
    auto_start: true

# キュー
- name: jobs
  kind: queue.queue
  driver: queue_driver

# コンシューマ
- name: job_consumer
  kind: queue.consumer
  queue: app:jobs
  func: job_handler
  concurrency: 4
  prefetch: 10
  lifecycle:
    auto_start: true
```

**Lua API:** [キューモジュール](lua-queue.md)を参照

```lua
local queue = require("queue")

-- メッセージを公開
queue.publish("app:jobs", {task = "process", id = 123})

-- コンシューマハンドラ内で現在のメッセージにアクセス
local msg = queue.message()
local data = msg:body_json()
```

<note>
コンシューマの<code>func</code>は各メッセージに対して呼び出されます。ハンドラ内で<code>queue.message()</code>を使用して現在のメッセージにアクセスします。
</note>

## プロセス管理

| 種別 | 説明 |
|------|------|
| `process.host` | プロセス実行ホスト |
| `process.service` | 監督されたプロセス（process.luaをラップ） |
| `terminal.host` | ターミナル/CLIホスト |

```yaml
# プロセスホスト（プロセスが実行される場所）
- name: processes
  kind: process.host
  host:
    workers: 32             # ワーカーgoroutine（デフォルト: NumCPU）
    queue_size: 1024        # グローバルキュー容量
    local_queue_size: 256   # ワーカーごとのキュー
  lifecycle:
    auto_start: true

# プロセス定義
- name: worker_process
  kind: process.lua
  source: file://worker.lua
  method: main

# 監督されたプロセスサービス
- name: worker
  kind: process.service
  process: app:worker_process
  host: app:processes
  input: ["arg1", "arg2"]
  lifecycle:
    auto_start: true
    restart:
      max_attempts: 10

- name: terminal
  kind: terminal.host
  lifecycle:
    auto_start: true
```

<tip>
プロセスを自動再起動付きの監督されたサービスとして実行する必要がある場合は<code>process.service</code>を使用します。<code>process</code>フィールドは<code>process.lua</code>エントリを参照します。
</tip>

## Temporal（ワークフロー）

| 種別 | 説明 |
|------|------|
| `temporal.client` | Temporalクライアント接続 |
| `temporal.worker` | Temporalワーカー |

```yaml
- name: temporal_client
  kind: temporal.client
  address: "localhost:7233"
  namespace: "default"
  auth:
    type: none  # none, api_key, mtls
  lifecycle:
    auto_start: true

- name: temporal_worker
  kind: temporal.worker
  client: temporal_client
  task_queue: "main-queue"
  lifecycle:
    auto_start: true
```

## クラウドストレージ

| 種別 | 説明 |
|------|------|
| `config.aws` | AWS設定 |
| `cloudstorage.s3` | S3バケットアクセス |

```yaml
- name: aws
  kind: config.aws
  region: "us-east-1"
  access_key_id_env: "AWS_ACCESS_KEY_ID"
  secret_access_key_env: "AWS_SECRET_ACCESS_KEY"

- name: uploads
  kind: cloudstorage.s3
  config: app:aws
  bucket: "my-uploads"
  endpoint: ""  # オプション、S3互換サービス用
```

**Lua API:** [クラウドストレージモジュール](lua-cloudstorage.md)を参照

```lua
local cloudstorage = require("cloudstorage")
local storage, err = cloudstorage.get("app:uploads")

storage:upload_object("files/doc.pdf", file_content)
local url = storage:presigned_get_url("files/doc.pdf", {expires = "1h"})
```

<tip>
MinIOやDigitalOcean SpacesなどのS3互換サービスに接続するには<code>endpoint</code>を使用します。
</tip>

## ファイルシステム

| 種別 | 説明 |
|------|------|
| `fs.directory` | ディレクトリアクセス |

```yaml
- name: data_dir
  kind: fs.directory
  directory: "./data"
  auto_init: true   # 存在しない場合は作成
  mode: "0755"      # パーミッション
```

**Lua API:** [ファイルシステムモジュール](lua-fs.md)を参照

```lua
local fs = require("fs")
local filesystem, err = fs.get("app:data_dir")

local file = filesystem:open("output.txt", "w")
file:write("Hello, World!")
file:close()
```

## 環境変数

| 種別 | 説明 |
|------|------|
| `env.storage.memory` | インメモリ環境変数ストレージ |
| `env.storage.file` | ファイルベース環境変数ストレージ |
| `env.storage.os` | OS環境変数 |
| `env.storage.router` | 環境変数ルーター（複数ストレージ） |
| `env.variable` | 環境変数 |

```yaml
- name: os_env
  kind: env.storage.os

- name: file_env
  kind: env.storage.file
  file_path: ".env"
  auto_create: true

- name: app_env
  kind: env.storage.router
  storages:
    - app:os_env
    - app:file_env
```

**Lua API:** [Envモジュール](lua-env.md)を参照

```lua
local env = require("env")

local api_key = env.get("API_KEY")
env.set("CACHE_TTL", "3600")
```

<note>
ルーターはストレージを順番に試行します。読み取りは最初のマッチが勝ちます。書き込みは最初の書き込み可能なストレージに送られます。
</note>

## テンプレート

| 種別 | 説明 |
|------|------|
| `template.jet` | 個別のJetテンプレート |
| `template.set` | テンプレートセット設定 |

```yaml
# エンジン設定付きテンプレートセット
- name: templates
  kind: template.set
  engine:
    development_mode: false
    extensions:
      - ".jet"
      - ".html.jet"

# 個別テンプレート
- name: email_template
  kind: template.jet
  source: file://templates/email.jet
  set: app:templates
```

**Lua API:** [テンプレートモジュール](lua-template.md)を参照

```lua
local templates = require("templates")
local set, err = templates.get("app:templates")

local html = set:render("email", {
    user = "Alice",
    message = "Welcome!"
})
```

## セキュリティ

| 種別 | 説明 |
|------|------|
| `security.policy` | 条件付きセキュリティポリシー |
| `security.policy.expr` | 式ベースのポリシー |
| `security.token_store` | トークンストレージ |

```yaml
# 条件ベースのポリシー
- name: admin_policy
  kind: security.policy
  policy:
    actions: "*"
    resources: "*"
    effect: allow
    conditions:
      - field: "actor.meta.role"
        operator: eq
        value: "admin"

# 式ベースのポリシー
- name: owner_policy
  kind: security.policy.expr
  policy:
    actions: "*"
    resources: "*"
    effect: allow
    expression: 'actor.id == meta.owner_id || actor.meta.role == "admin"'
```

**Lua API:** [セキュリティモジュール](lua-security.md)を参照

```lua
local security = require("security")

-- アクション前に権限をチェック
if security.can("delete", "users", {user_id = id}) then
    delete_user(id)
end

-- 現在のアクターを取得
local actor = security.actor()
```

<warning>
ポリシーは順番に評価されます。最初にマッチしたポリシーがアクセスを決定します。より具体的なポリシーを一般的なポリシーの前に配置してください。
</warning>

## コントラクト（依存性注入）

| 種別 | 説明 |
|------|------|
| `contract.definition` | メソッド仕様を持つインターフェース |
| `contract.binding` | コントラクトメソッドを関数実装にマップ |

```yaml
# コントラクトインターフェースを定義
- name: greeter
  kind: contract.definition
  methods:
    - name: greet
      description: 挨拶メッセージを返す
    - name: greet_with_name
      description: パーソナライズされた挨拶を返す
      input_schemas:
        - format: "application/schema+json"
          definition: {"type": "string"}
      output_schemas:
        - format: "application/schema+json"
          definition: {"type": "string"}

# 実装関数
- name: greeter_greet
  kind: function.lua
  source: file://greeter_greet.lua
  method: main

- name: greeter_greet_name
  kind: function.lua
  source: file://greeter_greet_name.lua
  method: main

# コントラクトメソッドを実装にバインド
- name: greeter_impl
  kind: contract.binding
  contracts:
    - contract: app:greeter
      default: true
      methods:
        greet: app:greeter_greet
        greet_with_name: app:greeter_greet_name
```

Luaからの使用：

```lua
local contract = require("contract")

-- IDでバインディングを開く
local greeter, err = contract.open("app:greeter_impl")

-- メソッドを呼び出す
local result = greeter:greet()
local personalized = greeter:greet_with_name("Alice")

-- インスタンスがコントラクトを実装しているかチェック
local is_greeter = contract.is(greeter, "app:greeter")
```

**Lua API:** [コントラクトモジュール](lua-contract.md)を参照

<tip>
1つのバインディングを<code>default: true</code>としてマークすると、バインディングIDを指定せずにコントラクトを開くときに使用されます（<code>context_required</code>フィールドが設定されていない場合のみ動作）。
</tip>

## 実行

| 種別 | 説明 |
|------|------|
| `exec.native` | ネイティブコマンド実行 |
| `exec.docker` | Dockerコンテナ実行 |

```yaml
- name: native_exec
  kind: exec.native
  default_work_dir: "/app"
  command_whitelist:
    - "ls"
    - "cat"

- name: docker_exec
  kind: exec.docker
  image: "python:3.11-slim"
  default_work_dir: "/workspace"
  auto_remove: true
  memory_limit: 536870912  # 512MB
  command_whitelist:
    - "python"
```

## ライフサイクル設定

ほとんどのエントリはライフサイクル設定をサポートします：

```yaml
- name: service
  kind: some.kind
  lifecycle:
    auto_start: true          # 自動起動
    start_timeout: 10s        # 最大起動時間
    stop_timeout: 10s         # 最大シャットダウン時間
    stable_threshold: 5s      # 安定とみなす時間
    depends_on:
      - app:database
    restart:                  # リトライポリシー
      initial_delay: 1s
      max_delay: 90s
      backoff_factor: 2.0
      max_attempts: 0         # 0 = 無限
```

<note>
エントリが正しい順序で起動することを保証するには<code>depends_on</code>を使用します。スーパーバイザは依存先のエントリを起動する前に、依存関係が安定するのを待ちます。
</note>

## エントリ参照形式

エントリは`namespace:name`形式で参照されます：

```yaml
# 定義
namespace: app.users
entries:
  - name: handler
    kind: function.lua

# 別のエントリからの参照
func: app.users:handler
```
