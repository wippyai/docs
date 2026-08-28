---
title: "SQLデータベース"
description: "構成済みのデータベースに対して、パラメータ化 SQL クエリ、トランザクション、プリペアドステートメントを実行します。"
---

# SQLデータベース
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>
<secondary-label ref="permissions"/>

`sql` モジュールは、構成済みの PostgreSQL、MySQL、SQLite データベースに対してクエリを実行します。パラメータ化クエリ、トランザクション、プリペアドステートメント、クエリビルダーをサポートします。

このページは API リファレンスです。スニペットでは、構成済みのデータベース、それを取得する権限、クエリで参照するテーブルが存在することを前提としています。各スニペットは単独のアプリケーションではなく、個別の呼び出しを示します。末尾の統合レシピには、追加のスキーマとドライバーに関する前提を記載しています。

データベースの構成については、[データベース](../../system/database.md)を参照してください。

## ロード

```lua
local sql = require("sql")
```

## `sql.get`

リソースレジストリからデータベース接続を取得:

```lua
local db, err = sql.get("app.db:main")
if err then
    return nil, err
end

local function finish(value, primary_err)
    local _, release_err = db:release()
    if primary_err then return nil, primary_err end
    if release_err then return nil, release_err end
    return value
end

local rows, err = db:query("SELECT * FROM users WHERE active = ?", {1})
if err then
    return finish(nil, err)
end

return finish(rows)
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `id` | string | リソースID（例: "app.db:main"） |

**戻り値:** `DB, error`

<note>
データベースのリースは、実行フレームのクリーンアップ時に解放されます。データベースの処理が完了したら、特に長時間実行される操作では `db:release()` を明示的に呼び出してください。
</note>

<note>
直接の `db` クエリとトランザクションクエリは、プレースホルダーを変更せずにデータベースドライバーへ渡します。SQLite と MySQL は `?`、PostgreSQL は `$1`、`$2` などを使用します。ビルダーの `run_with` 呼び出しは、PostgreSQL に対して自動的にドル形式のプレースホルダーを選択します。その他のデータベースタイプでは、デフォルトが `?` である、ビルダーが選択した形式を保持します。`to_sql` で SQL を生成する場合や別の形式が必要な場合は、`placeholder_format` を設定してください。
</note>

## 定数

### データベースタイプ

```lua
sql.type.POSTGRES    -- "postgres"
sql.type.MYSQL       -- "mysql"
sql.type.SQLITE      -- "sqlite"
sql.type.UNKNOWN     -- "unknown"
```

### 分離レベル

```lua
sql.isolation.DEFAULT           -- "default"
sql.isolation.READ_UNCOMMITTED  -- "read_uncommitted"
sql.isolation.READ_COMMITTED    -- "read_committed"
sql.isolation.WRITE_COMMITTED   -- "write_committed"
sql.isolation.REPEATABLE_READ   -- "repeatable_read"
sql.isolation.SERIALIZABLE      -- "serializable"
```

### NULL 値

```lua
local insert = sql.builder.insert("users")
    :columns("name", "email")
    :values("alice", sql.NULL)
```

## 型変換

### `sql.as.int`

値を SQL integer 型に変換します。

```lua
local value = sql.as.int(42)
```

**戻り値:** `userdata`

### `sql.as.float`

値を SQL float 型に変換します。

```lua
local value = sql.as.float(19.99)
```

**戻り値:** `userdata`

### `sql.as.text`

値を SQL text 型に変換します。

```lua
local value = sql.as.text("hello")
```

**戻り値:** `userdata`

### `sql.as.binary`

値を SQL binary 型に変換します。

```lua
local value = sql.as.binary("binary data")
```

**戻り値:** `userdata`

### `sql.as.null`

SQL `NULL` マーカーを返します。

```lua
local value = sql.as.null()
```

**戻り値:** `userdata`

## クエリビルダー

### `sql.builder.select`

`SELECT` クエリビルダーを作成します。

```lua
local query = sql.builder.select("id", "name")
    :from("users")
    :where({active = 1})
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `columns` | ...string | カラム名（オプション） |

**戻り値:** `SelectBuilder`

### `sql.builder.insert`

`INSERT` クエリビルダーを作成します。

