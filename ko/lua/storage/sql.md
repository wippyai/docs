---
title: "SQL 데이터베이스"
description: "설정된 데이터베이스에서 파라미터화된 SQL 쿼리, 트랜잭션, prepared statement를 실행합니다."
---

# SQL 데이터베이스
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>
<secondary-label ref="permissions"/>

`sql` 모듈은 설정된 PostgreSQL, MySQL, SQLite 데이터베이스에서 쿼리를 실행합니다. 파라미터화된 쿼리, 트랜잭션, prepared statement, 쿼리 빌더를 지원합니다.

이 페이지는 API 레퍼런스입니다. 코드 조각은 데이터베이스가 설정되어 있고, 이를 획득할 권한이 있으며, 쿼리에 명시된 테이블이 존재한다고 가정합니다. 독립 실행형 애플리케이션이 아니라 개별 호출을 보여 줍니다. 끝에 있는 결합된 레시피에는 추가 스키마 및 드라이버 가정이 명시되어 있습니다.

데이터베이스 설정은 [데이터베이스](../../system/database.md)를 참조하세요.

## 로딩

```lua
local sql = require("sql")
```

## `sql.get`

리소스 레지스트리에서 데이터베이스 연결을 획득합니다.

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

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `id` | string | 리소스 ID (예: "app.db:main") |

**반환:** `DB, error`

<note>
데이터베이스 lease는 실행 프레임을 정리할 때 해제됩니다. 특히 장기 실행 작업에서는 데이터베이스 작업이 끝나는 즉시 `db:release()`를 명시적으로 호출하세요.
</note>

<note>
직접 실행하는 `db` 및 트랜잭션 쿼리의 플레이스홀더는 데이터베이스 드라이버에 변경 없이 전달됩니다. SQLite와 MySQL은 `?`를 사용하고, PostgreSQL은 `$1`, `$2` 등을 사용합니다. 빌더의 `run_with` 호출은 PostgreSQL에서 dollar 플레이스홀더를 자동으로 선택합니다. 다른 데이터베이스 타입은 빌더에서 선택한 형식을 유지하며 기본값은 `?`입니다. `to_sql`로 SQL을 생성하거나 다른 형식이 필요하면 `placeholder_format`을 설정하세요.
</note>

## 상수

### 데이터베이스 타입

```lua
sql.type.POSTGRES    -- "postgres"
sql.type.MYSQL       -- "mysql"
sql.type.SQLITE      -- "sqlite"
sql.type.UNKNOWN     -- "unknown"
```

### 격리 수준

```lua
sql.isolation.DEFAULT           -- "default"
sql.isolation.READ_UNCOMMITTED  -- "read_uncommitted"
sql.isolation.READ_COMMITTED    -- "read_committed"
sql.isolation.WRITE_COMMITTED   -- "write_committed"
sql.isolation.REPEATABLE_READ   -- "repeatable_read"
sql.isolation.SERIALIZABLE      -- "serializable"
```

### NULL 값

```lua
local insert = sql.builder.insert("users")
    :columns("name", "email")
    :values("alice", sql.NULL)
```

## 타입 변환

### `sql.as.int`

값을 SQL integer 타입으로 변환합니다.

```lua
local value = sql.as.int(42)
```

**반환:** `userdata`

### `sql.as.float`

값을 SQL float 타입으로 변환합니다.

```lua
local value = sql.as.float(19.99)
```

**반환:** `userdata`

### `sql.as.text`

값을 SQL text 타입으로 변환합니다.

```lua
local value = sql.as.text("hello")
```

**반환:** `userdata`

### `sql.as.binary`

값을 SQL binary 타입으로 변환합니다.

```lua
local value = sql.as.binary("binary data")
```

**반환:** `userdata`

### `sql.as.null`

SQL `NULL` 마커를 반환합니다.

```lua
local value = sql.as.null()
```

**반환:** `userdata`

## 쿼리 빌더

### `sql.builder.select`

`SELECT` 쿼리 빌더를 생성합니다.

