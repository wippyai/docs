---
title: "WebSocket クライアント"
description: "WebSocket サーバーへ接続し、メッセージの送受信、圧縮、タイムアウト、クローズコードを使用します。"
---

# WebSocket クライアント
<secondary-label ref="network"/>
<secondary-label ref="io"/>
<secondary-label ref="permissions"/>

`websocket` モジュールは WebSocket サーバーへの双方向クライアント接続を作成します。

このページは API リファレンスであり、接続と購読の部分的なレシピを含みます。エンドポイント URL、トークン、メッセージハンドラー、アプリケーションデータは周囲のアプリケーションが提供します。ライフサイクル例では、すべての終端パスまたは検査済みエラーパスでクライアントを閉じます。小さなメソッド例では、外側のオーナーがそのクリーンアップを行うものとします。

## ロード

```lua
local websocket = require("websocket")
```

require する前に、実行可能エントリの `modules:` リストへ `websocket` を追加してください。`channel` グローバルは常に利用できます。JSON とタイムアウトのレシピでは `json` と `time` も必要です。

## 接続

### `connect`

既定オプションで WebSocket 接続を開きます。

```lua
local client, err = websocket.connect("wss://api.example.com/ws")
if err then
    return nil, err
end
```

オプションテーブルを渡すと接続を設定できます。

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
if err then
    return nil, err
end
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `url` | string | WebSocket URL（ws://またはwss://） |
| `options` | table | 接続オプション（オプション） |

**戻り値:** `Client, error`

#### 接続オプション

| オプション | 型 | 説明 |
|--------|------|-------------|
| `headers` | table | 文字列から文字列への HTTP ハンドシェイクヘッダー。その他のエントリは無視 |
| `protocols` | table | WebSocket サブプロトコル文字列。文字列以外のエントリは無視 |
| `dial_timeout` | number/string | 接続タイムアウト。`0` はランタイム全体の接続期限を設定しないが、基盤 HTTP トランスポートの既定値は適用 |
| `read_timeout` | number/string | メッセージごとの読み取りタイムアウト。`0` で無効化 |
| `write_timeout` | number/string | Lua API は受け付けるが、ランタイム `v0.3.32a` では適用されない |
| `compression` | number/string | `0`/`"disabled"`、`1`/`"context_takeover"`、`2`/`"no_context_takeover"`。既定は無効 |
| `compression_threshold` | number | 圧縮する最小バイト数（0-104857600）。`0` は context takeover で 128 バイト、no-context-takeover で 512 バイト |
| `read_limit` | number | 受信メッセージの最大バイト数（0-134217728）。`0` は 16 MiB |
| `channel_capacity` | number | サービス側の受信メッセージバッファ（1-10000）。既定 16 |

**タイムアウト形式:** 数値はミリ秒、文字列はGo duration形式（"5s"、"1m"）。

無効なタイムアウト文字列、範囲外または未対応のオプション値は無視され、対応する既定値が使われます。

## メッセージの送信

### テキストメッセージ

テキストメッセージを送信します。

```lua
local json = require("json")

client:send("Hello, Server!")

-- Send JSON
local payload, encode_err = json.encode({
    type = "subscribe",
    channel = "orders"
})
if encode_err then return nil, encode_err end
client:send(payload)
```

### バイナリメッセージ

`websocket.BINARY` を指定してバイナリメッセージを送信します。

```lua
client:send(binary_data, websocket.BINARY)
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `data` | string | メッセージ内容 |
| `type` | number | `websocket.TEXT`（1）または`websocket.BINARY`（2） |

`type` が省略されるか `websocket.TEXT`/`websocket.BINARY` 以外なら、ランタイムはテキストメッセージとして送信します。送信コマンドが完了するまで yield し、戻り値はありません。ランタイム `v0.3.32a` では、トランスポートの送信失敗は Lua に返されません。

### Ping

ping フレームを送信します。

```lua
client:ping()
```

ping コマンドが完了するまで yield し、戻り値はありません。ランタイム `v0.3.32a` では、トランスポートの ping 失敗は Lua に返されません。

## メッセージの受信

`channel()` は受信チャネルを返し、`receive()` はその別名です。最初の呼び出しはランタイムが購読を作成する間 yield し、それ以降は同じチャネルを直ちに返します。購読に失敗すると `nil, error` を返します。このチャネルは `channel.select` で使用できます。

### 基本受信

```lua
local ch, err = client:channel()
if err then
    client:close()
    return nil, err
end

