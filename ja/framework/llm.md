# LLM

`wippy/llm` モジュールは、複数のプロバイダー（OpenAI、Anthropic、Google、ローカルモデル）の大規模言語モデルを操作するための統一インターフェースを提供します。テキスト生成、ツール呼び出し、構造化出力、エンベディング、ストリーミングに対応しています。

## セットアップ

プロジェクトにモジュールを追加します:

```bash
wippy add wippy/llm
wippy install
```

`_index.yaml` で依存関係を宣言します。LLM モジュールには環境ストレージ（APIキー用）とプロセスホストが必要です:

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
```

`env.storage.os` エントリは、OS 環境変数を LLM プロバイダーに公開します。APIキーを環境変数として設定してください（例: `OPENAI_API_KEY`、`ANTHROPIC_API_KEY`）。

## テキスト生成

エントリに `llm` ライブラリをインポートし、`generate()` を呼び出します:

```yaml
entries:
  - name: ask
    kind: function.lua
    source: file://ask.lua
    method: handler
    imports:
      llm: wippy.llm:llm
```

```lua
local llm = require("llm")

local function handler()
    local response, err = llm.generate("What are the three laws of robotics?", {
        model = "gpt-4o"
    })

    if err then
        return nil, err
    end

    return response.result
end

return { handler = handler }
```

`generate()` の第1引数には、文字列プロンプト、プロンプトビルダー、またはメッセージのテーブルを指定できます。第2引数はオプションテーブルです。

### 生成オプション

| オプション | 型 | 説明 |
|--------|------|-------------|
| `model` | string | モデル名またはクラス（必須） |
| `temperature` | number | ランダム性の制御、0-1 |
| `max_tokens` | number | 生成する最大トークン数 |
| `top_p` | number | Nucleus サンプリングパラメータ |
| `top_k` | number | Top-k フィルタリング |
| `thinking_effort` | number | 思考の深さ 0-100（思考機能を持つモデル） |
| `tools` | table | ツール定義の配列 |
| `tool_choice` | string | `"auto"`、`"none"`、`"any"`、またはツール名 |
| `stream` | table | ストリーミング設定: `{ reply_to, topic, buffer_size }` |
| `timeout` | number | リクエストタイムアウト（秒単位、デフォルト 600） |

### レスポンス構造

| フィールド | 型 | 説明 |
|-------|------|-------------|
| `result` | string | 生成されたテキストコンテンツ |
| `tokens` | table | トークン使用量: `prompt_tokens`、`completion_tokens`、`thinking_tokens`、`total_tokens` |
| `finish_reason` | string | 生成が停止した理由: `"stop"`、`"length"`、`"tool_call"` |
| `tool_calls` | table? | ツール呼び出しの配列（モデルがツールを呼び出した場合） |
| `metadata` | table | プロバイダー固有のメタデータ |
| `usage_record` | table? | 使用量追跡レコード |

## プロンプトビルダー

マルチターン会話や複雑なプロンプトには、プロンプトビルダーを使用します:

```yaml
imports:
  llm: wippy.llm:llm
  prompt: wippy.llm:prompt
```

```lua
local llm = require("llm")
local prompt = require("prompt")

local conversation = prompt.new()
conversation:add_system("You are a helpful assistant.")
conversation:add_user("What is the capital of France?")

local response, err = llm.generate(conversation, {
    model = "gpt-4o",
    temperature = 0.7,
    max_tokens = 500
})
```

### ビルダーメソッド

| メソッド | 説明 |
|--------|-------------|
| `prompt.new()` | 空のビルダーを作成 |
| `prompt.with_system(content)` | システムメッセージ付きでビルダーを作成 |
| `:add_system(content, meta?)` | システムメッセージを追加 |
| `:add_user(content, meta?)` | ユーザーメッセージを追加 |
| `:add_assistant(content, meta?)` | アシスタントメッセージを追加 |
| `:add_developer(content, meta?)` | 開発者メッセージを追加 |
| `:add_message(role, content_parts, name?, meta?)` | ロールとコンテンツパーツを指定してメッセージを追加 |
| `:add_function_call(name, args, id?)` | アシスタントからのツール呼び出しを追加 |
| `:add_function_result(name, result, id?)` | ツール実行結果を追加 |
| `:add_cache_marker(id?)` | キャッシュ境界をマーク（Claude モデル） |
| `:get_messages()` | メッセージ配列を取得 |
| `:build()` | `llm.generate()` 用の `{ messages = ... }` テーブルを取得 |
| `:clone()` | ビルダーのディープコピーを作成 |
| `:clear()` | すべてのメッセージを削除 |

すべての `add_*` メソッドはチェーン呼び出しのためにビルダーを返します。

### マルチターン会話

メッセージを追加してターン間のコンテキストを構築します:

```lua
local conversation = prompt.new()
conversation:add_system("You are a helpful assistant.")

