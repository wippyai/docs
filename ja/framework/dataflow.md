---
title: "Dataflow"
description: "Wippy Dataflow のノード、ルーティング、制御フロー、永続ワークフローを使って DAG ワークフローを構成し、実行します。"
---

# Dataflow

`wippy/dataflow` モジュールは、有向非巡回グラフ（DAG）のワークフローをオーケストレーションします。関数、エージェント、サイクル、並列プロセッサなどのノードが、名前付きで discriminator をキーにするルートを通じてデータを交換し、オーケストレーターが実行、永続状態、復旧を管理します。

このページは概念例とリファレンス例を含む API 入門であり、単独で実行するチュートリアルではありません。`task`、`config`、`file_list` などの値と、`app:tokenize`、`app:worker` などの ID は、アプリケーションが提供するデータやレジストリエントリを表します。スニペットは[セットアップ](#セットアップ)で説明する永続化データベースとプロセスホストも前提とします。完全に実行できるプロジェクトは、[Dataflow ワークフローを構築する](../tutorials/dataflow.md)に従ってください。

## セットアップ

モジュールをプロジェクトに追加します。

```bash
wippy add wippy/dataflow
wippy install
```

依存関係を宣言します。

```yaml
version: "1.0"
namespace: app

entries:
  - name: dep.dataflow
    kind: ns.dependency
    component: wippy/dataflow
    version: "*"
```

Dataflow モジュールは `wippy/agent`、`wippy/llm`、`wippy/session`、`wippy/test`、`wippy/migration` に依存し、`wippy install` がそれらを解決します。既定ではワークフロー永続化に `app:db`、wake サービスに `app:processes` を使用します。これらのエントリを用意するか、`target_db` と `process_host` の要件を上書きしてください。Dataflow のマイグレーションは `wippy/migration` を通じて実行されます。

モジュールは `userspace.dataflow.env:web_host_origin` という `env.variable` エントリ（既定値 `https://front.wippy.ai`）を公開します。下流のフローは公開 URL の構築にこの値を読み取れます。env ルーターまたは requirement で上書きしてください。

## Flow Builder

Flow Builder はワークフローを構成する fluent インターフェースです。エントリにインポートします。

```yaml
imports:
  flow: userspace.dataflow.flow:flow
```

```lua
local flow = require("flow")
```

### コア API

```lua
flow.create()
    :with_title(title)
    :with_metadata(metadata)
    :with_input(data)
    :with_data(data)
    :[operation](config)
    :as(name)
    :to(target, input_key, transform)
    :error_to(target, input_key, transform)
    :when(condition)
    :run()   -- synchronous
    :start() -- asynchronous

flow.template()
    :[operations]...
```

### 線形パイプライン

明示的なルーティングがなければノードは自動的に連結され、各ノードの出力が次のノードへ流れます。

```lua
local result, err = flow.create()
    :with_input({ text = "Hello world" })
    :func("app:tokenize")
    :func("app:translate", { args = { target_lang = "fr" } })
    :func("app:format_output")
    :run()
```

### 名前付きルーティング

`:as()` でノードに名前を付け、`:to()` でノード間のデータをルーティングします。`:as()` はそのノードを参照する必要がある場合にだけ使います。

```lua
local result, err = flow.create()
    :with_input(task)
        :to("router")

    :func("app:router"):as("router")
        :to("context", "routing")
        :to("dev", "routing")

    :agent("app:context_agent"):as("context")
        :to("dev", "gathered_context")

    :agent("app:dev_agent"):as("dev")
        :to("@success")

    :run()
```

`:to()` の第 2 引数は **discriminator**、つまり受信ノード側の入力キーです。ノードが複数入力を受け取ると、それらは discriminator をキーとするテーブルにまとめられます。

### ワークフロー入力と静的データ

`:with_input()` はワークフローへの単一の主入力です。`:with_data()` は独立した静的データソースを作成します。

```lua
flow.create()
    :with_input(task)
        :to("router")

    :with_data(config):as("cfg")
        :to("dev", "config")
        :to("logger", "config")

    :with_data(branch):as("branch_data")
        :to("checker", "branch")

    :func("app:router"):as("router")
        :to("dev", "task")

    :func("app:dev"):as("dev")
        :to("@success")
        :error_to("@fail")

    :run()
```

ワークフローに入る外部データには `:with_input()` を使用します。複数ノードで共有する設定、定数、参照データには `:with_data()` を使用します。静的データには参照最適化が働き、最初のルートが実データを作成し、それ以降のルートは軽量な参照を作成します。

### 条件付きルーティング

`:to()` の後に `:when()` を使って条件を追加します。条件は `expr` 構文でノード出力を評価します。

```lua
flow.create()
    :with_input(data)
    :func("app:classify"):as("classify")
        :to("handler_a"):when("output.category == 'a'")
        :to("handler_b"):when("output.category == 'b'")
        :to("fallback")
    :func("app:handler_a"):as("handler_a"):to("@success")
    :func("app:handler_b"):as("handler_b"):to("@success")
    :func("app:fallback"):as("fallback"):to("@success")
    :run()
```

条件とインライン変換を組み合わせると、より複雑なルーティングを構成できます。

```lua
:func("app:decompose"):as("decompose")
    :to("@success", nil, "{passed: true, feedback: nil}"):when("len(output.items) == 0")
    :to("processor", "items", "output.items")
```

条件式では、比較（`output.score > 0.8`）、論理演算子（`output.valid && output.count > 5`）、配列関数（`len(output.items) > 0`、`any(output.errors, {.critical})`）、文字列操作（`output.status contains 'success'`）、optional chaining（`output.data?.nested?.value`）を使用できます。

### ワークフロー終端

`@success` または `@fail` へルーティングすると、ワークフローを明示的に終了します。ネストされたコンテキスト（サイクル、並列処理）では、終端はワークフロー出力ではなくノード出力を作成します。

```lua
:func("app:final_step"):to("@success")
:func("app:handler"):error_to("@fail")
```

### エラールーティング

`:error_to()` でノードエラーをハンドラーへルーティングします。エラーは通常の入力として復旧ノードへ渡せます。

```lua
:agent("app:gpt_planner", { model = "gpt-5" }):as("gpt_planner")
    :to("consolidator", "gpt_plan")
    :error_to("consolidator", "gpt_plan")

:agent("app:claude_planner", { model = "claude-4-5-sonnet" }):as("claude_planner")
    :to("consolidator", "claude_plan")
    :error_to("consolidator", "claude_plan")

:agent("app:consolidator", {
    inputs = { required = { "gpt_plan", "claude_plan" } }
}):as("consolidator")
```

このパターンは 2 つの planner を並列実行します。一方が失敗すると、そのエラーが consolidator の入力となり、利用できる結果だけで処理を続行します。

## 入力のマージ

ノードが入力を受け取る形は、discriminator と `args` の設定有無で決まります。

**args なし — 単一の default 入力:**

```lua
:func("source"):to("target")
-- target receives: raw content (unwrapped)
```

**args なし — 単一の名前付き入力:**

```lua
:func("source"):to("target", "task")
-- target receives: { task = content }
```

**args なし — 複数入力:**

```lua
:func("source1"):to("target", "data")
:func("source2"):to("target", "config")
-- target receives: { data = content1, config = content2 }
```

**args あり — 入力をベースへマージ:**

```lua
:func("app:api_client", {
    args = { base_url = "https://api.com", timeout = 5000 }
})
-- with :to("api_client", "body") from upstream
-- api_client receives: { base_url = "https://api.com", timeout = 5000, body = content }
```

<note>
<code>args</code> または文字列形式の <code>input_transform</code> を持つノードは、<code>"default"</code> discriminator の入力を受け取れません。代わりに <code>:to(target, "input_key")</code> で名前付き discriminator を使用してください。
</note>

## 入力変換

ノードへ到達する前にデータを変換します。

```lua
-- String transform: single expression
:func("app:step", { input_transform = "input.nested.field" })

-- Table transform: named expressions
:func("app:step", {
    input_transform = {
        task = "inputs.task",
        config = "inputs.settings",
        priority = "output.score > 0.8 ? 'high' : 'normal'"
    }
})
```

変換で利用できるコンテキスト変数は、`input`（ワークフロー入力）、`inputs`（ノードへの全入力）、`output`（ルーティング時の現在ノード出力）です。

### インラインルート変換

`:to()` の第 3 引数はインライン変換式です。

```lua
:func("source"):as("source")
    :to("target", nil, "output.data")
    :to("other", nil, "{passed: true, value: output.x}")
    :to("list", nil, "map(output.items, {.id})")
```

## ノード種別

### Function ノード

登録済みの `function.lua` エントリを実行します。

```lua
:func("app:my_function", {
    args = { key = "value" },
    inputs = { required = { "task", "config" } },
    context = { session_id = "abc" },
    input_transform = { task = "inputs.prompt" },
    metadata = { title = "Process Data" }
})
```

| オプション | 型 | 説明 |
|--------|------|-------------|
| `args` | table | ノード入力とマージするベース引数 |
| `inputs` | table | 入力要件: `{ required = {...}, optional = {...} }` |
| `context` | table | 関数へ渡す実行コンテキスト |
| `input_transform` | string/table | 入力を変換する式 |
| `metadata` | table | ノードメタデータ（例: `{ title = "..." }`） |

関数が `{ _control = { commands = [...] } }` を返すと、オーケストレーターは子ワークフローを生成します。ネストされたフローはこの仕組みで動作します。

### Agent ノード

ツール呼び出しと任意の構造化終了を持つエージェントを実行します。

```lua
:agent("app:content_writer", {
    model = "gpt-5",
    inputs = { required = { "context", "content_plan", "analysis" } },
    arena = {
        prompt = "Write content based on the provided context.",
        max_iterations = 12,
        tool_calling = "any",
        exit_schema = {
            type = "object",
            properties = {
                content = { type = "string" },
                title = { type = "string" }
            },
            required = { "content", "title" }
        }
    },
    show_tool_calls = true,
    metadata = { title = "Content Writer" }
})
```

| オプション | 型 | 説明 |
|--------|------|-------------|
| `model` | string | モデルを上書き |
| `arena.prompt` | string | システムプロンプト |
| `arena.max_iterations` | number | 推論ループの最大回数（既定 64） |
| `arena.min_iterations` | number | 終了前の最小反復回数（既定 1） |
| `arena.tool_calling` | string | `"auto"`、`"any"`（`exit_schema` が必要）、`"none"`（`exit_schema` を拒否） |
| `arena.tools` | array | ツールのレジストリ ID |
| `arena.exit_schema` | table | 構造化終了用の JSON Schema |
| `arena.exit_func_id` | string | 終了出力を検証する関数 |
| `arena.context` | table | 追加コンテキスト |
| `inputs` | table | 入力要件 |
| `active_traits` | array | 選択したエージェントの有効 trait を上書き。空配列でこのノードでは無効化 |
| `active_tools` | array | 選択したエージェントの有効ツールを上書き。空配列でこのノードでは無効化 |
| `show_tool_calls` | boolean | 出力にツール呼び出しを含める |
| `input_transform` | string/table | 入力を変換 |
| `metadata` | table | ノードメタデータ |

**動的なエージェント選択:** エージェント ID に空文字列を渡し、`input_transform` で解決します。

```lua
:agent("", {
    inputs = { required = { "spec", "task" } },
    input_transform = {
        agent_id = "inputs.spec.agent_id",
        task = "inputs.task"
    },
    arena = {
        prompt = "Process according to spec",
        max_iterations = 25
    }
})
```

**終了検証:** `exit_func_id` を設定すると、その関数がエージェントの終了出力を検証します。検証失敗時はエージェントがエラーを observation として受け取り、`max_iterations` まで続行します。

### Cycle ノード

永続状態を引き継ぎながら、関数またはテンプレートを繰り返し実行します。

```lua
:cycle({
    func_id = "app:content_cycle",
    max_iterations = 3,
    initial_state = {
        entry_id = entry_id,
        content_prompt = prompt,
        task = task,
        min_score = 8.0,
        feedback_history = {}
    }
})
```

サイクル関数は各反復で次の値を受け取ります。

```lua
{
    input = <workflow_input>,  -- only on the first iteration (iteration == 1); nil thereafter
    state = <accumulated_state>,
    last_result = <previous_iteration_output>,
    iteration = <current_iteration_number>
}
```

関数が継続を制御します。

```lua
function my_cycle(cycle_context)
    -- stop if approved
    if cycle_context.last_result and cycle_context.last_result.approved then
        return {
            state = cycle_context.state,
            result = cycle_context.last_result,
            continue = false
        }
    end

    -- spawn child workflow for this iteration
    -- task is read from state since cycle_context.input is nil after iteration 1
    return flow.create()
        :with_input({ task = cycle_context.state.task })
        :agent("app:worker")
        :agent("app:qa")
        :run()
end
```

| オプション | 型 | 説明 |
|--------|------|-------------|
| `func_id` | string | 反復関数（`template` と排他） |
| `template` | FlowBuilder | 各反復のテンプレート（`func_id` と排他） |
| `max_iterations` | number | 最大反復回数（既定 100） |
| `initial_state` | table | 初期状態（既定 `{}`） |
| `continue_condition` | string | true の間継続する式 |
| `inputs` | table | 入力要件 |
| `context` | table | サイクル関数へ渡す実行コンテキスト |
| `input_transform` | string/table | サイクルが受け取る前に入力を変換 |
| `metadata` | table | ノードメタデータ |

**テンプレートベースのサイクル:**

```lua
:cycle({
    template = flow.template()
        :agent("app:worker")
        :func("app:validator"),
    max_iterations = 5
})
```

### Parallel ノード

配列に対する map-reduce パターンです。

```lua
:parallel({
    inputs = { required = { "specs", "task" } },
    source_array_key = "specs",
    iteration_input_key = "spec",
    passthrough_keys = { "task" },
    batch_size = 10,
    scheduling = "rolling",
    on_error = "continue",
    filter = "successes",
    unwrap = true,
    template = flow.template()
        :agent("app:processor", {
            inputs = { required = { "spec", "task" } },
            input_transform = {
                agent_id = "inputs.spec.agent_id",
                task = "inputs.task"
            },
            arena = {
                prompt = "Process according to spec",
                max_iterations = 25
            }
        })
        :to("@success"),
    metadata = { title = "Process Specs" }
})
```

| オプション | 型 | 説明 |
|--------|------|-------------|
| `source_array_key` | string | 空でない配列を含む入力キー（必須） |
| `template` | FlowBuilder | 各項目のテンプレート（必須、`@success` へルーティングすること） |
| `iteration_input_key` | string | 現在項目の入力キー（既定 `"default"`） |
| `batch_size` | number | 1 から 1000 の正の整数。同時実行項目の最大数（既定 1） |
| `scheduling` | string | `"batch"`（既定）は波全体を待機。`"rolling"` は完了枠を補充し、`on_error = "continue"` が必要 |
| `on_error` | string | `"continue"`（既定）または `"fail_fast"`。`"collect_errors"` は `"continue"` の互換別名 |
| `filter` | string | `"all"`（既定）、`"successes"`、`"failures"` |
| `unwrap` | boolean | ラップ済みメタデータではなく生の結果を返す（既定 false） |
| `passthrough_keys` | array | 各反復へ転送する入力キー |
| `inputs` | table | 入力要件 |
| `input_transform` | string/table | 並列処理前に入力を変換 |
| `metadata` | table | ノードメタデータ |

**passthrough key** は、ソース配列内でデータを複製せずに、設定やタスク説明などの共有コンテキストを各反復へ渡します。

```lua
:with_data(file_list):as("files"):to("processor", "files")
:with_data("secret"):as("api_key"):to("processor", "api_key")

:parallel({
    inputs = { required = { "files", "api_key" } },
    source_array_key = "files",
    iteration_input_key = "filename",
    passthrough_keys = { "api_key" },
    template = flow.template()
        :func("app:upload", {
            inputs = { required = { "filename", "api_key" } }
        })
        :to("@success")
}):as("processor")
```

### Signal ノード

外部シグナルが届くまで実行を一時停止します。人による承認、外部イベント、段階的なワークフローに使用します。

```lua
:signal({
    signal_id = "approval",
    inputs = { required = { "draft" } },
    metadata = { title = "Wait for approval" }
})
```

| オプション | 型 | 説明 |
|--------|------|-------------|
| `signal_id` | string | `client:signal()` と照合するシグナル名。空または省略時はランタイムが UUID v7 を生成 |
| `timeout` | string/number | 正の duration 文字列または正の有限ミリ秒。期限切れ時は `{ timeout = true, code = "SIGNAL_TIMEOUT" }` を出力 |
| `inputs` | table | 入力要件 |
| `input_transform` | string/table | ノードが受け取る前に入力を変換 |
| `metadata` | table | ノードメタデータ |

クライアント API を使ってワークフロー外部からシグナルを送信します（後述の `client:signal()` を参照）。

#### 動作

ノードは `wait_for_signal = true` で yield し、その yield をワークフロー状態に永続化します。一致する `NODE_SIGNAL` コミットが到着すると、オーケストレーターがノードを再開します。

- `client:signal()` は、省略、`nil`、`false` のデータを `{}` として保存します。この空オブジェクトと、保持される `0` や `""` などの値は yield を満たします。
- シグナル yield は `COMPLETE_WORKFLOW` をブロックしますが、ほかの pending ノードはブロックしません。一方のブランチが待機中でも並列ブランチは実行を続けます。
- `client:signal()` はシグナルを永続キューへ追加し、ワークフローのアクティベーションを要求します。ノードが yield に到達する前にシグナルが届いた場合、その yield が追跡された時点で配信されます。別途 `:start()` を呼ぶ必要はありません。
- 各 yield を満たすシグナルは 1 つだけです。yield が満たされる前に同じ `signal_id` の 2 つ目のシグナルが届くと、最初のシグナルを上書きします。
- 複数のアクティブな yield が同じ `signal_id` を共有する場合、一致する yield の 1 つがデータを受け取ります。どれになるかは未定義です。受信先が重要なら一意の ID を使用してください。
- `signal_id` を省略すると、builder が返さない UUID v7 が生成されます。クライアント API から配信するシグナルには、明示的で安定した ID を設定してください。
- 配信されたシグナルデータは、シグナルペイロードとしてノード出力へ渡されます。

#### 耐久性と復旧

シグナル yield はワークフロー状態の一部であり、ほかのコマンドと同じ outbox 仕組みで永続化されます。待機中にオーケストレータープロセスが停止した場合:

- pending yield は再起動時に復元されます。
- 停止中に配信されたシグナルはキューに入り、状態の再読み込み時に適用されます。
- 複合パイプライン（`func → signal → signal → func`）は段階ごとに復旧し、各シグナルは別々の再起動をまたいで配信できます。

親プロセスが完了せず終了した孤立シグナル yield は、ワークフロー状態のプロセス終了ハンドラーがクリーンアップします。

#### パイプラインパターン

シグナルノードは任意のトポロジーに参加できます。上記の `flow` インポートと並べて client binding を追加してください。

```yaml
imports:
  client: userspace.dataflow:client
```

```lua
local client = require("client")
local c, client_err = client.new()
if client_err then return nil, client_err end

-- Human-in-the-loop approval between two functions
local approval_id, start_err = flow.create()
    :with_input({ draft_id = "draft-123" })
    :func("app:draft")
    :signal({ signal_id = "approve_draft" })
    :func("app:publish")
    :start()
if start_err then return nil, start_err end

local _, signal_err = c:signal(approval_id, "approve_draft", { approved = true })
if signal_err then return nil, signal_err end

-- Two parallel approvals that must both arrive before release
local release_id, release_err = flow.create()
    :with_input({ doc = "release-notes" })
        :as("trigger")
        :to("legal", "doc")
        :to("finance", "doc")

    :signal({ signal_id = "legal_ok", inputs = { required = { "doc" } } })
        :as("legal")
        :to("gate", "legal")

    :signal({ signal_id = "finance_ok", inputs = { required = { "doc" } } })
        :as("finance")
        :to("gate", "finance")

    :join({ inputs = { required = { "legal", "finance" } } })
        :as("gate")
        :to("release")

    :func("app:release"):as("release"):to("@success")
    :start()
if release_err then return nil, release_err end

local _, legal_err = c:signal(release_id, "legal_ok", { approved_by = "legal" })
if legal_err then return nil, legal_err end

local _, finance_err = c:signal(release_id, "finance_ok", { approved_by = "finance" })
if finance_err then return nil, finance_err end
```

保存されたシグナルデータはノード出力として公開されます。下流ノードは送信されたペイロードを受け取りますが、省略、`nil`、`false` のデータは `{}` に正規化されます。

### Join ノード

複数の入力を収集してから処理を進めます。

```lua
:join({
    inputs = { required = { "source1", "source2" } },
    output_mode = "object",
    ignored_keys = { "triggered" }
})
```

| オプション | 型 | 説明 |
|--------|------|-------------|
| `output_mode` | string | `"object"`（既定）または `"array"`（到着順） |
| `ignored_keys` | array | 出力から除外する入力キー |
| `inputs` | table | 入力要件 |
| `input_transform` | string/table | join 前に入力を変換 |
| `metadata` | table | ノードメタデータ |

## テンプレート

テンプレートは再利用可能なサブワークフローを定義します。`flow.template()` で作成し、`:use()` でインライン化します。

```lua
local preprocessor = flow.template()
    :func("app:clean")
    :func("app:tokenize")

flow.create()
    :with_input(data)
    :use(preprocessor)
    :func("app:process")
    :run()
```

テンプレートの操作はコンパイル時に親フローへインライン化されます。

## ネストされたワークフロー

サイクルや並列ノードで使う関数は、`flow.create():run()` を返すことで子ワークフローを生成できます。

```lua
function my_processor(input)
    return flow.create()
        :with_input(input)
        :func("app:step_a")
        :func("app:step_b")
        :run()
end
```

`:run()` が既存の Dataflow コンテキスト内で実行されると、直接実行する代わりに `{ _control = { commands = [...] } }` を返します。オーケストレーターは yield 仕組みを通じて子ワークフローを処理します。

<note>
子ワークフローを生成する必要がある関数は <code>flow.create():run()</code> を返さなければなりません。ほかの Dataflow 関数は通常の結果を返せます。
</note>

## 同期実行と非同期実行

`:run()` は同期的に実行します。通常はワークフローの終端出力を返しますが、耐久的な待機によって先に passivate される場合があります。その場合は、ワークフロー ID とともに `pending = true` および `passivated = true` を持つ結果が返ります。

```lua
local result, err = flow.create()
    :with_input({ text = "hello" })
    :func("app:process")
    :run()
```

`:start()` はワークフロー ID を直ちに返します。

```lua
local dataflow_id, err = flow.create()
    :with_input({ text = "hello" })
    :func("app:process")
    :start()
```

`:start()` はネストされたコンテキストでは使用できません。

## Client API

プログラムからワークフローを管理します。

```yaml
imports:
  client: userspace.dataflow:client
```

```lua
local client = require("client")

local c, err = client.new()
```

| メソッド | 説明 |
|--------|-------------|
| `client.new()` | クライアントを作成（現在の security actor と scope が必要） |
| `:create_workflow(commands, options?)` | ワークフローを作成し `dataflow_id` を返す |
| `:execute(dataflow_id, options?)` | 同期実行して結果を返す |
| `:start(dataflow_id, options?)` | 非同期実行して `dataflow_id` を返す |
| `:output(dataflow_id)` | ワークフロー出力を取得 |
| `:get_status(dataflow_id)` | 現在の状態を取得 |
| `:cancel(dataflow_id, timeout?)` | graceful cancel（既定 30 秒） |
| `:terminate(dataflow_id)` | 強制終了 |
| `:signal(dataflow_id, signal_id, data?)` | 待機中のシグナルノードへ外部シグナルを配信 |
| `:revive(dataflow_id)` | 終端していないワークフローのアクティベーションを要求 |

## ワークフロー状態

| 状態 | 説明 |
|--------|-------------|
| `pending` | 作成済みで未実行 |
| `running` | ワークフロー実行中 |
| `waiting` | シグナルなどの耐久イベントを待って passivate 中 |
| `completed` | 正常完了 |
| `failed` | 失敗 |
| `cancelled` | ユーザーがキャンセル |
| `terminated` | 強制終了 |

ノードには別のライフサイクルがあります。現在のノード遷移では `template`、`pending`、`running`、`waiting`、`completed`、`failed`、`cancelled` を使用します。`ready` は読み込まれたワークフローのアクティベーション状態として受け付けます。`paused`、`skipped`、ノードレベルの `terminated` は互換値として認識されますが、現在のノード遷移には書き込まれません。

## メタデータ

```lua
flow.create()
    :with_title("Document Processing Pipeline")
    :with_metadata({ source = "api", priority = "high" })
    :with_input({ document_id = "doc-123" })
    :func("app:process", { metadata = { title = "Process Document" } })
    :run()
```

タイトルを指定しない場合は `"Flow Builder Workflow"` になります。

## 検証規則

コンパイラーはコンパイル時にワークフローを検証します。

- `:as(name)` の名前はすべて一意
- `:to()` と `:error_to()` の対象は既存名を参照（`@success`、`@fail` を除く）
- グラフは非巡回
- 全ノードに入力ルートがある（別ノード、ワークフロー入力、静的データのいずれか）
- `:cycle()` には `func_id` または `template` の一方が必要
- `:parallel()` には `source_array_key` と `template` が必要
- 少なくとも 1 つのパスが `@success` に到達するか、自動出力を持つ
- `:when()` はノードからの `:to()` または `:error_to()` の直後だけで使用（静的データでは不可）
- `args` または文字列形式の `input_transform` を持つノードは `"default"` discriminator の入力を受け取れない

## 式リファレンス

式は `expr` モジュールの構文を使い、`:when()` 条件と `input_transform` 値で利用できます。

**演算子:** `+`、`-`、`*`、`/`、`%`、`**`、`&`、`|`、`^`、`<<`、`>>`、`==`、`!=`、`<`、`<=`、`>`、`>=`、`&&`、`||`、`!`、`in`、`contains`、`startsWith`、`endsWith`

**配列関数:** `all()`、`any()`、`none()`、`one()`、`filter()`、`map()`、`count()`、`len()`、`first()`、`last()`

**数学関数:** `max()`、`min()`、`abs()`、`ceil()`、`floor()`、`round()`、`sqrt()`、`pow()`

**文字列関数:** `len()`、`upper()`、`lower()`、`trim()`、`split()`、`join()`

**型関数:** `type()`、`int()`、`float()`、`string()`

**リテラル:** 数値、文字列、真偽値（`true`/`false`）、null（`nil`）、配列（`[1, 2, 3]`）、オブジェクト（`{key: value}`）

**三項演算子:** `output.age >= 18 ? output.verified : false`

**optional chaining:** `output.data?.nested?.value`

## エラー処理

`:run()` と `:start()` は標準の Lua エラー規約に従います。

- 成功: `data, nil`（run）または `dataflow_id, nil`（start）
- 失敗: `nil, error_message`

エラー分類には、コンパイルエラー、クライアントエラー、ワークフロー作成エラー、実行エラー、ワークフロー失敗があります。

## 関連項目

- [Agents](./agents.md) — Agent ノードが使うエージェントフレームワーク
- [LLM](./llm.md) — エージェントが使うモデルインターフェース
- [Framework 概要](./overview.md) — Framework モジュールのインストールと利用