```lua
local query = sql.builder.insert("users")
    :columns("name", "email")
    :values("alice", "alice@example.com")
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `table` | string | テーブル名（オプション） |

**戻り値:** `InsertBuilder`

### `sql.builder.update`

`UPDATE` クエリビルダーを作成します。

```lua
local query = sql.builder.update("users")
    :set("status", "active")
    :where({id = 123})
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `table` | string | テーブル名（オプション） |

**戻り値:** `UpdateBuilder`

### `sql.builder.delete`

`DELETE` クエリビルダーを作成します。

```lua
local query = sql.builder.delete("users")
    :where({active = 0})
    :limit(100)
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `table` | string | テーブル名（オプション） |

**戻り値:** `DeleteBuilder`

### `sql.builder.expr`

`WHERE` または `HAVING` 句で使用する生の SQL 式を作成します。

```lua
local expr = sql.builder.expr("score BETWEEN ? AND ?", 80, 90)
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `sql` | string | ?プレースホルダー付きSQL式 |
| `args` | ...any | バインド引数（オプション） |

**戻り値:** `Sqlizer`

### `sql.builder.eq`

テーブルから等価条件を作成。

```lua
local cond = sql.builder.eq({active = 1, status = "open"})
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `map` | table | {column = value}ペア |

**戻り値:** `Sqlizer`

### `sql.builder.not_eq`

テーブルから不等価条件を作成。

```lua
local cond = sql.builder.not_eq({status = "closed"})
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `map` | table | {column = value}ペア |

**戻り値:** `Sqlizer`

### `sql.builder.lt`

テーブルから小なり条件を作成。

```lua
local cond = sql.builder.lt({age = 18})
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `map` | table | {column = value}ペア |

**戻り値:** `Sqlizer`

### `sql.builder.lte`

テーブルから以下条件を作成。

```lua
local cond = sql.builder.lte({price = 100})
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `map` | table | {column = value}ペア |

**戻り値:** `Sqlizer`

### `sql.builder.gt`

テーブルから大なり条件を作成。

```lua
local cond = sql.builder.gt({score = 80})
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `map` | table | {column = value}ペア |

**戻り値:** `Sqlizer`

### `sql.builder.gte`

テーブルから以上条件を作成。

```lua
local cond = sql.builder.gte({age = 21})
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `map` | table | {column = value}ペア |

**戻り値:** `Sqlizer`

### `sql.builder.like`

テーブルから `LIKE` 条件を作成します。

```lua
local cond = sql.builder.like({name = "john%"})
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `map` | table | {column = value}ペア |

**戻り値:** `Sqlizer`

### `sql.builder.not_like`

テーブルから `NOT LIKE` 条件を作成します。

```lua
local cond = sql.builder.not_like({email = "%@spam.com"})
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `map` | table | {column = value}ペア |

**戻り値:** `Sqlizer`

### `sql.builder.and_`

複数の条件を `AND` で結合します。

```lua
local cond = sql.builder.and_({
    sql.builder.eq({active = 1}),
    sql.builder.gt({score = 80})
})
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `conditions` | table | Sqlizerまたはテーブル条件の配列 |

**戻り値:** `Sqlizer`

### `sql.builder.or_`

複数の条件を `OR` で結合します。

```lua
local cond = sql.builder.or_({
    sql.builder.eq({status = "pending"}),
    sql.builder.eq({status = "active"})
})
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `conditions` | table | Sqlizerまたはテーブル条件の配列 |

**戻り値:** `Sqlizer`

### `sql.builder.question`

`?` プレースホルダーを使用します（デフォルト）。この形式は `sql.builder.default_placeholder` としても利用できます。

```lua
local query = sql.builder.select("*")
    :from("users")
    :placeholder_format(sql.builder.question)
```

### `sql.builder.dollar`

`$1, $2, ...` プレースホルダーを使用します。

```lua
local query = sql.builder.select("*")
    :from("users")
    :placeholder_format(sql.builder.dollar)
```

### `sql.builder.at`

`@p1, @p2, ...`プレースホルダー用のプレースホルダーフォーマット（SQL Server スタイル）。上記のフォーマットと同様に `placeholder_format` に渡します。

