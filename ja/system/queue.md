---
title: "キュー"
description: "Wippyは設定可能なドライバとコンシューマを持つ非同期メッセージ処理用のキューシステムを提供します。"
---

# キュー

Wippyは設定可能なドライバとコンシューマを持つ非同期メッセージ処理用のキューシステムを提供します。

## アーキテクチャ

```mermaid
flowchart LR
    P[Publisher] --> D[Driver]
    D --> Q[Queue]
    Q --> C[Consumer]
    C --> W[Worker Pool]
    W --> F[Function]
```

- **ドライバ** - バックエンド実装（memory、AMQP、SQS）
- **キュー** - ドライバにバインドされた論理キュー
- **コンシューマ** - 並行性設定でキューとハンドラを接続
- **ワーカープール** - 同時メッセージプロセッサ

複数のキューが1つのドライバを共有できます。複数のコンシューマが同じキューから処理できます。

## エントリ種別

| 種別 | 説明 |
|------|------|
| `queue.driver.memory` | インメモリキュードライバ |
| `queue.driver.amqp` | AMQP（RabbitMQ）ドライバ |
| `queue.driver.sqs` | AWS SQS ドライバ（LocalStack、ElasticMQ も対応）|
| `queue.queue` | ドライバ参照付きキュー宣言 |
| `queue.consumer` | メッセージを処理するコンシューマ |

## ドライバ設定

### メモリドライバ

開発およびシングルノードデプロイ向けのインプロセスドライバ。外部依存なし。

```yaml
- name: memory_driver
  kind: queue.driver.memory
  lifecycle:
    auto_start: true
```

### AMQP ドライバ

RabbitMQ および AMQP 0-9-1 互換ブローカー向け。

```yaml
- name: amqp_driver
  kind: queue.driver.amqp
  url: "amqp://guest:guest@localhost:5672/"
  vhost: "/"
  connection_name: "wippy-service"
  heartbeat: "10s"
  connection_timeout: "30s"
  reconnect_delay: "1s"
  reconnect_max_delay: "30s"
  default_message_ttl: "1h"
  default_queue_expiry: "24h"
  prefetch_count: 10
  lifecycle:
    auto_start: true
```

| フィールド | 型 | デフォルト | 説明 |
|-----------|-----|-----------|------|
| `url` | string | `amqp://guest:guest@localhost:5672/` | ブローカー URL |
| `vhost` | string | - | 仮想ホストの上書き |
| `connection_name` | string | - | ブローカー UI に表示される識別子 |
| `auth_mechanism` | string | `PLAIN` | `PLAIN`、`EXTERNAL`（mTLS）、または `AMQPLAIN` |
| `heartbeat` | duration | - | Keep-alive 間隔 |
| `connection_timeout` | duration | - | ダイヤルタイムアウト |
| `reconnect_delay` | duration | `1s` | 初期再接続バックオフ |
| `reconnect_max_delay` | duration | `30s` | 最大再接続バックオフ |
| `default_message_ttl` | duration | - | 宣言されたキューに適用されるデフォルトメッセージ TTL |
| `default_queue_ttl` | duration | - | 宣言されたキューに適用されるデフォルト TTL |
| `default_queue_expiry` | duration | - | 宣言されたキューのデフォルトキュー期限 |
| `prefetch_count` | int | - | チャネルレベル prefetch 上限 |
| `frame_size` | int | - | AMQP フレームサイズ制限 |
| `channel_max` | int | - | 接続あたり最大チャネル数 |
| `tls` | object | - | TLS 設定（下記参照）|

TLS ブロック：

```yaml
  tls:
    enabled: true
    server_name: "rabbit.example.com"
    cert_env: "AMQP_CLIENT_CERT"
    key_env: "AMQP_CLIENT_KEY"
    ca_env: "AMQP_CA_CERT"
    insecure_skip_verify: false
```

インライン `cert`/`key`/`ca` フィールドは PEM コンテンツを保持します。`*_env` バリアントは env レジストリ経由で解決されます。2つのソースはフィールドごとに排他的です。`insecure_skip_verify` は証明書検証を無効化します（開発用のみ）。

### SQS ドライバ

