# 設定リファレンス

Wippyは`.wippy.yaml`ファイルで設定されます。すべてのオプションには妥当なデフォルト値があります。

## Logger

zap ロガーのエンコーダを制御します。CLI フラグ（`-v`, `-c`, `-s`）はレベル/出力を上書きします。yaml で制御できる唯一のオプションはエンコーディングです。

| フィールド | 型 | デフォルト | 説明 |
|------------|-----|------------|------|
| `encoding` | string | console | エンコーダ: `console`（人間可読）または `json`（構造化） |

```yaml
logger:
  encoding: json
```

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

サービスライフサイクル管理。ライフサイクルイベントのディスパッチに使用されるスーパーバイザの内部制御メールボックスを制御します。

| フィールド | 型 | デフォルト | 説明 |
|------------|-----|------------|------|
| `host.buffer_size` | int | 1024 | 内部制御メールボックスの容量 |
| `host.worker_count` | int | 16 | 同時ディスパッチャーワーカー数 |

```yaml
supervisor:
  host:
    buffer_size: 2048
    worker_count: 32
```

参照: [スーパービジョンガイド](guides/supervision.md)

<note>
`process.host`ごとのワーカーとキューは、このグローバルセクションではなく、エントリ自体（`workers`、`queue_size`、`local_queue_size`）で設定します。[Process Host](system/process-host.md)エントリ種別を参照してください。
</note>

## Luaランタイム

Lua VMキャッシュと式評価。

| フィールド | 型 | デフォルト | 説明 |
|------------|-----|------------|------|
| `proto_cache_size` | int | 60000 | コンパイル済みプロトタイプキャッシュ |
| `main_cache_size` | int | 10000 | メインチャンクキャッシュ |
| `cache.enabled` | bool | false | コンパイル済みバイトコード/型チェックキャッシュをディスクに永続化 |
| `cache.dir` | string | （システムキャッシュディレクトリ） | キャッシュディレクトリパス |
| `cache.mode` | string | `read_write` | キャッシュモード: `read_write`, `read_only`, `write_only` |
| `type_system.enabled` | bool | false | 静的型チェックを有効化 |
| `type_system.strict` | bool | false | 型警告をエラーとして扱う |

```yaml
lua:
  proto_cache_size: 60000
  cache:
    enabled: true
    dir: .cache/lua
  type_system:
    enabled: true
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
| `service_name` | string | wippy-runtime | サービス識別子 |
| `service_version` | string | | サービスバージョンタグ |
| `insecure` | bool | true | 平文 OTLP 接続を許可 |
| `sample_rate` | float | 1.0 | トレースサンプリング（0.0-1.0） |
| `propagators` | string[] | `[tracecontext, baggage]` | コンテキストプロパゲータ |
| `traces_enabled` | bool | true | トレースをエクスポート |
| `metrics_enabled` | bool | false | メトリクスをエクスポート |
| `http.enabled` | bool | true | HTTPリクエストをトレース |
| `http.extract_headers` | bool | true | 受信ヘッダからトレースコンテキストを抽出 |
| `http.inject_headers` | bool | true | 送信ヘッダにトレースコンテキストを注入 |
| `process.enabled` | bool | true | プロセスライフサイクルをトレース |
| `process.trace_lifecycle` | bool | true | spawn/terminate の span を発行 |
| `interceptor.enabled` | bool | true | 関数呼び出しをトレース |
| `interceptor.order` | int | 100 | インターセプタの優先度 |
| `queue.enabled` | bool | true | キューの publish/consume をトレース |
| `temporal.enabled` | bool | false | Temporal ワークフローをトレース |

```yaml
otel:
  enabled: true
  endpoint: "http://jaeger:4318"
  traces_enabled: true
  process:
    trace_lifecycle: true
```

標準 OTEL 環境変数（`OTEL_EXPORTER_OTLP_ENDPOINT`、`OTEL_SERVICE_NAME`、`OTEL_TRACES_SAMPLER_ARG`、`OTEL_PROPAGATORS`、`OTEL_SDK_DISABLED`）は一致するフィールドを上書きします。

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

## LSP

エディタ統合のためのLanguage Server Protocolサーバー。

| フィールド | 型 | デフォルト | 説明 |
|------------|-----|------------|------|
| `enabled` | bool | false | TCPサーバーを有効化 |
| `address` | string | :7777 | TCPリッスンアドレス |
| `http_enabled` | bool | false | HTTPトランスポートを有効化 |
| `http_address` | string | :7778 | HTTPリッスンアドレス |
| `http_path` | string | /lsp | HTTPエンドポイントパス |
| `http_allow_origin` | string | * | CORS許可オリジン |
| `max_message_bytes` | int | 8388608 | 受信メッセージの最大サイズ |

```yaml
lsp:
  enabled: true
  address: ":7777"
  http_enabled: true
```

参照: [LSPガイド](guides/lsp.md)

## ネットワークサービス

オーバーレイネットワークマネージャ（SOCKS5、I2P、Tailscaleドライバ）。

| フィールド | 型 | デフォルト | 説明 |
|------------|-----|------------|------|
| `state_dir` | string | .wippy/net | ドライバ状態ストレージディレクトリ |
| `default_network` | string | | エントリで `network` を省略した場合に適用されるデフォルトネットワークID |

```yaml
network_service:
  state_dir: /var/lib/wippy/net
  default_network: app:tailscale
```

参照: [ネットワークオーバーレイ](system/network.md)

## モジュール

`wippy install`/`update` で使用されるモジュールレジストリクライアント。

| フィールド | 型 | デフォルト | 説明 |
|------------|-----|------------|------|
| `registry_url` | string | https://hub.wippy.ai | レジストリエンドポイント |

```yaml
modules:
  registry_url: https://internal-registry.example.com
```

## 拡張機能

起動時に読み込まれるネイティブGoプラグイン拡張機能（Unixのみ）。

| フィールド | 型 | デフォルト | 説明 |
|------------|-----|------------|------|
| `enabled` | bool | true | 拡張機能を読み込む |
| `paths` | string[] | | プラグインファイルパス（設定ディレクトリからの相対パス） |

```yaml
extensions:
  enabled: true
  paths:
    - ./extensions/myplugin.so
```

## 環境変数

| 変数 | 説明 |
|------|------|
| `GOMEMLIMIT` | メモリ制限（`--memory-limit`フラグをオーバーライド） |

## 関連項目

- [CLIリファレンス](guides/cli.md) - コマンドラインオプション
- [エントリ種別](guides/entry-kinds.md) - すべてのエントリタイプ
- [可観測性ガイド](guides/observability.md) - ロギング、メトリクス、トレーシング
