# Migrations

`wippy/migration` モジュールは、スキーマ変更を定義するための小さな DSL、それらを検出して実行するランナー、プロジェクトに登録されたすべての `target_db` に対して保留中のマイグレーションを実行するブートローダーを備えたデータベースマイグレーションフレームワークを提供します。

マイグレーションは SQLite、PostgreSQL、MySQL をサポートし、ドライバーごとの `up`/`down` 実装を並べて定義できます。

## セットアップ

プロジェクトにモジュールを追加します:

```bash
wippy add wippy/migration
wippy install
```

依存関係と、マイグレーションの対象となるアプリケーションデータベースを宣言します:

```yaml
version: "1.0"
namespace: app

entries:
  - name: app_db
    kind: db.sql.sqlite
    path: ./data/app.db

  - name: dep.migration
    kind: ns.dependency
    component: wippy/migration
    version: "*"
```

マイグレーションブートローダーは `wippy/bootloader` に順序 `20` で登録されます。アプリケーションが起動すると、レジストリ内のすべてのマイグレーションエントリを検出し、`meta.target_db` でグループ化して、各データベースに対して保留中のマイグレーションを実行します。

## マイグレーションの定義

マイグレーションは `meta.type: migration` を持つ `function.lua` エントリです。このエントリは `migration.define(...)` によって生成された関数を返します。

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
                local ok, err = db:execute([[
                    CREATE TABLE users (
                        id    INTEGER PRIMARY KEY,
                        name  TEXT NOT NULL,
                        email TEXT NOT NULL UNIQUE
                    )
                ]])
                if err then error(err) end
            end)

            down(function(db)
                db:execute("DROP TABLE IF EXISTS users")
            end)
        end)

        database("postgres", function()
            up(function(db)
                db:execute([[
                    CREATE TABLE users (
                        id    SERIAL PRIMARY KEY,
                        name  TEXT NOT NULL,
                        email TEXT NOT NULL UNIQUE
                    )
                ]])
            end)

            down(function(db)
                db:execute("DROP TABLE IF EXISTS users")
            end)
        end)
    end)
end)
```

### 必須メタデータ

| フィールド | 必須 | 説明 |
|-------|----------|-------------|
| `meta.type` | yes | 検出のため `"migration"` である必要があります |
| `meta.target_db` | yes | 実行対象データベースのレジストリ ID |
| `meta.timestamp` | no | 同一データベースに対して複数のマイグレーションがある場合の並び順に使用される ISO-8601 タイムスタンプ |
| `meta.tags` | no | タグの配列。ランナーはタグでマイグレーションをフィルタリングできます |

データベースに対するマイグレーションは、`meta.timestamp` の昇順で実行されます。

## DSL

`migration.define` に渡される関数の内部では、3 つのネストされた関数が利用できます:

| 関数 | 説明 |
|----------|-------------|
| `migration(description, fn)` | 人間が読める説明とともに新しいマイグレーションを開始 |
| `database(type, fn)` | `"sqlite"`、`"postgres"`、または `"mysql"` の実装を宣言 |
| `up(fn)` / `down(fn)` | 前進およびロールバック関数を定義 |
| `after(fn)` | オプションのマイグレーション後フック（同一トランザクション） |

各 `up`/`down`/`after` 関数は、生の接続ではなくトランザクションオブジェクトを受け取ります。3 つの操作はすべて単一のトランザクション内で実行され、エラー時にはロールバックされます。

### トランザクションメソッド

```lua
local rows, err  = db:query(sql, params)    -- SELECT, returns array of rows
local result, err = db:execute(sql, params) -- INSERT/UPDATE/DDL, returns { rows_affected, last_insert_id }
local stmt, err  = db:prepare(sql)          -- prepared statement
```

常にパラメータ化クエリを使用してください:

```lua
db:execute("INSERT INTO users (name, email) VALUES (?, ?)", { "Alice", "alice@example.com" })
```

### エラー処理

`error(...)` の呼び出しはマイグレーションを中止し、トランザクションをロールバックします。失敗する可能性があるすべてのステートメントをラップしてください:

```lua
up(function(db)
    local _, err = db:execute("CREATE TABLE ...")
    if err then error(err) end
end)
```

## Runner API

ランナーはプログラムで使用するためのライブラリとして公開されています:

```yaml
imports:
  runner: wippy.migration:runner
```

```lua
local runner = require("runner").setup("app:app_db")

local result = runner:run()      -- apply all pending migrations
local result = runner:run_next() -- apply the next pending migration
local result = runner:rollback({ id = "app:01_create_users_table" })
local status = runner:status()   -- list applied + pending migrations
```

### `runner:run(options)`

設定されたデータベースのすべての保留中マイグレーションを適用します。サマリーを返します:

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

オプション:

| オプション | 説明 |
|--------|-------------|
| `tags` | タグの配列。`meta.tags` が交差するマイグレーションのみが対象となります |

### `runner:rollback(options)`

ID（必須）により単一のマイグレーションをロールバックします:

```lua
runner:rollback({ id = "app:01_create_users_table" })
```

### `runner:status(options)`

`{ applied = {...}, pending = {...} }` を返し、それぞれ `applied_at` と `meta.timestamp` でソートされます。

## Registry API

`wippy.migration:registry` は直接的なレジストリクエリを提供します:

| 関数 | 説明 |
|----------|-------------|
| `registry.find({ target_db, tags })` | 条件に一致するすべてのマイグレーションエントリを返す |
| `registry.get(id)` | ID により単一のマイグレーションエントリを返す |
| `registry.get_target_dbs()` | マイグレーションに存在するすべての一意な `meta.target_db` を返す |
| `registry.get_tags()` | マイグレーションに存在するすべての一意なタグを返す |

ブートローダーはこれらを使用して、起動時に対象データベースの全セットを検出します。

## マイグレーション追跡

ランナーは初回実行時に、各対象データベースに `wippy_migrations` テーブルを作成します。適用されたマイグレーションは ID で記録されるため、以降の実行ではスキップされます。追跡テーブルは自動的に作成されるため、独自のマイグレーションで作成しないでください。

## ベストプラクティス

- **1 つのマイグレーションにつき 1 つの論理変更** - 1 つのテーブルを作成、1 つのカラムを追加、1 つのインデックスを作成。
- **実際の `down` を書く** - ロールバックが不可能な場合（データ損失）は、暗黙的に成功するのではなく、それを文書化してエラーを発生させます。
- **冪等性を優先** - `CREATE TABLE IF NOT EXISTS` と `DROP TABLE IF EXISTS` は特別な処理なしで再実行に耐えます。
- **DDL と DML を分離** - 可能な限り、テーブルを作成する同じマイグレーションでデータをシードしないでください。
- **両方向をテスト** - マイグレーションを適用し、ロールバックして、スキーマが開始状態と一致することを確認します。

## 関連情報

- [SQL Driver](system/database.md) - データベースリソースの設定
- [Bootloader](framework/bootloader.md) - ブートローダーの順序とフック
- [Framework Overview](framework/overview.md) - フレームワークモジュールの使用方法