```lua
local query = sql.builder.select("id", "name")
    :from("users")
    :where({active = 1})
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `columns` | ...string | 컬럼 이름 (선택적) |

**반환:** `SelectBuilder`

### `sql.builder.insert`

`INSERT` 쿼리 빌더를 생성합니다.

```lua
local query = sql.builder.insert("users")
    :columns("name", "email")
    :values("alice", "alice@example.com")
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `table` | string | 테이블 이름 (선택적) |

**반환:** `InsertBuilder`

### `sql.builder.update`

`UPDATE` 쿼리 빌더를 생성합니다.

```lua
local query = sql.builder.update("users")
    :set("status", "active")
    :where({id = 123})
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `table` | string | 테이블 이름 (선택적) |

**반환:** `UpdateBuilder`

### `sql.builder.delete`

`DELETE` 쿼리 빌더를 생성합니다.

```lua
local query = sql.builder.delete("users")
    :where({active = 0})
    :limit(100)
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `table` | string | 테이블 이름 (선택적) |

**반환:** `DeleteBuilder`

### `sql.builder.expr`

`WHERE` 또는 `HAVING` 절에서 사용할 raw SQL 표현식을 생성합니다.

```lua
local expr = sql.builder.expr("score BETWEEN ? AND ?", 80, 90)
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `sql` | string | ? 플레이스홀더가 있는 SQL 표현식 |
| `args` | ...any | 바인드 인자 (선택적) |

**반환:** `Sqlizer`

### `sql.builder.eq`

테이블에서 동등 조건을 생성합니다.

```lua
local cond = sql.builder.eq({active = 1, status = "open"})
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `map` | table | {column = value} 쌍 |

**반환:** `Sqlizer`

### `sql.builder.not_eq`

테이블에서 부등 조건을 생성합니다.

```lua
local cond = sql.builder.not_eq({status = "closed"})
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `map` | table | {column = value} 쌍 |

**반환:** `Sqlizer`

### `sql.builder.lt`

테이블에서 미만 조건을 생성합니다.

```lua
local cond = sql.builder.lt({age = 18})
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `map` | table | {column = value} 쌍 |

**반환:** `Sqlizer`

### `sql.builder.lte`

테이블에서 이하 조건을 생성합니다.

```lua
local cond = sql.builder.lte({price = 100})
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `map` | table | {column = value} 쌍 |

**반환:** `Sqlizer`

### `sql.builder.gt`

테이블에서 초과 조건을 생성합니다.

```lua
local cond = sql.builder.gt({score = 80})
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `map` | table | {column = value} 쌍 |

**반환:** `Sqlizer`

### `sql.builder.gte`

테이블에서 이상 조건을 생성합니다.

```lua
local cond = sql.builder.gte({age = 21})
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `map` | table | {column = value} 쌍 |

**반환:** `Sqlizer`

### `sql.builder.like`

테이블에서 `LIKE` 조건을 생성합니다.

```lua
local cond = sql.builder.like({name = "john%"})
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `map` | table | {column = value} 쌍 |

**반환:** `Sqlizer`

### `sql.builder.not_like`

테이블에서 `NOT LIKE` 조건을 생성합니다.

```lua
local cond = sql.builder.not_like({email = "%@spam.com"})
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `map` | table | {column = value} 쌍 |

**반환:** `Sqlizer`

### `sql.builder.and_`

여러 조건을 `AND`로 결합합니다.

```lua
local cond = sql.builder.and_({
    sql.builder.eq({active = 1}),
    sql.builder.gt({score = 80})
})
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `conditions` | table | Sqlizer 또는 테이블 조건 배열 |

**반환:** `Sqlizer`

### `sql.builder.or_`

여러 조건을 `OR`로 결합합니다.

```lua
local cond = sql.builder.or_({
    sql.builder.eq({status = "pending"}),
    sql.builder.eq({status = "active"})
})
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `conditions` | table | Sqlizer 또는 테이블 조건 배열 |

**반환:** `Sqlizer`

### `sql.builder.question`

`?` 플레이스홀더 형식을 사용합니다(기본값). `sql.builder.default_placeholder` 별칭으로도 사용할 수 있습니다.

```lua
local query = sql.builder.select("*")
    :from("users")
    :placeholder_format(sql.builder.question)
