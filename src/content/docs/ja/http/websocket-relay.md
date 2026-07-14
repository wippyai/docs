---
title: "WebSocketリレー"
description: "WebSocketリレーミドルウェアはHTTP接続をWebSocketにアップグレードし、ターゲットプロセスにメッセージをリレーします。"
---

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

-- 任意のプロセスからWebSocketクライアントにメッセージを送信。
-- リレーはこれを {topic, data} JSONとしてラップします; トピック名は任意です。
process.send(websocket_pid, "update", "hello")
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
| `ws.join` | クライアント接続時 | JSON `{client_pid, metadata}` |
| `ws.message` (または指定した `message_topic`) | クライアントがメッセージ送信時 | クライアントの生ペイロード (テキストフレーム -> string、バイナリフレーム -> bytes); リレーパッケージのソースPIDがクライアントPID |
| `ws.heartbeat` | 定期的（設定時） | JSON `{client_pid, uptime, message_count, metadata}` |
| `ws.leave` | クライアント切断時 | JSON `{client_pid, metadata}` |

## メッセージの受信

```lua
local json = require("json")

local function handler()
    local inbox = process.inbox()

    while true do
        local msg, ok = inbox:receive()
        if not ok then break end

        local topic = msg:topic()
        local from = msg:from()                -- クライアント接続PID

        if topic == "ws.join" then
            -- クライアント接続 -- ペイロードは {client_pid, metadata}
            local data = msg:payload():data()
            local client_pid = data.client_pid

        elseif topic == "ws.message" then
            -- 生のクライアントメッセージ; from() はクライアントPID
            local body = msg:payload():data()  -- string または bytes
            handle_message(from, json.decode(body))

        elseif topic == "ws.leave" then
            -- クライアント切断 -- ペイロードは {client_pid, metadata}
            cleanup(from)
        end
    end
end
```

## クライアントへの送信

クライアントPIDを使用してメッセージを送り返します。任意のトピックは `{topic, data}` JSONとしてラップされ、WebSocketに転送されます。フレームタイプはペイロード形式によって決まります: 文字列はテキストフレームに、バイトはバイナリフレームになります (JSONラッパー内ではbase64エンコード)。

```lua
-- 構造化メッセージを送信 (任意のトピック名)
process.send(client_pid, "update", json.encode({event = "update", value = 42}))

-- バイナリを送信
process.send(client_pid, "data", binary_content)

-- 接続を閉じる (ペイロードはクローズ理由文字列)
process.send(client_pid, "ws.close", "Session ended")
```

サーバーからクライアントへの予約済みトピックは `ws.control` (リレー再構成) と `ws.close` (接続を閉じる) です。

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
        process.send(pid, "broadcast", data)
    end
end
```

<tip>
複雑なマルチルームシナリオでは、ルームごとに個別のハンドラプロセスを生成するか、ルームメンバーシップを追跡する中央マネージャープロセスを使用してください。
</tip>

## 関連項目

- [ミドルウェア](http/middleware.md) - ミドルウェア設定
- [プロセス](lua/core/process.md) - プロセスメッセージング
- [WebSocketクライアント](lua/http/websocket.md) - アウトバウンドWebSocket接続