AWS SQS および SQS 互換エンドポイント（LocalStack、ElasticMQ）向け。認証情報、リージョン、その他の AWS SDK 設定は共有 `config.aws` リソースから取得されます。

```yaml
- name: aws_config
  kind: config.aws
  region: us-east-1
  access_key_id_env: app:AWS_ACCESS_KEY_ID
  secret_access_key_env: app:AWS_SECRET_ACCESS_KEY

- name: sqs_driver
  kind: queue.driver.sqs
  config: app:aws_config
  endpoint: "http://localhost:9324"
  message_retention_period: 345600
  default_delay_seconds: 0
  lifecycle:
    auto_start: true
```

| フィールド | 型 | デフォルト | 説明 |
|-----------|-----|-----------|------|
| `config` | Registry ID | 必須 | リージョンと認証情報を提供する `config.aws` リソース |
| `endpoint` | string | - | カスタムエンドポイント URL（LocalStack、ElasticMQ）；実 AWS では省略 |
| `message_retention_period` | int | `345600`（4日）| キューレベル保持期間（秒）（60–1209600）|
| `default_delay_seconds` | int | `0` | CreateQueue で適用されるデフォルト配信遅延（0–900）|
| `disable_message_checksum_validation` | bool | `false` | 送受信時の SQS メッセージチェックサム検証を無効化 |
| `use_fips` | bool | `false` | FIPS 準拠エンドポイントを使用 |
| `use_dual_stack` | bool | `false` | デュアルスタック（IPv4 + IPv6）エンドポイントを使用 |

キューは初回使用時にドライバによって自動作成されます。発行時に SQS 固有属性を指定するには SQS プレフィックス付きヘッダ（`sqs.*`）を使用してください。`correlation_id` や `content_type` のような中立的なキーは可能な限り SQS システム属性に変換されます。

## キュー設定

```yaml
- name: tasks
  kind: queue.queue
  driver: app.queue:memory_driver
  codec: json/plain
  queue_name: "app_tasks"
  driver_options:
    memory:
      max_length: 500
  dead_letter:
    queue: app.queue:tasks_dlq
    max_attempts: 5
```

