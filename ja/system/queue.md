---
title: "キュー"
description: "メモリ、AMQP、SQS のキュードライバー、論理キュー、コンシューマー、確認応答、メッセージ発行を設定します。"
---

# キュー

キューシステムは、非同期メッセージのパブリッシャー、ドライバー、キュー、コンシューマー、ハンドラー関数を接続します。

このページは設定および動作のリファレンスです。YAML のコードブロックは、完全なドキュメントを示す場合を除き、既存のエントリリストに配置する断片です。外部ドライバーの例では、ブローカーまたは AWS 互換サービスがすでに存在することを前提としています。

## アーキテクチャ

```mermaid
flowchart LR
    P[Publisher] --> D[Driver]
    D --> Q[Queue]
    Q --> C[Consumer]
    C --> W[Worker Pool]
    W --> F[Function]
```

- **ドライバー** — バックエンド実装（memory、AMQP、SQS）
- **キュー** — ドライバーに関連付けられた論理キュー
- **コンシューマー** — 並行処理設定を使ってキューとハンドラーを接続
- **ワーカープール** — メッセージを並行処理

複数のキューで 1 つのドライバーを共有できます。複数のコンシューマーで同じキューを処理できます。

## エントリ種別

| 種別 | 説明 |
|------|------|
| `queue.driver.memory` | インメモリキュードライバー |
| `queue.driver.amqp` | AMQP（RabbitMQ）ドライバー |
| `queue.driver.sqs` | AWS SQS ドライバー（LocalStack、ElasticMQ にも対応） |
| `queue.queue` | ドライバー参照を持つキュー宣言 |
| `queue.consumer` | メッセージを処理するコンシューマー |

## ドライバー設定

### メモリドライバー

インプロセスドライバーは開発環境および単一ノードのデプロイ向けで、外部依存関係はありません。

```yaml
- name: memory_driver
  kind: queue.driver.memory
  lifecycle:
    auto_start: true
```

### AMQP ドライバー

RabbitMQ および AMQP 0-9-1 互換ブローカー用です。

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
| `connection_timeout` | duration | - | 接続タイムアウト |
| `reconnect_delay` | duration | `1s` | 初回再接続のバックオフ |
| `reconnect_max_delay` | duration | `30s` | 再接続バックオフの最大値 |
| `default_message_ttl` | duration | - | パブリッシャーが有効期限を設定しない場合に使用するメッセージ単位の有効期限 |
| `default_queue_ttl` | duration | - | キューレベルのメッセージ TTL（`x-message-ttl`）のデフォルト値 |
| `default_queue_expiry` | duration | - | 未使用キューの有効期限（`x-expires`）のデフォルト値 |
| `prefetch_count` | int | - | チャネルレベルのプリフェッチ上限 |
| `frame_size` | int | - | AMQP フレームサイズの上限 |
| `channel_max` | int | - | 接続あたりの最大チャネル数 |
| `tls` | object | - | TLS 設定（下記参照） |

`tls` の下に TLS を設定します。

```yaml
  tls:
    enabled: true
    server_name: "rabbit.example.com"
    cert: ${env:app.env:amqp_cert}
    key:  ${env:app.env:amqp_key}
    ca:   ${env:app.env:amqp_ca}
    insecure_skip_verify: false
```

`cert`／`key`／`ca` には PEM コンテンツを指定します。インライン、`file://`、または[環境変数レジストリ](./env.md)を通じて解決される `${env:NAME}` プレースホルダーを使用できます。`insecure_skip_verify` は証明書検証を無効にします（開発時のみ）。従来の `cert_env`／`key_env`／`ca_env` ディレクティブも環境変数レジストリを読み取りますが、検索結果が見つからないか空の場合は、インライン値またはゼロ値を保持します。デフォルトのない最新のプレースホルダーは、変数が見つからない場合に失敗します。従来のディレクティブは非推奨です。

### SQS ドライバー

AWS SQS および SQS 互換エンドポイント（LocalStack、ElasticMQ）用です。認証情報、リージョン、その他の AWS SDK 設定は、共有の `config.aws` リソースから取得されます。

