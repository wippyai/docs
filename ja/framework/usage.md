# Usage Tracking

`wippy/usage` モジュールは LLM のトークン消費を記録し、時間間隔、モデル、またはユーザーでグループ化された集計クエリを提供します。`wippy.llm:usage_tracker` コントラクトにバインドされるため、LLM モジュールを介して呼び出されるコードは自動的に使用量レコードを生成します。

## セットアップ

プロジェクトにモジュールを追加します:

```bash
wippy add wippy/usage
wippy install
```

依存関係を宣言し、`target_db` 要件を使用量レコードを保存するデータベースに向けます:

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

アプリケーションが起動すると、`wippy/migration` がモジュールの `01_create_token_usage_table` マイグレーションを実行し、`user_id`、`context_id`、`model_id`、`timestamp` のインデックスとともに `token_usage` テーブルを作成します。

## スキーマ

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

## 自動追跡

`wippy/llm` は各生成の前に `wippy.llm:usage_tracker` コントラクトを解決します。`wippy/usage` は自身の実装をデフォルトとしてバインドします:

```yaml
contracts:
  - contract: wippy.llm:usage_tracker
    default: true
    methods:
      track_usage: wippy.usage:usage_tracker
```

成功した LLM 呼び出しごとに、モデル ID、トークン数、オプションの `context_id` を指定して `track_usage` が呼び出されます。`user_id` はアクティブなセキュリティアクターから取得され、ユーザーコンテキスト外の呼び出しは `"system"` として記録されます。

## Tracker API

LLM フローの外部で使用量を記録する必要がある場合は、トラッカーを直接インポートします:

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

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `model_id` | string | 正規のモデル ID |
| `prompt_tokens` | number | 入力トークン |
| `completion_tokens` | number | 出力トークン |
| `thinking_tokens` | number | 推論トークン（報告されない場合は 0） |
| `cache_read_tokens` | number | プロンプトキャッシュヒット |
| `cache_write_tokens` | number | プロンプトキャッシュ書き込み |
| `options.context_id` | string | 自由形式のタグ。`ctx.get("context_id")` にフォールバック |
| `options.timestamp` | number | Unix タイムスタンプ。デフォルトは現在（UTC） |
| `options.metadata` | table | レコードと一緒に保存される任意の JSON メタデータ |

`usage_id` または `nil, err` を返します。

## Repository API

`wippy.usage:token_usage_repo` は集計クエリを提供します:

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

### 関数

| 関数 | 戻り値 |
|----------|---------|
| `get_summary(start, end)` | 範囲全体の合計: prompt/completion/thinking/cache トークン、リクエスト数、`total_tokens`（prompt + completion + thinking） |
| `get_usage_by_time(start, end, interval)` | 間隔ごとのバケット配列。欠落したバケットはゼロを返します |
| `get_usage_by_model(start, end)` | モデルごとの合計。`total_tokens` 降順でソート |
| `get_usage_by_user(start, end)` | ユーザーごとの合計。`total_tokens` 降順でソート |
| `create(user_id, model_id, prompt, completion, options)` | トラッカーが使用する低レベル挿入 |

### 間隔

```lua
usage.INTERVAL.HOUR   -- "hour"
usage.INTERVAL.DAY    -- "day"
usage.INTERVAL.WEEK   -- "week"
usage.INTERVAL.MONTH  -- "month"
```

`get_usage_by_time` は設定された間隔にバケットを揃えます。PostgreSQL では間隔演算を伴う `generate_series` を使用し、SQLite では UNIX タイムスタンプに対する再帰 CTE を使用します。各バケットの `total_tokens` はキャッシュトークンを除外します。

### 時間範囲

トラッカーとリポジトリの両方は、公開 API 境界で UNIX タイムスタンプを受け付けます。内部的にはリポジトリが保存とクエリのために RFC3339 文字列に変換します。フォーマットされた文字列ではなく、`os.time()` または `time.now():unix()` の値を渡してください。

## メタデータとコンテキスト

`meta` カラムは自由形式の JSON BLOB を保存します。これを使用してレコードをアプリケーションイベントと関連付けます:

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

`context_id` はトップレベルカラムでインデックスを付けられます。`metadata` はテキストとして保存され、フィルタリングではなく表示を目的としています。

## 関連情報

- [LLM](llm.md) - LLM 生成と `usage_tracker` コントラクト
- [Migrations](migration.md) - スキーマを作成するマイグレーションランナー
- [Framework Overview](overview.md) - フレームワークモジュールの使用方法
