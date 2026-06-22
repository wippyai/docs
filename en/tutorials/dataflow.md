# Dataflow: Local Knowledge Base

Build a knowledge base on your own machine — create the vector store, then chunk and
ingest documents into it. This is the data-creation companion to the
[RAG tutorial](tutorials/rag.md): here you stand up and fill a local KB; there you
retrieve from it and generate answers. Both use the `wippy/embeddings` module backed by
a local SQLite vector store.

## What You'll Build

1. A local app whose database holds a 512-dimension vector store.
2. The migration that creates the `embeddings_512` table on startup.
3. An ingest function that chunks markdown and writes embeddings into the store.

## Prerequisites

- A Wippy project (clone [app-template](https://github.com/wippyai/app-template), or
  `wippy init`).
- An LLM provider with an embedding model configured (e.g. `text-embedding-3-small`) —
  see [LLM Framework](framework/llm.md). The vector store is created locally without it,
  but ingesting (which calls `llm.embed`) needs a configured provider.

Install the dependencies:

```bash
wippy add wippy/embeddings
wippy add wippy/migration
wippy add wippy/bootloader
wippy add wippy/llm
wippy install
```

## Create the Store

The KB lives in a local SQLite database. `wippy/embeddings` ships a migration that
creates the vector table; the bootloader runs it at startup. Wire the pieces together:

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

The bootloader needs an environment store; add the standard one in its own namespace:

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

Create the data directory and start the app:

```bash
mkdir -p data
wippy run
```

On boot the migration runs and the store appears in `data/app.db`:

```
$ sqlite3 data/app.db ".tables"
_migrations            embeddings_512         embeddings_512_chunks
embeddings_512_info    embeddings_512_rowids  embeddings_512_vector_chunks00
...
```

`embeddings_512` is a SQLite `vec0` virtual table; the `embeddings_512_*` shadow tables
hold its chunks, row ids, and metadata. (On PostgreSQL the same migration uses
`pgvector` instead.)

## Ingest Documents

Ingestion is two steps: split text into chunks with the `text` module, then write them
with `embeddings.add_batch`, which embeds and persists each chunk.

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

Register the function:

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

Key points:

- `origin_id` groups all chunks from one source document — delete and re-ingest per
  document with `embedding_repo.delete_by_origin(doc_id)`.
- `content_type` lets you keep distinct corpora (`doc_chunk`, `faq`, `code_snippet`) in
  one store and filter at query time.
- `add_batch` auto-splits when the batch exceeds the 8000-token request limit.

## Verify the Contents

Once documents are ingested, confirm rows landed and run a similarity search:

```lua
local embeddings = require("embeddings")

local results, err = embeddings.search("how do I configure TLS?", {
    content_type = "doc_chunk",
    limit = 5,
})
-- results[i].content, .similarity, .meta, .origin_id, .context_id
```

From there, the [RAG tutorial](tutorials/rag.md) shows how to feed these results to an
LLM for grounded answers.

## Operational Notes

- **Chunk size**: 500–1000 tokens is a good default. Use `chunk_overlap` (~10–20% of
  chunk size) so sentences aren't cut across boundaries.
- **Dimensions**: `text-embedding-3-small` at 512 dimensions is cost-efficient and
  matches the `embeddings_512` table. Larger vectors mean larger storage and slower
  search.
- **Local vs. shared**: SQLite (`vec0`) keeps the whole KB in one local file — ideal for
  development and single-node apps. Point `target_db` at a `db.sql.postgres` with
  `pgvector` for a shared, production store; the ingest code is unchanged.

## Next Steps

- [RAG](tutorials/rag.md) — retrieve from this store and generate grounded answers
- [LLM Framework](framework/llm.md) — `llm.embed`, embedding models, providers
- [Text Module](lua/text/text.md) — splitters and tokenization
