# SQL 데이터베이스
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>
<secondary-label ref="permissions"/>

PostgreSQL, MySQL, SQLite, MSSQL, Oracle 데이터베이스에 대해 SQL 쿼리를 실행합니다. 파라미터화된 쿼리, 트랜잭션, prepared statement, 플루언트 쿼리 빌더를 지원합니다.

데이터베이스 설정은 [데이터베이스](system-database.md)를 참조하세요.

## 로딩

```lua
local sql = require("sql")
```

## 연결 획득

리소스 레지스트리에서 데이터베이스 연결 가져오기:

```lua
local db, err = sql.get("app.db:main")
if err then
    return nil, err
end

local rows = db:query("SELECT * FROM users WHERE active = ?", {1})

db:release()
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `id` | string | 리소스 ID (예: "app.db:main") |

**반환:** `DB, error`

<note>
연결은 함수가 종료될 때 자동으로 풀로 반환되지만, 장기 실행 작업에서는 `db:release()`를 명시적으로 호출하는 것이 권장됩니다.
</note>

## 상수

### 데이터베이스 타입

```lua
sql.type.POSTGRES    -- "postgres"
sql.type.MYSQL       -- "mysql"
sql.type.SQLITE      -- "sqlite"
sql.type.MSSQL       -- "mssql"
sql.type.ORACLE      -- "oracle"
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

### as.int

```lua
local value = sql.as.int(42)
```

**반환:** `userdata`

## as.float

값을 SQL float 타입으로 변환합니다.

```lua
local value = sql.as.float(19.99)
```

**반환:** `userdata`

## as.text

값을 SQL text 타입으로 변환합니다.

```lua
local value = sql.as.text("hello")
```

**반환:** `userdata`

## as.binary

값을 SQL binary 타입으로 변환합니다.

```lua
local value = sql.as.binary("binary data")
```

**반환:** `userdata`

## as.null

SQL NULL 마커를 반환합니다.

```lua
local value = sql.as.null()
```

**반환:** `userdata`

## 쿼리 빌더

### 쿼리 생성

```lua
local query = sql.builder.select("id", "name")
    :from("users")
    :where({active = 1})
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `columns` | ...string | 컬럼 이름 (선택적) |

**반환:** `SelectBuilder`

## builder.insert

INSERT 쿼리 빌더를 생성합니다.

```lua
local query = sql.builder.insert("users")
    :columns("name", "email")
    :values("alice", "alice@example.com")
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `table` | string | 테이블 이름 (선택적) |

**반환:** `InsertBuilder`

## builder.update

UPDATE 쿼리 빌더를 생성합니다.

```lua
local query = sql.builder.update("users")
    :set("status", "active")
    :where({id = 123})
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `table` | string | 테이블 이름 (선택적) |

**반환:** `UpdateBuilder`

## builder.delete

DELETE 쿼리 빌더를 생성합니다.

```lua
local query = sql.builder.delete("users")
    :where({active = 0})
    :limit(100)
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `table` | string | 테이블 이름 (선택적) |

**반환:** `DeleteBuilder`

## builder.expr

where/having 절에서 사용할 raw SQL 표현식을 생성합니다.

```lua
local expr = sql.builder.expr("score BETWEEN ? AND ?", 80, 90)
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `sql` | string | ? 플레이스홀더가 있는 SQL 표현식 |
| `args` | ...any | 바인드 인자 (선택적) |

**반환:** `Sqlizer`

## builder.eq

테이블에서 동등 조건을 생성합니다.

```lua
local cond = sql.builder.eq({active = 1, status = "open"})
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `map` | table | {column = value} 쌍 |

**반환:** `Sqlizer`

## builder.not_eq

테이블에서 부등 조건을 생성합니다.

```lua
local cond = sql.builder.not_eq({status = "closed"})
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `map` | table | {column = value} 쌍 |

**반환:** `Sqlizer`

## builder.lt

테이블에서 미만 조건을 생성합니다.

```lua
local cond = sql.builder.lt({age = 18})
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `map` | table | {column = value} 쌍 |

**반환:** `Sqlizer`

## builder.lte

테이블에서 이하 조건을 생성합니다.

