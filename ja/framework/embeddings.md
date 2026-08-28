---
title: "Embeddings"
description: "PostgreSQL pgvector または SQLite sqlite-vec を使用して vector embedding を生成、格納、検索します。"
---

# Embeddings

`wippy/embeddings` モジュールは `wippy/llm` を通じて embedding を生成し、アプリケーションデータベースへ格納して、vector 類似度検索を実行します。pgvector を使用する PostgreSQL と sqlite-vec を使用する SQLite に対応しています。

このページはリファレンススニペットを含む API 入門であり、独立したチュートリアルではありません。スニペットは、既存の Wippy プロジェクト、設定済みデータベース、以下で説明する embedding model、provider、credential を前提としています。リモートの embedding 呼び出しには provider の料金が発生する場合があります。コンテンツを index して検索する完全なアプリケーションについては、[RAG パイプラインの構築](../tutorials/rag.md)に従ってください。

## セットアップ

プロジェクトへモジュールを追加します。

```bash
wippy add wippy/embeddings
wippy install
```

### 必要な Model と Provider

embeddings API を呼び出す前に、`meta.name` が `text-embedding-3-small`、capability に `embed` を含み、provider mapping が embedding provider へ解決される `llm.model` を登録します。`OPENAI_API_KEY` など、その provider の credential は `wippy/llm` が使用する環境ストレージを通じて設定します。[LLM model の設定](./llm.md#model-configuration)を参照してください。

### データベース依存関係

依存関係を宣言し、その `target_db` parameter をアプリケーションデータベースに設定します。

```yaml
version: "1.0"
namespace: app

entries:
  - name: app_db
    kind: db.sql.sqlite
    file: ./data/app.db

  - name: dep.embeddings
    kind: ns.dependency
    component: wippy/embeddings
    version: "*"
    parameters:
      - name: target_db
        value: app:app_db
```

起動時に `wippy/migration` が `01_create_embeddings_table` migration を取得し、設定されたデータベースドライバーに `embeddings_512` table を作成します。

上記の相対 SQLite path を使用する場合は、アプリケーションを開始する前に `data` directory を作成してください。

## 現在の固定定数

モジュールは現在、次の private 定数を定義しています。これらは dependency parameter ではありません。

| 定数 | デフォルト | 説明 |
|----------|---------|-------------|
| `EMBEDDING_MODEL` | `text-embedding-3-small` | vector 生成に使用する LLM model |
| `EMBEDDING_DIMENSIONS` | `512` | model に渡す vector size |
| `MAX_TOKENS_PER_REQUEST` | `8000` | 呼び出しごとの token budget。大きな batch は分割される |
| `DEFAULT_SEARCH_LIMIT` | `10` | `search` が返す hit 数のデフォルト |

token 数は `ceil(#text / 4)` と推定されます。上限を超える batch は item 間で分割されます。1 item が budget より大きい場合、その item 自体は分割されず、LLM 呼び出し前に該当 sub-batch が失敗します。

## インポート :id=import

```yaml
entries:
  - name: my_app
    kind: library.lua
    source: file://my_app.lua
    imports:
      embeddings: wippy.embeddings:embeddings
```

```lua
local embeddings = require("embeddings")
```

## 高レベル API（`wippy.embeddings:embeddings`）

### add

```lua
local result, err = embeddings.add(content, content_type, origin_id, context_id, meta)
```

`content` の embedding を生成して永続化します。

| パラメーター | 型 | 必須 | 説明 |
|-----------|------|----------|-------------|
| `content` | string | はい | embedding を生成する text |
| `content_type` | string | はい | `"document_chunk"` や `"question"` などの label。PostgreSQL では 32 文字に制限 |
| `origin_id` | string | はい | 元の document または record の identifier。`target_db` が PostgreSQL の場合は UUID であること |
| `context_id` | string | いいえ | 追加の scope key（section、chat、tenant） |
| `meta` | table | いいえ | 任意の JSON-serialisable metadata |

`{ entry_id, origin_id, content_type, context_id }` または `nil, err` を返します。

<warning>
固定された framework baseline では、single-item helper は `llm.embed()` の最初の vector ではなく、ネストされた結果を repository へ渡すため、`embeddings.add()` は正常に永続化できません。framework 実装が修正されるまでは、1 item の `embeddings.add_batch()` を使用するか、`llm.embed()` を呼び出して `response.result[1]` を `embedding_repo.add()` へ渡してください。
</warning>

### add_batch

次の例では SQLite 互換のアプリケーション ID を使用します。PostgreSQL schema は `origin_id` を `UUID` として格納するため、PostgreSQL では `doc-1` を UUID に置き換えてください。

```lua
local result, err = embeddings.add_batch({
    { content = "...", content_type = "chunk", origin_id = "doc-1" },
    { content = "...", content_type = "chunk", origin_id = "doc-1", context_id = "s1" },
})
```

複数 item の embedding を生成し、1 回の呼び出しで格納します。推定 token 総数が `MAX_TOKENS_PER_REQUEST` を超える場合、method は batch を chunk に分割します。repository の各 chunk は transactional ですが、分割された高レベル batch は chunk 間で atomic ではありません。後の chunk が失敗しても、先の chunk は格納されたままです。`{ count, items = { ... } }` を返します。

テスト中に作成した record を削除するには、sample origin ごとに repository API の `delete_by_origin(origin_id)` method を使用します。

### search

```lua
local hits, err = embeddings.search("how do migrations work?", {
    content_type = "document_chunk",
    origin_id    = "doc-1",
    context_id   = "section-2",
    limit        = 10,
})
```

query string の embedding を生成し、格納済み vector に対して類似度検索を実行します。filter はすべて任意です。一致する record は類似度順に並びます。

`origin_id` には string または空でない string 配列を指定できます。各 hit には `entry_id`、`origin_id`、`content_type`、`context_id`、`content`、decode 済み `meta`、timestamp、`similarity` が含まれます。

### find_by_type

```lua
local hits, err = embeddings.find_by_type(
    "how do migrations work?",
    "document_chunk",
    { limit = 10 }
)
```

1 つの `content_type` を指定して `search` を呼び出します。デフォルトの limit は `10` です。

### find_by_origin

```lua
local hits, err = embeddings.find_by_origin("how do migrations work?", "doc-1", {
    content_type = "document_chunk",
    context_id   = "section-2",
    limit        = 5,
})
```

1 つの `origin_id` と、任意の `content_type` および `context_id` filter を指定して `search` を呼び出します。デフォルトの limit は `5` です。

## Repository API（`wippy.embeddings:embedding_repo`）

すでに vector があり、embedding 生成を省略する場合は repository を直接使用します。raw embedding は正確に 512 個の数値を含む必要があります。

| 関数 | 説明 |
|----------|-------------|
| `embedding_repo.add(content, content_type, origin_id, context_id, meta, embedding)` | 事前計算済み vector を挿入 |
| `embedding_repo.add_batch(batch)` | 複数の事前計算済み vector を 1 transaction で挿入 |
| `embedding_repo.get_by_origin(origin_id)` | 指定 origin の全 record を一覧表示 |
| `embedding_repo.delete_by_origin(origin_id)` | 指定 origin の全 record を削除 |
| `embedding_repo.delete_by_entry(entry_id)` | row ID で 1 record を削除 |
| `embedding_repo.search_by_embedding(vector, options)` | raw vector による類似度検索 |

`search_by_embedding` は `{ content_type, origin_id, context_id, limit }` を受け取ります。

## データベース対応

Migration は `target_db` のデータベースドライバーに適した schema を作成します。

- **PostgreSQL** — `vector(512)` column と IVFFlat cosine index を持つ `embeddings_512` table。migration は `vector` extension のインストールを試みるため、database role はその作成を許可されているか、extension がすでに存在する必要があります。PostgreSQL は `origin_id` を `UUID` として格納します。
- **SQLite** — metadata および content column とともに `embedding float[512]` vector column を保持し、KNN 検索を行う `embeddings_512` `vec0` virtual table。

## 関連項目

- [LLM](framework/llm.md) — raw embedding 生成用の `llm.embed(...)`
- [Migration](framework/migration.md) — table を用意する migration runner
- [Framework 概要](framework/overview.md) — Framework モジュールの使用方法
