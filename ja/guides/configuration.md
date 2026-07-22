---
title: "設定リファレンス"
description: "Wippyは.wippy.yamlファイルで設定されます。すべてのオプションには妥当なデフォルト値があります。"
---

# 設定リファレンス

Wippyは`.wippy.yaml`ファイルで設定されます。すべてのオプションには妥当なデフォルト値があります。

以下の値はいずれも、起動時に `wippy run --set section.path=value` で上書きできます（繰り返し指定可能で、ファイルより優先されます）。これらの設定セクションではなく個々のレジストリ*エントリ*を上書きするには、`override:` セクションまたは `-o` を使用します — [エントリの上書き](guides/entry-kinds.md#overriding-entries)を参照してください。

## 設定の合成 {#config-composition}

`--config` は繰り返し指定でき、同じスキーマを用いてファイルを左から右に合成します：

```bash
wippy run --config .wippy.yaml --config .wippy.local.yaml
```

- 後のファイルは一致する値を上書きし、それ以外はすべて保持します。
- 明示的に指定したファイルはすべて存在しなければなりません。`--config` なしの場合、デフォルトの `.wippy.yaml` は任意です。
- 最初のファイルが、相対パスの解決に使われるディレクトリを決めます。
- ファイル名に予約された意味はありません。デフォルト以外は何も自動探索されません。

設定は次の順序で適用されます：ファイル合成、次に `--profile` の選択、最後に `--set` の上書き。パックから実行されるアプリケーションでは、パックされたランタイムデフォルトがこれらすべての下に位置します（[ランタイムデフォルトの公開](guides/publishing.md#publishing-runtime-defaults)を参照）。

## プロファイル {#profiles}

設定ファイルは `profiles:` の下に名前付きオーバーレイを宣言できます。各プロファイルの本体は通常の設定セクションと同じ構造で、`--profile <name>` で選択すると、マージされたベース設定にその値がオーバーレイされます：

```yaml
version: "1.0"

vars:
  port: 8085

override:
  app:db:kind: db.sql.sqlite

disable:
  namespaces: ["legacy.**"]

profiles:
  pg:
    vars:
      port: 18085
    override:
      app:db:kind: db.sql.postgres
    disable:
      namespaces.add: ["experimental.**"]
```

```bash
wippy run --profile pg
```

- `--profile` は繰り返し指定できます。プロファイルはファイル合成の後、`--set` の前に左から右へ合成されます。未知の名前はエラーです。
- 値はリーフ単位でマージされます（最後の書き込みが優先）。`profiles:` セクション自体は解決後の設定から取り除かれます。
- `disable` セクションはプロファイル内でのリスト操作をサポートします — `namespaces.add`、`namespaces.remove`、`entries.add`、`entries.remove` — これにより、プロファイルはベースのリストを置き換えるのではなく調整できます。
- `${name}` 参照はマージ後の `vars:` セクションから補間されます。プロファイルの vars 内で OS 環境変数を参照することはできません。ベース設定で `${env:NAME}` を使用してください。これはファイルのロード時に解決されます。

`wippy run`、`test`、`pack` は `--profile` を受け付けます。`install`、`update`、`lint`、`registry` もワークスペースプロファイル用にこれを受け付けます（`--set` と併せて）。アプリケーションはプロファイルをパック内に同梱できます — [プロファイルの公開](guides/publishing.md#publishing-profiles)を参照してください。

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

## レジストリ {#registry}

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

マルチノードクラスタリング: ゴシップメンバーシップと有界 Raft コンセンサスコア。アーキテクチャと運用モデルについては[クラスタガイド](guides/cluster.md)を参照。このセクションは設定キーのリファレンスです。

### トップレベル

| フィールド | 型 | デフォルト | 説明 |
|------------|-----|------------|------|
| `enabled` | bool | false | クラスタリングを有効化 |
| `name` | string | hostname | ノード名。クラスタ全体で一意でなければならない |
| `failure_domain` | string | | ゾーン/ラックラベル。ゴシップで通知され、投票ノードがドメインをまたぐように分散される |

### メンバーシップ（ゴシップ）

memberlist による SWIM ゴシップ。ノード探索、障害検出、メタデータ伝播に使用されます。

| フィールド | 型 | デフォルト | 説明 |
|------------|-----|------------|------|
| `membership.bind_addr` | string | 0.0.0.0 | ゴシップバインドアドレス |
| `membership.bind_port` | int | 7946 | ゴシップバインドポート (TCP+UDP) |
| `membership.advertise_addr` | string | | ピアがこのノードに到達するためのアドレス (NAT/k8s) |
| `membership.join_addrs` | string | | カンマ区切りのシード `host:port` ペア |
| `membership.secret_key` | string | | Base64エンコードされたゴシップ暗号化キー（インライン） |
| `membership.secret_file` | string | | ゴシップ暗号化キーを保持するファイルのパス |
| `membership.gossip_interval` | duration | 500ms | ゴシップ配布の周期 |
| `membership.push_pull_interval` | duration | 5s | 完全な状態同期の周期 |
| `membership.dead_node_reclaim_time` | duration | 30s | デッドノードの名前/アドレスが再利用可能になるまでの時間 |
| `membership.probe_interval` | duration | 1s | 障害検出プローブのサイクル |
| `membership.probe_timeout` | duration | 200ms | プローブごとの Ack 待機時間 |
| `membership.tcp_timeout` | duration | 1s | TCP フォールバックプローブのタイムアウト |
| `membership.suspicion_mult` | int | 3 | サスピションタイムアウトの乗数 |

4つのプローブキーは、未設定の場合 memberlist のローカルネットワーク向けデフォルトを継承します。レイテンシの高いリンクでは値を引き上げてください（例: `probe_interval: 2s`、`probe_timeout: 500ms`、`suspicion_mult: 5`）。

### ノード間（トランスポート）

ノード間でリレーと Raft トラフィックを運ぶ TCP メッシュ。Raft はノード間のリクエスト/リプライを介してこのメッシュ上を走行し、独立した Raft ポートはありません。

| フィールド | 型 | デフォルト | 説明 |
|------------|-----|------------|------|
| `internode.bind_addr` | string | 0.0.0.0 | メッシュバインドアドレス |
| `internode.bind_port` | int | 0 | メッシュポート（0 = 自動: 7950-7959、その後エフェメラル） |
| `internode.auto_port` | bool | true | 起動時に実際のポートを探索して固定し、ゴシップで通知する |
| `internode.advertise_addr` | string | | アップグレード済みピア向けに公開される追加のリレーエンドポイント（IP または DNS 名）— NAT やロードバランサ経由の到達性のため |
| `internode.advertise_port` | int | 0 | `advertise_addr` 用のポート（0 = バインドポート。`advertise_addr` が必要） |

`advertise_addr`/`advertise_port` はノードメタデータに追加のエンドポイントを公開し、バインドエンドポイントは変わらず通知され続けるため、バージョンが混在するクラスタでもローリングアップグレード中に接続が維持されます。

### Raft（コンセンサス）

有界 Raft。Raft の状態はデフォルトで fs 永続化され、`raft.data_dir`（デフォルト `~/.wippy/store`）の下に保存されます。再起動したノードでもピアからクォーラムに再参加します。[`store.kv.raft`](system/store.md#cluster-kv-stores) エントリはこれを通じてレプリケートされます。ブートストラップはゴシップ駆動（Consul/Nomad の `bootstrap_expect` スタイル）です。

| フィールド | 型 | デフォルト | 説明 |
|------------|-----|------------|------|
| `raft.data_dir` | string | `~/.wippy/store` | fs 永続化された Raft 状態と永続 CRDT スナップショットのディレクトリ（`<data_dir>/_sys/` の下）。パスが解決されない場合（ホームディレクトリがなく未設定）のみディスクレス |
| `raft.enabled` | bool | true | Raft ノードを実行。`false` にするとゴシップのみのクライアントになる |
| `raft.role` | string | server | `server` は Raft ノードを実行。`client` はゴシップのみ |
| `raft.eligible` | bool | true | このノードが投票ノードとして選択される可能性があるかどうか |
| `raft.priority` | int | 100 | 投票ノード選択の優先度（値が小さいほど優先） |
| `raft.bootstrap_expect` | int | 1 | 初期クォーラムサイズ: `0`=既存クラスタに参加のみ、`1`=単一ノード、`N`=N個の適格ピアを待ってからクォーラムを形成 |
| `raft.max_voters` | int | 5 | 投票ノードの上限（奇数でなければならない）。それ以上の適格ノードはスタンバイになる |
| `raft.max_standbys` | int | 4 | 昇格に備えて保持する非投票メンバー数。投票ノード+スタンバイを超えたノードは Raft メンバーではない |
| `raft.reconcile_debounce` | duration | 2s | ゴシップイベント後、投票ノード調整ロジックが実行されるまでの集約ウィンドウ |
| `raft.reconcile_timeout` | duration | 2s | 調整パスごとの上限時間 |
| `raft.heartbeat_timeout` | duration | 3s | フォロワーが選挙を開始するまでのアイドル待機時間 |
| `raft.election_timeout` | duration | 3s | 候補ノードの選挙タイムアウト（ハートビート以上にクランプされる） |
| `raft.commit_timeout` | duration | 500ms | リーダーのアイドルハートビート間隔 |
| `raft.snapshot_threshold` | uint64 | 8192 | 新しいスナップショットを作成するまでの最後のスナップショット以降のログエントリ数 |
| `raft.snapshot_interval` | duration | 2m | スナップショットチェック間隔 |
| `raft.snapshot_retain` | int | 3 | 保持するスナップショット数 |
| `raft.trailing_logs` | uint64 | 10240 | スナップショット後に保持するログエントリ数 |
| `raft.max_append_entries` | int | 16 | AppendEntries RPC あたりの最大エントリ数 |
| `raft.leader_probe_interval` | duration | 3s | グローバルレジストリのリーダー到達可能性プローブ間隔 |
| `raft.leader_probe_grace` | int | 3 | リーダーが到達不能と宣言されるまでの連続プローブ失敗回数 |

単一ノード（開発用）— クラスタリング有効、即座にブートストラップ:

```yaml
cluster:
  enabled: true
  name: dev
  raft:
    bootstrap_expect: 1
```

3ノード投票クラスタ — 各ノードが他のノードをシードとして指定し、3つ全てが揃うのを待ってからクォーラムを形成:

```yaml
cluster:
  enabled: true
  name: node-1
  failure_domain: us-east-1a
  membership:
    bind_port: 7946
    join_addrs: "node-2:7946,node-3:7946"
    secret_file: /etc/wippy/cluster.key
  raft:
    bootstrap_expect: 3
    max_voters: 5
```

ゴシップのみのクライアント — 名前付けやメッセージングのためにクラスタに参加するが、Raft は実行しない:

```yaml
cluster:
  enabled: true
  name: edge-7
  membership:
    join_addrs: "node-1:7946,node-2:7946"
  raft:
    role: client
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

## HTTPディスパッチャ

HTTP ディスパッチ関数や送信リクエストで使用される共有 HTTP クライアントプールのチューニング。

| フィールド | 型 | デフォルト | 説明 |
|------------|-----|------------|------|
| `dispatcher.http.timeout` | duration | 0 (なし) | リクエストごとのタイムアウト |
| `dispatcher.http.max_idle_conns` | int | 0 (stdlib) | 全ホスト合計のアイドル接続数上限 |
| `dispatcher.http.max_idle_per_host` | int | 0 (stdlib) | ホストごとのアイドル接続数上限 |
| `dispatcher.http.idle_conn_timeout` | duration | 0 (stdlib) | アイドル接続タイムアウト |
| `dispatcher.http.max_clients` | int | 0 (無制限) | プールする個別クライアントの上限 |

```yaml
dispatcher:
  http:
    timeout: 30s
    max_idle_per_host: 32
```

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
- [クラスタガイド](guides/cluster.md) - クラスタリングのアーキテクチャと運用
- [エントリ種別](guides/entry-kinds.md) - すべてのエントリタイプ
- [可観測性ガイド](guides/observability.md) - ロギング、メトリクス、トレーシング
