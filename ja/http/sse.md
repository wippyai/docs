# Server-Sent Events

SSE ミドルウェアは、[Server-Sent Events](https://html.spec.whatwg.org/multipage/server-sent-events.html) プロトコルを使用してサーバーから HTTP クライアントへイベントをストリーミングします。

2 つのメカニズムが利用可能です：HTTP ハンドラからの **直接ストリーミング** と、`sse_relay` ミドルウェア経由の **プロセスバックリレー** です。

## 直接ストリーミング

`res:write_event()` を使用して、HTTP ハンドラから SSE イベントを直接送信します。最初の呼び出し時に、レスポンスは自動的に SSE モードへ切り替わり、適切なヘッダが設定されます。

```lua
local http = require("http")

local function handler()
    local res = http.response()

    res:write_event({name = "status", data = {state = "started"}})
    res:write_event({name = "progress", data = {percent = 50}})
    res:write_event({name = "status", data = {state = "complete"}})
end
```

各イベントには `name` と `data` フィールドが必要です。`data` の値は自動的に JSON エンコードされます。

<tip>
直接ストリーミングは、進捗更新のような短命なリクエスト/レスポンスフローに適しています。バックグラウンドプロセスが管理する長期接続には、SSE Relay を使用してください。
</tip>

## SSE Relay

SSE Relay ミドルウェアは、プロセスがバックエンドとなる長期 SSE ストリームを作成します。[WebSocket Relay](http/websocket-relay.md) と同じリレーパターンに従います。

### 仕組み

1. HTTP ハンドラが `X-SSE-Relay` ヘッダに JSON のリレー設定をセットする
2. ミドルウェアがレスポンスをインターセプトし、SSE セッションを作成する
3. セッションは独自の PID を持つプロセスとして登録される
4. セッション PID に送信されたメッセージは、SSE イベントとしてクライアントへ転送される

## プロセスセマンティクス

SSE ストリームは独自の PID を持つ完全なプロセスです。プロセスシステムと統合されています：

- **アドレス可能** — 任意のプロセスがストリーム PID へメッセージを送信できる
- **モニタ可能** — プロセスは SSE ストリームを監視して終了イベントを受信できる
- **リンク可能** — SSE ストリームを他のプロセスとリンクできる
- **EXIT イベント** — ストリームが閉じると、モニタは終了通知を受け取る

```lua
-- 任意のプロセスから SSE クライアントへイベントを送信
process.send(stream_pid, "sse.message", {event = "update", value = 42})

-- SSE ストリームをモニタする
process.monitor(stream_pid)
```

<tip>
リレーはターゲットプロセスをモニタします。ターゲットが終了すると、SSE ストリームは自動的に閉じられ、クライアントは <code>done</code> イベントを受け取ります。
</tip>

## 設定

ルーターの post-match ミドルウェアとして追加します：

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
| `sserelay.allowed.origins` | カンマ区切りの許可オリジン（ワイルドカード対応） |

<note>
オリジンが設定されていない場合、同一オリジンからのリクエストのみが許可されます。
</note>

## ハンドラのセットアップ

HTTP ハンドラはプロセスを生成し、リレーを設定します：

```lua
local http = require("http")
local json = require("json")

local function handler()
    local res = http.response()

    -- ハンドラプロセスを生成
    local pid = process.spawn("app.sse:handler", "app:processes")

    -- リレーを設定
    res:set_header("X-SSE-Relay", json.encode({
        target_pid = tostring(pid),
        message_topic = "sse.message",
        heartbeat_interval = "30s",
        metadata = {
            user_id = http.request():query("user_id")
        }
    }))
end
```

### リレー設定フィールド

| フィールド | 型 | デフォルト | 説明 |
|-------|------|---------|-------------|
| `target_pid` | string | — | メッセージを受信するプロセス PID（detached モードでは省略） |
| `message_topic` | string | `sse.message` | 転送するイベントのトピックフィルタ |
| `heartbeat_interval` | duration | `30s` | ハートビート頻度（例：`30s`、`1m`） |
| `idle_timeout` | duration | — | 一定時間アイドル状態でストリームを閉じる |
| `hard_timeout` | duration | — | 絶対経過時間後にストリームを閉じる |
| `metadata` | object | — | join/leave/heartbeat メッセージに付与される |

## マネージドモード vs デタッチドモード

### マネージドモード

`target_pid` が設定されている場合、リレーはマネージドモードで動作します：

- ターゲットプロセスをモニタする
- 接続時に `sse.join`、切断時に `sse.leave` を送信する
- ターゲットが終了するとストリームを自動的に閉じる

### デタッチドモード

`target_pid` を省略すると、リレーはデタッチドモードで開始します：

- `stream_pid` と `message_topic` を含む `ready` イベントをクライアントへ送出する
- 初期状態ではどのプロセスもモニタされていない
- 後から `sse.control` メッセージを送信してプロセスをアタッチできる

```lua
-- デタッチドセットアップ：target_pid なし
res:set_header("X-SSE-Relay", json.encode({
    heartbeat_interval = "30s"
}))
```

クライアントは `ready` イベントを受信します：

```json
{"stream_pid": "sse@node/abc123", "message_topic": "sse.message"}
```

## メッセージトピック

リレーはストリームとターゲットプロセス間の通信に以下のトピックを使用します：

| トピック | 方向 | タイミング | ペイロード |
|-------|-----------|------|---------|
| `sse.join` | stream → target | クライアント接続時 | `client_pid`、`metadata` |
| `sse.message` | target → stream | デフォルトのイベントトピック | SSE イベントとして転送 |
| `sse.heartbeat` | stream → target | 周期的（設定時） | `client_pid`、`uptime`、`message_count` |
| `sse.leave` | stream → target | クライアント切断時 | `client_pid`、`metadata` |
| `sse.control` | any → stream | 制御コマンド | リレー設定フィールド |
| `sse.close` | any → stream | 強制クローズ | 任意の理由文字列 |

## ターゲットプロセスでの受信

```lua
local json = require("json")

local function handler()
    local inbox = process.inbox()

    while true do
        local msg, ok = inbox:receive()
        if not ok then break end

        local topic = msg:topic()
        local data = msg:payload():data()

        if topic == "sse.join" then
            local client_pid = data.client_pid

        elseif topic == "sse.heartbeat" then
            -- 周期的なヘルスチェック

        elseif topic == "sse.leave" then
            cleanup(data.client_pid)
        end
    end
end
```

## イベントの送信

ストリーム PID へメッセージを送信することでクライアントへイベントを送信します：

```lua
-- デフォルトのメッセージトピックで送信
process.send(stream_pid, "sse.message", {
    event = "update",
    value = 42
})

-- ストリームを強制クローズ
process.send(stream_pid, "sse.close", "session expired")
```

設定済みの `message_topic` で送信されたイベントは、SSE イベントとしてクライアントへ転送されます。トピック名が SSE イベント名になります。

## 接続の転送

制御メッセージを送信して、ターゲットプロセス、トピックフィルタ、タイムアウトを動的に変更します：

```lua
process.send(stream_pid, "sse.control", {
    target_pid = tostring(new_pid),
    message_topic = "custom.topic",
    idle_timeout = "5m"
})
```

ターゲットが変更されると、リレーは古いターゲットへ `sse.leave` を、新しいターゲットへ `sse.join` を送信します。再アタッチせずにデタッチするには、`target_pid` を空文字列に設定します。

## 関連項目

- [ミドルウェア](http/middleware.md) — ミドルウェア設定
- [WebSocket Relay](http/websocket-relay.md) — WebSocket 版
- [プロセス](lua/core/process.md) — プロセスメッセージング
