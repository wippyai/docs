---
title: "데이터베이스 시스템"
description: "SQL 데이터베이스 연결 풀링 및 설정. PostgreSQL, MySQL, SQLite를 지원합니다."
---

# 데이터베이스 시스템

SQL 데이터베이스 연결 풀링 및 설정. PostgreSQL, MySQL, SQLite를 지원합니다.

## 엔트리 종류

| Kind | 설명 |
|------|-------------|
| `db.sql.postgres` | PostgreSQL 데이터베이스 |
| `db.sql.mysql` | MySQL 데이터베이스 |
| `db.sql.sqlite` | SQLite 데이터베이스 |

## 설정

### 표준 데이터베이스 (PostgreSQL, MySQL)

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
      max_open: 4
      max_idle: 2
      max_lifetime: "1h"
    lifecycle:
      auto_start: true
```

<note>
비공개 인메모리 SQLite 데이터베이스(<code>file: ":memory:"</code>)는 하나의 물리적 연결로 범위가 한정되므로 <code>max_open</code>과 <code>max_idle</code>이 <code>1</code>로 강제됩니다. 파일 기반 데이터베이스는 설정된 <code>pool</code> 값을 따르며, CDC 스냅샷 읽기 트랜잭션이 유일한 쓰기 연결을 점유하지 않으려면 이 설정이 필요합니다. 저널 모드는 항상 <code>WAL</code>입니다.
</note>

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

| 필드 | 타입 | 기본값 | 설명 |
|-------|------|---------|-------------|
| `file` | string | 필수 | 데이터베이스 파일 경로 또는 `:memory:` |
| `pool` | object | - | 연결 풀 설정; `:memory:`에서는 `max_open`과 `max_idle`이 `1`로 강제됨 |
| `max_mutation_changes` | int | 100000 | 커밋된 변경 관찰자에서 한 트랜잭션이 보유할 수 있는 행 수 |
| `max_mutation_bytes` | int | 67108864 | 관찰자에서 한 트랜잭션이 보유할 수 있는 논리 바이트 수 (64 MiB) |
| `options` | map | - | 허용되지만 무시됨 |
| `lifecycle` | object | - | 라이프사이클 설정 |

`max_mutation_changes`와 `max_mutation_bytes`는 [`db.cdc.sqlite`](system/cdc.md) 소스에 데이터를 공급하는 인메모리 커밋 변경 관찰자의 한계를 정합니다. 두 필드 중 하나가 0이면 기본값이 선택되고, 음수 값은 거부됩니다. 이 한계는 정확하기보다 보수적입니다: SQLite는 pre-update 훅에 완전한 행을 전달하므로, 한계가 후보를 거부하기 전에 행 하나가 구체화될 수 있습니다.

### 시크릿 및 환경 값

`${env:NAME}` 플레이스홀더로 [환경 레지스트리](system/env.md)에서 연결 값을 가져오며, 디코드 시점에 해석됩니다. `NAME`은 등록된 변수의 공개 이름 또는 엔트리 ID(예: `app.secrets:db_password`)이며, 원시 OS 환경 변수가 아닙니다.

```yaml
- name: prod_db
  kind: db.sql.postgres
  host: ${env:DB_HOST}
  port: ${env:DB_PORT}
  database: ${env:DB_NAME}
  username: ${env:DB_USER}
  password: ${env:app.secrets:db_password}