```yaml
- name: aws_config
  kind: config.aws
  region: us-east-1
  access_key_id: ${env:app:AWS_ACCESS_KEY_ID}
  secret_access_key: ${env:app:AWS_SECRET_ACCESS_KEY}

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
| `endpoint` | string | - | カスタムエンドポイント URL（LocalStack、ElasticMQ）。実際の AWS では省略 |
| `message_retention_period` | int | `345600`（4 日） | キューレベルの保持期間（秒、60–1209600） |
| `default_delay_seconds` | int | `0` | CreateQueue で適用されるデフォルトの配信遅延（0–900） |
| `disable_message_checksum_validation` | bool | `false` | 送受信時の SQS メッセージチェックサム検証を無効化 |
| `use_fips` | bool | `false` | FIPS 準拠のエンドポイントを使用 |
| `use_dual_stack` | bool | `false` | デュアルスタック（IPv4 + IPv6）エンドポイントを使用 |

キューは初回使用時にドライバーによって自動作成されます。発行時に SQS 固有のフィールドを指定するには、SQS プレフィックス付きヘッダーを使用します。`sqs.delay_seconds`、`sqs.message_group_id`、`sqs.message_deduplication_id` は、型付きの SQS メッセージフィールドにマッピングされます。他のすべてのヘッダー（`correlation_id` や `content_type` のような中立的なキー、および `sqs.message_attributes.*` キー）は、そのまま SQS メッセージ属性として引き渡されます。

## キュー設定 {id="queue-configuration"}

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
| `driver` | Registry ID | はい | キュードライバー |
| `codec` | string | いいえ | メッセージ本文のワイヤエンコーディング。デフォルトは `json/plain`（[コーデック](#codecs)を参照） |
| `queue_name` | string | いいえ | 外部キュー名（デフォルトはエントリ名） |
| `driver_options` | object | いいえ | ドライバー種別をキーとする、ドライバーごとのサブバッグ |
| `dead_letter.queue` | Registry ID | いいえ | 失敗メッセージ用のキュー ID（受け付けられるが、組み込みドライバーではまだ適用されない） |
| `dead_letter.max_attempts` | int | いいえ | DLQ にルーティングするまでの試行回数（受け付けられるが、組み込みドライバーではまだ適用されない） |

### ドライバーオプション

`driver_options` のキーはドライバー名でスコープされます。ドライバーは自身のサブバッグだけを読み取ります。他のキーは休眠状態となるため、必要に応じて単一のキューエントリで複数のドライバーの設定を宣言できます。

**memory:**

| キー | 説明 |
|------|------|
| `max_length` | 境界付きバッファーのサイズ（0 または未設定 = デフォルトの 1000） |

**amqp:**

| キー | 説明 |
|------|------|
| `durable` | ブローカーの再起動後も維持 |
| `auto_delete` | 最後のコンシューマーが切断したときに削除 |
| `message_ttl` | キューごとのメッセージ TTL の上書き |
| `queue_expiry` | 未使用キューの有効期限 |
| `max_length` | 保持する最大メッセージ数 |

### コーデック {id="codecs"}

`codec` は、メッセージ本文をブローカーに渡す前のシリアライズ方法を選択します。ペイロード形式を表す文字列で、デフォルトは `json/plain` です。

| コーデック | 形式 |
|-----------|------|
| `json/plain` | JSON（デフォルト） |
| `application/msgpack` | MessagePack |

AMQP ドライバーは、発行するメッセージに対応する `content-type`（`application/json` または `application/msgpack`）を設定します。不明なコーデックは発行時ではなく、キューの宣言時に失敗します。

## コンシューマー設定

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
    requires:
      - app.queue:tasks
```

| フィールド | デフォルト | 説明 |
|-----------|-----------|------|
| `queue` | 必須 | キューのレジストリ ID |
| `func` | 必須 | ハンドラー関数のレジストリ ID |
| `concurrency` | 1 | 並列ワーカー数 |
| `prefetch` | 10 | 共有配信バッファーのサイズ。AMQP ではチャネルの QoS プリフェッチ数にも適用 |
| `auto_ack` | false | バックエンド固有の自動確認応答オプション。AMQP では `true` にすると、配信時の確認応答をブローカーに要求 |
| `driver_options` | - | ドライバーごとのサブバッグ（キューと同じ構造） |

