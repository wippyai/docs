---
title: "LLM 向け概要"
description: "Wippy コードを生成するエージェント向けに、Wippy の主要概念、プロジェクト構造、API、規約を解説します。"
---

# LLM 向け概要

Wippy プロジェクトのコードを生成するときは、この概要を最初のコンテキストとして使用してください。

**分類：コード生成用リファレンス。** 以下のブロックは、単独で実行可能な 1 つのプロジェクトではなく、個々の契約パターンに焦点を当てています。レジストリ ID、スキーマ、ポリシー、および `user_id`、`config`、`content` などのアプリケーション固有の値は、それらを使用するプロジェクト側で定義する必要があります。

## Wippy とは

Wippy は、アクターモデルを基盤とする単一バイナリのアプリケーションランタイムです。Lua コードを分離されたプロセスで実行し、共有メモリではなくメッセージを通じて通信します。計算モデルは、関数（ステートレスでリクエストスコープ）、プロセス（状態を持つ長期稼働アクター）、ワークフロー（Temporal を基盤とする永続アクター）の 3 つです。レジストリを基盤とする動作は、ランタイムを再デプロイせずに追加または更新できます。

## メンタルモデル

Wippy のすべては**レジストリエントリ**です。各エントリには、ID（`namespace:name`）、動作を決定する種別、メタデータ、データがあります。YAML ファイルはエントリを宣言する方法の 1 つですが、ランタイムにおける信頼できる情報源はレジストリです。システムの稼働中にエントリを作成、更新、削除することもできます。

種別によってエントリの役割が決まります：

- `function.lua` — ステートレスな呼び出し可能関数
- `process.lua` — 長期稼働アクター
- `workflow.lua` — 永続ワークフロー（Temporal）
- `http.service` — HTTP サーバー
- `http.router` — ミドルウェアを持つルートグループ
- `http.endpoint` — HTTP ハンドラー
- `db.sql.postgres` / `mysql` / `sqlite` — データベース接続
- `store.memory` / `store.sql` — キーバリューストア
- `queue.queue` — メッセージキュー
- `process.host` — プロセス実行ホスト
- `process.service` — 監視対象プロセス
- `contract.definition` / `contract.binding` — 型付きサービスインターフェース
- `registry.entry` — 構成データ

## プロジェクト構造

```
myapp/
├── .wippy.yaml              # Runtime configuration
├── wippy.lock               # Source directories
└── src/
    ├── _index.yaml          # Entry definitions (namespace: app)
    ├── api/
    │   ├── _index.yaml      # namespace: app.api
    │   └── handler.lua
    └── workers/
        ├── _index.yaml      # namespace: app.workers
        └── task.lua
```

エントリ定義は `_index.yaml` ファイルに記述します：

```yaml
version: "1.0"
namespace: app.api

entries:
  - name: get_user
    kind: function.lua
    source: file://handler.lua
    method: get_user
    modules: [sql]

  - name: get_user.endpoint
    kind: http.endpoint
    meta:
      router: app:api_router
    method: GET
    path: /users/{id}
    func: app.api:get_user
```

## 関数の記述

関数はステートレスです。引数を受け取り、処理を実行して結果を返します。呼び出し元のコンテキストを継承し、呼び出し元がキャンセルされると関数もキャンセルされます。

```lua
local sql = require("sql")

local function get_user(id)
    local db, err = sql.get("app:main_db")
    if err then return nil, err end

    local rows, err = db:query("SELECT * FROM users WHERE id = $1", {id})
    if err then
        local _, release_err = db:release()
        return nil, release_err or err
    end

    local _, release_err = db:release()
    if release_err then return nil, release_err end
    if #rows == 0 then
        return nil, errors.new({kind = errors.NOT_FOUND, message = "user not found"})
    end

    return rows[1]
end

return get_user
```

HTTP ハンドラーでは `http` モジュールを使用します：

