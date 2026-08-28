---
title: "アクティビティ"
description: "function.luaまたはprocess.luaエントリを、非決定論的な操作を行うTemporalアクティビティとして登録します。"
---

# アクティビティ

Temporalアクティビティは非決定論的な操作を実行します。`function.lua`または`process.lua`エントリを、そのメタデータを通じてアクティビティとして登録します。

各スニペットはAPIレシピです。支払いの例は説明用であり、アプリケーションが所有する環境エントリ、資格情報に対する`env.get`権限、プロバイダーURLに対する`http_client.request`権限、および決済プロバイダーの契約が必要です。

## アクティビティの登録

関数をアクティビティとして登録するには、`meta.temporal.activity`を追加します。

```yaml
- name: charge_payment
  kind: function.lua
  source: file://payment.lua
  method: charge
  modules:
    - env
    - errors
    - http_client
    - json
  meta:
    temporal:
      activity:
        worker: app:worker
```

### メタデータフィールド

| フィールド | 必須 | 説明 |
|-----------|------|------|
| `worker` | はい | `temporal.worker`エントリへの参照 |
| `local` | いいえ | ローカルアクティビティとして実行（デフォルト: false） |

## 実装

アクティビティは通常のLua関数です。Temporalはワークフロー入力を履歴に保存するため、資格情報をワークフロー入力に含めないでください。この例では、アクティビティ内で環境レジストリから支払いキーを読み取ります。プレースホルダーのプロバイダーはJSONの請求リクエストを受け取り、JSONレスポンスを返します。ステータスの対応付けはアプリケーション側のポリシーです。URL、リクエストフィールド、レスポンスフィールド、失敗時の対応付けを、利用するプロバイダーの契約に合わせて置き換えてください。

```lua
-- payment.lua
local http = require("http_client")
local json = require("json")
local env = require("env")
local errors = require("errors")

local function payment_error(status)
    if status == 408 then
        return errors.new({kind = errors.TIMEOUT, message = "payment provider timed out", retryable = true})
    elseif status == 429 then
        return errors.new({kind = errors.RATE_LIMITED, message = "payment provider rate limited the request", retryable = true})
    elseif status >= 500 then
        return errors.new({kind = errors.UNAVAILABLE, message = "payment provider is unavailable", retryable = true})
    end
    return errors.new({kind = errors.INVALID, message = "payment request was rejected", retryable = false})
end

local function charge(input)
    local api_key, env_err = env.get("PAYMENTS_API_KEY")
    if env_err then return nil, env_err end

    local body, encode_err = json.encode({
        amount = input.amount,
        currency = input.currency,
        payment_token = input.payment_token
    })
    if encode_err then
        return nil, encode_err
    end

    local response, err = http.post("https://payments.example.com/v1/charges", {
        headers = {
            ["Authorization"] = "Bearer " .. api_key,
            ["Content-Type"] = "application/json"
        },
        body = body
    })

    if err then
        return nil, err
    end

    if response.status_code >= 400 then
        return nil, payment_error(response.status_code)
    end

    return json.decode(response.body)
end

return { charge = charge }
```

## アクティビティの呼び出し

ワークフローからは`funcs`モジュールを使用します。

```lua
local funcs = require("funcs")

local result, err = funcs.call("app:charge_payment", {
    amount = 5000,
    currency = "usd",
    payment_token = "payment-token-123"
})

if err then
    return nil, err
end
```

## アクティビティオプション

executorビルダーを使用して、タイムアウト、再試行動作、その他の実行パラメータを設定します。

```lua
local funcs = require("funcs")

local executor = funcs.new():with_options({
    ["activity.start_to_close_timeout"] = "30s",
    ["activity.schedule_to_close_timeout"] = "5m",
    ["activity.heartbeat_timeout"] = "10s",
    ["activity.retry_policy"] = {
        maximum_attempts = 3,
        initial_interval = 1000,
        backoff_coefficient = 2.0,
        maximum_interval = 60000,
    }
})

local result, err = executor:call("app:charge_payment", input)
```

executorは不変で再利用できます。一度構築すれば、複数の呼び出しに使用できます。

