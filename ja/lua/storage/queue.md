# メッセージキュー
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>
<secondary-label ref="permissions"/>

分散キューからメッセージをパブリッシュおよびコンシュームします。RabbitMQなどのAMQP互換ブローカーを含む複数のバックエンドをサポートしています。

キュー設定については[キュー](system-queue.md)を参照。

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

ヘッダーはルーティング、優先度、トレースを有効化します:

```lua
queue.publish("app:notifications", {
    type = "order_shipped",
    order_id = order.id
}, {
    priority = "high",
    correlation_id = request_id
})
```

## デリバリーコンテキストへのアクセス

キューコンシューマ内で、現在のメッセージにアクセスします:

```lua
local msg, err = queue.message()
if err then
    return nil, err
end

local msg_id = msg:id()
local priority = msg:header("priority")
local all_headers = msg:headers()
```

**戻り値:** `Message, error`

コンシューマコンテキストでキューメッセージを処理する場合のみ利用可能です。

## メッセージメソッド

| メソッド | 戻り値 | 説明 |
|--------|---------|-------------|
| `id()` | `string, error` | 一意のメッセージ識別子 |
| `header(key)` | `any, error` | 単一のヘッダー値（存在しない場合nil） |
| `headers()` | `table, error` | すべてのメッセージヘッダー |

## コンシューマパターン

キューコンシューマはペイロードを直接受け取るエントリポイントとして定義します:

```yaml
entries:
  - kind: queue.consumer
    id: email_worker
    queue: app:emails
    method: handle_email
```

```lua
function handle_email(payload)
    local msg = queue.message()

    logger:info("Processing", {
        message_id = msg:id(),
        to = payload.to
    })

    local ok, err = email.send(payload.to, payload.template, payload.data)
    if err then
        return nil, err  -- メッセージは再キューまたはデッドレター
    end
end
```

## 権限

キュー操作はセキュリティポリシー評価の対象です。

| アクション | リソース | 説明 |
|--------|----------|-------------|
| `queue.publish` | - | メッセージをパブリッシュする一般的な権限 |
| `queue.publish.queue` | Queue ID | 特定のキューへのパブリッシュ |

両方の権限がチェックされます。まず一般的な権限、次にキュー固有の権限の順です。

## エラー

| 条件 | 種別 | 再試行可能 |
|-----------|------|-----------|
| キューIDが空 | `errors.INVALID` | no |
| メッセージデータが空 | `errors.INVALID` | no |
| デリバリーコンテキストがない | `errors.INVALID` | no |
| 権限拒否 | `errors.PERMISSION_DENIED` | no |
| パブリッシュ失敗 | `errors.INTERNAL` | yes |

エラーの処理については[エラー処理](lua/core/errors.md)を参照。

## 関連項目

- [キュー設定](system/queue.md) - キュードライバーとエントリ定義
- [キューコンシューマガイド](guides/queue-consumers.md) - コンシューマパターンとワーカープール
- [プロセス管理](lua/core/process.md) - プロセスのスポーンと通信
- [チャネル](lua/core/channel.md) - プロセス間通信パターン
- [関数](lua/core/funcs.md) - 非同期関数呼び出し

