# Dataflow：本地知识库

在您自己的机器上构建知识库 — 创建向量存储，然后将文档分块并摄取到其中。这是 [RAG 教程](tutorials/rag.md) 的数据创建伴侣篇：在这里您搭建并填充一个本地 KB；在那里您从中检索并生成答案。两者都使用由本地 SQLite 向量存储支撑的 `wippy/embeddings` 模块。

## 您将构建什么

1. 一个本地应用，其数据库中保存着一个 512 维的向量存储。
2. 在启动时创建 `embeddings_512` 表的迁移。
3. 一个摄取函数，用于分割 markdown 并将嵌入写入存储。

## 先决条件

- 一个 Wippy 项目（克隆 [app-template](https://github.com/wippyai/app-template)，或 `wippy init`）。
- 一个配置了嵌入模型（例如 `text-embedding-3-small`）的 LLM 提供者 — 参见 [LLM 框架](framework/llm.md)。向量存储无需它即可在本地创建，但摄取（会调用 `llm.embed`）需要一个已配置的提供者。

安装依赖项：

```bash
wippy add wippy/embeddings
wippy add wippy/migration
wippy add wippy/bootloader
wippy add wippy/llm
wippy install
```

## 创建存储

KB 存放在一个本地 SQLite 数据库中。`wippy/embeddings` 附带一个创建向量表的迁移；bootloader 在启动时运行它。将各部分连接在一起：

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

bootloader 需要一个环境存储；在它自己的命名空间中添加标准存储：

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

创建数据目录并启动应用：

```bash
mkdir -p data
wippy run
```

启动时迁移会运行，存储出现在 `data/app.db` 中：

```
$ sqlite3 data/app.db ".tables"
_migrations            embeddings_512         embeddings_512_chunks
embeddings_512_info    embeddings_512_rowids  embeddings_512_vector_chunks00
...
```

`embeddings_512` 是一个 SQLite `vec0` 虚拟表；`embeddings_512_*` 影子表保存它的块、行 id 和元数据。（在 PostgreSQL 上，相同的迁移改用 `pgvector`。）

## 摄取文档

摄取分为两步：用 `text` 模块将文本分割成块，然后用 `embeddings.add_batch` 写入它们，该函数会嵌入并持久化每个块。

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

注册函数：

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

要点：

- `origin_id` 将来自同一源文档的所有块分组 — 使用 `embedding_repo.delete_by_origin(doc_id)` 按文档删除并重新摄取。
- `content_type` 让您可以在一个存储中保留不同的语料库（`doc_chunk`、`faq`、`code_snippet`）并在查询时过滤。
- 当批次超过 8000 token 的请求限制时，`add_batch` 会自动拆分。

## 验证内容

文档摄取后，确认行已写入并运行一次相似度搜索：

```lua
local embeddings = require("embeddings")

local results, err = embeddings.search("how do I configure TLS?", {
    content_type = "doc_chunk",
    limit = 5,
})
-- results[i].content, .similarity, .meta, .origin_id, .context_id
```

接下来，[RAG 教程](tutorials/rag.md) 展示了如何将这些结果提供给 LLM 以生成有依据的答案。

## 运行说明

- **块大小**：500–1000 个 token 是一个良好的默认值。使用 `chunk_overlap`（块大小的 ~10–20%），以免句子在边界处被切断。
- **维度**：512 维的 `text-embedding-3-small` 具有成本效益，并与 `embeddings_512` 表匹配。更大的向量意味着更大的存储和更慢的搜索。
- **本地 vs. 共享**：SQLite（`vec0`）将整个 KB 保存在一个本地文件中 — 非常适合开发和单节点应用。将 `target_db` 指向带有 `pgvector` 的 `db.sql.postgres` 即可获得共享的生产存储；摄取代码无需改动。

## 下一步

- [RAG](tutorials/rag.md) — 从此存储中检索并生成有依据的答案
- [LLM 框架](framework/llm.md) — `llm.embed`、嵌入模型、提供者
- [Text 模块](lua/text/text.md) — 分割器和分词
