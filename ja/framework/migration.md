---
title: "Migration"
description: "SQLite、PostgreSQL、MySQL 向けの順序付き database migration を定義、適用、確認、rollback します。"
---

# Migration

`wippy/migration` モジュールは schema 変更用 DSL、migration を発見して実行する runner、登録されたすべての `target_db` へ未適用 migration を適用する bootloader を提供します。

Migration は SQLite、PostgreSQL、MySQL に対応しています。各 migration は driver 固有の `up` と `down` の実装をまとめて定義できます。

このページは部分的な migration recipe と runner のリファレンスであり、完全なアプリケーションではありません。以下の定義は、モジュールとデータベースを接続した後に調整できます。後続の runner 呼び出しと結果 table はリファレンススニペットです。保持する必要があるデータへ migration を適用する前に backup を作成し、まず使い捨てデータベースで `up` と `down` の両方をテストしてください。

## セットアップ

プロジェクトへモジュールを追加します。

```bash
wippy add wippy/migration
wippy install
```

依存関係と migration の対象となるアプリケーションデータベースを宣言します。

```yaml
version: "1.0"
namespace: app

entries:
  - name: app_db
    kind: db.sql.sqlite
    file: ./data/app.db

  - name: dep.migration
    kind: ns.dependency
    component: wippy/migration
    version: "*"
```

migration bootloader は order `20` で `wippy/bootloader` に登録されます。アプリケーションの起動時、registry 内のすべての migration entry を発見し、`meta.target_db` ごとに group 化して、各データベースで未適用 migration を実行します。

上記の相対 SQLite path を使用する場合は、アプリケーションを開始する前に `data` directory を作成してください。結果は `runner:status()` で確認します。`runner:rollback()` は、migration の `down` 実装がテストデータに対して安全な場合にのみ使用してください。

## Migration の定義

Migration は `meta.type: migration` を持つ `function.lua` entry です。この entry は `migration.define(...)` が生成した関数を返します。

```yaml
entries:
  - name: 01_create_users_table
    kind: function.lua
    meta:
      type: migration
      target_db: app:app_db
      timestamp: "2025-01-15T10:00:00Z"
    source: file://01_create_users_table.lua
    imports:
      migration: wippy.migration:migration
```

```lua
return require("migration").define(function()
    migration("Create users table", function()
        database("sqlite", function()
            up(function(db)
                local _, err = db:execute([[
                    CREATE TABLE users (
                        id    INTEGER PRIMARY KEY,
                        name  TEXT NOT NULL,
                        email TEXT NOT NULL UNIQUE
                    )
                ]])
                if err then error(err) end
            end)

            down(function(db)
                local _, err = db:execute("DROP TABLE IF EXISTS users")
                if err then error(err) end
            end)
        end)

        database("postgres", function()
            up(function(db)
                local _, err = db:execute([[
                    CREATE TABLE users (
                        id    SERIAL PRIMARY KEY,
                        name  TEXT NOT NULL,
                        email TEXT NOT NULL UNIQUE
                    )
                ]])
                if err then error(err) end
            end)

            down(function(db)
                local _, err = db:execute("DROP TABLE IF EXISTS users")
                if err then error(err) end
            end)
        end)
    end)
end)
```

### 必須 Metadata

| フィールド | 必須 | 説明 |
|-------|----------|-------------|
| `meta.type` | はい | 発見対象となるには `"migration"` であること |
| `meta.target_db` | はい | 実行対象データベースの registry ID |
| `meta.timestamp` | いいえ | 複数の migration が同じデータベースを対象とする場合の順序に使用する ISO-8601 timestamp |
| `meta.tags` | いいえ | tag の配列。runner は tag で migration を filter 可能 |

データベースの migration は `meta.timestamp` の昇順で実行されます。`meta.timestamp` は任意です。完全な entry ID が tie-breaker となるため、timestamp が同じまたは存在しない migration も安定した決定論的順序で実行されます。

## DSL

`migration.define` へ渡す関数内では、次の nested function を使用できます。

| 関数 | 説明 |
|----------|-------------|
| `migration(description, fn)` | 人が読める説明を持つ新しい migration を開始 |
| `database(type, fn)` | `"sqlite"`、`"postgres"`、`"mysql"` の実装を宣言 |
| `up(fn)` / `down(fn)` | forward 関数と rollback 関数を定義 |
| `after(fn)` | 任意の post-migration hook（同じ transaction） |

各 `up`/`down`/`after` 関数は raw connection ではなく transaction object を受け取ります。3 つの操作はすべて 1 transaction で実行され、エラー時に rollback されます。

