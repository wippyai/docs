# Retrieval-Augmented Generation (RAG)

Build a knowledge base that answers questions from your own documents. This tutorial uses the `wippy/embeddings` module for vector search and the LLM framework for generation.

## What You'll Build

A minimal RAG pipeline:

1. Ingest markdown documents — split into chunks, embed, persist.
2. Retrieve — vector search returns the most relevant chunks for a query.
3. Generate — an LLM call uses the retrieved chunks as grounding context.

## Prerequisites

- A database: `db.sql.sqlite` (includes `vec0` support) or `db.sql.postgres` with the `pgvector` extension.
- An LLM provider configured with an embedding model (e.g. `text-embedding-3-small`) — see [LLM Framework](framework/llm.md).
- Wippy project bootstrapped (`wippy init`, `wippy add wippy/embeddings`).

## Dependencies

Declare the `wippy/embeddings` dependency and point it at your database. The `target_db` parameter is the registry ID of the database entry the embeddings table will live in:

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

`wippy/embeddings` pulls in `wippy/llm` and the migration that creates the `embeddings_512` table (PostgreSQL `pgvector` or SQLite `vec0` virtual table).

## Ingest Documents

Splitting is handled by the `text` module; embedding and persistence by the `embeddings` library.

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

Register the function and its imports:

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

## End-to-End Example

Putting it together behind an HTTP endpoint:

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
      - { name: target_db, value: app:db }

  - name: ingest
    kind: function.lua
    source: file://app/ingest.lua
    method: ingest
    modules: [text, uuid]
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
    lifecycle: { auto_start: true }

  - name: api
    kind: http.router
    meta: { server: gateway }
    prefix: /api

  - name: ask
    kind: http.endpoint
    meta: { router: api }
    method: POST
    path: /ask
    func: app:answer_http

  - name: answer_http
    kind: function.lua
    source: file://app/answer_http.lua
    method: handler
    modules: [http]
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
        res:set_status(http.STATUS.INTERNAL_SERVER_ERROR)
        res:write_json({ error = ans_err })
        return
    end

    res:write_json(result)
end

return { handler = handler }
```

Seed the index by calling `ingest` from a setup process or a CLI command (`process.lua` with `meta.command`), then query:

```bash
curl -X POST http://localhost:8080/api/ask \
    -H 'Content-Type: application/json' \
    -d '{"question":"how do I configure TLS?"}'
```

## Operational Notes

- **Chunk size**: 500–1000 tokens is a good starting point. Too small loses local context; too large dilutes similarity scores. Use `chunk_overlap` (~10–20% of chunk size) to preserve sentences across boundaries.
- **Content types**: Use distinct `content_type` values (`doc_chunk`, `faq`, `code_snippet`) so search can filter by type.
- **Re-indexing**: Delete and re-ingest per document via `embedding_repo.delete_by_origin(doc_id)` before adding new chunks.
- **Hybrid search**: For exact-term recall (names, IDs), combine vector search with full-text search over your source table and re-rank.
- **Model choice**: The default 512-dimension `text-embedding-3-small` is cost-efficient. Upgrade to 1024 or 3072 dimensions only if recall is insufficient — bigger vectors mean bigger storage and slower search.

## See Also

- [LLM Framework](framework/llm.md) — `llm.generate`, `llm.embed`, prompt construction
- [Agents](framework/agents.md) — wrap the retriever as an agent tool
- [SQL Module](lua/storage/sql.md) — underlying database access
- [Text Module](lua/text/text.md) — splitters and tokenization