| フィールド | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `driver` | Registry ID | はい | キュードライバ |
| `codec` | string | いいえ | メッセージ本体のワイヤエンコーディング。デフォルトは `json/plain`（[コーデック](#codecs)を参照）|
| `queue_name` | string | いいえ | 外部キュー名（デフォルトはエントリ名）|
| `driver_options` | object | いいえ | ドライバ kind でキー付けされたドライバごとのサブバッグ |
| `dead_letter.queue` | Registry ID | いいえ | 失敗メッセージのキュー ID |
| `dead_letter.max_attempts` | int | いいえ | DLQ にルーティングするまでの試行回数 |

### ドライバオプション

`driver_options` 下のキーはドライバ名でスコープされます。ドライバは自身のサブバッグのみを読み取ります。他のキューはドーマント状態となり、必要に応じて単一のキューエントリで複数のドライバの設定を宣言できます。

**memory：**

| キー | 説明 |
|------|------|
| `max_length` | 境界バッファサイズ（0 = 無制限）|

**amqp：**

| キー | 説明 |
|------|------|
| `durable` | ブローカー再起動を生き延びる |
| `auto_delete` | 最後のコンシューマが切断したときに削除 |
| `message_ttl` | キューごとのメッセージ TTL 上書き |
| `queue_expiry` | 未使用キューの期限 |
| `max_length` | 保持される最大メッセージ数 |

### コーデック {id="codecs"}

`codec` は、メッセージ本体がブローカーに渡される前にどのようにシリアライズされるかを選択します。これはペイロードフォーマット文字列であり、デフォルトは `json/plain` です:

| コーデック | フォーマット |
|-------|------|
| `json/plain` | JSON（デフォルト） |
| `application/msgpack` | MessagePack |

AMQP ドライバは、発行されるメッセージに対応する `content-type`（`application/json` または `application/msgpack`）を設定します。不明なコーデックは、発行時ではなくキューが宣言される時に失敗します。

## コンシューマ設定

```yaml
- name: task_consumer
  kind: queue.consumer
  queue: app.queue:tasks
  func: app.queue:task_handler
  concurrency: 4
  prefetch: 20
  auto_ack: false
  driver_options:
    amqp:
      consumer_tag: "worker-1"
      exclusive: false
  lifecycle:
    auto_start: true
    depends_on:
      - app.queue:tasks
```

| フィールド | デフォルト | 説明 |
|-----------|-----------|------|
| `queue` | 必須 | キューレジストリ ID |
| `func` | 必須 | ハンドラ関数レジストリ ID |
| `concurrency` | 1 | 並列ワーカー数 |
| `prefetch` | 10 | ワーカーごとのバッファサイズ |
| `auto_ack` | false | true の場合、ランタイムはブローカー ack を呼び出さない；ハンドラの成功/失敗が唯一の settle シグナル |
| `driver_options` | - | ドライバごとのサブバッグ（キューと同じ構造）|

**amqp コンシューマオプション：**

| キー | 説明 |
|------|------|
| `exclusive` | 単一コンシューマのキューアクセス |
| `no_local` | 同一接続で発行されたメッセージを拒否 |
| `no_wait` | サブスクライブ時にブローカー確認を待たない |
| `consumer_tag` | このサブスクリプションの識別子 |

<tip>
コンシューマは呼び出しコンテキストを尊重し、セキュリティポリシーの対象となります。ライフサイクルレベルでアクターとポリシーを設定してください。<a href="system/security.md">セキュリティ</a>を参照。
</tip>

### ワーカープール

ワーカーは同時goroutineとして実行：

```
concurrency: 3, prefetch: 10

1. ドライバが最大10メッセージをバッファに配信
2. 3ワーカーがバッファから同時にプル
3. ワーカーが終了するとバッファが補充
4. すべてのワーカーがビジーでバッファがフルのときバックプレッシャー
```

## ハンドラ関数

コンシューマハンドラはデコードされたメッセージボディを最初の引数として受け取ります。`queue.message()` を使用してデリバリーメタデータ（id、headers）にアクセスします。

```lua
local queue = require("queue")
local logger = require("logger")

local function main(body)
    local msg = queue.message()
    logger:info("processing", {
        id = msg:id(),
        correlation_id = msg:header("correlation_id")
    })

    local ok, err = process_task(body)
    if err then
        return false  -- nack: redelivery or DLQ
    end
    return true       -- ack: remove from queue
end

return { main = main }
```

```yaml
- name: task_handler
  kind: function.lua
  source: file://task_handler.lua
  method: main
  modules:
    - queue
    - logger
```

### 確認応答

ランタイムはハンドラの戻り値に基づいて自動的に settle します：

| ハンドラ結果 | アクション |
|-------------|----------|
| `true` または非 `false` の戻り値 | Ack |
| `false` | Nack（ドライバに応じて再配信または dead-letter）|
| 投げられたエラー | Nack |

早期 settle のためにのみ `msg:ack()` または `msg:nack()` を明示的に呼び出してください。Settlement はシングルショット：最初に到着した呼び出しが優先されます。

### Dead-Letter ルーティング

キューに `dead_letter` が設定されている場合、`max_attempts` を超えて nack されたメッセージは、ドライバによって設定された `x_dead_letter_reason` と `x_original_queue` ヘッダ付きで DLQ にルーティングされます。発行者は `x_*` ヘッダを設定してはいけません。これらは DLQ の記録用に予約されています。

## メッセージの発行

Luaコードから：

```lua
local queue = require("queue")

queue.publish("app.queue:tasks", {
    id = "task-123",
    action = "process",
    data = payload
})
```

完全なAPIについては[キューモジュール](lua/storage/queue.md)を参照してください。

## グレースフルシャットダウン

コンシューマ停止時：

1. 新しいデリバリーの受け入れを停止
2. ワーカーコンテキストをキャンセル
3. 処理中のメッセージを待機（タイムアウト付き）
4. ワーカーが時間内に終了しない場合はエラーを返す

## 関連項目

- [キューモジュール](lua/storage/queue.md) - Lua APIリファレンス
- [キューコンシューマガイド](guides/queue-consumers.md) - コンシューマパターンとワーカープール
- [スーパービジョン](guides/supervision.md) - コンシューマライフサイクル管理
