# ワークフロー

ワークフローは、クラッシュや再起動を乗り越える耐久性のある長時間実行操作です。決済、注文処理、複数ステップの承認など、重要なビジネスプロセスに信頼性の保証を提供します。

## なぜワークフローか？

関数は一時的なものです。ホストがクラッシュすると、進行中の作業は失われます。ワークフローは状態を永続化します：

| 側面 | 関数 | ワークフロー |
|------|------|-------------|
| 状態 | メモリ内 | 永続化 |
| クラッシュ | 作業消失 | 再開 |
| 期間 | 秒から分 | 時間から月 |
| 完了 | ベストエフォート | 保証 |

## ワークフローの動作

ワークフローのコードは通常のLuaコードのように見えます：

```lua
local funcs = require("funcs")
local time = require("time")

local result = funcs.call("app.api:charge_card", payment)
time.sleep("24h")
local status = funcs.call("app.api:check_status", result.id)

if status == "failed" then
    funcs.call("app.api:refund", result.id)
end
```

ワークフローエンジンは呼び出しをインターセプトし、結果を記録します。プロセスがクラッシュすると、履歴から実行がリプレイされます。同じコード、同じ結果です。

<note>
Wippyは決定論を自動的に処理します。<code>funcs.call()</code>、<code>time.sleep()</code>、<code>uuid.v4()</code>、<code>time.now()</code>などの操作はインターセプトされ、結果が記録されます。リプレイ時には、再実行せずに記録された値が返されます。
</note>

## ワークフローパターン

### Sagaパターン

失敗時に補償：

```lua
local funcs = require("funcs")

local inventory = funcs.call("app.inventory:reserve", items)
if inventory.error then
    return nil, inventory.error
end

local payment = funcs.call("app.payments:charge", amount)
if payment.error then
    funcs.call("app.inventory:release", inventory.id)
    return nil, payment.error
end

local shipping = funcs.call("app.shipping:create", order)
if shipping.error then
    funcs.call("app.payments:refund", payment.id)
    funcs.call("app.inventory:release", inventory.id)
    return nil, shipping.error
end

return {inventory = inventory, payment = payment, shipping = shipping}
```

### シグナルの待機

外部イベント（承認決定、Webhook、ユーザーアクション）を待機：

```lua
local funcs = require("funcs")

funcs.call("app.approvals:submit", request)

local inbox = process.inbox()
local msg = inbox:receive()  -- シグナルが到着するまでブロック

if msg.approved then
    funcs.call("app.orders:fulfill", request.order_id)
else
    funcs.call("app.notifications:send_rejection", request)
end
```

## いつ何を使うか

| ユースケース | 選択 |
|-------------|------|
| HTTPリクエスト処理 | 関数 |
| データ変換 | 関数 |
| バックグラウンドジョブ | プロセス |
| ユーザーセッション状態 | プロセス |
| リアルタイムメッセージング | プロセス |
| 決済処理 | ワークフロー |
| 注文処理 | ワークフロー |
| 複数日にわたる承認 | ワークフロー |

## ワークフローの開始

ワークフローはプロセスと同じ方法で生成されます。`process.spawn()`を異なるホストで使用します：

```lua
-- temporal workerでワークフローを生成
local pid = process.spawn("app.workflows:order_processor", "app:temporal_worker", order_data)

-- ワークフローにシグナルを送信
process.send(pid, "update", {status = "approved"})
```

呼び出し元の観点からは、APIは同一です。違いはホストです：ワークフローは`process.host`ではなく`temporal.worker`で実行されます。

<tip>
ワークフローが<code>process.spawn()</code>を介して子を生成すると、それらは同じプロバイダ上の子ワークフローとなり、耐久性の保証を維持します。
</tip>

## 障害とスーパービジョン

プロセスは`process.service`を使用して監督されたサービスとして実行できます：

```yaml
# プロセス定義
- name: session_handler
  kind: process.lua
  source: file://session_handler.lua
  method: main

# プロセスをラップする監督されたサービス
- name: session_manager
  kind: process.service
  process: app:session_handler
  host: app:processes
  lifecycle:
    auto_start: true
    restart:
      max_attempts: 10
```

ワークフローはスーパービジョンツリーを使用しません。ワークフロープロバイダ（Temporal）によって自動的に管理されます。プロバイダは永続化、リトライ、リカバリを処理します。

## 設定

プロセス定義（動的に生成）：

```yaml
- name: order_processor
  kind: workflow.lua
  source: file://order_processor.lua
  method: main
  modules:
    - funcs
    - time
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

本番ワークフローインフラストラクチャについては[Temporal](https://temporal.io)を参照してください。

## 関連項目

- [関数](concept-functions.md) - ステートレスなリクエスト処理
- [プロセスモデル](concept-process-model.md) - ステートフルなバックグラウンド作業
- [スーパービジョン](guide-supervision.md) - プロセス再起動ポリシー
