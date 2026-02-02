# 設定リファレンス

Wippyは`.wippy.yaml`ファイルで設定されます。すべてのオプションには妥当なデフォルト値があります。

## ログマネージャ

ランタイムログルーティングを制御します。コンソール出力は[CLIフラグ](guides/cli.md)（`-v`, `-c`, `-s`）で設定します。

| フィールド | 型 | デフォルト | 説明 |
|------------|-----|------------|------|
| `propagate_downstream` | bool | true | ログをコンソール/ファイル出力に送信 |
| `stream_to_events` | bool | false | プログラムアクセス用にログをイベントバスに公開 |
| `min_level` | int | -1 | 最小レベル: -1=debug, 0=info, 1=warn, 2=error |

```yaml
logmanager:
  propagate_downstream: true
  stream_to_events: false
  min_level: 0
```

参照: [ロガーモジュール](lua/system/logger.md)

## プロファイラ

CPU/メモリプロファイリング用のGo pprof HTTPサーバー。`-p`フラグまたは設定で有効化。

| フィールド | 型 | デフォルト | 説明 |
|------------|-----|------------|------|
| `enabled` | bool | false | プロファイラサーバーを起動 |
| `address` | string | localhost:6060 | リッスンアドレス |
| `read_timeout` | duration | 15s | HTTP読み取りタイムアウト |
| `write_timeout` | duration | 15s | HTTP書き込みタイムアウト |
| `idle_timeout` | duration | 60s | Keep-aliveタイムアウト |

```yaml
profiler:
  enabled: true
  address: "localhost:6060"
```

アクセス: `http://localhost:6060/debug/pprof/`

## セキュリティ

グローバルセキュリティ動作。個別のポリシーは[security.policyエントリ](guides/entry-kinds.md)として定義されます。

| フィールド | 型 | デフォルト | 説明 |
|------------|-----|------------|------|
| `strict_mode` | bool | false | セキュリティコンテキストが不完全な場合にアクセスを拒否 |

```yaml
security:
  strict_mode: true
```

参照: [セキュリティシステム](system/security.md), [セキュリティモジュール](lua/security/security.md)

## レジストリ

エントリストレージとバージョン履歴。レジストリはすべての設定エントリを保持します。

| フィールド | 型 | デフォルト | 説明 |
|------------|-----|------------|------|
| `enable_history` | bool | true | エントリバージョンを追跡 |
| `history_type` | string | memory | ストレージ: memory, sqlite, nil |
| `history_path` | string | .wippy/registry.db | SQLiteファイルパス |

```yaml
registry:
  history_type: sqlite
  history_path: /var/lib/wippy/registry.db
```

参照: [レジストリコンセプト](concepts/registry.md), [レジストリモジュール](lua/core/registry.md)

## リレー

ノード間のプロセス間メッセージルーティング。

| フィールド | 型 | デフォルト | 説明 |
|------------|-----|------------|------|
| `node_name` | string | local | このリレーノードの識別子 |

```yaml
relay:
  node_name: worker-1
```

参照: [プロセスモデル](concepts/process-model.md)

## スーパーバイザ

サービスライフサイクル管理。監督されたエントリの起動/停止を制御します。

| フィールド | 型 | デフォルト | 説明 |
|------------|-----|------------|------|
| `host.buffer_size` | int | 1024 | メッセージキュー容量 |
| `host.worker_count` | int | NumCPU | 同時ワーカー数 |

```yaml
supervisor:
  host:
    buffer_size: 2048
    worker_count: 32
```

参照: [スーパービジョンガイド](guides/supervision.md)

## 関数

関数実行ホスト。`function.lua`エントリを実行します。

| フィールド | 型 | デフォルト | 説明 |
|------------|-----|------------|------|
| `host.buffer_size` | int | 1024 | タスクキュー容量 |
| `host.worker_count` | int | NumCPU | 同時ワーカー数 |

```yaml
functions:
  host:
    buffer_size: 2048
    worker_count: 32
```

参照: [関数コンセプト](concepts/functions.md), [Funcsモジュール](lua/core/funcs.md)

## Luaランタイム

Lua VMキャッシュと式評価。

| フィールド | 型 | デフォルト | 説明 |
|------------|-----|------------|------|
| `proto_cache_size` | int | 60000 | コンパイル済みプロトタイプキャッシュ |
| `main_cache_size` | int | 10000 | メインチャンクキャッシュ |
| `expr.cache_enabled` | bool | true | コンパイル済み式をキャッシュ |
| `expr.capacity` | int | 5000 | 式キャッシュサイズ |
| `json.cache_enabled` | bool | true | JSONスキーマをキャッシュ |
| `json.capacity` | int | 1000 | JSONキャッシュサイズ |

