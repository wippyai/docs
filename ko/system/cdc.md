---
title: "변경 데이터 캡처"
description: "db.cdc.postgres와 db.cdc.sqlite로 Postgres 논리 복제 또는 SQLite에서 행 수준 변경을 스트리밍합니다."
---

# 변경 데이터 캡처

데이터베이스에서 행 수준 변경을 스트리밍합니다. CDC 소스는 insert, update, delete를 캡처하고, 선택적으로 각 구독자에게 기존 행의 일관된 스냅샷을 먼저 넘겨준 다음, 모든 것을 드라이버 중립적인 변경 이벤트로 전달합니다. 소스는 항목 ID로 주소를 지정하며 Lua에서는 [`cdc` 모듈](lua/storage/cdc.md)로 소비합니다.

## 항목 kind

| Kind | 설명 |
|------|-------------|
| `db.cdc.postgres` | Postgres 논리 복제 (`pgoutput` 플러그인) |
| `db.cdc.sqlite` | `db.sql.sqlite` 리소스를 통해 관찰되는 SQLite 쓰기 |

두 kind 모두 동일한 Lua API, 동일한 소스 정보 레코드, 동일한 변경 이벤트 형태를 노출합니다. 다른 것은 보장 집합이며, 이는 소스마다 [기능](#capabilities)으로 게시됩니다.

## Postgres 구성

```yaml
- name: pg_cdc
  kind: db.cdc.postgres
  host: ${env:DB_HOST}
  port: 5432
  database: app
  username: ${env:DB_USER}
  password: ${env:app.secrets:db_password}
  slot_name: wippy_slot
  publication: wippy_pub
  tables:
    - public.users
    - public.orders
  snapshot: true
  streaming: true
  standby_interval: "10s"
  status_interval: "10s"
  lifecycle:
    auto_start: true
```

| 필드 | 타입 | 기본값 | 설명 |
|-------|------|---------|-------------|
| `host` | string | 필수 | Postgres 호스트 |
| `port` | int | 필수 | Postgres 포트 (0보다 커야 함) |
| `database` | string | 필수 | 데이터베이스 이름 |
| `username` | string | 필수 | 복제 사용자 (`REPLICATION` 권한 필요) |
| `password` | string | 필수 | 비밀번호 (인라인 또는 `${env:NAME}`) |
| `slot_name` | string | 필수 | 논리 복제 슬롯 이름 |
| `publication` | string | - | Postgres publication, `tables`가 비어 있으면 필수 |
| `tables` | []string | - | 캡처할 테이블 (`schema.table`), 생략하면 publication의 테이블 사용 |
| `snapshot` | bool | false | 구독자별 스냅샷 인계에 대한 항목 기본값 |
| `streaming` | bool | false | 스트리밍 `pgoutput` 프로토콜 버전 사용 |
| `temporary` | bool | false | 임시 복제 슬롯 사용 (연결 해제 시 제거됨) |
| `failover` | bool | false | 페일오버 슬롯 모드 활성화 (`temporary`와 상호 배타적) |
| `standby_interval` | duration | - | 스탠바이 상태 메시지 간격 (예: `10s`) |
| `status_interval` | duration | - | 서버로의 상태 업데이트 간격 |
| `snapshot_fetch_size` | int | - | 스냅샷 배치당 가져오는 행 수 (0 이상이어야 함) |
| `max_transaction_changes` | int | 1000000 | 트랜잭션 하나를 디코딩하는 동안 버퍼링하는 최대 변경 수 |
| `max_transaction_bytes` | int | 268435456 | 트랜잭션 하나를 디코딩하는 동안 버퍼링하는 최대 논리 바이트 (256 MiB) |
| `max_inflight_changes` | int | 1000000 | 진행 중인 모든 트랜잭션에 걸쳐 보유하는 최대 변경 수 |
| `max_inflight_bytes` | int | 268435456 | 진행 중인 모든 트랜잭션에 걸쳐 보유하는 최대 논리 바이트 (256 MiB) |
| `subscriptions` | object | - | 구독 승인 한도, [구독 한도](#subscription-limits) 참조 |
| `options` | map | - | 추가 커넥션 옵션 |
| `lifecycle` | object | - | 라이프사이클 구성 |

`max_*` 필드에 0을 주면 기본값이 선택됩니다. 디코더는 결코 무제한이 아닙니다. 음수 값은 거부됩니다.

자격 증명의 `${env:NAME}` 자리표시자는 디코드 시점에 [환경 레지스트리](system/env.md)를 통해 해석됩니다.

## SQLite 구성

SQLite 소스는 자체 데이터베이스를 열지 않습니다. 기존 [`db.sql.sqlite`](system/database.md) 리소스를 빌려 그 리소스의 커밋된 변경 관찰자를 구독하므로, 정확히 그 Wippy SQL 리소스를 통해 이루어진 쓰기만 캡처합니다. 다른 프로세스, 다른 커넥션, 외부 도구의 쓰기는 관찰되지 않습니다.

```yaml
- name: cdcdb
  kind: db.sql.sqlite
  file: /var/data/app.db
  lifecycle:
    auto_start: true

- name: changes
  kind: db.cdc.sqlite
  db_resource: app:cdcdb
  tables:
    - users
    - orders
  snapshot: true
  status_interval: "30s"
  lifecycle:
    auto_start: true
```

| 필드 | 타입 | 기본값 | 설명 |
|-------|------|---------|-------------|
| `db_resource` | string | 필수 | 관찰할 `db.sql.sqlite` 리소스의 항목 ID |
| `name` | string | - | 허용되지만, 소스 이름은 항상 항목 ID입니다 |
| `tables` | []string | - | 캡처할 테이블, 모든 테이블을 원하면 생략 |
| `snapshot` | bool | false | 구독자별 스냅샷 인계에 대한 항목 기본값 |
| `status_interval` | duration | `30s` | 상태 업데이트 간격 |
| `subscriptions` | object | - | 구독 승인 한도, [구독 한도](#subscription-limits) 참조 |
| `lifecycle` | object | - | 라이프사이클 구성 |

소스는 SQL 리소스를 라이프사이클 요구사항으로 선언하므로, 슈퍼바이저가 데이터베이스를 먼저 시작하고 데이터베이스 세대가 교체되면 소스를 재시작합니다.

<note>
SQLite 캡처에는 <code>sqlite_preupdate_hook</code> 빌드 태그로 빌드된 런타임이 필요합니다. 공식 빌드에는 포함되어 있습니다. 태그가 없으면 드라이버는 실패 시 차단됩니다. <code>db.cdc.sqlite</code> 항목을 생성하면 아무것도 캡처하지 못하는 소스를 시작하는 대신 <code>sqlite cdc requires the sqlite_preupdate_hook build tag</code>를 반환합니다.
</note>

## 구독 한도

각 소스는 제한된 수의 구독자를 승인하고 그들의 최악의 경우 백로그를 미리 예약합니다. 스냅샷 슬롯은 스냅샷이 활성화된 스트림이 닫힐 때까지 예약된 상태로 유지됩니다.

```yaml
subscriptions:
  max_subscriptions: 1024
  max_snapshot_subscriptions: 4
  max_bytes: 268435456
```

| 필드 | 타입 | 기본값 | 설명 |
|-------|------|---------|-------------|
| `max_subscriptions` | int | 1024 | 소스가 승인하는 동시 구독 수 |
| `max_snapshot_subscriptions` | int | 4 | 스냅샷이 활성화된 동시 구독 수 |
| `max_bytes` | int | 268435456 | 예약되는 전체 구독자 백로그 바이트 (256 MiB) |

0을 주면 기본값이 선택되고, 음수 값은 거부됩니다. 한도를 소진하면 재시도 가능한 `errors.UNAVAILABLE`로 구독이 실패합니다.

## 동작 방식

1. Postgres 소스는 복제 사용자로 연결해 `slot_name`이 지정한 슬롯을 생성(또는 재개)합니다. SQLite 소스는 `db_resource`를 빌려 그 리소스의 커밋된 변경 관찰자를 구독합니다.
2. 행 변경은 `op`가 `insert`, `update`, `delete` 또는 `truncate`인 드라이버 중립적 변경 이벤트로 디코딩됩니다.
3. 스트림에 `snapshot`이 활성화된 구독자는 — 항목의 `snapshot` 필드에서든 스트림의 `opts.snapshot`에서든 — 기존 행을 `op = "snapshot"` 이벤트로 먼저 수신한 다음, 둘 사이에 빈틈 없이 라이브 변경으로 이어집니다.
4. Postgres 소스는 서버가 WAL 세그먼트를 해제할 수 있도록 주기적으로 LSN을 확인 응답합니다(`standby_interval`).
5. 소스는 자신의 항목 ID로 등록되며, Lua 코드는 [`cdc.stream`](lua/storage/cdc.md)으로 구독합니다.

## 기능

모든 소스는 자신이 보장하는 바를 게시하므로, 소비자는 항목 kind가 아니라 기능으로 분기합니다.

| 기능 | `db.cdc.postgres` | `db.cdc.sqlite` | 의미 |
|------------|:-----------------:|:---------------:|---------|
| `snapshot` | 예 | 예 | 원자적 스냅샷/라이브 인계를 지원 |
| `capture_resume` | 예, `temporary`가 아닌 경우 | 아니오 | 소스 진행 상태가 재연결을 넘어 유지됨 |
| `replayable` | 아니오 | 아니오 | 개별 구독자가 과거 이벤트를 재생할 수 있음 |
| `captures_external_writes` | 예 | 아니오 | 이 런타임 밖에서 이루어진 쓰기를 캡처 |
| `before_images` | 아니오 | 예 | 변경 이전 행 이미지를 전달 |
| `coalesced` | 아니오 | 예 | 트랜잭션 내에서 한 행에 반복된 쓰기가 병합되어 도착할 수 있음 |

기능 플래그는 소스 진행 상태를 설명하는 것이지 내구성 있는 전달을 뜻하지 않습니다. 어떤 드라이버도 뒤처지거나 연결이 끊긴 개별 구독자를 위해 이벤트를 재생하지 않습니다.

## 소스 정보

각 소스는 `cdc.source`와 `cdc.list_sources`가 반환하는 정보 레코드로 기술됩니다.

| 필드 | 타입 | 설명 |
|-------|------|-------------|
| `id` | string | 항목 ID |
| `kind` | string | `db.cdc.postgres` 또는 `db.cdc.sqlite` |
| `name` | string | 소스 이름 (항목 ID) |
| `state` | string | `unknown`, `starting`, `running`, `faulted` 또는 `stopped` |
| `generation` | string | 현재 소스 세대, 소스가 교체되면 변경됨 |
| `epoch` | string | `generation`과 동일한 값 |
| `engine` | string | 엔진 이름 (`sqlite`) |
| `db_resource` | string | 관찰 대상 SQL 리소스 항목 ID (`db.cdc.sqlite`) |
| `slot` | string | 복제 슬롯 이름 (`db.cdc.postgres`) |
| `publication` | string | 구성된 경우 Postgres publication |
| `tables` | []string | 구성된 경우 캡처 대상 테이블 |
| `streaming` | bool | 소스가 현재 실행 중인지 여부 |
| `failover` | bool | 페일오버 슬롯 모드 (`db.cdc.postgres`) |
| `temporary` | bool | 임시 슬롯 (`db.cdc.postgres`) |
| `snapshot` | bool | 항목 수준 스냅샷 기본값 |
| `faulted` | bool | 소스가 `faulted` 상태인지 여부 |
| `error` | string | 기록된 경우 마지막 소스 오류 |
| `admission` | object | `active`, `snapshots`, `reserved_bytes`, `rejected` |
| `capabilities` | object | [기능](#capabilities) 참조 |

`admission`은 큐가 얼마나 찼는지가 아니라 예약 수를 셉니다. `active`는 승인된 구독 수, `snapshots`는 스냅샷이 활성화된 부분집합, `reserved_bytes`는 예약된 백로그 예산, `rejected`는 한도로 인해 거부된 누적 구독 수입니다.

## 권한

| 작업 | 리소스 | 설명 |
|--------|----------|-------------|
| `cdc.source` | 소스 항목 ID | 소스 정보 읽기, `cdc.list_sources`도 필터링 |
| `cdc.subscribe` | 소스 항목 ID | 변경 스트림 열기 |

CDC 권한은 데이터베이스 접근과 별개입니다. 소스는 변경 이전 이미지를 포함해 캡처된 모든 행을 노출할 수 있습니다. 스트림 필터는 전달 범위를 좁힐 뿐이며, 소스에 대한 접근을 부여하지 않습니다.

```yaml
- name: cdc_reader
  kind: security.policy
  policy:
    effect: allow
    actions: [cdc.source, cdc.subscribe]
    resources: [app:changes]
```

## 참고

- [CDC 모듈](lua/storage/cdc.md) - Lua 스트리밍 API
- [데이터베이스](system/database.md) - SQL 데이터베이스 서비스
- [환경](system/env.md) - `${env:NAME}`으로 자격 증명 해석
- [보안](system/security.md) - 정책과 작업
