# LLM エージェント

シンプルな LLM 呼び出しからツール付きストリーミングエージェントまで、ターミナルチャットエージェントをステップバイステップで構築します。

## 構築するもの

以下の機能を持つターミナルチャットエージェント:
- LLM によるテキスト生成
- マルチターン会話の維持
- リアルタイムのレスポンスストリーミング
- ツールを使用した外部機能へのアクセス

## プロジェクト構成

```
llm-agent/
├── .wippy.yaml
├── wippy.lock
└── src/
    ├── _index.yaml
    ├── ask.lua
    ├── chat.lua
    └── tools/
        ├── _index.yaml
        ├── current_time.lua
        └── calculate.lua
```

## フェーズ 1: シンプルな生成

文字列プロンプトで `llm.generate()` を呼び出す基本的な関数から始めます。

### プロジェクトの作成

```bash
mkdir llm-agent && cd llm-agent
mkdir -p src
```

### エントリ定義

`src/_index.yaml` を作成します:

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

  - name: ask
    kind: function.lua
    source: file://ask.lua
    method: handler
    imports:
      llm: wippy.llm:llm
```

LLM モジュールには2つのインフラストラクチャエントリが必要です:
- `env.storage.os` は環境変数から API キーを提供します
- `process.host` は LLM モジュールが内部で使用するプロセスランタイムを提供します

### 生成コード

`src/ask.lua` を作成します:

```lua
local llm = require("llm")

local function handler(input)
    local response, err = llm.generate(input, {
        model = "gpt-4.1-nano",
        temperature = 0.7,
        max_tokens = 512,
    })

    if err then
        return nil, err
    end

    return response.result
end

return { handler = handler }
```

### モデル定義

LLM モジュールはレジストリからモデルを解決します。`_index.yaml` にモデルエントリを追加します:

```yaml
  - name: gpt-4.1-nano
    kind: registry.entry
    meta:
      name: gpt-4.1-nano
      type: llm.model
      title: GPT-4.1 Nano
      comment: Fast, affordable model
      capabilities:
        - generate
        - tool_use
        - structured_output
      class:
        - fast
      priority: 100
    max_tokens: 1047576
    output_tokens: 32768
    pricing:
      input: 0.1
      output: 0.4
    providers:
      - id: wippy.llm.openai:provider
        provider_model: gpt-4.1-nano
```

### 初期化とテスト

```bash
wippy init
wippy run -x app:ask "What is the capital of France?"
```

関数を直接呼び出して結果を表示します。モデル定義は、LLM モジュールにどのプロバイダーを使用し、API にどのモデル名を送信するかを伝えます。

## フェーズ 2: 会話

プロンプトビルダーを使用して、単一の呼び出しからマルチターン会話にアップグレードします。エントリを関数からターミナル I/O を持つプロセスに変更します。

### エントリ定義の更新

`ask` エントリを `chat` プロセスに置き換え、ターミナル依存関係を追加します:

```yaml
  - name: dep.terminal
    kind: ns.dependency
    component: wippy/terminal
    version: "*"

  - name: chat
    kind: process.lua
    meta:
      command:
        name: chat
        short: Start a terminal chat
    source: file://chat.lua
    method: main
    modules:
      - io
      - process
    imports:
      llm: wippy.llm:llm
      prompt: wippy.llm:prompt
```

### チャットプロセス

`src/chat.lua` を作成します:

```lua
local io = require("io")
local llm = require("llm")
local prompt = require("prompt")

local function main()
    io.print("Chat (type 'quit' to exit)")
    io.print("")

    local conversation = prompt.new()
    conversation:add_system("You are a helpful assistant. Be concise and direct.")

    while true do
        io.write("> ")
        io.flush()
        local input = io.readline()
        if not input or input == "quit" or input == "exit" then break end
        if input == "" then goto continue end

        conversation:add_user(input)

        local response, err = llm.generate(conversation, {
            model = "gpt-4.1-nano",
            temperature = 0.7,
            max_tokens = 1024,
        })

        if err then
            io.print("Error: " .. tostring(err))
            goto continue
        end

        io.print(response.result)
        io.print("")
        conversation:add_assistant(response.result)

        ::continue::
    end

    io.print("Bye!")
