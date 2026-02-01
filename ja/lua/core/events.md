# イベントバス
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="permissions"/>

イベント駆動アーキテクチャのためにアプリケーション全体でイベントをパブリッシュおよびサブスクライブ。

## ロード

```lua
local events = require("events")
```

## イベントのサブスクライブ

イベントバスからのイベントをサブスクライブ：

```lua
-- すべてのorderイベントをサブスクライブ
local sub, err = events.subscribe("orders.*")
if err then
    return nil, err
end

-- 特定のイベント種別をサブスクライブ
local sub = events.subscribe("users", "user.created")

-- システムからのすべてのイベントをサブスクライブ
local sub = events.subscribe("payments")

-- イベントを処理
local ch = sub:channel()
while true do
    local evt, ok = ch:receive()
    if not ok then break end

    logger:info("Received event", {
        system = evt.system,
        kind = evt.kind,
        path = evt.path
    })
    handle_event(evt)
end
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `system` | string | システムパターン（"test.*"などのワイルドカードをサポート） |
| `kind` | string | イベント種別フィルター（オプション） |

**戻り値:** `Subscription, error`

## イベントの送信

イベントバスにイベントを送信：

```lua
-- order作成イベントを送信
local ok, err = events.send("orders", "order.created", "/orders/123", {
    order_id = "123",
    customer_id = "456",
    total = 99.99
})
if err then
    return nil, err
end

-- userイベントを送信
events.send("users", "user.registered", "/users/" .. user.id, {
    user_id = user.id,
    email = user.email,
    created_at = time.now():format("2006-01-02T15:04:05Z07:00")
})

-- paymentイベントを送信
events.send("payments", "payment.completed", "/payments/" .. payment.id, {
    payment_id = payment.id,
    order_id = payment.order_id,
    amount = payment.amount,
    method = payment.method
})

-- データなしで送信
events.send("system", "heartbeat", "/health")
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

イベント受信用のチャネルを取得：

```lua
local ch = sub:channel()

local evt, ok = ch:receive()
if ok then
    print("System:", evt.system)
    print("Kind:", evt.kind)
    print("Path:", evt.path)
    print("Data:", json.encode(evt.data))
end
```

イベントフィールド：`system`、`kind`、`path`、`data`

### サブスクリプションのクローズ

アンサブスクライブしてチャネルをクローズ：

```lua
sub:close()
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

エラーの処理については[エラー処理](lua-errors.md)を参照。


