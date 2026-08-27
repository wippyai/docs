---
title: "ワークフロー"
description: "workflow.luaエントリ、アクティビティ、シグナル、子ワークフロー、タイマー、リプレイセーフな操作を使って、耐久性のあるTemporalワークフローを定義します。"
---

# ワークフロー

`workflow.lua`エントリは、アクティビティをオーケストレーションし、障害や再起動をまたいで状態を維持する、耐久性のあるTemporalワークフローを定義します。

このページは、部分的なレシピを含むAPIリファレンスです。エントリ宣言、ワーカー登録、アクティビティ実装、セキュリティポリシー、周辺のアプリケーションデータは、特定の契約に関係する箇所だけを示しています。

## 定義

```yaml
- name: order_workflow
  kind: workflow.lua
  source: file://order_workflow.lua
  method: main
  modules:
    - funcs
    - time
    - workflow
  meta:
    temporal:
      workflow:
        worker: app:worker
```

### メタデータフィールド

| フィールド | 必須 | 説明 |
|-----------|------|------|
| `worker` | はい | `temporal.worker`エントリへの参照 |
| `name` | いいえ | カスタムワークフロータイプ名（デフォルトはエントリID） |

## 基本実装

```lua
local funcs = require("funcs")
local time = require("time")

local function main(order)
    local payment, err = funcs.call("app:charge_payment", {
        amount = order.total,
        customer = order.customer_id
    })
    if err then
        return {status = "failed", error = tostring(err)}
    end

    time.sleep("1h")

    local shipment, err = funcs.call("app:ship_order", {
        order_id = order.id,
        address = order.shipping_address
    })
    if err then
        local _, refund_err = funcs.call("app:refund_payment", payment.id)
        if refund_err then
            return {
                status = "failed",
                error = tostring(err),
                compensation_error = tostring(refund_err)
            }
        end
        return {status = "failed", error = tostring(err)}
    end

    return {
        status = "completed",
        payment_id = payment.id,
        tracking = shipment.tracking_number
    }
end

return { main = main }
```

## ワークフローモジュール

`workflow`モジュールはワークフロー固有の操作を提供します。

### workflow.info()

ワークフローの実行情報を取得します。

```lua
local workflow = require("workflow")

local info, info_err = workflow.info()
if info_err then return nil, info_err end
print(info.workflow_id)    -- Workflow execution ID
print(info.run_id)         -- Current run ID
print(info.workflow_type)  -- Workflow type name
print(info.task_queue)     -- Task queue name
print(info.namespace)      -- Temporal namespace
print(info.attempt)        -- Current attempt number
print(info.history_length) -- Number of history events
print(info.history_size)   -- History size in bytes
```

### workflow.exec()

子ワークフローを同期的に実行し、結果を待ちます。

```lua
local result, err = workflow.exec("app:child_workflow", input_data)
if err then
    return nil, err
end
```

親が子の結果をインラインで待つ必要がある場合は、この形式を使用します。

### workflow.version()

決定論的なバージョニングでコード変更を処理します。

```lua
local version, err = workflow.version("payment-v2", 1, 2)
if err then
    return nil, err
end

if version == 1 then
    return funcs.call("app:old_payment", input)
else
    return funcs.call("app:new_payment", input)
end
```

パラメータ:
- `change_id` - この変更の一意の識別子
- `min_supported` - サポートされる最小バージョン
- `max_supported` - 最大（現在の）バージョン

バージョン番号はワークフロー実行ごとに決定論的です。実行中の既存ワークフローは記録されたバージョンを引き続き使用し、新しいワークフローは`max_supported`を使用します。

### workflow.attrs()

検索属性とメモを更新します。

```lua
local updated, err = workflow.attrs({
    search = {
        status = "processing",
        customer_id = order.customer_id,
        order_total = order.total
    },
    memo = {
        notes = "Priority customer",
        source = "web"
    }
})
if err then
    return nil, err
end
```

