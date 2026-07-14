---
title: "Embeddings"
---

# Embeddings

`wippy/embeddings` 模块为 PostgreSQL（pgvector）和 SQLite（sqlite-vec）提供向量嵌入存储和相似度搜索。它封装 `wippy/llm` 以生成嵌入，并将其持久化到应用数据库。

## 配置

将模块添加到项目：

```bash
wippy add wippy/embeddings
wippy install
```

声明依赖并将 `target_db` 要求指向你的应用数据库：

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

启动时，`wippy/migration` 会拾取 `01_create_embeddings_table` 迁移，并为你的数据库驱动创建带有相应向量索引的 `embeddings` 表。

## 配置常量

默认配置内置于模块中：

| 常量 | 默认值 | 说明 |
|----------|---------|-------------|
| `EMBEDDING_MODEL` | `text-embedding-3-small` | 用于生成向量的 LLM 模型 |
| `EMBEDDING_DIMENSIONS` | `512` | 传递给模型的向量维度 |
| `MAX_TOKENS_PER_REQUEST` | `8000` | 每次调用的令牌预算；大批次会被拆分 |
| `DEFAULT_SEARCH_LIMIT` | `10` | `search` 返回的默认命中数 |

令牌按 `#text / 4` 估算。超出预算的批次会被自动拆分。

## 导入

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

## 高层 API（`wippy.embeddings:embeddings`）

### add

```lua
local result, err = embeddings.add(content, content_type, origin_id, context_id, meta)
```

为 `content` 生成嵌入并持久化。

| 参数 | 类型 | 必填 | 说明 |
|-----------|------|----------|-------------|
| `content` | string | 是 | 要嵌入的文本 |
| `content_type` | string | 是 | 自由格式标签，例如 `"document_chunk"`、`"question"` |
| `origin_id` | string | 是 | 源文档或记录的标识符 |
| `context_id` | string | 否 | 附加作用域键（章节、聊天、租户） |
| `meta` | table | 否 | 任意可 JSON 序列化的元数据 |

返回 `{ id, content, content_type, origin_id, context_id, meta }` 或 `nil, err`。

### add_batch

```lua
local result, err = embeddings.add_batch({
    { content = "...", content_type = "chunk", origin_id = "doc-1" },
    { content = "...", content_type = "chunk", origin_id = "doc-1", context_id = "s1" },
})
```

在一次调用中嵌入并存储多个条目。如果估算的总令牌数超过 `MAX_TOKENS_PER_REQUEST`，批次会被拆分并分块处理。返回 `{ count, items = { ... } }`。

### search

```lua
local hits, err = embeddings.search("how do migrations work?", {
    content_type = "document_chunk",
    origin_id    = "doc-1",
    context_id   = "section-2",
    limit        = 10,
})
```

对查询字符串进行嵌入并针对已存储向量执行相似度搜索。所有过滤条件均为可选；匹配记录按相似度排序。

### find_by_type

```lua
local hits, err = embeddings.find_by_type(query, content_type, { limit = 10 })
```

限定于单一 `content_type` 的 `search` 便捷封装。

### find_by_origin

```lua
local hits, err = embeddings.find_by_origin(query, origin_id, {
    content_type = "document_chunk",
    context_id   = "section-2",
    limit        = 5,
})
```

限定于单一 `origin_id` 的便捷封装，可选地进一步收窄。

## 仓储 API（`wippy.embeddings:embedding_repo`）

当你已经有向量并希望跳过嵌入生成时，可以直接使用仓储：

| 函数 | 说明 |
|----------|-------------|
| `embedding_repo.add(content, content_type, origin_id, context_id, meta, embedding)` | 插入预先计算的向量 |
| `embedding_repo.add_batch(batch)` | 在一条语句中插入多个预先计算的向量 |
| `embedding_repo.get_by_origin(origin_id)` | 列出给定 origin 的所有记录 |
| `embedding_repo.delete_by_origin(origin_id)` | 删除给定 origin 的所有记录 |
| `embedding_repo.delete_by_entry(entry_id)` | 按行 id 删除单条记录 |
| `embedding_repo.search_by_embedding(vector, options)` | 针对原始向量的相似度搜索 |

`search_by_embedding` 接受 `{ content_type, origin_id, context_id, limit }`。

## 数据库支持

迁移会根据 `target_db` 处的数据库驱动创建相应的模式：

- **PostgreSQL** - `embeddings` 表带有 `vector(512)` 列和 IVFFlat 索引。需要 `pgvector` 扩展。
- **SQLite** - `embeddings` 表将向量以文本形式存储，并配备用于 KNN 搜索的 `sqlite-vec` 虚拟表。

向量在 API 层始终通过纯 JSON 数组进行来回传递。

## 另请参阅

- [LLM](framework/llm.md) - `llm.embed(...)` 用于原始嵌入生成
- [迁移](framework/migration.md) - 用于创建该表的迁移运行器
- [框架概述](framework/overview.md) - 框架模块用法
