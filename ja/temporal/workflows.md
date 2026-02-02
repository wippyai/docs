# ワークフロー

ワークフローはアクティビティをオーケストレーションし、障害や再起動をまたいで状態を維持する耐久性のある関数です。`workflow.lua`エントリ種別を使用して定義されます。

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
| `name` | いいえ | カスタムワークフロー名（デフォルトはエントリID） |

## 基本実装

```lua
local funcs = require("funcs")
local time = require("time")

local function main(order)
    -- アクティビティを呼び出し
    local payment, err = funcs.call("app:charge_payment", {
        amount = order.total,
        customer = order.customer_id
    })
    if err then
        return {status = "failed", error = tostring(err)}
    end

    -- 耐久性のあるスリープ（再起動を乗り越える）
    time.sleep("1h")

    -- 別のアクティビティ
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
print(info.workflow_id)    -- ワークフロー実行ID
print(info.run_id)         -- 現在の実行ID
print(info.workflow_type)  -- ワークフロータイプ名
print(info.task_queue)     -- タスクキュー名
print(info.namespace)      -- Temporal名前空間
print(info.attempt)        -- 現在の試行回数
print(info.history_length) -- 履歴イベント数
print(info.history_size)   -- 履歴サイズ（バイト）
```

### workflow.version()

決定論的バージョニングでコード変更を処理：

```lua
local version = workflow.version("payment-v2", 1, 2)

if version == 1 then
    -- 古い動作（既存の実行用）
    result = funcs.call("app:old_payment", input)
else
    -- 新しい動作（バージョン2）
    result = funcs.call("app:new_payment", input)
end
```

パラメータ：
- `change_id` - この変更の一意識別子
- `min_supported` - サポートされる最小バージョン
- `max_supported` - 最大（現在の）バージョン

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

### workflow.history_length()

ワークフロー履歴のイベント数を取得：

```lua
local length = workflow.history_length()
if length > 10000 then
    -- continue-as-newを検討
end
```

### workflow.history_size()

ワークフロー履歴サイズをバイト単位で取得：

```lua
local size = workflow.history_size()
```

### workflow.exec()

子ワークフローを実行：

```lua
local result, err = workflow.exec("app:child_workflow", input_data)
```

## シグナル

プロセスinboxを使用して実行中のワークフローにデータを送信。

**シグナルの送信：**

```lua
process.send(workflow_pid, "approve", {
    approved_by = "admin",
    comment = "Looks good"
})
```

**ワークフローでシグナルを受信：**

```lua
local function main(order)
    local inbox = process.inbox()

    while true do
        local msg = inbox:receive()
        local topic = msg:topic()

        if topic == "approve" then
            local data = msg:payload():data()
            break
        elseif topic == "cancel" then
            local data = msg:payload():data()
            return {status = "cancelled", reason = data.reason}
        end
    end

    return process_order(order)
end
```

## タイマー

耐久性のあるタイマーは再起動を乗り越えます：

```lua
local time = require("time")

time.sleep("24h")
time.sleep("5m")
time.sleep("30s")
```

## 決定論

ワークフローコードは決定論的でなければなりません。同じ入力は同じコマンドシーケンスを生成する必要があります。

### するべきこと

```lua
-- 現在時刻コンテキストにはワークフロー情報を使用
local info = workflow.info()

-- 耐久性のあるスリープを使用
time.sleep("1h")

-- I/Oにはアクティビティを使用
local data = funcs.call("app:fetch_data", id)

-- コード変更にはバージョニングを使用
local v = workflow.version("change-1", 1, 2)
```

### してはいけないこと

```lua
-- 壁時計時刻を使用しない
local now = os.time()  -- 非決定論的

-- ランダムを直接使用しない
local r = math.random()  -- 非決定論的

-- ワークフローコードでI/Oを行わない
local file = io.open("data.txt")  -- 非決定論的

-- グローバル可変状態を使用しない
counter = counter + 1  -- リプレイをまたいで非決定論的
```

## エラー処理

```lua
local function main(order)
    local result, err = funcs.call("app:risky_activity", order)

    if err then
        -- ログして補償
        funcs.call("app:send_alert", {
            error = tostring(err),
            order_id = order.id
        })

        return {status = "failed", error = tostring(err)}
    end

    return {status = "completed", result = result}
end
```

## 補償パターン（Saga）

```lua
local function main(order)
    local compensations = {}

    -- ステップ1: 在庫を予約
    local reservation, err = funcs.call("app:reserve_inventory", order.items)
    if err then
        return {status = "failed", step = "inventory", error = tostring(err)}
    end
    table.insert(compensations, 1, {
        action = "app:release_inventory",
        args = reservation.id
    })

    -- ステップ2: 決済を実行
    local payment, err = funcs.call("app:charge_payment", order.payment)
    if err then
        run_compensations(compensations)
        return {status = "failed", step = "payment", error = tostring(err)}
    end
    table.insert(compensations, 1, {
        action = "app:refund_payment",
        args = payment.id
    })

    -- ステップ3: 注文を発送
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

## ワークフローの起動

任意のコードからワークフローを開始：

```lua
local pid, err = process.spawn(
    "app:order_workflow",    -- ワークフローエントリ
    "app:worker",            -- temporalワーカー
    {order_id = "123"}       -- 入力
)
```

HTTPハンドラから：

```lua
local function handler()
    local req = http.request()
    local order = json.decode(req:body())

    local pid, err = process.spawn(
        "app:order_workflow",
        "app:worker",
        order
    )

    if err then
        return http.response():status(500):json({error = tostring(err)})
    end

    return http.response():json({
        workflow_id = tostring(pid),
        status = "started"
    })
end
```

## 関連項目

- [概要](temporal/overview.md) - 設定
- [アクティビティ](temporal/activities.md) - アクティビティ定義
- [プロセス](lua/core/process.md) - プロセス管理
- [関数](lua/core/funcs.md) - 関数呼び出し
