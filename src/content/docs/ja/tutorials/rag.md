---
title: "Retrieval-Augmented Generation (RAG)"
---

# Retrieval-Augmented Generation (RAG)

自分のドキュメントから質問に答えるナレッジベースを構築します。このチュートリアルでは、ベクトル検索に `wippy/embeddings` モジュールを、生成に LLM フレームワークを使用します。

## 構築するもの

最小限の RAG パイプライン：

1. マークダウンドキュメントを取り込む — チャンクに分割し、埋め込み、永続化。
2. 取得 — ベクトル検索がクエリに最も関連するチャンクを返します。
3. 生成 — LLM 呼び出しが取得したチャンクをグラウンディングコンテキストとして使用。

## 前提条件

- データベース: `db.sql.sqlite` (`vec0` サポートを含む) または `pgvector` 拡張機能を持つ `db.sql.postgres`。
- 埋め込みモデル (例: `text-embedding-3-small`) で構成された LLM プロバイダー — [LLM フレームワーク](framework/llm.md) を参照。
- Wippy プロジェクトがブートストラップされている (`wippy init`、`wippy add wippy/embeddings`)。

## 依存関係

`wippy/embeddings` 依存関係を宣言し、データベースを指します。`target_db` パラメータは、埋め込みテーブルが存在するデータベースエントリの Registry ID です：

```yaml
version: "1.0"
namespace: app

entries:
  - name: db
    kind: db.sql.sqlite
    file: ./data/app.db
    lifecycle:
      auto_start: true

  - name: embeddings
    kind: ns.dependency
    component: wippy/embeddings
    version: "*"
    parameters:
      - name: target_db
        value: app:db
```

`wippy/embeddings` は `wippy/llm` と、`embeddings_512` テーブル (PostgreSQL `pgvector` または SQLite `vec0` 仮想テーブル) を作成するマイグレーションをプルインします。

## ドキュメントの取り込み

分割は `text` モジュールによって処理されます。埋め込みと永続化は `embeddings` ライブラリによって処理されます。

```lua
-- app/ingest.lua
local text = require("text")
local embeddings = require("embeddings")
local uuid = require("uuid")

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

関数とそのインポートを登録します：

```yaml
- name: ingest
  kind: function.lua
  source: file://app/ingest.lua
  method: ingest
  modules:
    - text
    - uuid
  imports:
    embeddings: wippy.embeddings:embeddings
```

重要な点：

- `origin_id` は同じソースドキュメントに属するチャンクをグループ化します。
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
local hits = embeddings.find_by_origin("refund policy", "doc-42", { limit = 3 })
```

## 回答の生成

取得したチャンクをプロンプトに構成して LLM を呼び出します。ここでは、取得されたテキストがシステムプロンプトに追加されます。ユーザーの質問がユーザーターンになります：

```lua
-- app/answer.lua
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
  source: file://app/answer.lua
  method: answer
  imports:
    embeddings: wippy.embeddings:embeddings
    llm: wippy.llm:llm
    prompt: wippy.llm:prompt
```

## エンドツーエンドの例

HTTP エンドポイントの背後にまとめます：

```yaml
version: "1.0"
namespace: app

entries:
  - name: db
    kind: db.sql.sqlite
    file: ./data/app.db
    lifecycle:
      auto_start: true

  - name: embeddings
    kind: ns.dependency
    component: wippy/embeddings
    version: "*"
    parameters:
      - name: target_db
        value: app:db

  - name: ingest
    kind: function.lua
    source: file://app/ingest.lua
    method: ingest
    modules:
      - text
      - uuid
    imports:
      embeddings: wippy.embeddings:embeddings

  - name: answer
    kind: function.lua
    source: file://app/answer.lua
    method: answer
    imports:
      embeddings: wippy.embeddings:embeddings
      llm: wippy.llm:llm
      prompt: wippy.llm:prompt

  - name: gateway
    kind: http.service
    addr: ":8080"
    lifecycle:
      auto_start: true

  - name: api
    kind: http.router
    meta:
      server: app:gateway
    prefix: /api

  - name: ask
    kind: http.endpoint
    meta:
      router: app:api
    method: POST
    path: /ask
    func: app:answer_http

  - name: answer_http
    kind: function.lua
    source: file://app/answer_http.lua
    method: handler
    modules:
      - http
    imports:
      answer: app:answer
```

```lua
-- app/answer_http.lua
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

セットアッププロセスまたは CLI コマンド (`meta.command` を持つ `process.lua`) から `ingest` を呼び出してインデックスをシードし、クエリを実行します：

```bash
curl -X POST http://localhost:8080/api/ask \
    -H 'Content-Type: application/json' \
    -d '{"question":"how do I configure TLS?"}'
```

## 運用上の注意

- **チャンクサイズ**: 500〜1000 トークンが良い出発点です。小さすぎるとローカルコンテキストが失われ、大きすぎると類似度スコアが希釈されます。境界を越えて文を保持するために `chunk_overlap` (チャンクサイズの約 10〜20%) を使用します。
- **コンテンツタイプ**: 検索がタイプでフィルタリングできるように、異なる `content_type` 値 (`doc_chunk`、`faq`、`code_snippet`) を使用します。
- **再インデックス**: 新しいチャンクを追加する前に、`embedding_repo.delete_by_origin(doc_id)` によってドキュメントごとに削除して再取り込みします。
- **ハイブリッド検索**: 正確な用語の再現 (名前、ID) のために、ベクトル検索とソーステーブルの全文検索を組み合わせ、再ランク付けします。
- **モデル選択**: デフォルトの 512 次元 `text-embedding-3-small` はコスト効率が高いです。再現が不十分な場合にのみ 1024 または 3072 次元にアップグレードします — より大きなベクトルはより大きなストレージと遅い検索を意味します。

## 次のステップ

- [LLM フレームワーク](framework/llm.md) — `llm.generate`、`llm.embed`、プロンプト構築
- [エージェント](framework/agents.md) — リトリーバーをエージェントツールとしてラップ
- [SQL モジュール](lua/storage/sql.md) — 基礎となるデータベースアクセス
- [Text モジュール](lua/text/text.md) — スプリッターとトークン化
