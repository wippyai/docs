# 스토어 (키-값)

TTL 지원이 있는 키-값 스토어: 인메모리, SQL 기반, 클러스터 복제(Raft 및 CRDT).

## 엔트리 종류

| Kind | 설명 |
|------|-------------|
| `store.memory` | 자동 정리가 있는 인메모리 스토어 |
| `store.sql` | 지속성이 있는 SQL 기반 스토어 |
| `store.kv.raft` | 공유 Raft 기반의 클러스터 복제, 강한 일관성 KV |
| `store.kv.crdt` | gossip(CRDT) 기반의 클러스터 복제, 최종 일관성 KV |

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

## Cluster KV Stores {id=cluster-kv-stores}

`store.kv.raft`와 `store.kv.crdt`는 클러스터 노드 간에 키-값 데이터를 복제합니다. 둘 다 [클러스터링](guides/cluster.md)이 활성화되어 있어야 하며 동일한 [Store 모듈](lua/storage/store.md) Lua API를 재사용합니다. 각 엔트리는 노드 전체 엔진 하나에 대한 네임스페이스 뷰입니다. `namespace`는 이 엔트리의 키를 격리하며 `^[a-z][a-z0-9._-]*$`와 일치해야 합니다(`_`로 시작할 수 없음).

### Raft (강한 일관성)

```yaml
- name: deployments
  kind: store.kv.raft
  namespace: deploy
```

| 필드 | 타입 | 필수 | 설명 |
|-------|------|----------|-------------|
| `namespace` | string | 예 | 공유 엔진 내 키 네임스페이스 |

쓰기는 공유 Raft를 통해 제안되며(팔로워는 리더로 전달), 읽기는 선형화 가능합니다. 조건부 쓰기(`only_if_absent`/`if_version`과 함께하는 `put`)가 지원됩니다. Raft 상태는 기본적으로 `cluster.raft.data_dir`(기본값 `~/.wippy/store`) 아래에 fs-durable입니다. [구성](guides/configuration.md#cluster)을 참조하세요.

### CRDT (최종 일관성)

```yaml
- name: sessions
  kind: store.kv.crdt
  namespace: sess
  durable: false
```

| 필드 | 타입 | 필수 | 기본값 | 설명 |
|-------|------|----------|---------|-------------|
| `namespace` | string | 예 | - | 키 네임스페이스 |
| `durable` | bool | 아니오 | false | fs 스냅샷을 유지하여 전체 클러스터 재시작에도 네임스페이스가 보존되도록 함 |

쓰기는 로컬 상태를 변경하고 gossip을 통해 전파됩니다. 충돌하는 동시 쓰기는 last-writer-wins로 수렴합니다. 읽기는 로컬입니다. 조건부 쓰기는 지원되지 않습니다. `durable: false`이면 스토어는 인메모리이며 피어로부터 재구성됩니다. `durable: true`이면 `<data_dir>/_sys/kvcrdt`에 스냅샷을 기록합니다.

<note>
<code>data_dir</code>은 노드 레벨(<code>cluster.raft.data_dir</code>)이며 엔트리별이 아닙니다. 공유 Raft 상태와 durable CRDT 스냅샷은 <code>&lt;data_dir&gt;/_sys/</code> 아래에 위치합니다.
</note>

## TTL 동작

두 스토어 모두 TTL(Time-to-live)을 지원합니다. 만료된 항목은 `cleanup_interval`에서 정리가 실행될 때까지 잠시 유지됩니다. 자동 정리를 비활성화하려면 `0`으로 설정하세요.

## Lua API

작업은 [Store 모듈](lua/storage/store.md)을 참조하세요: `get`, `set`, `has`, `delete`, 그리고 버전 관리 및 조건부 접근을 위한 `put`, `entry`, `list`, `info`.

## 참고

- [Store 모듈](lua/storage/store.md) - Lua API 레퍼런스
- [데이터베이스](system/database.md) - `store.sql`의 SQL 백엔드