```

### `sql.builder.dollar`

`$1, $2, ...` 플레이스홀더 형식을 사용합니다.

```lua
local query = sql.builder.select("*")
    :from("users")
    :placeholder_format(sql.builder.dollar)
```

### `sql.builder.at`

`@p1, @p2, ...` 플레이스홀더용 포맷(SQL Server 스타일). 위 포맷들처럼 `placeholder_format`에 전달합니다.

### `sql.builder.colon`

`:1, :2, ...` 플레이스홀더용 포맷. 위 포맷들처럼 `placeholder_format`에 전달합니다.

## 연결 메서드

`sql.get()`에서 반환된 데이터베이스 연결 핸들.

### `db:type`

데이터베이스 타입 상수를 반환합니다.

```lua
local dbtype, err = db:type()
```

**반환:** `string, error`

### `db:query`

`SELECT` 쿼리를 실행하고 행을 반환합니다.

```lua
local rows, err = db:query("SELECT id, name FROM users WHERE active = ?", {1})
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `sql` | string | ? 플레이스홀더가 있는 SQL 쿼리 |
| `params` | table | 바인드 파라미터 배열 (선택적) |

**반환:** `table[], error`

### `db:execute`

`INSERT`, `UPDATE`, `DELETE` 쿼리를 실행합니다.

```lua
local result, err = db:execute("INSERT INTO users (name) VALUES (?)", {"alice"})
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `sql` | string | ? 플레이스홀더가 있는 SQL 문 |
| `params` | table | 바인드 파라미터 배열 (선택적) |

**반환:** `table, error`

다음 필드가 있는 테이블 반환:
- `last_insert_id` - 마지막 삽입된 ID
- `rows_affected` - 영향받은 행 수

### `db:prepare`

반복 실행을 위한 prepared statement를 생성합니다.

```lua
local stmt, err = db:prepare("SELECT * FROM users WHERE id = ?")
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `sql` | string | ? 플레이스홀더가 있는 SQL |

**반환:** `Statement, error`

### `db:begin`

데이터베이스 트랜잭션을 시작합니다.

```lua
local tx, err = db:begin({
    isolation = sql.isolation.SERIALIZABLE,
    read_only = false
})
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `options` | table | 트랜잭션 옵션 (선택적) |

옵션 테이블 필드:
- `isolation` - sql.isolation.*의 격리 수준 (기본값: DEFAULT)
- `read_only` - 읽기 전용 트랜잭션 플래그 (기본값: false)

**반환:** `Transaction, error`

### `db:release`

데이터베이스 리소스를 풀로 반환합니다.

```lua
local ok, err = db:release()
```

**반환:** `boolean, error`

이 작업은 멱등적입니다.

### `db:stats`

연결 풀 통계를 반환합니다.

```lua
local stats, err = db:stats()
```

**반환:** `table, error`

다음 필드가 있는 테이블 반환:
- `max_open_connections` - 허용된 최대 열린 연결
- `open_connections` - 현재 열린 연결
- `in_use` - 현재 사용 중인 연결
- `idle` - 풀의 유휴 연결
- `wait_count` - 총 연결 대기 횟수
- `wait_duration` - 총 대기 시간
- `max_idle_closed` - 최대 유휴로 닫힌 연결
- `max_idle_time_closed` - 유휴 타임아웃으로 닫힌 연결
- `max_lifetime_closed` - 최대 수명으로 닫힌 연결

## 준비된 문

`db:prepare()`가 반환한 prepared statement는 반복해서 쿼리하거나 실행할 수 있습니다.

### `stmt:query`

prepared statement를 `SELECT` 쿼리로 실행합니다.

```lua
local rows, err = stmt:query({123})
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `params` | table | 바인드 파라미터 배열 (선택적) |

**반환:** `table[], error`

### `stmt:execute`

prepared statement를 `INSERT`, `UPDATE`, `DELETE`로 실행합니다.