end

return { main = main }
```

### 実行

```bash
wippy update
wippy run chat
```

プロンプトビルダーは会話履歴全体を維持します。各ターンでユーザーメッセージとアシスタントレスポンスが追加され、モデルに以前のやり取りのコンテキストが提供されます。

## フェーズ 3: エージェントフレームワーク

エージェントモジュールは、生の LLM 呼び出しに対するより高レベルな抽象化を提供します。エージェントはプロンプト、モデル、ツールで宣言的に定義され、コンテキスト/ランナーパターンでロード・実行されます。

### エージェント依存関係の追加

`_index.yaml` に追加します:

```yaml
  - name: dep.agent
    kind: ns.dependency
    component: wippy/agent
    version: "*"
    parameters:
      - name: process_host
        value: app:processes
```

### エージェントの定義

エージェントエントリを追加します:

```yaml
  - name: assistant
    kind: registry.entry
    meta:
      type: agent.gen1
      name: assistant
      title: Assistant
      comment: Terminal chat agent
    prompt: |
      You are a helpful terminal assistant. Be concise and direct.
      Answer questions clearly. If you don't know something, say so.
      Do not use emoji in responses.
    model: gpt-4.1-nano
    max_tokens: 1024
    temperature: 0.7
```

### チャットプロセスの更新

エージェントフレームワークに切り替えます。エントリのインポートを更新します:

```yaml
  - name: chat
    kind: process.lua
    meta:
      command:
        name: chat
        short: Start a terminal chat
    source: file://chat.lua
    method: main
    modules:
      - io
      - process
    imports:
      prompt: wippy.llm:prompt
      agent_context: wippy.agent:context
```

`src/chat.lua` を更新します:

```lua
local io = require("io")
local prompt = require("prompt")
local agent_context = require("agent_context")

local function main()
    io.print("Chat (type 'quit' to exit)")
    io.print("")

    local ctx = agent_context.new()
    local runner, err = ctx:load_agent("app:assistant")
    if err then
        io.print("Failed to load agent: " .. tostring(err))
        return
    end

    local conversation = prompt.new()

    while true do
        io.write("> ")
        io.flush()
        local input = io.readline()
        if not input or input == "quit" or input == "exit" then break end
        if input == "" then goto continue end

        conversation:add_user(input)

        local response, gen_err = runner:step(conversation)
        if gen_err then
            io.print("Error: " .. tostring(gen_err))
            goto continue
        end

        io.print(response.result)
        io.print("")
        conversation:add_assistant(response.result)

        ::continue::
    end

    io.print("Bye!")
end

return { main = main }
```

エージェントフレームワークは、エージェント定義（プロンプト、モデル、パラメータ）を実行ロジックから分離します。同じエージェントを異なるコンテキスト、ツール、モデルで実行時にロードできます。

## フェーズ 4: ストリーミング

完全なレスポンスを待つ代わりに、トークンごとにレスポンスをストリーミングします。

### モジュールの更新

プロセスモジュールに `channel` を追加します:

```yaml
    modules:
      - io
      - process
      - channel
```

### ストリーミングの実装

`src/chat.lua` を更新します:

```lua
local io = require("io")
local prompt = require("prompt")
local agent_context = require("agent_context")

local STREAM_TOPIC = "stream"