**amqp コンシューマーオプション:**

| キー | 説明 |
|------|------|
| `exclusive` | 単一コンシューマーによるキューアクセス |
| `no_local` | 同じ接続で発行されたメッセージを拒否 |
| `no_wait` | サブスクライブ時にブローカーの確認を待たない |
| `consumer_tag` | このサブスクリプションの識別子 |

<tip>
コンシューマーは呼び出しコンテキストを尊重し、セキュリティポリシーの対象になる場合があります。ライフサイクルレベルでアクターとポリシーを設定してください。<a href="./security.md">セキュリティ</a>を参照してください。
</tip>

### ワーカープール

ワーカーは並行して実行されます。

```
concurrency: 3, prefetch: 10

1. Driver delivers up to 10 messages to the shared buffer
2. 3 workers pull from the buffer and can each hold an active delivery
3. As workers finish, buffer refills
4. Backpressure when all workers busy and buffer full
```

## ハンドラー関数

コンシューマーハンドラーは、デコード済みのメッセージ本文を最初の引数として受け取ります。配信メタデータ（id、headers）には `queue.message()` でアクセスします。

```lua
local queue = require("queue")
local logger = require("logger")

local function main(body)
    local msg, msg_err = queue.message()
    if msg_err then return nil, msg_err end
    local message_id, id_err = msg:id()
    if id_err then return nil, id_err end
    local correlation_id, header_err = msg:header("correlation_id")
    if header_err then return nil, header_err end

    logger:info("processing", {
        id = message_id,
        correlation_id = correlation_id
    })

    local _, task_err = process_task(body)
    if task_err then return nil, task_err end
    return true
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

ハンドラーが明示的に確定しない限り、コンシューマーは関数の呼び出し結果に基づいて確定します。

| ハンドラーの結果 | アクション |
|-----------------|------------|
| 呼び出しエラーなしで完了 | Ack |
| 呼び出しエラーを返す、または発生させる | Nack（ドライバーに従って再配信） |

`false` を含む通常の戻り値では、確認応答の動作は選択されません。明示的に確定するには `msg:ack()` または `msg:nack()` を呼び出します。確定は一度だけ行われ、最初に到達した呼び出しが優先されます。

### Dead-Letter ルーティング

Dead-letter ルーティングはまだ実装されていません。`dead_letter` ブロック（[キュー設定](#queue-configuration)を参照）は設定として受け付けられますが、現在、試行回数をカウントしたり、nack されたメッセージを設定済みの DLQ にルーティングしたり、`x_dead_letter_*` ヘッダーを設定したりする組み込みドライバーはありません。nack されたメッセージは、ドライバー自身のポリシーに従って再配信されます。`x_*` ヘッダー名前空間は将来の DLQ 管理用に予約されているため、パブリッシャーは `x_*` ヘッダーを設定しないでください。

## メッセージの発行

Lua コードから発行します。

```lua
local queue = require("queue")

local published, publish_err = queue.publish("app.queue:tasks", {
    id = "task-123",
    action = "process",
    data = payload
})
if publish_err then return nil, publish_err end
return published
```

Lua の発行 API とメッセージ API については、[キューモジュール](../lua/storage/queue.md)を参照してください。

## グレースフルシャットダウン

コンシューマーの停止時には次の処理を行います。

1. 新しい配信の受け付けを停止
2. ワーカーコンテキストをキャンセル
3. 処理中のメッセージを待機（タイムアウトあり）
4. ワーカーが時間内に終了しない場合はエラーを返す

## 関連項目

- [キューモジュール](../lua/storage/queue.md) - Lua API リファレンス
- [キューコンシューマーガイド](../guides/queue-consumers.md) - コンシューマーのパターンとワーカープール
- [スーパービジョン](../guides/supervision.md) - コンシューマーのライフサイクル管理