```yaml
lua:
  proto_cache_size: 60000
  expr:
    cache_enabled: true
    capacity: 5000
```

参照: [Lua概要](lua/overview.md)

## ファインダー

レジストリ検索キャッシュ。エントリルックアップに内部的に使用されます。

| フィールド | 型 | デフォルト | 説明 |
|------------|-----|------------|------|
| `query_cache_size` | int | 1000 | キャッシュされたクエリ結果 |
| `regex_cache_size` | int | 100 | コンパイル済み正規表現パターン |

```yaml
finder:
  query_cache_size: 2000
```

## OpenTelemetry

OTLPによる分散トレーシングとメトリクスエクスポート。

| フィールド | 型 | デフォルト | 説明 |
|------------|-----|------------|------|
| `enabled` | bool | false | OTELを有効化 |
| `endpoint` | string | localhost:4318 | OTLPエンドポイント |
| `protocol` | string | http/protobuf | プロトコル: grpc, http/protobuf |
| `service_name` | string | wippy | サービス識別子 |
| `sample_rate` | float | 1.0 | トレースサンプリング（0.0-1.0） |
| `traces_enabled` | bool | false | トレースをエクスポート |
| `metrics_enabled` | bool | false | メトリクスをエクスポート |
| `http.enabled` | bool | true | HTTPリクエストをトレース |
| `process.enabled` | bool | true | プロセスライフサイクルをトレース |
| `interceptor.enabled` | bool | false | 関数呼び出しをトレース |

```yaml
otel:
  enabled: true
  endpoint: "http://jaeger:4318"
  traces_enabled: true
  process:
    trace_lifecycle: true
```

参照: [可観測性ガイド](guides/observability.md)

## シャットダウン

グレースフルシャットダウン動作。

| フィールド | 型 | デフォルト | 説明 |
|------------|-----|------------|------|
| `timeout` | duration | 30s | コンポーネント停止の最大待機時間 |

```yaml
shutdown:
  timeout: 60s
```

## メトリクス

内部メトリクス収集バッファ。

| フィールド | 型 | デフォルト | 説明 |
|------------|-----|------------|------|
| `buffer.size` | int | 10000 | メトリクスバッファ容量 |
| `interceptor.enabled` | bool | false | 関数呼び出しを自動追跡 |

```yaml
metrics:
  buffer:
    size: 20000
  interceptor:
    enabled: true
```

参照: [メトリクスモジュール](lua/system/metrics.md), [可観測性ガイド](guides/observability.md)

## Prometheus

Prometheusメトリクスエンドポイント。

| フィールド | 型 | デフォルト | 説明 |
|------------|-----|------------|------|
| `enabled` | bool | false | メトリクスサーバーを起動 |
| `address` | string | localhost:9090 | リッスンアドレス |

```yaml
prometheus:
  enabled: true
  address: "0.0.0.0:9090"
```

Prometheusスクレイピング用の`/metrics`エンドポイントを公開します。

参照: [可観測性ガイド](guides/observability.md)

## クラスタ

ゴシップディスカバリによるマルチノードクラスタリング。

| フィールド | 型 | デフォルト | 説明 |
|------------|-----|------------|------|
| `enabled` | bool | false | クラスタリングを有効化 |
| `name` | string | hostname | ノード識別子 |
| `internode.bind_addr` | string | 0.0.0.0 | ノード間バインドアドレス |
| `internode.bind_port` | int | 0 | ポート（0=自動 7950-7959） |
| `membership.bind_port` | int | 7946 | ゴシップポート |
| `membership.join_addrs` | string | | シードノード（カンマ区切り） |
| `membership.secret_key` | string | | 暗号化キー（base64） |
| `membership.secret_file` | string | | キーファイルパス |
| `membership.advertise_addr` | string | | NAT用パブリックアドレス |

```yaml
cluster:
  enabled: true
  name: node-1
  membership:
    bind_port: 7946
    join_addrs: "10.0.0.1:7946,10.0.0.2:7946"
    secret_file: /etc/wippy/cluster.key
```

参照: [クラスタガイド](guides/cluster.md)

## 環境変数

| 変数 | 説明 |
|------|------|
| `GOMEMLIMIT` | メモリ制限（`--memory-limit`フラグをオーバーライド） |

## 関連項目

- [CLIリファレンス](guides/cli.md) - コマンドラインオプション
- [エントリ種別](guides/entry-kinds.md) - すべてのエントリタイプ
- [クラスタガイド](guides/cluster.md) - マルチノードセットアップ
- [可観測性ガイド](guides/observability.md) - ロギング、メトリクス、トレーシング
