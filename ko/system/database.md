# 데이터베이스 시스템

SQL 데이터베이스 연결 풀링 및 설정. PostgreSQL, MySQL, SQLite, Microsoft SQL Server, Oracle을 지원합니다.

## 엔트리 종류

| Kind | 설명 |
|------|-------------|
| `db.sql.postgres` | PostgreSQL 데이터베이스 |
| `db.sql.mysql` | MySQL 데이터베이스 |
| `db.sql.sqlite` | SQLite 데이터베이스 |
| `db.sql.mssql` | Microsoft SQL Server |
| `db.sql.oracle` | Oracle 데이터베이스 |

## 설정

### 표준 데이터베이스 (PostgreSQL, MySQL, MSSQL, Oracle)

```yaml
# src/data/_index.yaml
version: "1.0"
namespace: app.data

entries:
  - name: main_db
    kind: db.sql.postgres
    host: "localhost"
    port: 5432
    database: "myapp"
    username: "dbuser"
    password: "dbpass"
    pool:
      max_open: 25
      max_idle: 5
      max_lifetime: "1h"
    options:
      sslmode: "disable"
    lifecycle:
      auto_start: true
```

### SQLite

```yaml
  - name: cache_db
    kind: db.sql.sqlite
    file: "/var/data/cache.db"  # 인메모리는 :memory: 사용
    pool:
      max_open: 1
      max_idle: 1
      max_lifetime: "1h"
    options:
      cache: "shared"
    lifecycle:
      auto_start: true
```

## 연결 필드

### 표준 데이터베이스 필드

| 필드 | 타입 | 설명 |
|-------|------|-------------|
| `host` | string | 데이터베이스 호스트 주소 |
| `port` | int | 데이터베이스 포트 번호 |
| `database` | string | 데이터베이스 이름 |
| `username` | string | 데이터베이스 사용자 |
| `password` | string | 데이터베이스 비밀번호 |
| `pool` | object | 연결 풀 설정 |
| `options` | map | 데이터베이스별 옵션 |
| `lifecycle` | object | 라이프사이클 설정 |

### SQLite 필드

| 필드 | 타입 | 설명 |
|-------|------|-------------|
| `file` | string | 데이터베이스 파일 경로 또는 `:memory:` |
| `pool` | object | 연결 풀 설정 |
| `options` | map | SQLite별 옵션 |
| `lifecycle` | object | 라이프사이클 설정 |

### 환경 변수 필드

`_env` 접미사를 사용하여 환경 변수나 [env.variable](system/env.md) 엔트리에서 값을 로드:

| 필드 | 설명 |
|-------|-------------|
| `host_env` | 환경 변수에서 호스트 |
| `port_env` | 환경 변수에서 포트 |
| `database_env` | 환경에서 데이터베이스 이름 |
| `username_env` | 환경에서 사용자명 |
| `password_env` | 환경에서 비밀번호 |

```yaml
- name: prod_db
  kind: db.sql.postgres
  host_env: "DB_HOST"
  port_env: "DB_PORT"
  database_env: "DB_NAME"
  username_env: "DB_USER"
  password_env: "app.secrets:db_password"  # env.variable 엔트리 참조
```

<warning>
설정에 비밀번호를 직접 입력하지 마세요. 자격 증명에는 환경 변수나 <code>env.variable</code> 엔트리를 사용하세요. 안전한 시크릿 관리는 <a href="system/env.md">환경</a>을 참조하세요.
</warning>

## 연결 풀

연결 풀링 동작 설정. 풀 설정은 Go의 [database/sql 연결 풀](https://pkg.go.dev/database/sql#DB.SetMaxOpenConns)에 매핑됩니다.

| 필드 | 타입 | 기본값 | 설명 |
|-------|------|---------|-------------|
| `max_open` | int | 0 | 최대 열린 연결 (0 = 무제한) |
| `max_idle` | int | 0 | 최대 유휴 연결 (0 = 무제한) |
| `max_lifetime` | duration | 1h | 최대 연결 수명 |

```yaml
pool:
  max_open: 25      # 동시 연결 제한
  max_idle: 5       # 5개 연결 준비 상태 유지
  max_lifetime: "30m"  # 30분마다 연결 재활용
```

<tip>
<code>max_idle</code>을 <code>max_open</code> 이하로 설정하세요. <code>max_lifetime</code>을 초과하는 연결은 닫히고 교체되어 오래된 연결에서 복구하는 데 도움이 됩니다.
</tip>

## DSN 형식

각 데이터베이스 타입은 설정에서 DSN을 구성합니다:

### PostgreSQL {id="dsn-postgresql"}

```
postgres://username:password@host:port/database?sslmode=disable
```

### MySQL {id="dsn-mysql"}

```
username:password@tcp(host:port)/database?charset=utf8mb4
```

### SQLite {id="dsn-sqlite"}

```
file:/path/to/database.db?cache=shared
:memory:?mode=memory
```

### Microsoft SQL Server {id="dsn-mssql"}

```
sqlserver://username:password@host:port?database=dbname
```

### Oracle {id="dsn-oracle"}

```
oracle://username:password@host:port/service_name
```

## 데이터베이스 옵션

일반적인 데이터베이스별 옵션:

### PostgreSQL {id="options-postgresql"}

```yaml
options:
  sslmode: "require"      # disable, require, verify-ca, verify-full
  connect_timeout: "10"   # 연결 타임아웃(초)
  application_name: "myapp"
```

### MySQL {id="options-mysql"}

```yaml
options:
  charset: "utf8mb4"
  parseTime: "true"       # 시간 값을 time.Time으로 파싱
  loc: "Local"            # 시간대
```

### SQLite {id="options-sqlite"}

```yaml
options:
  cache: "shared"         # shared, private
  mode: "rwc"            # ro, rw, rwc, memory
  _journal_mode: "WAL"   # DELETE, TRUNCATE, PERSIST, MEMORY, WAL, OFF
```

### Microsoft SQL Server {id="options-mssql"}

```yaml
options:
  encrypt: "true"
  TrustServerCertificate: "false"
```

### Oracle {id="options-oracle"}

```yaml
options:
  poolMinSessions: "1"
  poolMaxSessions: "10"
  poolIncrement: "1"
```

## Lua API

데이터베이스 작업 API는 [SQL 모듈](lua/storage/sql.md)을 참조하세요.
