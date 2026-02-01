# SQLデータベース
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>
<secondary-label ref="permissions"/>

PostgreSQL、MySQL、SQLite、MSSQL、Oracleデータベースに対してSQLクエリを実行。パラメータ化クエリ、トランザクション、プリペアドステートメント、流暢なクエリビルダーをサポート。

データベース設定については[データベース](system-database.md)を参照。

## ロード

```lua
local sql = require("sql")
```

## 接続の取得

リソースレジストリからデータベース接続を取得:

```lua
local db, err = sql.get("app.db:main")
if err then
    return nil, err
end

local rows = db:query("SELECT * FROM users WHERE active = ?", {1})

db:release()
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `id` | string | リソースID（例: "app.db:main"） |

**戻り値:** `DB, error`

<note>
接続は関数が終了すると自動的にプールに返される。長時間実行される操作では明示的に`db:release()`を呼び出すことを推奨。
</note>

## 定数

### データベースタイプ

```lua
sql.type.POSTGRES    -- "postgres"
sql.type.MYSQL       -- "mysql"
sql.type.SQLITE      -- "sqlite"
sql.type.MSSQL       -- "mssql"
sql.type.ORACLE      -- "oracle"
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

### NULL値

```lua
local insert = sql.builder.insert("users")
    :columns("name", "email")
    :values("alice", sql.NULL)
```

## 型変換

### as.int

```lua
local value = sql.as.int(42)
```

**戻り値:** `userdata`

## as.float

値をSQL float型に変換。

```lua
local value = sql.as.float(19.99)
```

**戻り値:** `userdata`

## as.text

値をSQL text型に変換。

```lua
local value = sql.as.text("hello")
```

**戻り値:** `userdata`

## as.binary

値をSQL binary型に変換。

```lua
local value = sql.as.binary("binary data")
```

**戻り値:** `userdata`

## as.null

SQL NULLマーカーを返す。

```lua
local value = sql.as.null()
```

**戻り値:** `userdata`

## クエリビルダー

### クエリの作成

```lua
local query = sql.builder.select("id", "name")
    :from("users")
    :where({active = 1})
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `columns` | ...string | カラム名（オプション） |

**戻り値:** `SelectBuilder`

## builder.insert

INSERTクエリビルダーを作成。

```lua
local query = sql.builder.insert("users")
    :columns("name", "email")
    :values("alice", "alice@example.com")
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `table` | string | テーブル名（オプション） |

**戻り値:** `InsertBuilder`

## builder.update

UPDATEクエリビルダーを作成。

```lua
local query = sql.builder.update("users")
    :set("status", "active")
    :where({id = 123})
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `table` | string | テーブル名（オプション） |

**戻り値:** `UpdateBuilder`

## builder.delete

DELETEクエリビルダーを作成。

```lua
local query = sql.builder.delete("users")
    :where({active = 0})
    :limit(100)
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `table` | string | テーブル名（オプション） |

**戻り値:** `DeleteBuilder`

## builder.expr

where/having句で使用する生のSQL式を作成。

```lua
local expr = sql.builder.expr("score BETWEEN ? AND ?", 80, 90)
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `sql` | string | ?プレースホルダー付きSQL式 |
| `args` | ...any | バインド引数（オプション） |

**戻り値:** `Sqlizer`

## builder.eq

テーブルから等価条件を作成。

```lua
local cond = sql.builder.eq({active = 1, status = "open"})
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `map` | table | {column = value}ペア |

**戻り値:** `Sqlizer`

## builder.not_eq

テーブルから不等価条件を作成。

```lua
local cond = sql.builder.not_eq({status = "closed"})
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `map` | table | {column = value}ペア |

**戻り値:** `Sqlizer`

## builder.lt

テーブルから小なり条件を作成。

```lua
local cond = sql.builder.lt({age = 18})
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `map` | table | {column = value}ペア |

**戻り値:** `Sqlizer`

## builder.lte

テーブルから以下条件を作成。

```lua
local cond = sql.builder.lte({price = 100})
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `map` | table | {column = value}ペア |

**戻り値:** `Sqlizer`

## builder.gt

テーブルから大なり条件を作成。

```lua
local cond = sql.builder.gt({score = 80})
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `map` | table | {column = value}ペア |

