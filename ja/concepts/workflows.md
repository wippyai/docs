---
title: "ワークフロー"
description: "Wippy が長時間実行 workflow を永続化し、execution を replay し、signal を受信し、障害から復旧する仕組み。"
---

# ワークフロー

ワークフローは長時間実行 operation の state を永続化し、crash や restart の後も execution を復旧できるようにします。payment、order fulfillment、multi-step approval などの process に適しています。

## ワークフローを使う理由 :id=why-use-workflows

関数は実行中の state を memory に保持しますが、ワークフローは execution state を永続化します。

| 側面 | 関数 | ワークフロー |
|------|------|-------------|
| State | 呼び出し内のみ | 永続化された履歴から再構築 |
| Worker crash | 実行中の呼び出しが失敗 | 記録済み履歴から replay |
| Duration | 秒から分 | 時間から月 |
| Application failure | 呼び出し元に返す | provider policy に従って終了または retry |

## ワークフローの動作

ワークフローのコードは通常のLuaコードのように見えます：

```lua
local funcs = require("funcs")
local time = require("time")

local result, err = funcs.call("app.api:charge_card", payment)
if err then return nil, err end

time.sleep("24h")

local status, err = funcs.call("app.api:check_status", result.id)
if err then return nil, err end

if status == "failed" then
    local _, refund_err = funcs.call("app.api:refund", result.id)
    if refund_err then return nil, refund_err end
end

return status
```

workflow engine は call を intercept し、結果を記録します。crash 後は記録済み履歴から execution を replay します。

workflow 内では、各 `funcs.call()` target が Temporal activity として実行されます。target の `function.*` entry は `meta.temporal.activity.worker` を介して worker に登録する必要があります。未登録 entry は workflow から利用できません。`process.*` activity target にはさらに、Temporal worker が使う function registry に登録するための `meta.options.default_host`（または legacy の `meta.default_host`）が必要です。function activity の例と activity option は [Activity](../temporal/activities.md)を参照してください。

<note>
workflow author は deterministic code を記述する必要があります。Wippy は workflow module を Deterministic または Workflow に分類されたものに限定し、サポート対象 operation には replay-safe implementation を提供します。<code>funcs.call()</code> は記録される activity を実行し、<code>time.sleep()</code> は workflow timer を使い、<code>uuid.v4()</code> は side effect を記録し、<code>time.now()</code> は workflow の deterministic time reference を読み取ります。
</note>

## ワークフローパターン

### Sagaパターン

失敗時に補償します。

```lua
local funcs = require("funcs")

local inventory, err = funcs.call("app.inventory:reserve", items)
if err then return nil, err end

local payment, err = funcs.call("app.payments:charge", amount)
if err then
    local _, compensation_err = funcs.call("app.inventory:release", inventory.id)
    return nil, compensation_err or err
end

local shipping, err = funcs.call("app.shipping:create", order)
if err then
    local _, refund_err = funcs.call("app.payments:refund", payment.id)
    local _, release_err = funcs.call("app.inventory:release", inventory.id)
    return nil, refund_err or release_err or err
end

return {inventory = inventory, payment = payment, shipping = shipping}
```

### Signal の待機 :id=waiting-for-signals

外部 event（approval decision、webhook、user action）を待ちます。

```lua
local funcs = require("funcs")

local _, err = funcs.call("app.approvals:submit", request)
if err then return nil, err end

local inbox = process.inbox()
local msg, open = inbox:receive()  -- blocks until signal arrives
if not open then return nil, errors.new("workflow inbox closed") end

local decision, payload_err = msg:payload():data()
if payload_err then return nil, payload_err end

if decision.approved then
    return funcs.call("app.orders:fulfill", request.order_id)
else
    return funcs.call("app.notifications:send_rejection", request)
end
```

## Compute model の選択 :id=choosing-a-compute-model

| ユースケース | 選択 |
|-------------|------|
| HTTP request 処理 | 関数 |
| Data transformation | 関数 |
| Background job | プロセス |
| User session state | プロセス |
| Real-time messaging | プロセス |
| Payment 処理 | ワークフロー |
| Order fulfillment | ワークフロー |
| 複数日にわたる approval | ワークフロー |

## ワークフローの開始

ワークフローでは、workflow host を指定して `process.spawn()` を使います。

```lua
-- Spawn workflow on temporal worker
local pid, err = process.spawn("app.workflows:order_processor", "app:temporal_worker", order_data)
if err then return nil, err end

-- Send signals to workflow
local ok, err = process.send(pid, "update", {status = "approved"})
if err then return nil, err end
return ok
```

呼び出し元は同じ生成 API を使います。エントリが `temporal.worker` と `process.host` のどちらで実行されるかはホストが決定します。永続化された履歴と再生が適用されるのは、Temporal でホストされる経路だけです。通常のプロセスホストで実行したワークフローエントリはメモリ内プロセスのセマンティクスとなり、Temporal の永続性は得られません。

<tip>
workflow が <code>process.spawn()</code> で child を生成すると、同じ provider 上の child workflow となり、durability guarantee が維持されます。
</tip>

## 障害とスーパービジョン

プロセスは`process.service`を使用して監督されたサービスとして実行できます：

```yaml
# Process definition
- name: session_handler
  kind: process.lua
  source: file://session_handler.lua
  method: main

# Supervised service wrapping the process
- name: session_manager
  kind: process.service
  process: app:session_handler
  host: app:processes
  lifecycle:
    auto_start: true
    restart:
      max_attempts: 10
```

ワークフローは process supervision tree を使いません。workflow provider が persistence と recovery を管理し、application-level retry は設定済みの workflow policy と activity policy に従います。

## 設定

プロセス定義（動的に生成）：

```yaml
- name: order_processor
  kind: workflow.lua
  source: file://order_processor.lua
  method: main
  meta:
    temporal:
      workflow:
        worker: app:temporal_worker
  modules:
    - funcs
    - time
```

`funcs.call()` から呼び出すすべての function または process も activity worker を宣言します。例:

```yaml
- name: charge_card
  kind: function.lua
  source: file://charge_card.lua
  method: main
  meta:
    temporal:
      activity:
        worker: app:temporal_worker
```

ワークフロープロバイダ：

```yaml
- name: temporal_worker
  kind: temporal.worker
  client: app:temporal_client
  task_queue: "orders"
  lifecycle:
    auto_start: true
```

production workflow infrastructure については [Temporal](https://temporal.io)を参照してください。

## 関連項目 :id=see-also

- [関数](concepts/functions.md) — request-scoped call
- [プロセスモデル](concepts/process-model.md) — stateful background work
- [スーパービジョン](guides/supervision.md) — process restart policy
