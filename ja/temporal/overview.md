---
title: "Temporal統合"
description: "WippyはTemporal.ioと統合し、耐久性のあるワークフロー実行、自動リプレイ、再起動後も継続する長時間実行プロセスを提供します。"
---

# Temporal統合

このページは、Temporalクライアントとワーカーの設定リファレンスです。最後のレジストリ断片はエントリ同士の接続方法を示すものであり、単独で完結するプロジェクトではありません。

`temporal.client`と`temporal.worker`のエントリ種別は、Wippyのワークフローとアクティビティを[Temporal](https://temporal.io)に接続します。

## クライアント設定

`temporal.client`エントリ種別は、Temporalサーバーへの接続を定義します。

```yaml
- name: temporal_client
  kind: temporal.client
  address: "localhost:7233"
  namespace: "default"
  lifecycle:
    auto_start: true
```

### 必須フィールド

| フィールド | 説明 |
|-----------|------|
| `address` | Temporalサーバーアドレス（host:port） |

### オプションフィールド

| フィールド | デフォルト | 説明 |
|-----------|-----------|------|
| `namespace` | "default" | Temporal名前空間 |
| `tq_prefix` | "" | すべての操作のタスクキュー名プレフィックス |
| `connection_timeout` | "10s" | 接続タイムアウト |
| `keep_alive_time` | "30s" | Keep-alive間隔 |
| `keep_alive_timeout` | "10s" | Keep-aliveタイムアウト |

### 認証

#### 認証なし

```yaml
- name: temporal_client
  kind: temporal.client
  address: "localhost:7233"
  auth:
    type: none
```

#### APIキー（Temporal Cloud）

次のいずれかの方法でAPIキーを指定します。

```yaml
# Direct value
- name: temporal_client
  kind: temporal.client
  address: "your-namespace.tmprl.cloud:7233"
  namespace: "your-namespace"
  auth:
    type: api_key
    api_key: "your-api-key"

# From environment variable
- name: temporal_client
  kind: temporal.client
  address: "your-namespace.tmprl.cloud:7233"
  namespace: "your-namespace"
  auth:
    type: api_key
    api_key: ${env:TEMPORAL_API_KEY}

# From file
- name: temporal_client
  kind: temporal.client
  address: "your-namespace.tmprl.cloud:7233"
  namespace: "your-namespace"
  auth:
    type: api_key
    api_key_file: "/etc/secrets/temporal-api-key"
```

認証フィールドと資格情報フィールドに含まれる`${env:NAME}`プレースホルダーは、デコード時に[環境レジストリ](system/env.md)を通じて解決されます。従来の`api_key_env` / `key_pem_env`ディレクティブも同じ方法で解決されますが、非推奨です。`api_key: ${env:NAME}` / `key_pem: ${env:NAME}`を使用してください。

#### mTLS

```yaml
- name: temporal_client
  kind: temporal.client
  address: "temporal.example.com:7233"
  namespace: "production"
  auth:
    type: mtls
    cert_file: "/path/to/client.pem"
    key_file: "/path/to/client.key"
  tls:
    enabled: true
    ca_file: "/path/to/ca.pem"
```

証明書とキーは、PEM文字列または環境変数からも指定できます。

```yaml
auth:
  type: mtls
  cert_pem: |
    -----BEGIN CERTIFICATE-----
    ...
    -----END CERTIFICATE-----
  key_pem: ${env:TEMPORAL_CLIENT_KEY}
```

### TLS設定

```yaml
tls:
  enabled: true
  ca_file: "/path/to/ca.pem"
  server_name: "temporal.example.com"    # Override server name verification
  insecure_skip_verify: false            # Skip verification (dev only)
```

### ヘルスチェック

```yaml
health_check:
  enabled: true
  interval: "30s"
```

## ワーカー設定

`temporal.worker`エントリ種別は、ワークフローとアクティビティを実行するワーカーを定義します。

```yaml
- name: worker
  kind: temporal.worker
  client: app:temporal_client
  task_queue: "my-app-queue"
  lifecycle:
    auto_start: true
    requires:
      - app:temporal_client
```

### 必須フィールド

| フィールド | 説明 |
|-----------|------|
| `client` | `temporal.client`エントリへの参照 |
| `task_queue` | タスクキュー名 |

### ワーカーオプション

ワーカーの動作を設定します。

```yaml
- name: worker
  kind: temporal.worker
  client: app:temporal_client
  task_queue: "my-app-queue"
  worker_options:
    # Identity
    identity: ""                          # Worker identity (appears in Temporal UI)

    # Concurrency
    max_concurrent_activity_execution_size: 1000
    max_concurrent_workflow_task_execution_size: 1000
    max_concurrent_local_activity_execution_size: 1000
    max_concurrent_session_execution_size: 1000
    max_concurrent_eager_activity_execution_size: 0

    # Pollers
    max_concurrent_activity_task_pollers: 20
    max_concurrent_workflow_task_pollers: 20

    # Rate limiting
    worker_activities_per_second: 0        # 0 = unlimited
    worker_local_activities_per_second: 0
    task_queue_activities_per_second: 0

    # Timeouts
    sticky_schedule_to_start_timeout: "5s"
    worker_stop_timeout: "0s"
    deadlock_detection_timeout: "0s"
    max_heartbeat_throttle_interval: "0s"
    default_heartbeat_throttle_interval: "0s"

    # Feature flags
    enable_logging_in_replay: false
    enable_session_worker: false
    disable_workflow_worker: false
    local_activity_worker_only: false
    disable_eager_activities: false
    disable_registration_aliasing: false

    # Versioning
    deployment_name: ""
    build_id: ${env:BUILD_ID}              # Read from env registry
    use_versioning: false
    default_versioning_behavior: "pinned" # or "auto_upgrade"
```

資格情報フィールドと識別子フィールドに含まれる`${env:NAME}`プレースホルダーは、デコード時に[環境レジストリ](system/env.md)を通じて解決されます。従来の`build_id_env`ディレクティブも同じ方法で解決されますが、非推奨です。`build_id: ${env:NAME}`を使用してください。

### バージョニング動作

`default_versioning_behavior`は、`use_versioning`が有効な場合に、新しいワークフロー実行がワーカーのビルドIDを選択する方法を制御します。

| 値 | 動作 |
|----|------|
| `pinned` | ワークフローは実行全体を通して、開始時のビルドIDを使用し続けます |
| `auto_upgrade` | ワークフローは各タスク後に互換性のある最新のビルドIDで再開できます |

リテラルの`build_id`が指定されていない場合、`build_id: ${env:NAME}`は環境レジストリからビルドIDを読み取ります。

### セッションワーカー

`enable_session_worker: true`を設定すると、ワーカーはTemporal Sessionsを実行できます。これは、単一のワーカーに固定された一連のアクティビティです（一時ディレクトリや開かれた接続などのローカル状態をアクティビティ間で共有する場合に便利です）。`max_concurrent_session_execution_size`は、ワーカー上の同時セッション数を制限します。

### 並行性のデフォルト値

| オプション | デフォルト |
|-----------|-----------|
| `max_concurrent_activity_execution_size` | 1000 |
| `max_concurrent_workflow_task_execution_size` | 1000 |
| `max_concurrent_local_activity_execution_size` | 1000 |
| `max_concurrent_session_execution_size` | 1000 |
| `max_concurrent_activity_task_pollers` | 20 |
| `max_concurrent_workflow_task_pollers` | 20 |
| `sticky_schedule_to_start_timeout` | 5s |

## 設定例

このレジストリ断片は、1つのワークフローと1つのアクティビティをワーカーに接続します。`localhost:7233`でTemporalサーバーに到達でき、参照される2つのLuaソースファイルが存在することを前提としています。実装については、ワークフローとアクティビティのページを参照してください。

```yaml
version: "1.0"
namespace: app

entries:
  - name: temporal_client
    kind: temporal.client
    address: "localhost:7233"
    namespace: "default"
    lifecycle:
      auto_start: true

  - name: worker
    kind: temporal.worker
    client: app:temporal_client
    task_queue: "orders"
    lifecycle:
      auto_start: true
      requires:
        - app:temporal_client

  - name: order_workflow
    kind: workflow.lua
    source: file://order_workflow.lua
    method: main
    modules:
      - funcs
      - time
    meta:
      temporal:
        workflow:
          worker: app:worker

  - name: charge_payment
    kind: function.lua
    source: file://payment.lua
    method: charge
    modules:
      - env
      - errors
      - http_client
      - json
    meta:
      temporal:
        activity:
          worker: app:worker
```

## 関連項目

- [アクティビティ](temporal/activities.md) - アクティビティの定義
- [ワークフロー](temporal/workflows.md) - ワークフローの実装