検索属性はインデックス化され、Temporal可視性APIを通じてクエリ可能です。メモはワークフローに添付される任意の非インデックスデータです。

### workflow.history_length() / workflow.history_size()

ワークフロー履歴の増加を監視します。

```lua
local length, length_err = workflow.history_length()
if length_err then return nil, length_err end
local size, size_err = workflow.history_size()
if size_err then return nil, size_err end

if length > 10000 then
    -- Consider continue-as-new to reset history
end
```

## ワークフローの起動

### 基本的なスポーン

任意のコードから`process.spawn()`を使用してワークフローを開始します。

```lua
local pid, err = process.spawn(
    "app:order_workflow",    -- workflow entry
    "app:worker",            -- temporal worker
    {order_id = "123"}       -- input
)
if err then
    return nil, err
end
```

hostパラメータにはTemporalワーカーを指定します（プロセスホストではありません）。ワークフローはTemporalインフラストラクチャ上で耐久性を保って実行されます。

### モニタリング付きスポーン

ワークフローをモニタリングし、完了時にEXITイベントを受信します。

```lua
local pid, err = process.spawn_monitored(
    "app:order_workflow",
    "app:worker",
    {order_id = "123"}
)
if err then
    return nil, err
end

local events = process.events()
local event, open = events:receive()
if not open then
    return nil, errors.new({kind = errors.INTERNAL, message = "process event channel closed"})
end

if event.kind == process.event.EXIT then
    local result = event.result.value
    local error = event.result.error
end
```

### 名前付きスポーン

冪等な起動を実現するため、ワークフローに名前を割り当てます。

```lua
local spawner = process
    .with_options({})
    :with_name("order-" .. order.id)

local pid, err = spawner:spawn_monitored(
    "app:order_workflow",
    "app:worker",
    {order_id = order.id}
)
if err then
    return nil, err
end
```

名前を指定すると、Temporalはその名前を使ってワークフロー起動の重複を排除します。ワークフローの実行中に同じ名前でスポーンすると、デフォルトでは既存ワークフローのPIDが返されます。

### 明示的なワークフローID付きスポーン

特定のTemporalワークフローIDを設定します。

```lua
local spawner = process
    .with_options({
        ["workflow.id"] = "order-" .. order.id,
    })

local pid, err = spawner:spawn_monitored(
    "app:order_workflow",
    "app:worker",
    order
)
if err then
    return nil, err
end
```

### ID競合ポリシー

既に存在するIDでワークフローをスポーンした場合の動作を制御します。

```lua
-- Fail if workflow already exists
local spawner = process
    .with_options({
        ["workflow.id"] = "order-123",
        ["workflow.id_conflict_policy"] = "fail",
    })

local pid, err = spawner:spawn("app:order_workflow", "app:worker", order)
if err then
    -- Workflow already running with this ID
end
```

```lua
-- Error when already started (alternative approach)
local spawner = process
    .with_options({
        ["workflow.id"] = "order-123",
        ["workflow.execution_error_when_already_started"] = true,
    })

local pid, err = spawner:spawn("app:order_workflow", "app:worker", order)
if err then return nil, err end
```

```lua
-- Reuse existing (default behavior with explicit ID)
local spawner = process
    .with_options({
        ["workflow.id"] = "order-123",
    })

local pid, err = spawner:spawn("app:order_workflow", "app:worker", order)
if err then return nil, err end
-- Returns existing workflow PID if already running
```

| ポリシー | 動作 |
|---------|------|
| `"use_existing"` | 既存のワークフローPIDを返す（明示的ID指定時のデフォルト） |
| `"fail"` | ワークフローが存在する場合にエラーを返す |
| `"terminate_existing"` | 既存を終了して新規を開始 |

### ワークフロー起動オプション

`with_options()`でTemporalワークフローオプションを渡します。

