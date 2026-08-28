---
title: "Dataflow: 永続DAGを実行する"
description: "永続状態、自動マイグレーション、2つの関数ノードを備えた小規模なwippy/dataflowワークフローを構築して実行します。"
---

# Dataflow: 永続DAGを実行する

**分類: 実行可能なチュートリアル。** プロバイダーを必要としない完全な`wippy/dataflow`
プロジェクトを構築します。埋め込みやLLMは使用しません。その用途については
[検索拡張生成](tutorials/rag.md)を参照してください。

このワークフローは、1つの入力を2つの関数ノードへ渡します：

```text
{ values = { 2, 4, 6 } } -> double -> summarize -> { count = 3, total = 24 }
```

Dataflowはワークフロー、ノード、コマンド、wake、activationをSQLへ永続化します。
コマンドはフロー開始前に、マイグレーションbootloaderがこれらのテーブルを作成するまで待機します。

## 前提条件

- ソースディレクトリが`./src`のWippyプロジェクト。
- Wippyランタイム`v0.3.32a`以降。
- 最初の依存関係インストール時にモジュールレジストリへアクセスできること。

モデルプロバイダーやAPIキーは不要です。

## プロジェクト構造

```text
dataflow-demo/
├── wippy.lock                 # generated
└── src/
    ├── _index.yaml
    ├── double.lua
    ├── summarize.lua
    └── run.lua
```

## ランタイムを設定する

`src/_index.yaml`を作成します：

```yaml
version: "1.0"
namespace: app

entries:
  - name: db
    kind: db.sql.sqlite
    file: ./.wippy/dataflow.db
    lifecycle:
      auto_start: true

  - name: env_storage
    kind: env.storage.file
    file_path: ./.wippy/dataflow.env
    auto_create: true

  - name: processes
    kind: process.host
    lifecycle:
      auto_start: true

  # Dataflow includes session views, so its standalone configuration supplies
  # the router those transitive entries target. The HTTP service need not start.
  - name: gateway
    kind: http.service
    addr: ":18080"
    lifecycle:
      auto_start: false

  - name: api.public
    kind: http.router
    meta:
      server: app:gateway
    prefix: /api/public

  - name: api
    kind: http.router
    meta:
      server: app:gateway
    prefix: /api

  - name: dep.dataflow
    kind: ns.dependency
    component: wippy/dataflow
    version: "0.7.6"
    parameters:
      - name: userspace.dataflow:target_db
        value: app:db
      - name: userspace.dataflow:process_host
        value: app:processes
      - name: wippy.migration:app_db
        value: app:db

  - name: dep.security
    kind: ns.dependency
    component: wippy/security
    version: "*"

  - name: dep.bootloader
    kind: ns.dependency
    component: wippy/bootloader
    version: "*"
    parameters:
      - name: wippy.bootloader:application_host
        value: app:processes
      - name: wippy.bootloader:env_storage
        value: app:env_storage

  - name: dep.llm
    kind: ns.dependency
    component: wippy/llm
    version: "*"
    parameters:
      - name: wippy.llm:process_host
        value: app:processes
      - name: wippy.llm:env_storage
        value: app:env_storage

  - name: dep.session
    kind: ns.dependency
    component: wippy/session
    version: "*"
    parameters:
      - name: wippy.session:database_resource
        value: app:db
      - name: wippy.session:api_router
        value: app:api.public
      - name: wippy.session:env_storage
        value: app:env_storage
      - name: wippy.session:delegation_func_id
        value: userspace.dataflow.session:delegate

  - name: dep.views
    kind: ns.dependency
    component: wippy/views
    version: "*"
    parameters:
      - name: wippy.views:api_router
        value: app:api.public
      - name: wippy.views:env_storage
        value: app:env_storage

  - name: demo_policy
    kind: security.policy
    policy:
      actions: "*"
      resources: "*"
      effect: allow

  - name: double
    kind: function.lua
    source: file://double.lua
    method: handler

  - name: summarize
    kind: function.lua
    source: file://summarize.lua
    method: handler

  - name: run
    kind: process.lua
    meta:
      command:
        name: dataflow-demo
        short: Run the Dataflow tutorial DAG
        security:
          actor:
            id: app:dataflow-demo
          policies:
            - app:demo_policy
    source: file://run.lua
    method: main
    modules:
      - io
      - sql
      - time
    imports:
      flow: userspace.dataflow.flow:flow
```

