---
title: "Server-Sent Events"
description: "短時間のハンドライベントまたはプロセスを基盤とする長時間のイベントを、Server-Sent Eventsでストリーミングします。"
---

# Server-Sent Events :id=server-sent-events

SSEミドルウェアは、[Server-Sent Events](https://html.spec.whatwg.org/multipage/server-sent-events.html)プロトコルを使用して、サーバーからHTTPクライアントへイベントをストリーミングします。

利用できる仕組みは2つあります。HTTPハンドラからの**直接ストリーミング**と、`sse_relay`ミドルウェアを介した**プロセスベースのリレー**です。

**分類：部分的な統合レシピを含むプロトコルリファレンス。** リレーブロックは、HTTPサーバー、ルーター、プロセスホスト、対象プロセス、セキュリティコンテキストがすでに存在することを前提としています。アプリケーションのコールバックとクライアントの動作は、これらのスニペットの範囲外です。

## 直接ストリーミング

HTTPハンドラからSSEイベントを直接送信するには、`res:write_event()`を使用します。最初の呼び出しでレスポンスが自動的にSSEモードへ切り替わり、適切なヘッダーが設定されます。

```lua
local http = require("http")

local function handler()
    local res, res_err = http.response()
    if res_err then return nil, res_err end

    local err = res:write_event({name = "status", data = {state = "started"}})
    if err then return nil, err end
    err = res:write_event({name = "progress", data = {percent = 50}})
    if err then return nil, err end
    err = res:write_event({name = "status", data = {state = "complete"}})
    if err then return nil, err end
    return true
end
```

各イベントには`name`フィールドと`data`フィールドが必要です。`data`の値は自動的にJSONエンコードされます。

<tip>
直接ストリーミングは、進捗更新など、短時間で完結するリクエスト／レスポンスフローに適しています。バックグラウンドプロセスが管理する長時間接続にはSSEリレーを使用してください。
</tip>

## SSEリレー

SSEリレーミドルウェアは、プロセスを基盤とする長時間のSSEストリームを作成します。[WebSocketリレー](http/websocket-relay.md)と同じリレーパターンに従います。

### 仕組み

1. HTTPハンドラが、JSON形式のリレー設定を`X-SSE-Relay`ヘッダーに設定します
2. ミドルウェアがレスポンスをインターセプトし、SSEセッションを作成します
3. セッションが固有のPIDを持つプロセスとして登録されます
4. セッションPIDへ送信されたメッセージがSSEイベントとしてクライアントに転送されます

## プロセスのセマンティクス

SSEストリームは、固有のPIDを持つ完全なプロセスです。プロセスシステムと次のように統合されます：

- **アドレス指定可能** — 任意のプロセスがストリームPIDへメッセージを送信できます
- **監視可能** — プロセスがSSEストリームの終了イベントを監視できます
- **リンク可能** — SSEストリームを他のプロセスとリンクできます
- **EXITイベント** — ストリームが閉じると、監視プロセスは終了通知を受信します

```lua
-- Send event to SSE client from any process
local _, send_err = process.send(stream_pid, "sse.message", {event = "update", value = 42})
if send_err then return nil, send_err end

-- Monitor an SSE stream
local _, monitor_err = process.monitor(stream_pid)
if monitor_err then return nil, monitor_err end
```

<tip>
リレーは対象プロセスを監視します。対象が終了すると、SSEストリームは自動的に閉じ、クライアントは`done`イベントを受信します。
</tip>

## 設定

ルーターのマッチ後ミドルウェアとして追加します：

```yaml
- name: sse_router
  kind: http.router
  meta:
    server: gateway
  prefix: /sse
  post_middleware:
    - sse_relay
  post_options:
    sserelay.allowed.origins: "https://app.example.com"
```

| オプション | 説明 |
|--------|-------------|
| `sserelay.allowed.origins` | 許可するオリジン（カンマ区切り、ワイルドカード対応） |

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
    local pid, spawn_err = process.spawn("app.sse:handler", "app:processes")
    if spawn_err then return nil, spawn_err end

    -- Configure relay
    local relay_config, encode_err = json.encode({
        target_pid = tostring(pid),
        message_topic = "sse.message",
        heartbeat_interval = "30s",
        metadata = {
            user_id = user_id
        }
    })
    if encode_err then
        local _, terminate_err = process.terminate(pid)
        return nil, terminate_err or encode_err
    end

    local header_err = res:set_header("X-SSE-Relay", relay_config)
    if header_err then
        local _, terminate_err = process.terminate(pid)
        return nil, terminate_err or header_err
    end
end
```

### リレー設定のフィールド

| フィールド | 型 | デフォルト | 説明 |
|-------|------|---------|-------------|
| `target_pid` | string | — | メッセージを受信するプロセスPID（デタッチモードでは省略） |
| `message_topic` | string | `sse.message` | 転送するイベントのトピックフィルター |
| `heartbeat_interval` | duration | `30s` | ハートビート間隔（`30s`、`1m`など） |
| `idle_timeout` | duration | — | 非アクティブ状態が続いた場合にストリームを閉じるまでの時間 |
| `hard_timeout` | duration | — | 絶対経過時間に基づいてストリームを閉じるまでの時間 |
| `metadata` | object | — | join／leave／heartbeatメッセージに添付されるデータ |

## 管理モードとデタッチモード

### 管理モード

`target_pid`を設定すると、リレーは管理モードで動作します：

- 対象プロセスを監視します
- 接続時に`sse.join`、切断時に`sse.leave`を送信します
- 対象が終了するとストリームを自動的に閉じます

### デタッチモード

`target_pid`を省略すると、リレーはデタッチモードで開始します：

- `ready`イベントを、`stream_pid`と`message_topic`を含めてクライアントへ送信します
- 初期状態ではプロセスを監視しません
- プロセスは後から`sse.control`メッセージを送信してアタッチできます

`json`をインポートし、レスポンスオブジェクトを`res`として取得済みのハンドラ内では、次のようにデタッチモードを設定し、両方の操作を確認します：

```lua
-- Detached setup: no target_pid
local relay_config, encode_err = json.encode({
    heartbeat_interval = "30s"
})
if encode_err then return nil, encode_err end

local header_err = res:set_header("X-SSE-Relay", relay_config)
if header_err then return nil, header_err end
```

クライアントは`ready`イベントを受信します：

```json
{"stream_pid": "{n1@app:processes|sse-1}", "message_topic": "sse.message"}
```

## メッセージトピック

リレーは、ストリームと対象プロセス間の通信に次のトピックを使用します：

| トピック | 方向 | タイミング | ペイロード |
|-------|-----------|------|---------|
| `sse.join` | ストリーム → 対象 | クライアント接続時 | `client_pid`、`metadata` |
| `sse.message` | 対象 → ストリーム | デフォルトのイベントトピック | SSEイベントとして転送 |
| `sse.heartbeat` | ストリーム → 対象 | 定期的（設定されている場合） | `client_pid`、`uptime`、`message_count`、`metadata` |
| `sse.leave` | ストリーム → 対象 | クライアント切断時 | `client_pid`、`metadata` |
| `sse.control` | 任意 → ストリーム | 制御コマンド | リレー設定フィールド |
| `sse.close` | 任意 → ストリーム | 強制終了 | 省略可能な理由文字列 |

## 対象プロセスでの受信

```lua
local function handler()
    local inbox = process.inbox()

    while true do
        local msg, ok = inbox:receive()
        if not ok then break end

        local topic = msg:topic()
        local data, payload_err = msg:payload():data()
        if payload_err then return nil, payload_err end

        if topic == "sse.join" then
            local client_pid = data.client_pid

        elseif topic == "sse.heartbeat" then
            -- Periodic health check

        elseif topic == "sse.leave" then
            -- Release application state associated with data.client_pid.
        end
    end
end
```

## イベントの送信

ストリームPIDへメッセージを送信することで、クライアントへイベントを送ります：

```lua
-- Send on the default message topic
local _, send_err = process.send(stream_pid, "sse.message", {
    event = "update",
    value = 42
})
if send_err then return nil, send_err end

-- Force close the stream
local _, close_err = process.send(stream_pid, "sse.close", "session expired")
if close_err then return nil, close_err end
```

設定した`message_topic`で送信されたイベントは、SSEイベントとしてクライアントに転送されます。トピック名がSSEイベント名になります。

## 接続の移譲

対象プロセス、トピックフィルター、タイムアウトを動的に変更するには、制御メッセージを送信します：

```lua
local _, transfer_err = process.send(stream_pid, "sse.control", {
    target_pid = tostring(new_pid),
    message_topic = "custom.topic",
    idle_timeout = "5m"
})
if transfer_err then return nil, transfer_err end
```

対象が変わると、リレーはまず新しい対象の監視を開始して`sse.join`を送信し、その後で以前の対象の監視を停止して`sse.leave`を送信します。再アタッチせずにデタッチするには、`target_pid`を空文字列に設定します。

## 関連項目

- [ミドルウェア](http/middleware.md) — ミドルウェア設定
- [WebSocketリレー](http/websocket-relay.md) — WebSocketでの同等機能
- [プロセス](lua/core/process.md) — プロセスメッセージング