```lua
local spawner = process.with_options({
    ["workflow.id"] = "order-123",
    ["workflow.execution_timeout"] = "24h",
    ["workflow.run_timeout"] = "1h",
    ["workflow.task_timeout"] = "30s",
    ["workflow.id_conflict_policy"] = "fail",
    ["workflow.retry_policy"] = {
        initial_interval = 1000,
        backoff_coefficient = 2.0,
        maximum_interval = 300000,
        maximum_attempts = 3,
    },
    ["workflow.cron_schedule"] = "0 */6 * * *",
    ["workflow.search_attributes"] = {
        customer_id = "cust-123"
    },
    ["workflow.memo"] = {
        source = "api"
    },
    ["workflow.start_delay"] = "5m",
    ["workflow.parent_close_policy"] = "terminate",
})
```

#### 全オプションリファレンス

| オプション | 型 | 説明 |
|-----------|-----|------|
| `workflow.id` | string | 明示的なワークフロー実行ID |
| `workflow.task_queue` | string | タスクキューのオーバーライド |
| `workflow.execution_timeout` | duration | ワークフロー実行全体のタイムアウト |
| `workflow.run_timeout` | duration | 単一実行のタイムアウト |
| `workflow.task_timeout` | duration | ワークフロータスク処理のタイムアウト |
| `workflow.id_conflict_policy` | string | `use_existing`、`fail`、`terminate_existing` |
| `workflow.id_reuse_policy` | string | `allow_duplicate`、`allow_duplicate_failed_only`、`reject_duplicate` |
| `workflow.execution_error_when_already_started` | boolean | ワークフローが既に実行中の場合にエラー |
| `workflow.retry_policy` | table | リトライポリシー（下記参照） |
| `workflow.cron_schedule` | string | 定期ワークフローのcron式 |
| `workflow.memo` | table | 非インデックスのワークフローメタデータ |
| `workflow.search_attributes` | table | インデックス化されたクエリ可能な属性 |
| `workflow.enable_eager_start` | boolean | 即時実行を開始 |
| `workflow.start_delay` | duration | ワークフロー開始前の遅延 |
| `workflow.summary` | string | Temporalワークフローのメタデータに表示される概要 |
| `workflow.details` | string | Temporalワークフローのメタデータに表示される詳細 |
| `workflow.versioning_override` | string or table | 自動アップグレードモード、または固定されたデプロイ／ビルドバージョン |
| `workflow.priority` | table | 優先度キーと任意の公平性設定 |
| `workflow.parent_close_policy` | string | 親クローズ時の子の動作 |
| `workflow.wait_for_cancellation` | boolean | キャンセル完了を待機 |
| `workflow.namespace` | string | Temporal名前空間のオーバーライド |
| `workflow.versioning_intent` | string or number | 子ワークフローに対するワーカーのバージョニング意図 |
| `workflow.name` | string | 子ワークフロー種別名の上書き |

duration値は文字列（`"5s"`、`"10m"`、`"1h"`）またはミリ秒の数値を受け付けます。

従来の`temporal.workflow.*`エイリアスも互換性のため引き続き受け付けられます。新しいコードでは、上記の正規の`workflow.*`名を使用してください。

固定バージョンを上書きする場合は、モードとデプロイバージョンの両方が必要です。

```lua
["workflow.versioning_override"] = {
    mode = "pinned",
    version = {
        deployment_name = "orders",
        build_id = "orders-v2",
    },
}
```

自動アップグレードを上書きするには、文字列`"auto_upgrade"`を使用します。

#### 親クローズポリシー

親がクローズした場合の子ワークフローの動作を制御:

| ポリシー | 動作 |
|---------|------|
| `"terminate"` | 子ワークフローを終了 |
| `"abandon"` | 子を独立して継続させる |
| `"request_cancel"` | 子にキャンセルリクエストを送信 |

### スタートアップメッセージ

ワークフローの開始と同時に送るシグナルをキューに入れます。最初の空でないスタートアップメッセージは、開始とアトミックに送信されます。残りのメッセージは開始後にビルダーの順序で送信されますが、他の呼び出し元が同時に送るシグナルと交互に届く場合があります。