-- first turn
conversation:add_user("What is Lua?")
local r1 = llm.generate(conversation, { model = "gpt-4o" })
conversation:add_assistant(r1.result)

-- second turn with full context
conversation:add_user("What makes it different from Python?")
local r2 = llm.generate(conversation, { model = "gpt-4o" })
```

### マルチモーダルコンテンツ

テキストと画像を1つのメッセージに組み合わせます:

```lua
local conversation = prompt.new()
conversation:add_message(prompt.ROLE.USER, {
    prompt.text("What's in this image?"),
    prompt.image("https://example.com/photo.jpg")
})
```

| 関数 | 説明 |
|----------|-------------|
| `prompt.text(content)` | テキストコンテンツパーツ |
| `prompt.image(url, mime_type?)` | URL からの画像 |
| `prompt.image_base64(mime_type, data)` | Base64 エンコードされた画像 |

### ロール定数

| 定数 | 値 |
|----------|-------|
| `prompt.ROLE.SYSTEM` | `"system"` |
| `prompt.ROLE.USER` | `"user"` |
| `prompt.ROLE.ASSISTANT` | `"assistant"` |
| `prompt.ROLE.DEVELOPER` | `"developer"` |
| `prompt.ROLE.FUNCTION_CALL` | `"function_call"` |
| `prompt.ROLE.FUNCTION_RESULT` | `"function_result"` |

### クローン

オリジナルを変更せずにバリエーションを作成するには、ビルダーをクローンします:

```lua
local base = prompt.new()
base:add_system("You are a helpful assistant.")

local conv1 = base:clone()
conv1:add_user("What is AI?")

local conv2 = base:clone()
conv2:add_user("What is ML?")
```

## ストリーミング

プロセス通信を使用してリアルタイムでレスポンスをストリーミングします。これには `process.lua` エントリが必要です:

```lua
local llm = require("llm")

local TOPIC = "llm_stream"

local function main()
    local stream_ch = process.listen(TOPIC)

    local response = llm.generate("Write a short story", {
        model = "gpt-4o",
        stream = {
            reply_to = process.pid(),
            topic = TOPIC,
        },
    })

    while true do
        local chunk, ok = stream_ch:receive()
        if not ok then break end

        if chunk.type == "chunk" then
            io.write(chunk.content)
        elseif chunk.type == "thinking" then
            io.write(chunk.content)
        elseif chunk.type == "error" then
            io.print("Error: " .. chunk.error.message)
            break
        elseif chunk.type == "done" then
            break
        end
    end

    process.unlisten(stream_ch)
end
```

### チャンクタイプ

| タイプ | フィールド | 説明 |
|------|--------|-------------|
| `"chunk"` | `content` | テキストコンテンツの断片 |
| `"thinking"` | `content` | モデルの思考プロセス |
| `"tool_call"` | `name`, `arguments`, `id` | ツール呼び出し |
| `"error"` | `error.message`, `error.type` | ストリームエラー |
| `"done"` | `meta` | ストリーム完了 |

<note>
ストリーミングには <code>process.lua</code> エントリが必要です。Wippy のプロセス通信システム（<code>process.pid()</code>、<code>process.listen()</code>）を使用するためです。
</note>

## ツール呼び出し

インラインスキーマとしてツールを定義し、`generate()` に渡します:

```lua
local llm = require("llm")
local prompt = require("prompt")
local json = require("json")

local tools = {
    {
        name = "get_weather",
        description = "Get current weather for a location",
        schema = {
            type = "object",
            properties = {
                location = { type = "string", description = "City name" },
            },
            required = { "location" },
        },
    },
}

