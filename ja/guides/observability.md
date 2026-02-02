# 可観測性

Wippyアプリケーションのロギング、メトリクス、分散トレーシングを設定します。

## 概要

Wippyは起動時に設定される3つの可観測性の柱を提供します：

| 柱 | バックエンド | 設定 |
|----|-------------|------|
| ロギング | Zap（JSON構造化） | `logger`と`logmanager` |
| メトリクス | Prometheus | `prometheus` |
| トレーシング | OpenTelemetry | `otel` |

## ロガー設定

### 基本ロガー

```yaml
logger:
  mode: production     # developmentまたはproduction
  level: info          # debug, info, warn, error
  encoding: json       # jsonまたはconsole
```

### ログマネージャ

ログマネージャはログの伝播とイベントストリーミングを制御します：

```yaml
logmanager:
  propagate_downstream: true   # 子コンポーネントに伝播
  stream_to_events: false      # ログをイベントバスに転送
  min_level: 0                 # -1=debug, 0=info, 1=warn, 2=error
```

`stream_to_events`が有効な場合、ログエントリはイベントになり、プロセスはイベントバス経由でサブスクライブできます。

### 自動コンテキスト

すべてのログに含まれるもの：

- `pid` - プロセスID
- `location` - エントリIDと行番号（例：`app.api:handler:45`）

## Prometheusメトリクス

```yaml
prometheus:
  enabled: true
  address: "localhost:9090"
```

メトリクスは設定されたアドレスの`/metrics`で公開されます。

### スクレイプ設定

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'wippy'
    static_configs:
      - targets: ['localhost:9090']
    scrape_interval: 15s
```

Luaメトリクス APIについては[メトリクスモジュール](lua/system/metrics.md)を参照してください。

## OpenTelemetry

OTELは分散トレーシングとオプションのメトリクスエクスポートを提供します。

### 基本設定

```yaml
otel:
  enabled: true
  endpoint: "localhost:4318"
  protocol: http/protobuf      # grpcまたはhttp/protobuf
  service_name: my-app
  service_version: "1.0.0"
  insecure: false              # 非TLS接続を許可
  sample_rate: 1.0             # 0.0から1.0
  traces_enabled: true
  metrics_enabled: false
  propagators:
    - tracecontext
    - baggage
```

### トレースソース

特定のコンポーネントのトレーシングを有効化：

```yaml
otel:
  enabled: true
  endpoint: "localhost:4318"
  service_name: my-app

  # HTTPリクエストトレーシング
  http:
    enabled: true
    extract_headers: true      # 受信トレースコンテキストを読み取り
    inject_headers: true       # 送信トレースコンテキストを書き込み

  # プロセスライフサイクルトレーシング
  process:
    enabled: true
    trace_lifecycle: true      # spawn/exitイベントをトレース

  # キューメッセージトレーシング
  queue:
    enabled: true

  # 関数呼び出しトレーシング
  interceptor:
    enabled: true
    order: 0                   # インターセプター実行順序
```

### Temporalワークフロー

Temporalワークフローのトレーシングを有効化：

```yaml
otel:
  enabled: true
  endpoint: "localhost:4318"
  service_name: my-app

  temporal:
    enabled: true
```

有効な場合、Temporal SDKのトレーシングインターセプターがクライアントとワーカーの両方の操作に登録されます。

トレースされる操作：
- ワークフローの開始と完了
- アクティビティ実行
- 子ワークフロー呼び出し
- シグナルとクエリ処理

### トレースされるもの

| コンポーネント | スパン名 | 属性 |
|---------------|----------|------|
| HTTPリクエスト | `{METHOD} {route}` | http.method, http.url, http.host |
| 関数呼び出し | 関数ID | process.pid, frame.id |
| プロセスライフサイクル | `{source}.started/terminated` | process.pid |
| キューメッセージ | メッセージトピック | ヘッダー内のトレースコンテキスト |
| Temporalワークフロー | ワークフロー/アクティビティ名 | workflow.id, run.id |

### コンテキスト伝播

トレースコンテキストは自動的に伝播されます：

- **HTTP → 関数**: W3C Trace Contextヘッダー
- **関数 → 関数**: フレームコンテキスト継承
- **プロセス → プロセス**: spawnコンテキスト
- **キュー publish → consume**: メッセージヘッダー

### 環境変数

OTELは環境変数で設定できます：

| 変数 | 説明 |
|------|------|
| `OTEL_SDK_DISABLED` | `true`に設定してOTELを無効化 |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | コレクターエンドポイント |
| `OTEL_EXPORTER_OTLP_PROTOCOL` | `grpc`または`http/protobuf` |
| `OTEL_SERVICE_NAME` | サービス名 |
| `OTEL_SERVICE_VERSION` | サービスバージョン |
| `OTEL_TRACES_SAMPLER_ARG` | サンプルレート（0.0-1.0） |
| `OTEL_PROPAGATORS` | プロパゲーターリスト |

## ランタイム統計

`system`モジュールは内部ランタイム統計を提供します：

```lua
local system = require("system")

-- メモリ統計
local mem = system.memory.stats()
-- mem.alloc, mem.heap_alloc, mem.heap_objects, etc.

-- goroutine数
local count = system.runtime.goroutines()

-- スーパーバイザ状態
local states = system.supervisor.states()
```

## 関連項目

- [ロガーモジュール](lua/system/logger.md) - Luaロギング API
- [メトリクスモジュール](lua/system/metrics.md) - Luaメトリクス API
- [システムモジュール](lua/system/system.md) - ランタイム統計