### `sql.builder.colon`

`:1, :2, ...`プレースホルダー用のプレースホルダーフォーマット。上記のフォーマットと同様に `placeholder_format` に渡します。

## 接続メソッド

`sql.get()`が返すデータベース接続ハンドル。

### `db:type`

データベースタイプ定数を返す。

```lua
local dbtype, err = db:type()
```

**戻り値:** `string, error`

### `db:query`

`SELECT` クエリを実行し、その行を返します。

```lua
local rows, err = db:query("SELECT id, name FROM users WHERE active = ?", {1})
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `sql` | string | ?プレースホルダー付きSQLクエリ |
| `params` | table | バインドパラメータの配列（オプション） |

**戻り値:** `table[], error`

### `db:execute`

`INSERT`、`UPDATE`、`DELETE` ステートメントを実行します。

```lua
local result, err = db:execute("INSERT INTO users (name) VALUES (?)", {"alice"})
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `sql` | string | ?プレースホルダー付きSQLステートメント |
| `params` | table | バインドパラメータの配列（オプション） |

**戻り値:** `table, error`

フィールド付きテーブルを返す:
- `last_insert_id` - 最後に挿入されたID
- `rows_affected` - 影響を受けた行数

### `db:prepare`

繰り返し実行用のプリペアドステートメントを作成。

```lua
local stmt, err = db:prepare("SELECT * FROM users WHERE id = ?")
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `sql` | string | ?プレースホルダー付きSQL |

**戻り値:** `Statement, error`

### `db:begin`

データベーストランザクションを開始。

```lua
local tx, err = db:begin({
    isolation = sql.isolation.SERIALIZABLE,
    read_only = false
})
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `options` | table | トランザクションオプション（オプション） |

オプションテーブルのフィールド:
- `isolation` - sql.isolation.*からの分離レベル（デフォルト: DEFAULT）
- `read_only` - 読み取り専用トランザクションフラグ（デフォルト: false）

**戻り値:** `Transaction, error`

### `db:release`

データベースリソースをプールに戻す。

```lua
local ok, err = db:release()
```

**戻り値:** `boolean, error`

この操作は冪等です。

### `db:stats`

接続プール統計を返す。

```lua
local stats, err = db:stats()
```

**戻り値:** `table, error`

フィールド付きテーブルを返す:
- `max_open_connections` - 最大許容オープン接続数
- `open_connections` - 現在のオープン接続数
- `in_use` - 現在使用中の接続数
- `idle` - プール内のアイドル接続数
- `wait_count` - 合計接続待機カウント
- `wait_duration` - 合計待機時間
- `max_idle_closed` - 最大アイドルにより閉じられた接続数
- `max_idle_time_closed` - アイドルタイムアウトにより閉じられた接続数
- `max_lifetime_closed` - 最大ライフタイムにより閉じられた接続数

## プリペアドステートメント

`db:prepare()`が返すプリペアドステートメント。

### `stmt:query`

プリペアドステートメントを `SELECT` クエリとして実行します。

```lua
local rows, err = stmt:query({123})
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `params` | table | バインドパラメータの配列（オプション） |

**戻り値:** `table[], error`

### `stmt:execute`

プリペアドステートメントを `INSERT`、`UPDATE`、`DELETE` ステートメントとして実行します。

```lua
local result, err = stmt:execute({"alice"})
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `params` | table | バインドパラメータの配列（オプション） |

**戻り値:** `table, error`

フィールド付きテーブルを返す:
- `last_insert_id` - 最後に挿入されたID
- `rows_affected` - 影響を受けた行数

### `stmt:close`

プリペアドステートメントを閉じる。

```lua
local ok, err = stmt:close()
```

**戻り値:** `boolean, error`

## トランザクション

`db:begin()` が返すトランザクションは、クエリ、ステートメント、セーブポイント、コミット、ロールバックの操作を提供します。

有効なトランザクションは、実行フレームのクリーンアップ時に自動的にロールバックされます。処理が完了したら、できるだけ早く明示的にコミットまたはロールバックしてください。

### `tx:db_type`

データベースタイプ定数を返す。

```lua
local dbtype, err = tx:db_type()
```

**戻り値:** `string, error`

### `tx:query`

