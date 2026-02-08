# ワークフロー

ワークフローはアクティビティをオーケストレーションし、障害や再起動をまたいで状態を維持する永続的な関数です。`workflow.lua`エントリ種別を使用して定義されます。

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
        funcs.call("app:refund_payment", payment.id)
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

ワークフロー実行情報を取得：

```lua
local workflow = require("workflow")

local info = workflow.info()
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

子ワークフローを同期的に実行し、結果を待機：

```lua
local result, err = workflow.exec("app:child_workflow", input_data)
if err then
    return nil, err
end
```

結果を即座に待つ場合の子ワークフロー実行の最も簡単な方法です。

### workflow.version()

決定論的バージョニングでコード変更を処理：

```lua
local version = workflow.version("payment-v2", 1, 2)

if version == 1 then
    result = funcs.call("app:old_payment", input)
else
    result = funcs.call("app:new_payment", input)
end
```

パラメータ：
- `change_id` - この変更の一意の識別子
- `min_supported` - サポートされる最小バージョン
- `max_supported` - 最大（現在の）バージョン

バージョン番号はワークフロー実行ごとに決定論的です。実行中の既存ワークフローは記録されたバージョンを引き続き使用し、新しいワークフローは`max_supported`を使用します。

### workflow.attrs()

検索属性とメモを更新：

```lua
workflow.attrs({
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
```

検索属性はインデックス化され、Temporal可視性APIを通じてクエリ可能です。メモはワークフローに添付される任意の非インデックスデータです。

### workflow.history_length() / workflow.history_size()

ワークフロー履歴の増加を監視：

```lua
local length = workflow.history_length()
local size = workflow.history_size()

if length > 10000 then
    -- Consider continue-as-new to reset history
end
```

## ワークフローの起動

### 基本的なスポーン

任意のコードから`process.spawn()`を使用してワークフローを開始：

```lua
local pid, err = process.spawn(
    "app:order_workflow",    -- workflow entry
    "app:worker",            -- temporal worker
    {order_id = "123"}       -- input
)
```

host パラメータは Temporal ワーカーです（プロセスホストではありません）。ワークフローは Temporal インフラストラクチャ上で永続的に実行されます。

### モニタリング付きスポーン

ワークフローをモニタリングして完了時にEXITイベントを受信：

```lua
local pid, err = process.spawn_monitored(
    "app:order_workflow",
    "app:worker",
    {order_id = "123"}
)

local events = process.events()
local event = events:receive()

if event.kind == process.event.EXIT then
    local result = event.result.value
    local error = event.result.error
end
```

### 名前付きスポーン

冪等性のある起動のためにワークフローに名前を割り当てる：

```lua
local spawner = process
    .with_options({})
    :with_name("order-" .. order.id)

local pid, err = spawner:spawn_monitored(
    "app:order_workflow",
    "app:worker",
    {order_id = order.id}
)
```

名前が指定されると、Temporal はそれを使用してワークフロー起動を重複排除します。ワークフロー実行中に同じ名前でスポーンすると、デフォルトでは既存ワークフローの PID が返されます。

### 明示的なワークフローID付きスポーン

特定のTemporalワークフローIDを設定：

```lua
local spawner = process
    .with_options({
        ["temporal.workflow.id"] = "order-" .. order.id,
    })

local pid, err = spawner:spawn_monitored(
    "app:order_workflow",
    "app:worker",
    order
)
```

### ID競合ポリシー

既に存在するIDでワークフローをスポーンした場合の動作を制御：

```lua
-- Fail if workflow already exists
local spawner = process
    .with_options({
        ["temporal.workflow.id"] = "order-123",
        ["temporal.workflow.id_conflict_policy"] = "fail",
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
        ["temporal.workflow.id"] = "order-123",
        ["temporal.workflow.execution_error_when_already_started"] = true,
    })

local pid, err = spawner:spawn("app:order_workflow", "app:worker", order)
```

```lua
-- Reuse existing (default behavior with explicit ID)
local spawner = process
    .with_options({
        ["temporal.workflow.id"] = "order-123",
    })

local pid, err = spawner:spawn("app:order_workflow", "app:worker", order)
-- Returns existing workflow PID if already running
```

| ポリシー | 動作 |
|---------|------|
| `"use_existing"` | 既存のワークフローPIDを返す（明示的ID指定時のデフォルト） |
| `"fail"` | ワークフローが存在する場合にエラーを返す |
| `"terminate_existing"` | 既存を終了して新規を開始 |

### ワークフロー起動オプション

`with_options()`でTemporalワークフローオプションを渡す：

```lua
local spawner = process.with_options({
    ["temporal.workflow.id"] = "order-123",
    ["temporal.workflow.execution_timeout"] = "24h",
    ["temporal.workflow.run_timeout"] = "1h",
    ["temporal.workflow.task_timeout"] = "30s",
    ["temporal.workflow.id_conflict_policy"] = "fail",
    ["temporal.workflow.retry_policy"] = {
        initial_interval = 1000,
        backoff_coefficient = 2.0,
        maximum_interval = 300000,
        maximum_attempts = 3,
    },
    ["temporal.workflow.cron_schedule"] = "0 */6 * * *",
    ["temporal.workflow.search_attributes"] = {
        customer_id = "cust-123"
    },
    ["temporal.workflow.memo"] = {
        source = "api"
    },
    ["temporal.workflow.start_delay"] = "5m",
    ["temporal.workflow.parent_close_policy"] = "terminate",
})
```

#### 全オプションリファレンス

| オプション | 型 | 説明 |
|-----------|-----|------|
| `temporal.workflow.id` | string | 明示的なワークフロー実行ID |
| `temporal.workflow.task_queue` | string | タスクキューのオーバーライド |
| `temporal.workflow.execution_timeout` | duration | ワークフロー実行全体のタイムアウト |
| `temporal.workflow.run_timeout` | duration | 単一実行のタイムアウト |
| `temporal.workflow.task_timeout` | duration | ワークフロータスク処理のタイムアウト |
| `temporal.workflow.id_conflict_policy` | string | `use_existing`、`fail`、`terminate_existing` |
| `temporal.workflow.id_reuse_policy` | string | `allow_duplicate`、`allow_duplicate_failed_only`、`reject_duplicate` |
| `temporal.workflow.execution_error_when_already_started` | boolean | ワークフローが既に実行中の場合にエラー |
| `temporal.workflow.retry_policy` | table | リトライポリシー（下記参照） |
| `temporal.workflow.cron_schedule` | string | 定期ワークフローのcron式 |
| `temporal.workflow.memo` | table | 非インデックスのワークフローメタデータ |
| `temporal.workflow.search_attributes` | table | インデックス化されたクエリ可能な属性 |
| `temporal.workflow.enable_eager_start` | boolean | 即時実行を開始 |
| `temporal.workflow.start_delay` | duration | ワークフロー開始前の遅延 |
| `temporal.workflow.parent_close_policy` | string | 親クローズ時の子の動作 |
| `temporal.workflow.wait_for_cancellation` | boolean | キャンセル完了を待機 |
| `temporal.workflow.namespace` | string | Temporal名前空間のオーバーライド |

duration値は文字列（`"5s"`、`"10m"`、`"1h"`）またはミリ秒の数値を受け付けます。

#### 親クローズポリシー

親がクローズした場合の子ワークフローの動作を制御：

| ポリシー | 動作 |
|---------|------|
| `"terminate"` | 子ワークフローを終了 |
| `"abandon"` | 子を独立して継続させる |
| `"request_cancel"` | 子にキャンセルリクエストを送信 |

### スタートアップメッセージ

ワークフロー開始直後に送信されるシグナルをキューイングします。メッセージは外部シグナルより前に配信されます：

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
```

スタートアップメッセージは`use_existing`競合ポリシーで特に有用です。2回目のスポーンが既存のワークフローに解決された場合でも、スタートアップメッセージは配信されます：

```lua
-- First spawn starts the workflow with initial messages
local first = process
    .with_options({})
    :with_name("my-counter")
    :with_message("increment", {amount = 3})

local pid, err = first:spawn("app:counter_workflow", "app:worker", {initial = 0})

-- Second spawn reuses existing workflow and delivers new messages
local second = process
    .with_options({})
    :with_name("my-counter")
    :with_message("increment", {amount = 2})

local pid2, err = second:spawn("app:counter_workflow", "app:worker", {initial = 999})
-- pid2 == pid (same workflow), input {initial = 999} is ignored
-- But the increment message with amount=2 is delivered
```

### コンテキスト伝播

ワークフローとそのアクティビティ内でアクセス可能なコンテキスト値を渡す：

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
```

ワークフロー内（またはそこから呼び出されるアクティビティ内）では、`ctx`モジュールでコンテキストを読み取る：

```lua
local ctx = require("ctx")

local user_id = ctx.get("user_id")       -- "user-1"
local tenant = ctx.get("tenant")         -- "tenant-1"
local all = ctx.all()                    -- {user_id="user-1", tenant="tenant-1", request_id="req-abc"}
```

### HTTPハンドラから

```lua
local function handler()
    local req = http.request()
    local order = json.decode(req:body())

    local spawner = process
        .with_context({request_id = req:header("X-Request-ID")})
        :with_options({
            ["temporal.workflow.id"] = "order-" .. order.id,
            ["temporal.workflow.id_conflict_policy"] = "fail",
        })

    local pid, err = spawner:spawn(
        "app:order_workflow",
        "app:worker",
        order
    )

    if err then
        return http.response():status(409):json({error = tostring(err)})
    end

    return http.response():status(202):json({
        workflow_id = tostring(pid),
        status = "started"
    })
end
```

## シグナル

ワークフローはプロセスメッセージングシステムを通じてシグナルを受信します。シグナルは耐久性があり、ワークフローリプレイを通じて保持されます。

### inboxパターン

プロセスinboxを通じてすべてのメッセージを受信：

```lua
local function main(order)
    local inbox = process.inbox()

    while true do
        local msg = inbox:receive()
        local topic = msg:topic()
        local data = msg:payload():data()

        if topic == "approve" then
            break
        elseif topic == "cancel" then
            return {status = "cancelled", reason = data.reason}
        end
    end

    return process_order(order)
end
```

### トピックベースのサブスクリプション

`process.listen()`で特定のトピックにサブスクライブ：

```lua
local function main(input)
    local results = {}
    local job_ch = process.listen("add_job")
    local exit_ch = process.listen("exit")

    while true do
        local result = channel.select{
            job_ch:case_receive(),
            exit_ch:case_receive()
        }

        if result.channel == exit_ch then
            break
        elseif result.channel == job_ch then
            local job_data = result.value
            local activity_result, err = funcs.call(
                "app:echo_activity",
                {job_id = job_data.id, data = job_data}
            )
            table.insert(results, {
                job_id = job_data.id,
                result = activity_result
            })
        end
    end

    return {total_jobs = #results, results = results}
end
```

デフォルトでは`process.listen()`は生のペイロードデータを返します。送信者情報付きのMessageオブジェクトを受信するには`{message = true}`を使用：

```lua
local ch = process.listen("request", {message = true})
local msg = ch:receive()
local sender = msg:from()
local data = msg:payload():data()
```

### 複数シグナルハンドラ

`coroutine.spawn()`で異なるシグナルタイプを並行に処理：

```lua
local function main(input)
    local counter = input.initial or 0
    local done = false

    coroutine.spawn(function()
        local ch = process.listen("increment", {message = true})
        while not done do
            local msg, ok = ch:receive()
            if not ok then break end

            local data = msg:payload():data()
            local reply_to = msg:from()

            if type(data) ~= "table" or type(data.amount) ~= "number" then
                process.send(reply_to, "nak", "amount must be a number")
            else
                process.send(reply_to, "ack")
                counter = counter + data.amount
                process.send(reply_to, "ok", {value = counter})
            end
        end
    end)

    coroutine.spawn(function()
        local ch = process.listen("decrement", {message = true})
        while not done do
            local msg, ok = ch:receive()
            if not ok then break end

            local data = msg:payload():data()
            local reply_to = msg:from()

            if counter - data.amount < 0 then
                process.send(reply_to, "nak", "would result in negative value")
            else
                process.send(reply_to, "ack")
                counter = counter - data.amount
                process.send(reply_to, "ok", {value = counter})
            end
        end
    end)

    -- Main coroutine waits for finish signal
    local finish_ch = process.listen("finish", {message = true})
    local msg = finish_ch:receive()
    process.send(msg:from(), "ack")
    process.send(msg:from(), "ok", {message = "finishing"})
    done = true

    return {final_counter = counter}
end
```

### シグナルの応答確認

送信者に応答を返すことでリクエスト・リプライパターンを実装：

```lua
-- Workflow side
local ch = process.listen("get_status", {message = true})
local msg = ch:receive()
process.send(msg:from(), "status_response", {status = "processing", progress = 75})
```

```lua
-- Caller side
local response_ch = process.listen("status_response")
process.send(workflow_pid, "get_status", {})

local timeout = time.after("5s")
local result = channel.select{
    response_ch:case_receive(),
    timeout:case_receive()
}

if result.channel == response_ch then
    local status = result.value
end
```

### ワークフロー間シグナリング

ワークフローはPIDを使用して他のワークフローにシグナルを送信可能：

```lua
-- Sender workflow
local function main(input)
    local target_pid = input.target
    local ok, err = process.send(target_pid, "cross_host_ping", {data = "hello"})
    if err then
        return {ok = false, error = tostring(err)}
    end

    local response_ch = process.listen("cross_host_pong")
    local response = response_ch:receive()
    return {ok = true, received = response}
end
```

## 子ワークフロー

### 同期的な子ワークフロー（workflow.exec）

子ワークフローを実行して結果を待機：

```lua
local result, err = workflow.exec("app:child_workflow", input_data)
if err then
    return nil, err
end
```

### 非同期な子ワークフロー（process.spawn）

ブロックせずに子ワークフローをスポーンし、イベント経由で完了を待機：

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
local event = events_ch:receive()

if event.kind == process.event.EXIT then
    local child_result = event.result.value
    local child_error = event.result.error
end
```

### 子ワークフローからのエラー伝播

子ワークフローがエラーを返した場合、EXITイベントに含まれる：

```lua
local events_ch = process.events()
local child_pid, err = process.spawn(
    "app:error_child_workflow",
    "app:worker"
)

local event = events_ch:receive()
if event.result.error then
    local child_err = event.result.error
    -- Error objects have kind(), retryable(), message() methods
    print(child_err:kind())       -- e.g. "NOT_FOUND"
    print(child_err:retryable())  -- false
    print(child_err:message())    -- error message text
end
```

### ワークフローの同期実行（process.exec）

ワークフローを実行し、1回の呼び出しで結果を待機：

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

既に開始されたワークフローをモニタリング：

```lua
local pid, err = process.spawn(
    "app:long_workflow",
    "app:worker",
    {iterations = 100}
)

-- Monitor later
local ok, err = process.monitor(pid)

local events_ch = process.events()
local event = events_ch:receive()  -- EXIT when workflow completes
```

### 起動後のリンク

実行中のワークフローにリンクして異常終了時にLINK_DOWNを受信：

```lua
local ok, err = process.set_options({trap_links = true})

local pid, err = process.spawn(
    "app:long_workflow",
    "app:worker",
    {iterations = 100}
)

-- Link after workflow has started
time.sleep("200ms")
local ok, err = process.link(pid)

-- If workflow is terminated, receive LINK_DOWN
process.terminate(pid)

local events_ch = process.events()
local event = events_ch:receive()
-- event.kind == process.event.LINK_DOWN
```

LINK_DOWNイベントにはプロセスオプションで`trap_links = true`が必要です。これがない場合、リンクされたプロセスの終了は障害を伝播します。

### モニタリング解除 / リンク解除

モニタリングまたはリンクを解除：

```lua
process.unmonitor(pid)  -- stop receiving EXIT events
process.unlink(pid)     -- remove bidirectional link
```

モニタリング解除またはリンク解除後、そのプロセスのイベントは配信されなくなります。

## 終了とキャンセル

### 終了

実行中のワークフローを強制終了：

```lua
local ok, err = process.terminate(workflow_pid)
```

モニタリングしている呼び出し元はエラー付きのEXITイベントを受信します。

### キャンセル

オプションのデッドライン付きでグレースフルキャンセルを要求：

```lua
local ok, err = process.cancel(workflow_pid, "5s")
```

## 並行処理

ワークフロー内で`coroutine.spawn()`とchannelを使用して並列処理を実行：

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
        local r = results:receive()
        total = total + r.result
        table.insert(processed, r)
    end

    return {total = total, processed = processed}
end
```

coroutine内のすべてのchannel操作とスリープはリプレイセーフです。

## タイマー

耐久性のあるタイマーは再起動を乗り越えます：

```lua
local time = require("time")

time.sleep("24h")
time.sleep("5m")
time.sleep("30s")
time.sleep(100 * time.MILLISECOND)
```

経過時間を追跡：

```lua
local start = time.now()
time.sleep("1s")
local elapsed = time.now():sub(start):milliseconds()
```

## 決定論

ワークフローコードは決定論的でなければなりません。同じ入力は同じコマンドシーケンスを生成する必要があります。

### リプレイセーフな操作

以下の操作は自動的にインターセプトされ、結果が記録されます。リプレイ時には記録された値が返されます：

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
local bytes = crypto.random_bytes(32)

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

アクティビティエラーは構造化されたメタデータを持つ：

```lua
local result, err = funcs.call("app:risky_activity", order)
if err then
    print(err:kind())       -- error classification (e.g. "NOT_FOUND", "INTERNAL")
    print(err:retryable())  -- whether the error is retryable
    print(err:message())    -- human-readable error message
end
```

### アクティビティの障害モード

アクティビティ呼び出しのリトライ動作を設定：

```lua
local executor = funcs.new():with_options({
    ["activity.retry_policy"] = {
        maximum_attempts = 1,
    }
})

local result, err = executor:call("app:unreliable_activity", input)
if err then
    local kind = err:kind()         -- "INTERNAL" for runtime errors
    local retryable = err:retryable()
end
```

### 子ワークフローエラー

子ワークフローからのエラー（`process.exec`またはEXITイベント経由）は同じメタデータを持つ：

```lua
local result, err = process.exec("app:error_workflow", "app:worker")
if err then
    print(err:kind())       -- e.g. "NOT_FOUND"
    print(err:retryable())  -- false
    print(err:message())    -- error details
end
```

## 補償パターン（Saga）

```lua
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
        run_compensations(compensations)
        return {status = "failed", step = "payment", error = tostring(err)}
    end
    table.insert(compensations, 1, {
        action = "app:refund_payment",
        args = payment.id
    })

    local shipment, err = funcs.call("app:ship_order", order.shipping)
    if err then
        run_compensations(compensations)
        return {status = "failed", step = "shipping", error = tostring(err)}
    end

    return {status = "completed", tracking = shipment.tracking}
end

local function run_compensations(compensations)
    for _, comp in ipairs(compensations) do
        funcs.call(comp.action, comp.args)
    end
end
```

## 関連項目

- [概要](temporal/overview.md) - クライアントとワーカーの設定
- [アクティビティ](temporal/activities.md) - アクティビティ定義とオプション
- [プロセス](lua/core/process.md) - プロセス管理API
- [関数](lua/core/funcs.md) - 関数呼び出し
- [チャネル](lua/core/channel.md) - チャネル操作