**戻り値:** `Sqlizer`

## builder.gte

テーブルから以上条件を作成。

```lua
local cond = sql.builder.gte({age = 21})
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `map` | table | {column = value}ペア |

**戻り値:** `Sqlizer`

## builder.like

テーブルからLIKE条件を作成。

```lua
local cond = sql.builder.like({name = "john%"})
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `map` | table | {column = value}ペア |

**戻り値:** `Sqlizer`

## builder.not_like

テーブルからNOT LIKE条件を作成。

```lua
local cond = sql.builder.not_like({email = "%@spam.com"})
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `map` | table | {column = value}ペア |

**戻り値:** `Sqlizer`

## builder.and_

複数の条件をANDで結合。

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

## builder.or_

複数の条件をORで結合。

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

## builder.question

?プレースホルダー用のプレースホルダーフォーマット（デフォルト）。

```lua
local query = sql.builder.select("*")
    :from("users")
    :placeholder_format(sql.builder.question)
```

## builder.dollar

$1, $2, ...プレースホルダー用のプレースホルダーフォーマット。

```lua
local query = sql.builder.select("*")
    :from("users")
    :placeholder_format(sql.builder.dollar)
```

## builder.at

@p1, @p2, ...プレースホルダー用のプレースホルダーフォーマット。

```lua
local query = sql.builder.select("*")
    :from("users")
    :placeholder_format(sql.builder.at)
```

## builder.colon

:1, :2, ...プレースホルダー用のプレースホルダーフォーマット。

```lua
local query = sql.builder.select("*")
    :from("users")
    :placeholder_format(sql.builder.colon)
```

## 接続メソッド

`sql.get()`が返すデータベース接続ハンドル。

### db:type

データベースタイプ定数を返す。

```lua
local dbtype, err = db:type()
```

**戻り値:** `string, error`

### db:query

SELECTクエリを実行し行を返す。

```lua
local rows, err = db:query("SELECT id, name FROM users WHERE active = ?", {1})
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `sql` | string | ?プレースホルダー付きSQLクエリ |
| `params` | table | バインドパラメータの配列（オプション） |

**戻り値:** `table[], error`

### db:execute

INSERT/UPDATE/DELETEクエリを実行。

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

### db:prepare

繰り返し実行用のプリペアドステートメントを作成。

```lua
local stmt, err = db:prepare("SELECT * FROM users WHERE id = ?")
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `sql` | string | ?プレースホルダー付きSQL |

**戻り値:** `Statement, error`

### db:begin

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

### db:release

データベースリソースをプールに戻す。

```lua
local ok, err = db:release()
```

**戻り値:** `boolean, error`

### db:stats

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

### stmt:query

プリペアドステートメントをSELECTとして実行。

```lua
local rows, err = stmt:query({123})
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `params` | table | バインドパラメータの配列（オプション） |

**戻り値:** `table[], error`

### stmt:execute

プリペアドステートメントをINSERT/UPDATE/DELETEとして実行。

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

### stmt:close

プリペアドステートメントを閉じる。

```lua
local ok, err = stmt:close()
```

**戻り値:** `boolean, error`

## トランザクション

`db:begin()`が返すデータベーストランザクション。

### tx:db_type

データベースタイプ定数を返す。

```lua
local dbtype, err = tx:db_type()
```

**戻り値:** `string, error`

### tx:query

トランザクション内でSELECTクエリを実行。

```lua
local rows, err = tx:query("SELECT id, name FROM users WHERE active = ?", {1})
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `sql` | string | ?プレースホルダー付きSQLクエリ |
| `params` | table | バインドパラメータの配列（オプション） |

**戻り値:** `table[], error`

### tx:execute

トランザクション内でINSERT/UPDATE/DELETEを実行。

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

### tx:prepare

トランザクション内でプリペアドステートメントを作成。

```lua
local stmt, err = tx:prepare("SELECT * FROM users WHERE id = ?")
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `sql` | string | ?プレースホルダー付きSQL |

**戻り値:** `Statement, error`

### tx:commit

トランザクションをコミット。

```lua
local ok, err = tx:commit()
```

