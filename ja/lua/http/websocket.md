# WebSocketクライアント
<secondary-label ref="network"/>
<secondary-label ref="io"/>
<secondary-label ref="permissions"/>

サーバーとのリアルタイム双方向通信用WebSocketクライアント。

## ロード

```lua
local websocket = require("websocket")
```

## 接続

### 基本接続

```lua
local client, err = websocket.connect("wss://api.example.com/ws")
if err then
    return nil, err
end
```

### オプション付き

```lua
local client, err = websocket.connect("wss://api.example.com/ws", {
    headers = {
        ["Authorization"] = "Bearer " .. token
    },
    protocols = {"graphql-ws"},
    dial_timeout = "10s",
    read_timeout = "30s",
    compression = websocket.COMPRESSION.CONTEXT_TAKEOVER
})
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `url` | string | WebSocket URL（ws://またはwss://） |
| `options` | table | 接続オプション（オプション） |

**戻り値:** `Client, error`

### 接続オプション

| オプション | 型 | 説明 |
|--------|------|-------------|
| `headers` | table | ハンドシェイク用HTTPヘッダー |
| `protocols` | table | WebSocketサブプロトコル |
| `dial_timeout` | number/string | 接続タイムアウト（msまたは"5s"） |
| `read_timeout` | number/string | 読み取りタイムアウト |
| `write_timeout` | number/string | 書き込みタイムアウト |
| `compression` | number | 圧縮モード（定数を参照） |
| `compression_threshold` | number | 圧縮する最小サイズ（0-100MB） |
| `read_limit` | number | 最大メッセージサイズ（0-128MB） |
| `channel_capacity` | number | 受信チャネルバッファ（1-10000） |

**タイムアウト形式:** 数値はミリ秒、文字列はGo duration形式（"5s"、"1m"）。

## メッセージの送信

### テキストメッセージ

```lua
local ok, err = client:send("Hello, Server!")
if err then
    return nil, err
end

-- JSONを送信
client:send(json.encode({
    type = "subscribe",
    channel = "orders"
}))
```

### バイナリメッセージ

```lua
client:send(binary_data, websocket.BINARY)
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `data` | string | メッセージ内容 |
| `type` | number | `websocket.TEXT`（1）または`websocket.BINARY`（2） |

**戻り値:** `boolean, error`

### Ping

```lua
client:ping()
```

**戻り値:** `boolean, error`

## メッセージの受信

`channel()`メソッドはメッセージ受信用のチャネルを返す。多重化のために`channel.select`と連携。

### 基本受信

```lua
local ch = client:channel()

local msg, ok = ch:receive()
if ok then
    print("Type:", msg.type)  -- "text"または"binary"
    print("Data:", msg.data)
end
```

### メッセージループ

```lua
local ch = client:channel()

while true do
    local msg, ok = ch:receive()
    if not ok then
        break  -- 接続がクローズ
    end

    if msg.type == "text" then
        local data = json.decode(msg.data)
        handle_message(data)
    end
end
```

### Selectと併用

```lua
local ch = client:channel()
local timeout = time.after("30s")

while true do
    local r = channel.select {
        ch:case_receive(),
        timeout:case_receive()
    }

    if r.channel == timeout then
        client:ping()  -- Keep-alive
        timeout = time.after("30s")
    else
        local data = json.decode(r.value.data)
        process(data)
    end
end
```

### メッセージオブジェクト

| フィールド | 型 | 説明 |
|-------|------|-------------|
| `type` | string | `"text"`または`"binary"` |
| `data` | string | メッセージ内容 |

## 接続のクローズ

```lua
-- 通常のクローズ（コード1000）
client:close()

-- コードと理由を指定
client:close(websocket.CLOSE_CODES.NORMAL, "Session ended")

-- エラークローズ
client:close(websocket.CLOSE_CODES.INTERNAL_ERROR, "Processing failed")
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `code` | number | クローズコード（1000-4999）、デフォルト1000 |
| `reason` | string | クローズ理由（オプション） |

**戻り値:** `boolean, error`

## 定数

### メッセージタイプ

```lua
-- 数値（送信用）
websocket.TEXT    -- 1
websocket.BINARY  -- 2

