---
title: "아키텍처"
description: "Wippy가 인프라를 부팅하고, 컴포넌트와 엔트리를 로드하고, 작업을 스케줄링하고, 메시지를 라우팅하고, 종료하는 방식입니다."
---

# 아키텍처

Wippy는 Go 기반의 계층화된 시스템입니다. 컴포넌트는 의존성 순서로 초기화되고, 이벤트 버스를 통해 통신하며, 작업 스틸링 스케줄러를 통해 Lua 프로세스를 실행합니다.

이 페이지는 구현 레퍼런스입니다. 다이어그램과 Go 타입은 애플리케이션 레지스트리 엔트리나 extension API가 아니라 런타임 내부 구조를 설명합니다.

## 계층

| 계층 | 컴포넌트 |
|-------|------------|
| 애플리케이션 | Lua 프로세스, 함수, 워크플로우 |
| 런타임 | Lua 엔진(wippyai/go-lua)과 런타임 모듈 |
| 서비스 | HTTP, Queue, Storage, Temporal |
| 시스템 | Topology, Factory, Functions, Contracts |
| 코어 | Scheduler, Registry, Dispatcher, EventBus, Relay |
| 인프라 | AppContext, Logger, Transcoder |

각 계층은 아래 계층에만 의존합니다. 코어 계층은 기본 프리미티브를 제공하고, 서비스는 그 위에 더 높은 수준의 추상화를 구축합니다.

## 부트 시퀀스

애플리케이션 시작은 네 단계로 진행됩니다.

### 1단계: 인프라

컴포넌트가 로드되기 전에 핵심 인프라 생성:

| 컴포넌트 | 목적 |
|-----------|---------|
| AppContext | 컴포넌트 참조를 위한 봉인된 딕셔너리 |
| EventBus | 컴포넌트 간 통신을 위한 pub/sub |
| Transcoder | 페이로드 직렬화 (JSON, YAML, Lua) |
| Logger | 이벤트 스트리밍이 있는 구조화된 로깅 |
| Relay | 메시지 라우팅 (Node, Router, Mailbox) |

### 2단계: 컴포넌트 로딩

Loader는 토폴로지 정렬로 의존성을 해결하고 컴포넌트를 레벨별로 순차 로드합니다. 같은 레벨 안에서도 한 번에 하나씩 로드됩니다.

의존성 edge가 레벨을 결정합니다. Core나 System 같은 package group은 별도의 전역 순서를 강제하지 않습니다. 따라서 의존성 edge가 없는 컴포넌트는 package group과 관계없이 같은 레벨에 놓일 수 있습니다.

각 컴포넌트는 Load 단계에서 컨텍스트에 자신을 연결하여 의존 컴포넌트가 서비스를 사용할 수 있게 합니다.

### 3단계: 활성화

모든 컴포넌트 로드 후:

1. **런타임 서비스 시작** - `StartRuntimeServices(ctx)` 호출
2. **Dispatcher 동결** - 락 프리 조회를 위해 명령 핸들러 레지스트리 잠금
3. **AppContext 봉인** - 더 이상 쓰기 불가, 락 프리 읽기 활성화
4. **컴포넌트 시작** - `Starter` 인터페이스가 있는 각 컴포넌트에 `Start()` 호출

### 4단계: 엔트리 로딩

프로젝트 manifest인 `_index.json`, `_index.yaml`, `_index.yml`의 레지스트리 엔트리가 로드되고 검증됩니다.

1. 프로젝트 파일에서 엔트리 파싱
2. 파이프라인 단계가 엔트리 변환 (override, link, bytecode)
3. `auto_start: true`로 표시된 서비스 실행 시작
4. 슈퍼바이저가 등록된 서비스 모니터링

## 컴포넌트

컴포넌트는 애플리케이션 라이프사이클에 참여하는 Go 서비스입니다.

### 라이프사이클 단계

| 단계 | 메서드 | 목적 |
|-------|--------|---------|
| Load | `Load(ctx) (ctx, error)` | 초기화 및 컨텍스트에 연결 |
| Start | `Start(ctx) error` | 활성 작업 시작 |
| Stop | `Stop(ctx) error` | 그레이스풀 셧다운 |

컴포넌트는 의존성을 선언합니다. 로더가 방향성 비순환 그래프를 구축하고 토폴로지 순서로 실행합니다. 셧다운은 역순으로 발생합니다.

### 표준 컴포넌트

| 컴포넌트 | 의존성 | 목적 |
|-----------|--------------|---------|
| PIDGen | 없음 | 프로세스 ID 생성 |
| Dispatcher | 없음 | 명령 핸들러 디스패치 |
| Registry | Artifact | 엔트리 스토리지 및 버전닝 |
| Finder | Registry | 엔트리 조회 및 검색 |
| Supervisor | Registry | 서비스 재시작 정책 |
| Topology | 없음 | 프로세스 부모/자식 트리 |
| Lifecycle | Topology | 서비스 라이프사이클 관리 |
| Factory | 없음 | 프로세스 생성 |
| Functions | Registry | pooled 함수 실행 |

