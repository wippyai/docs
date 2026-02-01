# WebSocketリレー

WebSocketリレーミドルウェアはHTTP接続をWebSocketにアップグレードし、ターゲットプロセスにメッセージをリレーします。

## 動作原理

1. HTTPハンドラがターゲットプロセスPID付きの`X-WS-Relay`ヘッダーを設定
2. ミドルウェアが接続をWebSocketにアップグレード
3. リレーがターゲットプロセスにアタッチしてモニタリング
4. メッセージがクライアントとプロセス間で双方向に流れる

<warning>
WebSocket接続はターゲットプロセスにバインドされます。プロセスが終了すると、接続は自動的に閉じられます。
</warning>

## プロセスセマンティクス

WebSocket接続は独自のPIDを持つ完全なプロセスです。プロセスシステムと統合されています：

- **アドレス指定可能** → 任意のプロセスがWebSocket PIDにメッセージを送信可能
- **モニタリング可能** → プロセスがWebSocket接続をモニタリングして終了イベントを受信可能
- **リンク可能** → WebSocket接続を他のプロセスにリンク可能
- **EXITイベント** → 接続が閉じるとモニターが終了通知を受信

```lua
-- 別のプロセスからWebSocket接続をモニタリング
process.monitor(websocket_pid)

-- 任意のプロセスからWebSocketクライアントにメッセージを送信
process.send(websocket_pid, "ws.send", {type = "text", data = "hello"})
```

<tip>
リレーはターゲットプロセスをモニタリングします。ターゲットが終了すると、WebSocket接続は自動的に閉じられ、クライアントはクローズフレームを受信します。
</tip>

## 接続の転送

制御メッセージを送信して接続を別のプロセスに転送できます：

```lua
process.send(websocket_pid, "ws.control", {
    target_pid = new_process_pid,
    message_topic = "ws.message"
})
```

## 設定

ルーターでマッチ後ミドルウェアとして追加：

```yaml
- name: ws_router
  kind: http.router
  meta:
    server: gateway
  prefix: /ws
  post_middleware:
    - websocket_relay
  post_options:
    wsrelay.allowed.origins: "https://app.example.com"
```

| オプション | 説明 |
|-----------|------|
| `wsrelay.allowed.origins` | カンマ区切りの許可されたオリジン |

<note>
オリジンが設定されていない場合、同一オリジンのリクエストのみ許可されます。
</note>

## ハンドラセットアップ

HTTPハンドラはプロセスを生成してリレーを設定します：

```lua
local http = require("http")
local json = require("json")

local function handler()
    local req = http.request()
    local res = http.response()

    -- ハンドラプロセスを生成
    local pid = process.spawn("app.ws:handler", "app:processes")

    -- リレーを設定
    res:header("X-WS-Relay", json.encode({
        target_pid = tostring(pid),
        message_topic = "ws.message",
        heartbeat_interval = "30s",
        metadata = {
            user_id = req:query("user_id")
        }
    }))
end
```

### リレー設定フィールド

| フィールド | 型 | デフォルト | 説明 |
|------------|-----|------------|------|
| `target_pid` | string | 必須 | メッセージを受信するプロセスPID |
| `message_topic` | string | `ws.message` | クライアントメッセージ用トピック |
| `heartbeat_interval` | duration | - | ハートビート頻度（例：`30s`） |
| `metadata` | object | - | すべてのメッセージに付与 |

## メッセージトピック

リレーはこれらのメッセージをターゲットプロセスに送信します：

| トピック | タイミング | ペイロード |
|---------|----------|----------|
| `ws.join` | クライアント接続時 | `client_pid`、`metadata` |
| `ws.message` | クライアントがメッセージ送信時 | `client_pid`、`type`、`data`、`metadata` |
| `ws.heartbeat` | 定期的（設定時） | `client_pid`、`uptime`、`message_count` |
| `ws.leave` | クライアント切断時 | `client_pid`、`reason`、`metadata` |

## メッセージの受信

```lua
local json = require("json")

local function handler()
    local inbox = process.inbox()

    while true do
        local msg, ok = inbox:receive()
        if not ok then break end

        local topic = msg:topic()
        local data = msg:payload():data()

        if topic == "ws.join" then
            -- クライアント接続
            local client_pid = data.client_pid

        elseif topic == "ws.message" then
            -- クライアントメッセージを処理
            local content = json.decode(data.data)
            handle_message(data.client_pid, content)

        elseif topic == "ws.leave" then
            -- クライアント切断
            cleanup(data.client_pid)
        end
    end
end
```

## クライアントへの送信

クライアントPIDを使用してメッセージを送り返します：

```lua
-- テキストメッセージを送信
process.send(client_pid, "ws.send", {
    type = "text",
    data = json.encode({event = "update", value = 42})
})

-- バイナリを送信
process.send(client_pid, "ws.send", {
    type = "binary",
    data = binary_content
})

-- 接続を閉じる
process.send(client_pid, "ws.close", {
    code = 1000,
    reason = "Session ended"
})
```

## ブロードキャスト

クライアントPIDを追跡して複数のクライアントにブロードキャスト：

```lua
local clients = {}

-- 参加時
clients[client_pid] = true

-- 離脱時
clients[client_pid] = nil

-- ブロードキャスト
local function broadcast(message)
    local data = json.encode(message)
    for pid, _ in pairs(clients) do
        process.send(pid, "ws.send", {type = "text", data = data})
    end
end
```

<tip>
複雑なマルチルームシナリオでは、ルームごとに個別のハンドラプロセスを生成するか、ルームメンバーシップを追跡する中央マネージャープロセスを使用してください。
</tip>

## 関連項目

- [ミドルウェア](http-middleware.md) - ミドルウェア設定
- [プロセス](lua-process.md) - プロセスメッセージング
- [WebSocketクライアント](lua-websocket.md) - アウトバウンドWebSocket接続