```lua
local spawner = process
    .with_options({})
    :with_name("counter-workflow")
    :with_message("increment", {amount = 2})
    :with_message("increment", {amount = 1})
    :with_message("increment", {amount = 4})

local pid, err = spawner:spawn_monitored(
    "app:counter_workflow",
    "app:worker",
    {initial = 0}
)
if err then return nil, err end
```

`use_existing`競合ポリシーでは、2回目のスポーンが既存のワークフローに解決された場合でも、スタートアップメッセージが配信されます。

```lua
-- First spawn starts the workflow with initial messages
local first = process
    .with_options({})
    :with_name("my-counter")
    :with_message("increment", {amount = 3})

local pid, first_err = first:spawn("app:counter_workflow", "app:worker", {initial = 0})
if first_err then return nil, first_err end

-- Second spawn reuses existing workflow and delivers new messages
local second = process
    .with_options({})
    :with_name("my-counter")
    :with_message("increment", {amount = 2})

local pid2, second_err = second:spawn("app:counter_workflow", "app:worker", {initial = 999})
if second_err then return nil, second_err end
-- pid2 == pid (same workflow), input {initial = 999} is ignored
-- But the increment message with amount=2 is delivered
```

### コンテキスト伝播

ワークフローとそのアクティビティ内から参照できるコンテキスト値を渡します。

```lua
local spawner = process.with_context({
    user_id = "user-1",
    tenant = "tenant-1",
    request_id = "req-abc",
})

local pid, err = spawner:spawn_monitored(
    "app:order_workflow",
    "app:worker",
    order
)
if err then return nil, err end
```

ワークフロー内（またはそこから呼び出されるアクティビティ内）では、`ctx`モジュールでコンテキストを読み取ります。

```lua
local ctx = require("ctx")

local user_id, user_err = ctx.get("user_id")       -- "user-1"
if user_err then return nil, user_err end
local tenant, tenant_err = ctx.get("tenant")       -- "tenant-1"
if tenant_err then return nil, tenant_err end
local all, err = ctx.all()               -- {user_id="user-1", tenant="tenant-1", request_id="req-abc"}
if err then
    return nil, err
end
```

### HTTPハンドラから

```lua
local function handler()
    local req, req_err = http.request()
    if req_err then
        return nil, req_err
    end

    local body, body_err = req:body()
    if body_err then
        return nil, body_err
    end
    local order, decode_err = json.decode(body)
    if decode_err then
        return nil, decode_err
    end

    local request_id, header_err = req:header("X-Request-ID")
    if header_err then
        return nil, header_err
    end

    local spawner = process
        .with_context({request_id = request_id})
        :with_options({
            ["workflow.id"] = "order-" .. order.id,
            ["workflow.id_conflict_policy"] = "fail",
        })

    local pid, err = spawner:spawn(
        "app:order_workflow",
        "app:worker",
        order
    )

    local res, res_err = http.response()
    if res_err then
        return nil, res_err
    end
    if err then
        local status_err = res:set_status(409)
        if status_err then
            return nil, status_err
        end
        local write_err = res:write_json({error = tostring(err)})
        if write_err then return nil, write_err end
        return true
    end

    local status_err = res:set_status(202)
    if status_err then
        return nil, status_err
    end
    local write_err = res:write_json({
        workflow_id = tostring(pid),
        status = "started"
    })
    if write_err then return nil, write_err end
    return true
end
```

## シグナル

ワークフローはプロセスメッセージングシステムを通じてシグナルを受信します。シグナルは耐久性があり、ワークフローリプレイを通じて保持されます。

### inboxパターン

プロセスのinboxを通じて、すべてのメッセージを受信します。