`wippy/dataflow`がマイグレーションエントリを所有します。`wippy/migration`は推移的な依存関係で、
`wippy/bootloader`がランタイム起動時にマイグレーションbootloaderを実行します。上記の明示的な
パラメータにより、両方のシステムが`app:db`へバインドされます。

広いポリシーは、この分離されたチュートリアルをワークフロー動作に集中させるためのものです。
本番のコマンドでは、ワークフローに必要な関数、データベース、プロセスのactionだけに置き換えてください。

## ノードを実装する

`src/double.lua`を作成します：

```lua
local function handler(input)
    local result = { values = {} }
    for _, value in ipairs(input.values or {}) do
        table.insert(result.values, value * 2)
    end
    return result
end

return { handler = handler }
```

`src/summarize.lua`を作成します：

```lua
local function handler(input)
    local total = 0
    for _, value in ipairs(input.values or {}) do
        total = total + value
    end
    return { count = #(input.values or {}), total = total }
end

return { handler = handler }
```

## フローを構築して実行する

`src/run.lua`を作成します：

```lua
local io = require("io")
local sql = require("sql")
local time = require("time")
local flow = require("flow")

local function wait_for_schema()
    for _ = 1, 100 do
        local db, err = sql.get("app:db")
        if not err then
            local rows, query_err = db:query(
                "SELECT name FROM sqlite_master " ..
                "WHERE type='table' AND name='dataflows'"
            )
            db:release()
            if not query_err and rows and #rows > 0 then
                return true
            end
        end
        time.sleep("100ms")
    end
    return nil, "Dataflow migrations did not finish within 10 seconds"
end

local function main()
    local ready, ready_err = wait_for_schema()
    if not ready then
        io.print("dataflow failed: " .. ready_err)
        return 1
    end

    local result, err = flow.create()
        :with_title("Double and summarize")
        :with_input({ values = { 2, 4, 6 } })
        :func("app:double")
        :as("double")
        :to("summarize", "default")
        :func("app:summarize")
        :as("summarize")
        :run()

    if err then
        io.print("dataflow failed: " .. tostring(err))
        return 1
    end

    io.print(string.format("count=%d total=%d", result.count, result.total))
    return 0
end

return { main = main }
```

ロックを初期化し、依存関係グラフを解決してインストールし、コンソールログを有効にして
名前付きコマンドを実行します：

```bash
wippy init
wippy update
wippy install
wippy run -c dataflow-demo
```

初回実行時にはbootloaderがDataflowマイグレーションを適用します。その後、コマンドは次を表示します：

```text
count=3 total=24
```

以降の実行ではマイグレーションが適用済みと報告され、新しい永続ワークフローが実行されます。

## 永続化を確認する

SQLiteファイルは`./.wippy/dataflow.db`です。正常に実行すると、ワークフロー、ノード、データ、commit、
wake、activationのストレージを含むDataflowモジュール所有のテーブルが作成されます。アプリケーションは
テーブルへ直接書き込まず、DataflowクライアントまたはKeeperを介して確認してください。

呼び出し元がワークフローIDをすぐ受け取る必要がある場合は`:run()`ではなく`:start()`を使用します。
非同期ワークフローの状態や出力の読み取り、キャンセル、終了、復活、シグナル送信にはDataflowクライアントを使用します。

## 次のステップ

- [Dataflowフレームワーク](../framework/dataflow.md) — ルーティング、並列ノード、
  サイクル、エージェント、シグナル、クライアントAPI
- [検索拡張生成](tutorials/rag.md) — 埋め込みを利用した検索
- [MCP経由のKeeper](./keeper-mcp.md) — MCPクライアントから実行中のワークフローを確認する
