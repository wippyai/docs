# エージェント

`wippy/agent` モジュールは、ツール使用、ストリーミング、デリゲーション、トレイト、メモリを備えた AI エージェントを構築するためのフレームワークを提供します。エージェントは宣言的に定義され、コンテキスト/ランナーパターンで実行されます。

## セットアップ

プロジェクトにモジュールを追加します:

```bash
wippy add wippy/agent
wippy install
```

エージェントモジュールには `wippy/llm` とプロセスホストが必要です。両方の依存関係を宣言します:

```yaml
version: "1.0"
namespace: app

entries:
  - name: os_env
    kind: env.storage.os

  - name: processes
    kind: process.host
    lifecycle:
      auto_start: true

  - name: dep.llm
    kind: ns.dependency
    component: wippy/llm
    version: "*"
    parameters:
      - name: env_storage
        value: app:os_env
      - name: process_host
        value: app:processes

  - name: dep.agent
    kind: ns.dependency
    component: wippy/agent
    version: "*"
    parameters:
      - name: process_host
        value: app:processes
```

## エージェント定義

エージェントは `meta.type: agent.gen1` を持つレジストリエントリです:

```yaml
entries:
  - name: assistant
    kind: registry.entry
    meta:
      type: agent.gen1
      name: assistant
      title: Assistant
      comment: A helpful chat assistant
    prompt: |
      You are a helpful assistant. Be concise and direct.
      Answer questions clearly.
    model: gpt-4o
    max_tokens: 1024
    temperature: 0.7
```

### エージェントフィールド

| フィールド | 型 | 説明 |
|-------|------|-------------|
| `meta.type` | string | `agent.gen1` である必要があります |
| `meta.name` | string | エージェント識別子 |
| `prompt` | string | システムプロンプト |
| `model` | string | モデル名またはクラス |
| `max_tokens` | number | 最大出力トークン数 |
| `temperature` | number | ランダム性の制御、0-1 |
| `thinking_effort` | number | 思考の深さ 0-100 |
| `tools` | array | ツールレジストリ ID |
| `traits` | array | トレイト参照 |
| `delegates` | array | デリゲートエージェント参照 |
| `memory` | array | 静的メモリ項目（文字列） |
| `memory_contract` | table | 動的メモリ設定 |

## エージェントコンテキスト

エージェントコンテキストはメインのエントリポイントです。コンテキストを作成し、必要に応じて設定してから、エージェントをロードします:

```yaml
imports:
  agent_context: wippy.agent:context
```

```lua
local agent_context = require("agent_context")

local ctx = agent_context.new()
local runner, err = ctx:load_agent("app:assistant")
if err then
    error("Failed to load agent: " .. tostring(err))
end
```

### コンテキストメソッド

| メソッド | 説明 |
|--------|-------------|
| `agent_context.new(options?)` | 新しいコンテキストを作成 |
| `:add_tools(specs)` | 実行時にツールを追加 |
| `:add_delegates(specs)` | デリゲートエージェントを追加 |
| `:set_memory_contract(config)` | 動的メモリを設定 |
| `:update_context(updates)` | 実行時コンテキストを更新 |
| `:load_agent(spec_or_id, options?)` | エージェントをロードしてコンパイル、ランナーを返す |
| `:switch_to_agent(id, options?)` | 別のエージェントに切り替え、`(boolean, string?)` を返す |
| `:switch_to_model(name)` | 現在のエージェントのモデルを変更、`(boolean, string?)` を返す |
| `:get_current_agent()` | 現在のランナーを取得 |

### コンテキストオプション

```lua
local ctx = agent_context.new({
    context = { session_id = "abc", user_id = "u1" },
    delegate_tools = { enabled = true },
})
```

### インラインスペックによるロード

レジストリエントリなしでエージェントをロードします:

```lua
local runner, err = ctx:load_agent({
    id = "inline-agent",
    name = "helper",
    prompt = "You are a helpful assistant.",
    model = "gpt-4o",
    max_tokens = 1024,
    tools = { "app.tools:search" },
})
```

## ステップの実行

ランナーは単一の推論ステップを実行します。会話を含むプロンプトビルダーを渡します:

