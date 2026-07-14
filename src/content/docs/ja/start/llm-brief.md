---
title: "LLM 向け概要"
---

# LLM 向け概要

このページは AI エージェントおよび LLM 向けです。Wippy 上で構築したり、Wippy プロジェクト用のコードを生成したりする場合は、まずこれを読んでください。

## Wippy とは

Wippy はアクターモデル上に構築された単一バイナリのアプリケーションランタイムです。Lua コードを分離されたプロセスで実行し、メッセージパッシングで通信します — 共有メモリもロックもありません。3 つの計算モデルが存在します：関数（ステートレス、リクエストスコープ）、プロセス（状態を持つ長期稼働アクター）、ワークフロー（Temporal に支えられたクラッシュ耐性のある永続アクター）。このシステムは、エージェントがコードを生成し、登録し、再デプロイなしにアプリケーションを改善できるように設計されています。

## メンタルモデル

Wippy の中のすべては**レジストリエントリ**（registry entry）です。エントリは ID（`namespace:name`）、種別（挙動を決定する）、メタデータ、データを持ちます。YAML ファイルはエントリを宣言する方法の 1 つですが、ランタイムにおける真実の源はレジストリであり、エントリはシステム稼働中に作成、更新、削除が可能です。

種別はエントリの動作を決定します：

- `function.lua` — ステートレスな呼び出し可能関数
- `process.lua` — 長期稼働アクター
- `workflow.lua` — 永続ワークフロー（Temporal）
- `http.service` — HTTP サーバー
- `http.router` — ミドルウェア付きルートグループ
- `http.endpoint` — HTTP ハンドラー
- `db.sql.postgres` / `mysql` / `sqlite` — データベース接続
- `store.memory` / `store.sql` — キーバリューストア
- `queue.queue` — メッセージキュー
- `process.host` — プロセス実行ホスト
- `process.service` — 監視されたプロセス
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

エントリ定義は `_index.yaml` ファイル内にあります：

```yaml
version: "1.0"
namespace: app.api

entries:
  - name: get_user
    kind: function.lua
    source: file://handler.lua
    method: get_user
    modules: [sql, json]

  - name: get_user.endpoint
    kind: http.endpoint
    meta:
      router: app:api_router
    method: GET
    path: /users/{id}
    func: app.api:get_user
```

## 関数の記述

関数はステートレスです。引数を受け取り、処理を行い、結果を返します。呼び出し元のコンテキストを継承し、呼び出し元がキャンセルされるとキャンセルされます。

```lua
local sql = require("sql")
local json = require("json")
local http = require("http")

local function get_user(id)
    local db, err = sql.get("app:main_db")
    if err then return nil, err end

    local rows, err = db:query("SELECT * FROM users WHERE id = $1", id)
    if err then return nil, err end
    if #rows == 0 then return nil, errors.new(errors.NOT_FOUND, "user not found") end

    return rows[1]
end

return get_user
```

HTTP ハンドラーには `http` モジュールを使用します：

```lua
local http = require("http")
local json = require("json")

local function handler()
    local req = http.request()
    local res = http.response()

    local id = req:param("id")
    local user, err = funcs.call("app.api:get_user", id)
    if err then
        res:set_status(404)
        res:write_json({error = err:message()})
        return
    end

    res:write_json(user)
end

return handler
```

## プロセスの記述

プロセスはアクターです。独自の PID を持ち、受信箱経由でメッセージを受信し、メッセージ間で状態を保持します。ブロッキング I/O で yield するため、数千のプロセスを並行実行できます。

```lua
local function worker(initial_config)
    local inbox = process.inbox()
    local events = process.events()

    while true do
        local r = channel.select {
            inbox:case_receive(),
            events:case_receive()
        }

        if r.channel == events then
            local ev = r.value
            if ev.type == process.event.CANCEL then
                break
            end
        elseif r.channel == inbox then
            local msg = r.value
            local topic = msg:topic()
            local data = msg:payload():data()
            handle_message(topic, data)
        end
    end
end

return worker
```

他のコードからプロセスを生成します：

```lua
local pid = process.spawn("app.workers:task", "app:process_host", config)
process.send(pid, "work", {item_id = 123})
```

## ワークフローの記述

ワークフローは永続的であり、クラッシュや再起動を超えて存続します。コードは通常の Lua のように見えます。ランタイムは関数呼び出しの結果、スリープ、乱数値を自動的に記録し、リプレイが決定的になるようにします。

```lua
local function order_flow(order)
    local inventory = funcs.call("app:reserve_inventory", order.items)
    if not inventory then
        return nil, errors.new("out of stock")
    end

    local payment = funcs.call("app:charge_payment", order.total)
    if not payment then
        funcs.call("app:release_inventory", inventory.id)
        return nil, errors.new("payment failed")
    end

    -- Wait for approval signal (can block for days)
    local msg = process.inbox():receive()
    if not msg:payload():data().approved then
        funcs.call("app:refund_payment", payment.id)
        funcs.call("app:release_inventory", inventory.id)
        return nil, errors.new("rejected")
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

-- Asynchronous (returns Future)
local future = funcs.async("namespace:function_name", arg1)
local result, err = future:result()

-- With context
local exec = funcs.new():with_context({user_id = "123"})
exec:call("namespace:function_name")
```

### プロセス通信