```lua
local result, err = stmt:execute({"alice"})
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `params` | table | 바인드 파라미터 배열 (선택적) |

**반환:** `table, error`

다음 필드가 있는 테이블 반환:
- `last_insert_id` - 마지막 삽입된 ID
- `rows_affected` - 영향받은 행 수

### `stmt:close`

prepared statement를 닫습니다.

```lua
local ok, err = stmt:close()
```

**반환:** `boolean, error`

## 트랜잭션

`db:begin()`이 반환한 트랜잭션은 쿼리, statement, savepoint, commit, rollback 작업을 제공합니다.

활성 트랜잭션은 실행 프레임을 정리할 때 자동으로 rollback됩니다. 작업이 끝나는 즉시 명시적으로 commit하거나 rollback하세요.

### `tx:db_type`

데이터베이스 타입 상수를 반환합니다.

```lua
local dbtype, err = tx:db_type()
```

**반환:** `string, error`

### `tx:query`

트랜잭션 내에서 `SELECT` 쿼리를 실행합니다.

```lua
local rows, err = tx:query("SELECT id, name FROM users WHERE active = ?", {1})
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `sql` | string | ? 플레이스홀더가 있는 SQL 쿼리 |
| `params` | table | 바인드 파라미터 배열 (선택적) |

**반환:** `table[], error`

### `tx:execute`

트랜잭션 내에서 `INSERT`, `UPDATE`, `DELETE`를 실행합니다.

```lua
local result, err = tx:execute("INSERT INTO users (name) VALUES (?)", {"alice"})
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `sql` | string | ? 플레이스홀더가 있는 SQL 문 |
| `params` | table | 바인드 파라미터 배열 (선택적) |

**반환:** `table, error`

다음 필드가 있는 테이블 반환:
- `last_insert_id` - 마지막 삽입된 ID
- `rows_affected` - 영향받은 행 수

### `tx:prepare`

트랜잭션 내에서 prepared statement를 생성합니다.

```lua
local stmt, err = tx:prepare("SELECT * FROM users WHERE id = ?")
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `sql` | string | ? 플레이스홀더가 있는 SQL |

**반환:** `Statement, error`

### `tx:commit`

트랜잭션을 커밋합니다.

```lua
local ok, err = tx:commit()
```

**반환:** `boolean, error`

### `tx:rollback`

트랜잭션을 롤백합니다.

```lua
local ok, err = tx:rollback()
```

**반환:** `boolean, error`

### `tx:savepoint`

트랜잭션 내에 명명된 savepoint를 생성합니다.

```lua
local ok, err = tx:savepoint("sp1")
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `name` | string | Savepoint 이름 (영숫자와 밑줄만 가능) |

**반환:** `boolean, error`

### `tx:rollback_to`

명명된 savepoint로 롤백합니다.

```lua
local ok, err = tx:rollback_to("sp1")
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `name` | string | Savepoint 이름 |

**반환:** `boolean, error`

### `tx:release`

savepoint를 해제합니다.

```lua
local ok, err = tx:release("sp1")
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `name` | string | Savepoint 이름 |

**반환:** `boolean, error`

## SELECT 빌더

`SELECT` 쿼리를 한 절씩 구성합니다.

### `select:from`

`FROM` 절을 설정합니다.

```lua
local query = sql.builder.select("id", "name"):from("users")
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `table` | string | 테이블 이름 |

**반환:** `SelectBuilder`

### `select:join`

`JOIN` 절을 추가합니다.

```lua
local query = sql.builder.select("*")
    :from("users")
    :join("orders ON orders.user_id = users.id")
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `join` | string | ? 플레이스홀더가 있는 JOIN 절 |
| `args` | ...any | 바인드 인자 (선택적) |

**반환:** `SelectBuilder`

### `select:left_join`

`LEFT JOIN` 절을 추가합니다.

```lua
local query = sql.builder.select("*")
    :from("users")
    :left_join("orders ON orders.user_id = users.id")
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `join` | string | ? 플레이스홀더가 있는 JOIN 절 |
| `args` | ...any | 바인드 인자 (선택적) |

**반환:** `SelectBuilder`

### `select:right_join`

`RIGHT JOIN` 절을 추가합니다.

