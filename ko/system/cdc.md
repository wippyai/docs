---
title: "Change Data Capture"
description: "db.cdc.postgres를 사용하여 Postgres 논리 복제의 row-level 변경을 스트리밍합니다."
---

# Change Data Capture

`db.cdc.postgres` source는 `pgoutput` plugin을 통해 Postgres 논리 복제의 row-level 변경을 스트리밍합니다. replication slot을 생성하고 기존 row를 snapshot한 다음 insert, update, delete 변경을 내보낼 수 있습니다. 이 페이지는 설정 참조입니다. 예제는 기존 데이터베이스, publication 또는 table 집합, replication credential, 환경 값이 있다고 가정합니다. source는 엔트리 ID로 지정하며 Lua에서는 [`cdc` 모듈](../lua/storage/cdc.md)로 사용합니다.

## 설정

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

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `host` | string | required | Postgres host |
| `port` | int | required | Postgres port(0보다 커야 함) |
| `database` | string | required | 데이터베이스 이름 |
| `username` | string | required | replication 사용자(`REPLICATION` 권한 필요) |
| `password` | string | required | password(inline 또는 `${env:NAME}`) |
| `slot_name` | string | required | 논리 replication slot 이름 |
| `publication` | string | - | Postgres publication. `tables`가 비어 있으면 필수 |
| `tables` | []string | - | capture할 table(`schema.table`). publication의 table을 사용하려면 생략 |
| `snapshot` | bool | false | streaming 전에 기존 row를 초기 snapshot으로 내보냄 |
| `streaming` | bool | false | snapshot 이후 진행되는 변경을 스트리밍 |
| `temporary` | bool | false | 연결 해제 시 제거되는 임시 replication slot 사용 |
| `failover` | bool | false | failover slot mode 활성화(`temporary`와 함께 사용할 수 없음) |
| `standby_interval` | duration | `10s` | standby status message 간격 |
| `status_interval` | duration | `30s` | retained-WAL 및 replication-lag metric sampling 간격 |
| `snapshot_fetch_size` | int | `1000` | snapshot batch당 가져올 row 수. `0`은 기본값 사용 |
| `options` | map | - | 추가 connection option |
| `lifecycle` | object | - | lifecycle 설정 |

credential은 decode 시점에 [환경 레지스트리](./env.md)를 통해 `${env:NAME}` placeholder를 resolve합니다.

## 동작 방식

1. source가 replication 사용자로 Postgres에 연결하고 `slot_name`으로 지정한 replication slot을 생성하거나 재개합니다.
2. `snapshot`이 설정되면 구성한 table의 기존 row를 `op = "r"`(read)인 change event로 먼저 내보냅니다.
3. `streaming`이 설정되면 진행 중인 row 변경(`insert`, `update`, `delete`, `truncate`)을 `pgoutput` plugin을 통해 WAL에서 스트리밍합니다.
4. standby status loop가 주기적으로 LSN을 acknowledge하여 Postgres가 WAL segment를 보관하게 합니다(`standby_interval`).
5. source는 엔트리 ID로 등록되며 Lua 코드는 [`cdc.stream`](../lua/storage/cdc.md)으로 subscribe합니다.

## Source 정보

각 source는 다음 info record로 설명됩니다.

| Field | Description |
|-------|-------------|
| `name` | source 이름(엔트리 ID) |
| `slot` | replication slot 이름 |
| `publication` | Postgres publication(있는 경우) |
| `tables` | capture하는 table(설정한 경우) |
| `streaming` | streaming 활성화 여부 |
| `failover` | failover mode 활성화 여부 |
| `temporary` | 임시 slot 여부 |
| `snapshot` | snapshot 활성화 여부 |

## 관련 문서

- [CDC 모듈](../lua/storage/cdc.md) - Lua streaming API
- [데이터베이스](./database.md) - SQL 데이터베이스 서비스
- [환경](./env.md) - `${env:NAME}`을 통한 credential resolve
