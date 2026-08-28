---
title: "Relay"
description: "Wippy Relay の hub、WebSocket client、prefix 付き plugin、user isolation、connection lifecycle を設定します。"
---

# Relay

`wippy/relay` モジュールは WebSocket connection を central hub と user ごとの hub を通じてルーティングします。user hub は client connection を管理し、prefix 付き plugin へメッセージを dispatch します。

このページは部分的な integration recipe と protocol リファレンスであり、独立した WebSocket アプリケーションではありません。setup と plugin の block は、既存の Wippy プロジェクト、設定済みの `user_security_scope` に存在する実際の security scope、[WebSocket Relay](http/websocket-relay.md)で説明する Relay へ接続された HTTP WebSocket endpoint を前提としています。protocol payload と lifecycle block はリファレンスの形です。

## アーキテクチャ

```
Central Hub
├── User Hub (alice)
│   ├── Plugin: session_
│   ├── Plugin: ai_
│   ├── WebSocket Client 1
│   └── WebSocket Client 2
├── User Hub (bob)
│   ├── Plugin: session_
│   └── WebSocket Client 1
└── ...
```

central hub は service として実行されます。WebSocket client が接続すると、その user の hub を検索または作成します。user hub は connection lifecycle を管理し、command prefix によってメッセージをルーティングします。

## セットアップ

プロジェクトにモジュールを追加します：

```bash
wippy add wippy/relay
wippy install
```

必要なパラメータとともに依存関係を宣言します：

```yaml
version: "1.0"
namespace: app

entries:
  - name: os_env
    kind: env.storage.os

  - name: processes
    kind: process.host
    lifecycle:
      auto_start: true

  - name: dep.relay
    kind: ns.dependency
    component: wippy/relay
    version: "*"
    parameters:
      - name: application_host
        value: app:processes
      - name: env_storage
        value: app:os_env
      - name: user_security_scope
        value: app.security:user_scope
```

### 設定パラメータ

| パラメータ | 必須 | デフォルト | 説明 |
|-----------|----------|---------|-------------|
| `application_host` | はい | — | リレープロセス用のプロセスホスト |
| `env_storage` | いいえ | 内部 | 環境変数ストレージ |
| `user_security_scope` | はい | — | ユーザーハブ用のセキュリティスコープ |
| `max_connections_per_user` | いいえ | `5` | ユーザーごとの WebSocket 接続数 |
| `queue_multiplier` | いいえ | `100` | メッセージキュー = 接続数 × 乗数 |
| `user_hub_inactivity_timeout` | いいえ | `7200s` | ハブクリーンアップまでのアイドル時間 |

## クライアント接続フロー

1. WebSocket クライアントがメタデータ内に `user_id` を含めて接続する
2. 中央ハブが接続を検証し、ユーザーごとの上限をチェックする
3. 中央ハブがそのユーザー用のユーザーハブを作成または再利用する
4. ユーザーハブがクライアントへ `welcome` メッセージを送信する：

```json
{
    "user_id": "alice",
    "client_count": 1,
    "plugins": [
        { "prefix": "session_", "process_id": "...", "status": "running" },
        { "prefix": "ai_", "process_id": "...", "status": "pending" }
    ]
}
```

plugin の `status` は `"not_started"`（登録済みだが一度も生成されていない）、`"pending"`（生成中）、`"running"`、`"failed"`、`"stopped"` のいずれかです。

## メッセージルーティング

クライアントは `type` フィールドを持つ JSON メッセージを送信します。ユーザーハブは登録されたプラグインに対してタイププレフィックスを照合し、メッセージをルーティングします：

```json
{ "type": "session_get_state", "data": { "key": "value" } }
```

`session_` prefix は session plugin を選択します。hub は prefix を取り除き、残りの type を topic として plugin process へメッセージを送信します。

```lua
-- process topic: "get_state"
-- payload:
{
    conn_pid = client_pid,
    type = "session_get_state",  -- original full type preserved
    data = { key = "value" },
    request_id = "...",
    session_id = "..."
}
```

プラグインは `conn_pid` にメッセージを送信して応答します。

## プラグイン

プラグインは `meta.type: relay.plugin` を持つ `process.lua` エントリです：

```yaml
entries:
  - name: session_plugin
    kind: process.lua
    meta:
      type: relay.plugin
      command_prefix: session_
      auto_start: true
    source: file://session_plugin.lua
    modules: [json, time, logger]
    method: run
```

### プラグインメタデータ