```lua
local query = sql.builder.select("*")
    :from("users")
    :right_join("orders ON orders.user_id = users.id")
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `join` | string | ? 플레이스홀더가 있는 JOIN 절 |
| `args` | ...any | 바인드 인자 (선택적) |

**반환:** `SelectBuilder`

### `select:inner_join`

`INNER JOIN` 절을 추가합니다.

```lua
local query = sql.builder.select("*")
    :from("users")
    :inner_join("orders ON orders.user_id = users.id")
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `join` | string | ? 플레이스홀더가 있는 JOIN 절 |
| `args` | ...any | 바인드 인자 (선택적) |

**반환:** `SelectBuilder`

### `select:where`

`WHERE` 조건을 추가합니다.

```lua
local query = sql.builder.select("*")
    :from("users")
    :where({active = 1})
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `condition` | string\|table\|Sqlizer | WHERE 조건 |
| `args` | ...any | 바인드 인자 (선택적, 문자열 사용 시) |

세 가지 형식 지원:
- 문자열: `where("status = ?", "active")`
- 테이블: `where({status = "active"})`
- Sqlizer: `where(sql.builder.gt({score = 80}))`

**반환:** `SelectBuilder`

### `select:order_by`

`ORDER BY` 절을 추가합니다.

```lua
local query = sql.builder.select("*")
    :from("users")
    :order_by("name ASC", "created_at DESC")
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `columns` | ...string | 선택적 ASC/DESC가 있는 컬럼 이름 |

**반환:** `SelectBuilder`

### `select:group_by`

`GROUP BY` 절을 추가합니다.

```lua
local query = sql.builder.select("status", "COUNT(*)")
    :from("users")
    :group_by("status")
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `columns` | ...string | 컬럼 이름 |

**반환:** `SelectBuilder`

### `select:having`

`HAVING` 조건을 추가합니다.

```lua
local query = sql.builder.select("status", "COUNT(*) as cnt")
    :from("users")
    :group_by("status")
    :having(sql.builder.gt({cnt = 10}))
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `condition` | string\|table\|Sqlizer | HAVING 조건 |
| `args` | ...any | 바인드 인자 (선택적, 문자열 사용 시) |

**반환:** `SelectBuilder`

### `select:limit`

`LIMIT` 값을 설정합니다.

```lua
local query = sql.builder.select("*")
    :from("users")
    :limit(10)
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `n` | integer | Limit 값 |

**반환:** `SelectBuilder`

### `select:offset`

`OFFSET` 값을 설정합니다.

```lua
local query = sql.builder.select("*")
    :from("users")
    :offset(20)
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `n` | integer | Offset 값 |

**반환:** `SelectBuilder`

### `select:columns`

`SELECT` 목록에 컬럼을 추가합니다.

```lua
local query = sql.builder.select():columns("id", "name", "email")
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `columns` | ...string | 컬럼 이름 |

**반환:** `SelectBuilder`

### `select:distinct`

`DISTINCT` 수정자를 추가합니다.

```lua
local query = sql.builder.select("status")
    :from("users")
    :distinct()
```

**반환:** `SelectBuilder`

### `select:suffix`

SQL 접미사를 추가합니다.

```lua
local query = sql.builder.select("*")
    :from("users")
    :suffix("FOR UPDATE")
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `sql` | string | ? 플레이스홀더가 있는 SQL 접미사 |
| `args` | ...any | 바인드 인자 (선택적) |

**반환:** `SelectBuilder`

### `select:placeholder_format`

플레이스홀더 포맷을 설정합니다.

```lua
local query = sql.builder.select("*")
    :from("users")
    :placeholder_format(sql.builder.dollar)
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `format` | userdata | 플레이스홀더 포맷 (sql.builder.*) |

**반환:** `SelectBuilder`

### `select:to_sql`

SQL 문자열과 바인드 인자를 생성합니다.

```lua
local sql_str, args = query:to_sql()
```

**반환:** 성공 시 `string, table`, 잘못된 빌더 상태에서는 `nil, error`

### `select:run_with`

쿼리용 실행기를 생성합니다.

```lua
local executor, err = query:run_with(db)
if err then
    return nil, err
end
local rows, err = executor:query()
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `db` | DB\|Transaction | 데이터베이스 또는 트랜잭션 핸들 |

**반환:** `QueryExecutor, error`

## INSERT 빌더

