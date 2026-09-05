---
title: "Retrieval-Augmented Generation (RAG)"
description: "Build a knowledge base that answers questions from your own documents. This tutorial uses the wippy/embeddings module for vector search and the LLM…"
---

# Retrieval-Augmented Generation (RAG)

Build a knowledge base that answers questions from your own documents. This tutorial uses the `wippy/embeddings` module for vector search and the LLM framework for generation.

## What You'll Build

A minimal RAG pipeline:

1. Ingest markdown documents — split into chunks, embed, persist.
2. Retrieve — vector search returns the most relevant chunks for a query.
3. Generate — an LLM call uses the retrieved chunks as grounding context.

## Prerequisites

- A database: `db.sql.sqlite` (includes `vec0` support) or `db.sql.postgres` with the `pgvector` extension.
- `OPENAI_API_KEY` in the environment — the embedding and generation calls go through it.

Create the project and install the modules:

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

## Dependencies

Declare the `wippy/embeddings` dependency and point it at your database. The `target_db` parameter is the registry ID of the database entry the embeddings table will live in. `wippy/embeddings` pulls in `wippy/llm` and the migration that creates the `embeddings_512` table, so `wippy/migration` and `wippy/bootloader` need wiring too — the bootloader runs the migration at startup, and both it and the LLM module run processes under the `wippy.security:process` policy group shipped by `wippy/security`:

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

The bootloader persists a generated `ENCRYPTION_KEY`, so it needs a writable environment store:

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

## Models

`wippy/embeddings` calls `llm.embed` with `text-embedding-3-small`, and generation below uses `gpt-4o-mini`. Both are resolved from the registry, so declare them in `src/_index.yaml` as well:

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

The OpenAI provider reads `OPENAI_API_KEY` from the OS environment by default. See [LLM Framework](framework/llm.md) for other providers and model fields.

## Ingest Documents

Splitting is handled by the `text` module; embedding and persistence by the `embeddings` library.

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

Register the function and its imports:

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

Key points:

- `origin_id` groups chunks that belong to the same source document.
- `context_id` is an optional sub-key (section, page, chunk index).
- `add_batch` auto-splits if total tokens exceed the 8000-token request limit.

## Retrieve

Vector search returns the most similar chunks to the query, along with similarity scores:

```lua
local embeddings = require("embeddings")

local results, err = embeddings.search("how do I configure TLS?", {
    content_type = "doc_chunk",
    limit = 5,
})

-- results[i].content, .similarity, .meta, .origin_id, .context_id
```

Filter by origin when you want to ground the answer in a specific document:

```lua
local hits = embeddings.find_by_origin("refund policy", "doc-42", { limit = 3 })
```

## Generate an Answer

Compose the retrieved chunks into a prompt and call the LLM. Here the retrieved text is appended to the system prompt; the user's question becomes the user turn:

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

## End-to-End Example

Putting it together behind an HTTP endpoint. Append these entries to `src/_index.yaml`:

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

The server declares a security context because retrieval resolves the embedding model from the registry, and a request without an actor and scope reads no entries at all — model resolution then fails with `Model or class not found`.

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

Seed the index from a CLI command. `meta.command` makes the process runnable as `wippy run seed`, and its `security` block gives it the scope needed to call `app:ingest`:

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

The first `wippy run` creates `data/app.db` and applies the embeddings migration. Seed the index, then start the server and query it:

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

## Operational Notes

- **Chunk size**: `chunk_size` and `chunk_overlap` count characters, not tokens (the splitter measures length with `utf8.RuneCountInString`). Roughly 2000–4000 characters is a good starting point. Too small loses local context; too large dilutes similarity scores. Use `chunk_overlap` (~10–20% of chunk size) to preserve sentences across boundaries.
- **Content types**: Use distinct `content_type` values (`doc_chunk`, `faq`, `code_snippet`) so search can filter by type.
- **Re-indexing**: Delete and re-ingest per document via `embedding_repo.delete_by_origin(doc_id)` before adding new chunks. The repository is a separate library — import it as `embedding_repo: wippy.embeddings:embedding_repo`.
- **Hybrid search**: For exact-term recall (names, IDs), combine vector search with full-text search over your source table and re-rank.
- **Model choice**: `wippy/embeddings` is fixed to `text-embedding-3-small` at 512 dimensions, and the `embeddings_512` table stores `vector(512)`/`float[512]`. A different model or vector size means changing the library constants and the migration table.

## Next Steps

- [LLM Framework](framework/llm.md) — `llm.generate`, `llm.embed`, prompt construction
- [Agents](framework/agents.md) — wrap the retriever as an agent tool
- [SQL Module](lua/storage/sql.md) — underlying database access
- [Text Module](lua/text/text.md) — splitters and tokenization
