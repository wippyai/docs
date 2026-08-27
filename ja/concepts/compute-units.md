---
title: "コンピュートユニット"
description: "Wippy の関数、プロセス、ワークフローを、存続期間、状態、通信、障害処理の観点から比較します。"
---

# コンピュートユニット

Wippy にはコードを実行する方法として、関数、プロセス、ワークフローの 3 つがあります。基盤となる仕組みは共通していますが、存続期間、状態の保存先、障害発生時の動作が異なります。

## 関数

関数は呼び出されると実行され、結果を返します。各呼び出しは stateless として扱ってください。durable state や shared state は database または store に置きます。function pool は Lua state を再利用できるため、module global と closure upvalue は worker-local であり、呼び出しをまたぐ信頼できる store にはなりません。

```lua
local funcs = require("funcs")

local result, err = funcs.call("app.math:add", 2, 3)
if err then
    return nil, err
end
```

関数は呼び出し元の context で実行されます。呼び出し元が cancel または終了すると、実行中の関数呼び出しも cancel されます。

<tip>
関数は HTTP handler、data transformation、短時間で完了して結果を返す処理に使います。
</tip>

## プロセス

プロセスは actor です。複数の message にまたがって状態を維持し、起動元とは独立して実行され、message passing で通信します。

```lua
local pid, err = process.spawn("app.workers:handler", "app:processes")
if err then return nil, err end

local ok, send_err = process.send(pid, "job", {task = "process_data"})
if send_err then return nil, send_err end
return ok
```

生成されたプロセスは、作成元のコードとは独立して実行されます。プロセス同士で monitor や link を設定でき、失敗した child を再起動する supervision tree に参加できます。

scheduler は worker pool 上で数千のプロセスを多重化します。各プロセスは I/O の待機中に yield し、他のプロセスを実行可能にします。

<tip>
プロセスは background job、service daemon、作成元より長く存続する処理、message 間で状態を維持する処理に使います。
</tip>

## ワークフロー

ワークフローは、中断から復旧する必要がある durable operation のためのものです。Temporal などの workflow provider が実行履歴を記録し、それを replay して crash、restart、infrastructure の変更後に状態を再構築します。

```lua
-- The provider records this workflow so a worker restart can replay it.
local pid, err = process.spawn("app.orders:process", "app:temporal_worker", order_id)
if err then return nil, err end
return pid
```

workflow operation は記録されるため、durability と引き換えに latency が増えます。multi-step business process や長時間の orchestration など、関数やプロセスの低 latency より recovery が重要な場合にワークフローを使います。

<note>
Wippy はサポート対象の workflow operation を記録し、replay 中にも同じ結果を生成させます。workflow code でも、他の compute unit と同じ Lua 構文を使います。
</note>

## 比較 :id=how-they-compare

| | 関数 | プロセス | ワークフロー |
|---|---|---|---|
| **状態** | 呼び出し内のみ。worker の再利用に依存しない | メモリ内 | 永続化された履歴から再構築 |
| **存続期間** | 単一呼び出し | 終了または crash まで | restart をまたいで存続 |
| **通信** | 戻り値 + message | message passing | activity call + message |
| **障害処理** | 呼び出し元が処理 | supervision tree | provider が復旧。retry は policy に従う |
| **レイテンシー** | 最低 | 低 | 高い |

## 同じコード、異なる動作

多くの module は context に応じて自動的に動作を変えます。たとえば `time.sleep()` は関数とプロセスのどちらでも yield して他の処理を実行可能にします。ワークフローでは provider が timer も記録するため、replay によって 2 つ目の timer が開始されることはありません。
