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

### アクティビティオプション

タイムアウトとリトライ動作を設定：

```lua
local funcs = require("funcs")

local executor = funcs.new()
executor = executor:with_options({
    start_to_close_timeout = "30s",
    schedule_to_close_timeout = "5m",
    heartbeat_timeout = "10s",
    retry_policy = {
        max_attempts = 3,
        initial_interval = "1s",
        backoff_coefficient = 2.0,
        max_interval = "1m"
    }
})

local result, err = executor:call("app:charge_payment", input)
```

## ローカルアクティビティ

ローカルアクティビティはワークフローワーカープロセス内で実行され、別のタスクキューポーリングなしで動作します。高速で短い操作に使用：

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
- 低レイテンシー
- 別のタスクキューオーバーヘッドなし
- 短い実行時間に限定
- ハートビートなし

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

## エラー処理

標準のLuaパターンでエラーを返す：

```lua
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

## プロセスアクティビティ

`process.lua`エントリもアクティビティとして登録できます：

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