local msg, ok = ch:receive()
if ok then
    print("Type:", msg.type)  -- "text" or "binary"
    print("Data:", msg.data)
end

local _, close_err = client:close()
if close_err then return nil, close_err end
```

### メッセージループ

```lua
local json = require("json")

local ch, err = client:channel()
if err then
    client:close()
    return nil, err
end

while true do
    local msg, ok = ch:receive()
    if not ok then
        break  -- Connection closed
    end

    if msg.type == "text" then
        local data, decode_err = json.decode(msg.data)
        if decode_err then
            client:close()
            return nil, decode_err
        end
        handle_message(data)
    end
end

local _, close_err = client:close()
if close_err then return nil, close_err end
```

### Selectと併用

```lua
local json = require("json")
local time = require("time")

local ch, ch_err = client:channel()
if ch_err then
    client:close()
    return nil, ch_err
end

local timeout, timeout_err = time.after("30s")
if timeout_err then
    client:close()
    return nil, timeout_err
end

while true do
    local r = channel.select {
        ch:case_receive(),
        timeout:case_receive()
    }

    if r.channel == timeout then
        client:ping()  -- Keep-alive
        timeout, timeout_err = time.after("30s")
        if timeout_err then
            client:close()
            return nil, timeout_err
        end
    elseif not r.ok then
        break
    else
        local data, decode_err = json.decode(r.value.data)
        if decode_err then
            client:close()
            return nil, decode_err
        end
        process(data)
    end
end

local _, close_err = client:close()
if close_err then return nil, close_err end
```

### メッセージオブジェクト

| フィールド | 型 | 説明 |
|-------|------|-------------|
| `type` | string | `"text"`または`"binary"` |
| `data` | string? | メッセージ内容（不明なペイロードタイプの場合は nil） |

## 接続のクローズ

任意のステータスコードと理由を指定して接続を閉じます。

```lua
local _, close_err = client:close(websocket.CLOSE_CODES.NORMAL, "Session ended")
if close_err then return nil, close_err end

-- Omitting both arguments also uses normal close code 1000.
-- Use INTERNAL_ERROR with an application-owned reason for a failed session.
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `code` | number | クローズコード（1000-4999）、デフォルト1000 |
| `reason` | string | クローズ理由（オプション） |

クローズコマンドが完了するまで yield します。成功時は戻り値なし、失敗時は `nil, error` です。検査する場合は 2 つの結果を受け取ってください。エラーは第 2 戻り値です。受け付ける数値範囲外の値は無視され、既定コード `1000` が使われます。

受信チャネルはクライアントが所有するため、直接閉じないでください。リモートの終端イベントがチャネルを閉じます。`client:close()` は受信チャネルの購読を解除してクライアント側プロデューサーを停止するため、プロセス終了時のクリーンアップに頼らず速やかに呼び出してください。

## 定数

### メッセージタイプ

```lua
-- Numeric (for send)
websocket.TEXT    -- 1
websocket.BINARY  -- 2

-- Compatibility string constants
websocket.TYPE_TEXT    -- "text"
websocket.TYPE_BINARY  -- "binary"
websocket.TYPE_PING    -- "ping"
websocket.TYPE_PONG    -- "pong"
websocket.TYPE_CLOSE   -- "close"
```

受信チャネルのメッセージオブジェクトが使用するのは `"text"` と `"binary"` だけです。ping/pong フレームはトランスポートが処理し、終端イベントは `"close"` メッセージオブジェクトを生成せずチャネルを閉じます。

### 圧縮モード

```lua
websocket.COMPRESSION.DISABLED         -- 0 (no compression)
websocket.COMPRESSION.CONTEXT_TAKEOVER -- 1 (sliding window)
websocket.COMPRESSION.NO_CONTEXT       -- 2 (per-message)
```

### クローズコード

| 定数 | コード | 説明 |
|----------|------|-------------|
| `NORMAL` | 1000 | 正常終了 |
| `GOING_AWAY` | 1001 | サーバーシャットダウン |
| `PROTOCOL_ERROR` | 1002 | プロトコルエラー |
| `UNSUPPORTED_DATA` | 1003 | サポートされていないデータ型 |
| `RESERVED` | 1004 | 予約済み |
| `NO_STATUS` | 1005 | ステータスを受信していない |
| `ABNORMAL_CLOSURE` | 1006 | 接続が切断 |
| `INVALID_PAYLOAD` | 1007 | 無効なフレームペイロード |
| `POLICY_VIOLATION` | 1008 | ポリシー違反 |
| `MESSAGE_TOO_BIG` | 1009 | メッセージが大きすぎる |
| `MANDATORY_EXTENSION` | 1010 | 必須拡張がネゴシエートされていない |
| `INTERNAL_ERROR` | 1011 | サーバーエラー |
| `SERVICE_RESTART` | 1012 | サーバー再起動中 |
| `TRY_AGAIN_LATER` | 1013 | サーバー過負荷 |
| `BAD_GATEWAY` | 1014 | ゲートウェイエラー |
| `TLS_HANDSHAKE` | 1015 | TLSハンドシェイク失敗 |

