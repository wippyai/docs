---
title: "检索增强生成 (RAG)"
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
- 配置了嵌入模型（例如 `text-embedding-3-small`）的 LLM 提供者 — 参见 [LLM 框架](framework/llm.md)。
- 已引导的 Wippy 项目（`wippy init`、`wippy add wippy/embeddings`）。

## 依赖项

声明 `wippy/embeddings` 依赖并将其指向您的数据库。`target_db` 参数是嵌入表将所在的数据库条目的 Registry ID：

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

`wippy/embeddings` 会引入 `wippy/llm` 以及创建 `embeddings_512` 表的迁移（PostgreSQL `pgvector` 或 SQLite `vec0` 虚拟表）。

## 摄取文档

分割由 `text` 模块处理；嵌入和持久化由 `embeddings` 库处理。

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

注册函数及其导入：

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

## 端到端示例

将其组合在 HTTP 端点后面：

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

  - name: ingest
    kind: function.lua
    source: file://app/ingest.lua
    method: ingest
    modules:
      - text
      - uuid
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
    lifecycle:
      auto_start: true

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
        res:set_status(http.STATUS.INTERNAL_ERROR)
        res:write_json({ error = ans_err })
        return
    end

    res:write_json(result)
end

return { handler = handler }
```

通过从设置进程或 CLI 命令（带 `meta.command` 的 `process.lua`）调用 `ingest` 来播种索引，然后查询：

```bash
curl -X POST http://localhost:8080/api/ask \
    -H 'Content-Type: application/json' \
    -d '{"question":"how do I configure TLS?"}'
```

## 运行说明

- **块大小**：500–1000 个 token 是一个良好的起点。太小会丢失局部上下文；太大会稀释相似度分数。使用 `chunk_overlap`（块大小的 ~10–20%）来在边界之间保留句子。
- **内容类型**：使用不同的 `content_type` 值（`doc_chunk`、`faq`、`code_snippet`），以便搜索可以按类型过滤。
- **重新索引**：在添加新块之前，通过 `embedding_repo.delete_by_origin(doc_id)` 按文档删除并重新摄取。
- **混合搜索**：对于精确术语召回（名称、ID），将向量搜索与对源表的全文搜索相结合并重新排序。
- **模型选择**：默认的 512 维 `text-embedding-3-small` 具有成本效益。只有在召回不足时才升级到 1024 或 3072 维 — 更大的向量意味着更大的存储和更慢的搜索。

## 下一步

- [LLM 框架](framework/llm.md) — `llm.generate`、`llm.embed`、提示构造
- [代理](framework/agents.md) — 将检索器封装为代理工具
- [SQL 模块](lua/storage/sql.md) — 底层数据库访问
- [Text 模块](lua/text/text.md) — 分割器和分词