local conversation = prompt.new()
conversation:add_user("What's the weather in Tokyo?")

local response = llm.generate(conversation, {
    model = "gpt-4o",
    tools = tools,
    tool_choice = "auto",
})

if response.tool_calls and #response.tool_calls > 0 then
    for _, tc in ipairs(response.tool_calls) do
        -- execute the tool and get a result
        local result = { temperature = 22, condition = "sunny" }

        -- add the exchange to the conversation
        conversation:add_function_call(tc.name, tc.arguments, tc.id)
        conversation:add_function_result(tc.name, json.encode(result), tc.id)
    end

    -- continue generation with tool results
    local final = llm.generate(conversation, { model = "gpt-4o" })
    print(final.result)
end
```

### ツール呼び出しフィールド

| フィールド | 型 | 説明 |
|-------|------|-------------|
| `id` | string | 一意の呼び出し識別子 |
| `name` | string | ツール名 |
| `arguments` | table | スキーマに一致するパース済み引数 |

### ツール選択

| 値 | 動作 |
|-------|----------|
| `"auto"` | モデルがツールを使用するかどうかを決定（デフォルト） |
| `"none"` | ツールを使用しない |
| `"any"` | 少なくとも1つのツールを使用する必要がある |
| `"tool_name"` | 指定されたツールを使用する必要がある |

## 構造化出力

スキーマに一致する検証済み JSON を生成します:

```lua
local llm = require("llm")

local schema = {
    type = "object",
    properties = {
        name = { type = "string" },
        age = { type = "number" },
        hobbies = {
            type = "array",
            items = { type = "string" },
        },
    },
    required = { "name", "age", "hobbies" },
    additionalProperties = false,
}

local response, err = llm.structured_output(schema, "Describe a fictional character", {
    model = "gpt-4o",
})

if not err then
    print(response.result.name)
    print(response.result.age)
end
```

<tip>
OpenAI モデルの場合、すべてのプロパティを <code>required</code> 配列に含める必要があります。オプションフィールドにはユニオン型を使用してください: <code>type = {"string", "null"}</code>。<code>additionalProperties = false</code> を設定してください。
</tip>

## モデル設定

モデルは `meta.type: llm.model` を持つレジストリエントリとして定義されます:

```yaml
entries:
  - name: gpt-4o
    kind: registry.entry
    meta:
      name: gpt-4o
      type: llm.model
      title: GPT-4o
      comment: OpenAI's flagship model
      capabilities:
        - generate
        - tool_use
        - structured_output
        - vision
      class:
        - balanced
      priority: 100
    max_tokens: 128000
    output_tokens: 16384
    pricing:
      input: 2.5
      output: 10
    providers:
      - id: wippy.llm.openai:provider
        provider_model: gpt-4o
```

### モデルエントリフィールド

| フィールド | 説明 |
|-------|-------------|
| `meta.name` | API 呼び出しで使用されるモデル識別子 |
| `meta.type` | `llm.model` である必要があります |
| `meta.capabilities` | 機能リスト: `generate`、`tool_use`、`structured_output`、`embed`、`thinking`、`vision`、`caching` |
| `meta.class` | クラスメンバーシップ: `fast`、`balanced`、`reasoning` など |
| `meta.priority` | クラスベース解決の数値優先度（高い方が優先） |
| `max_tokens` | 最大コンテキストウィンドウ |
| `output_tokens` | 最大出力トークン数 |
| `pricing` | 100万トークンあたりのコスト: `input`、`output` |
| `providers` | `id`（プロバイダーエントリ）と `provider_model`（プロバイダー固有のモデル名）を含む配列 |

### ローカルモデル

ローカルでホストされたモデル（LM Studio、Ollama）の場合、カスタム `base_url` を持つ別のプロバイダーエントリを定義します:

```yaml
  - name: local_provider
    kind: registry.entry
    meta:
      name: ollama
      type: llm.provider
      title: Ollama Local
    driver:
      id: wippy.llm.openai:driver
      options:
        api_key_env: none
        base_url: http://127.0.0.1:11434/v1

  - name: local-llama
    kind: registry.entry
    meta:
      name: local-llama
      type: llm.model
      title: Local Llama
      capabilities:
        - generate
    max_tokens: 4096
    output_tokens: 4096
    pricing:
      input: 0
      output: 0
    providers:
      - id: app:local_provider
        provider_model: llama-3.2
