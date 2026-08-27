---
title: "Usage Tracking"
description: "Record LLM token consumption and query usage totals by time interval, model, or user."
---

# Usage Tracking

The `wippy/usage` module records LLM token consumption and provides aggregate queries by time interval, model, or user. It is the default implementation of the `wippy.llm:usage_tracker` contract, so calls made through the LLM module produce usage records automatically.

This page is an API primer with reference snippets, not a standalone tutorial. The snippets assume an existing Wippy project, a configured SQL database, and `wippy/llm` when automatic tracking is required. Usage rows persist in the selected database; remove sample rows through your normal database-maintenance workflow when testing is complete.

## Setup

Add the module to your project:

```bash
wippy add wippy/usage
wippy install
```

Declare the dependency and set `target_db` to the database that will store usage records:

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

When the application starts, `wippy/migration` runs the module's `01_create_token_usage_table` migration, which creates the `token_usage` table along with indexes on `user_id`, `context_id`, `model_id`, and `timestamp`.

If you use the relative SQLite path shown above, create the `data` directory before starting the application.

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

## Automatic Tracking

`wippy/llm` resolves the `wippy.llm:usage_tracker` contract before each generation. `wippy/usage` binds its implementation as the default:

```yaml
contracts:
  - contract: wippy.llm:usage_tracker
    default: true
    methods:
      track_usage: wippy.usage:usage_tracker
```

Every successful LLM call invokes `track_usage` with the model id, token counts, and an optional `context_id`. The `user_id` is taken from the active security actor; calls outside of a user context are recorded as `"system"`.

## Tracker API

Import the tracker directly to record usage outside the LLM flow:

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

| Parameter | Type | Description |
|-----------|------|-------------|
| `model_id` | string | Canonical model id |
| `prompt_tokens` | number | Input tokens |
| `completion_tokens` | number | Output tokens |
| `thinking_tokens` | number | Reasoning tokens (0 when not reported) |
| `cache_read_tokens` | number | Prompt-cache hits |
| `cache_write_tokens` | number | Prompt-cache writes |
| `options.context_id` | string | Free-form tag; falls back to `ctx.get("context_id")` |
| `options.timestamp` | number | Unix timestamp; defaults to now (UTC) |
| `options.metadata` | table | Arbitrary JSON metadata stored alongside the record |

Returns `usage_id` or `nil, err`.

## Repository API

`wippy.usage:token_usage_repo` offers aggregate queries:

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

### Functions

| Function | Returns |
|----------|---------|
| `get_summary(start, end)` | Totals across the range: prompt/completion/thinking/cache tokens, request count, `total_tokens` (prompt + completion + thinking) |
| `get_usage_by_time(start, end, interval)` | Array of buckets, one per interval; missing buckets return zeroes |
| `get_usage_by_model(start, end)` | Per-model totals, ordered by `total_tokens` descending |
| `get_usage_by_user(start, end)` | Per-user totals, ordered by `total_tokens` descending |
| `create(user_id, model_id, prompt, completion, options)` | Low-level insert used by the tracker |

### Intervals

```lua
usage.INTERVAL.HOUR   -- "hour"
usage.INTERVAL.DAY    -- "day"
usage.INTERVAL.WEEK   -- "week"
usage.INTERVAL.MONTH  -- "month"
```

`get_usage_by_time` aligns buckets to the configured interval. On PostgreSQL it uses `generate_series` with interval arithmetic; on SQLite it uses a recursive CTE over UNIX timestamps. `total_tokens` in each bucket excludes cache tokens.

### Time Ranges

Both the tracker and the repository accept UNIX timestamps at the public API boundary. Internally the repository converts to RFC3339 strings for storage and querying. Pass `os.time()` or `time.now():unix()` values, not formatted strings.

## Metadata and Context

The `meta` column stores free-form JSON for correlating records with application events:

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

`context_id` is a top-level column and can be indexed; `metadata` is stored as text and is intended for display, not filtering.

## See Also

- [LLM](./llm.md) — LLM generation and the `usage_tracker` contract
- [Migrations](./migration.md) — Migration runner that creates the schema
- [Framework Overview](./overview.md) — Framework module usage