トランザクション内で `SELECT` クエリを実行します。

```lua
local rows, err = tx:query("SELECT id, name FROM users WHERE active = ?", {1})
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `sql` | string | ?プレースホルダー付きSQLクエリ |
| `params` | table | バインドパラメータの配列（オプション） |

**戻り値:** `table[], error`

### `tx:execute`

トランザクション内で `INSERT`、`UPDATE`、`DELETE` ステートメントを実行します。

```lua
local result, err = tx:execute("INSERT INTO users (name) VALUES (?)", {"alice"})
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `sql` | string | ?プレースホルダー付きSQLステートメント |
| `params` | table | バインドパラメータの配列（オプション） |

**戻り値:** `table, error`

フィールド付きテーブルを返す:
- `last_insert_id` - 最後に挿入されたID
- `rows_affected` - 影響を受けた行数

### `tx:prepare`

トランザクション内でプリペアドステートメントを作成。

```lua
local stmt, err = tx:prepare("SELECT * FROM users WHERE id = ?")
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `sql` | string | ?プレースホルダー付きSQL |

**戻り値:** `Statement, error`

### `tx:commit`

トランザクションをコミット。

```lua
local ok, err = tx:commit()
```

**戻り値:** `boolean, error`

### `tx:rollback`

トランザクションをロールバック。

```lua
local ok, err = tx:rollback()
```

**戻り値:** `boolean, error`

### `tx:savepoint`

トランザクション内に名前付きセーブポイントを作成。

```lua
local ok, err = tx:savepoint("sp1")
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `name` | string | セーブポイント名（英数字とアンダースコアのみ） |

**戻り値:** `boolean, error`

### `tx:rollback_to`

名前付きセーブポイントにロールバック。

```lua
local ok, err = tx:rollback_to("sp1")
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `name` | string | セーブポイント名 |

**戻り値:** `boolean, error`

### `tx:release`

セーブポイントを解放。

```lua
local ok, err = tx:release("sp1")
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `name` | string | セーブポイント名 |

**戻り値:** `boolean, error`

## SELECTビルダー

`SELECT` クエリを句ごとに構築します。

### `select:from`

`FROM` 句を設定します。

```lua
local query = sql.builder.select("id", "name"):from("users")
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `table` | string | テーブル名 |

**戻り値:** `SelectBuilder`

### `select:join`

`JOIN` 句を追加します。

```lua
local query = sql.builder.select("*")
    :from("users")
    :join("orders ON orders.user_id = users.id")
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `join` | string | ?プレースホルダー付きJOIN句 |
| `args` | ...any | バインド引数（オプション） |

**戻り値:** `SelectBuilder`

### `select:left_join`

`LEFT JOIN` 句を追加します。

```lua
local query = sql.builder.select("*")
    :from("users")
    :left_join("orders ON orders.user_id = users.id")
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `join` | string | ?プレースホルダー付きJOIN句 |
| `args` | ...any | バインド引数（オプション） |

**戻り値:** `SelectBuilder`

### `select:right_join`

`RIGHT JOIN` 句を追加します。

```lua
local query = sql.builder.select("*")
    :from("users")
    :right_join("orders ON orders.user_id = users.id")
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `join` | string | ?プレースホルダー付きJOIN句 |
| `args` | ...any | バインド引数（オプション） |

**戻り値:** `SelectBuilder`

### `select:inner_join`

`INNER JOIN` 句を追加します。

```lua
local query = sql.builder.select("*")
    :from("users")
    :inner_join("orders ON orders.user_id = users.id")
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `join` | string | ?プレースホルダー付きJOIN句 |
| `args` | ...any | バインド引数（オプション） |

**戻り値:** `SelectBuilder`

### `select:where`

`WHERE` 条件を追加します。

```lua
local query = sql.builder.select("*")
    :from("users")
    :where({active = 1})
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `condition` | string\|table\|Sqlizer | WHERE条件 |
| `args` | ...any | バインド引数（オプション、文字列使用時） |

3つの形式をサポート:
- 文字列: `where("status = ?", "active")`
- テーブル: `where({status = "active"})`
- Sqlizer: `where(sql.builder.gt({score = 80}))`

**戻り値:** `SelectBuilder`