```

## モデル解決

モデルは正確な名前、クラス、または明示的なクラスプレフィックスで参照できます:

```lua
-- exact model name
llm.generate("Hello", { model = "gpt-4o" })

-- model class (picks highest priority in that class)
llm.generate("Hello", { model = "fast" })

-- explicit class syntax
llm.generate("Hello", { model = "class:reasoning" })
```

解決順序:
1. 正確な `meta.name` で一致
2. クラス名で一致（`meta.priority` が最も高いものが優先）
3. `class:` プレフィックス付きの場合、そのクラス内のみを検索

## モデルディスカバリー

実行時に利用可能なモデルとその機能を照会します:

```lua
local llm = require("llm")

-- all models
local models = llm.available_models()

-- filter by capability
local tool_models = llm.available_models("tool_use")
local embed_models = llm.available_models("embed")

-- list model classes
local classes = llm.get_classes()
for _, c in ipairs(classes) do
    print(c.name .. ": " .. c.title)
end
```

## エンベディング

セマンティック検索用のベクトルエンベディングを生成します:

```lua
local llm = require("llm")

-- single text
local response = llm.embed("The quick brown fox", {
    model = "text-embedding-3-small",
    dimensions = 512,
})
-- response.result is a float array

-- multiple texts
local response = llm.embed({
    "First document",
    "Second document",
}, { model = "text-embedding-3-small" })
-- response.result is an array of float arrays
```

## エラーハンドリング

エラーは第2戻り値として返されます。エラー時、第1戻り値は `nil` です:

```lua
local response, err = llm.generate("Hello", { model = "gpt-4o" })

if err then
    io.print("Error: " .. tostring(err))
    return
end

io.print(response.result)
```

### エラータイプ

| 定数 | 説明 |
|----------|-------------|
| `llm.ERROR_TYPE.INVALID_REQUEST` | 不正なリクエスト |
| `llm.ERROR_TYPE.AUTHENTICATION` | 無効な API キー |
| `llm.ERROR_TYPE.RATE_LIMIT` | プロバイダーのレート制限超過 |
| `llm.ERROR_TYPE.SERVER_ERROR` | プロバイダーのサーバーエラー |
| `llm.ERROR_TYPE.CONTEXT_LENGTH` | 入力がコンテキストウィンドウを超過 |
| `llm.ERROR_TYPE.CONTENT_FILTER` | 安全システムによるコンテンツフィルタリング |
| `llm.ERROR_TYPE.TIMEOUT` | リクエストタイムアウト |
| `llm.ERROR_TYPE.MODEL_ERROR` | 無効または利用不可のモデル |

### 終了理由

| 定数 | 説明 |
|----------|-------------|
| `llm.FINISH_REASON.STOP` | 正常完了 |
| `llm.FINISH_REASON.LENGTH` | 最大トークン数に到達 |
| `llm.FINISH_REASON.CONTENT_FILTER` | コンテンツがフィルタリングされた |
| `llm.FINISH_REASON.TOOL_CALL` | モデルがツール呼び出しを行った |
| `llm.FINISH_REASON.ERROR` | 生成中にエラーが発生 |

## ケイパビリティ

| 定数 | 説明 |
|----------|-------------|
| `llm.CAPABILITY.GENERATE` | テキスト生成 |
| `llm.CAPABILITY.TOOL_USE` | ツール/関数呼び出し |
| `llm.CAPABILITY.STRUCTURED_OUTPUT` | JSON 構造化出力 |
| `llm.CAPABILITY.EMBED` | ベクトルエンベディング |
| `llm.CAPABILITY.THINKING` | 拡張思考 |
| `llm.CAPABILITY.VISION` | 画像理解 |
| `llm.CAPABILITY.CACHING` | プロンプトキャッシュ |

## 関連項目

- [エージェント](agents.md) - ツール、デリゲート、メモリを備えたエージェントフレームワーク
- [LLM エージェントの構築](../tutorials/llm-agent.md) - ステップバイステップのチュートリアル
- [フレームワーク概要](overview.md) - フレームワークモジュールの使用方法