local function stream_response(runner, conversation, stream_ch)
    local done_ch = channel.new(1)

    coroutine.spawn(function()
        local response, err = runner:step(conversation, {
            stream_target = {
                reply_to = process.pid(),
                topic = STREAM_TOPIC,
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
            local r = result.value
            return full_text, r.response, r.err
        end

        local chunk = result.value
        if chunk.type == "chunk" then
            io.write(chunk.content or "")
            full_text = full_text .. (chunk.content or "")
        elseif chunk.type == "done" then
            local r, ok = done_ch:receive()
            if ok and r then
                return full_text, r.response, r.err
            end
            return full_text, nil, nil
        elseif chunk.type == "error" then
            return nil, nil, chunk.error and chunk.error.message or "stream error"
        end
    end

    return full_text, nil, nil
end

local function main()
    io.print("Chat (type 'quit' to exit)")
    io.print("")

    local ctx = agent_context.new()
    local runner, err = ctx:load_agent("app:assistant")
    if err then
        io.print("Failed to load agent: " .. tostring(err))
        return
    end

    local conversation = prompt.new()
    local stream_ch = process.listen(STREAM_TOPIC)

    while true do
        io.write("> ")
        io.flush()
        local input = io.readline()
        if not input or input == "quit" or input == "exit" then break end
        if input == "" then goto continue end

        conversation:add_user(input)

        local text, _, gen_err = stream_response(runner, conversation, stream_ch)
        if gen_err then
            io.print("Error: " .. tostring(gen_err))
            goto continue
        end

        io.print("")
        if text and text ~= "" then
            conversation:add_assistant(text)
        end

        ::continue::
    end

    process.unlisten(stream_ch)
    io.print("Bye!")
end

return { main = main }
```

主要なパターン:
- `coroutine.spawn` は `runner:step()` を別のコルーチンで実行し、メインコルーチンがストリームチャンクを処理できるようにします
- `channel.select` はストリームチャネルと完了チャネルを多重化します
- `process.listen()` は一度作成され、ターン間で再利用されます
- テキストは会話履歴に追加するために蓄積されます

## フェーズ 5: ツール

エージェントに外部機能にアクセスするためのツールを提供します。

### ツールの定義

`src/tools/_index.yaml` を作成します:

```yaml
version: "1.0"
namespace: app.tools

entries:
  - name: current_time
    kind: function.lua
    meta:
      type: tool
      title: Current Time
      input_schema: |
        { "type": "object", "properties": {}, "additionalProperties": false }
      llm_alias: get_current_time
      llm_description: Get the current date and time in UTC.
    source: file://current_time.lua
    modules: [time]
    method: handler

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
      llm_description: Evaluate a mathematical expression and return the result.
    source: file://calculate.lua
    modules: [expr]
    method: handler
```

ツールメタデータは LLM にツールの機能を伝えます:
- `input_schema` は引数を定義する JSON Schema です
- `llm_alias` は LLM が認識する関数名です
- `llm_description` はツールの使用タイミングを説明します

### ツールの実装

`src/tools/current_time.lua` を作成します:

```lua
local time = require("time")

local function handler()
    local now = time.now()
    return {
        utc = now:format("2006-01-02T15:04:05Z"),
        unix = now:unix(),
    }
end

return { handler = handler }
```

`src/tools/calculate.lua` を作成します:

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

### エージェントへのツール登録

`src/_index.yaml` のエージェントエントリを更新してツールを参照します:

```yaml
  - name: assistant
    kind: registry.entry
    meta:
      type: agent.gen1
      name: assistant
      title: Assistant
      comment: Terminal chat agent
    prompt: |
      You are a helpful terminal assistant. Be concise and direct.
      Answer questions clearly. If you don't know something, say so.
      Use tools when they help answer the question.
      Do not use emoji in responses.
    model: gpt-4.1-nano
    max_tokens: 1024
    temperature: 0.7
    tools:
      - app.tools:current_time
      - app.tools:calculate
```

### ツール実行の追加

チャットプロセスのモジュールに `json` と `funcs` を追加します:

```yaml
    modules:
      - io
      - json
      - process
      - channel
      - funcs
```

`src/chat.lua` をツール実行で更新します:

```lua
local io = require("io")
local json = require("json")
local funcs = require("funcs")
local prompt = require("prompt")
local agent_context = require("agent_context")

local STREAM_TOPIC = "stream"

local function stream_response(runner, conversation, stream_ch)
    local done_ch = channel.new(1)

    coroutine.spawn(function()
        local response, err = runner:step(conversation, {
            stream_target = {
                reply_to = process.pid(),
                topic = STREAM_TOPIC,
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
            local r = result.value
            return full_text, r.response, r.err
        end

        local chunk = result.value
        if chunk.type == "chunk" then
            io.write(chunk.content or "")
            full_text = full_text .. (chunk.content or "")
        elseif chunk.type == "done" then
            local r, ok = done_ch:receive()
            if ok and r then
                return full_text, r.response, r.err
            end
            return full_text, nil, nil
        elseif chunk.type == "error" then
            return nil, nil, chunk.error and chunk.error.message or "stream error"
        end
    end

    return full_text, nil, nil
end

local function execute_tools(tool_calls)
    local results = {}
    for _, tc in ipairs(tool_calls) do
        local args = tc.arguments
        if type(args) == "string" then
            args = json.decode(args) or {}
        end

        io.write("[" .. tc.name .. "] ")
        io.flush()

        local result, err = funcs.call(tc.registry_id, args)
        if err then
            results[tc.id] = { error = tostring(err) }
            io.print("error")
        else
            results[tc.id] = result
            io.print("done")
        end
    end
    return results
end

local function run_turn(runner, conversation, stream_ch)
    while true do
        local text, response, err = stream_response(runner, conversation, stream_ch)
        if err then
            io.print("")
            return nil, err
        end

        if text and text ~= "" then
            io.print("")
        end

        local tool_calls = response and response.tool_calls
        if not tool_calls or #tool_calls == 0 then
            return text, nil
        end

        if text and text ~= "" then
            conversation:add_assistant(text)
        end

        local results = execute_tools(tool_calls)

        for _, tc in ipairs(tool_calls) do
            local result = results[tc.id]
            local result_str = json.encode(result) or "{}"
            conversation:add_function_call(tc.name, tc.arguments, tc.id)
            conversation:add_function_result(tc.name, result_str, tc.id)
        end
    end
end

local function main()
    io.print("Terminal Agent (type 'quit' to exit)")
    io.print("")

    local ctx = agent_context.new()
    local runner, err = ctx:load_agent("app:assistant")
    if err then
        io.print("Failed to load agent: " .. tostring(err))
        return
    end

    local conversation = prompt.new()
    local stream_ch = process.listen(STREAM_TOPIC)

    while true do
        io.write("> ")
        io.flush()
        local input = io.readline()
        if not input or input == "quit" or input == "exit" then break end
        if input == "" then goto continue end

        conversation:add_user(input)

        local text, gen_err = run_turn(runner, conversation, stream_ch)
        if gen_err then
            io.print("Error: " .. tostring(gen_err))
            goto continue
        end
        if text and text ~= "" then
            conversation:add_assistant(text)
        end

        ::continue::
    end

    process.unlisten(stream_ch)
    io.print("Bye!")
end

return { main = main }
```

ツール実行ループ:
1. ストリーミング付きで `runner:step()` を呼び出す
2. レスポンスに `tool_calls` が含まれていれば、`funcs.call()` で各ツールを実行
3. ツール呼び出しと結果を会話に追加
4. エージェントが結果を取り込むためにステップ 1 に戻る
5. ツール呼び出しがなくなったら、最終テキストを返す

### エージェントの実行

```bash
wippy update
wippy run chat
```

```
Terminal Agent (type 'quit' to exit)

> what time is it?
[get_current_time] done
The current time is 17:20 UTC on February 12, 2026.

> what is 125 * 16?
[calculate] done
125 * 16 = 2000.

> quit
Bye!
```

## 次のステップ

- [LLM モジュール](../framework/llm.md) - 完全な LLM API リファレンス
- [エージェントモジュール](../framework/agents.md) - エージェントフレームワークリファレンス
- [CLI アプリケーション](cli.md) - ターミナル I/O パターン
- [プロセス](processes.md) - プロセスモデルとコミュニケーション