```lua
local function main(order)
    local inbox = process.inbox()

    while true do
        local msg, open = inbox:receive()
        if not open then
            return nil, errors.new({kind = errors.INTERNAL, message = "workflow inbox closed"})
        end
        local topic = msg:topic()

        if topic == "approve" then
            break
        elseif topic == "cancel" then
            local payload = msg:payload()
            local data
            if payload then
                local payload_err
                data, payload_err = payload:data()
                if payload_err then return nil, payload_err end
            end
            local reason = type(data) == "table" and data.reason or nil
            return {status = "cancelled", reason = reason}
        end
    end

    return process_order(order)
end
```

### トピックベースのサブスクリプション

`process.listen()`で特定のトピックを購読します。

```lua
local function main(input)
    local results = {}
    local job_ch, job_err = process.listen("add_job")
    if job_err then return nil, job_err end
    local exit_ch, exit_err = process.listen("exit")
    if exit_err then return nil, exit_err end

    while true do
        local result = channel.select{
            job_ch:case_receive(),
            exit_ch:case_receive()
        }

        if result.channel == exit_ch then
            break
        elseif result.channel == job_ch then
            if not result.ok then
                break
            end
            local job_data = result.value
            local activity_result, err = funcs.call(
                "app:echo_activity",
                {job_id = job_data.id, data = job_data}
            )
            if err then
                return nil, err
            end
            table.insert(results, {
                job_id = job_data.id,
                result = activity_result
            })
        end
    end

    return {total_jobs = #results, results = results}
end
```

デフォルトでは、`process.listen()`は生のペイロードデータを返します。送信者情報を含むMessageオブジェクトを受信するには、`{message = true}`を使用します。

```lua
local ch, err = process.listen("request", {message = true})
if err then return nil, err end
local msg, open = ch:receive()
if not open then
    return nil, errors.new({kind = errors.INTERNAL, message = "request channel closed"})
end
local sender = msg:from()
local payload = msg:payload()
local data
if payload then
    local payload_err
    data, payload_err = payload:data()
    if payload_err then return nil, payload_err end
end
```

### シリアライズされたシグナル処理

シグナルが共有ワークフロー状態を変更する場合は、1つの`channel.select()`ループを使用します。これにより、決定論的な変更順序が保たれ、`finish`分岐はブロックされたハンドラーcoroutineを残さずに終了できます。

```lua
local function main(input)
    local counter = input.initial or 0

    local function send_reply(pid, topic, payload)
        local sent, err = process.send(pid, topic, payload)
        if err then error(err) end
        return sent
    end

    local function message_data(msg)
        local payload = msg:payload()
        if not payload then return nil end
        return payload:data()
    end

    local increment_ch, increment_err = process.listen("increment", {message = true})
    if increment_err then return nil, increment_err end
    local decrement_ch, decrement_err = process.listen("decrement", {message = true})
    if decrement_err then return nil, decrement_err end
    local finish_ch, finish_err = process.listen("finish", {message = true})
    if finish_err then return nil, finish_err end

    while true do
        local result = channel.select{
            increment_ch:case_receive(),
            decrement_ch:case_receive(),
            finish_ch:case_receive()
        }
        if not result.ok then
            return nil, errors.new({kind = errors.INTERNAL, message = "signal channel closed"})
        end

        local msg = result.value
        local reply_to = msg:from()

        if result.channel == finish_ch then
            send_reply(reply_to, "ack")
            send_reply(reply_to, "ok", {message = "finishing", value = counter})
            return {final_counter = counter}
        end

        local data, payload_err = message_data(msg)
        if payload_err then return nil, payload_err end

        if type(data) ~= "table" or type(data.amount) ~= "number" then
            send_reply(reply_to, "nak", "amount must be a number")
        elseif result.channel == decrement_ch and counter - data.amount < 0 then
            send_reply(reply_to, "nak", "would result in negative value")
        else
            send_reply(reply_to, "ack")
            if result.channel == increment_ch then
                counter = counter + data.amount
            else
                counter = counter - data.amount
            end
            send_reply(reply_to, "ok", {value = counter})
        end
    end
end
```