`INSERT` 쿼리를 한 절씩 구성합니다.

### `insert:into`

테이블 이름을 설정합니다.

```lua
local query = sql.builder.insert():into("users")
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `table` | string | 테이블 이름 |

**반환:** `InsertBuilder`

### `insert:columns`

컬럼 이름을 설정합니다.

```lua
local query = sql.builder.insert("users"):columns("name", "email")
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `columns` | ...string | 컬럼 이름 |

**반환:** `InsertBuilder`

### `insert:values`

행 값을 추가합니다.

```lua
local query = sql.builder.insert("users")
    :columns("name", "email")
    :values("alice", "alice@example.com")
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `values` | ...any | 행 값 |

**반환:** `InsertBuilder`

### `insert:set_map`

테이블에서 컬럼과 값을 설정합니다.

```lua
local query = sql.builder.insert("users")
    :set_map({name = "alice", email = "alice@example.com"})
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `map` | table | {column = value} 쌍 |

**반환:** `InsertBuilder`

### `insert:select`

`SELECT` 쿼리에서 행을 삽입합니다.

```lua
local select_query = sql.builder.select("name", "email"):from("temp_users")
local query = sql.builder.insert("users")
    :columns("name", "email")
    :select(select_query)
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `query` | SelectBuilder | SELECT 쿼리 |

**반환:** `InsertBuilder`

### `insert:prefix`

SQL 접두사를 추가합니다.

```lua
local query = sql.builder.insert("users")
    :prefix("/* audit import */")
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `sql` | string | ? 플레이스홀더가 있는 SQL 접두사 |
| `args` | ...any | 바인드 인자 (선택적) |

**반환:** `InsertBuilder`

### `insert:suffix`

SQL 접미사를 추가합니다.

```lua
local query = sql.builder.insert("users")
    :columns("name")
    :values("alice")
    :suffix("RETURNING id")
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `sql` | string | ? 플레이스홀더가 있는 SQL 접미사 |
| `args` | ...any | 바인드 인자 (선택적) |

**반환:** `InsertBuilder`

### `insert:options`

`INSERT` 옵션을 추가합니다.

```lua
local query = sql.builder.insert("users")
    :options("DELAYED", "IGNORE")
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `options` | ...string | INSERT 옵션 |

**반환:** `InsertBuilder`

### `insert:placeholder_format`

플레이스홀더 포맷을 설정합니다.

```lua
local query = sql.builder.insert("users")
    :placeholder_format(sql.builder.dollar)
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `format` | userdata | 플레이스홀더 포맷 (sql.builder.*) |

**반환:** `InsertBuilder`

### `insert:to_sql`

SQL 문자열과 바인드 인자를 생성합니다.

```lua
local sql_str, args = query:to_sql()
```

**반환:** 성공 시 `string, table`, 잘못된 빌더 상태에서는 `nil, error`

### `insert:run_with`

쿼리용 실행기를 생성합니다.

```lua
local executor, err = query:run_with(db)
if err then
    return nil, err
end
local result, err = executor:exec()
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `db` | DB\|Transaction | 데이터베이스 또는 트랜잭션 핸들 |

**반환:** `QueryExecutor, error`

## UPDATE 빌더

`UPDATE` 쿼리를 한 절씩 구성합니다.

### `update:table`

테이블 이름을 설정합니다.

```lua
local query = sql.builder.update():table("users")
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `table` | string | 테이블 이름 |

**반환:** `UpdateBuilder`

### `update:set`

컬럼 값을 설정합니다.

```lua
local query = sql.builder.update("users")
    :set("status", "active")
    :set("updated_at", sql.builder.expr("NOW()"))
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `column` | string | 컬럼 이름 |
| `value` | any | 컬럼 값 |

**반환:** `UpdateBuilder`

### `update:set_map`

테이블에서 여러 컬럼을 설정합니다.

```lua
local query = sql.builder.update("users")
    :set_map({status = "active", updated_at = sql.builder.expr("NOW()")})
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `map` | table | {column = value} 쌍 |

**반환:** `UpdateBuilder`

### `update:where`

`WHERE` 조건을 추가합니다.

```lua
local query = sql.builder.update("users")
    :set("status", "active")
    :where({id = 123})
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `condition` | string\|table\|Sqlizer | WHERE 조건 |
| `args` | ...any | 바인드 인자 (선택적, 문자열 사용 시) |

