---
title: "可観測性"
description: "Wippy のロギング、Prometheus メトリクス、OpenTelemetry トレーシング、ランタイム統計を設定します。"
---

# 可観測性

Wippy は、ロギング、メトリクス、分散トレーシング、ランタイム統計を通じて、アプリケーションとランタイムの動作を公開します。

## 概要

起動時に 3 つの可観測性領域を設定します：

| 柱 | バックエンド | 設定 |
|----|-------------|------|
| ロギング | Zap（JSON構造化） | `logger`と`logmanager` |
| メトリクス | Prometheus | `prometheus` |
| トレーシング | OpenTelemetry | `otel` |

## ロガー設定

### ロガーのエンコーディング

```yaml
logger:
  encoding: json       # json or console
```

レベルと出力は CLI フラグ（`-v`、`-c`、`-s`）で制御されます — yaml から読み取られるのは `encoding` のみです。

### ログマネージャ

ログマネージャはログの伝播とイベントストリーミングを制御します：

```yaml
logmanager:
  propagate_downstream: true   # Propagate to child components
  stream_to_events: false      # Forward logs to event bus
  min_level: 0                 # -1=debug, 0=info, 1=warn, 2=error
```

`stream_to_events`が有効な場合、ログエントリはイベントになり、プロセスはイベントバス経由でサブスクライブできます。

組み込みログマネージャのデフォルトは `-1` ですが、`wippy run` は起動時に CLI のログ設定を適用します。通常は info（`0`）、`-v` または `--very-verbose` を指定すると debug（`-1`）になります。

### 自動コンテキスト

Lua から[logger モジュール](lua/system/logger.md)経由で出力されるログには、以下が自動的に含まれます：

- `pid` - 現在のプロセスのPID
- `location` - エントリIDと呼び出し行（例：`app.api:handler:45`）

## Prometheusメトリクス

```yaml
prometheus:
  enabled: true
  address: "localhost:9090"
```

Prometheus サーバーは、`enabled` が `true` で `address` が空でない場合にのみ起動します。そのアドレスでメトリクスを `/metrics`、ランタイムの liveness ハンドラを `/livez` として公開します。

### スクレイプ設定

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'wippy'
    static_configs:
      - targets: ['localhost:9090']
    scrape_interval: 15s
```

Lua メトリクス API については[メトリクスモジュール](lua/system/metrics.md)を参照してください。

## OpenTelemetry

OpenTelemetry（OTEL）は、分散トレーシングと任意のメトリクスエクスポートを提供します。

### 基本設定

```yaml
otel:
  enabled: true
  endpoint: "localhost:4318"
  protocol: http/protobuf      # grpc or http/protobuf
  service_name: my-app
  service_version: "1.0.0"
  insecure: true               # Use plaintext for a local collector
  sample_rate: 1.0             # 0.0 to 1.0
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

  # HTTP request tracing
  http:
    enabled: true
    extract_headers: true      # Read incoming trace context
    inject_headers: true       # Write trace context to the HTTP response

  # Process lifecycle tracing
  process:
    enabled: true
    trace_lifecycle: true      # Trace spawn/exit events

  # Queue message tracing
  queue:
    enabled: true

  # Function call tracing
  interceptor:
    enabled: true
```

OTEL が有効な場合、HTTP のトレーシングと伝播、プロセスのトレーシングとライフサイクルスパン、関数インターセプト、キュートレーシング、トレースエクスポートはデフォルトで有効です。Temporal トレーシングとメトリクスエクスポートはデフォルトで無効です。固定されたランタイムは関数インターセプターを order 100 で登録します。設定から `interceptor.order` の値をデコードできても、その登録順序は変わりません。

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

トレースされる操作は次のとおりです：

- ワークフローの開始と完了
- アクティビティ実行
- 子ワークフロー呼び出し
- シグナルとクエリ処理

### トレースされるもの

| コンポーネント | スパン名 | 属性 |
|---------------|----------|------|
| HTTP リクエスト | `{METHOD} {route}` | http.method, http.url, http.host |
| 関数呼び出し | 関数 ID | process.pid, frame.id |
| プロセスライフサイクル | `<source-id>.started/terminated`、ソースフレームがない場合は `process.started/terminated` | process.pid, lifecycle.event |
| キューへの publish | `<queue-id>.publish` | メッセージング属性とヘッダー内のトレースコンテキスト |
| キューの consume | ハンドラ関数 ID | 関数スパンに継承されるメッセージング属性 |
| Temporal ワークフロー | Temporal SDK の操作名 | Temporal SDK のワークフローと実行メタデータ |

### コンテキスト伝播

設定された統合では、トレースコンテキストが次の経路で伝播されます：

- **HTTP → 関数**: W3C Trace Contextヘッダー
- **関数 → 関数**: フレームコンテキスト継承
- **プロセス → プロセス**: spawnコンテキスト
- **キュー publish → consume**: メッセージヘッダー

### 環境変数

OTELは環境変数で設定できます：

| 変数 | 説明 |
|------|------|
| `OTEL_SDK_DISABLED` | `true`に設定してOTELを無効化 |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | コレクターエンドポイント。エクスポーター設定前に `http://` または `https://` スキームは除去されます |
| `OTEL_EXPORTER_OTLP_PROTOCOL` | `grpc`または`http/protobuf` |
| `OTEL_EXPORTER_OTLP_INSECURE` | `true` に設定すると平文のコレクター接続を使用 |
| `OTEL_SERVICE_NAME` | サービス名 |
| `OTEL_SERVICE_VERSION` | サービスバージョン |
| `OTEL_TRACES_SAMPLER` | `always_on`、`always_off`、`traceidratio`、`parentbased_traceidratio` |
| `OTEL_TRACES_SAMPLER_ARG` | サンプルレート（0.0-1.0） |
| `OTEL_PROPAGATORS` | プロパゲーターリスト |

## ランタイム統計

`system`モジュールは内部ランタイム統計を提供します：

```lua
local system = require("system")

-- Memory statistics
local mem, mem_err = system.memory.stats()
-- mem.alloc, mem.heap_alloc, mem.heap_objects, etc.

-- Goroutine count
local count, count_err = system.runtime.goroutines()

-- Supervisor states
local states, states_err = system.supervisor.states()
```

これらの関数は `value, error` を返します。現在のセキュリティスコープに `system.read` 権限が必要です。

## 関連項目

- [ロガーモジュール](lua/system/logger.md) — Lua ロギング API
- [メトリクスモジュール](lua/system/metrics.md) — Lua メトリクス API
- [システムモジュール](lua/system/system.md) — ランタイム統計