### シグナルの応答確認

送信者に応答を返すことで、リクエスト・リプライパターンを実装します。

```lua
-- Workflow side
local ch, err = process.listen("get_status", {message = true})
if err then return nil, err end
local msg, open = ch:receive()
if not open then return nil, errors.new({kind = errors.INTERNAL, message = "status channel closed"}) end
local sent, send_err = process.send(msg:from(), "status_response", {status = "processing", progress = 75})
if send_err then return nil, send_err end
```

```lua
-- Caller side
local response_ch, listen_err = process.listen("status_response")
if listen_err then return nil, listen_err end
local sent, send_err = process.send(workflow_pid, "get_status", {})
if send_err then return nil, send_err end

local timeout, timeout_err = time.after("5s")
if timeout_err then return nil, timeout_err end
local result = channel.select{
    response_ch:case_receive(),
    timeout:case_receive()
}

if result.channel == response_ch then
    if not result.ok then
        return nil, errors.new({kind = errors.INTERNAL, message = "status response channel closed"})
    end
    return result.value
end

if not result.ok then
    return nil, errors.new({kind = errors.INTERNAL, message = "status timeout channel closed"})
end
return nil, errors.new({kind = errors.TIMEOUT, message = "status request timed out", retryable = true})
```

### ワークフロー間シグナリング

ワークフローは、PIDを使用して他のワークフローにシグナルを送信できます。

```lua
-- Sender workflow
local function main(input)
    local target_pid = input.target
    local response_ch, listen_err = process.listen("cross_host_pong")
    if listen_err then return nil, listen_err end

    local ok, err = process.send(target_pid, "cross_host_ping", {data = "hello"})
    if err then
        return {ok = false, error = tostring(err)}
    end

    local response, open = response_ch:receive()
    if not open then
        return {ok = false, error = "cross_host_pong channel closed"}
    end
    return {ok = true, received = response}
end
```

## 子ワークフロー

### 同期的な子ワークフロー（workflow.exec）

子ワークフローを実行し、結果を待ちます。

```lua
local result, err = workflow.exec("app:child_workflow", input_data)
if err then
    return nil, err
end
```

### 非同期な子ワークフロー（process.spawn）

ブロックせずに子ワークフローをスポーンし、イベントを通じて完了を待ちます。

```lua
local events_ch = process.events()

local child_pid, err = process.spawn(
    "app:child_workflow",
    "app:worker",
    {message = "hello from parent"}
)
if err then
    return {status = "spawn_failed", error = tostring(err)}
end

-- Wait for child EXIT event
local event, open = events_ch:receive()
if not open then
    return nil, errors.new({kind = errors.INTERNAL, message = "process event channel closed"})
end

if event.kind == process.event.EXIT then
    local child_result = event.result.value
    local child_error = event.result.error
end
```

### 子ワークフローからのエラー伝播

子ワークフローが返したエラーは、EXITイベントに含まれます。

```lua
local events_ch = process.events()
local child_pid, err = process.spawn(
    "app:error_child_workflow",
    "app:worker"
)
if err then
    return nil, err
end

local event, open = events_ch:receive()
if not open then
    return nil, errors.new({kind = errors.INTERNAL, message = "process event channel closed"})
end
if event.result.error then
    local child_err = event.result.error
    -- Error objects have kind(), retryable(), message() methods
    print(child_err:kind())       -- e.g. "NotFound"
    print(child_err:retryable())  -- false
    print(child_err:message())    -- error message text
end
```

### ワークフローの同期実行（process.exec）

ワークフローを実行し、1回の呼び出しで結果を待ちます。

```lua
local result, err = process.exec(
    "app:hello_workflow",
    "app:worker",
    {name = "world"}
)
if err then
    return nil, err
end
-- result contains the workflow return value
```

## モニタリングとリンク

### 起動後のモニタリング

既に開始されたワークフローをモニタリングします。