```lua
local cond = sql.builder.lte({price = 100})
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `map` | table | {column = value} 쌍 |

**반환:** `Sqlizer`

## builder.gt

테이블에서 초과 조건을 생성합니다.

```lua
local cond = sql.builder.gt({score = 80})
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `map` | table | {column = value} 쌍 |

**반환:** `Sqlizer`

## builder.gte

테이블에서 이상 조건을 생성합니다.

```lua
local cond = sql.builder.gte({age = 21})
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `map` | table | {column = value} 쌍 |

**반환:** `Sqlizer`

## builder.like

테이블에서 LIKE 조건을 생성합니다.

```lua
local cond = sql.builder.like({name = "john%"})
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `map` | table | {column = value} 쌍 |

**반환:** `Sqlizer`

## builder.not_like

테이블에서 NOT LIKE 조건을 생성합니다.

```lua
local cond = sql.builder.not_like({email = "%@spam.com"})
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `map` | table | {column = value} 쌍 |

**반환:** `Sqlizer`

## builder.and_

여러 조건을 AND로 결합합니다.

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

## builder.or_

여러 조건을 OR로 결합합니다.

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

## builder.question

? 플레이스홀더용 포맷 (기본값).

```lua
local query = sql.builder.select("*")
    :from("users")
    :placeholder_format(sql.builder.question)
```

## builder.dollar

$1, $2, ... 플레이스홀더용 포맷.

```lua
local query = sql.builder.select("*")
    :from("users")
    :placeholder_format(sql.builder.dollar)
```

## builder.at

@p1, @p2, ... 플레이스홀더용 포맷.

```lua
local query = sql.builder.select("*")
    :from("users")
    :placeholder_format(sql.builder.at)
```

## builder.colon

:1, :2, ... 플레이스홀더용 포맷.

```lua
local query = sql.builder.select("*")
    :from("users")
    :placeholder_format(sql.builder.colon)
```

## 연결 메서드

`sql.get()`에서 반환된 데이터베이스 연결 핸들.

### db:type

데이터베이스 타입 상수를 반환합니다.

```lua
local dbtype, err = db:type()
```

**반환:** `string, error`

### db:query

SELECT 쿼리를 실행하고 행을 반환합니다.

```lua
local rows, err = db:query("SELECT id, name FROM users WHERE active = ?", {1})
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `sql` | string | ? 플레이스홀더가 있는 SQL 쿼리 |
| `params` | table | 바인드 파라미터 배열 (선택적) |

**반환:** `table[], error`

### db:execute

INSERT/UPDATE/DELETE 쿼리를 실행합니다.

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

### db:prepare

반복 실행을 위한 prepared statement를 생성합니다.

```lua
local stmt, err = db:prepare("SELECT * FROM users WHERE id = ?")
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `sql` | string | ? 플레이스홀더가 있는 SQL |

**반환:** `Statement, error`

### db:begin

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

### db:release

데이터베이스 리소스를 풀로 반환합니다.

```lua
local ok, err = db:release()
```

**반환:** `boolean, error`

### db:stats

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

## Prepared Statement

`db:prepare()`에서 반환된 prepared statement.

### stmt:query

prepared statement를 SELECT로 실행합니다.

```lua
local rows, err = stmt:query({123})
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `params` | table | 바인드 파라미터 배열 (선택적) |

**반환:** `table[], error`

### stmt:execute

prepared statement를 INSERT/UPDATE/DELETE로 실행합니다.

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

### stmt:close

prepared statement를 닫습니다.

```lua
local ok, err = stmt:close()
```

**반환:** `boolean, error`

## 트랜잭션

`db:begin()`에서 반환된 데이터베이스 트랜잭션.

### tx:db_type

데이터베이스 타입 상수를 반환합니다.

```lua
local dbtype, err = tx:db_type()
```

**반환:** `string, error`

### tx:query

트랜잭션 내에서 SELECT 쿼리를 실행합니다.

```lua
local rows, err = tx:query("SELECT id, name FROM users WHERE active = ?", {1})
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `sql` | string | ? 플레이스홀더가 있는 SQL 쿼리 |
| `params` | table | 바인드 파라미터 배열 (선택적) |

**반환:** `table[], error`

### tx:execute

트랜잭션 내에서 INSERT/UPDATE/DELETE를 실행합니다.

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

### tx:prepare

트랜잭션 내에서 prepared statement를 생성합니다.

```lua
local stmt, err = tx:prepare("SELECT * FROM users WHERE id = ?")
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `sql` | string | ? 플레이스홀더가 있는 SQL |

