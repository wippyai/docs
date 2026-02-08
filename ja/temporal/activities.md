# アクティビティ

アクティビティは非決定論的な操作を実行する関数です。任意の`function.lua`または`process.lua`エントリはメタデータを追加することでTemporalアクティビティとして登録できます。

## アクティビティの登録

関数をアクティビティとして登録するには`meta.temporal.activity`を追加：

```yaml
- name: charge_payment
  kind: function.lua
  source: file://payment.lua
  method: charge
  modules:
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

アクティビティは通常のLua関数です：

```lua
-- payment.lua
local http = require("http_client")
local json = require("json")

local function charge(input)
    local response, err = http.post("https://api.stripe.com/v1/charges", {
        headers = {
            ["Authorization"] = "Bearer " .. input.api_key,
            ["Content-Type"] = "application/json"
        },
        body = json.encode({
            amount = input.amount,
            currency = input.currency,
            source = input.token
        })
    })

    if err then
        return nil, err
    end

    return json.decode(response:body())
end

return { charge = charge }
```

## アクティビティの呼び出し

ワークフローから`funcs`モジュールを使用：

```lua
local funcs = require("funcs")

local result, err = funcs.call("app:charge_payment", {
    amount = 5000,
    currency = "usd",
    token = "tok_visa",
    api_key = ctx.stripe_key
})

if err then
    return nil, err
end
```

## アクティビティオプション

executor ビルダーを使用して、タイムアウト、リトライ動作、その他の実行パラメータを設定：

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

executor は不変で再利用可能です。一度構築すれば複数の呼び出しに使用できます：

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
local b, err = reliable:call("app:step_two", a)
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

duration値は文字列（`"5s"`、`"10m"`、`"1h"`）またはミリ秒の数値を受け付けます。

### リトライポリシー

失敗したアクティビティの自動リトライ動作を設定：

```lua
["activity.retry_policy"] = {
    initial_interval = 1000,         -- ms before first retry
    backoff_coefficient = 2.0,       -- multiplier for each retry
    maximum_interval = 300000,       -- max interval between retries (ms)
    maximum_attempts = 10,           -- max retry attempts (0 = unlimited)
    non_retryable_error_types = {    -- errors that skip retries
        "INVALID",
        "PERMISSION_DENIED"
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

ローカルアクティビティはワークフローワーカープロセス内で、別のタスクキューポーリングなしで実行されます：

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

特性：
- ワークフローワーカープロセス内で実行
- 低レイテンシー（タスクキューのラウンドトリップなし）
- 別のタスクキューオーバーヘッドなし
- 短い実行時間に限定
- ハートビートなし

入力バリデーション、データ変換、キャッシュルックアップなどの高速で短い操作にローカルアクティビティを使用します。

## アクティビティの命名

アクティビティはフルエントリIDを名前として登録されます：

```yaml
namespace: app
entries:
  - name: charge_payment
    kind: function.lua
    # ...
```

アクティビティ名：`app:charge_payment`

## コンテキスト伝播

ワークフローのスポーン時に設定されたコンテキスト値はアクティビティ内で利用可能です：

```lua
-- Spawner sets context
local spawner = process.with_context({
    user_id = "user-1",
    tenant = "tenant-1",
})
local pid = spawner:spawn("app:order_workflow", "app:worker", order)
```

```lua
-- Activity reads context
local ctx = require("ctx")

local function process_order(input)
    local user_id = ctx.get("user_id")   -- "user-1"
    local tenant = ctx.get("tenant")     -- "tenant-1"
    -- use context for authorization, logging, etc.
end
```

`funcs.new():with_context()`で呼び出されたアクティビティもコンテキストを伝播します：

```lua
-- Inside workflow
local executor = funcs.new():with_context({trace_id = "abc-123"})
local result, err = executor:call("app:charge_payment", input)
```

## エラー処理

標準のLuaパターンでエラーを返す：

```lua
local errors = require("errors")

local function charge(input)
    if not input.amount or input.amount <= 0 then
        return nil, errors.new("INVALID", "amount must be positive")
    end

    local response, err = http.post(url, options)
    if err then
        return nil, errors.wrap(err, "payment API failed")
    end

    if response:status() >= 400 then
        return nil, errors.new("FAILED", "payment declined")
    end

    return json.decode(response:body())
end
```

### エラーオブジェクト

ワークフローに伝播されるアクティビティエラーは構造化されたメタデータを持つ：

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
| アプリケーションエラー | 可変 | 可変 | アクティビティコードが返したエラー |
| ランタイムクラッシュ | `INTERNAL` | はい | アクティビティ内の未処理Luaエラー |
| アクティビティ未登録 | `NOT_FOUND` | いいえ | ワーカーに登録されていないアクティビティ |
| タイムアウト | `TIMEOUT` | はい | アクティビティが設定されたタイムアウトを超過 |

```lua
local executor = funcs.new():with_options({
    ["activity.retry_policy"] = {maximum_attempts = 1}
})

local result, err = executor:call("app:missing_activity", input)
if err then
    print(err:kind())      -- "NOT_FOUND"
    print(err:retryable())  -- false
end
```

## プロセスアクティビティ

`process.lua`エントリも長時間実行操作用にアクティビティとして登録可能：

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
- [ワークフロー](temporal/workflows.md) - ワークフロー実装
- [関数](lua/core/funcs.md) - 関数モジュール
- [エラー処理](lua/core/errors.md) - エラータイプとパターン
