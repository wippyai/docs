---
title: "エントリ種別リファレンス"
description: "ランタイム、ストレージ、ネットワーク、セキュリティ、実行、ライフサイクル各システムの Wippy エントリ種別リファレンス。"
---

# エントリ種別リファレンス

このページでは利用可能なエントリ種別をまとめ、各モジュールとシステムの詳細リファレンスへのリンクを示します。

YAML と Lua のブロックは、単一アプリケーションの全体ではなくリファレンス用の断片です。レジストリ ID、認証情報、データオブジェクト、`get_users` や `delete_user` などのヘルパーは説明用です。完全な戻り値とエラーの契約については、リンク先のモジュールページを参照してください。

> エントリは`namespace:name`形式で相互参照します。レジストリはこれらの参照に基づいて依存関係を自動的に接続し、リソースが正しい順序で初期化されることを保証します。

## 関連項目

- [レジストリ](../concepts/registry.md) — エントリの保存と解決方法
- [設定](./configuration.md) — YAML 設定形式

## Luaランタイム

| 種別 | 説明 |
|------|------|
| `function.lua` | Lua関数エントリポイント |
| `process.lua` | 長時間実行Luaプロセス |
| `workflow.lua` | Temporalワークフロー（決定論的） |
| `library.lua` | 共有Luaライブラリ |
| `module.lua` | Luaモジュールインターフェース |
| `function.lua.bc` | プリコンパイル済み関数バイトコード |
| `library.lua.bc` | プリコンパイル済みライブラリバイトコード |
| `process.lua.bc` | プリコンパイル済みプロセスバイトコード |
| `workflow.lua.bc` | プリコンパイル済みワークフローバイトコード |

```yaml
- name: handler
  kind: function.lua
  source: file://handler.lua
  method: main
  modules:
    - http
    - json
  imports:
    utils: app.lib:helpers  # Import another entry as module
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
# HTTP server
- name: gateway
  kind: http.service
  addr: ":8080"
  lifecycle:
    auto_start: true

# Router with middleware
- name: api
  kind: http.router
  meta:
    server: gateway
  prefix: /api
  middleware:
    - cors
    - ratelimit

# Endpoint
- name: users_list
  kind: http.endpoint
  meta:
    router: app:api
  method: GET
  path: /users
  func: list_handler
```

**Lua API:** [HTTP モジュール](../lua/http/http.md)を参照

```lua
local http = require("http")
local req = http.request()
local resp = http.response()

resp:set_status(200)
resp:write_json({users = get_users()})
```

## データベース

| 種別 | 説明 |
|------|------|
| `db.sql.sqlite` | SQLiteデータベース |
| `db.sql.postgres` | PostgreSQLデータベース |
| `db.sql.mysql` | MySQLデータベース |
| `db.cdc.postgres` | Postgres の Change Data Capture ソース（[CDC](../system/cdc.md)を参照） |

### SQLite

```yaml
- name: database
  kind: db.sql.sqlite
  file: "./data/app.db"
  lifecycle:
    auto_start: true

# In-memory for testing
- name: testdb
  kind: db.sql.sqlite
  file: ":memory:"
```

### PostgreSQL

```yaml
- name: database
  kind: db.sql.postgres
  host: localhost
  port: 5432
  database: dbname
  username: user
  password: pass
  options:
    sslmode: disable
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
  host: localhost
  port: 3306
  database: dbname
  username: user
  password: pass
  options:
    parseTime: "true"
  lifecycle:
    auto_start: true
```

`${env:NAME}` シークレット参照、TLS オプション、接続プールの調整については[データベース](../system/database.md)を参照してください。データベースエントリの背後にある env ベースの値が変更されると、プールはライブで入れ替わり、使用中の接続は古い設定のまま処理を完了します。

**Lua API:** [SQL モジュール](../lua/storage/sql.md)を参照

```lua
local sql = require("sql")
local db, err = sql.get("app:database")

local rows, err = db:query("SELECT * FROM users WHERE id = ?", {user_id})
db:execute("INSERT INTO logs (msg) VALUES (?)", {message})
```