**戻り値:** `boolean, error`

### tx:rollback

トランザクションをロールバック。

```lua
local ok, err = tx:rollback()
```

**戻り値:** `boolean, error`

### tx:savepoint

トランザクション内に名前付きセーブポイントを作成。

```lua
local ok, err = tx:savepoint("sp1")
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `name` | string | セーブポイント名（英数字とアンダースコアのみ） |

**戻り値:** `boolean, error`

### tx:rollback_to

名前付きセーブポイントにロールバック。

```lua
local ok, err = tx:rollback_to("sp1")
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `name` | string | セーブポイント名 |

**戻り値:** `boolean, error`

### tx:release

セーブポイントを解放。

```lua
local ok, err = tx:release("sp1")
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `name` | string | セーブポイント名 |

**戻り値:** `boolean, error`

## SELECTビルダー

SELECTクエリを構築するための流暢なインターフェース。

### select:from

FROM句を設定。

```lua
local query = sql.builder.select("id", "name"):from("users")
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `table` | string | テーブル名 |

**戻り値:** `SelectBuilder`

### select:join

JOIN句を追加。

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

### select:left_join

LEFT JOIN句を追加。

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

### select:right_join

RIGHT JOIN句を追加。

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

### select:inner_join

INNER JOIN句を追加。

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

### select:where

WHERE条件を追加。

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

### select:order_by

ORDER BY句を追加。

```lua
local query = sql.builder.select("*")
    :from("users")
    :order_by("name ASC", "created_at DESC")
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `columns` | ...string | オプションのASC/DESC付きカラム名 |

**戻り値:** `SelectBuilder`

### select:group_by

GROUP BY句を追加。

```lua
local query = sql.builder.select("status", "COUNT(*)")
    :from("users")
    :group_by("status")
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `columns` | ...string | カラム名 |

**戻り値:** `SelectBuilder`

### select:having

HAVING条件を追加。

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

### select:limit

LIMITを設定。

```lua
local query = sql.builder.select("*")
    :from("users")
    :limit(10)
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `n` | integer | リミット値 |

**戻り値:** `SelectBuilder`

### select:offset

OFFSETを設定。

```lua
local query = sql.builder.select("*")
    :from("users")
    :offset(20)
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `n` | integer | オフセット値 |

**戻り値:** `SelectBuilder`

### select:columns

SELECTにカラムを追加。

```lua
local query = sql.builder.select():columns("id", "name", "email")
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `columns` | ...string | カラム名 |

**戻り値:** `SelectBuilder`

### select:distinct

DISTINCT修飾子を追加。

```lua
local query = sql.builder.select("status")
    :from("users")
    :distinct()
```

**戻り値:** `SelectBuilder`

### select:suffix

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

### select:placeholder_format

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

### select:to_sql

SQL文字列とバインド引数を生成。

```lua
local sql_str, args = query:to_sql()
```

**戻り値:** `string, table`

### select:run_with

クエリ用のエグゼキュータを作成。

```lua
local executor = query:run_with(db)
local rows, err = executor:query()
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `db` | DB\|Transaction | データベースまたはトランザクションハンドル |

**戻り値:** `QueryExecutor`

## INSERTビルダー

INSERTクエリを構築するための流暢なインターフェース。

### insert:into

テーブル名を設定。

```lua
local query = sql.builder.insert():into("users")
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `table` | string | テーブル名 |

**戻り値:** `InsertBuilder`

### insert:columns

カラム名を設定。

```lua
local query = sql.builder.insert("users"):columns("name", "email")
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `columns` | ...string | カラム名 |

**戻り値:** `InsertBuilder`

### insert:values

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

### insert:set_map

テーブルからカラムと値を設定。

```lua
local query = sql.builder.insert("users")
    :set_map({name = "alice", email = "alice@example.com"})
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `map` | table | {column = value}ペア |

**戻り値:** `InsertBuilder`

### insert:select

SELECTクエリから挿入。

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

### insert:prefix

SQLプレフィックスを追加。

```lua
local query = sql.builder.insert("users")
    :prefix("INSERT IGNORE INTO")
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `sql` | string | ?プレースホルダー付きSQLプレフィックス |
| `args` | ...any | バインド引数（オプション） |