### `select:order_by`

`ORDER BY` 句を追加します。

```lua
local query = sql.builder.select("*")
    :from("users")
    :order_by("name ASC", "created_at DESC")
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `columns` | ...string | オプションのASC/DESC付きカラム名 |

**戻り値:** `SelectBuilder`

### `select:group_by`

`GROUP BY` 句を追加します。

```lua
local query = sql.builder.select("status", "COUNT(*)")
    :from("users")
    :group_by("status")
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `columns` | ...string | カラム名 |

**戻り値:** `SelectBuilder`

### `select:having`

`HAVING` 条件を追加します。

```lua
local query = sql.builder.select("status", "COUNT(*) as cnt")
    :from("users")
    :group_by("status")
    :having(sql.builder.gt({cnt = 10}))
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `condition` | string\|table\|Sqlizer | HAVING条件 |
| `args` | ...any | バインド引数（オプション、文字列使用時） |

**戻り値:** `SelectBuilder`

### `select:limit`

`LIMIT` の値を設定します。

```lua
local query = sql.builder.select("*")
    :from("users")
    :limit(10)
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `n` | integer | リミット値 |

**戻り値:** `SelectBuilder`

### `select:offset`

`OFFSET` の値を設定します。

```lua
local query = sql.builder.select("*")
    :from("users")
    :offset(20)
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `n` | integer | オフセット値 |

**戻り値:** `SelectBuilder`

### `select:columns`

`SELECT` リストにカラムを追加します。

```lua
local query = sql.builder.select():columns("id", "name", "email")
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `columns` | ...string | カラム名 |

**戻り値:** `SelectBuilder`

### `select:distinct`

`DISTINCT` 修飾子を追加します。

```lua
local query = sql.builder.select("status")
    :from("users")
    :distinct()
```

**戻り値:** `SelectBuilder`

### `select:suffix`

SQLサフィックスを追加。

```lua
local query = sql.builder.select("*")
    :from("users")
    :suffix("FOR UPDATE")
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `sql` | string | ?プレースホルダー付きSQLサフィックス |
| `args` | ...any | バインド引数（オプション） |

**戻り値:** `SelectBuilder`

### `select:placeholder_format`

プレースホルダーフォーマットを設定。

```lua
local query = sql.builder.select("*")
    :from("users")
    :placeholder_format(sql.builder.dollar)
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `format` | userdata | プレースホルダーフォーマット（sql.builder.*） |

**戻り値:** `SelectBuilder`

### `select:to_sql`

SQL文字列とバインド引数を生成。

```lua
local sql_str, args = query:to_sql()
```

**戻り値:** 成功時は `string, table`、ビルダーの状態が無効な場合は `nil, error`

### `select:run_with`

クエリ用のエグゼキュータを作成。

```lua
local executor, err = query:run_with(db)
if err then
    return nil, err
end
local rows, err = executor:query()
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `db` | DB\|Transaction | データベースまたはトランザクションハンドル |

**戻り値:** `QueryExecutor, error`

## INSERTビルダー

`INSERT` クエリを句ごとに構築します。

### `insert:into`

テーブル名を設定。

```lua
local query = sql.builder.insert():into("users")
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `table` | string | テーブル名 |

**戻り値:** `InsertBuilder`

### `insert:columns`

カラム名を設定。

```lua
local query = sql.builder.insert("users"):columns("name", "email")
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `columns` | ...string | カラム名 |

**戻り値:** `InsertBuilder`

### `insert:values`

行の値を追加。

```lua
local query = sql.builder.insert("users")
    :columns("name", "email")
    :values("alice", "alice@example.com")
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `values` | ...any | 行の値 |

**戻り値:** `InsertBuilder`

### `insert:set_map`

テーブルからカラムと値を設定。

```lua
local query = sql.builder.insert("users")
    :set_map({name = "alice", email = "alice@example.com"})
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `map` | table | {column = value}ペア |

**戻り値:** `InsertBuilder`

### `insert:select`

`SELECT` クエリの行を挿入します。

```lua
local select_query = sql.builder.select("name", "email"):from("temp_users")
local query = sql.builder.insert("users")
    :columns("name", "email")
    :select(select_query)
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `query` | SelectBuilder | SELECTクエリ |

