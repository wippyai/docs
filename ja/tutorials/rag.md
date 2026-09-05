---
title: "Retrieval-Augmented Generation (RAG)"
description: "自分のドキュメントから質問に答えるナレッジベースを構築します。このチュートリアルでは、ベクトル検索に wippy/embeddings モジュールを、生成に LLM フレームワークを使用します。"
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
- 環境変数の `OPENAI_API_KEY` — 埋め込みと生成の呼び出しはこれを経由します。

プロジェクトを作成し、モジュールをインストールします：

```bash
mkdir rag && cd rag
mkdir -p src/app data
wippy init
wippy add wippy/embeddings
wippy add wippy/migration
wippy add wippy/bootloader
wippy add wippy/security
wippy install
```

```
rag/
├── wippy.lock
├── data/
└── src/
    ├── _index.yaml
    ├── env/
    │   └── _index.yaml
    └── app/
        ├── ingest.lua
        ├── answer.lua
        ├── answer_http.lua
        └── seed.lua
```

## 依存関係

`wippy/embeddings` 依存関係を宣言し、データベースを指します。`target_db` パラメータは、埋め込みテーブルが存在するデータベースエントリの Registry ID です。`wippy/embeddings` は `wippy/llm` と `embeddings_512` テーブルを作成するマイグレーションをプルインするため、`wippy/migration` と `wippy/bootloader` の配線も必要です。ブートローダーは起動時にマイグレーションを実行し、ブートローダーと LLM モジュールはどちらも `wippy/security` が提供する `wippy.security:process` ポリシーグループの下でプロセスを実行します：

```yaml
# src/_index.yaml
version: "1.0"
namespace: app

entries:
  - name: db
    kind: db.sql.sqlite
    file: ./data/app.db
    lifecycle:
      auto_start: true

  - name: processes
    kind: process.host
    lifecycle:
      auto_start: true

  - name: embeddings
    kind: ns.dependency
    component: wippy/embeddings
    version: "*"
    parameters:
      - name: target_db
        value: app:db

  - name: migration
    kind: ns.dependency
    component: wippy/migration
    version: "*"
    parameters:
      - name: app_db
        value: app:db

  - name: bootloader
    kind: ns.dependency
    component: wippy/bootloader
    version: "*"
    parameters:
      - name: application_host
        value: app:processes
      - name: env_storage
        value: app.env:store

  - name: security
    kind: ns.dependency
    component: wippy/security
    version: "*"
```

ブートローダーは生成した `ENCRYPTION_KEY` を永続化するため、書き込み可能な環境ストアが必要です：

```yaml
# src/env/_index.yaml
version: "1.0"
namespace: app.env

entries:
  - name: file
    kind: env.storage.file
    auto_create: true
    file_path: .env
    lifecycle:
      auto_start: true

  - name: os
    kind: env.storage.os
    lifecycle:
      auto_start: true

  - name: store
    kind: env.storage.router
    lifecycle:
      auto_start: true
    storages:
      - app.env:file
      - app.env:os
```

## モデル

`wippy/embeddings` は `text-embedding-3-small` で `llm.embed` を呼び出し、以下の生成では `gpt-4o-mini` を使用します。どちらもレジストリから解決されるため、`src/_index.yaml` にも宣言します：

```yaml
  - name: text-embedding-3-small
    kind: registry.entry
    meta:
      name: text-embedding-3-small
      type: llm.model
      title: Text Embedding 3 Small
      capabilities:
        - embed
    dimensions: 512
    max_tokens: 8191
    pricing:
      input: 0.02
      output: 0
    providers:
      - id: wippy.llm.openai:provider
        provider_model: text-embedding-3-small

  - name: gpt-4o-mini
    kind: registry.entry
    meta:
      name: gpt-4o-mini
      type: llm.model
      title: GPT-4o mini
      capabilities:
        - generate
    max_tokens: 128000
    output_tokens: 16384
    pricing:
      input: 0.15
      output: 0.6
    providers:
      - id: wippy.llm.openai:provider
        provider_model: gpt-4o-mini
```

OpenAI プロバイダーはデフォルトで OS 環境から `OPENAI_API_KEY` を読み取ります。他のプロバイダーやモデルのフィールドについては [LLM フレームワーク](framework/llm.md) を参照してください。

## ドキュメントの取り込み

分割は `text` モジュールによって処理されます。埋め込みと永続化は `embeddings` ライブラリによって処理されます。

