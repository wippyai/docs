---
title: "Embeddings"
---

# Embeddings

`wippy/embeddings` モジュールは、PostgreSQL（pgvector）と SQLite（sqlite-vec）の両方に対応するベクトルエンベディングのストレージと類似度検索を提供します。`wippy/llm` をラップしてエンベディングを生成し、アプリケーションデータベースに永続化します。

## セットアップ

プロジェクトにモジュールを追加します:

```bash
wippy add wippy/embeddings
wippy install
```

依存関係を宣言し、`target_db` 要件をアプリケーションデータベースに向けます:

```yaml
version: "1.0"
namespace: app

entries:
  - name: app_db
    kind: db.sql.sqlite
    path: ./data/app.db

  - name: dep.embeddings
    kind: ns.dependency
    component: wippy/embeddings
    version: "*"

  - name: target_db
    kind: registry.entry
    meta:
      wippy.embeddings.target_db: app:app_db
```

起動時に、`wippy/migration` が `01_create_embeddings_table` マイグレーションを取得し、使用しているデータベースドライバーに適したベクトルインデックスを持つ `embeddings` テーブルを作成します。

## 設定定数

デフォルト設定はモジュールに組み込まれています:

| 定数 | デフォルト | 説明 |
|----------|---------|-------------|
| `EMBEDDING_MODEL` | `text-embedding-3-small` | ベクトル生成に使用する LLM モデル |
| `EMBEDDING_DIMENSIONS` | `512` | モデルに渡されるベクトルのサイズ |
| `MAX_TOKENS_PER_REQUEST` | `8000` | 1 回の呼び出しあたりのトークン予算。大きなバッチは分割されます |
| `DEFAULT_SEARCH_LIMIT` | `10` | `search` が返すヒットのデフォルト件数 |

トークンは `#text / 4` で推定されます。予算を超えるバッチは自動的に分割されます。

## インポート

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

`content` のエンベディングを生成し、永続化します。

| パラメータ | 型 | 必須 | 説明 |
|-----------|------|----------|-------------|
| `content` | string | yes | 埋め込むテキスト |
| `content_type` | string | yes | 自由形式のラベル（例: `"document_chunk"`、`"question"`） |
| `origin_id` | string | yes | ソースドキュメントまたはレコードの識別子 |
| `context_id` | string | no | 追加のスコープキー（セクション、チャット、テナント） |
| `meta` | table | no | 任意の JSON シリアライズ可能なメタデータ |

`{ id, content, content_type, origin_id, context_id, meta }` または `nil, err` を返します。

### add_batch

```lua
local result, err = embeddings.add_batch({
    { content = "...", content_type = "chunk", origin_id = "doc-1" },
    { content = "...", content_type = "chunk", origin_id = "doc-1", context_id = "s1" },
})
```

複数のアイテムを 1 回の呼び出しでエンベディングして保存します。推定合計トークン数が `MAX_TOKENS_PER_REQUEST` を超える場合、バッチは分割されてチャンクごとに処理されます。`{ count, items = { ... } }` を返します。

### search

```lua
local hits, err = embeddings.search("how do migrations work?", {
    content_type = "document_chunk",
    origin_id    = "doc-1",
    context_id   = "section-2",
    limit        = 10,
})
```

クエリ文字列をエンベディングし、保存されているベクトルに対して類似度検索を実行します。すべてのフィルターはオプションで、一致するレコードは類似度順に並べられます。

### find_by_type

```lua
local hits, err = embeddings.find_by_type(query, content_type, { limit = 10 })
```

単一の `content_type` にスコープされた `search` の便利なラッパーです。

### find_by_origin

```lua
local hits, err = embeddings.find_by_origin(query, origin_id, {
    content_type = "document_chunk",
    context_id   = "section-2",
    limit        = 5,
})
```

単一の `origin_id` にスコープされ、オプションでさらに絞り込める便利なラッパーです。

## リポジトリ API（`wippy.embeddings:embedding_repo`）

既にベクトルを持っていてエンベディング生成をスキップしたい場合は、リポジトリを直接使用します:

| 関数 | 説明 |
|----------|-------------|
| `embedding_repo.add(content, content_type, origin_id, context_id, meta, embedding)` | 事前計算されたベクトルを挿入 |
| `embedding_repo.add_batch(batch)` | 事前計算された複数のベクトルを 1 つのステートメントで挿入 |
| `embedding_repo.get_by_origin(origin_id)` | 指定された origin のすべてのレコードを一覧表示 |
| `embedding_repo.delete_by_origin(origin_id)` | 指定された origin のすべてのレコードを削除 |
| `embedding_repo.delete_by_entry(entry_id)` | 行 ID による単一レコードの削除 |
| `embedding_repo.search_by_embedding(vector, options)` | 生のベクトルに対する類似度検索 |

`search_by_embedding` は `{ content_type, origin_id, context_id, limit }` を受け付けます。

## データベースサポート

マイグレーションは、`target_db` のデータベースドライバーに適したスキーマを作成します:

- **PostgreSQL** - `vector(512)` カラムと IVFFlat インデックスを持つ `embeddings` テーブル。`pgvector` 拡張機能が必要です。
- **SQLite** - ベクトルをテキストとして保存する `embeddings` テーブルと、KNN 検索用の `sqlite-vec` 仮想テーブル。

ベクトルは API レイヤーでは常にプレーンな JSON 配列として受け渡しされます。

## 関連情報

- [LLM](framework/llm.md) - 生のエンベディング生成用 `llm.embed(...)`
- [Migrations](framework/migration.md) - テーブルをプロビジョニングするマイグレーションランナー
- [Framework Overview](framework/overview.md) - フレームワークモジュールの使用方法