```lua
local reliable = funcs.new():with_options({
    ["activity.start_to_close_timeout"] = "60s",
    ["activity.retry_policy"] = {
        maximum_attempts = 5,
        initial_interval = 2000,
        backoff_coefficient = 2.0,
        maximum_interval = 120000,
    }
})

local a, err = reliable:call("app:step_one", input)
if err then
    return nil, err
end
local b, err = reliable:call("app:step_two", a)
if err then
    return nil, err
end
```

### オプションリファレンス

| オプション | 型 | デフォルト | 説明 |
|-----------|-----|-----------|------|
| `activity.start_to_close_timeout` | duration | 10m | アクティビティ実行の最大時間 |
| `activity.schedule_to_close_timeout` | duration | - | スケジューリングから完了までの最大時間 |
| `activity.schedule_to_start_timeout` | duration | - | アクティビティ開始までの最大時間 |
| `activity.heartbeat_timeout` | duration | - | ハートビート間の最大時間 |
| `activity.id` | string | - | カスタムアクティビティ実行ID |
| `activity.task_queue` | string | - | この呼び出しのタスクキューをオーバーライド |
| `activity.wait_for_cancellation` | boolean | false | アクティビティキャンセルを待機 |
| `activity.disable_eager_execution` | boolean | false | イーガー実行を無効化 |
| `activity.retry_policy` | table | - | リトライ設定（下記参照） |
| `activity.versioning_intent` | string or number | - | アクティビティに対するワーカーのバージョニング意図 |
| `activity.summary` | string | - | Temporalアクティビティのメタデータに表示される概要 |
| `activity.priority` | table | - | 優先度キーと任意の公平性設定 |
| `activity.name` | string | - | アクティビティ種別名の上書き |

duration値は文字列（`"5s"`、`"10m"`、`"1h"`）またはミリ秒の数値を受け付けます。

新しいコードでは正規の`activity.*`名を使用してください。従来の`temporal.activity.*`エイリアスも互換性のため引き続き受け付けられます。

```lua
local executor = funcs.new():with_options({
    ["activity.summary"] = "Charge the order payment",
    ["activity.priority"] = {
        priority_key = 10,
        fairness_key = "customer-123",
        fairness_weight = 1.0,
    },
    ["activity.name"] = "charge-payment",
    ["activity.versioning_intent"] = "use_assignment_rules",
})
```

### リトライポリシー

失敗したアクティビティの自動再試行動作を設定します。

```lua
["activity.retry_policy"] = {
    initial_interval = 1000,         -- ms before first retry
    backoff_coefficient = 2.0,       -- multiplier for each retry
    maximum_interval = 300000,       -- max interval between retries (ms)
    maximum_attempts = 10,           -- max retry attempts (0 = unlimited)
    non_retryable_error_types = {    -- errors that skip retries
        "Invalid",
        "PermissionDenied"
    }
}
```

| フィールド | 型 | デフォルト | 説明 |
|-----------|-----|-----------|------|
| `initial_interval` | number | 1000 | 最初のリトライまでのミリ秒 |
| `backoff_coefficient` | number | 2.0 | リトライごとに間隔に乗算される係数 |
| `maximum_interval` | number | - | リトライ間隔の上限（ミリ秒） |
| `maximum_attempts` | number | 0 | 最大試行回数（0 = 無制限） |
| `non_retryable_error_types` | array | - | リトライをバイパスするエラー種別 |

### タイムアウトの関係

```
|--- schedule_to_close_timeout --------------------------------|
|--- schedule_to_start_timeout ---|--- start_to_close_timeout -|
     (waiting in queue)                (executing)
```

- `start_to_close_timeout`: アクティビティ本体の実行時間。最も一般的に使用されるタイムアウトです。
- `schedule_to_close_timeout`: アクティビティがスケジュールされてから完了するまでの合計時間。キュー待機時間とリトライを含みます。
- `schedule_to_start_timeout`: ワーカーがアクティビティを取得するまでのタスクキュー内の最大待機時間。
- `heartbeat_timeout`: 長時間実行アクティビティにおけるハートビート報告間の最大時間。

## ローカルアクティビティ

アクティビティでは`local`フィールドを指定できます。

```yaml
- name: validate_input
  kind: function.lua
  source: file://validate.lua
  method: validate
  modules:
    - json
  meta:
    temporal:
      activity:
        worker: app:worker
        local: true
```