```lua
-- Send message (fire-and-forget)
process.send(pid, "topic", data)

-- Receive messages
local inbox = process.inbox()
local msg, ok = inbox:receive()
local topic = msg:topic()
local data = msg:payload():data()

-- Monitor another process (receive EXIT on death)
process.monitor(pid)

-- Link processes (bidirectional failure notification)
process.spawn_linked("namespace:name", "host")
```

### チャネル

コルーチン通信のための Go スタイルのチャネル：

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
local db = sql.get("app:main_db")
local rows, err = db:query("SELECT * FROM users WHERE active = $1", true)
db:execute("INSERT INTO users (name) VALUES ($1)", name)

-- Key-value store
local store = require("store")
local cache = store.get("app:cache")
cache:set("key", value, 3600)  -- TTL in seconds
local val = cache:get("key")

-- Queue
local queue = require("queue")
queue.publish("app:tasks", {task = "process", id = 123})

-- Filesystem
local fs = require("fs")
local vol = fs.get("app:storage")
local data = vol:readfile("path/to/file.txt")
vol:writefile("output.txt", content)
```

### HTTP クライアント

```lua
local http_client = require("http_client")

local resp, err = http_client.get("https://api.example.com/data", {
    headers = {Authorization = "Bearer token"},
    timeout = "10s"
})
local body = resp.body
```

### セキュリティ

```lua
local security = require("security")

local actor = security.actor()       -- who is calling
local scope = security.scope()       -- what permissions apply
local allowed = security.can("read", "resource:users")

-- Token management
local ts = security.token_store("app:tokens")
local token = ts:create(actor, scope, {expiration = "24h"})
local validated_actor, validated_scope = ts:validate(token)
```

### 時間

```lua
local time = require("time")

time.sleep("5s")
local now = time.now()
local timeout = time.after("30s")  -- channel that fires once
local ticker = time.ticker("10s")  -- repeating channel
```

### レジストリ

```lua
local registry = require("registry")

local entry = registry.get("app.api:get_user")
local tests = registry.find({["meta.type"] = "test"})

-- Create entries at runtime
local snap = registry.snapshot()
local changes = snap:changes()
changes:create({id = "app:new_func", kind = "function.lua", data = {...}})
changes:apply()
```

### イベント

```lua
local events = require("events")

-- Publish
events.send("orders", "order.created", "/orders/123", {order_id = "123"})

-- Subscribe (wildcards supported)
local sub = events.subscribe("orders.*")
local ch = sub:channel()
local evt = ch:receive()
```

## モジュールアクセス制御

各エントリはどのモジュールを `require()` できるかを宣言します。リストにないモジュールは単に利用できません — 明示的に許可しない限り、`os.execute`、`io.open`、`debug.*`、`package.*` は存在しません。ランタイムはソースコードをスキャンも検証もしません。アクセスをモジュールレベルで制御します。モジュールがリストにない場合、そのエントリにとって存在しません。

```yaml
modules: [sql, json, http, time, funcs, store]
```

これはワークフローの決定性の動作方法でもあります — ワークフローエントリには決定的なモジュールのみが提供されます。ランタイムは `time.now()`、`uuid.v4()` やその他の非決定的呼び出しをモジュールレベルで傍受し、リプレイのために結果を記録します。

## フレームワークモジュール

Wippy には依存関係経由でインストールされるフレームワークモジュールがあります：

- **wippy/llm** — LLM 統合（OpenAI、Anthropic、Google）。`llm.generate()`、構造化出力、埋め込み、ストリーミング。
- **wippy/agent** — ツール利用、委譲、特性、メモリを持つエージェントフレームワーク。エージェントはレジストリエントリとして定義されます。
- **wippy/test** — BDD テスト。`describe/it` ブロック、アサーション、モック。
- **wippy/dataflow** — DAG ベースのワークフローオーケストレーション。Function、Agent、Cycle、Parallel ノード。
- **wippy/relay** — 中央ハブ、ユーザーごとのハブ、プラグインルーティングを持つ WebSocket リレー。
- **wippy/views** — テンプレートレンダリングを持つページおよびコンポーネントシステム。
- **wippy/facade** — 認証ブリッジングを持つフロントエンド iframe ファサード。

## 規約

- エントリ ID は `namespace:name` 形式を使用します
- 名前は意味的な区切りにドットを、単語にはアンダースコアを使用します：`get_user.endpoint`
- 関数は `result, error` を返します — 常にエラーをチェックしてください
- プロセスはメッセージパッシングで通信し、共有状態を使用しません
- `channel.select` を使用して複数のイベントソースを多重化します
- スーパーバイザーツリーが失敗を処理します — "let it crash" 原則で設計してください
- コンテキスト（trace ID、ユーザー情報、セキュリティ）は関数呼び出しを通じて自動的に伝播されます
- ワークフローは非決定的操作を直接使用してはなりません — ランタイムが `funcs.call`、`time.sleep`、`uuid.v4`、`time.now` についてこれを処理します

## ドキュメント

完全なドキュメントは [wippy.ai/docs](https://wippy.ai/docs) で入手できます。LLM フレンドリーなエンドポイント：

- 構造の参照：`https://wippy.ai/llm/toc`
- 検索：`https://wippy.ai/llm/search?q=query`
- ページの取得：`https://wippy.ai/llm/path/en/<path>`
- バッチ取得：`https://wippy.ai/llm/context?paths=path1,path2`