**반환:** `Statement, error`

### tx:commit

트랜잭션을 커밋합니다.

```lua
local ok, err = tx:commit()
```

**반환:** `boolean, error`

### tx:rollback

트랜잭션을 롤백합니다.

```lua
local ok, err = tx:rollback()
```

**반환:** `boolean, error`

### tx:savepoint

트랜잭션 내에 명명된 savepoint를 생성합니다.

```lua
local ok, err = tx:savepoint("sp1")
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `name` | string | Savepoint 이름 (영숫자와 밑줄만 가능) |

**반환:** `boolean, error`

### tx:rollback_to

명명된 savepoint로 롤백합니다.

```lua
local ok, err = tx:rollback_to("sp1")
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `name` | string | Savepoint 이름 |

**반환:** `boolean, error`

### tx:release

savepoint를 해제합니다.

```lua
local ok, err = tx:release("sp1")
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `name` | string | Savepoint 이름 |

**반환:** `boolean, error`

## SELECT 빌더

SELECT 쿼리 빌드를 위한 플루언트 인터페이스.

### select:from

FROM 절을 설정합니다.

```lua
local query = sql.builder.select("id", "name"):from("users")
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `table` | string | 테이블 이름 |

**반환:** `SelectBuilder`

### select:join

JOIN 절을 추가합니다.

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

### select:left_join

LEFT JOIN 절을 추가합니다.

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

### select:right_join

RIGHT JOIN 절을 추가합니다.

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

### select:inner_join

INNER JOIN 절을 추가합니다.

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

### select:where

WHERE 조건을 추가합니다.

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

### select:order_by

ORDER BY 절을 추가합니다.

```lua
local query = sql.builder.select("*")
    :from("users")
    :order_by("name ASC", "created_at DESC")
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `columns` | ...string | 선택적 ASC/DESC가 있는 컬럼 이름 |

**반환:** `SelectBuilder`

### select:group_by

GROUP BY 절을 추가합니다.

```lua
local query = sql.builder.select("status", "COUNT(*)")
    :from("users")
    :group_by("status")
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `columns` | ...string | 컬럼 이름 |

**반환:** `SelectBuilder`

### select:having

HAVING 조건을 추가합니다.

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

### select:limit

LIMIT을 설정합니다.

```lua
local query = sql.builder.select("*")
    :from("users")
    :limit(10)
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `n` | integer | Limit 값 |

**반환:** `SelectBuilder`

### select:offset

OFFSET을 설정합니다.

```lua
local query = sql.builder.select("*")
    :from("users")
    :offset(20)
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `n` | integer | Offset 값 |

**반환:** `SelectBuilder`

### select:columns

SELECT에 컬럼을 추가합니다.

```lua
local query = sql.builder.select():columns("id", "name", "email")
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `columns` | ...string | 컬럼 이름 |

**반환:** `SelectBuilder`

### select:distinct

DISTINCT 수정자를 추가합니다.

```lua
local query = sql.builder.select("status")
    :from("users")
    :distinct()
```

**반환:** `SelectBuilder`

### select:suffix

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

### select:placeholder_format

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

### select:to_sql

SQL 문자열과 바인드 인자를 생성합니다.

```lua
local sql_str, args = query:to_sql()
```

**반환:** `string, table`

### select:run_with

쿼리용 실행기를 생성합니다.

```lua
local executor = query:run_with(db)
local rows, err = executor:query()
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `db` | DB\|Transaction | 데이터베이스 또는 트랜잭션 핸들 |

**반환:** `QueryExecutor`

## INSERT 빌더

INSERT 쿼리 빌드를 위한 플루언트 인터페이스.

### insert:into

테이블 이름을 설정합니다.

```lua
local query = sql.builder.insert():into("users")
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `table` | string | 테이블 이름 |

**반환:** `InsertBuilder`

### insert:columns

컬럼 이름을 설정합니다.

```lua
local query = sql.builder.insert("users"):columns("name", "email")
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `columns` | ...string | 컬럼 이름 |

