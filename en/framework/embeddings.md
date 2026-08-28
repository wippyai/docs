---
title: "Embeddings"
description: "Generate, store, and search vector embeddings with PostgreSQL pgvector or SQLite sqlite-vec."
---

# Embeddings

The `wippy/embeddings` module generates embeddings through `wippy/llm`, stores them in an application database, and performs vector similarity searches. It supports PostgreSQL with pgvector and SQLite with sqlite-vec.

This page is an API primer with reference snippets, not a standalone tutorial. The snippets assume an existing Wippy project, a configured database, and the embedding model, provider, and credentials described below. Remote embedding calls may incur provider charges. For a complete application that indexes and searches content, follow [Build a RAG Pipeline](../tutorials/rag.md).

## Setup

Add the module to your project:

```bash
wippy add wippy/embeddings
wippy install
```

### Required Model and Provider

Before calling the embeddings API, register an `llm.model` whose `meta.name` is `text-embedding-3-small`, whose capabilities include `embed`, and whose provider mapping resolves to an embedding provider. Configure that provider's credentials, such as `OPENAI_API_KEY`, through the environment storage used by `wippy/llm`. See [LLM model configuration](./llm.md#model-configuration).

### Database Dependency

Declare the dependency and set its `target_db` parameter to the application database:

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

On startup, `wippy/migration` picks up the `01_create_embeddings_table` migration and creates the `embeddings_512` table for the configured database driver.

If you use the relative SQLite path shown above, create the `data` directory before starting the application.

## Current Fixed Constants

The module currently defines these private constants; they are not dependency parameters:

| Constant | Default | Description |
|----------|---------|-------------|
| `EMBEDDING_MODEL` | `text-embedding-3-small` | LLM model used to generate vectors |
| `EMBEDDING_DIMENSIONS` | `512` | Vector size passed to the model |
| `MAX_TOKENS_PER_REQUEST` | `8000` | Per-call token budget; large batches are split |
| `DEFAULT_SEARCH_LIMIT` | `10` | Default number of hits returned by `search` |

Tokens are estimated as `ceil(#text / 4)`. Oversized batches are split between items. An individual item larger than the budget is not split and causes that sub-batch to fail before the LLM call.

## Import

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

## High-Level API (`wippy.embeddings:embeddings`)

### add

```lua
local result, err = embeddings.add(content, content_type, origin_id, context_id, meta)
```

Generates an embedding for `content` and persists it.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `content` | string | yes | Text to embed |
| `content_type` | string | yes | Label such as `"document_chunk"` or `"question"`; PostgreSQL limits it to 32 characters |
| `origin_id` | string | yes | Identifier for the source document or record; must be a UUID when `target_db` is PostgreSQL |
| `context_id` | string | no | Additional scoping key (section, chat, tenant) |
| `meta` | table | no | Arbitrary JSON-serialisable metadata |

Returns `{ entry_id, origin_id, content_type, context_id }` or `nil, err`.

<warning>
At the pinned framework baseline, the single-item helper passes the nested result from `llm.embed()` to the repository instead of its first vector, so `embeddings.add()` cannot persist successfully. Use `embeddings.add_batch()` with one item, or call `llm.embed()` and pass `response.result[1]` to `embedding_repo.add()`, until the framework implementation is corrected.
</warning>

### add_batch

The following uses SQLite-compatible application IDs. For PostgreSQL, replace `doc-1` with a UUID because the PostgreSQL schema stores `origin_id` as `UUID`.

```lua
local result, err = embeddings.add_batch({
    { content = "...", content_type = "chunk", origin_id = "doc-1" },
    { content = "...", content_type = "chunk", origin_id = "doc-1", context_id = "s1" },
})
```

Embeds and stores multiple items in one call. If the total estimated token count exceeds `MAX_TOKENS_PER_REQUEST`, the method splits the batch into chunks. Each repository chunk is transactional, but a split high-level batch is not atomic across chunks: earlier chunks remain stored if a later chunk fails. Returns `{ count, items = { ... } }`.

To remove records created while testing, use the repository API's `delete_by_origin(origin_id)` method for each sample origin.

### search

```lua
local hits, err = embeddings.search("how do migrations work?", {
    content_type = "document_chunk",
    origin_id    = "doc-1",
    context_id   = "section-2",
    limit        = 10,
})
```

Embeds the query string and performs a similarity search against stored vectors. All filters are optional; matching records are ordered by similarity.

`origin_id` may be a string or a non-empty array of strings. Each hit contains `entry_id`, `origin_id`, `content_type`, `context_id`, `content`, decoded `meta`, timestamps, and `similarity`.

### find_by_type

```lua
local hits, err = embeddings.find_by_type(
    "how do migrations work?",
    "document_chunk",
    { limit = 10 }
)
```

Calls `search` with a single `content_type`. The default limit is `10`.

### find_by_origin

```lua
local hits, err = embeddings.find_by_origin("how do migrations work?", "doc-1", {
    content_type = "document_chunk",
    context_id   = "section-2",
    limit        = 5,
})
```

Calls `search` with a single `origin_id` and optional `content_type` and `context_id` filters. The default limit is `5`.

## Repository API (`wippy.embeddings:embedding_repo`)

Use the repository directly when you already have a vector and want to skip embedding generation. Raw embeddings must contain exactly 512 numeric values:

| Function | Description |
|----------|-------------|
| `embedding_repo.add(content, content_type, origin_id, context_id, meta, embedding)` | Insert a precomputed vector |
| `embedding_repo.add_batch(batch)` | Insert many precomputed vectors in one transaction |
| `embedding_repo.get_by_origin(origin_id)` | List all records for a given origin |
| `embedding_repo.delete_by_origin(origin_id)` | Remove all records for a given origin |
| `embedding_repo.delete_by_entry(entry_id)` | Remove a single record by its row id |
| `embedding_repo.search_by_embedding(vector, options)` | Similarity search against a raw vector |

`search_by_embedding` accepts `{ content_type, origin_id, context_id, limit }`.

## Database Support

The migration creates the schema appropriate for the database driver at `target_db`:

- **PostgreSQL** — `embeddings_512` table with a `vector(512)` column and an IVFFlat cosine index. The migration attempts to install the `vector` extension, so the database role must either be allowed to create it or the extension must already exist. PostgreSQL stores `origin_id` as `UUID`.
- **SQLite** — `embeddings_512` `vec0` virtual table holding the `embedding float[512]` vector column alongside the metadata and content columns for KNN search.

## See Also

- [LLM](framework/llm.md) — `llm.embed(...)` for raw embedding generation
- [Migrations](framework/migration.md) — Migration runner that provisions the table
- [Framework Overview](framework/overview.md) — Framework module usage