| フィールド | 型 | 説明 |
|-------|------|-------------|
| `meta.type` | string | `relay.plugin` でなければならない |
| `meta.command_prefix` | string | このプラグインが処理するメッセージタイプのプレフィックス |
| `meta.auto_start` | boolean | ユーザーハブ初期化時に開始する |
| `meta.default_host` | string | プロセスホストを上書きする |

### プラグインのライフサイクル

user hub は各 plugin を次の起動引数で生成します。

```lua
function run(args)
    local user_id = args.user_id
    local user_metadata = args.user_metadata
    local user_hub_pid = args.user_hub_pid
    local config = args.config
end
```

`session_` プラグインはライフサイクルメッセージを受け取ります：

| メッセージ | タイミング |
|---------|------|
| `"resume"` | 最初のクライアントがユーザーハブへ接続したとき |
| `"shutdown"` | 最後のクライアントがユーザーハブから切断したとき |

プラグインはクラッシュ時に 1 回の自動再起動が行われます。2 回目のクラッシュ後、プラグインは `"failed"` としてマークされ、再起動されません。

### プラグイン実装

plugin は process inbox を通じてメッセージを受け取ります。各メッセージは command type から派生した topic と、元の message data および応答用の `conn_pid` を含む payload を持ちます。

```lua
local json = require("json")

local function handle_message(topic, payload)
    if topic == "get_state" then
        if not payload.conn_pid then
            return nil, "Relay message is missing conn_pid"
        end

        local encoded, encode_err = json.encode({
            type = "session_state",
            data = { status = "active" }
        })
        if encode_err then
            return nil, encode_err
        end

        local sent, send_err = process.send(payload.conn_pid, "ws.message", encoded)
        if not sent then
            return nil, send_err or "Relay response was not sent"
        end
    end

    return true
end

local function run(args)
    local user_id = args.user_id
    local inbox = process.inbox()
    local events = process.events()

    while true do
        local result = channel.select({
            inbox:case_receive(),
            events:case_receive()
        })
        if not result.ok then break end

        if result.channel == inbox then
            local msg = result.value
            local topic = msg:topic()
            local payload = msg:payload():data()

            if topic == "resume" then
                -- first client connected
            elseif topic == "shutdown" then
                -- last client disconnected
            else
                local ok, err = handle_message(topic, payload)
                if not ok then
                    error("Failed to handle relay message: " .. tostring(err))
                end
            end
        elseif result.channel == events then
            local event = result.value
            if event.kind == process.event.CANCEL then
                break
            end
        end
    end
end

return { run = run }
```

## エラー処理

Relay は次の code で client error を報告します。

| エラーコード | 説明 |
|------------|-------------|
| `max_connections_reached` | ユーザーが接続上限に達した |
| `missing_user_id` | 接続メタデータに user_id がない |
| `hub_creation_failed` | ユーザーハブの生成に失敗した |
| `invalid_json` | メッセージのデコードエラー |
| `unknown_command` | メッセージに type フィールドがない |
| `plugin_not_found` | コマンドプレフィックスに一致するプラグインがない |
| `plugin_failed` | プラグインが利用不可またはクラッシュした |

## ハブのライフサイクル

### ユーザーハブの作成

user の最初の client connection が、その user の hub を作成します。hub は user の security actor と scope で実行されます。

### ガベージコレクション

中央ハブは定期的に非アクティブなユーザーハブをチェックします。`user_hub_inactivity_timeout`（デフォルト 2 時間）より長く接続クライアントを持たないハブは、10 秒のキャンセルタイムアウトを伴って正常に終了されます。

GC のチェック間隔は自動的に導出されます：`inactivity_timeout / 2.5`。

### セキュリティ

中央ハブはフルアクセスを持つ独自のセキュリティグループ（`wippy.relay.security:root`）の下で実行されます。各ユーザーハブは設定された `user_security_scope` で生成され、ユーザーレベルの操作を分離します。

## 内部トピック

| トピック | 方向 | 説明 |
|-------|-----------|-------------|
| `ws.join` | Client → Central/User Hub | 接続要求 |
| `ws.leave` | Client → Central/User Hub | 切断 |
| `ws.message` | Client → User Hub | WebSocket メッセージ |
| `ws.cancel` | Central → User Hub | 正常シャットダウン |
| `ws.control` | Central → User Hub | ルーティング制御 |
| `hub.activity_update` | User Hub → Central | クライアント数の更新 |

## 関連項目

- [WebSocket Relay](../http/websocket-relay.md) — HTTP WebSocket endpoint の設定
- [プロセスモデル](concepts/process-model.md) — process lifecycle と messaging
- [セキュリティ](system/security.md) — security actor と scope
- [Framework 概要](framework/overview.md) — Framework モジュールのインストールと import