### トランザクション方式 :id=transaction-method

```lua
local rows, err  = db:query(sql, params)    -- SELECT, returns array of rows
local result, err = db:execute(sql, params) -- INSERT/UPDATE/DDL, returns { rows_affected, last_insert_id }
local stmt, err  = db:prepare(sql)          -- prepared statement
```

常に parameterised query を使用してください。

```lua
db:execute("INSERT INTO users (name, email) VALUES (?, ?)", { "Alice", "alice@example.com" })
```

### エラー処理

`error(...)` を呼び出すと migration が中断され、transaction が rollback されます。失敗する可能性がある各 statement を処理してください。

```lua
up(function(db)
    local _, err = db:execute("CREATE TABLE ...")
    if err then error(err) end
end)
```

## ランナー API :id=runner-api

runner はプログラムから使用できる library として公開されます。

```yaml
imports:
  runner: wippy.migration:runner
```

```lua
local runner = require("runner").setup("app:app_db")

local result = runner:run()      -- apply all pending migrations
local result = runner:run_next() -- apply the next pending migration
local result = runner:rollback() -- roll back the most recently applied migration
local status = runner:status()   -- list applied + pending migrations
```

### `runner:run(options)`

設定されたデータベースへ未適用の全 migration を適用します。summary を返します。

```lua
{
    status = "complete",            -- "complete" or "error"
    migrations_found = 3,
    migrations_applied = 2,
    migrations_skipped = 1,
    migrations_failed = 0,
    duration = 0.123,
    migrations = { ... },           -- per-migration status
    skipped_details = { ... },
}
```

Option:

| オプション | 説明 |
|--------|-------------|
| `tags` | tag の配列。`meta.tags` が交差する migration だけを対象とする |

### `runner:rollback(options)`

適用済み migration を適用順の逆順で rollback します。option がなければ、最後に適用された 1 migration を戻します。

```lua
runner:rollback()                                            -- roll back the last migration
runner:rollback({ count = 3 })                               -- roll back the last 3
runner:rollback({ allowed_ids = { "app:01_create_users_table" } }) -- restrict to specific ids
```

Option:

| オプション | 説明 |
|--------|-------------|
| `count` | rollback する migration 数。デフォルトは `1` |
| `allowed_ids` | migration ID の配列。これらだけを rollback 対象にする |

### `runner:status(options)`

データベースのすべての migration を説明する status report を返します。

```lua
{
    database_id        = "app:app_db",
    db_type            = "sqlite",
    total_migrations   = 3,
    applied_migrations = 2,
    pending_migrations = 1,
    migrations = {
        { id = "app:01_...", description = "...", timestamp = "...",
          tags = {}, status = "applied", applied_at = ... },
        -- ...
    },
}
```

適用済み migration が先に `applied_at` 順で並び、その後に未適用 migration が `meta.timestamp`、次いで ID の順で並びます。

## レジストリ API :id=registry-api

`wippy.migration:registry` は直接 registry query を提供します。

| 関数 | 説明 |
|----------|-------------|
| `registry.find({ target_db, tags })` | 条件に一致するすべての migration entry を返す |
| `registry.get(id)` | ID で 1 つの migration entry を返す |
| `registry.get_target_dbs()` | migration に存在する一意な `meta.target_db` をすべて返す |
| `registry.get_tags()` | migration に存在する一意な tag をすべて返す |

bootloader はこれらを使用し、起動時に target database の完全な集合を発見します。

## マイグレーション追跡 :id=migration-tracking

runner は初回実行時、各 target database に `_migrations` table を作成します。適用済み migration は ID で記録されるため、後続の実行では skip されます。tracking table は自動作成されます。これを作成する独自 migration は記述しないでください。

## ベストプラクティス

- **migration ごとに 1 つの論理変更** — 1 table の作成、1 column の追加、または 1 index の作成にします。
- **実際に機能する `down` を記述** — rollback がデータ損失を招くか不可能な場合、成功を報告せず、その制限を説明してエラーを発生させます。
- **idempotency を優先** — `CREATE TABLE IF NOT EXISTS` と `DROP TABLE IF EXISTS` は特別な処理なしで再実行に耐えます。
- **DDL と DML を分離** — table を作成する migration と同じ migration でデータを seed しないでください。
- **両方向をテスト** — migration を適用し、rollback し、schema が開始時の状態に一致することを確認します。

## 関連項目

- [SQL Driver](../system/database.md) — データベースリソースの設定
- [Bootloader](./bootloader.md) — Bootloader の順序と hook
- [Framework 概要](./overview.md) — Framework モジュールの使用方法
