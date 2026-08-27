---
title: "스토어 (키-값)"
description: "TTL 지원이 있는 키-값 스토어: 인메모리, SQL 기반, 클러스터 복제(Raft 및 CRDT)."
---

# 스토어 (키-값)

Wippy는 memory, SQL, Raft 또는 CRDT 기반의 TTL-aware key-value store를 제공합니다.

이 페이지는 entry-configuration 레퍼런스입니다. YAML fence는 기존 entry list용 fragment이며 SQL fence는 `store.sql` 엔트리가 시작되기 전에 실행해야 하는 schema setup입니다.

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
| `max_size` | int | 10000 | 최대 엔트리 수; 0은 기본값(10000)으로 교체됨 |
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

column name은 SQL injection에 대해 검증됩니다. 다음 prerequisite는 PostgreSQL DDL입니다. MySQL 또는 SQLite에는 동등한 binary/blob 및 timestamp type을 사용하십시오.

```sql
CREATE TABLE kv_store (
    key VARCHAR(255) PRIMARY KEY,
    value BYTEA NOT NULL,
    expires_at TIMESTAMPTZ NULL
);

CREATE INDEX idx_expires_at ON kv_store(expires_at) WHERE expires_at IS NOT NULL;
```

## Cluster KV Stores

`store.kv.raft`와 `store.kv.crdt`는 cluster node 간에 key-value data를 복제합니다. 둘 다 [clustering](../guides/cluster.md)이 활성화되어야 하며 같은 [Store 모듈](../lua/storage/store.md) Lua API를 재사용합니다. 각 엔트리는 node-wide engine 하나의 namespaced view입니다. `namespace`는 이 엔트리의 key를 격리하며 `^[a-z][a-z0-9._-]*$`와 일치해야 합니다(`_`로 시작할 수 없음).

### Raft (강한 일관성)

```yaml
- name: deployments
  kind: store.kv.raft
  namespace: deploy
```

| 필드 | 타입 | 필수 | 설명 |
|-------|------|----------|-------------|
| `namespace` | string | 예 | 공유 엔진 내 키 네임스페이스 |

write는 shared Raft를 통해 propose되고 follower는 leader로 전달합니다. read는 linearizable합니다. conditional write(`only_if_absent`/`if_version`을 사용한 `put`)를 지원합니다. Raft state는 기본적으로 `cluster.raft.data_dir`(기본값 `~/.wippy/store`) 아래에 fs-durable입니다. [설정](../guides/configuration.md#cluster)을 참조하십시오.

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

네 store kind 모두 TTL 값을 받지만 expiry visibility는 backend마다 다릅니다.

- `store.memory`는 read에서 expired key를 missing으로 취급하고 기본값 `5m`인 `cleanup_interval`에서 expired entry를 제거합니다. 설정된 zero value는 기본값으로 교체됩니다.
- `store.sql`은 read에서 expired row를 filter하고 `cleanup_interval`에서 제거합니다. 기본값 `0`은 background cleanup을 비활성화하지만 expired row를 readable하게 만들지는 않습니다.
- `store.kv.raft`는 expiring key를 leader-driven lease에 연결합니다. 약 1초의 lease sweep이 Raft를 통해 deletion을 propose하므로 consensus-applied removal이 반영될 때까지 key가 readable할 수 있습니다.
- `store.kv.crdt`도 약 1초의 lease sweep에서 expired key를 제거한 뒤 tombstone을 gossip합니다. lease deadline은 write를 수락한 node에 local입니다. origin이 expiry 전에 실패하면 다른 node가 deadline을 독립적으로 재현하지 않으므로 이후 state 또는 administrative cleanup이 제거할 때까지 key가 남을 수 있습니다.

## Lua API

작업은 [Store 모듈](../lua/storage/store.md)을 참조하십시오: `get`, `set`, `has`, `delete`, 그리고 versioned 및 conditional access를 위한 `put`, `entry`, `list`, `info`.

## 참고

- [Store 모듈](../lua/storage/store.md) - Lua API 레퍼런스
- [데이터베이스](./database.md) - `store.sql`의 SQL backing