```lua
-- src/app/ingest.lua
local text = require("text")
local embeddings = require("embeddings")

local function ingest(doc_id: string, title: string, markdown: string)
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

local function answer(question: string)
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

HTTP エンドポイントの背後にまとめます。以下のエントリを `src/_index.yaml` に追加します：

```yaml
  - name: ingest
    kind: function.lua
    source: file://app/ingest.lua
    method: ingest
    modules:
      - text
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

  - name: seed
    kind: process.lua
    meta:
      command:
        name: seed
        short: Ingest the sample document
        security:
          groups:
            - wippy.security:process
    source: file://app/seed.lua
    method: main
    modules:
      - funcs
      - io

  - name: gateway
    kind: http.service
    addr: ":8080"
    lifecycle:
      auto_start: true
      security:
        actor:
          id: gateway
        groups:
          - wippy.security:process

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

サーバーがセキュリティコンテキストを宣言しているのは、取得処理がレジストリから埋め込みモデルを解決するためです。アクターとスコープを持たないリクエストはエントリを一切読み取れず、モデル解決は `Model or class not found` で失敗します。

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

    local result, ans_err = answer.answer(tostring(body.question))
    if ans_err then
        res:set_status(http.STATUS.INTERNAL_ERROR)
        res:write_json({ error = ans_err })
        return
    end

    res:write_json(result)
end

return { handler = handler }
```

CLI コマンドからインデックスをシードします。`meta.command` によってプロセスは `wippy run seed` として実行可能になり、その `security` ブロックが `app:ingest` を呼び出すために必要なスコープを与えます：

```lua
-- src/app/seed.lua
local funcs = require("funcs")
local io = require("io")

local DOC = [[
# TLS Configuration

Wippy servers terminate TLS when the `tls` block is present on the
`http.service` entry. Set `cert_file` and `key_file` to PEM paths.

## Refund Policy

Refunds are issued within 14 days of purchase.
]]

local function main()
    local res, err = funcs.call("app:ingest", "doc-42", "Handbook", DOC)
    if err then
        io.print("ingest failed: " .. tostring(err))
        return
    end
    io.print("ingested " .. tostring(res.count) .. " chunks")
end

return { main = main }
```

最初の `wippy run` が `data/app.db` を作成し、embeddings のマイグレーションを適用します。インデックスをシードしてから、サーバーを起動してクエリを実行します：

```bash
wippy run seed
# ingested 2 chunks

wippy run
```

```bash
curl -X POST http://localhost:8080/api/ask \
    -H 'Content-Type: application/json' \
    -d '{"question":"how do I configure TLS?"}'
```

```json
{
  "answer": "You can configure TLS by adding a `tls` block to the `http.service` entry. Set `cert_file` and `key_file` to the paths of your PEM files. (See: Handbook, TLS Configuration)",
  "sources": [
    {
      "entry_id": "52fafcc0-2d18-40d9-8a6e-7662ef9d9bea",
      "origin_id": "doc-42",
      "context_id": "1",
      "content_type": "doc_chunk",
      "content": "# TLS Configuration\nWippy servers terminate TLS when the `tls` block is present on the\n`http.service` entry. Set `cert_file` and `key_file` to PEM paths.",
      "meta": { "title": "Handbook", "chunk": 1 },
      "similarity": 0.0736
    }
  ]
}
```

## 運用上の注意

- **チャンクサイズ**: `chunk_size` と `chunk_overlap` はトークンではなく文字数を数えます (スプリッタは `utf8.RuneCountInString` で長さを測定します)。おおよそ 2000〜4000 文字が良い出発点です。小さすぎるとローカルコンテキストが失われ、大きすぎると類似度スコアが希釈されます。境界を越えて文を保持するために `chunk_overlap` (チャンクサイズの約 10〜20%) を使用します。
- **コンテンツタイプ**: 検索がタイプでフィルタリングできるように、異なる `content_type` 値 (`doc_chunk`、`faq`、`code_snippet`) を使用します。
- **再インデックス**: 新しいチャンクを追加する前に、`embedding_repo.delete_by_origin(doc_id)` によってドキュメントごとに削除して再取り込みします。リポジトリは別のライブラリです — `embedding_repo: wippy.embeddings:embedding_repo` としてインポートします。
- **ハイブリッド検索**: 正確な用語の再現 (名前、ID) のために、ベクトル検索とソーステーブルの全文検索を組み合わせ、再ランク付けします。
- **モデル選択**: `wippy/embeddings` は 512 次元の `text-embedding-3-small` に固定されており、`embeddings_512` テーブルは `vector(512)`/`float[512]` を格納します。別のモデルやベクトルサイズを使うには、ライブラリの定数とマイグレーションのテーブルを変更する必要があります。

## 次のステップ

- [LLM フレームワーク](framework/llm.md) — `llm.generate`、`llm.embed`、プロンプト構築
- [エージェント](framework/agents.md) — リトリーバーをエージェントツールとしてラップ
- [SQL モジュール](lua/storage/sql.md) — 基礎となるデータベースアクセス
- [Text モジュール](lua/text/text.md) — スプリッターとトークン化