```lua
local prompt = require("prompt")

local conversation = prompt.new()
conversation:add_user("What is the capital of France?")

local response, err = runner:step(conversation)
if err then
    error(tostring(err))
end

print(response.result)
```

### ステップオプション

```lua
local response, err = runner:step(conversation, {
    context = { session_id = "abc" },
    stream_target = { reply_to = process.pid(), topic = "stream" },
    tool_call = "auto",
})
```

| オプション | 型 | 説明 |
|--------|------|-------------|
| `context` | table | エージェントコンテキストにマージされる実行時コンテキスト |
| `stream_target` | table | ストリーミング: `{ reply_to, topic }` |
| `tool_call` | string | `"auto"`、`"required"`、`"none"` |

### ステップレスポンス

| フィールド | 型 | 説明 |
|-------|------|-------------|
| `result` | string | 生成されたテキスト |
| `tokens` | table | トークン使用量 |
| `finish_reason` | string | 停止理由 |
| `tool_calls` | table? | 実行すべきツール呼び出し |
| `delegate_calls` | table? | デリゲート呼び出し |

### ランナー統計

```lua
local stats = runner:get_stats()
-- stats.id, stats.name, stats.total_tokens
```

## ツール定義

ツールは `meta.type: tool` を持つ `function.lua` エントリです。別の `_index.yaml` で定義します:

```yaml
version: "1.0"
namespace: app.tools

entries:
  - name: calculate
    kind: function.lua
    meta:
      type: tool
      title: Calculate
      input_schema: |
        {
          "type": "object",
          "properties": {
            "expression": {
              "type": "string",
              "description": "Math expression to evaluate"
            }
          },
          "required": ["expression"],
          "additionalProperties": false
        }
      llm_alias: calculate
      llm_description: Evaluate a mathematical expression.
    source: file://calculate.lua
    modules: [expr]
    method: handler
```

```lua
local expr = require("expr")

local function handler(args)
    local result, err = expr.eval(args.expression)
    if err then
        return { error = tostring(err) }
    end
    return { result = result }
end

return { handler = handler }
```

### ツールメタデータ

| フィールド | 型 | 説明 |
|-------|------|-------------|
| `meta.type` | string | `tool` である必要があります |
| `meta.input_schema` | string/table | ツール引数の JSON Schema |
| `meta.llm_alias` | string | LLM に公開される名前 |
| `meta.llm_description` | string | LLM に公開される説明 |
| `meta.exclusive` | boolean | true の場合、並行するツール呼び出しをキャンセル |

### エージェントでのツール参照

エージェント定義にツールレジストリ ID をリストします:

```yaml
  - name: assistant
    kind: registry.entry
    meta:
      type: agent.gen1
      name: assistant
    prompt: You are a helpful assistant with tools.
    model: gpt-4o
    max_tokens: 1024
    tools:
      - app.tools:calculate
      - app.tools:search
      - app.tools:*          # wildcard: all tools in namespace
```

カスタムエイリアスとコンテキストを指定してツールを参照することもできます:

```yaml
    tools:
      - id: app.tools:search
        alias: web_search
        context:
          api_key: "${SEARCH_API_KEY}"
```

## ツール実行

エージェントステップが `tool_calls` を返した場合、それを実行して結果をフィードバックします:

```lua
local json = require("json")
local funcs = require("funcs")

local function execute_and_continue(runner, conversation)
    while true do
        local response, err = runner:step(conversation)
        if err then return nil, err end

        local tool_calls = response.tool_calls
        if not tool_calls or #tool_calls == 0 then
            return response.result, nil
        end

        for _, tc in ipairs(tool_calls) do
            local result, call_err = funcs.call(tc.registry_id, tc.arguments)
            local result_str
            if call_err then
                result_str = json.encode({ error = tostring(call_err) })
            else
                result_str = json.encode(result)
            end

            conversation:add_function_call(tc.name, tc.arguments, tc.id)
            conversation:add_function_result(tc.name, result_str, tc.id)
        end
    end
end
```

### ツール呼び出しフィールド