**반환:** `UpdateBuilder`

### `update:order_by`

`ORDER BY` 절을 추가합니다.

```lua
local query = sql.builder.update("users")
    :set("rank", 1)
    :order_by("score DESC")
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `columns` | ...string | 선택적 ASC/DESC가 있는 컬럼 이름 |

**반환:** `UpdateBuilder`

### `update:limit`

`LIMIT` 값을 설정합니다.

```lua
local query = sql.builder.update("users")
    :set("status", "active")
    :limit(10)
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `n` | integer | Limit 값 |

**반환:** `UpdateBuilder`

### `update:offset`

`OFFSET` 값을 설정합니다.

```lua
local query = sql.builder.update("users")
    :set("status", "active")
    :offset(5)
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `n` | integer | Offset 값 |

**반환:** `UpdateBuilder`

### `update:suffix`

SQL 접미사를 추가합니다.

```lua
local query = sql.builder.update("users")
    :set("status", "active")
    :suffix("RETURNING id")
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `sql` | string | ? 플레이스홀더가 있는 SQL 접미사 |
| `args` | ...any | 바인드 인자 (선택적) |

**반환:** `UpdateBuilder`

### `update:from`

`FROM` 절을 추가합니다.

```lua
local query = sql.builder.update("users")
    :set("status", "active")
    :from("other_table")
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `table` | string | 테이블 이름 |

**반환:** `UpdateBuilder`

### `update:from_select`

`SELECT` 쿼리에서 행을 업데이트합니다.

```lua
local select_query = sql.builder.select("*"):from("temp_users")
local query = sql.builder.update("users")
    :set("status", "active")
    :from_select(select_query, "t")
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `query` | SelectBuilder | SELECT 쿼리 |
| `alias` | string | 테이블 별칭 |

**반환:** `UpdateBuilder`

### `update:placeholder_format`

플레이스홀더 포맷을 설정합니다.

```lua
local query = sql.builder.update("users")
    :placeholder_format(sql.builder.dollar)
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `format` | userdata | 플레이스홀더 포맷 (sql.builder.*) |

**반환:** `UpdateBuilder`

### `update:to_sql`

SQL 문자열과 바인드 인자를 생성합니다.

```lua
local sql_str, args = query:to_sql()
```

**반환:** 성공 시 `string, table`, 잘못된 빌더 상태에서는 `nil, error`

### `update:run_with`

쿼리용 실행기를 생성합니다.

```lua
local executor, err = query:run_with(db)
if err then
    return nil, err
end
local result, err = executor:exec()
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `db` | DB\|Transaction | 데이터베이스 또는 트랜잭션 핸들 |

**반환:** `QueryExecutor, error`

## DELETE 빌더

`DELETE` 쿼리를 한 절씩 구성합니다.

### `delete:from`

테이블 이름을 설정합니다.

```lua
local query = sql.builder.delete():from("users")
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `table` | string | 테이블 이름 |

**반환:** `DeleteBuilder`

### `delete:where`

`WHERE` 조건을 추가합니다.

```lua
local query = sql.builder.delete("users")
    :where({active = 0})
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `condition` | string\|table\|Sqlizer | WHERE 조건 |
| `args` | ...any | 바인드 인자 (선택적, 문자열 사용 시) |

**반환:** `DeleteBuilder`

### `delete:order_by`

`ORDER BY` 절을 추가합니다.

```lua
local query = sql.builder.delete("users")
    :where({active = 0})
    :order_by("created_at ASC")
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `columns` | ...string | 선택적 ASC/DESC가 있는 컬럼 이름 |

**반환:** `DeleteBuilder`

### `delete:limit`

`LIMIT` 값을 설정합니다.

```lua
local query = sql.builder.delete("users")
    :where({active = 0})
    :limit(100)
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `n` | integer | Limit 값 |

**반환:** `DeleteBuilder`

### `delete:offset`

`OFFSET` 값을 설정합니다.