**戻り値:** `InsertBuilder`

### `insert:prefix`

SQLプレフィックスを追加。

```lua
local query = sql.builder.insert("users")
    :prefix("/* audit import */")
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `sql` | string | ?プレースホルダー付きSQLプレフィックス |
| `args` | ...any | バインド引数（オプション） |

**戻り値:** `InsertBuilder`

### `insert:suffix`

SQLサフィックスを追加。

```lua
local query = sql.builder.insert("users")
    :columns("name")
    :values("alice")
    :suffix("RETURNING id")
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `sql` | string | ?プレースホルダー付きSQLサフィックス |
| `args` | ...any | バインド引数（オプション） |

**戻り値:** `InsertBuilder`

### `insert:options`

`INSERT` オプションを追加します。

```lua
local query = sql.builder.insert("users")
    :options("DELAYED", "IGNORE")
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `options` | ...string | INSERTオプション |

**戻り値:** `InsertBuilder`

### `insert:placeholder_format`

プレースホルダーフォーマットを設定。

```lua
local query = sql.builder.insert("users")
    :placeholder_format(sql.builder.dollar)
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `format` | userdata | プレースホルダーフォーマット（sql.builder.*） |

**戻り値:** `InsertBuilder`

### `insert:to_sql`

SQL文字列とバインド引数を生成。

```lua
local sql_str, args = query:to_sql()
```

**戻り値:** 成功時は `string, table`、ビルダーの状態が無効な場合は `nil, error`

### `insert:run_with`

クエリ用のエグゼキュータを作成。

```lua
local executor, err = query:run_with(db)
if err then
    return nil, err
end
local result, err = executor:exec()
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `db` | DB\|Transaction | データベースまたはトランザクションハンドル |

**戻り値:** `QueryExecutor, error`

## UPDATEビルダー

`UPDATE` クエリを句ごとに構築します。

### `update:table`

テーブル名を設定。

```lua
local query = sql.builder.update():table("users")
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `table` | string | テーブル名 |

**戻り値:** `UpdateBuilder`

### `update:set`

カラム値を設定。

```lua
local query = sql.builder.update("users")
    :set("status", "active")
    :set("updated_at", sql.builder.expr("NOW()"))
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `column` | string | カラム名 |
| `value` | any | カラム値 |

**戻り値:** `UpdateBuilder`

### `update:set_map`

テーブルから複数のカラムを設定。

```lua
local query = sql.builder.update("users")
    :set_map({status = "active", updated_at = sql.builder.expr("NOW()")})
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `map` | table | {column = value}ペア |

**戻り値:** `UpdateBuilder`

### `update:where`

`WHERE` 条件を追加します。

```lua
local query = sql.builder.update("users")
    :set("status", "active")
    :where({id = 123})
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `condition` | string\|table\|Sqlizer | WHERE条件 |
| `args` | ...any | バインド引数（オプション、文字列使用時） |

**戻り値:** `UpdateBuilder`

### `update:order_by`

`ORDER BY` 句を追加します。

```lua
local query = sql.builder.update("users")
    :set("rank", 1)
    :order_by("score DESC")
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `columns` | ...string | オプションのASC/DESC付きカラム名 |

**戻り値:** `UpdateBuilder`

### `update:limit`

`LIMIT` の値を設定します。

```lua
local query = sql.builder.update("users")
    :set("status", "active")
    :limit(10)
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `n` | integer | リミット値 |

**戻り値:** `UpdateBuilder`

### `update:offset`

`OFFSET` の値を設定します。

```lua
local query = sql.builder.update("users")
    :set("status", "active")
    :offset(5)
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `n` | integer | オフセット値 |

**戻り値:** `UpdateBuilder`

### `update:suffix`

SQLサフィックスを追加。

```lua
local query = sql.builder.update("users")
    :set("status", "active")
    :suffix("RETURNING id")
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `sql` | string | ?プレースホルダー付きSQLサフィックス |
| `args` | ...any | バインド引数（オプション） |

**戻り値:** `UpdateBuilder`

### `update:from`

`FROM` 句を追加します。

```lua
local query = sql.builder.update("users")
    :set("status", "active")
    :from("other_table")
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `table` | string | テーブル名 |

