---
title: "WebSocketリレー"
description: "WebSocketリレーミドルウェアはHTTP接続をWebSocketへアップグレードし、対象プロセスとの間でメッセージを中継します。"
---

# WebSocketリレー

`websocket_relay`ミドルウェアはHTTP接続をアップグレードし、WebSocketメッセージを対象プロセスへ中継します。

**分類：部分的な統合レシピを含むプロトコルリファレンス。** ブロックは、HTTPサーバー、ルーター、プロセスホスト、対象プロセス、セキュリティコンテキストが存在することを前提としています。アプリケーションのメッセージハンドラとクライアント状態のクリーンアップは、アプリケーション側が担当します。

## 仕組み

1. HTTPハンドラが対象プロセスのPIDを`X-WS-Relay`ヘッダーに設定します
2. ミドルウェアが接続をWebSocketへアップグレードします
3. リレーが対象プロセスへアタッチし、監視します
4. クライアントとプロセスの間でメッセージが双方向に流れます

## プロセスのセマンティクス

WebSocket接続は、固有のPIDを持つ完全なプロセスです。プロセスシステムと次のように統合されます：

- **アドレス指定可能** → 任意のプロセスがWebSocket PIDへメッセージを送信できます
- **監視可能** → プロセスがWebSocket接続の終了イベントを監視できます
- **リンク可能** → WebSocket接続を他のプロセスとリンクできます
- **EXITイベント** → 接続が閉じると、監視プロセスは終了通知を受信します

```lua
-- Monitor a WebSocket connection from another process
local _, monitor_err = process.monitor(websocket_pid)
if monitor_err then return nil, monitor_err end

-- Send a message to the WebSocket client from any process.
-- The relay wraps it as {topic, data} JSON; the topic name is arbitrary.
local _, send_err = process.send(websocket_pid, "update", "hello")
if send_err then return nil, send_err end
```

<tip>
リレーは対象プロセスを監視します。対象が終了すると、WebSocket接続は自動的に閉じ、クライアントはcloseフレームを受信します。
</tip>

## 接続の移譲

制御メッセージを送信することで、接続を別のプロセスへ移譲できます：

```lua
local _, transfer_err = process.send(websocket_pid, "ws.control", {
    target_pid = new_process_pid,
    message_topic = "ws.message"
})
if transfer_err then return nil, transfer_err end
```

## 設定

ルーターのマッチ後ミドルウェアとして追加します：

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
|--------|-------------|
| `wsrelay.allowed.origins` | 許可するオリジン（カンマ区切り） |

<note>
オリジンが設定されていない場合は、同一オリジンのリクエストのみ許可されます。
</note>

## ハンドラのセットアップ

HTTPハンドラはプロセスを生成し、リレーを設定します：

```lua
local http = require("http")
local json = require("json")

local function handler()
    local req, req_err = http.request()
    if req_err then return nil, req_err end
    local res, res_err = http.response()
    if res_err then return nil, res_err end

    local user_id, query_err = req:query("user_id")
    if query_err then return nil, query_err end

    -- Spawn handler process
    local pid, spawn_err = process.spawn("app.ws:handler", "app:processes")
    if spawn_err then return nil, spawn_err end

    -- Configure relay
    local relay_config, encode_err = json.encode({
        target_pid = tostring(pid),
        message_topic = "ws.message",
        heartbeat_interval = "30s",
        metadata = {
            user_id = user_id
        }
    })
    if encode_err then
        local _, terminate_err = process.terminate(pid)
        return nil, terminate_err or encode_err
    end

    local header_err = res:set_header("X-WS-Relay", relay_config)
    if header_err then
        local _, terminate_err = process.terminate(pid)
        return nil, terminate_err or header_err
    end
end
```

### リレー設定のフィールド

| フィールド | 型 | デフォルト | 説明 |
|-------|------|---------|-------------|
| `target_pid` | string | 必須 | メッセージを受信するプロセスPID |
| `message_topic` | string | `ws.message` | クライアントメッセージのトピック |
| `heartbeat_interval` | duration | `30s` | ハートビート間隔（`30s`など） |
| `metadata` | object | - | join、leave、heartbeat通知に添付されるデータ |

