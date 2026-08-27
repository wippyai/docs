---
title: "イベントバス"
description: "<secondary-label ref='function'/ <secondary-label ref='process'/ <secondary-label ref='permissions'/"
---

# イベントバス
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="permissions"/>

オブザーバビリティのためにイベントをパブリッシュおよびサブスクライブします — ランタイムとアプリケーションのアクティビティを監視してそれに反応します。

<note>
イベントバスは観察のためだけに使用してください: 監視、ロギング、メトリクス、およびリアクティブな副作用。これはベストエフォートのパブリッシュ/サブスクライブチャネルであり、信頼性のあるトランスポートではありません — ビジネスロジックを構築したり、確実な配信に依存したりしないでください。ビジネスクリティカルなメッセージングにはプロセスメッセージング（`process.send`）、チャネル、または[メッセージキュー](../storage/queue.md)を使用してください。
</note>

## ロード

```lua
local events = require("events")
```

## イベントのサブスクライブ

イベントバスからのイベントをサブスクライブ:

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

イベントフィールド: `system`、`kind`、`path`、`data`

### サブスクリプションのクローズ

アンサブスクライブしてチャネルをクローズ:

```lua
local closed = sub:close() -- true
```

## 権限

| アクション | リソース | 説明 |
|--------|----------|-------------|
| `events.subscribe` | system | システムからのイベントをサブスクライブ |
| `events.send` | system | システムにイベントを送信 |

## エラー

| 条件 | 種別 | 再試行可能 |
|-----------|------|-----------|
| 空のsystem | `errors.INVALID` | no |
| 空のkind | `errors.INVALID` | no |
| 空のpath | `errors.INVALID` | no |
| ポリシー拒否 | `errors.INVALID` | no |

エラーの処理については[エラー処理](./errors.md)を参照。