**戻り値:** `InsertBuilder`

### insert:suffix

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

### insert:options

INSERTオプションを追加。

```lua
local query = sql.builder.insert("users")
    :options("DELAYED", "IGNORE")
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `options` | ...string | INSERTオプション |

**戻り値:** `InsertBuilder`

### insert:placeholder_format

プレースホルダーフォーマットを設定。

```lua
local query = sql.builder.insert("users")
    :placeholder_format(sql.builder.dollar)
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `format` | userdata | プレースホルダーフォーマット（sql.builder.*） |

**戻り値:** `InsertBuilder`

### insert:to_sql

SQL文字列とバインド引数を生成。

```lua
local sql_str, args = query:to_sql()
```

**戻り値:** `string, table`

### insert:run_with

クエリ用のエグゼキュータを作成。

```lua
local executor = query:run_with(db)
local result, err = executor:exec()
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `db` | DB\|Transaction | データベースまたはトランザクションハンドル |

**戻り値:** `QueryExecutor`

## UPDATEビルダー

UPDATEクエリを構築するための流暢なインターフェース。

### update:table

テーブル名を設定。

```lua
local query = sql.builder.update():table("users")
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `table` | string | テーブル名 |

**戻り値:** `UpdateBuilder`

### update:set

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

### update:set_map

テーブルから複数のカラムを設定。

```lua
local query = sql.builder.update("users")
    :set_map({status = "active", updated_at = sql.builder.expr("NOW()")})
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `map` | table | {column = value}ペア |

**戻り値:** `UpdateBuilder`

### update:where

WHERE条件を追加。

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

### update:order_by

ORDER BY句を追加。

```lua
local query = sql.builder.update("users")
    :set("rank", 1)
    :order_by("score DESC")
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `columns` | ...string | オプションのASC/DESC付きカラム名 |

**戻り値:** `UpdateBuilder`

### update:limit

LIMITを設定。

```lua
local query = sql.builder.update("users")
    :set("status", "active")
    :limit(10)
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `n` | integer | リミット値 |

**戻り値:** `UpdateBuilder`

### update:offset

OFFSETを設定。

```lua
local query = sql.builder.update("users")
    :set("status", "active")
    :offset(5)
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `n` | integer | オフセット値 |

**戻り値:** `UpdateBuilder`

### update:suffix

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

### update:from

FROM句を追加。

```lua
local query = sql.builder.update("users")
    :set("status", "active")
    :from("other_table")
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `table` | string | テーブル名 |

**戻り値:** `UpdateBuilder`

### update:from_select

SELECTクエリから更新。

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

### update:placeholder_format

プレースホルダーフォーマットを設定。

```lua
local query = sql.builder.update("users")
    :placeholder_format(sql.builder.dollar)
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `format` | userdata | プレースホルダーフォーマット（sql.builder.*） |

**戻り値:** `UpdateBuilder`

### update:to_sql

SQL文字列とバインド引数を生成。

```lua
local sql_str, args = query:to_sql()
```

**戻り値:** `string, table`

### update:run_with

クエリ用のエグゼキュータを作成。

```lua
local executor = query:run_with(db)
local result, err = executor:exec()
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `db` | DB\|Transaction | データベースまたはトランザクションハンドル |

**戻り値:** `QueryExecutor`

## DELETEビルダー

DELETEクエリを構築するための流暢なインターフェース。

### delete:from

テーブル名を設定。

```lua
local query = sql.builder.delete():from("users")
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `table` | string | テーブル名 |

**戻り値:** `DeleteBuilder`

### delete:where

WHERE条件を追加。

```lua
local query = sql.builder.delete("users")
    :where({active = 0})
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `condition` | string\|table\|Sqlizer | WHERE条件 |
| `args` | ...any | バインド引数（オプション、文字列使用時） |

**戻り値:** `DeleteBuilder`

### delete:order_by

ORDER BY句を追加。

```lua
local query = sql.builder.delete("users")
    :where({active = 0})
    :order_by("created_at ASC")
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `columns` | ...string | オプションのASC/DESC付きカラム名 |

**戻り値:** `DeleteBuilder`

### delete:limit

LIMITを設定。

