---
title: "Embeddings"
---

# Embeddings

The `wippy/embeddings` module provides vector embedding storage and similarity search for both PostgreSQL (pgvector) and SQLite (sqlite-vec). It wraps `wippy/llm` to generate embeddings and persists them to an application database.

## Setup

Add the module to your project:

```bash
wippy add wippy/embeddings
wippy install
```

Declare the dependency and point the `target_db` requirement at your application database via the dependency's `parameters`:

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

On startup, `wippy/migration` picks up the `01_create_embeddings_table` migration and creates the `embeddings_512` table with the appropriate vector index for your database driver.

## Configuration Constants

The default configuration is embedded in the module:

| Constant | Default | Description |
|----------|---------|-------------|
| `EMBEDDING_MODEL` | `text-embedding-3-small` | LLM model used to generate vectors |
| `EMBEDDING_DIMENSIONS` | `512` | Vector size passed to the model |
| `MAX_TOKENS_PER_REQUEST` | `8000` | Per-call token budget; large batches are split |
| `DEFAULT_SEARCH_LIMIT` | `10` | Default number of hits returned by `search` |

Tokens are estimated as `#text / 4`. Batches that exceed the budget are split automatically.

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
| `content_type` | string | yes | Free-form label, e.g. `"document_chunk"`, `"question"` |
| `origin_id` | string | yes | Identifier for the source document or record |
| `context_id` | string | no | Additional scoping key (section, chat, tenant) |
| `meta` | table | no | Arbitrary JSON-serialisable metadata |

Returns `{ entry_id, origin_id, content_type, context_id }` or `nil, err`.

### add_batch

```lua
local result, err = embeddings.add_batch({
    { content = "...", content_type = "chunk", origin_id = "doc-1" },
    { content = "...", content_type = "chunk", origin_id = "doc-1", context_id = "s1" },
})
```

Embeds and stores many items in one call. If the total estimated token count exceeds `MAX_TOKENS_PER_REQUEST`, the batch is split and processed in chunks. Returns `{ count, items = { ... } }`.

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

### find_by_type

```lua
local hits, err = embeddings.find_by_type(query, content_type, { limit = 10 })
```

Convenience wrapper for `search` scoped to a single `content_type`.

### find_by_origin

```lua
local hits, err = embeddings.find_by_origin(query, origin_id, {
    content_type = "document_chunk",
    context_id   = "section-2",
    limit        = 5,
})
```

Convenience wrapper scoped to a single `origin_id`, optionally narrowed further.

## Repository API (`wippy.embeddings:embedding_repo`)

Use the repository directly when you already have a vector and want to skip embedding generation:

| Function | Description |
|----------|-------------|
| `embedding_repo.add(content, content_type, origin_id, context_id, meta, embedding)` | Insert a precomputed vector |
| `embedding_repo.add_batch(batch)` | Insert many precomputed vectors in one statement |
| `embedding_repo.get_by_origin(origin_id)` | List all records for a given origin |
| `embedding_repo.delete_by_origin(origin_id)` | Remove all records for a given origin |
| `embedding_repo.delete_by_entry(entry_id)` | Remove a single record by its row id |
| `embedding_repo.search_by_embedding(vector, options)` | Similarity search against a raw vector |

`search_by_embedding` accepts `{ content_type, origin_id, context_id, limit }`.

## Database Support

The migration creates the schema appropriate for the database driver at `target_db`:

- **PostgreSQL** - `embeddings_512` table with a `vector(512)` column and an IVFFlat index. Requires the `pgvector` extension.
- **SQLite** - `embeddings_512` `vec0` virtual table holding the `embedding float[512]` vector column alongside the metadata and content columns for KNN search.

Vectors are always round-tripped through a plain JSON array at the API layer.

## See Also

- [LLM](framework/llm.md) - `llm.embed(...)` for raw embedding generation
- [Migrations](framework/migration.md) - Migration runner that provisions the table
- [Framework Overview](framework/overview.md) - Framework module usage
