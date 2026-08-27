---
title: "Retrieval-Augmented Generation (RAG)"
description: "自分のドキュメントから質問に答えるナレッジベースを構築します。このチュートリアルでは、ベクトル検索に wippy/embeddings モジュールを、生成に LLM フレームワークを使用します。"
---

# Retrieval-Augmented Generation (RAG)

自分のドキュメントから質問に答えるナレッジベースを構築します。このチュートリアルでは、ベクトル検索に `wippy/embeddings` モジュールを、生成に LLM フレームワークを使用します。

**分類: 部分的なアプリケーションレシピ。** 検索コードは完全ですが、単体アプリケーションではなく
Wippyアプリケーションテンプレートへの統合です。認証、セキュリティポリシー、プロバイダーとモデルの設定、
bootloader、マイグレーションの配線はテンプレートが所有します。

## 構築するもの

最小限の RAG パイプライン：

1. マークダウンドキュメントを取り込む — チャンクに分割し、埋め込み、永続化。
2. 取得 — ベクトル検索がクエリに最も関連するチャンクを返します。
3. 生成 — LLM 呼び出しが取得したチャンクをグラウンディングコンテキストとして使用。

## 前提条件

- [Wippyアプリケーションテンプレート](https://github.com/wippyai/app)を基にし、`app:db`、
  `app:processes`、`app.env:store`、bootloaderとmigration依存関係を備えたアプリ。
- ランタイムのSQLite（`vec0`を含む）、または起動前に`pgvector`拡張を有効にしたPostgreSQL。
- アプリの設定済みLLM環境ストレージから利用できる`OPENAI_API_KEY`。
- `text-embedding-3-small`（capability `embed`、OpenAI provider）と`gpt-4o-mini`
  （capability `generate`、OpenAI provider）という名前のレジストリモデルエントリ。
  embeddingsパッケージは前者を名前で直接呼び出し、512次元を要求します。

## 依存関係

`src/app/deps/_index.yaml`へ`wippy/embeddings`依存関係を追加し、対象データベースをバインドします：

```yaml
  - name: embeddings
    kind: ns.dependency
    component: wippy/embeddings
    version: "*"
    parameters:
      - name: target_db
        value: app:db

```

アプリケーションテンプレートがすでに提供する依存関係を再宣言しないでください。既存の`wippy/migration`が
`app_db`を`app:db`へ、既存の`wippy/bootloader`が`application_host`を`app:processes`へ、
`env_storage`を`app.env:store`へバインドしていることを確認します。

`wippy/embeddings`は`embeddings_512`（PostgreSQL `pgvector`またはSQLite `vec0`）を作る
マイグレーションを提供します。`wippy/migration`がそれを検出し、自動起動するbootloaderが`wippy run -c`中に適用します。
このレシピに独立したスキーマコマンドはありません。

依存エントリを編集したら、グラフを解決してインストールします：

```bash
wippy update
wippy install
```

## ドキュメントの取り込み

分割は `text` モジュールによって処理されます。埋め込みと永続化は `embeddings` ライブラリによって処理されます。

```lua
-- src/app/ingest.lua
local text = require("text")
local embeddings = require("embeddings")

local function ingest(doc_id, title, markdown)
    local splitter, err = text.splitter.markdown({
        chunk_size = 800,
        chunk_overlap = 100,
        heading_hierarchy = true,
        code_blocks = true,
    })
    if err then return nil, err end

    local chunks, split_err = splitter:split_text(markdown)
    if split_err then return nil, split_err end

    local batch = {}
    for i, chunk in ipairs(chunks) do
        table.insert(batch, {
            content = chunk,
            content_type = "doc_chunk",
            origin_id = doc_id,
            context_id = tostring(i),
            meta = { title = title, chunk = i },
        })
    end

    return embeddings.add_batch(batch)
end

return { ingest = ingest }
```

関数とimportsを`src/app/_index.yaml`へ登録します：

```yaml
- name: ingest
  kind: function.lua
  source: file://ingest.lua
  method: ingest
  modules:
    - text
  imports:
    embeddings: wippy.embeddings:embeddings
```

重要な点：

- `origin_id`は同じソースドキュメントに属するチャンクをグループ化します。PostgreSQLではこのフィールドを
  `UUID`として保存するため、両方のデータベースで動かす場合はUUID値を使用してください。
- `context_id` はオプションのサブキー (セクション、ページ、チャンクインデックス) です。
- `add_batch` は合計トークンが 8000 トークンのリクエスト制限を超える場合に自動的に分割します。

## 取得

ベクトル検索は、類似度スコアとともに、クエリに最も類似したチャンクを返します：

```lua
local embeddings = require("embeddings")

local results, err = embeddings.search("how do I configure TLS?", {
    content_type = "doc_chunk",
    limit = 5,
})

-- results[i].content, .similarity, .meta, .origin_id, .context_id
```

特定のドキュメントに回答をグラウンドしたい場合は、origin でフィルタリングします：

```lua
local hits = embeddings.find_by_origin(
    "refund policy",
    "91e6f640-2d18-4eb9-a868-1ec4a894ddf6",
    { limit = 3 }
)
```

## 回答の生成

取得したチャンクをプロンプトに構成して LLM を呼び出します。ここでは、取得されたテキストがシステムプロンプトに追加されます。ユーザーの質問がユーザーターンになります：

```lua
-- src/app/answer.lua
local embeddings = require("embeddings")
local llm = require("llm")
local prompt = require("prompt")

local SYSTEM = [[
Answer using only the provided context. If the context does not contain
the answer, say you don't know. Cite the chunk title for each claim.
]]

local function format_context(hits)
    local parts = {}
    for i, h in ipairs(hits) do
        local title = h.meta and h.meta.title or h.origin_id
        table.insert(parts,
            string.format("[%d] %s\n%s", i, title, h.content))
    end
    return table.concat(parts, "\n\n")
end

local function answer(question)
    local hits, err = embeddings.search(question, { limit = 4 })
    if err then return nil, err end

    local p = prompt.new()
    p:add_system(SYSTEM)
    p:add_system("Context:\n\n" .. format_context(hits))
    p:add_user(question)

    local response, gen_err = llm.generate(p, { model = "gpt-4o-mini" })
    if gen_err then return nil, gen_err end

    return {
        answer = response.result,
        sources = hits,
    }
end

return { answer = answer }
```

```yaml
- name: answer
  kind: function.lua
  source: file://answer.lua
  method: answer
  imports:
    embeddings: wippy.embeddings:embeddings
    llm: wippy.llm:llm
    prompt: wippy.llm:prompt
```

同じ`src/app/_index.yaml`へanswer関数を登録します。

## エンドツーエンドの例

次のエントリを`src/app/_index.yaml`へ追記します。`ingest`と`answer`、テンプレートのデータベース、gateway、routerを重複して定義しないでください：

```yaml
  - name: ask
    kind: http.endpoint
    meta:
      router: app:api
    method: POST
    path: /ask
    func: app:answer_http

  - name: answer_http
    kind: function.lua
    source: file://answer_http.lua
    method: handler
    modules:
      - http
    imports:
      answer: app:answer
```

```lua
-- src/app/answer_http.lua
local http = require("http")
local answer = require("answer")

local function handler()
    local req = http.request()
    local res = http.response()

    local body, err = req:body_json()
    if err or not body or not body.question then
        res:set_status(http.STATUS.BAD_REQUEST)
        res:write_json({ error = "question is required" })
        return
    end

    local result, ans_err = answer.answer(body.question)
    if ans_err then
        res:set_status(http.STATUS.INTERNAL_ERROR)
        res:write_json({ error = ans_err })
        return
    end

    res:write_json(result)
end

return { handler = handler }
```

アプリを起動し、migration bootloaderにベクトルテーブルを作成させます：

```bash
wippy run -c
```

認証済みsetup関数または名前付きプロセスから`app:ingest`を呼び出してインデックスをシードします。
具体的なシード用インターフェースはアプリケーション側の責任なので、未認証の書き込みエンドポイントは公開しません。
少なくとも1つのドキュメントを取り込んだら、アプリケーションのセッションBearerを使って保護されたAPIを呼び出します：

```bash
curl -X POST http://localhost:8080/api/v1/ask \
    -H 'Authorization: Bearer <app-session-token>' \
    -H 'Content-Type: application/json' \
    -d '{"question":"how do I configure TLS?"}'
```

成功レスポンスは次の形になります。回答文、similarity値、ヒット順はプロバイダーとインデックス内容によって異なります：

```json
{
  "answer": "...",
  "sources": [
    {
      "content": "...",
      "content_type": "doc_chunk",
      "origin_id": "91e6f640-2d18-4eb9-a868-1ec4a894ddf6",
      "context_id": "1",
      "similarity": 0.82,
      "meta": { "title": "TLS guide", "chunk": 1 }
    }
  ]
}
```

## 運用上の注意

- **チャンクサイズ**: 500〜1000 トークンが良い出発点です。小さすぎるとローカルコンテキストが失われ、大きすぎると類似度スコアが希釈されます。境界を越えて文を保持するために `chunk_overlap` (チャンクサイズの約 10〜20%) を使用します。
- **コンテンツタイプ**: 検索がタイプでフィルタリングできるように、異なる `content_type` 値 (`doc_chunk`、`faq`、`code_snippet`) を使用します。
- **再インデックス**: 新しいチャンクを追加する前に、`embedding_repo.delete_by_origin(doc_id)` によってドキュメントごとに削除して再取り込みします。
- **ハイブリッド検索**: 正確な用語の再現 (名前、ID) のために、ベクトル検索とソーステーブルの全文検索を組み合わせ、再ランク付けします。
- **モデル選択**: デフォルトの 512 次元 `text-embedding-3-small` はコスト効率が高いです。再現が不十分な場合にのみ 1024 または 3072 次元にアップグレードします — より大きなベクトルはより大きなストレージと遅い検索を意味します。

## 次のステップ

- [LLMフレームワーク](../framework/llm.md) — `llm.generate`、`llm.embed`、プロンプト構築
- [エージェント](../framework/agents.md) — リトリーバーをエージェントツールとしてラップ
- [SQLモジュール](../lua/storage/sql.md) — 基礎となるデータベースアクセス
- [Textモジュール](../lua/text/text.md) — 文字ベースのテキスト分割
