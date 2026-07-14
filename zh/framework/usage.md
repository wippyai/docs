---
title: "使用量跟踪"
description: "wippy/usage 模块记录 LLM 令牌消耗，并提供按时间区间、模型或用户分组的聚合查询。它绑定 wippy.llm:usagetracker 契约，因此任何通过 LLM 模块调用的代码都会自动产生使用量记录。"
---

# 使用量跟踪

`wippy/usage` 模块记录 LLM 令牌消耗，并提供按时间区间、模型或用户分组的聚合查询。它绑定 `wippy.llm:usage_tracker` 契约，因此任何通过 LLM 模块调用的代码都会自动产生使用量记录。

## 配置

将模块添加到项目：

```bash
wippy add wippy/usage
wippy install
```

声明依赖并将 `target_db` 要求指向用于存放使用量记录的数据库：

```yaml
version: "1.0"
namespace: app

entries:
  - name: app_db
    kind: db.sql.sqlite
    path: ./data/app.db

  - name: dep.usage
    kind: ns.dependency
    component: wippy/usage
    version: "*"

  - name: target_db
    kind: registry.entry
    meta:
      wippy.usage.target_db: app:app_db
```

当应用启动时，`wippy/migration` 会运行该模块的 `01_create_token_usage_table` 迁移，创建 `token_usage` 表及其在 `user_id`、`context_id`、`model_id` 和 `timestamp` 上的索引。

## 模式

```
token_usage
├── usage_id           text primary key (uuid v7)
├── user_id            text not null
├── context_id         text
├── model_id           text not null
├── prompt_tokens      integer
├── completion_tokens  integer
├── thinking_tokens    integer default 0
├── cache_read_tokens  integer default 0
├── cache_write_tokens integer default 0
├── timestamp          timestamp
└── meta               text (JSON)
```

## 自动跟踪

`wippy/llm` 在每次生成之前解析 `wippy.llm:usage_tracker` 契约。`wippy/usage` 将其实现绑定为默认值：

```yaml
contracts:
  - contract: wippy.llm:usage_tracker
    default: true
    methods:
      track_usage: wippy.usage:usage_tracker
```

每次成功的 LLM 调用都会以模型 id、令牌计数和可选的 `context_id` 调用 `track_usage`。`user_id` 取自当前的安全主体；不在用户上下文中的调用会被记录为 `"system"`。

## 跟踪器 API

当你需要在 LLM 流程之外记录使用量时，可直接导入跟踪器：

```yaml
imports:
  usage_tracker: wippy.usage:usage_tracker
```

```lua
local tracker = require("usage_tracker")

local usage_id, err = tracker.track_usage(
    "openai:gpt-4o",
    prompt_tokens,
    completion_tokens,
    thinking_tokens,
    cache_read_tokens,
    cache_write_tokens,
    { context_id = "chat-42", metadata = { feature = "summary" } }
)
```

| 参数 | 类型 | 说明 |
|-----------|------|-------------|
| `model_id` | string | 规范化的模型 id |
| `prompt_tokens` | number | 输入令牌 |
| `completion_tokens` | number | 输出令牌 |
| `thinking_tokens` | number | 推理令牌（未报告时为 0） |
| `cache_read_tokens` | number | 提示词缓存命中 |
| `cache_write_tokens` | number | 提示词缓存写入 |
| `options.context_id` | string | 自由格式标签；回退到 `ctx.get("context_id")` |
| `options.timestamp` | number | Unix 时间戳；默认为当前（UTC） |
| `options.metadata` | table | 与记录一同存储的任意 JSON 元数据 |

返回 `usage_id` 或 `nil, err`。

## 仓储 API

`wippy.usage:token_usage_repo` 提供聚合查询：

```yaml
imports:
  usage: wippy.usage:token_usage_repo
```

```lua
local usage = require("usage")

local summary  = usage.get_summary(start_unix, end_unix)
local by_time  = usage.get_usage_by_time(start_unix, end_unix, usage.INTERVAL.DAY)
local by_model = usage.get_usage_by_model(start_unix, end_unix)
local by_user  = usage.get_usage_by_user(start_unix, end_unix)
```

### 函数

| 函数 | 返回值 |
|----------|---------|
| `get_summary(start, end)` | 范围内的总计：prompt/completion/thinking/cache 令牌、请求数、`total_tokens`（prompt + completion + thinking） |
| `get_usage_by_time(start, end, interval)` | 分桶数组，每个区间一个；缺失的桶返回零 |
| `get_usage_by_model(start, end)` | 每模型总计，按 `total_tokens` 降序 |
| `get_usage_by_user(start, end)` | 每用户总计，按 `total_tokens` 降序 |
| `create(user_id, model_id, prompt, completion, options)` | 由跟踪器使用的低层插入 |

### 区间

```lua
usage.INTERVAL.HOUR   -- "hour"
usage.INTERVAL.DAY    -- "day"
usage.INTERVAL.WEEK   -- "week"
usage.INTERVAL.MONTH  -- "month"
```

`get_usage_by_time` 将分桶对齐到所配置的区间。在 PostgreSQL 上使用 `generate_series` 配合区间运算；在 SQLite 上使用基于 UNIX 时间戳的递归 CTE。每个桶中的 `total_tokens` 不包含缓存令牌。

### 时间范围

跟踪器和仓储在公共 API 边界都接受 UNIX 时间戳。仓储内部将其转换为 RFC3339 字符串用于存储和查询。传入 `os.time()` 或 `time.now():unix()` 值，而不是格式化字符串。

## 元数据与上下文

`meta` 列存储自由格式的 JSON 块。使用它将记录与应用事件相关联：

```lua
tracker.track_usage(model_id, prompt, completion, 0, 0, 0, {
    context_id = "chat-42",
    metadata   = {
        session_id = "s-7",
        route      = "/api/summarise",
        agent_id   = "writer",
    },
})
```

`context_id` 是顶级列，可建立索引；`metadata` 以文本形式存储，旨在用于展示，而非过滤。

## 另请参阅

- [LLM](framework/llm.md) - LLM 生成和 `usage_tracker` 契约
- [迁移](framework/migration.md) - 用于创建模式的迁移运行器
- [框架概述](framework/overview.md) - 框架模块用法