**戻り値:** `UpdateBuilder`

### `update:from_select`

`SELECT` クエリの行から更新します。

```lua
local select_query = sql.builder.select("*"):from("temp_users")
local query = sql.builder.update("users")
    :set("status", "active")
    :from_select(select_query, "t")
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `query` | SelectBuilder | SELECTクエリ |
| `alias` | string | テーブルエイリアス |

**戻り値:** `UpdateBuilder`

### `update:placeholder_format`

プレースホルダーフォーマットを設定。

```lua
local query = sql.builder.update("users")
    :placeholder_format(sql.builder.dollar)
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `format` | userdata | プレースホルダーフォーマット（sql.builder.*） |

**戻り値:** `UpdateBuilder`

### `update:to_sql`

SQL文字列とバインド引数を生成。

```lua
local sql_str, args = query:to_sql()
```

**戻り値:** 成功時は `string, table`、ビルダーの状態が無効な場合は `nil, error`

### `update:run_with`

クエリ用のエグゼキュータを作成。

```lua
local executor, err = query:run_with(db)
if err then
    return nil, err
end
local result, err = executor:exec()
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `db` | DB\|Transaction | データベースまたはトランザクションハンドル |

**戻り値:** `QueryExecutor, error`

## DELETEビルダー

`DELETE` クエリを句ごとに構築します。

### `delete:from`

テーブル名を設定。

```lua
local query = sql.builder.delete():from("users")
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `table` | string | テーブル名 |

**戻り値:** `DeleteBuilder`

### `delete:where`

`WHERE` 条件を追加します。

```lua
local query = sql.builder.delete("users")
    :where({active = 0})
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `condition` | string\|table\|Sqlizer | WHERE条件 |
| `args` | ...any | バインド引数（オプション、文字列使用時） |

**戻り値:** `DeleteBuilder`

### `delete:order_by`

`ORDER BY` 句を追加します。

```lua
local query = sql.builder.delete("users")
    :where({active = 0})
    :order_by("created_at ASC")
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `columns` | ...string | オプションのASC/DESC付きカラム名 |

**戻り値:** `DeleteBuilder`

### `delete:limit`

`LIMIT` の値を設定します。

```lua
local query = sql.builder.delete("users")
    :where({active = 0})
    :limit(100)
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `n` | integer | リミット値 |

**戻り値:** `DeleteBuilder`

### `delete:offset`

`OFFSET` の値を設定します。

```lua
local query = sql.builder.delete("users")
    :where({active = 0})
    :offset(10)
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `n` | integer | オフセット値 |

**戻り値:** `DeleteBuilder`

### `delete:suffix`

SQLサフィックスを追加。

```lua
local query = sql.builder.delete("users")
    :where({active = 0})
    :suffix("RETURNING id")
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `sql` | string | ?プレースホルダー付きSQLサフィックス |
| `args` | ...any | バインド引数（オプション） |

**戻り値:** `DeleteBuilder`

### `delete:placeholder_format`

プレースホルダーフォーマットを設定。

```lua
local query = sql.builder.delete("users")
    :placeholder_format(sql.builder.dollar)
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `format` | userdata | プレースホルダーフォーマット（sql.builder.*） |

**戻り値:** `DeleteBuilder`

### `delete:to_sql`

SQL文字列とバインド引数を生成。

```lua
local sql_str, args = query:to_sql()
```

**戻り値:** 成功時は `string, table`、ビルダーの状態が無効な場合は `nil, error`

### `delete:run_with`

クエリ用のエグゼキュータを作成。