| フィールド | 型 | 説明 |
|-------|------|-------------|
| `id` | string | 一意の呼び出し識別子 |
| `name` | string | ツール名（エイリアスまたは llm_alias） |
| `arguments` | table | パース済み引数 |
| `registry_id` | string | `funcs.call()` 用の完全なレジストリ ID |

<note>
ツールの実行には <code>funcs.call(tc.registry_id, tc.arguments)</code> を使用します。<code>registry_id</code> フィールドは、レジストリ内のツールのエントリに直接対応します。
</note>

## ストリーミング

`stream_target` を使用してエージェントのレスポンスをリアルタイムでストリーミングします:

```lua
local TOPIC = "agent_stream"

local function stream_step(runner, conversation)
    local stream_ch = process.listen(TOPIC)

    local done_ch = channel.new(1)
    coroutine.spawn(function()
        local response, err = runner:step(conversation, {
            stream_target = {
                reply_to = process.pid(),
                topic = TOPIC,
            },
        })
        done_ch:send({ response = response, err = err })
    end)

    local full_text = ""
    while true do
        local result = channel.select({
            stream_ch:case_receive(),
            done_ch:case_receive(),
        })
        if not result.ok then break end

        if result.channel == done_ch then
            process.unlisten(stream_ch)
            local r = result.value
            return full_text, r.response, r.err
        end

        local chunk = result.value
        if chunk.type == "chunk" then
            io.write(chunk.content or "")
            full_text = full_text .. (chunk.content or "")
        elseif chunk.type == "done" then
            -- wait for the step to complete
            local r, ok = done_ch:receive()
            process.unlisten(stream_ch)
            if ok and r then
                return full_text, r.response, r.err
            end
            return full_text, nil, nil
        end
    end

    process.unlisten(stream_ch)
    return full_text, nil, nil
end
```

ストリームは直接 LLM ストリーミングと同じチャンクタイプを使用します: `"chunk"`、`"thinking"`、`"tool_call"`、`"error"`、`"done"`。

<tip>
<code>coroutine.spawn</code> を使用して <code>runner:step()</code> を別のコルーチンで実行し、ストリームチャンクを並行して受信できるようにします。<code>channel.select</code> を使用してストリームチャネルと完了チャネルを多重化します。
</tip>

## デリゲート

エージェントは他のエージェントにデリゲートできます。デリゲートは親エージェントにとってツールとして表示されます:

```yaml
  - name: coordinator
    kind: registry.entry
    meta:
      type: agent.gen1
      name: coordinator
    prompt: Route questions to the right specialist.
    model: gpt-4o
    max_tokens: 1024
    delegates:
      - id: app:code_agent
        name: ask_coder
        rule: for programming questions
      - id: app:math_agent
        name: ask_mathematician
        rule: for math problems
```

デリゲート呼び出しは `response.delegate_calls` に含まれます:

```lua
local response = runner:step(conversation)

if response.delegate_calls then
    for _, dc in ipairs(response.delegate_calls) do
        -- dc.agent_id - target agent registry ID
        -- dc.name - delegate tool name
        -- dc.arguments - forwarded message
    end
end
```

実行時にデリゲートを追加することもできます:

```lua
ctx:add_delegates({
    { id = "app:specialist", name = "ask_specialist", rule = "for domain questions" },
})
```

## トレイト

トレイトは、プロンプト、ツール、動作をエージェントに提供する再利用可能なケイパビリティです:

```yaml
  - name: assistant
    kind: registry.entry
    meta:
      type: agent.gen1
      name: assistant
    prompt: You are a helpful assistant.
    model: gpt-4o
    traits:
      - time_aware
      - id: custom_trait
        context:
          key: value
```

### 組み込みトレイト

| トレイト | 説明 |
|-------|-------------|
| `time_aware` | 現在の日付と時刻をプロンプトに注入 |

`time_aware` トレイトはコンテキストオプションを受け付けます:

```yaml
    traits:
      - id: time_aware
        context:
          timezone: America/New_York
          time_interval: 15
```

### カスタムトレイト

