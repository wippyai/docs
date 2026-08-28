---
title: "イベントバス"
description: "ベストエフォート型のランタイムイベントとアプリケーションイベントを発行および監視します。"
---

# イベントバス
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="permissions"/>

イベントバスは、監視、ロギング、メトリクス、リアクティブな副作用のために、ランタイムおよびアプリケーションのアクティビティを発行します。このページは API リファレンスです。例は、記載されたモジュールと権限を持つ実行可能 Lua エントリを前提とします。

<note>
イベントバスは観察のためだけに使用してください: 監視、ロギング、メトリクス、およびリアクティブな副作用。これはベストエフォートのパブリッシュ/サブスクライブチャネルであり、信頼性のあるトランスポートではありません — ビジネスロジックを構築したり、確実な配信に依存したりしないでください。ビジネスクリティカルなメッセージングにはプロセスメッセージング（`process.send`）、チャネル、または[メッセージキュー](../storage/queue.md)を使用してください。
</note>

## ロード

```lua
local events = require("events")
```

## イベントのサブスクライブ

1 つのシステムまたはシステムパターンを購読し、必要に応じてイベント種別で絞り込みます。

```lua
-- Subscribe to all order events
local sub, err = events.subscribe("orders.*")
if err then
    return nil, err
end

-- Process events
local ch = sub:channel()
while true do
    local evt, ok = ch:receive()
    if not ok then break end

    print(evt.system, evt.kind, evt.path)
    -- Process evt.data when the publisher supplied a payload.
end
```

2 番目の引数を渡すと、たとえば `events.subscribe("users", "user.created")` のように 1 つの種別だけを配信できます。種別を省略すると、一致するシステムのすべての種別を受け入れます。

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `system` | string | システムパターン（"test.*"などのワイルドカードをサポート） |
| `kind` | string | イベント種別フィルター（オプション） |

**戻り値:** `Subscription, error`

## イベントの送信

イベントバスにイベントを送信:

```lua
-- Send order created event
local ok, err = events.send("orders", "order.created", "/orders/123", {
    order_id = "123",
    customer_id = "456",
    total = 99.99
})
if err then
    return nil, err
end

-- Send without data
local heartbeat_sent, heartbeat_err = events.send("system", "heartbeat", "/health")
if heartbeat_err then
    return nil, heartbeat_err
end
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `system` | string | システム識別子 |
| `kind` | string | イベント種別/タイプ |
| `path` | string | ルーティング用のイベントパス |
| `data` | any | イベントペイロード（オプション） |

**戻り値:** `boolean, error`

成功は、ランタイムが送信を受け付けたことだけを示します。購読者がイベントを受信または処理したことまでは保証しません。

## サブスクリプションメソッド

### チャネルの取得

イベント受信用のチャネルを取得:

```lua
local json = require("json")
local ch = sub:channel()

local evt, ok = ch:receive()
if ok then
    print("System:", evt.system)
    print("Kind:", evt.kind)
    print("Path:", evt.path)
    local encoded, encode_err = json.encode(evt.data)
    if encode_err then return nil, encode_err end
    print("Data:", encoded)
end
```

各イベントには `system`、`kind`、`path` が含まれます。`data` は発行側が nil ではないペイロードを渡した場合にのみ存在します。

### サブスクリプションのクローズ

アンサブスクライブしてチャネルをクローズ:

```lua
local closed = sub:close() -- true
```

クローズは冪等です。バッファ済みイベントを読み終えた後、閉じたチャネルに対する `receive()` は `nil, false` を返します。

## 権限

| アクション | リソース | 説明 |
|--------|----------|-------------|
| `events.subscribe` | system | システムからのイベントをサブスクライブ |
| `events.send` | system | システムにイベントを送信 |

## エラー

| 条件 | 種別 | 再試行可能 |
|-----------|------|-----------|
| 空のsystem | `errors.INVALID` | いいえ |
| 空のkind | `errors.INVALID` | いいえ |
| 空のpath | `errors.INVALID` | いいえ |
| ポリシー拒否 | `errors.INVALID` | いいえ |
| 実行コンテキストまたはプロセスコンテキストがない | `errors.INTERNAL` | いいえ |

エラーの処理については[エラー処理](./errors.md)を参照。
