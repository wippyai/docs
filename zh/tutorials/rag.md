---
title: "检索增强生成 (RAG)"
description: "构建一个能够从您自己的文档中回答问题的知识库。本教程使用 wippy/embeddings 模块进行向量搜索，并使用 LLM 框架进行生成。"
---

# 检索增强生成 (RAG)

构建一个能够从您自己的文档中回答问题的知识库。本教程使用 `wippy/embeddings` 模块进行向量搜索，并使用 LLM 框架进行生成。

## 您将构建什么

一个最小化的 RAG 管道：

1. 摄取 markdown 文档 — 分割成块、嵌入、持久化。
2. 检索 — 向量搜索返回与查询最相关的块。
3. 生成 — LLM 调用使用检索到的块作为 grounding 上下文。

## 先决条件

- 数据库：`db.sql.sqlite`（包括 `vec0` 支持）或带有 `pgvector` 扩展的 `db.sql.postgres`。
- 环境中的 `OPENAI_API_KEY` — 嵌入和生成调用都通过它进行。

创建项目并安装模块：

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

## 依赖项

声明 `wippy/embeddings` 依赖并将其指向您的数据库。`target_db` 参数是嵌入表将所在的数据库条目的 Registry ID。`wippy/embeddings` 会引入 `wippy/llm` 以及创建 `embeddings_512` 表的迁移，因此 `wippy/migration` 和 `wippy/bootloader` 也需要接入 — 引导程序在启动时运行迁移，而它和 LLM 模块都在 `wippy/security` 提供的 `wippy.security:process` 策略组下运行进程：

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

引导程序会持久化一个生成的 `ENCRYPTION_KEY`，因此它需要一个可写的环境存储：

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

## 模型

`wippy/embeddings` 使用 `text-embedding-3-small` 调用 `llm.embed`，下面的生成使用 `gpt-4o-mini`。两者都从注册表解析，因此也要在 `src/_index.yaml` 中声明它们：

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

OpenAI 提供者默认从操作系统环境读取 `OPENAI_API_KEY`。其他提供者和模型字段参见 [LLM 框架](framework/llm.md)。

## 摄取文档

分割由 `text` 模块处理；嵌入和持久化由 `embeddings` 库处理。

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

注册函数及其导入：

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

要点：

- `origin_id` 将属于同一源文档的块分组。
- `context_id` 是可选的子键（章节、页面、块索引）。
- 如果总 token 数超过 8000 token 的请求限制，`add_batch` 会自动拆分。

## 检索

向量搜索返回与查询最相似的块，以及相似度分数：

```lua
local embeddings = require("embeddings")

local results, err = embeddings.search("how do I configure TLS?", {
    content_type = "doc_chunk",
    limit = 5,
})

-- results[i].content, .similarity, .meta, .origin_id, .context_id
```

当您希望将答案定位到特定文档时，按 origin 过滤：

```lua
local hits = embeddings.find_by_origin("refund policy", "doc-42", { limit = 3 })
```

## 生成答案

将检索到的块组合成提示并调用 LLM。这里将检索到的文本附加到系统提示；用户的问题成为用户回合：

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

## 端到端示例

将其组合在 HTTP 端点后面。将这些条目追加到 `src/_index.yaml`：

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

服务器声明了安全上下文，因为检索需要从注册表解析嵌入模型，而没有执行者和作用域的请求根本读取不到任何条目 — 此时模型解析会以 `Model or class not found` 失败。

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

从 CLI 命令播种索引。`meta.command` 使该进程可以通过 `wippy run seed` 运行，其 `security` 块为它提供调用 `app:ingest` 所需的作用域：

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

首次 `wippy run` 会创建 `data/app.db` 并应用 embeddings 迁移。播种索引，然后启动服务器并查询：

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

## 运行说明

- **块大小**：`chunk_size` 和 `chunk_overlap` 统计的是字符而非 token（分割器用 `utf8.RuneCountInString` 测量长度）。大约 2000–4000 个字符是一个良好的起点。太小会丢失局部上下文；太大会稀释相似度分数。使用 `chunk_overlap`（块大小的 ~10–20%）来在边界之间保留句子。
- **内容类型**：使用不同的 `content_type` 值（`doc_chunk`、`faq`、`code_snippet`），以便搜索可以按类型过滤。
- **重新索引**：在添加新块之前，通过 `embedding_repo.delete_by_origin(doc_id)` 按文档删除并重新摄取。该仓库是一个独立的库 — 通过 `embedding_repo: wippy.embeddings:embedding_repo` 导入。
- **混合搜索**：对于精确术语召回（名称、ID），将向量搜索与对源表的全文搜索相结合并重新排序。
- **模型选择**：`wippy/embeddings` 固定使用 512 维的 `text-embedding-3-small`，`embeddings_512` 表存储 `vector(512)`/`float[512]`。更换模型或向量维度意味着要修改库常量和迁移表。

## 下一步

- [LLM 框架](framework/llm.md) — `llm.generate`、`llm.embed`、提示构造
- [代理](framework/agents.md) — 将检索器封装为代理工具
- [SQL 模块](lua/storage/sql.md) — 底层数据库访问
- [Text 模块](lua/text/text.md) — 分割器和分词
