---
title: "メッセージキュー"
description: "構成済みのキューにメッセージを発行し、配信を処理します。"
---

# メッセージキュー
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>
<secondary-label ref="permissions"/>

`queue` モジュールは、RabbitMQ やその他の AMQP 互換ブローカーを含む、構成済みの分散キューにメッセージを発行し、配信を処理します。

このページは API リファレンスです。発行のスニペットでは、キューエントリと権限がすでに存在することを前提としています。コンシューマのセクションは、`queue.consumer` によって呼び出されるハンドラーの部分的なレシピであり、単独で動作するキューのデプロイではありません。

キューの構成については、[キュー](../../system/queue.md)を参照してください。

## ロード

```lua
local queue = require("queue")
```

## メッセージのパブリッシュ

IDでキューにメッセージを送信します:

```lua
local ok, err = queue.publish("app:tasks", {
    action = "send_email",
    user_id = 456,
    template = "welcome"
})
if err then
    return nil, err
end
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `queue_id` | string | キュー識別子（形式: "namespace:name"） |
| `data` | any | メッセージデータ（テーブル、文字列、数値、ブール値） |
| `headers` | table | オプションのメッセージヘッダー |

**戻り値:** `boolean, error`

### メッセージヘッダー

ヘッダーはルーティング、優先度、トレースのメタデータを保持します。キーは文字列でなければならず、発行側の値には文字列、整数、数値、ブール値を使用できます:

```lua
local ok, err = queue.publish("app:notifications", {
    type = "order_shipped",
    order_id = order.id
}, {
    priority = 5,
    correlation_id = request_id
})
if err then return nil, err end
```

コンシューマはすべてのヘッダー値を文字列として受け取ります。`x_original_queue`、`x_dead_letter_reason`、`x_dead_letter_time`、`attempts` の各キーは、配信とデッドレターの記録用に予約されているため、発行側で設定してはいけません。

## デリバリーコンテキストへのアクセス

キューコンシューマ内で、現在のメッセージにアクセスします:

```lua
local msg, err = queue.message()
if err then
    return nil, err
end

local msg_id, id_err = msg:id()
if id_err then return nil, id_err end
local priority, header_err = msg:header("priority")
if header_err then return nil, header_err end
local all_headers, headers_err = msg:headers()
if headers_err then return nil, headers_err end
```

**戻り値:** `Message, error`

コンシューマコンテキストでキューメッセージを処理する場合のみ利用可能です。

## メッセージメソッド

| メソッド | 戻り値 | 説明 |
|--------|---------|-------------|
| `id()` | `string, error` | 一意のメッセージ識別子 |
| `header(key)` | `string?, error` | 正規化された文字列値。存在しない場合は nil |
| `headers()` | `{[string]: string}, error` | 正規化された文字列値を持つすべてのヘッダー |
| `ack()` | `boolean, error` | 処理を確認（1 回限り） |
| `nack()` | `boolean, error` | 再配信またはデッドレターに向けて失敗を通知（1 回限り） |

ランタイムはハンドラーの成功時に自動で ack し、ハンドラーのエラー時に自動で nack します。早期に確定するときだけ `ack`/`nack` を呼び出してください。確定は 1 回限りであり、コンシューマハンドラーが戻った後の `Message` は無効です。

## キュー情報

```lua
local stats, err = queue.info("app:tasks")
if err then return nil, err end
-- stats may contain: message_count, consumer_count, ready (driver-dependent)
```

**戻り値:** `table, error`

## コンシューマパターン

`queue.consumer` エントリは、キューを `func` が参照するハンドラーに結び付けます。ハンドラーはメッセージのペイロードを直接受け取ります:

```yaml
- name: email_worker
  kind: queue.consumer
  queue: app:emails
  func: app:email_handler
```

このフラグメントでは、`app:emails` と `app:email_handler` の関数エントリがすでに存在することを前提としています。次の関数ソースでは、アプリケーションが `deliver_email(payload)` と、それに必要な権限を提供することを前提としています。

```lua
local queue = require("queue")
local logger = require("logger")

local function main(payload)
    local msg, msg_err = queue.message()
    if msg_err then return nil, msg_err end

    local message_id, id_err = msg:id()
    if id_err then return nil, id_err end

    logger:info("Processing", {
        message_id = message_id,
        to = payload.to
    })

    local ok, send_err = deliver_email(payload)
    if send_err then return nil, send_err end
    return ok
end

return {main = main}
```

呼び出しエラーを返すと、コンシューマは未確定の配信を nack します。その後の再配信は選択したドライバーの動作に従います。このリリースでは、組み込みのデッドレター構成は適用されません。

## 権限

キュー操作はセキュリティポリシー評価の対象です。

| アクション | リソース | 説明 |
|--------|----------|-------------|
| `queue.publish` | - | メッセージをパブリッシュする一般的な権限 |
| `queue.publish.queue` | Queue ID | 特定のキューへのパブリッシュ |

ランタイムは、最初に一般権限、次にキュー固有の権限を確認します。

## エラー

| 条件 | 種別 | 再試行可能 |
|-----------|------|-----------|
| キューIDが空 | `errors.INVALID` | いいえ |
| メッセージ引数がない、または空のテーブル | `errors.INVALID` | いいえ |
| デリバリーコンテキストがない | `errors.INVALID` | いいえ |
| メッセージが解放済み、または確定済み | `errors.INVALID` | いいえ |
| パブリッシュ不許可 | `errors.INVALID` | いいえ |
| パブリッシュ失敗 | `errors.INTERNAL` | いいえ |
| `info` のキューまたはドライバーが見つからない | `errors.INTERNAL` | いいえ |

エラーの処理については、[エラー処理](../core/errors.md)を参照してください。

## 関連項目

- [キューの構成](../../system/queue.md) - キュードライバーとエントリ定義
- [キューコンシューマガイド](../../guides/queue-consumers.md) - コンシューマパターンとワーカープール
- [プロセス管理](../core/process.md) - プロセスの起動と通信
- [チャネル](../core/channel.md) - プロセス間通信のパターン
- [関数](../core/funcs.md) - 非同期関数の呼び出し