```lua
local http = require("http")
local funcs = require("funcs")

local function handler()
    local req, req_err = http.request()
    if req_err then return nil, req_err end
    local res, res_err = http.response()
    if res_err then return nil, res_err end

    local id, param_err = req:param("id")
    if param_err then return nil, param_err end
    local user, err = funcs.call("app.api:get_user", id)
    if err then
        local status_err
        if errors.is(err, errors.NOT_FOUND) then
            status_err = res:set_status(404)
        else
            status_err = res:set_status(500)
        end
        if status_err then return nil, status_err end
        local write_err = res:write_json({error = err:message()})
        if write_err then return nil, write_err end
        return true
    end

    local write_err = res:write_json(user)
    if write_err then return nil, write_err end
    return true
end

return handler
```

## プロセスの記述

プロセスはアクターです。各プロセスは PID を持ち、受信箱を通じてメッセージを受け取り、メッセージをまたいで状態を保持できます。I/O の待機中はプロセスが yield するため、ほかのプロセスを実行できます。

```lua
local function worker(initial_config)
    local inbox = process.inbox()
    local events = process.events()

    while true do
        local r = channel.select {
            inbox:case_receive(),
            events:case_receive()
        }

        if not r.ok then break end

        if r.channel == events then
            local ev = r.value
            if ev.kind == process.event.CANCEL then
                break
            end
        elseif r.channel == inbox then
            local msg = r.value
            local topic = msg:topic()
            local data, err = msg:payload():data()
            if err then return nil, err end

            if topic == "work" then
                -- Perform the application-specific work here.
                print(data.item_id)
            end
        end
    end
end

return worker
```

ほかのコードからプロセスを生成します：

```lua
local pid, err = process.spawn("app.workers:task", "app:process_host", config)
if err then return nil, err end

local ok, send_err = process.send(pid, "work", {item_id = 123})
if send_err then return nil, send_err end
return ok
```

## ワークフローの記述

ワークフローは実行履歴を永続化するため、クラッシュや再起動の後でも処理を再開できます。ワークフローコードには通常の Lua 構文を使用し、ランタイムが決定論的なリプレイのために関数の結果、スリープ、乱数値を記録します。

以下の各 `funcs.call()` の呼び出し先は、`meta.temporal.activity.worker` を通じて同じ Temporal ワーカーにアクティビティとして登録する必要があります。必須の関数メタデータについては、[アクティビティ](../temporal/activities.md)を参照してください。

```lua
local funcs = require("funcs")

local function compensate(inventory, payment)
    local _, refund_err = funcs.call("app:refund_payment", payment.id)
    local _, release_err = funcs.call("app:release_inventory", inventory.id)
    return refund_err or release_err
end

local function order_flow(order)
    local inventory, err = funcs.call("app:reserve_inventory", order.items)
    if err then return nil, err end

    local payment, payment_err = funcs.call("app:charge_payment", order.total)
    if payment_err then
        local _, release_err = funcs.call("app:release_inventory", inventory.id)
        return nil, release_err or payment_err
    end

    -- Wait for approval signal (can block for days)
    local msg, open = process.inbox():receive()
    if not open then
        local compensation_err = compensate(inventory, payment)
        return nil, compensation_err or errors.new("workflow inbox closed")
    end

    local decision, payload_err = msg:payload():data()
    if payload_err then
        local compensation_err = compensate(inventory, payment)
        return nil, compensation_err or payload_err
    end
    if not decision.approved then
        local compensation_err = compensate(inventory, payment)
        return nil, compensation_err or errors.new("rejected")
    end

    return funcs.call("app:fulfill_order", order.id)
end

return order_flow
```

## 主要な API

### 関数の呼び出し

```lua
local funcs = require("funcs")

-- Synchronous
local result, err = funcs.call("namespace:function_name", arg1, arg2)
if err then return nil, err end

-- Asynchronous (returns Future)
local future, future_err = funcs.async("namespace:function_name", arg1)
if future_err then return nil, future_err end
local response_ch = future:response()
local _, response_open = response_ch:receive()
if not response_open then
    return nil, errors.new("future response channel closed")
end
local async_payload, async_err = future:result()
if async_err then return nil, async_err end
local async_result, decode_err = async_payload:data()
if decode_err then return nil, decode_err end

-- With context
local contextual_exec, contextual_err = funcs.new():with_context({user_id = "123"})
if contextual_err then return nil, contextual_err end
local contextual_result, contextual_err = contextual_exec:call("namespace:function_name")
if contextual_err then return nil, contextual_err end
```

### プロセス通信

