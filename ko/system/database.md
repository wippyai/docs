---
title: "데이터베이스 시스템"
description: "SQL 데이터베이스 연결 풀링 및 설정. PostgreSQL, MySQL, SQLite를 지원합니다."
---

# 데이터베이스 시스템

Wippy는 PostgreSQL과 MySQL용 풀링 SQL 데이터베이스 엔트리와 단일 연결 SQLite 엔트리를 제공합니다.

이 페이지는 설정 레퍼런스입니다. 펜스에 `version`, `namespace`, `entries`가 모두
포함되지 않았다면 기존 엔트리 목록 안에 배치할 조각으로 취급하세요.

## 엔트리 종류

| 종류 | 설명 |
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
    password: ${env:app.secrets:db_password}
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
    file: "/var/data/cache.db"  # Use :memory: for in-memory
    pool:
      max_lifetime: "1h"
    lifecycle:
      auto_start: true
```

<note>
SQLite는 항상 단일 연결로 실행되며(<code>max_open</code>과 <code>max_idle</code>은
<code>1</code>로 강제됨) <code>WAL</code> 저널 모드를 사용합니다. <code>pool</code>에서는
<code>max_lifetime</code>만 적용됩니다.
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

| 필드 | 타입 | 설명 |
|-------|------|-------------|
| `file` | string | 데이터베이스 파일 경로 또는 `:memory:` |
| `pool` | object | `max_lifetime`만 적용됨(연결 수는 1로 고정) |
| `options` | map | 허용되지만 무시됨 |
| `lifecycle` | object | 라이프사이클 설정 |

### 시크릿과 환경 값

디코드 시점에 해석되는 `${env:NAME}` 플레이스홀더를 사용하여 [환경 레지스트리](system/env.md)에서
연결 값을 가져옵니다. `NAME`은 등록된 변수의 공개 이름이나 엔트리 ID(예:
`app.secrets:db_password`)이며 원시 OS 환경 변수가 아닙니다.

```yaml
- name: prod_db
  kind: db.sql.postgres
  host: ${env:DB_HOST}
  port: ${env:DB_PORT|5432}
  database: ${env:DB_NAME}
  username: ${env:DB_USER}
  password: ${env:app.secrets:db_password}
```

<note>
이전 설정은 같은 방식으로 해석되는 형제 <code>&lt;field&gt;_env</code> 지시자
(<code>host_env</code>, <code>port_env</code>, <code>database_env</code>,
<code>username_env</code>, <code>password_env</code>)를 사용합니다. 이 형식은
<b>더 이상 사용되지 않습니다</b>. 위에 표시된 <code>${env:NAME}</code>
플레이스홀더로 마이그레이션하세요.
</note>

<warning>
설정에 비밀번호를 직접 입력하지 마세요. 자격 증명에는 <code>env.variable</code>
엔트리를 사용하세요. 시크릿 설정은 <a href="./env.md">환경</a>을 참조하세요.
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
  max_open: 25      # Limit concurrent connections
  max_idle: 5       # Keep 5 connections ready
  max_lifetime: "30m"  # Recycle connections every 30 minutes
```

<tip>
<code>max_idle</code>을 <code>max_open</code> 이하로 설정하세요. <code>max_lifetime</code>을 초과하는 연결은 닫히고 교체되어 오래된 연결에서 복구하는 데 도움이 됩니다.
</tip>

## DSN 형식

각 데이터베이스 타입은 설정에서 DSN을 구성합니다. 모든 `options`는 키로 정렬되어
추가되며 기본적으로 포함되는 옵션은 없습니다.

### PostgreSQL {id="dsn-postgresql"}

```
host=host port=port user=username password=password dbname=database [option=value ...]
```

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
  connect_timeout: "10"   # Connection timeout in seconds
  application_name: "myapp"
```

### MySQL {id="options-mysql"}

```yaml
options:
  charset: "utf8mb4"
  parseTime: "true"       # Parse time values to time.Time
  loc: "Local"            # Timezone
```

### SQLite {id="options-sqlite"}

SQLite는 `options` 맵을 DSN에 적용하지 않습니다. 파일 데이터베이스는 항상
`mode=rwc`로 열리고 저널 모드는 항상 `WAL`로 설정됩니다. `options` 필드는
허용되지만 무시됩니다.

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
  # Primary database
  - name: users_db
    kind: db.sql.postgres
    host: ${env:USERS_DB_HOST}
    port: 5432
    database: "users"
    username: ${env:USERS_DB_USER}
    password: ${env:app.secrets:users_db_password}
    lifecycle:
      auto_start: true

  # Analytics database
  - name: analytics_db
    kind: db.sql.mysql
    host: ${env:ANALYTICS_DB_HOST}
    port: 3306
    database: "analytics"
    username: ${env:ANALYTICS_DB_USER}
    password: ${env:app.secrets:analytics_db_password}
    lifecycle:
      auto_start: true

  # Local cache
  - name: cache
    kind: db.sql.sqlite
    file: "/var/cache/app.db"
    lifecycle:
      auto_start: true
```

## 런타임 등록

[레지스트리 모듈](lua/core/registry.md)을 사용하여 런타임에 데이터베이스를 등록할 수 있습니다.

## Lua API

쿼리, 트랜잭션, 연결 작업은 [SQL 모듈](lua/storage/sql.md)을 참조하세요.

## 참고

- [SQL 모듈](lua/storage/sql.md) - Lua API 레퍼런스
- [Store](system/store.md) - `db.sql.*` 데이터베이스 기반 키-값 저장소
- [Queue](system/queue.md) - SQL 기반 큐 핸들러
