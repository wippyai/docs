# リレー

`wippy/relay` モジュールは、2 階層ハブアーキテクチャを持つ WebSocket リレーインフラストラクチャを提供します。中央ハブはユーザーごとのハブを管理し、それらが WebSocket クライアント接続を管理し、メッセージをプラグインへルーティングします。

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

中央ハブはサービスとして実行されます。WebSocket クライアントが接続すると、中央ハブはそのユーザー用のユーザーハブを検索または作成します。ユーザーハブはクライアントのライフタイムを管理し、コマンドプレフィックスに基づいてプラグインへメッセージをルーティングします。

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
| `max_connections_per_user` | いいえ | `10` | ユーザーごとの WebSocket 接続数 |
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

## メッセージルーティング

クライアントは `type` フィールドを持つ JSON メッセージを送信します。ユーザーハブは登録されたプラグインに対してタイププレフィックスを照合し、メッセージをルーティングします：

```json
{ "type": "session_get_state", "data": { "key": "value" } }
```

`session_` プレフィックスはセッションプラグインに一致します。ハブはプレフィックスを取り除き、取り除いたタイプをトピックとしてプラグインプロセスにメッセージを送信します：

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

プラグインはユーザーハブによって生成されます。起動時、プラグインは以下を受け取ります：

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

プラグインはプロセスインボックスでメッセージを受け取ります。各メッセージはトピック（取り除かれたコマンドプレフィックス）と、元のメッセージデータと、クライアントへのレスポンス送信用の `conn_pid` を含むペイロードを持ちます。

```lua
local json = require("json")

local function handle_message(topic, payload)
    if topic == "get_state" then
        process.send(payload.conn_pid, "ws.message", json.encode({
            type = "session_state",
            data = { status = "active" }
        }))
    end
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
                -- 最初のクライアントが接続した
            elseif topic == "shutdown" then
                -- 最後のクライアントが切断した
            else
                handle_message(topic, payload)
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

リレーは構造化されたエラーメッセージをクライアントへ送信します：

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

ユーザーハブは、ユーザーの最初のクライアントが接続したときにオンデマンドで作成されます。ハブはユーザーのセキュリティアクターとスコープで生成されます。

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

- [WebSocket Relay](../http/websocket-relay.md) - HTTP WebSocket エンドポイント設定
- [プロセスモデル](../concepts/process-model.md) - プロセスのライフサイクルとメッセージング
- [セキュリティ](../system/security.md) - セキュリティアクターとスコープ
- [フレームワーク概要](overview.md) - フレームワークモジュールの利用