```lua
-- Send message (fire-and-forget)
local ok, err = process.send(pid, "topic", data)
if err then return nil, err end

-- Receive messages
local inbox = process.inbox()
local msg, ok = inbox:receive()
if not ok then return nil, errors.new("process inbox closed") end
local topic = msg:topic()
local data, payload_err = msg:payload():data()
if payload_err then return nil, payload_err end

-- Monitor another process (receive EXIT on death)
local monitored, monitor_err = process.monitor(pid)
if monitor_err then return nil, monitor_err end

-- Link processes (bidirectional failure notification)
local linked_pid, spawn_err = process.spawn_linked("namespace:name", "host")
if spawn_err then return nil, spawn_err end
```

### チャネル

コルーチン間の通信に使用する Go 形式のチャネルです：

```lua
local ch = channel.new(10)  -- buffered
ch:send(value)
local val, ok = ch:receive()

-- Select on multiple channels
local r = channel.select {
    ch1:case_receive(),
    ch2:case_receive(),
    timeout:case_receive()
}
```

### エラー処理

関数は `result, error` のペアを返します。エラーは型付きオブジェクトです：

```lua
local result, err = some_operation()
if err then
    if errors.is(err, errors.NOT_FOUND) then
        -- handle not found
    end
    return nil, errors.wrap(err, "context message")
end
```

エラー種別：`UNKNOWN`、`INVALID`、`NOT_FOUND`、`ALREADY_EXISTS`、`PERMISSION_DENIED`、`TIMEOUT`、`CANCELED`、`UNAVAILABLE`、`INTERNAL`、`CONFLICT`、`RATE_LIMITED`。

### データアクセス

```lua
-- SQL
local sql = require("sql")
local db, db_err = sql.get("app:main_db")
if db_err then return nil, db_err end
local rows, err = db:query("SELECT * FROM users WHERE active = $1", {true})
if err then
    local _, release_err = db:release()
    return nil, release_err or err
end
local _, release_err = db:release()
if release_err then return nil, release_err end

-- Key-value store
local store = require("store")
local cache, cache_err = store.get("app:cache")
if cache_err then return nil, cache_err end
local stored, set_err = cache:set("key", value, 3600)  -- TTL in seconds
if set_err then
    cache:release()
    return nil, set_err
end
local val, get_err = cache:get("key")
cache:release()
if get_err then return nil, get_err end

-- Queue
local queue = require("queue")
local published, publish_err = queue.publish("app:tasks", {task = "process", id = 123})
if publish_err then return nil, publish_err end

-- Filesystem
local fs = require("fs")
local vol, volume_err = fs.get("app:storage")
if volume_err then return nil, volume_err end
local data, read_err = vol:readfile("path/to/file.txt")
if read_err then return nil, read_err end
local written, write_err = vol:writefile("output.txt", content)
if write_err then return nil, write_err end
```

### HTTP クライアント

```lua
local http_client = require("http_client")

local resp, err = http_client.get("https://api.example.com/data", {
    headers = {Authorization = "Bearer token"},
    timeout = "10s"
})
if err then return nil, err end
local body = resp.body
```

### セキュリティ

```lua
local security = require("security")

local actor = security.actor()       -- who is calling
local scope = security.scope()       -- what permissions apply
if not actor then return nil, errors.new("security actor unavailable") end
if not scope then return nil, errors.new("security scope unavailable") end
local allowed = security.can("read", "resource:users")

-- Token management
local ts, store_err = security.token_store("app:tokens")
if store_err then return nil, store_err end
local token, create_err = ts:create(actor, scope, {expiration = "24h"})
if create_err then
    ts:close()
    return nil, create_err
end
local validated_actor, validated_scope, validate_err = ts:validate(token)
ts:close()
if validate_err then return nil, validate_err end
```

### 時間

```lua
local time = require("time")

time.sleep("5s")
local now = time.now()
local timeout, timeout_err = time.after("30s")  -- channel that fires once
if timeout_err then return nil, timeout_err end
local ticker, ticker_err = time.ticker("10s")  -- repeating channel
if ticker_err then return nil, ticker_err end
-- Stop the ticker when its consumer finishes.
ticker:stop()
```

### レジストリ

