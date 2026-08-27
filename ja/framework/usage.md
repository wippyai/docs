---
title: "使用量トラッキング"
description: "LLM token 消費量を記録し、時間間隔、model、user ごとの使用量合計を query します。"
---

# 使用量トラッキング

`wippy/usage` モジュールは LLM token 消費量を記録し、時間間隔、model、user ごとの集計 query を提供します。これは `wippy.llm:usage_tracker` contract のデフォルト実装であるため、LLM モジュールを通じた呼び出しでは使用量 record が自動的に生成されます。

このページはリファレンススニペットを含む API 入門であり、独立したチュートリアルではありません。スニペットは既存の Wippy プロジェクト、設定済み SQL データベース、自動トラッキングが必要な場合の `wippy/llm` を前提としています。使用量 row は選択したデータベースへ永続化されます。テスト完了後、通常のデータベース保守手順で sample row を削除してください。

## セットアップ

プロジェクトへモジュールを追加します。

```bash
wippy add wippy/usage
wippy install
```

依存関係を宣言し、使用量 record を格納するデータベースを `target_db` に設定します。

```yaml
version: "1.0"
namespace: app

entries:
  - name: app_db
    kind: db.sql.sqlite
    file: ./data/app.db

  - name: dep.usage
    kind: ns.dependency
    component: wippy/usage
    version: "*"
    parameters:
      - name: target_db
        value: app:app_db
```

アプリケーションの起動時、`wippy/migration` はモジュールの `01_create_token_usage_table` migration を実行します。これにより `token_usage` table と、`user_id`、`context_id`、`model_id`、`timestamp` の index が作成されます。

上記の相対 SQLite path を使用する場合は、アプリケーションを開始する前に `data` directory を作成してください。

## Schema

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

## 自動トラッキング

`wippy/llm` は各 generation の前に `wippy.llm:usage_tracker` contract を解決します。`wippy/usage` はその実装をデフォルトとして bind します。

```yaml
contracts:
  - contract: wippy.llm:usage_tracker
    default: true
    methods:
      track_usage: wippy.usage:usage_tracker
```

成功した各 LLM 呼び出しは、model ID、token count、任意の `context_id` を指定して `track_usage` を呼び出します。`user_id` は active な security actor から取得されます。user context 外の呼び出しは `"system"` として記録されます。

## Tracker API

LLM flow 外の使用量を記録するには、tracker を直接 import します。

```yaml
imports:
  usage_tracker: wippy.usage:usage_tracker
```

```lua
local tracker = require("usage_tracker")

-- Numeric counts supplied by the caller or model provider.
local prompt_tokens, completion_tokens = 120, 40
local thinking_tokens = 0
local cache_read_tokens, cache_write_tokens = 0, 0

local usage_id, err = tracker.track_usage(
    "openai:gpt-4o",
    prompt_tokens,
    completion_tokens,
    thinking_tokens,
    cache_read_tokens,
    cache_write_tokens,
    { context_id = "chat-42", metadata = { feature = "summary" } }
)
if err then
    error("Failed to record usage: " .. tostring(err))
end
```

| Parameter | 型 | 説明 |
|-----------|------|-------------|
| `model_id` | string | canonical model ID |
| `prompt_tokens` | number | input token |
| `completion_tokens` | number | output token |
| `thinking_tokens` | number | reasoning token（報告されない場合は 0） |
| `cache_read_tokens` | number | prompt cache hit |
| `cache_write_tokens` | number | prompt cache write |
| `options.context_id` | string | 自由形式の tag。未指定時は `ctx.get("context_id")` にフォールバック |
| `options.timestamp` | number | Unix timestamp。デフォルトは現在時刻（UTC） |
| `options.metadata` | table | record とともに格納する任意の JSON metadata |

`usage_id` または `nil, err` を返します。

## Repository API

`wippy.usage:token_usage_repo` は集計 query を提供します。

```yaml
modules:
  - time
imports:
  usage: wippy.usage:token_usage_repo
```

```lua
local usage = require("usage")
local time = require("time")

-- Inclusive query bounds expressed as UNIX timestamps.
local end_unix = time.now():unix()
local start_unix = end_unix - (24 * 60 * 60)

local function require_result(value, err)
    if err then
        error("Usage query failed: " .. tostring(err))
    end
    return value
end

local summary  = require_result(usage.get_summary(start_unix, end_unix))
local by_time  = require_result(usage.get_usage_by_time(start_unix, end_unix, usage.INTERVAL.DAY))
local by_model = require_result(usage.get_usage_by_model(start_unix, end_unix))
local by_user  = require_result(usage.get_usage_by_user(start_unix, end_unix))
```

### 関数

| 関数 | 戻り値 |
|----------|---------|
| `get_summary(start, end)` | 範囲全体の合計: prompt/completion/thinking/cache token、request count、`total_tokens`（prompt + completion + thinking） |
| `get_usage_by_time(start, end, interval)` | interval ごとの bucket 配列。欠けている bucket は zero を返す |
| `get_usage_by_model(start, end)` | model ごとの合計。`total_tokens` の降順 |
| `get_usage_by_user(start, end)` | user ごとの合計。`total_tokens` の降順 |
| `create(user_id, model_id, prompt, completion, options)` | tracker が使用する低レベル insert |

### 時間間隔

```lua
usage.INTERVAL.HOUR   -- "hour"
usage.INTERVAL.DAY    -- "day"
usage.INTERVAL.WEEK   -- "week"
usage.INTERVAL.MONTH  -- "month"
```

`get_usage_by_time` は bucket を設定された interval に揃えます。PostgreSQL では interval arithmetic を伴う `generate_series` を使用し、SQLite では UNIX timestamp 上の recursive CTE を使用します。各 bucket の `total_tokens` には cache token は含まれません。

### 時間範囲

tracker と repository は、どちらも public API 境界で UNIX timestamp を受け取ります。repository は内部で格納と query のため RFC3339 string へ変換します。format 済み string ではなく、`os.time()` または `time.now():unix()` の値を渡してください。

## Metadata と Context

`meta` column は record とアプリケーションイベントを関連付けるための自由形式 JSON を格納します。

```lua
local usage_id, err = tracker.track_usage("openai:gpt-4o", 120, 40, 0, 0, 0, {
    context_id = "chat-42",
    metadata   = {
        session_id = "s-7",
        route      = "/api/summarise",
        agent_id   = "writer",
    },
})
if err then
    error("Failed to record usage metadata: " .. tostring(err))
end
```

`context_id` は top-level column で index を作成できます。`metadata` は text として格納され、filter ではなく表示を目的とします。

## 関連項目

- [LLM](./llm.md) — LLM generation と `usage_tracker` contract
- [Migration](./migration.md) — schema を作成する migration runner
- [Framework 概要](./overview.md) — Framework モジュールの使用方法