トレイトは `meta.type: agent.trait` を持つレジストリエントリです。以下を提供できます:
- **prompt** - システムプロンプトに追加される静的テキスト
- **build_func_id** - コンパイル時に呼び出され、ツール、プロンプト、デリゲートを提供する関数
- **prompt_func_id** - 各ステップで呼び出され、動的コンテンツを注入する関数
- **step_func_id** - 各ステップで副作用のために呼び出される関数

## メモリ

### 静的メモリ

システムプロンプトに追加されるシンプルなメモリ項目:

```yaml
  - name: assistant
    kind: registry.entry
    meta:
      type: agent.gen1
      name: assistant
    prompt: You are a helpful assistant.
    model: gpt-4o
    memory:
      - "User prefers concise answers"
      - "Always cite sources when possible"
```

### 動的メモリコントラクト

外部ソースからの動的メモリ呼び出しを設定します:

```yaml
    memory_contract:
      implementation_id: app:memory_store
      context:
        user_id: "${user_id}"
      options:
        max_items: 5
        max_length: 2000
        recall_cooldown: 2
        min_conversation_length: 3
```

メモリコントラクトは `runner:step()` の実行中に呼び出され、会話コンテキストに基づいて関連する項目を呼び出します。結果は開発者メッセージとして注入されます。

| オプション | 説明 |
|--------|-------------|
| `max_items` | 1回の呼び出しあたりの最大メモリ項目数 |
| `max_length` | 最大合計文字数 |
| `recall_cooldown` | 呼び出し間の最小ステップ数 |
| `min_conversation_length` | 最初の呼び出しまでの最小会話ターン数 |

## リゾルバーコントラクト

`load_agent()` が文字列識別子を受け取ると、まず `wippy.agent:resolver` コントラクトによる解決を試みます。リゾルバーがバインドされていないか、リゾルバーが nil を返した場合、レジストリルックアップにフォールバックします。

これにより、アプリケーションはデータベースからエージェント定義をロードするなど、カスタムのエージェント解決を実装できます。

### リゾルバーのバインド

リゾルバー関数を定義し、コントラクトにバインドします:

```yaml
entries:
  - name: agent_resolver.resolve
    kind: function.lua
    source: file://agent_resolver.lua
    method: resolve
    modules:
      - logger
    imports:
      agent_registry: wippy.agent.discovery:registry

  - name: agent_resolver_binding
    kind: contract.binding
    contracts:
      - contract: wippy.agent:resolver
        default: true
        methods:
          resolve: app:agent_resolver.resolve
```

### リゾルバーの実装

リゾルバーは `{ agent_id = "..." }` を受け取り、エージェントスペックテーブルまたは nil を返します:

```lua
local agent_registry = require("agent_registry")

local CUSTOM_PREFIX = "custom:"

function resolve(args)
    local agent_id = args.agent_id
    if not agent_id then
        return nil, "agent_id is required"
    end

    if agent_id:sub(1, #CUSTOM_PREFIX) == CUSTOM_PREFIX then
        local id = agent_id:sub(#CUSTOM_PREFIX + 1)

        -- load from database, config file, or any other source
        return {
            id = agent_id,
            name = "custom-agent",
            prompt = "You are a custom agent.",
            model = "class:balanced",
            max_tokens = 1024,
            tools = {},
        }
    end

    -- fall back to registry
    local spec, err = agent_registry.get_by_id(agent_id)
    if not spec then
        spec, err = agent_registry.get_by_name(agent_id)
    end
    return spec, err
end

return {
    resolve = resolve,
}
```

### 解決順序

1. `wippy.agent:resolver` コントラクトを試行（バインドされている場合）
2. ID によるレジストリルックアップを試行
3. 名前によるレジストリルックアップを試行
4. 見つからない場合はエラーを返す

このパターンにより、エージェントがユーザーごとまたはワークスペースごとに設定され、フレームワークのレジストリ外に保存されるマルチテナントアプリケーションが可能になります。

## 関連項目

- [LLM](llm.md) - 基盤となる LLM モジュール
- [LLM エージェントの構築](../tutorials/llm-agent.md) - ステップバイステップのチュートリアル
- [フレームワーク概要](overview.md) - フレームワークモジュールの使用方法
