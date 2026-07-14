---
title: "마이그레이션"
---

# 마이그레이션

`wippy/migration` 모듈은 스키마 변경을 정의하기 위한 작은 DSL, 이를 탐색하고 실행하는 러너, 그리고 프로젝트에 등록된 모든 `target_db`에 대해 대기 중인 마이그레이션을 실행하는 부트로더를 포함하는 데이터베이스 마이그레이션 프레임워크를 제공합니다.

마이그레이션은 SQLite, PostgreSQL, MySQL을 지원하며, 드라이버별 `up`/`down` 구현이 나란히 정의됩니다.

## 설정

프로젝트에 모듈을 추가합니다:

```bash
wippy add wippy/migration
wippy install
```

의존성과 마이그레이션이 대상으로 하는 애플리케이션 데이터베이스를 선언합니다:

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

마이그레이션 부트로더는 `wippy/bootloader`에 순서 `20`으로 등록됩니다. 애플리케이션이 시작되면 레지스트리에서 모든 마이그레이션 엔트리를 탐색하고, `meta.target_db`별로 그룹화한 다음, 각 데이터베이스에 대해 대기 중인 마이그레이션을 실행합니다.

## 마이그레이션 정의

마이그레이션은 `meta.type: migration`을 가진 `function.lua` 엔트리입니다. 엔트리는 `migration.define(...)`에 의해 생성된 함수를 반환합니다.

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

### 필수 메타데이터

| 필드 | 필수 | 설명 |
|-------|----------|-------------|
| `meta.type` | 예 | 탐색을 위해 `"migration"`이어야 합니다 |
| `meta.target_db` | 예 | 실행할 데이터베이스의 레지스트리 ID |
| `meta.timestamp` | 아니오 | 동일한 데이터베이스를 대상으로 하는 여러 마이그레이션이 있을 때 순서를 정하는 데 사용되는 ISO-8601 타임스탬프 |
| `meta.tags` | 아니오 | 태그 배열; 러너는 태그로 마이그레이션을 필터링할 수 있습니다 |

데이터베이스에 대한 마이그레이션은 `meta.timestamp` 오름차순으로 실행됩니다.

## DSL

`migration.define`에 전달되는 함수 내에서 세 개의 중첩된 함수를 사용할 수 있습니다:

| 함수 | 설명 |
|----------|-------------|
| `migration(description, fn)` | 사람이 읽을 수 있는 설명으로 새 마이그레이션 열기 |
| `database(type, fn)` | `"sqlite"`, `"postgres"`, 또는 `"mysql"`에 대한 구현 선언 |
| `up(fn)` / `down(fn)` | 정방향 및 롤백 함수 정의 |
| `after(fn)` | 선택적 마이그레이션 후 훅 (동일 트랜잭션) |

각 `up`/`down`/`after` 함수는 원시 연결이 아닌 트랜잭션 객체를 받습니다. 세 가지 작업 모두 오류 시 롤백되는 단일 트랜잭션에서 실행됩니다.

### 트랜잭션 메서드

```lua
local rows, err  = db:query(sql, params)    -- SELECT, returns array of rows
local result, err = db:execute(sql, params) -- INSERT/UPDATE/DDL, returns { rows_affected, last_insert_id }
local stmt, err  = db:prepare(sql)          -- prepared statement
```

항상 파라미터화된 쿼리를 사용하세요:

```lua
db:execute("INSERT INTO users (name, email) VALUES (?, ?)", { "Alice", "alice@example.com" })
```

### 오류 처리

`error(...)`를 호출하면 마이그레이션이 중단되고 트랜잭션이 롤백됩니다. 실패할 수 있는 모든 구문을 래핑하세요:

```lua
up(function(db)
    local _, err = db:execute("CREATE TABLE ...")
    if err then error(err) end
end)
```

## 러너 API

러너는 프로그래매틱 사용을 위한 라이브러리로 노출됩니다:

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

구성된 데이터베이스에 대해 대기 중인 모든 마이그레이션을 적용합니다. 요약을 반환합니다:

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

옵션:

| 옵션 | 설명 |
|--------|-------------|
| `tags` | 태그 배열; `meta.tags`가 교차하는 마이그레이션만 고려됩니다 |

### `runner:rollback(options)`

id(필수)로 단일 마이그레이션을 롤백합니다:

```lua
runner:rollback({ id = "app:01_create_users_table" })
```

### `runner:status(options)`

각각 `applied_at` 및 `meta.timestamp`로 정렬된 `{ applied = {...}, pending = {...} }`을 반환합니다.

## 레지스트리 API

`wippy.migration:registry`는 직접 레지스트리 쿼리를 제공합니다:

| 함수 | 설명 |
|----------|-------------|
| `registry.find({ target_db, tags })` | 기준과 일치하는 모든 마이그레이션 엔트리 반환 |
| `registry.get(id)` | id로 단일 마이그레이션 엔트리 반환 |
| `registry.get_target_dbs()` | 마이그레이션에 있는 모든 고유 `meta.target_db` 반환 |
| `registry.get_tags()` | 마이그레이션에 있는 모든 고유 태그 반환 |

부트로더는 시작 시 전체 대상 데이터베이스 세트를 탐색하기 위해 이들을 사용합니다.

## 마이그레이션 추적

러너는 첫 실행 시 각 대상 데이터베이스에 `wippy_migrations` 테이블을 생성합니다. 적용된 마이그레이션은 id로 기록되어 이후 실행에서 건너뜁니다. 추적 테이블은 자동으로 생성되므로, 이를 생성하기 위한 마이그레이션을 직접 작성하지 마세요.

## 모범 사례

- **마이그레이션당 하나의 논리적 변경** - 하나의 테이블 생성, 하나의 컬럼 추가, 하나의 인덱스 생성.
- **실제 `down` 작성** - 롤백이 불가능한 경우(데이터 손실), 이를 문서화하고 묵시적으로 성공하는 대신 오류를 발생시키세요.
- **멱등성 선호** - `CREATE TABLE IF NOT EXISTS` 및 `DROP TABLE IF EXISTS`는 특별한 처리 없이 재실행에서 살아남습니다.
- **DDL과 DML 분리** - 피할 수 있다면 테이블을 생성하는 동일한 마이그레이션에서 데이터를 시드하지 마세요.
- **양방향 테스트** - 마이그레이션을 적용하고, 롤백한 다음, 스키마가 시작 상태와 일치하는지 확인하세요.

## 참고 항목

- [SQL 드라이버](system/database.md) - 데이터베이스 리소스 구성
- [부트로더](framework/bootloader.md) - 부트로더 순서 지정 및 훅
- [프레임워크 개요](framework/overview.md) - 프레임워크 모듈 사용법