現在、`local: true`は解析されますが、通常のアクティビティと同じ動作をします。標準のアクティビティ経路を通じて登録・実行されます。まだ独立したローカルアクティビティ実行はないため、レイテンシー、タスクキューの動作、ハートビートは変わりません。

## アクティビティの命名

アクティビティは、完全なエントリIDを名前として登録されます。

```yaml
namespace: app
entries:
  - name: charge_payment
    kind: function.lua
    # ...
```

アクティビティ名は`app:charge_payment`です。

## コンテキスト伝播

ワークフローをスポーンするときに設定したコンテキスト値は、アクティビティ内で利用できます。

```lua
-- Spawner sets context
local spawner = process.with_context({
    user_id = "user-1",
    tenant = "tenant-1",
})
local pid, err = spawner:spawn("app:order_workflow", "app:worker", order)
if err then
    return nil, err
end
```

```lua
-- Activity reads context
local ctx = require("ctx")

local function process_order(input)
    local user_id, user_err = ctx.get("user_id")   -- "user-1"
    if user_err then return nil, user_err end
    local tenant, tenant_err = ctx.get("tenant")   -- "tenant-1"
    if tenant_err then return nil, tenant_err end
    -- use context for authorization, logging, etc.
end
```

`funcs.new():with_context()`で呼び出したアクティビティにも、コンテキストが伝播されます。

```lua
-- Inside workflow
local executor = funcs.new():with_context({trace_id = "abc-123"})
local result, err = executor:call("app:charge_payment", input)
```

## エラー処理

標準のLuaパターンでエラーを返します。

```lua
local errors = require("errors")

-- Replace this mapping with the payment provider's documented error contract.
local function payment_error(status)
    if status == 408 then
        return errors.new({kind = errors.TIMEOUT, message = "payment provider timed out", retryable = true})
    elseif status == 429 then
        return errors.new({kind = errors.RATE_LIMITED, message = "payment provider rate limited the request", retryable = true})
    elseif status >= 500 then
        return errors.new({kind = errors.UNAVAILABLE, message = "payment provider is unavailable", retryable = true})
    end
    return errors.new({kind = errors.INVALID, message = "payment request was rejected", retryable = false})
end

local function charge(input)
    if not input.amount or input.amount <= 0 then
        return nil, errors.new({ kind = errors.INVALID, message = "amount must be positive" })
    end

    local response, err = http.post(url, options)
    if err then
        return nil, errors.wrap(err, "payment API failed")
    end

    if response.status_code >= 400 then
        return nil, payment_error(response.status_code)
    end

    return json.decode(response.body)
end
```

### エラーオブジェクト

ワークフローに伝播されるアクティビティエラーには、構造化されたメタデータが含まれます。

```lua
local result, err = funcs.call("app:charge_payment", input)
if err then
    err:kind()       -- error classification string
    err:retryable()  -- boolean, whether retry makes sense
    err:message()    -- human-readable error message
end
```

### 障害モード

| 障害 | エラー種別 | リトライ可能 | 説明 |
|------|-----------|------------|------|
| アプリケーションエラー | アクティビティが返したもの | 返されたエラーから継承 | `return nil, err` でアクティビティコードが返したエラー |
| ランタイムクラッシュ | `Internal` | false | アクティビティ内の未処理Luaエラー |
| アクティビティ未登録 | `NotFound` | false | ワーカーに登録されていないアクティビティ |
| タイムアウト | `Timeout` | false | アクティビティが設定されたタイムアウトを超過 |

```lua
local executor = funcs.new():with_options({
    ["activity.retry_policy"] = {maximum_attempts = 1}
})

local result, err = executor:call("app:missing_activity", input)
if err then
    print(err:kind())      -- "NotFound"
    print(err:retryable())  -- false
end
```

## プロセスアクティビティ

`process.lua`エントリも、長時間実行する操作のアクティビティとして登録できます。

```yaml
- name: long_task
  kind: process.lua
  source: file://long_task.lua
  method: main
  modules:
    - http_client
  meta:
    temporal:
      activity:
        worker: app:worker
```

## 関連項目

- [概要](temporal/overview.md) - 設定
- [ワークフロー](temporal/workflows.md) - ワークフローの実装
- [関数](lua/core/funcs.md) - 関数モジュール
- [エラー処理](lua/core/errors.md) - エラーの種別とパターン
