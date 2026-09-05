---
title: "Dataflow"
description: "wippy/dataflow モジュールは、有向非巡回グラフ（DAG）に基づくワークフローオーケストレーションエンジンを提供します。ワークフローは、型付きデータルートで接続されたノード（関数、エージェント、サイクル、並列プロセッサ）で構成されます。"
---

# Dataflow

`wippy/dataflow` モジュールは、有向非巡回グラフ（DAG）に基づくワークフローオーケストレーションエンジンを提供します。ワークフローは、型付きデータルートで接続されたノード（関数、エージェント、サイクル、並列プロセッサ）で構成されます。オーケストレーターが実行、状態の永続化、リカバリを管理します。

## セットアップ

プロジェクトにモジュールを追加します:

```bash
wippy add wippy/dataflow
wippy install
```

依存関係を宣言します:

```yaml
version: "1.0"
namespace: app

entries:
  - name: dep.dataflow
    kind: ns.dependency
    component: wippy/dataflow
    version: "*"
```

dataflow モジュールは `wippy/agent`、`wippy/llm`、`wippy/session` に依存しています。これらは `wippy install` を実行すると自動的に解決されます。モジュールはワークフローの永続化のために `app:db` にデータベースリソースを必要とし、`wippy/migration` を介してマイグレーションを自動的に実行します。

モジュールは `env.variable` エントリ `userspace.dataflow.env:web_host_origin`（デフォルト `https://front.wippy.ai`）を公開しており、下流のフローが公開 URL を構築する際に読み取れます。env ルーターまたは requirement を通じて上書きできます。

## フロービルダー

フロービルダーは、ワークフローを構成するための流暢なインターフェースを提供します。エントリにインポートします:

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
    :run()   -- 同期
    :start() -- 非同期

flow.template()
    :[operations]...
```

### 線形パイプライン

明示的なルーティングが定義されていない場合、ノードは自動的に連結されます。各ノードの出力は次のノードへ流れます:

```lua
local result, err = flow.create()
    :with_input({ text = "Hello world" })
    :func("app:tokenize")
    :func("app:translate", { args = { target_lang = "fr" } })
    :func("app:format_output")
    :run()
```

### 名前付きルーティング

`:as()` でノードに名前を付け、`:to()` でノード間のデータをルーティングします。`:as()` は、ノードを参照する必要がある場合にのみ使用してください:

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

`:to()` の第 2 引数は**ディスクリミネーター**、つまり受信側ノードでの入力キーです。ノードが複数の入力を受け取る場合、それらはディスクリミネーターをキーとするテーブルとして収集されます。

### ワークフロー入力と静的データ

`:with_input()` はワークフローへの単一のプライマリ入力です。`:with_data()` は独立した静的データソースを作成します:

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

ワークフローに入ってくる外部データには `:with_input()` を使用します。複数のノードで共有される設定、定数、参照データには `:with_data()` を使用します。静的データは参照最適化を利用します。最初のルートが実際のデータを作成し、以降のルートは軽量な参照を作成します。

### 条件付きルーティング

`:to()` の後に `:when()` を使用して条件を追加します。条件は `expr` 構文を使ってノードの出力に対して評価されます:

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

条件はインライン変換と組み合わせて、より複雑なルーティングを実現できます:

```lua
:func("app:decompose"):as("decompose")
    :to("@success", nil, "{passed: true, feedback: nil}"):when("len(output.items) == 0")
    :to("processor", "items", "output.items")
