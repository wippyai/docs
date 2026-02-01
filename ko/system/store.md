# 스토어 (키-값)

TTL 지원이 있는 인메모리 및 SQL 기반 키-값 스토어.

## 엔트리 종류

| Kind | 설명 |
|------|-------------|
| `store.memory` | 자동 정리가 있는 인메모리 스토어 |
| `store.sql` | 지속성이 있는 SQL 기반 스토어 |

## 메모리 스토어

```yaml
- name: sessions
  kind: store.memory
  max_size: 10000
  cleanup_interval: "5m"
  lifecycle:
    auto_start: true
```

| 필드 | 타입 | 기본값 | 설명 |
|-------|------|---------|-------------|
| `max_size` | int | 10000 | 최대 항목 수 (0 = 무제한) |
| `cleanup_interval` | duration | 5m | 만료된 항목 정리 간격 |

`max_size`에 도달하면 새 항목이 거부됩니다. 재시작 시 데이터가 손실됩니다.

## SQL 스토어

```yaml
- name: cache
  kind: store.sql
  database: app:postgres
  table_name: kv_store
  cleanup_interval: "10m"
  lifecycle:
    auto_start: true
```

| 필드 | 타입 | 기본값 | 설명 |
|-------|------|---------|-------------|
| `database` | reference | 필수 | 데이터베이스 엔트리 참조 |
| `table_name` | string | 필수 | 스토리지용 테이블 이름 |
| `id_column_name` | string | key | 키용 컬럼 |
| `payload_column_name` | string | value | 값용 컬럼 |
| `expire_column_name` | string | expires_at | 만료용 컬럼 |
| `cleanup_interval` | duration | 0 | 만료된 항목 정리 간격 |

컬럼 이름은 SQL 인젝션에 대해 검증됩니다. 사용 전에 테이블을 생성하세요:

```sql
CREATE TABLE kv_store (
    key VARCHAR(255) PRIMARY KEY,
    value BYTEA NOT NULL,
    expires_at BIGINT
);

CREATE INDEX idx_expires_at ON kv_store(expires_at) WHERE expires_at IS NOT NULL;
```

## TTL 동작

두 스토어 모두 TTL(Time-to-live)을 지원합니다. 만료된 항목은 `cleanup_interval`에서 정리가 실행될 때까지 잠시 유지됩니다. 자동 정리를 비활성화하려면 `0`으로 설정하세요.

## Lua API

작업(get, set, delete, exists, clear)은 [Store 모듈](lua-store.md)을 참조하세요.
