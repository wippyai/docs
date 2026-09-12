---
title: "클러스터"
description: "Wippy node가 peer를 발견하고 process message를 route하며 gossip과 Raft를 통해 조율하는 방식입니다."
---

# 클러스터

단일 Wippy node는 완전한 런타임입니다. **cluster**는 여러 node를 연결해 process가 cluster-wide name을 사용하고 node 간 message를 route하며 lock, group 및 shared consensus core를 통해 조율할 수 있게 합니다.

clustering은 opt-in(`cluster.enabled`)입니다. 이 페이지는 코드에 보이는 모델을 설명합니다. topology, 설정 및 운영은 [클러스터 가이드](guides/cluster.md)를 참조하십시오.

## 모델

node는 **gossip**(SWIM)을 통해 서로를 발견합니다. node가 seed를 통해 join하면 중앙 coordinator 없이 membership 및 failure 정보가 수렴합니다. 제한된 **Raft** core는 동적으로 reconcile되는 voter set을 통해 linearizable consensus를 제공하고 다른 node는 gossip을 통해 참여합니다.

클러스터가 코드에 제공하는 것은 세 가지 개념으로 요약됩니다: **이름**, **라우팅**, **조율 프리미티브**.

## 이름 지정

프로세스는 일반적으로 PID로 주소가 지정됩니다. 클러스터에서는 **이름**으로 등록하여 어디서든 그 이름으로 도달할 수도 있습니다. 중요한 결정은 **스코프** — 원하는 일관성 보장과 그에 따른 비용 간의 트레이드오프입니다:

| 스코프 | 가시성 | 보장 | 사용 사례 |
|-------|--------|------|----------|
| **Local** | 이 노드 | 즉시, 조율 없음 | 노드 로컬 헬퍼 |
| **Eventual** | 클러스터 전체 | gossip 이후 수렴; 충돌은 해결되고 패자에게 알림 | 서비스, 그룹, 제한된 프레즌스 이름 |
| **Consistent** | 클러스터 전체 | Raft를 통한 선형화 가능한 싱글턴 | 표준 클러스터 전체 네임드 서비스 |
| **Strong** | 클러스터 전체 | Consistent에 더해 모든 라이브 노드가 이름이 활성화되기 전에 확인 | 컨트롤 플레인 싱글턴과 락 |

scope는 consistency 및 coordination cost 기준으로 `Local < Eventual < Consistent < Strong` 순서입니다. 필요한 보장을 충족하는 가장 저렴한 scope를 선택하십시오. 이름은 [`process.registry`](lua/core/process.md)를 통해 등록합니다. local name은 process exit 시 제거되고 Consistent 및 Strong name도 process exit 또는 node departure에서 정리됩니다. Eventual name은 명시적으로 제거하거나 origin node가 떠날 때 제거되며 소유 process만 exit한 경우 자동 제거되지 않습니다.

## 라우팅

이름 지정은 이름이 올바른 프로세스에 안정적으로 도달할 때만 유용합니다. 라우팅이 둘을 연결하며, 몇 가지 일관된 규칙을 따릅니다:

- **읽기는 로컬입니다.** 모든 노드는 자체 복제본 또는 gossip으로 전파된 캐시에서 이름을 확인합니다 — 이름 조회를 위한 네트워크 왕복이 없습니다. 이로써 해석이 빠르게 유지되고 파티션 중에도 동작합니다.
- **해석은 고정된 순서를 따릅니다.** name은 가장 authoritative한 plane부터 Consistent 및 Strong(Raft), Eventual(gossip), Local 순으로 resolve됩니다. 따라서 cluster-wide name이 같은 문자열의 local name을 가립니다.
- **쓰기는 권한 노드로 라우팅됩니다.** Consistent 또는 Strong 등록은 Raft 리더를 통해 이루어지며, 리더가 아닌 노드는 쓰기를 전달하고 결과를 기다립니다. 커밋되면 활성 바인딩이 gossip으로 전파되어 Raft 코어에 속하지 않은 노드를 포함한 모든 노드가 이후 이름을 로컬에서 해석할 수 있습니다.
- **메시징은 PID로 라우팅됩니다.** 이름으로 `process.send`를 호출하면 PID로 해석되고 릴레이가 소유 노드에 메시지를 전달합니다. 코드는 프로세스가 이 노드에 있든 다른 노드에 있든 동일한 방식으로 주소를 지정합니다 — 위치는 투명합니다.

애플리케이션은 authority node를 직접 address하지 않고 name을 등록하고 resolve합니다. resolve 후 message는 target PID를 소유한 node로 route됩니다.

## 프리미티브

클러스터링은 소규모의 빌딩 블록을 노출합니다. 각각은 자체 페이지에서 전체 문서를 제공합니다. 개념적으로는 다음과 같은 것을 구축할 수 있게 합니다:

- **멤버십과 식별** — live node set과 이 node의 identity 및 role. peer discovery 또는 work sharding에 사용합니다. [`system.cluster`](lua/system/system.md)와 [`system.node`](lua/system/system.md)를 참조하십시오.
- **합의 상태** — diagnostic 및 leader-aware logic을 위한 Raft leader, term 및 이 node의 role. [`system.raft`](lua/system/system.md)를 참조하십시오.
- **클러스터 전체 이름** — 모든 것의 기반인 name 및 scope 기반 process 등록과 resolve. [`process.registry`](lua/core/process.md)를 참조하십시오.
- **분산 락** — holder가 죽으면 자동 해제되는 최대 한 holder의 cluster-wide mutual exclusion. [`system.lock`](lua/system/system.md)를 참조하십시오.
- **프로세스 그룹** — Erlang-style named group join과 전체 node의 모든 member에 대한 broadcast. [프로세스 그룹](lua/core/pg.md)을 참조하십시오.

이 primitive는 membership 및 routing infrastructure를 공유합니다. Consistent 및 Strong name과 distributed lock은 Raft core를 사용합니다. process group은 gossip membership으로 peer를 발견하고 relay를 통해 change를 보내며 전체 state를 주기적으로 교환해 수렴합니다.

## 참고

- [클러스터 가이드](guides/cluster.md) — topology, 설정 및 운영
- [프로세스 관리](lua/core/process.md) — spawn, messaging 및 name registry
- [프로세스 그룹](lua/core/pg.md) — named group 및 broadcast
- [시스템](lua/system/system.md) — `system.cluster`, `system.node`, `system.raft`, `system.lock`
- [프로세스 모델](concepts/process-model.md) — process, PID 및 messaging