```lua
local pid, err = process.spawn(
    "app:long_workflow",
    "app:worker",
    {iterations = 100}
)
if err then
    return nil, err
end

-- Monitor later
local ok, monitor_err = process.monitor(pid)
if monitor_err then
    return nil, monitor_err
end

local events_ch = process.events()
local event, open = events_ch:receive()  -- EXIT when workflow completes
if not open then
    return nil, errors.new({kind = errors.INTERNAL, message = "process event channel closed"})
end
```

### 起動後のリンク

実行中のワークフローにリンクし、異常終了時にLINK_DOWNを受信します。

```lua
local ok, err = process.set_options({trap_links = true})
if err then
    return nil, err
end

local pid, err = process.spawn(
    "app:long_workflow",
    "app:worker",
    {iterations = 100}
)
if err then
    return nil, err
end

-- Link after workflow has started
time.sleep("200ms")
local linked, link_err = process.link(pid)
if link_err then return nil, link_err end

-- If workflow is terminated, receive LINK_DOWN
local terminated, terminate_err = process.terminate(pid)
if terminate_err then return nil, terminate_err end

local events_ch = process.events()
local event, open = events_ch:receive()
if not open then
    return nil, errors.new({kind = errors.INTERNAL, message = "process event channel closed"})
end
-- event.kind == process.event.LINK_DOWN
```

LINK_DOWNイベントにはプロセスオプションで`trap_links = true`が必要です。これがない場合、リンクされたプロセスの終了は障害を伝播します。

### モニタリング解除 / リンク解除

モニタリングまたはリンクを解除します。

```lua
local unmonitored, unmonitor_err = process.unmonitor(pid)
if unmonitor_err then return nil, unmonitor_err end
local unlinked, unlink_err = process.unlink(pid)
if unlink_err then return nil, unlink_err end
```

モニタリング解除またはリンク解除後、そのプロセスのイベントは配信されなくなります。

## 終了とキャンセル

### 終了

実行中のワークフローを強制終了します。

```lua
local ok, err = process.terminate(workflow_pid)
```

モニタリングしている呼び出し元はエラー付きのEXITイベントを受信します。

### キャンセル

任意の理由を付けて、グレースフルなキャンセルを要求します。

```lua
local ok, err = process.cancel(workflow_pid, "cancelled by operator")
```

## 並行処理

ワークフロー内で`coroutine.spawn()`とchannelを使用し、並列処理を実行します。

```lua
local function main(input)
    local worker_count = input.workers or 3
    local job_count = input.jobs or 6

    local work_queue = channel.new(10)
    local results = channel.new(10)

    for w = 1, worker_count do
        coroutine.spawn(function()
            while true do
                local job, ok = work_queue:receive()
                if not ok then break end
                time.sleep(10 * time.MILLISECOND)
                results:send({worker = w, job = job, result = job * 2})
            end
        end)
    end

    for j = 1, job_count do
        work_queue:send(j)
    end
    work_queue:close()

    local total = 0
    local processed = {}
    for _ = 1, job_count do
        local r, open = results:receive()
        if not open then
            return nil, errors.new({kind = errors.INTERNAL, message = "results channel closed"})
        end
        total = total + r.result
        table.insert(processed, r)
    end

    return {total = total, processed = processed}
end
```

coroutine内のすべてのchannel操作とスリープは、リプレイセーフです。

## タイマー

耐久性のあるタイマーは、再起動後も継続します。

```lua
local time = require("time")

time.sleep("24h")
time.sleep("5m")
time.sleep("30s")
time.sleep(100 * time.MILLISECOND)
```

経過時間を追跡します。

```lua
local start = time.now()
time.sleep("1s")
local elapsed = time.now():sub(start):milliseconds()
```

## 決定論

ワークフローコードは決定論的でなければなりません。同じ入力は同じコマンドシーケンスを生成する必要があります。

### リプレイセーフな操作

以下の操作は自動的にインターセプトされ、その結果が記録されます。リプレイ時には、記録済みの値が返されます。