```lua
local _, close_err = client:close(websocket.CLOSE_CODES.NORMAL, "Done")
if close_err then return nil, close_err end
```

## 例

### リアルタイムチャット

```lua
local json = require("json")

local function connect_chat(room_id, token, on_message)
    local client, err = websocket.connect("wss://chat.example.com/ws", {
        headers = {["Authorization"] = "Bearer " .. token}
    })
    if err then
        return nil, err
    end

    -- Join room. Runtime v0.3.32a does not expose transport send failures.
    local join_payload, encode_err = json.encode({
        type = "join",
        room = room_id
    })
    if encode_err then
        client:close()
        return nil, encode_err
    end
    client:send(join_payload)

    -- Message loop
    local ch, channel_err = client:channel()
    if channel_err then
        client:close()
        return nil, channel_err
    end
    while true do
        local msg, ok = ch:receive()
        if not ok then break end

        local data, decode_err = json.decode(msg.data)
        if decode_err then
            client:close()
            return nil, decode_err
        end
        on_message(data)
    end

    local _, close_err = client:close()
    if close_err then return nil, close_err end
    return true
end
```

### Keep-Alive付き価格ストリーム

```lua
local json = require("json")
local time = require("time")

local client, err = websocket.connect("wss://stream.example.com/prices")
if err then
    return nil, err
end

local subscribe_payload, encode_err = json.encode({
    action = "subscribe",
    symbols = {"BTC-USD", "ETH-USD"}
})
if encode_err then
    client:close()
    return nil, encode_err
end
client:send(subscribe_payload)

local ch, channel_err = client:channel()
if channel_err then
    client:close()
    return nil, channel_err
end

local heartbeat, heartbeat_err = time.after("30s")
if heartbeat_err then
    client:close()
    return nil, heartbeat_err
end

while true do
    local r = channel.select {
        ch:case_receive(),
        heartbeat:case_receive()
    }

    if r.channel == heartbeat then
        client:ping()
        heartbeat, heartbeat_err = time.after("30s")
        if heartbeat_err then
            client:close()
            return nil, heartbeat_err
        end
    elseif not r.ok then
        break  -- Connection closed
    else
        local price, decode_err = json.decode(r.value.data)
        if decode_err then
            client:close()
            return nil, decode_err
        end
        update_price(price.symbol, price.value)
    end
end

local _, close_err = client:close()
if close_err then return nil, close_err end
```

## 権限

WebSocket接続はセキュリティポリシー評価の対象。

### セキュリティアクション

| アクション | リソース | 説明 |
|--------|----------|-------------|
| `websocket.connect` | - | WebSocket接続を許可/拒否 |
| `websocket.connect.url` | URL | 特定のURLへの接続を許可/拒否 |

ポリシー設定については[セキュリティモデル](system/security.md)を参照してください。

## エラー

| 条件 | 種別 | 再試行可能 |
|-----------|------|-----------|
| 接続が無効化 | `errors.PERMISSION_DENIED` | いいえ |
| URLが許可されていない | `errors.PERMISSION_DENIED` | いいえ |
| コンテキストがない | `errors.INTERNAL` | いいえ |
| 接続失敗 | `errors.INTERNAL` | はい |
| ディスパッチャーが返した無効な接続 ID | `errors.INTERNAL` | いいえ |
| 購読失敗 | `errors.INTERNAL` | はい |
| 購読時にプロセスコンテキストがない | `errors.INTERNAL` | いいえ |
| クローズ失敗 | `errors.INTERNAL` | いいえ |

空の URL、テーブル以外の options 値、無効な引数型、受信チャネル要求時に実行コンテキストまたはプロセス PID がない場合は Lua エラーが発生します。構造化エラーとしては返されません。ランタイム `v0.3.32a` は send または ping のトランスポート失敗を Lua 呼び出し側へ公開しません。

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

エラーの処理については[エラー処理](lua/core/errors.md)を参照してください。