```

<note>
이전 설정은 형제 <code>&lt;field&gt;_env</code> 디렉티브(<code>host_env</code>, <code>port_env</code>, <code>database_env</code>, <code>username_env</code>, <code>password_env</code>)를 사용하며 동일하게 해석됩니다. 이 형식은 <b>더 이상 권장되지 않습니다</b> — 위에 제시된 <code>${env:NAME}</code> 플레이스홀더로 이전하세요.
</note>

<warning>
설정에 비밀번호를 직접 입력하지 마세요. 자격 증명에는 <code>env.variable</code> 엔트리를 사용하세요. 안전한 시크릿 관리는 <a href="system/env.md">환경</a>을 참조하세요.
</warning>

## 연결 풀

연결 풀링 동작 설정. 풀 설정은 Go의 [database/sql 연결 풀](https://pkg.go.dev/database/sql#DB.SetMaxOpenConns)에 매핑됩니다.

| 필드 | 타입 | 기본값 | 설명 |
|-------|------|---------|-------------|
| `max_open` | int | 0 | 최대 열린 연결 (0 = 무제한) |
| `max_idle` | int | 0 | 최대 유휴 연결 (0 = 유휴 연결을 유지하지 않음) |
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

각 데이터베이스 타입은 설정에서 DSN을 구성합니다. `options`가 있으면 키 순으로 정렬되어 뒤에 붙으며, 기본으로 포함되는 옵션은 없습니다.

### PostgreSQL {id="dsn-postgresql"}

```
host='host' port=port user='username' password='password' dbname='database' [option='value' ...]
```

포트를 제외한 모든 값은 작은따옴표로 묶이고, 내부의 `'`와 `\`는 백슬래시로 이스케이프되므로, 공백이나 따옴표를 포함한 호스트, 비밀번호, 옵션 값이 그대로 전달됩니다.

### MySQL {id="dsn-mysql"}

```
username:password@tcp(host:port)/database[?option=value&...]
```

### SQLite {id="dsn-sqlite"}

```
file:/path/to/database.db?mode=rwc
:memory:
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

SQLite는 `options` 맵을 DSN에 적용하지 않습니다. 파일 데이터베이스는 항상 `mode=rwc`로 열리며 저널 모드는 항상 `WAL`로 설정됩니다. `options` 필드는 허용되지만 무시됩니다.

## 예제

### SSL을 사용하는 PostgreSQL

```yaml
- name: secure_postgres
  kind: db.sql.postgres
  host: "db.example.com"
  port: 5432
  database: "production"
  username: "app_user"
  password: ${env:app.secrets:db_password}
  pool:
    max_open: 50
    max_idle: 10
    max_lifetime: "1h"
  options:
    sslmode: "verify-full"
    sslcert: "/certs/client.crt"
    sslkey: "/certs/client.key"
    sslrootcert: "/certs/ca.crt"
  lifecycle:
    auto_start: true
```

### MySQL 읽기 전용 복제본

```yaml
- name: mysql_replica
  kind: db.sql.mysql
  host: "replica.db.example.com"
  port: 3306
  database: "app"
  username: "readonly"
  password: ${env:app.secrets:replica_password}
  pool:
    max_open: 20
    max_idle: 5
    max_lifetime: "30m"
  options:
    charset: "utf8mb4"
    parseTime: "true"
    readTimeout: "30s"
```

### SQLite 인메모리

```yaml
- name: test_db
  kind: db.sql.sqlite
  file: ":memory:"
```

### 여러 데이터베이스 구성

```yaml
entries:
  # 기본 데이터베이스
  - name: users_db
    kind: db.sql.postgres
    host: ${env:USERS_DB_HOST}
    port: 5432
    database: "users"
    username: ${env:USERS_DB_USER}
    password: ${env:app.secrets:users_db_password}
    lifecycle:
      auto_start: true

  # 분석 데이터베이스
  - name: analytics_db
    kind: db.sql.mysql
    host: ${env:ANALYTICS_DB_HOST}
    port: 3306
    database: "analytics"
    username: ${env:ANALYTICS_DB_USER}
    password: ${env:app.secrets:analytics_db_password}
    lifecycle:
      auto_start: true

  # 로컬 캐시
  - name: cache
    kind: db.sql.sqlite
    file: "/var/cache/app.db"
    lifecycle:
      auto_start: true
```

## 런타임 등록

[레지스트리 모듈](lua/core/registry.md)을 사용하여 런타임에 데이터베이스를 등록할 수 있으며, 애플리케이션 상태나 외부 설정에 따라 동적으로 데이터베이스를 구성할 수 있습니다.

## Lua API

데이터베이스 작업 API는 [SQL 모듈](lua/storage/sql.md)을 참조하세요.

## 참고

- [SQL 모듈](lua/storage/sql.md) - Lua API 레퍼런스
- [Store](system/store.md) - `db.sql.*` 데이터베이스 기반의 키-값 저장소
- [Queue](system/queue.md) - SQL 기반 큐 핸들러
- [변경 데이터 캡처](system/cdc.md) - `db.sql.sqlite` 또는 Postgres 데이터베이스에서 행 수준 변경 스트리밍