```

条件式では次がサポートされます: 比較（`output.score > 0.8`）、論理演算子（`output.valid && output.count > 5`）、配列関数（`len(output.items) > 0`、`any(output.errors, {.critical})`）、文字列操作（`output.status contains 'success'`）、オプショナルチェーン（`output.data?.nested?.value`）。

### ワークフローターミナル

`@success` または `@fail` にルーティングすると、ワークフローが明示的に終了します。ネストされたコンテキスト（サイクル、並列）では、ターミナルはワークフロー出力ではなくノード出力を作成します:

```lua
:func("app:final_step"):to("@success")
:func("app:handler"):error_to("@fail")
```

### エラールーティング

`:error_to()` を使用してノードのエラーをハンドラーにルーティングします。エラーはリカバリノードへの通常の入力としてルーティングできます:

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

このパターンでは両方のプランナーが並列に実行されます。一方が失敗した場合、そのエラーがコンソリデーターの入力となり、コンソリデーターは利用可能な結果で処理を続行します。

## 入力のマージ

ノードが入力をどのように受け取るかは、ディスクリミネーターと `args` が設定されているかどうかによって決まります。

**args なし - 単一のデフォルト入力:**

```lua
:func("source"):to("target")
-- target が受け取るもの: 生のコンテンツ（ラップされていない）
```

**args なし - 単一の名前付き入力:**

```lua
:func("source"):to("target", "task")
-- target が受け取るもの: { task = content }
```

**args なし - 複数の入力:**

```lua
:func("source1"):to("target", "data")
:func("source2"):to("target", "config")
-- target が受け取るもの: { data = content1, config = content2 }
```

**args あり - 入力はベースにマージされる:**

```lua
:func("app:api_client", {
    args = { base_url = "https://api.com", timeout = 5000 }
})
-- 上流から :to("api_client", "body") が接続されている場合
-- api_client が受け取るもの: { base_url = "https://api.com", timeout = 5000, body = content }
```

<note>
<code>args</code> を持つノードは、<code>"default"</code> ディスクリミネーターの入力を受け取れません。代わりに <code>:to(target, "input_key")</code> で名前付きディスクリミネーターを使用してください。
</note>

## 入力変換

データがノードに到達する前に変換します:

```lua
-- 文字列変換: 単一の式
:func("app:step", { input_transform = "input.nested.field" })

-- テーブル変換: 名前付きの式
:func("app:step", {
    input_transform = {
        task = "inputs.task",
        config = "inputs.settings",
        priority = "output.score > 0.8 ? 'high' : 'normal'"
    }
})
```

変換で利用できるコンテキスト変数: `input`（ワークフロー入力）、`inputs`（ノードに入ってくるすべての入力）、`output`（ルーティング時の現在のノードの出力）。

### インラインルート変換

`:to()` の第 3 引数はインライン変換式です:

```lua
:func("source"):as("source")
    :to("target", nil, "output.data")
    :to("other", nil, "{passed: true, value: output.x}")
    :to("list", nil, "map(output.items, {.id})")
```

## ノードタイプ

### 関数ノード

登録済みの `function.lua` エントリを実行します:

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
| `args` | table | ノード入力とマージされるベース引数 |
| `inputs` | table | 入力要件: `{ required = {...}, optional = {...} }` |
| `context` | table | 関数に渡される実行コンテキスト |
| `input_transform` | string/table | 入力を変換する式 |
| `metadata` | table | ノードメタデータ（例: `{ title = "..." }`） |

関数が `{ _control = { commands = [...] } }` を返した場合、オーケストレーターは子ワークフローを生成します。これがネストされたフローの仕組みです。

### エージェントノード

ツール呼び出しとオプションの構造化終了を備えたエージェントを実行します:

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
| `model` | string | モデルの上書き |
| `arena.prompt` | string | システムプロンプト |
| `arena.max_iterations` | number | 推論ループの最大回数（デフォルト: 32） |
| `arena.min_iterations` | number | 終了前の最小イテレーション数（デフォルト: 1） |
| `arena.tool_calling` | string | `"auto"`、`"any"`（`exit_schema` が必要）、`"none"`（`exit_schema` を拒否） |
| `arena.tools` | array | ツールレジストリ ID |
| `arena.exit_schema` | table | 構造化終了のための JSON スキーマ |
| `arena.exit_func_id` | string | 終了出力を検証する関数 |
| `arena.context` | table | 追加のコンテキスト |
| `inputs` | table | 入力要件 |
| `show_tool_calls` | boolean | 出力にツール呼び出しを含める |
| `input_transform` | string/table | 入力の変換 |
| `metadata` | table | ノードメタデータ |

**動的なエージェント選択:** エージェント ID に空文字列を渡し、`input_transform` で解決します:

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

**終了の検証:** `exit_func_id` が設定されている場合、その関数がエージェントの終了出力を検証します。検証に失敗すると、エージェントはエラーを観測として受け取り、処理を続行します（`max_iterations` まで）。

### サイクルノード

永続的な状態を保持しながら、関数またはテンプレートを繰り返し実行します:

```lua
:cycle({
    func_id = "app:content_cycle",
    max_iterations = 3,
    initial_state = {
        entry_id = entry_id,
        content_prompt = prompt,
        min_score = 8.0,
        feedback_history = {}
    }
})
```

サイクル関数は各イテレーションで次を受け取ります:

```lua
{
    input = <workflow_input>,  -- 最初のイテレーション（iteration == 1）のみ。以降は nil
    state = <accumulated_state>,
    last_result = <previous_iteration_output>,
    iteration = <current_iteration_number>
}
```

`input` は最初のイテレーションでのみワークフロー入力を保持し、以降は `nil` になります。イテレーション間で必要なものはすべて `state` に永続化してください。

関数が継続を制御します:

```lua
function my_cycle(cycle_context)
    -- 承認されたら停止
    if cycle_context.last_result and cycle_context.last_result.approved then
        return {
            state = cycle_context.state,
            result = cycle_context.last_result,
            continue = false
        }
    end

    -- このイテレーションのために子ワークフローを生成
    -- イテレーション 1 以降は cycle_context.input が nil のため、task は state から読み取る
    return flow.create()
        :with_input({ task = cycle_context.state.task })
        :agent("app:worker")
        :agent("app:qa")
        :run()
