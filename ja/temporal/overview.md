# Temporal統合

Wippyは[Temporal.io](https://temporal.io)と統合し、耐久性のあるワークフロー実行、自動リプレイ、再起動を乗り越える長時間実行プロセスを提供します。

## クライアント設定

`temporal.client`エントリ種別はTemporalサーバーへの接続を定義します。

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

以下のいずれかの方法でAPIキーを提供：

```yaml
# 直接値
- name: temporal_client
  kind: temporal.client
  address: "your-namespace.tmprl.cloud:7233"
  namespace: "your-namespace"
  auth:
    type: api_key
    api_key: "your-api-key"

# 環境変数から
- name: temporal_client
  kind: temporal.client
  address: "your-namespace.tmprl.cloud:7233"
  namespace: "your-namespace"
  auth:
    type: api_key
    api_key_env: "TEMPORAL_API_KEY"

# ファイルから
- name: temporal_client
  kind: temporal.client
  address: "your-namespace.tmprl.cloud:7233"
  namespace: "your-namespace"
  auth:
    type: api_key
    api_key_file: "/etc/secrets/temporal-api-key"
```

`_env`で終わるフィールドはシステムで定義されている必要がある環境変数を参照します。環境ストレージと変数の設定については[環境変数システム](system/env.md)を参照してください。

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

証明書とキーはPEM文字列または環境変数からも提供できます：

```yaml
auth:
  type: mtls
  cert_pem: |
    -----BEGIN CERTIFICATE-----
    ...
    -----END CERTIFICATE-----
  key_pem_env: "TEMPORAL_CLIENT_KEY"
```

### TLS設定

```yaml
tls:
  enabled: true
  ca_file: "/path/to/ca.pem"
  server_name: "temporal.example.com"    # サーバー名検証をオーバーライド
  insecure_skip_verify: false            # 検証をスキップ（開発のみ）
```

### ヘルスチェック

```yaml
health_check:
  enabled: true
  interval: "30s"
```

## ワーカー設定

`temporal.worker`エントリ種別はワークフローとアクティビティを実行するワーカーを定義します。

```yaml
- name: worker
  kind: temporal.worker
  client: app:temporal_client
  task_queue: "my-app-queue"
  lifecycle:
    auto_start: true
    depends_on:
      - app:temporal_client
```

### 必須フィールド

| フィールド | 説明 |
|-----------|------|
| `client` | `temporal.client`エントリへの参照 |
| `task_queue` | タスクキュー名 |

### ワーカーオプション

ワーカー動作を微調整：

```yaml
- name: worker
  kind: temporal.worker
  client: app:temporal_client
  task_queue: "my-app-queue"
  worker_options:
    # 並行性
    max_concurrent_activity_execution_size: 1000
    max_concurrent_workflow_task_execution_size: 1000
    max_concurrent_local_activity_execution_size: 1000
    max_concurrent_session_execution_size: 1000

    # ポーラー
    max_concurrent_activity_task_pollers: 20
    max_concurrent_workflow_task_pollers: 20

    # レート制限
    worker_activities_per_second: 0        # 0 = 無制限
    worker_local_activities_per_second: 0
    task_queue_activities_per_second: 0

    # タイムアウト
    sticky_schedule_to_start_timeout: "5s"
    worker_stop_timeout: "0s"
    deadlock_detection_timeout: "0s"

    # 機能フラグ
    enable_logging_in_replay: false
    enable_session_worker: false
    disable_workflow_worker: false
    local_activity_worker_only: false
    disable_eager_activities: false

    # バージョニング
    deployment_name: ""
    build_id: ""
    build_id_env: "BUILD_ID"              # 環境変数から読み取り
    use_versioning: false
    default_versioning_behavior: "pinned" # または "auto_upgrade"
```

`_env`で終わるフィールドは[環境変数システム](system/env.md)エントリで定義された環境変数を参照します。

### 並行性デフォルト

| オプション | デフォルト |
|-----------|-----------|
| `max_concurrent_activity_execution_size` | 1000 |
| `max_concurrent_workflow_task_execution_size` | 1000 |
| `max_concurrent_local_activity_execution_size` | 1000 |
| `max_concurrent_session_execution_size` | 1000 |
| `max_concurrent_activity_task_pollers` | 20 |
| `max_concurrent_workflow_task_pollers` | 20 |
| `sticky_schedule_to_start_timeout` | 5s |

## 完全な例

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
      depends_on:
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
      - http_client
      - json
    meta:
      temporal:
        activity:
          worker: app:worker
```

## 関連項目

- [アクティビティ](temporal/activities.md) - アクティビティ定義
- [ワークフロー](temporal/workflows.md) - ワークフロー実装