```lua
local registry = require("registry")

local entry, entry_err = registry.get("app.api:get_user")
if entry_err then return nil, entry_err end
local tests, find_err = registry.find({["meta.type"] = "test"})
if find_err then return nil, find_err end

-- Create entries at runtime
local snap, snapshot_err = registry.snapshot()
if snapshot_err then return nil, snapshot_err end
local changes, changes_err = snap:changes()
if changes_err then return nil, changes_err end
local _, create_err = changes:create({id = "app:new_func", kind = "function.lua", data = {...}})
if create_err then return nil, create_err end
local version, apply_err = changes:apply()
if apply_err then return nil, apply_err end
```

### イベント

```lua
local events = require("events")

-- Publish
local sent, send_err = events.send("orders", "order.created", "/orders/123", {order_id = "123"})
if send_err then return nil, send_err end

-- Subscribe (wildcards supported)
local sub, subscribe_err = events.subscribe("orders.*")
if subscribe_err then return nil, subscribe_err end
local ch = sub:channel()
local evt, open = ch:receive()
sub:close()
if not open then return nil, errors.new("event subscription closed") end
```

## モジュールアクセス制御

各エントリには、制限された基本環境と標準ライブラリが提供され、実行可能なエントリには環境モジュールとして `process` も提供されます。環境に含まれないランタイムモジュールは `modules:` に、レジストリを基盤とするライブラリは `imports:` に追加します。宣言されていない非環境モジュールは利用できません。`os.execute`、`io.open`、`debug.*`、ネイティブモジュールの読み込み、任意の `package.path` 解決など、ホスト側の Lua 機能は、オプトイン可能なランタイムモジュールとして公開されていません。ランタイムはソースコードをスキャンするのではなく、モジュールローダーを通じて利用可否を制御します。

```yaml
modules: [sql, json, http, time, funcs, store]
```

ワークフローエントリには、決定論的なモジュールのみが提供されます。ランタイムは `time.now()`、`uuid.v4()`、そのほかの非決定的な呼び出しをモジュールレベルでインターセプトし、リプレイ用に結果を記録します。

## フレームワークモジュール

フレームワークの機能は依存関係として配布されます：

- **wippy/llm** — LLM 統合（OpenAI、Anthropic、Google）。`llm.generate()`、構造化出力、埋め込み、ストリーミング。
- **wippy/agent** — ツールの利用、委譲、特性、メモリを備えたエージェントフレームワーク。エージェントはレジストリエントリとして定義されます。
- **wippy/test** — BDD テスト。`describe/it` ブロック、アサーション、モック。
- **wippy/dataflow** — DAG ベースのワークフローオーケストレーション。Function、Agent、Cycle、Parallel ノード。
- **wippy/relay** — 中央ハブ、ユーザーごとのハブ、プラグインルーティングを備えた WebSocket リレー。
- **wippy/views** — テンプレートレンダリングを備えたページおよびコンポーネントシステム。
- **wippy/facade** — iframe および Web Fragment ページ向けのフロントエンドファサードと認証ブリッジ。

## 規約

- エントリ ID には `namespace:name` 形式を使用します
- 名前では意味上の区切りにドット、単語の区切りにアンダースコアを使用します：`get_user.endpoint`
- 失敗する可能性のある API は `result, error` を返します — 必ずエラーを確認してください
- プロセスは共有状態を使わず、メッセージパッシングで通信します
- 複数のイベントソースを多重化するには `channel.select` を使用します
- すべての操作にローカルな復旧処理を追加するのではなく、プロセスの失敗はスーパービジョンツリーに処理させます
- コンテキスト（トレース ID、ユーザー情報、セキュリティ）は関数呼び出しを通じて自動的に伝播されます
- ワークフローは非決定的な操作を直接使用してはいけません — `funcs.call`、`time.sleep`、`uuid.v4`、`time.now` はランタイムが処理します

## ドキュメント

完全なドキュメントは [docs.wippy.ai](https://docs.wippy.ai) で参照できます。LLM 向けエンドポイント：

- 構造を閲覧：`https://wippy.ai/llm/toc`
- 検索：`https://wippy.ai/llm/search?q=query`
- ページを取得：`https://wippy.ai/llm/path/en/<path>`
- 複数ページを取得：`https://wippy.ai/llm/context?paths=path1,path2`