-- 文字列（受信メッセージのtypeフィールド）
websocket.TYPE_TEXT    -- "text"
websocket.TYPE_BINARY  -- "binary"
websocket.TYPE_PING    -- "ping"
websocket.TYPE_PONG    -- "pong"
websocket.TYPE_CLOSE   -- "close"
```

### 圧縮モード

```lua
websocket.COMPRESSION.DISABLED         -- 0（圧縮なし）
websocket.COMPRESSION.CONTEXT_TAKEOVER -- 1（スライディングウィンドウ）
websocket.COMPRESSION.NO_CONTEXT       -- 2（メッセージごと）
```

### クローズコード

| 定数 | コード | 説明 |
|----------|------|-------------|
| `NORMAL` | 1000 | 正常終了 |
| `GOING_AWAY` | 1001 | サーバーシャットダウン |
| `PROTOCOL_ERROR` | 1002 | プロトコルエラー |
| `UNSUPPORTED_DATA` | 1003 | サポートされていないデータ型 |
| `NO_STATUS` | 1005 | ステータスを受信していない |
| `ABNORMAL_CLOSURE` | 1006 | 接続が切断 |
| `INVALID_PAYLOAD` | 1007 | 無効なフレームペイロード |
| `POLICY_VIOLATION` | 1008 | ポリシー違反 |
| `MESSAGE_TOO_BIG` | 1009 | メッセージが大きすぎる |
| `INTERNAL_ERROR` | 1011 | サーバーエラー |
| `SERVICE_RESTART` | 1012 | サーバー再起動中 |
| `TRY_AGAIN_LATER` | 1013 | サーバー過負荷 |

```lua
client:close(websocket.CLOSE_CODES.NORMAL, "Done")
```

## 例

### リアルタイムチャット

```lua
local function connect_chat(room_id, on_message)
    local client, err = websocket.connect("wss://chat.example.com/ws", {
        headers = {["Authorization"] = "Bearer " .. token}
    })
    if err then
        return nil, err
    end

    -- ルームに参加
    client:send(json.encode({
        type = "join",
        room = room_id
    }))

    -- メッセージループ
    local ch = client:channel()
    while true do
        local msg, ok = ch:receive()
        if not ok then break end

        local data = json.decode(msg.data)
        on_message(data)
    end

    client:close()
end
```

### Keep-Alive付き価格ストリーム

```lua
local client = websocket.connect("wss://stream.example.com/prices")

client:send(json.encode({
    action = "subscribe",
    symbols = {"BTC-USD", "ETH-USD"}
}))

local ch = client:channel()
local heartbeat = time.after("30s")

while true do
    local r = channel.select {
        ch:case_receive(),
        heartbeat:case_receive()
    }

    if r.channel == heartbeat then
        client:ping()
        heartbeat = time.after("30s")
    elseif not r.ok then
        break  -- 接続がクローズ
    else
        local price = json.decode(r.value.data)
        update_price(price.symbol, price.value)
    end
end

client:close()
```

## 権限

WebSocket接続はセキュリティポリシー評価の対象。

### セキュリティアクション

| アクション | リソース | 説明 |
|--------|----------|-------------|
| `websocket.connect` | - | WebSocket接続を許可/拒否 |
| `websocket.connect.url` | URL | 特定のURLへの接続を許可/拒否 |

ポリシー設定については[セキュリティモデル](system/security.md)を参照。

## エラー

| 条件 | 種別 | 再試行可能 |
|-----------|------|-----------|
| 接続が無効化 | `errors.PERMISSION_DENIED` | no |
| URLが許可されていない | `errors.PERMISSION_DENIED` | no |
| コンテキストがない | `errors.INTERNAL` | no |
| 接続失敗 | `errors.INTERNAL` | yes |
| 無効な接続ID | `errors.INTERNAL` | no |

```lua
local client, err = websocket.connect(url)
if err then
    if errors.is(err, errors.PERMISSION_DENIED) then
        print("Access denied:", err:message())
    elseif err:retryable() then
        print("Temporary error:", err:message())
    end
    return nil, err
end
```

エラーの処理については[エラー処理](lua/core/errors.md)を参照。

