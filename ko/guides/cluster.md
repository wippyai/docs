---
title: "클러스터"
description: "가십 멤버십, 제한된 Raft 합의, 프로세스 이름, 분산 잠금, 프로세스 그룹을 위한 Wippy 노드를 구성합니다."
---

# 클러스터

Wippy는 기본적으로 단일 노드로 실행됩니다. 클러스터링을 활성화하면 가십 멤버십과 제한된 Raft 합의 코어로 노드를 연결하여 클러스터 전체 프로세스 이름, 분산 잠금, 프로세스 그룹 메시징을 지원합니다.

`cluster.enabled`를 `true`로 설정하기 전까지 클러스터링은 비활성화됩니다.

## 클러스터 기능

- **멤버십** — 빠른 실패 감지를 사용하는 가십을 통해 모든 노드가 살아 있는 피어 집합을 압니다.
- **클러스터 전체 프로세스 이름** — 일관성 보장을 선택하여 어느 노드에서든 해석되는 이름으로 프로세스를 등록합니다. [이름 지정](#이름-지정과-이름-범위)을 참조하세요.
- **분산 잠금** — `system.lock`은 보유자가 죽으면 자동 해제되는 클러스터 전체 상호 배제를 제공합니다. [분산 잠금](#분산-잠금)을 참조하세요.
- **프로세스 그룹** — 모든 노드에 걸쳐 이름 있는 그룹의 모든 멤버에게 게시합니다. [프로세스 그룹](#프로세스-그룹)을 참조하세요.
- **복제 키-값 저장소** — `store.kv.raft`(강한 일관성)와 `store.kv.crdt`(최종 일관성)가 노드 간 KV 데이터를 복제합니다. [저장소](../system/store.md#cluster-kv-stores)를 참조하세요.
- **합의 코어** — 작고 제한된 Raft 클러스터가 이름 및 잠금 기본 요소의 선형화 가능한 기반을 제공합니다.

## 아키텍처: 제한된 Raft

Wippy는 리더가 모든 로그 엔트리를 모든 노드로 복제하지 않도록 Raft 멤버십을 고정 크기 코어로 제한합니다. 나머지 노드는 가십에 참여합니다. 각 노드는 Raft 구성에서 세 역할 중 하나를 가집니다.

| 역할 | 수(기본값) | Raft 구성 포함 | 로그 복제 수신 | 투표 |
|------|-----------------|----------------|--------------------------|-------|
| **투표자** | 최대 5개(`max_voters`, 홀수) | 예 | 예 | 예 |
| **대기 노드** | 최대 4개(`max_standbys`) | 예 | 예 | 아니요 |
| **클라이언트** | 무제한 | 아니요 | 아니요 | 아니요 |

- **투표자**가 쿼럼을 구성합니다. 투표자 과반이 확인하면 쓰기가 커밋됩니다. `max_voters`는 홀수 상한(기본값 5)으로 정규화됩니다. 적격 노드가 세 개 이상이면 조정기도 홀수 투표자 수를 선택합니다. 적격 노드가 두 개이고 상한이 1보다 크면 둘 다 투표자가 되며, `max_voters: 1`은 단일 투표자를 유지합니다.
- **대기 노드**는 완전히 복제되고 준비된 비투표 멤버입니다. 투표자가 이탈하면 리더가 가장 높은 순위의 대기 노드를 빈 투표자 슬롯으로 승격하므로 새 노드가 따라잡기를 기다리지 않고 쿼럼을 복구합니다.
- **클라이언트**는 `voters + standbys`를 초과하는 노드입니다. Raft 구성에 없으므로 리더가 로그 엔트리를 보내지 않습니다. 가십에 참여하고 쓰기를 Raft 멤버로 라우팅하여 전체 클러스터 크기와 무관하게 Raft 복제 규모를 제한합니다.

`max_voters`와 `max_standbys` 설정은 전체 클러스터 크기와 독립적으로 합의 코어의 상한을 정합니다.

### 투표자 선택

리더의 조정기는 멤버십이 바뀔 때마다(`raft.reconcile_debounce`, 기본 2초로 디바운스) 투표자가 될 노드를 다시 계산하고 최소한의 승격/강등 연산을 적용합니다. 모든 노드는 같은 가십 뷰에서 같은 순서를 도출하며, 세 가지 가십 광고 힌트가 선택을 결정합니다.

- `raft.eligible` — `eligible: false`인 노드는 투표자와 대기 노드 선택에서 제외되어 Raft 밖의 클라이언트로 남습니다. 대기 노드가 되어야 한다면 적격 상태를 유지하되 투표자 경계보다 낮게 배치하세요.
- `raft.priority` — 값이 낮을수록 투표자 슬롯에 우선하며 동률은 노드 ID로 결정합니다.
- `failure_domain` — 먼저 서로 다른 도메인(영역/랙)에 투표자를 분산하여 한 도메인 실패가 과반을 제거할 위험을 줄입니다.

연산은 쿼럼을 보존하는 순서로 적용됩니다. 추가와 승격, 강등, 제거 순입니다.

## 멤버십과 가십

멤버십은 SWIM 가십(HashiCorp memberlist)을 사용합니다. 각 노드는 가십 포트(기본 **7946**)를 바인딩하고 피어와 작은 메시지를 계속 교환하여 실패를 감지하고 메타데이터를 전파합니다.

노드는 기존 노드 하나 이상을 가리켜 참여합니다.

```yaml
cluster:
  enabled: true
  name: node-2
  membership:
    join_addrs: "node-1:7946"
  internode:
    identity_key_file: /etc/wippy/node-2.identity
    trusted_peer_keys:
      node-1: "${env:NODE_1_PUBLIC_KEY}"
      node-2: "${env:NODE_2_PUBLIC_KEY}"
```

첫 노드는 `join_addrs`가 필요 없으며 시드로 시작합니다. 참여는 백오프로 재시도되고 격리된 노드는 주기적으로 재참여를 시도합니다. 이는 Kubernetes에서 흔한, 새 IP로 재시작하는 노드를 지원합니다.

가십은 인라인 또는 파일의 공유 키로 암호화할 수 있습니다.

```yaml
cluster:
  membership:
    secret_file: /etc/wippy/cluster.key
```

가십 키는 멤버십 트래픽을 보호합니다. 노드 간 TCP 연결은 별도의 Ed25519 ID를 사용합니다. 모든 클러스터 노드는 `internode.identity_key` 또는 `internode.identity_key_file`을 제공해야 하며 `trusted_peer_keys`에는 로컬 노드와 연결 가능한 모든 피어의 공개 키가 있어야 합니다. `identity_key`는 base64 인코딩된 32바이트 시드 또는 64바이트 개인 키이며 신뢰 피어 값은 base64 공개 키입니다. 각 노드에 고유한 개인 키를 주고 모든 노드에 같은 신뢰 공개 키 맵을 배포하세요.

멤버십 변경(`NodeJoined`, `NodeLeft`, `NodeUpdated`)은 Raft 부트스트랩, 투표자 조정, 프로세스 그룹 동기화, 이탈 노드 소유 이름의 자동 정리를 구동합니다.

## 부트스트랩

초기 클러스터는 정적 피어 목록이 아니라 가십으로 형성됩니다. Consul/Nomad 방식의 `bootstrap_expect` 설정을 사용하면 각 시작 노드는 자신을 포함해 구성된 수의 적격 노드가 보일 때까지 기다린 뒤 쿼럼을 형성합니다.

| `bootstrap_expect` | 동작 |
|--------------------|----------|
| `0` | 자체 부트스트랩하지 않고 이미 존재하는 클러스터에만 참여 |
| `1` | 단일 노드. 자신을 유일한 투표자로 즉시 부트스트랩 |
| `N` | 로컬 노드를 포함한 적격 노드 `N`개가 가십에서 안정적으로 보일 때까지 기다린 뒤 모두 같은 투표자 목록을 계산하여 쿼럼 형성 |

`N`노드 부트스트랩에서는 모든 초기 노드에 같은 `bootstrap_expect: N`을 설정합니다. 각 노드는 가십에 "부트스트랩 전" 상태를 알립니다. 자신을 포함한 정확히 `N`개 노드가 짧은 안정화 구간 동안 보이면 각 노드가 독립적으로 같은 정렬된 투표자 집합을 계산하고 클러스터를 형성합니다. 안정화 구간은 잠깐의 부분 뷰로 조기 부트스트랩되는 것을 막습니다.

나중에 시작하는 노드는 이미 형성된 클러스터를 보고 부트스트랩을 건너뜁니다. 리더의 조정기가 투표자 또는 대기 노드로 추가합니다.

## Raft 합의 코어

Raft 상태는 기본적으로 **파일 시스템 내구성**을 가집니다. 로그와 스냅샷은 `cluster.raft.data_dir`(기본 `~/.wippy/store`의 `_sys/raft`) 아래에 영속화되고 [`store.kv.raft`](../system/store.md#cluster-kv-stores)는 같은 코어를 통해 복제됩니다. 재시작 노드는 가십에 다시 참여하고 피어에서 따라잡으므로 노드 디스크를 잃어도 견딜 수 있습니다. 내구성은 살아 있는 쿼럼과 디스크 상태 모두에서 옵니다. 구성 경로나 홈 디렉터리가 없어 데이터 디렉터리를 해석할 수 없을 때만 노드가 디스크 없이 실행됩니다. [복구](#복구와-실패-모드)를 참조하세요.

Raft는 별도 수신 포트를 열지 않습니다. 노드 간 릴레이 트래픽과 같은 TCP 연결인 **노드 간 메시**에서 실행되며, 메시의 신뢰할 수 있는 클래스별 채널을 통해 RPC를 요청/응답 프레임으로 운반합니다. 노드 간 포트는 부팅 시 7950~7959 범위에서 자동 선택된 뒤 임시 포트를 사용하며 고정되어 가십에 광고됩니다. 노드는 가십 포트와 광고된 노드 간 TCP 포트 모두에서 서로 도달할 수 있어야 합니다.

Raft FSM은 활성 `name -> PID` 바인딩과 진행 중인 강한 예약으로 구성된 전역 이름 레지스트리를 보유합니다. 아래 이름 지정 기본 요소가 이 상태를 읽고 씁니다.

## 이름 지정과 이름 범위

프로세스는 원시 PID 대신 이름으로 등록하고 주소를 지정할 수 있습니다. **범위**가 일관성과 조정 동작을 선택합니다. 로컬부터 가장 강한 수준까지 네 범위가 있습니다.

| 범위 | 기반 | 가시성 | 보장 |
|-------|-----------|------------|-----------|
| **Local** | 노드별 맵 | 현재 노드만 | 즉시 적용되는 노드 로컬, 조정 없음 |
| **Eventual** | 가십 CRDT | 클러스터 전체 | 최종 일관성, 가십 라운드 후 수렴 |
| **Consistent** | Raft | 클러스터 전체 | 선형화 가능한 쓰기, 클러스터 전체 고유 싱글턴 |
| **Strong** | Raft + 모든 노드 확인 | 클러스터 전체 | Consistent 보장과 활성화 전 모든 살아 있는 노드의 확인 |

선택 지침:

- **Local** — 노드별 헬퍼처럼 한 노드에서만 의미 있는 이름입니다. 프로세스 종료 시 해제되며 클러스터 조정이 필요 없습니다.
- **Eventual** — 잠깐의 오래된 뷰가 허용되는 클러스터 전체 서비스, 그룹, 존재 이름입니다. 바인딩 집합이 모든 노드에 완전히 복제되므로 세션별 프로세스처럼 카디널리티가 높은 엔터티마다 이름을 만드는 대신 제한된 네임스페이스에 적합합니다. 두 출처가 같은 이름을 등록하면 충돌 해결이 승자를 선택하고 패배한 프로세스는 `name revoked: <name>` 사유를 담은 취소 이벤트(`process.event.CANCEL`)를 받습니다. 프로세스는 계속 실행되며 다시 등록할 수 있습니다. 소유 노드가 이탈하면 이름이 해제됩니다.
- **Consistent** — 클러스터 전체 이름 있는 싱글턴의 표준 선택입니다. 선착순이며 같은 이름의 두 번째 등록은 "already exists"로 실패하고 현재 소유자를 반환합니다. 쓰기에는 쿼럼이 필요하므로 소수 파티션에서는 중단됩니다. 읽기는 로컬 Raft 복제본에서 수행되어 쓰기보다 수 밀리초 늦을 수 있습니다.
- **Strong** — 잠깐의 오래된 읽기도 위험한 소수의 제어 평면 싱글턴입니다. Consistent 보장에 더해 모든 살아 있는 노드가 확인해야 이름이 권위 있게 됩니다. 충돌 바인딩을 가진 노드는 즉시 거부하며 기한 전에 모든 노드가 확인하지 않으면 예약이 만료되고 누락 노드를 보고합니다.

이름은 자동으로 해제됩니다. Local은 프로세스 종료 시, Consistent와 Strong은 프로세스 종료(토폴로지 모니터링) 및 노드 이탈 시, Eventual은 노드 이탈 시 해제됩니다. 메시징의 이름 해석(`process.send`, `process.terminate` 등)은 가장 권위 있는 평면부터 조회합니다. Consistent와 Strong(Raft), Eventual(가십), Local 순이므로 클러스터 전체 이름이 같은 문자열의 로컬 이름을 가립니다.

이름 지정 Lua 표면은 `process.registry`에 있으며 범위를 지정한 등록/조회/등록 해제를 제공합니다. [프로세스](../lua/core/process.md) 참조를 확인하세요.

## 프로세스 그룹

프로세스 그룹은 Erlang `pg`를 모델로 한 클러스터 인식 게시/구독 및 멤버십 기능입니다. 프로세스가 이름 있는 그룹에 참여하면 브로드캐스트가 노드 간 메시를 통해 모든 노드의 그룹 멤버에게 최선형으로 전달됩니다. 그룹은 최종 일관성을 가지며 Raft와 독립적입니다. 수신자를 선택할 때 가십 멤버십 뷰를 사용하므로 합의 코어가 수렴하는 동안에도 작동합니다.

주요 연산은 그룹 참여/이탈, 모든 멤버 또는 로컬 멤버에게 브로드캐스트, 멤버 나열, 참여/이탈 이벤트 모니터링입니다. 새 노드가 참여하면 직접 동기화 핸드셰이크로 멤버십을 조정하고 백그라운드 안티엔트로피 루프가 시간에 따른 불일치를 복구합니다.

Lua API는 [프로세스 그룹](../lua/core/pg.md), 구성은 [`pg.scope` 엔트리 종류](../system/process-groups.md)를 참조하세요.

## 분산 잠금

`system.lock`은 공유 키-값 저장소의 Raft 선형화 가능 조건부 쓰기로 구현된 클러스터 전체 상호 배제입니다. 잠금 획득은 `_sys:lock:<name>`에 보유자 PID를 조건부 생성하고, 해제는 호출자가 여전히 보유한 경우 엔트리를 삭제합니다. 조건부 쓰기는 Raft를 통하며 리더가 아닌 노드의 쓰기는 리더로 전달되므로 선형화 가능하고 클러스터 전체 보유자는 최대 하나입니다.

```lua
local ok, err = system.lock.acquire("orders.migration")
if not ok then
  -- err has kind errors.ALREADY_EXISTS when another process holds the lock.
  -- Apply the caller's retry and backoff policy for that case if needed.
  return nil, err
end

-- critical section: only one holder cluster-wide
local released, release_err = system.lock.release("orders.migration")
if release_err then
  return nil, release_err
end
return released
```

획득은 대기하지 않고 즉시 실패합니다. 잠금이 있으면 바로 반환하므로 호출자가 재시도와 백오프를 제공합니다. 보유 프로세스가 종료되거나 해당 노드가 이탈하면 잠금이 해제됩니다. 정확한 시그니처는 [시스템](../lua/system/system.md) 참조를 확인하세요.

## 구성

관련 클러스터 설정은 [구성](./configuration.md#클러스터)을 참조하세요. 다음 최소 형태에는 필수 노드 간 ID 설정이 포함됩니다.

이 구성 조각은 완전한 배포 매니페스트가 아닙니다. 노드 이름, 주소, 실패 도메인, 경로, 모든 `${env:...}` ID 자리표시자를 자체 클러스터용으로 생성하고 배포한 값으로 바꾸세요.

단일 노드(개발):

```yaml
cluster:
  enabled: true
  name: dev
  internode:
    identity_key: "${env:DEV_PRIVATE_KEY}"
    trusted_peer_keys:
      dev: "${env:DEV_PUBLIC_KEY}"
  raft:
    bootstrap_expect: 1
```

3노드 투표 클러스터:

```yaml
cluster:
  enabled: true
  name: node-1
  failure_domain: us-east-1a
  membership:
    join_addrs: "node-2:7946,node-3:7946"
    secret_file: /etc/wippy/cluster.key
  internode:
    identity_key_file: /etc/wippy/node-1.identity
    trusted_peer_keys:
      node-1: "${env:NODE_1_PUBLIC_KEY}"
      node-2: "${env:NODE_2_PUBLIC_KEY}"
      node-3: "${env:NODE_3_PUBLIC_KEY}"
  raft:
    bootstrap_expect: 3
```

가십 전용 클라이언트(이름 지정/메시징에는 참여하지만 Raft는 실행하지 않음):

```yaml
cluster:
  enabled: true
  name: edge-7
  membership:
    join_addrs: "node-1:7946,node-2:7946"
  internode:
    identity_key_file: /etc/wippy/edge-7.identity
    trusted_peer_keys:
      node-1: "${env:NODE_1_PUBLIC_KEY}"
      node-2: "${env:NODE_2_PUBLIC_KEY}"
      edge-7: "${env:EDGE_7_PUBLIC_KEY}"
  raft:
    role: client
```

## 포트

| 목적 | 포트 | 프로토콜 | 구성 키 |
|---------|------|----------|------------|
| 가십(멤버십) | 7946 | TCP + UDP | `cluster.membership.bind_port` |
| 노드 간 메시(릴레이 + Raft) | 자동 | TCP | `cluster.internode.bind_port` |

Raft는 별도 포트 대신 노드 간 메시에서 다중화됩니다. 노드 간 포트는 자동 할당되고 가십으로 광고됩니다. 가십 포트는 기본적으로 예측 가능하지만 피어는 각 노드가 광고한 노드 간 TCP 포트에도 도달할 수 있어야 합니다.

## 관찰 가능성

클러스터 상태는 표준 [Prometheus 엔드포인트](./observability.md)와 활성 상태 검사에 노출됩니다.

주요 메트릭:

| 메트릭 | 의미 |
|--------|---------|
| `raft_state` | 0 = follower, 1 = candidate, 2 = leader |
| `raft_term` | 현재 Raft 임기. 빠른 증가는 선거 변동을 나타냅니다. |
| `raft_voters` / `raft_non_voters` | 구성의 살아 있는 투표자와 대기 노드 |
| `raft_leader_changes_total` | 리더 전이. 건강한 클러스터에서는 거의 증가하지 않아야 합니다. |
| `raft_voter_churn_burst_total` | 투표자 추가/제거 연산 버스트. 지속적인 변동은 불안정을 나타냅니다. |
| `gossip_members{state}` | 상태별 수(alive/suspect/dead/left) |
| `gossip_convergence_seconds` | 가십 이벤트 사이의 시간 |

기본 활성 상태 검사:

- **gossip** — 노드의 가십 상태 점수가 낮으면 건강합니다. 재참여 노드가 너무 일찍 종료되지 않도록 부팅 유예 시간이 있습니다.
- **raft last-contact** — 투표 팔로워가 최근 리더와 통신하지 못하면 실패합니다. 대기 노드는 훨씬 긴 간격을 허용하고 리더는 항상 통과합니다.
- **process-group broadcast** — 프로세스 그룹 서비스가 활동 상한 동안 브로드캐스트를 보내거나 받지 못하면 실패하여 멈춘 서비스나 지속 파티션을 포착합니다.

## 복구와 실패 모드

Raft 상태는 파일 시스템에 내구적으로 저장되지만 클러스터의 주된 내구성은 살아 있는 쿼럼에서 옵니다.

- 투표자 과반을 유지하세요. 투표자 5개면 동시 실패 2개를 견디며 대기 노드가 열린 슬롯으로 승격됩니다. 과반 아래로 내려가면 새 Consistent/Strong 등록과 잠금 획득 같은 쓰기가 쿼럼 복귀까지 중단됩니다. 로컬 복제 상태가 일부 읽기에 답할 수 있어도 파티션된 노드가 최신 값을 가졌다는 증거로 간주하지 마세요.
- 리더는 하트비트가 없고 가십에서 죽은 투표자를 능동적으로 제거하여 대기 노드 승격 중 죽은 투표자가 쿼럼을 영구적으로 막지 않도록 합니다.
- 쿼럼을 잃은 클러스터를 복구하려면 실패한 노드를 재시작합니다. 노드는 가십에 재참여하고 살아남은 멤버가 다시 편입합니다. 투표자를 `failure_domain`에 분산하면 단일 영역 실패로 쿼럼을 잃을 가능성이 줄어듭니다.

## 함께 보기

- [구성](./configuration.md#클러스터) — 관련 클러스터 설정
- [프로세스](../lua/core/process.md) — 이름으로 프로세스 등록 및 해석
- [시스템](../lua/system/system.md) — `system.cluster`, `system.raft`, `system.node`, `system.lock`
- [관찰 가능성](./observability.md) — 메트릭과 상태 엔드포인트
- [프로세스 모델](../concepts/process-model.md) — 액터, PID, 메시징