```lua
local query = sql.builder.delete("users")
    :where({active = 0})
    :offset(10)
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `n` | integer | Offset 값 |

**반환:** `DeleteBuilder`

### `delete:suffix`

SQL 접미사를 추가합니다.

```lua
local query = sql.builder.delete("users")
    :where({active = 0})
    :suffix("RETURNING id")
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `sql` | string | ? 플레이스홀더가 있는 SQL 접미사 |
| `args` | ...any | 바인드 인자 (선택적) |

**반환:** `DeleteBuilder`

### `delete:placeholder_format`

플레이스홀더 포맷을 설정합니다.

```lua
local query = sql.builder.delete("users")
    :placeholder_format(sql.builder.dollar)
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `format` | userdata | 플레이스홀더 포맷 (sql.builder.*) |

**반환:** `DeleteBuilder`

### `delete:to_sql`

SQL 문자열과 바인드 인자를 생성합니다.

```lua
local sql_str, args = query:to_sql()
```

**반환:** 성공 시 `string, table`, 잘못된 빌더 상태에서는 `nil, error`

### `delete:run_with`

쿼리용 실행기를 생성합니다.

```lua
local executor, err = query:run_with(db)
if err then
    return nil, err
end
local result, err = executor:exec()
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `db` | DB\|Transaction | 데이터베이스 또는 트랜잭션 핸들 |

**반환:** `QueryExecutor, error`

## 쿼리 실행

쿼리 실행기는 빌더가 생성한 쿼리를 실행합니다.

### `executor:query`

쿼리를 실행하고 `SELECT` 문의 행을 반환합니다.

```lua
local rows, err = executor:query()
```

**반환:** `table[], error`

### `executor:exec`

쿼리를 실행하고 `INSERT`, `UPDATE`, `DELETE` 문의 결과를 반환합니다.

```lua
local result, err = executor:exec()
```

**반환:** `table, error`

다음 필드가 있는 테이블 반환:
- `last_insert_id` - 마지막 삽입된 ID
- `rows_affected` - 영향받은 행 수

### `executor:to_sql`

실행하지 않고 생성된 SQL과 인자를 반환합니다.

```lua
local sql_str, args = executor:to_sql()
```

**반환:** `string, table`

## 권한

데이터베이스 접근은 보안 정책 평가 대상입니다.

| 액션 | 리소스 | 설명 |
|------|--------|------|
| `db.get` | 데이터베이스 ID | 데이터베이스 연결 획득 |

## 에러

| 조건 | 종류 | 재시도 가능 |
|------|------|-------------|
| 빈 리소스 ID | `errors.INVALID` | 아니오 |
| 권한 거부됨 | `errors.PERMISSION_DENIED` | 아니오 |
| 리소스를 찾을 수 없음 | `errors.NOT_FOUND` | 아니오 |
| 리소스가 데이터베이스 아님 | `errors.INVALID` | 아니오 |
| 잘못된 파라미터 | `errors.INVALID` | 아니오 |
| Statement 닫힘 | `errors.INVALID` | 아니오 |
| 트랜잭션 비활성 | `errors.INVALID` | 아니오 |
| 잘못된 savepoint 이름 | `errors.INVALID` | 아니오 |
| 드라이버 또는 쿼리 실행 오류 | 가능한 경우 드라이버 오류를 그대로 유지하고, 그렇지 않으면 지정되지 않음 | 다양함 |

오류 처리 방법은 [오류 처리](../core/errors.md)를 참조하세요.

## 결합된 부분 레시피

이 레시피는 `app.db:main`이 설정된 SQLite 또는 MySQL 데이터베이스이며 참조하는 컬럼을 가진 `users`, `orders`, `logs` 테이블이 이미 있다고 가정합니다. `?` 플레이스홀더를 사용하며 PostgreSQL 리소스에서는 `$1`, `$2` 등을 사용해야 합니다. 반환되는 행은 애플리케이션 데이터에 따라 달라집니다. 주변 애플리케이션은 rollback 또는 close 실패가 최초 작업 오류를 대체하지 않으면서 관찰되도록 `report_cleanup_error(err)`를 제공합니다.

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