**반환:** `InsertBuilder`

### insert:values

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

### insert:set_map

테이블에서 컬럼과 값을 설정합니다.

```lua
local query = sql.builder.insert("users")
    :set_map({name = "alice", email = "alice@example.com"})
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `map` | table | {column = value} 쌍 |

**반환:** `InsertBuilder`

### insert:select

SELECT 쿼리에서 삽입합니다.

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

### insert:prefix

SQL 접두사를 추가합니다.

```lua
local query = sql.builder.insert("users")
    :prefix("INSERT IGNORE INTO")
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `sql` | string | ? 플레이스홀더가 있는 SQL 접두사 |
| `args` | ...any | 바인드 인자 (선택적) |

**반환:** `InsertBuilder`

### insert:suffix

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

### insert:options

INSERT 옵션을 추가합니다.

```lua
local query = sql.builder.insert("users")
    :options("DELAYED", "IGNORE")
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `options` | ...string | INSERT 옵션 |

**반환:** `InsertBuilder`

### insert:placeholder_format

플레이스홀더 포맷을 설정합니다.

```lua
local query = sql.builder.insert("users")
    :placeholder_format(sql.builder.dollar)
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `format` | userdata | 플레이스홀더 포맷 (sql.builder.*) |

**반환:** `InsertBuilder`

### insert:to_sql

SQL 문자열과 바인드 인자를 생성합니다.

```lua
local sql_str, args = query:to_sql()
```

**반환:** `string, table`

### insert:run_with

쿼리용 실행기를 생성합니다.

```lua
local executor = query:run_with(db)
local result, err = executor:exec()
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `db` | DB\|Transaction | 데이터베이스 또는 트랜잭션 핸들 |

**반환:** `QueryExecutor`

## UPDATE 빌더

UPDATE 쿼리 빌드를 위한 플루언트 인터페이스.

### update:table

테이블 이름을 설정합니다.

```lua
local query = sql.builder.update():table("users")
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `table` | string | 테이블 이름 |

**반환:** `UpdateBuilder`

### update:set

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

### update:set_map

테이블에서 여러 컬럼을 설정합니다.

```lua
local query = sql.builder.update("users")
    :set_map({status = "active", updated_at = sql.builder.expr("NOW()")})
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `map` | table | {column = value} 쌍 |

**반환:** `UpdateBuilder`

### update:where

WHERE 조건을 추가합니다.

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

### update:order_by

ORDER BY 절을 추가합니다.

```lua
local query = sql.builder.update("users")
    :set("rank", 1)
    :order_by("score DESC")
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `columns` | ...string | 선택적 ASC/DESC가 있는 컬럼 이름 |

**반환:** `UpdateBuilder`

### update:limit

LIMIT을 설정합니다.

```lua
local query = sql.builder.update("users")
    :set("status", "active")
    :limit(10)
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `n` | integer | Limit 값 |

**반환:** `UpdateBuilder`

### update:offset

OFFSET을 설정합니다.

```lua
local query = sql.builder.update("users")
    :set("status", "active")
    :offset(5)
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `n` | integer | Offset 값 |

**반환:** `UpdateBuilder`

### update:suffix

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

### update:from

FROM 절을 추가합니다.

```lua
local query = sql.builder.update("users")
    :set("status", "active")
    :from("other_table")
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `table` | string | 테이블 이름 |

**반환:** `UpdateBuilder`

### update:from_select

SELECT 쿼리에서 업데이트합니다.

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

### update:placeholder_format

플레이스홀더 포맷을 설정합니다.

```lua
local query = sql.builder.update("users")
    :placeholder_format(sql.builder.dollar)
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `format` | userdata | 플레이스홀더 포맷 (sql.builder.*) |

**반환:** `UpdateBuilder`

### update:to_sql

SQL 문자열과 바인드 인자를 생성합니다.

```lua
local sql_str, args = query:to_sql()
```

**반환:** `string, table`

### update:run_with

쿼리용 실행기를 생성합니다.