```lua
local executor, err = query:run_with(db)
if err then
    return nil, err
end
local result, err = executor:exec()
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `db` | DB\|Transaction | データベースまたはトランザクションハンドル |

**戻り値:** `QueryExecutor, error`

## クエリの実行

クエリエグゼキュータはビルダーが生成したクエリを実行。

### `executor:query`

クエリを実行し、`SELECT` ステートメントの行を返します。

```lua
local rows, err = executor:query()
```

**戻り値:** `table[], error`

### `executor:exec`

クエリを実行し、`INSERT`、`UPDATE`、`DELETE` ステートメントの結果を返します。

```lua
local result, err = executor:exec()
```

**戻り値:** `table, error`

フィールド付きテーブルを返す:
- `last_insert_id` - 最後に挿入されたID
- `rows_affected` - 影響を受けた行数

### `executor:to_sql`

実行せずに生成されたSQLと引数を返す。

```lua
local sql_str, args = executor:to_sql()
```

**戻り値:** `string, table`

## 権限

データベースアクセスはセキュリティポリシー評価の対象。

| アクション | リソース | 説明 |
|--------|----------|-------------|
| `db.get` | Database ID | データベース接続を取得 |

## エラー

| 条件 | 種別 | 再試行可能 |
|-----------|------|-----------|
| リソースIDが空 | `errors.INVALID` | いいえ |
| 権限拒否 | `errors.PERMISSION_DENIED` | いいえ |
| リソースが見つからない | `errors.NOT_FOUND` | いいえ |
| リソースがデータベースではない | `errors.INVALID` | いいえ |
| 無効なパラメータ | `errors.INVALID` | いいえ |
| ステートメントがクローズ済み | `errors.INVALID` | いいえ |
| トランザクションがアクティブでない | `errors.INVALID` | いいえ |
| 無効なセーブポイント名 | `errors.INVALID` | いいえ |
| ドライバーまたはクエリ実行エラー | 利用可能な場合はドライバーから引き継ぐ。それ以外は unspecified | 状況による |

エラーの処理については、[エラー処理](../core/errors.md)を参照してください。

## 統合部分レシピ

このレシピでは、`app.db:main` が構成済みの SQLite または MySQL データベースで、参照する列を持つ `users`、`orders`、`logs` テーブルがすでに存在することを前提としています。`?` プレースホルダーを使用しています。PostgreSQL リソースでは `$1`、`$2` などを使用してください。返される行はアプリケーションのデータによって異なります。周囲のアプリケーションは `report_cleanup_error(err)` を提供し、起点となった操作エラーを置き換えずに、ロールバックまたはクローズの失敗を観測できるようにします。

```lua
local sql = require("sql")

local db, err = sql.get("app.db:main")
if err then return nil, err end

local function finish(value, primary_err)
    local _, release_err = db:release()
    if primary_err then return nil, primary_err end
    if release_err then return nil, release_err end
    return value
end

-- Direct query
local users, err = db:query("SELECT id, name FROM users WHERE active = ?", {1})
if err then
    return finish(nil, err)
end

for _, user in ipairs(users) do
    print(user.id, user.name)
end

-- Builder pattern
local query = sql.builder.select("u.id", "u.name", "COUNT(o.id) as order_count")
    :from("users u")
    :left_join("orders o ON o.user_id = u.id")
    :where(sql.builder.and_({
        sql.builder.eq({["u.active"] = 1}),
        sql.builder.gte({["u.score"] = 80})
    }))
    :group_by("u.id", "u.name")
    :having(sql.builder.gt({["COUNT(o.id)"] = 0}))
    :order_by("order_count DESC")
    :limit(10)

local executor, build_err = query:run_with(db)
if build_err then
    return finish(nil, build_err)
end
local results, err = executor:query()
if err then
    return finish(nil, err)
end

-- Transaction
local tx, err = db:begin({isolation = sql.isolation.SERIALIZABLE})
if err then
    return finish(nil, err)
end

local _, err = tx:execute("INSERT INTO users (name) VALUES (?)", {"alice"})
if err then
    local _, rollback_err = tx:rollback()
    if rollback_err then report_cleanup_error(rollback_err) end
    return finish(nil, err)
end

local _, commit_err = tx:commit()
if commit_err then
    return finish(nil, commit_err)
end

-- Prepared statements
local stmt, err = db:prepare("INSERT INTO logs (message, level) VALUES (?, ?)")
if err then
    return finish(nil, err)
end

for i = 1, 3 do
    local _, err = stmt:execute({"log message " .. i, "info"})
    if err then
        local _, close_err = stmt:close()
        if close_err then report_cleanup_error(close_err) end
        return finish(nil, err)
    end
end

local _, close_err = stmt:close()
if close_err then
    return finish(nil, close_err)
end

return finish({users = users, ranked_users = results})
```