```lua
local query = sql.builder.delete("users")
    :where({active = 0})
    :limit(100)
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `n` | integer | リミット値 |

**戻り値:** `DeleteBuilder`

### delete:offset

OFFSETを設定。

```lua
local query = sql.builder.delete("users")
    :where({active = 0})
    :offset(10)
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `n` | integer | オフセット値 |

**戻り値:** `DeleteBuilder`

### delete:suffix

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

### delete:placeholder_format

プレースホルダーフォーマットを設定。

```lua
local query = sql.builder.delete("users")
    :placeholder_format(sql.builder.dollar)
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `format` | userdata | プレースホルダーフォーマット（sql.builder.*） |

**戻り値:** `DeleteBuilder`

### delete:to_sql

SQL文字列とバインド引数を生成。

```lua
local sql_str, args = query:to_sql()
```

**戻り値:** `string, table`

### delete:run_with

クエリ用のエグゼキュータを作成。

```lua
local executor = query:run_with(db)
local result, err = executor:exec()
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `db` | DB\|Transaction | データベースまたはトランザクションハンドル |

**戻り値:** `QueryExecutor`

## クエリの実行

クエリエグゼキュータはビルダーが生成したクエリを実行。

### executor:query

クエリを実行し行を返す（SELECT用）。

```lua
local rows, err = executor:query()
```

**戻り値:** `table[], error`

### executor:exec

クエリを実行し結果を返す（INSERT/UPDATE/DELETE用）。

```lua
local result, err = executor:exec()
```

**戻り値:** `table, error`

フィールド付きテーブルを返す:
- `last_insert_id` - 最後に挿入されたID
- `rows_affected` - 影響を受けた行数

### executor:to_sql

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
| リソースIDが空 | `errors.INVALID` | no |
| 権限拒否 | `errors.PERMISSION_DENIED` | no |
| リソースが見つからない | `errors.NOT_FOUND` | no |
| リソースがデータベースではない | `errors.INVALID` | no |
| 無効なパラメータ | `errors.INVALID` | no |
| SQL構文エラー | `errors.INVALID` | no |
| ステートメントがクローズ済み | `errors.INVALID` | no |
| トランザクションがアクティブでない | `errors.INVALID` | no |
| 無効なセーブポイント名 | `errors.INVALID` | no |
| クエリ実行エラー | 様々 | 様々 |

エラーの処理については[エラー処理](lua-errors.md)を参照。

## 例

```lua
local sql = require("sql")

-- データベース接続を取得
local db, err = sql.get("app.db:main")
if err then error(err) end

-- データベースタイプを確認
local dbtype, _ = db:type()
print("Database type:", dbtype)

-- 直接クエリ
local users, err = db:query("SELECT id, name FROM users WHERE active = ?", {1})
if err then error(err) end

for _, user in ipairs(users) do
    print(user.id, user.name)
end

-- ビルダーパターン
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

local executor = query:run_with(db)
local results, err = executor:query()
if err then error(err) end

-- セーブポイント付きトランザクション
local tx, err = db:begin({isolation = sql.isolation.SERIALIZABLE})
if err then error(err) end

local _, err = tx:execute("INSERT INTO users (name) VALUES (?)", {"alice"})
if err then
    tx:rollback()
    error(err)
end

tx:savepoint("sp1")

local _, err = tx:execute("UPDATE users SET status = ? WHERE id = ?", {"active", 1})
if err then
    tx:rollback_to("sp1")
else
    tx:release("sp1")
end

local ok, err = tx:commit()
if err then error(err) end

-- プリペアドステートメント
local stmt, err = db:prepare("INSERT INTO logs (message, level) VALUES (?, ?)")
if err then error(err) end

for i = 1, 100 do
    local _, err = stmt:execute({"log message " .. i, "info"})
    if err then
        stmt:close()
        error(err)
    end
end

stmt:close()

-- NULLと型付き値
local insert = sql.builder.insert("products")
    :columns("name", "price", "description")
    :values("Widget", sql.as.float(19.99), sql.NULL)

local executor = insert:run_with(db)
local result, err = executor:exec()
if err then error(err) end

print("Inserted ID:", result.last_insert_id)

db:release()
```

