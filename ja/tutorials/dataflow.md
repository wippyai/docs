---
title: "Dataflow: Local Knowledge Base"
description: "自分のマシン上にナレッジベースを構築します — ベクトルストアを作成し、ドキュメントをチャンクに分割して取り込みます。これは RAG チュートリアル のデータ作成版です。ここではローカル KB を立ち上げて満たし、あちらではそこから取得して回答を生成します。どちらもローカル SQLite…"
---

# Dataflow: Local Knowledge Base

自分のマシン上にナレッジベースを構築します — ベクトルストアを作成し、ドキュメントをチャンクに分割して取り込みます。これは [RAG チュートリアル](tutorials/rag.md) のデータ作成版です。ここではローカル KB を立ち上げて満たし、あちらではそこから取得して回答を生成します。どちらもローカル SQLite ベクトルストアを背後に持つ `wippy/embeddings` モジュールを使用します。

## 構築するもの

1. データベースが 512 次元のベクトルストアを保持するローカルアプリ。
2. 起動時に `embeddings_512` テーブルを作成するマイグレーション。
3. マークダウンをチャンクに分割し、埋め込みをストアに書き込む取り込み関数。

## 前提条件

- Wippy プロジェクト ([app-template](https://github.com/wippyai/app-template) をクローンするか、`wippy init`)。
- 埋め込みモデル (例: `text-embedding-3-small`) で構成された LLM プロバイダー — [LLM フレームワーク](framework/llm.md) を参照。ベクトルストアはそれなしでローカルに作成されますが、取り込み (`llm.embed` を呼び出す) には構成済みのプロバイダーが必要です。

依存関係をインストールします：

```bash
wippy add wippy/embeddings
wippy add wippy/migration
wippy add wippy/bootloader
wippy add wippy/llm
wippy install
```

## ストアの作成

KB はローカルの SQLite データベースに存在します。`wippy/embeddings` はベクトルテーブルを作成するマイグレーションを同梱しており、ブートローダーが起動時にそれを実行します。各部分を接続します：

```yaml
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
    host:
      max_processes: 1000
      workers: 8

  - name: embeddings
    kind: ns.dependency
    component: wippy/embeddings
    parameters:
      - name: target_db
        value: app:db

  - name: migration
    kind: ns.dependency
    component: wippy/migration
    parameters:
      - name: app_db
        value: app:db

  - name: bootloader
    kind: ns.dependency
    component: wippy/bootloader
    parameters:
      - name: application_host
        value: app:processes
      - name: app_db
        value: app:db
      - name: env_storage
        value: app.env:store
```

ブートローダーには環境ストアが必要です。独自の名前空間に標準のものを追加します：

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

データディレクトリを作成してアプリを起動します：

```bash
mkdir -p data
wippy run
```

起動時にマイグレーションが実行され、ストアが `data/app.db` に現れます：

```
$ sqlite3 data/app.db ".tables"
_migrations            embeddings_512         embeddings_512_chunks
embeddings_512_info    embeddings_512_rowids  embeddings_512_vector_chunks00
...
```

`embeddings_512` は SQLite の `vec0` 仮想テーブルです。`embeddings_512_*` シャドウテーブルはそのチャンク、行 ID、メタデータを保持します。(PostgreSQL では同じマイグレーションが代わりに `pgvector` を使用します。)

## ドキュメントの取り込み

取り込みは 2 ステップです。`text` モジュールでテキストをチャンクに分割し、次に `embeddings.add_batch` で書き込みます。これは各チャンクを埋め込み、永続化します。

```lua
-- src/ingest.lua
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

関数を登録します：

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

- `origin_id` は 1 つのソースドキュメントからのすべてのチャンクをグループ化します — ドキュメントごとに `embedding_repo.delete_by_origin(doc_id)` で削除して再取り込みします。
- `content_type` を使うと、1 つのストアに異なるコーパス (`doc_chunk`、`faq`、`code_snippet`) を保持し、クエリ時にフィルタリングできます。
- `add_batch` はバッチが 8000 トークンのリクエスト制限を超えると自動的に分割します。

## 内容の確認

ドキュメントが取り込まれたら、行が格納されたことを確認し、類似度検索を実行します：

```lua
local embeddings = require("embeddings")

local results, err = embeddings.search("how do I configure TLS?", {
    content_type = "doc_chunk",
    limit = 5,
})
-- results[i].content, .similarity, .meta, .origin_id, .context_id
```

そこから、[RAG チュートリアル](tutorials/rag.md) では、これらの結果を LLM に渡してグラウンディングされた回答を得る方法を示します。

## 運用上の注意

- **チャンクサイズ**: 500〜1000 トークンが良いデフォルトです。文が境界を越えて切断されないように `chunk_overlap` (チャンクサイズの約 10〜20%) を使用します。
- **次元**: 512 次元の `text-embedding-3-small` はコスト効率が高く、`embeddings_512` テーブルに一致します。より大きなベクトルはより大きなストレージと遅い検索を意味します。
- **ローカル vs. 共有**: SQLite (`vec0`) は KB 全体を 1 つのローカルファイルに保持します — 開発とシングルノードアプリに最適です。共有された本番用ストアには `target_db` を `pgvector` を持つ `db.sql.postgres` に向けます。取り込みコードは変更されません。

## 次のステップ

- [RAG](tutorials/rag.md) — このストアから取得してグラウンディングされた回答を生成する
- [LLM フレームワーク](framework/llm.md) — `llm.embed`、埋め込みモデル、プロバイダー
- [Text モジュール](lua/text/text.md) — スプリッターとトークン化