## メッセージトピック

リレーは対象プロセスへ次のメッセージを送信します：

| トピック | タイミング | ペイロード |
|-------|------|---------|
| `ws.join` | クライアント接続時 | JSON `{client_pid, metadata}` |
| `ws.message`（または指定した`message_topic`） | クライアントがメッセージを送信したとき | クライアントの生ペイロード（テキストフレーム → String形式、バイナリフレーム → Bytes形式）。どちらの形式でも`payload:data()`はLua文字列を返し、送信元PIDはクライアントPIDです |
| `ws.heartbeat` | 定期的（デフォルトは30秒ごと。`heartbeat_interval`で変更可能） | JSON `{client_pid, uptime, message_count, metadata}` |
| `ws.leave` | クライアント切断時 | JSON `{client_pid, metadata}` |

## メッセージの受信

```lua
local function handler()
    local inbox = process.inbox()

    while true do
        local msg, ok = inbox:receive()
        if not ok then break end

        local topic = msg:topic()
        local from = msg:from()                -- client connection PID

        if topic == "ws.join" then
            -- Client connected — payload is {client_pid, metadata}
            local data, payload_err = msg:payload():data()
            if payload_err then return nil, payload_err end
            local client_pid = data.client_pid

        elseif topic == "ws.message" then
            -- Raw client message; from() is the client PID
            local incoming = msg:payload()
            local frame_format = incoming:get_format()     -- "text/plain" or "application/octet-stream"
            local body, payload_err = incoming:data()      -- Lua string in either case
            if payload_err then return nil, payload_err end
            -- Decode or dispatch `body` according to `frame_format` and the
            -- application's protocol.

        elseif topic == "ws.leave" then
            -- Client disconnected — payload is {client_pid, metadata}
            -- Release application state associated with `from`.
        end
    end
end
```

## クライアントへの送信

クライアントPIDを使用してメッセージを送り返します。任意のトピックが`{topic, data}`形式のJSONでラップされ、WebSocketへ転送されます。サーバーからクライアントへの各メッセージは、ラッパーを含む1つのWebSocketテキストフレームとして送信されます。テーブルは`data`内のJSONオブジェクトのまま、文字列は文字列のままです。Bytes形式でリレーに到達したペイロードは`data`内でBase64エンコードされ、別個のバイナリフレームとしては送信されません。Luaの`process.send`は引数をLua形式のペイロードとしてエクスポートするため、Lua文字列がBytes形式の分岐に入ることはありません。

```lua
-- Send a structured message (any topic name)
local _, send_err = process.send(client_pid, "update", {event = "update", value = 42})
if send_err then return nil, send_err end

-- Close connection (payload is the close reason string)
local _, close_err = process.send(client_pid, "ws.close", "Session ended")
if close_err then return nil, close_err end
```

サーバー → クライアント方向で予約されているトピックは、`ws.control`（リレーの再設定）と`ws.close`（接続の終了）です。

## ブロードキャスト

複数のクライアントへブロードキャストするには、クライアントPIDを追跡します：

```lua
local clients = {}

-- On join
clients[client_pid] = true

-- On leave
clients[client_pid] = nil

-- Broadcast
local function broadcast(message)
    for pid, _ in pairs(clients) do
        local _, send_err = process.send(pid, "broadcast", message)
        if send_err then return nil, send_err end
    end
    return true
end
```

<tip>
複雑なマルチルーム構成では、ルームごとに個別のハンドラプロセスを生成するか、ルームメンバーシップを追跡する中央管理プロセスを使用してください。
</tip>

## 関連項目

- [ミドルウェア](./middleware.md) - ミドルウェア設定
- [プロセス](../lua/core/process.md) - プロセスメッセージング
- [WebSocketクライアント](../lua/http/websocket.md) - 外向きWebSocket接続