```lua
-- Activity calls
local data = funcs.call("app:fetch_data", id)

-- Durable sleep
time.sleep("1h")

-- Current time
local now = time.now()

-- UUID generation
local id = uuid.v4()

-- Crypto operations
local bytes = crypto.random.bytes(32)

-- Child workflows
local result = workflow.exec("app:child", input)

-- Versioning
local v = workflow.version("change-1", 1, 2)
```

### 非決定論的（避けるべき操作）

```lua
-- Don't use wall clock time
local now = os.time()              -- non-deterministic

-- Don't use random directly
local r = math.random()            -- non-deterministic

-- Don't do I/O in workflow code
local file = io.open("data.txt")   -- non-deterministic

-- Don't use global mutable state
counter = counter + 1               -- non-deterministic across replays
```

## エラー処理

### アクティビティエラー

アクティビティエラーには、構造化されたメタデータが含まれます。

```lua
local result, err = funcs.call("app:risky_activity", order)
if err then
    print(err:kind())       -- error classification (e.g. "NotFound", "Internal")
    print(err:retryable())  -- whether the error is retryable
    print(err:message())    -- human-readable error message
end
```

### アクティビティの障害モード

アクティビティ呼び出しの再試行動作を設定します。

```lua
local executor = funcs.new():with_options({
    ["activity.retry_policy"] = {
        maximum_attempts = 1,
    }
})

local result, err = executor:call("app:unreliable_activity", input)
if err then
    local kind = err:kind()         -- "Internal" for runtime errors
    local retryable = err:retryable()
end
```

### 子ワークフローエラー

子ワークフローからのエラー（`process.exec`またはEXITイベント経由）にも、同じメタデータが含まれます。

```lua
local result, err = process.exec("app:error_workflow", "app:worker")
if err then
    print(err:kind())       -- e.g. "NotFound"
    print(err:retryable())  -- false
    print(err:message())    -- error details
end
```

## 補償パターン（Saga）

```lua
local function run_compensations(compensations)
    local first_err
    for _, comp in ipairs(compensations) do
        local _, err = funcs.call(comp.action, comp.args)
        if err and not first_err then
            first_err = err
        end
    end
    if first_err then return nil, first_err end
    return true
end

local function main(order)
    local compensations = {}

    local reservation, err = funcs.call("app:reserve_inventory", order.items)
    if err then
        return {status = "failed", step = "inventory", error = tostring(err)}
    end
    table.insert(compensations, 1, {
        action = "app:release_inventory",
        args = reservation.id
    })

    local payment, err = funcs.call("app:charge_payment", order.payment)
    if err then
        local _, compensation_err = run_compensations(compensations)
        if compensation_err then
            return {status = "failed", step = "payment", error = tostring(err), compensation_error = tostring(compensation_err)}
        end
        return {status = "failed", step = "payment", error = tostring(err)}
    end
    table.insert(compensations, 1, {
        action = "app:refund_payment",
        args = payment.id
    })

    local shipment, err = funcs.call("app:ship_order", order.shipping)
    if err then
        local _, compensation_err = run_compensations(compensations)
        if compensation_err then
            return {status = "failed", step = "shipping", error = tostring(err), compensation_error = tostring(compensation_err)}
        end
        return {status = "failed", step = "shipping", error = tostring(err)}
    end

    return {status = "completed", tracking = shipment.tracking}
end
```

補償は登録とは逆の順序で実行されます。複数の補償が失敗した場合でも、ワークフローは残りのアクションを試行し、最初の失敗を`compensation_error`として報告します。

## 関連項目

- [概要](./overview.md) - クライアントとワーカーの設定
- [アクティビティ](./activities.md) - アクティビティの定義とオプション
- [プロセス](../lua/core/process.md) - プロセス管理API
- [関数](../lua/core/funcs.md) - 関数呼び出し
- [チャネル](../lua/core/channel.md) - チャネル操作