## 이벤트 버스

컴포넌트 간 통신을 위한 비동기 pub/sub.

### 설계

- 단일 디스패처 고루틴이 모든 이벤트 처리
- publisher는 subscriber 전달을 기다리지 않고 action을 enqueue
- pattern matching은 정확한 값, `*`, `**`, segment alternation을 지원
- 컨텍스트 기반 라이프사이클이 구독을 취소와 연결

### 이벤트 흐름

```mermaid
sequenceDiagram
    participant P as Publisher
    participant B as EventBus
    participant S as Subscribers

    P->>B: Send(ctx, Event)
    B->>B: Match patterns
    B->>S: Deliver on subscriber channel
    S->>S: Execute callback
```

### 일반적인 토픽

이벤트에는 별도의 `System`과 `Kind` 필드가 있습니다. 내장 시스템은 다음을 발행합니다.

| 시스템 | 종류 | 목적 |
|--------|------|------|
| `registry` | `entry.create`, `entry.update`, `entry.delete`, `entry.accept`, `entry.reject` | 엔트리 변경 |
| `registry` | `registry.begin`, `registry.commit`, `registry.discard` | 트랜잭션 경계 |
| `process` | `factory.register`, `factory.delete`, `factory.accept`, `factory.reject` | 프로세스 종류에 대한 팩토리 등록 |
| `supervisor` | `service.register`, `service.remove`, `service.update`, `service.start`, `service.stop` | 서비스 라이프사이클 |

## 레지스트리

엔트리 정의를 위한 버전화된 스토리지.

### 기능

- **버전화된 상태** - 각 변경이 새 버전 생성
- **히스토리** - 감사 추적을 위한 SQLite 백업 히스토리
- **관찰** - 특정 엔트리의 변경 감시
- **이벤트 기반** - 변경 시 이벤트 퍼블리시

### 엔트리 라이프사이클

```mermaid
flowchart LR
    YAML[YAML Files] --> Parser
    Parser --> Stages[Pipeline Stages]
    Stages --> Registry
    Registry --> Validation
    Validation --> Active
```

파이프라인 단계가 엔트리를 변환:

| 단계 | 목적 |
|-------|---------|
| Override | 설정 오버라이드 적용 |
| 비활성화 | 패턴으로 엔트리 제거 |
| Link | 요구사항과 의존성 해결 |
| Bytecode | Lua를 바이트코드로 컴파일 |
| EmbedFS | 파일시스템 엔트리 수집 |

## 릴레이

노드 간 프로세스 메시지 라우팅.

### 3계층 라우팅

```mermaid
flowchart LR
    subgraph Router
        Local[Local Node] --> Peer[Registered Peers]
        Peer --> Inter[Internode]
    end

    Local -.- L[Same-node hosts and processes]
    Peer -.- P[External receivers, such as Temporal]
    Inter -.- I[Other cluster nodes]
```

1. **Local** - 같은 노드의 host와 process 사이에 직접 전달
2. **Peer** - Temporal 같은 등록된 외부 receiver로 전달
3. **Internode** - 다른 cluster node를 위한 network routing으로 fallback

### 메일박스

각 노드에는 워커 풀이 있는 메일박스:

- FNV-1a 해싱으로 발신자를 워커에 할당
- 발신자별 메시지 순서 유지
- 워커가 동시에 메시지 처리
- 큐가 가득 차면 백프레셔

## AppContext

컴포넌트 참조를 위한 봉인된 딕셔너리.

| 속성 | 동작 |
|----------|----------|
| 봉인 전 | 부팅 중 단일 스레드 쓰기 |
| 봉인 후 | 락 프리 읽기, 쓰기 시 패닉 |
| 중복 키 | 패닉 |
| 타입 안전성 | 타입화된 getter 함수 |

컴포넌트는 Load 단계에서 서비스를 연결합니다. 부트 완료 후 AppContext가 봉인되어 lock-free 읽기를 허용하고 추가 쓰기를 방지합니다.

## 셧다운

그레이스풀 셧다운은 역순으로 진행:

1. SIGINT/SIGTERM이 셧다운 트리거
2. 슈퍼바이저가 관리되는 서비스 중지
3. `Stopper` 인터페이스가 있는 컴포넌트가 `Stop()` 수신
4. 인프라 정리

두 번째 시그널은 즉시 종료를 강제합니다.

## 참고

- [스케줄러](./scheduler.md) - 프로세스 실행
- [이벤트 버스](./events.md) - Pub/sub 시스템
- [레지스트리](./registry.md) - 상태 관리
- [명령 디스패치](./dispatch.md) - Yield 처리