end
```

| オプション | 型 | 説明 |
|--------|------|-------------|
| `func_id` | string | イテレーション関数（`template` と排他） |
| `template` | FlowBuilder | 各イテレーションのテンプレート（`func_id` と排他） |
| `max_iterations` | number | 最大イテレーション数 |
| `initial_state` | table | 初期状態 |
| `continue_condition` | string | 式: true の間は継続 |

**テンプレートベースのサイクル:**

```lua
:cycle({
    template = flow.template()
        :agent("app:worker")
        :func("app:validator"),
    max_iterations = 5
})
```

### 並列ノード

配列に対する map-reduce パターンです:

```lua
:parallel({
    inputs = { required = { "specs", "task" } },
    source_array_key = "specs",
    iteration_input_key = "spec",
    passthrough_keys = { "task" },
    batch_size = 10,
    on_error = "collect_errors",
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
| `source_array_key` | string | 配列を含む入力キー（必須） |
| `template` | FlowBuilder | 各アイテムのテンプレート（必須、`@success` にルーティングする必要あり） |
| `iteration_input_key` | string | 現在のアイテムの入力キー（デフォルト: `"default"`） |
| `batch_size` | number | 並列バッチあたりのアイテム数（デフォルト: 1 = 逐次） |
| `on_error` | string | `"collect_errors"`（デフォルト）または `"fail_fast"` |
| `filter` | string | `"all"`（デフォルト）、`"successes"`、`"failures"` |
| `unwrap` | boolean | メタデータでラップせず生の結果を返す（デフォルト: false） |
| `passthrough_keys` | array | すべてのイテレーションに転送される入力キー |

**パススルーキー**は、ソース配列にデータを複製することなく、共有コンテキスト（設定、タスクの説明）をすべてのイテレーションに提供します:

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

### シグナルノード

外部シグナルが到着するまで実行を一時停止します。人間による承認、外部イベント、段階的なワークフローに使用します:

```lua
:signal({
    signal_id = "approval",
    inputs = { required = { "draft" } },
    metadata = { title = "Wait for approval" }
})
```

| オプション | 型 | 説明 |
|--------|------|-------------|
| `signal_id` | string | `client:signal()` と照合されるシグナル名。空または省略された場合、実行時に UUID v7 が生成されます |
| `inputs` | table | 入力要件 |
| `input_transform` | string/table | ノードが受け取る前に入力を変換 |
| `metadata` | table | ノードメタデータ |

クライアント API を使用してワークフローの外部からシグナルを送信します（後述の `client:signal()` を参照）。

#### 動作

ノードは `wait_for_signal = true` で yield し、その yield をワークフロー状態に永続化します。一致する `NODE_SIGNAL` コミットが到着すると、オーケストレーターはノードを再開します。

- シグナルは `nil` 以外の任意のペイロードで満たされます。`false`、`0`、`""`、`{}` はすべて yield を満たし、`nil` のみが保留状態を維持します。
- シグナル yield は `COMPLETE_WORKFLOW` をブロックしますが、他の保留中のノードはブロックしません。一方のブランチが待機している間も、並列ブランチは実行を続けます。
- シグナルは `:start()` の前に事前キューイングできます。シグナルノードが yield に到達する前に一致する `NODE_SIGNAL` コミットが到着した場合、yield が追跡された時点で配信されます。
- 各 yield を満たすシグナルは 1 つだけです。yield が満たされる前に同じ `signal_id` を持つ 2 つ目のシグナルが到着した場合、最初のシグナルを上書きします。
- 複数のシグナル yield が同じ `signal_id` を共有する場合、最初に一致した yield がデータを受け取ります。
- `signal_id` フィールドが存在しない場合、照合はノードのディスクリミネーターにフォールバックします。
- 配信されたシグナルデータは、シグナルペイロードとしてノードの出力に渡されます。

#### 耐久性とリカバリ

シグナル yield はワークフロー状態の一部であり、他のすべてのコマンドと同じアウトボックス機構を通じて永続化されます。待機中にオーケストレータープロセスが強制終了された場合:

- 保留中の yield は再起動時に復元されます。
- 停止中に配信されたシグナルはキューに入れられ、状態のリロード時に適用されます。
- 複合パイプライン（`func → signal → signal → func`）はステップごとにリカバリされます。各シグナルは別々の再起動をまたいで配信できます。

孤立したシグナル yield（親プロセスが完了せずに終了した yield）は、ワークフロー状態のプロセス終了ハンドラーによってクリーンアップされます。

#### パイプラインパターン

シグナルノードは任意のトポロジに参加できます:

```lua
-- 2 つの関数の間での人間による承認（Human-in-the-loop）
flow.create()
    :func("app:draft")
    :signal({ signal_id = "approve_draft" })
    :func("app:publish")
    :run()

-- リリース前に両方の到着が必要な 2 つの並列承認
flow.create()
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
    :run()
```

シグナルデータはノード出力として公開されるため、下流のノードは `client:signal()` に渡されたものをそのまま受け取ります。

### 結合ノード

複数の入力を収集してから処理を進めます:

```lua
:join({
    inputs = { required = { "source1", "source2" } },
    output_mode = "object",
    ignored_keys = { "triggered" }
})
```

| オプション | 型 | 説明 |
|--------|------|-------------|
| `output_mode` | string | `"object"`（デフォルト）または `"array"`（到着順） |
| `ignored_keys` | array | 出力から除外する入力キー |
| `inputs` | table | 入力要件 |

## テンプレート

テンプレートは再利用可能なサブワークフローを定義します。`flow.template()` で作成し、`:use()` でインライン展開します:

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

テンプレートはコンパイル時にその操作を親フローにインライン展開します。

## ネストされたワークフロー

サイクルノードや並列ノードで使用される関数は、`flow.create():run()` を返すことで子ワークフローを生成できます:

```lua
function my_processor(input)
    return flow.create()
        :with_input(input)
        :func("app:step_a")
        :func("app:step_b")
        :run()
end
```

既存の dataflow コンテキスト内で `:run()` が実行されると、直接実行する代わりに `{ _control = { commands = [...] } }` を返します。オーケストレーターは yield 機構を通じて子ワークフローを処理します。

<note>
dataflow の構成に参加する関数は、<strong>必ず</strong> <code>flow.create():run()</code> を返す必要があります。それ以外のものを返す関数は子ワークフローを生成できません。
</note>

## 同期と非同期

`:run()` はワークフローが完了するまでブロックし、出力を返します:

```lua
local result, err = flow.create()
    :with_input({ text = "hello" })
    :func("app:process")
    :run()
```

`:start()` はワークフロー ID を伴って即座に返ります:

```lua
local dataflow_id, err = flow.create()
    :with_input({ text = "hello" })
    :func("app:process")
    :start()
```

`:start()` はネストされたコンテキストでは使用できません。

## クライアント API

プログラムからワークフローを管理する場合:

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
| `client.new()` | クライアントを作成（セキュリティアクターが必要） |
| `:create_workflow(commands, options?)` | ワークフローを作成し、`dataflow_id` を返す |
| `:execute(dataflow_id, options?)` | 同期的に実行し、結果を返す |
| `:start(dataflow_id, options?)` | 非同期に実行し、`dataflow_id` を返す |
| `:output(dataflow_id)` | ワークフロー出力を取得 |
| `:get_status(dataflow_id)` | 現在のステータスを取得 |
| `:cancel(dataflow_id, timeout?)` | 正常にキャンセル（デフォルト: 30 秒） |
| `:terminate(dataflow_id)` | 強制終了 |
| `:signal(dataflow_id, signal_id, data?)` | 待機中のシグナルノードに外部シグナルを配信 |

## ワークフローステータス

| ステータス | 説明 |
|--------|-------------|
| `template` | ノードはテンプレートインスタンス |
| `pending` | 入力を待機中 |
| `ready` | 入力が収集され、実行可能 |
| `running` | 実行中 |
| `paused` | yield 済み、子ワークフローを待機中 |
| `completed` | 正常に完了 |
| `failed` | 失敗 |
| `cancelled` | ユーザーによるキャンセル |
| `skipped` | 条件分岐で選択されなかった |
| `terminated` | 強制終了された |

## メタデータ

```lua
flow.create()
    :with_title("Document Processing Pipeline")
    :with_metadata({ source = "api", priority = "high" })
    :func("app:process", { metadata = { title = "Process Document" } })
    :run()
```

タイトルが指定されていない場合、デフォルトは "Flow Builder Workflow" です。

## 検証ルール

コンパイラはコンパイル時にワークフローを検証します:

- すべての `:as(name)` の名前は一意である必要がある
- すべての `:to()` および `:error_to()` のターゲットは既存の名前を参照する必要がある（`@success`、`@fail` を除く）
- グラフは非巡回である必要がある
- すべてのノードは受信ルートを持つ必要がある（他のノード、ワークフロー入力、または静的データから）
- `:cycle()` には `func_id` または `template` が必要（両方は不可）
- `:parallel()` には `source_array_key` と `template` が必要
- 少なくとも 1 つのパスが `@success` に到達するか、自動出力を持つ必要がある
- `:when()` はノードからの `:to()` または `:error_to()` の後にのみ置ける（静的データには不可）
- `args` を持つノードは `"default"` ディスクリミネーターの入力を受け取れない

## 式リファレンス

式は `expr` モジュールの構文を使用し、`:when()` 条件と `input_transform` の値で利用できます。

**演算子:** `+`、`-`、`*`、`/`、`%`、`**`、`==`、`!=`、`<`、`<=`、`>`、`>=`、`&&`、`||`、`!`、`contains`、`startsWith`、`endsWith`

**配列関数:** `all()`、`any()`、`none()`、`one()`、`filter()`、`map()`、`count()`、`len()`、`first()`、`last()`

**数学関数:** `max()`、`min()`、`abs()`、`ceil()`、`floor()`、`round()`、`sqrt()`、`pow()`

**文字列関数:** `len()`、`upper()`、`lower()`、`trim()`、`split()`、`join()`

**型関数:** `type()`、`int()`、`float()`、`string()`

**リテラル:** 数値、文字列、真偽値（`true`/`false`）、null（`nil`）、配列（`[1, 2, 3]`）、オブジェクト（`{key: value}`）

**三項演算子:** `output.age >= 18 ? output.verified : false`

**オプショナルチェーン:** `output.data?.nested?.value`

## エラー処理

`:run()` と `:start()` はどちらも標準的な Lua のエラー規約に従います:

- 成功: `data, nil`（run）または `dataflow_id, nil`（start）
- 失敗: `nil, error_message`

エラーのカテゴリ: コンパイルエラー、クライアントエラー、ワークフロー作成エラー、実行エラー、ワークフローの失敗。

## 関連項目

- [エージェント](framework/agents.md) - エージェントノードで使用されるエージェントフレームワーク
- [LLM](framework/llm.md) - LLM モジュール
- [Framework](framework/overview.md) - フレームワークモジュールの使い方