```lua
local executor = query:run_with(db)
local result, err = executor:exec()
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `db` | DB\|Transaction | 데이터베이스 또는 트랜잭션 핸들 |

**반환:** `QueryExecutor`

## DELETE 빌더

DELETE 쿼리 빌드를 위한 플루언트 인터페이스.

### delete:from

테이블 이름을 설정합니다.

```lua
local query = sql.builder.delete():from("users")
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `table` | string | 테이블 이름 |

**반환:** `DeleteBuilder`

### delete:where

WHERE 조건을 추가합니다.

```lua
local query = sql.builder.delete("users")
    :where({active = 0})
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `condition` | string\|table\|Sqlizer | WHERE 조건 |
| `args` | ...any | 바인드 인자 (선택적, 문자열 사용 시) |

**반환:** `DeleteBuilder`

### delete:order_by

ORDER BY 절을 추가합니다.

```lua
local query = sql.builder.delete("users")
    :where({active = 0})
    :order_by("created_at ASC")
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `columns` | ...string | 선택적 ASC/DESC가 있는 컬럼 이름 |

**반환:** `DeleteBuilder`

### delete:limit

LIMIT을 설정합니다.

```lua
local query = sql.builder.delete("users")
    :where({active = 0})
    :limit(100)
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `n` | integer | Limit 값 |

**반환:** `DeleteBuilder`

### delete:offset

OFFSET을 설정합니다.

```lua
local query = sql.builder.delete("users")
    :where({active = 0})
    :offset(10)
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `n` | integer | Offset 값 |

**반환:** `DeleteBuilder`

### delete:suffix

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

### delete:placeholder_format

플레이스홀더 포맷을 설정합니다.

```lua
local query = sql.builder.delete("users")
    :placeholder_format(sql.builder.dollar)
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `format` | userdata | 플레이스홀더 포맷 (sql.builder.*) |

**반환:** `DeleteBuilder`

### delete:to_sql

SQL 문자열과 바인드 인자를 생성합니다.

```lua
local sql_str, args = query:to_sql()
```

**반환:** `string, table`

### delete:run_with

쿼리용 실행기를 생성합니다.

```lua
local executor = query:run_with(db)
local result, err = executor:exec()
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `db` | DB\|Transaction | 데이터베이스 또는 트랜잭션 핸들 |

**반환:** `QueryExecutor`

## 쿼리 실행

쿼리 실행기는 빌더가 생성한 쿼리를 실행합니다.

### executor:query

쿼리를 실행하고 행을 반환합니다 (SELECT용).

```lua
local rows, err = executor:query()
```

**반환:** `table[], error`

### executor:exec

쿼리를 실행하고 결과를 반환합니다 (INSERT/UPDATE/DELETE용).

```lua
local result, err = executor:exec()
```

**반환:** `table, error`

다음 필드가 있는 테이블 반환:
- `last_insert_id` - 마지막 삽입된 ID
- `rows_affected` - 영향받은 행 수

### executor:to_sql

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
| SQL 구문 에러 | `errors.INVALID` | 아니오 |
| Statement 닫힘 | `errors.INVALID` | 아니오 |
| 트랜잭션 비활성 | `errors.INVALID` | 아니오 |
| 잘못된 savepoint 이름 | `errors.INVALID` | 아니오 |
| 쿼리 실행 에러 | 다양함 | 다양함 |

에러 처리는 [에러 처리](lua-errors.md)를 참조하세요.

## 예제

```lua
local sql = require("sql")

-- 데이터베이스 연결 획득
local db, err = sql.get("app.db:main")
if err then error(err) end

-- 데이터베이스 타입 확인
local dbtype, _ = db:type()
print("Database type:", dbtype)

-- 직접 쿼리
local users, err = db:query("SELECT id, name FROM users WHERE active = ?", {1})
if err then error(err) end

for _, user in ipairs(users) do
    print(user.id, user.name)
end

-- 빌더 패턴
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

-- savepoint가 있는 트랜잭션
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

-- Prepared statement
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

-- NULL 및 타입화된 값
local insert = sql.builder.insert("products")
    :columns("name", "price", "description")
    :values("Widget", sql.as.float(19.99), sql.NULL)

local executor = insert:run_with(db)
local result, err = executor:exec()
if err then error(err) end

print("Inserted ID:", result.last_insert_id)

db:release()
```