## キーバリューストア

| 種別 | 説明 |
|------|------|
| `store.memory` | インメモリキーバリューストア |
| `store.sql` | SQLバックエンドキーバリューストア |
| `store.kv.raft` | クラスタレプリケート、強整合性 KV（共有 Raft） |
| `store.kv.crdt` | クラスタレプリケート、最終的整合性 KV（ゴシップ/CRDT） |

```yaml
# Memory store
- name: cache
  kind: store.memory
  lifecycle:
    auto_start: true

# SQL-backed store
- name: persistent_store
  kind: store.sql
  database: app:database
  table_name: kv_store
  lifecycle:
    auto_start: true

# Cluster-replicated store (requires clustering)
- name: deployments
  kind: store.kv.raft
  namespace: deploy
```

`store.kv.*` 種別では[クラスタリング](./cluster.md)を有効にする必要があります。整合性のトレードオフについては[ストア](../system/store.md#cluster-kv-stores)を参照してください。

**Lua API:** [ストアモジュール](../lua/storage/store.md)を参照

```lua
local store = require("store")
local s, err = store.get("app:cache")

s:set("user:123", user_data, 3600)  -- TTL in seconds
local data = s:get("user:123")
```

## キュー

| 種別 | 説明 |
|------|------|
| `queue.driver.memory` | インメモリキュードライバ |
| `queue.driver.amqp` | AMQP (RabbitMQ) ドライバ |
| `queue.driver.sqs` | AWS SQS ドライバ |
| `queue.queue` | キュー宣言 |
| `queue.consumer` | キューコンシューマ |

```yaml
# Driver
- name: queue_driver
  kind: queue.driver.memory
  lifecycle:
    auto_start: true

# Queue
- name: jobs
  kind: queue.queue
  driver: queue_driver

# Consumer
- name: job_consumer
  kind: queue.consumer
  queue: app:jobs
  func: job_handler
  concurrency: 4
  prefetch: 10
  lifecycle:
    auto_start: true
```

**Lua API:** [キューモジュール](../lua/storage/queue.md)を参照

```lua
local queue = require("queue")

-- Publish a message
queue.publish("app:jobs", {task = "process", id = 123})

-- In a consumer handler: the message body is the handler's argument
local function main(data)
    -- access delivery metadata via the current message
    local msg = queue.message()
    local id = msg:id()
    local priority = msg:header("priority")
    msg:ack()
end
```

<note>
コンシューマの <code>func</code> はメッセージごとに 1 回、メッセージ本文を引数として呼び出されます。ハンドラ内で <code>queue.message()</code> を使うと、配信の <code>id()</code>、<code>header()</code>/<code>headers()</code>、<code>ack()</code>/<code>nack()</code> にアクセスできます。
</note>

## プロセス管理

| 種別 | 説明 |
|------|------|
| `process.host` | プロセス実行ホスト |
| `process.service` | 監督されたプロセス（process.luaをラップ） |
| `terminal.host` | ターミナル/CLIホスト |
| `pg.scope` | プロセスグループのスコープ（[プロセスグループ](../system/process-groups.md)を参照） |

```yaml
# Process host (where processes run)
- name: processes
  kind: process.host
  host:
    workers: 32             # Worker goroutines (default: NumCPU)
    queue_size: 1024        # Global queue capacity
    local_queue_size: 256   # Per-worker queue
  lifecycle:
    auto_start: true

# Process definition
- name: worker_process
  kind: process.lua
  source: file://worker.lua
  method: main

# Supervised process service
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

稼働中の`process.host`エントリを更新すると、`host.workers`はその場で再スケールされます — 実行中のプロセス、PID、キューは保持されます。`host.queue_size`、`host.local_queue_size`、`lifecycle`は構築時に固定されており、これらを変更するライブ更新は拒否されます。ワーカーがアフィニティ管理されているホストでのワーカー数の変更も同様に拒否されます。

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
  access_key_id: ${env:AWS_ACCESS_KEY_ID}
  secret_access_key: ${env:AWS_SECRET_ACCESS_KEY}

- name: uploads
  kind: cloudstorage.s3
  config: app:aws
  bucket: "my-uploads"
  endpoint: ""  # Optional, for S3-compatible services
```

**Lua API:** [クラウドストレージモジュール](../lua/storage/cloud.md)を参照

```lua
local cloudstorage = require("cloudstorage")
local storage, err = cloudstorage.get("app:uploads")

storage:upload_object("files/doc.pdf", file_content)
local url = storage:presigned_get_url("files/doc.pdf", {expiration = 3600})  -- seconds, default 3600
```

<tip>
MinIOやDigitalOcean SpacesなどのS3互換サービスに接続するには<code>endpoint</code>を使用します。
</tip>

## ファイルシステム

| 種別 | 説明 |
|------|------|
| `fs.directory` | ディレクトリアクセス |
| `fs.embed` | 読み取り専用組み込みファイルシステム |

```yaml
- name: data_dir
  kind: fs.directory
  directory: "./data"
  auto_init: true   # Create if not exists
  mode: "0755"      # Permissions
```

**Lua API:** [ファイルシステムモジュール](../lua/storage/filesystem.md)を参照

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
| `env.storage.static` | 読み取り専用の静的キーバリューストレージ |
| `env.storage.router` | 環境変数ルーター（複数ストレージ） |
| `env.variable` | 環境変数 |

```yaml
- name: os_env
  kind: env.storage.os

- name: file_env
  kind: env.storage.file
  file_path: ".env"
  auto_create: true

- name: defaults
  kind: env.storage.static
  values:
    PUBLIC_API_HOST: "https://api.example.com"
    APP_ENV: "production"

- name: app_env
  kind: env.storage.router
  storages:
    - app:os_env
    - app:file_env
    - app:defaults
```

**Lua API:** [Env モジュール](../lua/system/env.md)を参照

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
# Template set with engine configuration
- name: templates
  kind: template.set
  engine:
    development_mode: false
    extensions:
      - ".jet"
      - ".html.jet"

# Individual template
- name: email_template
  kind: template.jet
  source: file://templates/email.jet
  set: app:templates
```

**Lua API:** [テンプレートモジュール](../lua/text/template.md)を参照

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
# Condition-based policy
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

# Expression-based policy
- name: owner_policy
  kind: security.policy.expr
  policy:
    actions: "*"
    resources: "*"
    effect: allow
    expression: 'actor.id == meta.owner_id || actor.meta.role == "admin"'
```

**Lua API:** [セキュリティモジュール](../lua/security/security.md)を参照

```lua
local security = require("security")

-- Check permission before action
if security.can("delete", "users", {user_id = id}) then
    delete_user(id)
end

-- Get current actor
local actor = security.actor()
```

<warning>
ポリシーの順序でアクセスが決まるわけではありません。スコープはポリシーの判定を組み合わせ、マッチする <code>deny</code> はマッチする <code>allow</code> より優先され、ただちに評価を停止する場合があります。どのポリシーにもマッチしなければ、許可ではなく未定義の結果になります。
</warning>

## コントラクト（依存性注入）

| 種別 | 説明 |
|------|------|
| `contract.definition` | メソッド仕様を持つインターフェース |
| `contract.binding` | コントラクトメソッドを関数実装にマップ |

```yaml
# Define the contract interface
- name: greeter
  kind: contract.definition
  methods:
    - name: greet
      description: Returns a greeting message
    - name: greet_with_name
      description: Returns a personalized greeting
      input_schemas:
        - format: "application/schema+json"
          definition: {"type": "string"}
      output_schemas:
        - format: "application/schema+json"
          definition: {"type": "string"}

# Implementation functions
- name: greeter_greet
  kind: function.lua
  source: file://greeter_greet.lua
  method: main

- name: greeter_greet_name
  kind: function.lua
  source: file://greeter_greet_name.lua
  method: main

# Bind contract methods to implementations
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

-- Open binding by ID
local greeter, err = contract.open("app:greeter_impl")

-- Call methods
local result = greeter:greet()
local personalized = greeter:greet_with_name("Alice")

-- Check if instance implements contract
local is_greeter = contract.is(greeter, "app:greeter")
```

**Lua API:** [コントラクトモジュール](../lua/core/contract.md)を参照

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

## WASMランタイム

| 種別 | 説明 |
|------|-------------|
| `function.wat` | WebAssembly関数（WATテキスト形式） |
| `function.wasm` | WebAssembly関数（バイナリ） |
| `process.wasm` | WebAssemblyプロセス |

```yaml
- name: sum
  kind: function.wasm
  source: file://sum.wasm
  transport: payload   # or wasi-http
```

[WASM の概要](../wasm/overview.md)を参照してください。

## ネットワーク

| 種別 | 説明 |
|------|-------------|
| `network` | ベースネットワークオーバーレイ |
| `network.socks5` | SOCKS5プロキシオーバーレイ |
| `network.i2p` | I2Pネットワークオーバーレイ |
| `network.tailscale` | Tailscaleオーバーレイ |

`http.service` からは `network:`、`funcs`/`process` からは `network` オプション、`http_client` からは `overlay_network` オプションで参照されます。[ネットワーク](../system/network.md)を参照してください。

## レジストリプリミティブ

| 種別 | 説明 |
|------|-------------|
| `registry.entry` | エントリ記述子（内部） |
| `ns.definition` | 名前空間定義 |
| `ns.requirement` | 名前空間要件宣言 |
| `ns.dependency` | 名前空間依存関係 |

`registry.entry` は内部記述子です。作成者は `_index.yaml` 内で `ns.definition`、`ns.requirement`、`ns.dependency` エントリを直接定義します。ファイルの `version` と `namespace` フィールドからこれらが生成されるわけではありません。

## ライフサイクル設定

スーパーバイザが管理するサービスエントリは、ライフサイクル設定を公開します。次のブロックは、それをサポートするサービスエントリ内に記述します：

```yaml
lifecycle:
  auto_start: true          # Start automatically
  start_timeout: 10s        # Max startup time
  stop_timeout: 10s         # Max shutdown time
  stable_threshold: 5s      # Uninterrupted run time before retry accounting resets
  requires:
    - app:database
  restart:                  # Retry policy
    initial_delay: 1s
    max_delay: 90s
    backoff_factor: 2.0
    max_attempts: 0         # 0 = infinite
```

<note>
サービスの依存関係は <code>requires</code> で宣言します。スーパーバイザは依存先を先に起動し、実行中になった時点で準備完了とみなします。<code>depends_on</code> は従来の表記として引き続き使用できますが、新しいマニフェストでは <code>requires</code> を使用してください。
</note>

## エントリ参照形式

エントリは`namespace:name`形式で参照されます：

```yaml
# Definition
namespace: app.users
entries:
  - name: handler
    kind: function.lua

# Reference from another entry
func: app.users:handler
```

## エントリの上書き

任意のエントリのフィールド（その `kind` を含む）は、ソース YAML を編集することなく、`override:` 設定セクションまたは `-o` CLI フラグを使って起動時に上書きできます。キーは `namespace:entry:path` 形式を使用します。

```yaml
override:
  app:gateway:addr: ":9090"        # data field (a bare path targets data.*)
  app:worker:meta.priority: high    # meta field
  app:db:kind: db.sql.postgres      # the entry's typed kind
  app:db:data.kind: custom          # a payload field literally named "kind"
```

| パス | 対象 |
|------|------|
| `kind` | エントリの型付き kind（空でない文字列である必要があります） |
| `data.<field>` または素の `<field>` | エントリの data ペイロード内のフィールド |
| `meta.<field>` | エントリのメタデータ内のフィールド |

同じ上書きを CLI からも適用できます。

```bash
wippy run -o app:db:kind=db.sql.postgres -o app:gateway:addr=:9090
```

CLI（`-o`）の値は形状に応じて型変換されます（`true`/`false` は bool、数値は数値、それ以外は文字列）。`override:` セクションの値は YAML の型を保持します。エントリではなくグローバルな[設定](./configuration.md)セクションを上書きするには、`--set` を使用します。
