# 시스템
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="permissions"/>

메모리 사용량, 가비지 컬렉션 통계, CPU 세부 정보, 프로세스 메타데이터를 포함한 런타임 시스템 정보를 조회합니다.

## 로딩

```lua
local system = require("system")
```

## 셧다운

종료 코드와 함께 시스템 셧다운 트리거. 터미널 앱에 유용합니다; 실행 중인 액터에서 호출하면 전체 시스템이 종료됩니다:

```lua
local ok, err = system.exit(0)
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `code` | integer | 종료 코드 (0 = 성공), 기본값 0 |

**반환:** `boolean, error`

## 모듈 목록 조회

메타데이터와 함께 로드된 모든 Lua 모듈 가져오기:

```lua
local mods, err = system.modules()
```

**반환:** `table[], error`

각 모듈 테이블에는 다음이 포함됩니다:

| 필드 | 타입 | 설명 |
|-------|------|------|
| `name` | string | 모듈 이름 |
| `description` | string | 모듈 설명 |
| `class` | string[] | 모듈 분류 태그 |

## 메모리 통계

상세 메모리 통계 가져오기:

```lua
local stats, err = system.memory.stats()
```

**반환:** `table, error`

통계 테이블 내용:

| 필드 | 타입 | 설명 |
|-------|------|------|
| `alloc` | number | 할당되고 사용 중인 바이트 |
| `total_alloc` | number | 누적 할당 바이트 |
| `sys` | number | 시스템에서 얻은 바이트 |
| `heap_alloc` | number | 힙에 할당된 바이트 |
| `heap_sys` | number | 시스템에서 힙을 위해 얻은 바이트 |
| `heap_idle` | number | 유휴 스팬의 바이트 |
| `heap_in_use` | number | 비유휴 스팬의 바이트 |
| `heap_released` | number | OS에 반환된 바이트 |
| `heap_objects` | number | 할당된 힙 객체 수 |
| `stack_in_use` | number | 스택 할당자가 사용하는 바이트 |
| `stack_sys` | number | 시스템에서 스택을 위해 얻은 바이트 |
| `mspan_in_use` | number | 사용 중인 mspan 구조체의 바이트 |
| `mspan_sys` | number | 시스템에서 mspan을 위해 얻은 바이트 |
| `num_gc` | number | 완료된 GC 사이클 수 |
| `next_gc` | number | 다음 GC를 위한 대상 힙 크기 |

## 현재 할당량

현재 할당된 바이트 가져오기:

```lua
local bytes, err = system.memory.allocated()
```

**반환:** `number, error`

## 힙 객체

할당된 힙 객체 수 가져오기:

```lua
local count, err = system.memory.heap_objects()
```

**반환:** `number, error`

## 메모리 제한

메모리 제한 설정 (이전 값 반환):

```lua
local prev, err = system.memory.set_limit(1024 * 1024 * 100)
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `limit` | integer | 바이트 단위 메모리 제한, -1은 무제한 |

**반환:** `number, error`

현재 메모리 제한 가져오기:

```lua
local limit, err = system.memory.get_limit()
```

**반환:** `number, error`

## GC 강제 실행

가비지 컬렉션 강제 실행:

```lua
local ok, err = system.gc.collect()
```

**반환:** `boolean, error`

## GC 대상 비율

GC 대상 비율 설정 (이전 값 반환). 값 100은 힙이 두 배가 될 때 GC가 트리거됨을 의미합니다:

```lua
local prev, err = system.gc.set_percent(200)
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `percent` | integer | GC 대상 비율 |

**반환:** `number, error`

현재 GC 대상 비율 가져오기:

```lua
local percent, err = system.gc.get_percent()
```

**반환:** `number, error`

## 고루틴 수

활성 고루틴 수 가져오기:

```lua
local count, err = system.runtime.goroutines()
```

**반환:** `number, error`

## GOMAXPROCS

GOMAXPROCS 값 가져오기 또는 설정:

```lua
-- 현재 값 가져오기
local current, err = system.runtime.max_procs()

-- 새 값 설정
local prev, err = system.runtime.max_procs(4)
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `n` | integer | 제공되면 GOMAXPROCS 설정 (0보다 커야 함) |

**반환:** `number, error`

## CPU 수

논리 CPU 수 가져오기:

```lua
local cpus, err = system.runtime.cpu_count()
```

**반환:** `number, error`

## 프로세스 ID

현재 프로세스 ID 가져오기:

```lua
local pid, err = system.process.pid()
```

**반환:** `number, error`

## 호스트명

시스템 호스트명 가져오기:

```lua
local hostname, err = system.process.hostname()
```

**반환:** `string, error`

## 작업 디렉토리

런타임의 현재 작업 디렉토리 가져오기:

```lua
local dir, err = system.process.cwd()
```

**반환:** `string, error`

## 프로세스 호스트

워커 및 큐 통계와 함께 모든 프로세스 호스트 목록 조회:

```lua
local hosts, err = system.hosts.list()
```

**반환:** `table[], error`

각 호스트 테이블 내용:

| 필드 | 타입 | 설명 |
|-------|------|------|
| `id` | string | 호스트 레지스트리 ID |
| `workers` | number | 워커 풀 크기 |
| `processes` | number | 이 호스트의 활성 프로세스 |
| `executed` | number | 총 실행된 스텝 |
| `stolen` | number | 다른 호스트에서 훔쳐온 스텝 |
| `queue_depth` | number | 호스트 큐의 대기 항목 |

특정 호스트에서 실행 중인 프로세스 목록 조회:

```lua
local procs, err = system.hosts.processes("app:host")
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `host_id` | string | 호스트 레지스트리 ID |

**반환:** `table[], error`

각 프로세스 테이블 내용:

| 필드 | 타입 | 설명 |
|-------|------|------|
| `pid` | string | 프로세스 ID |
| `host` | string | 호스트 ID |
| `source` | string | 소스 엔트리 ID |
| `state` | string | 프로세스 상태 |
| `steps` | number | 실행된 스텝 |
| `started_at` | number | 시작 타임스탬프 (나노초) |
| `parent` | string | 부모 PID (없으면 생략) |
| `actor_id` | string | 액터 ID (없으면 생략) |
| `stats` | table | 프로세스별 통계 (선택적) |

## 서비스 상태

특정 감독된 서비스의 상태 가져오기:

```lua
local state, err = system.supervisor.state("namespace:service")
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `service_id` | string | 서비스 ID (예: "namespace:service") |

**반환:** `table, error`

상태 테이블 내용:

| 필드 | 타입 | 설명 |
|-------|------|------|
| `id` | string | 서비스 ID |
| `status` | string | 현재 상태 |
| `desired` | string | 원하는 상태 |
| `retry_count` | number | 재시도 횟수 |
| `last_update` | number | 마지막 업데이트 타임스탬프 (나노초) |
| `started_at` | number | 시작 타임스탬프 (나노초) |
| `details` | string | 선택적 세부 정보 (포맷됨) |

## 모든 서비스 상태

모든 감독된 서비스의 상태 가져오기:

```lua
local states, err = system.supervisor.states()
```

**반환:** `table[], error`

각 상태 테이블은 `system.supervisor.state()`와 같은 형식입니다.

## 클러스터 프리미티브

`system.node`, `system.cluster`, `system.raft`, `system.lock` 서브 테이블은 클러스터링 레이어를 노출합니다. [클러스터링이 활성화된](guides/cluster.md) 경우에 가장 유용합니다; 독립 노드에서는 예측 가능하게 저하됩니다 — `system.raft.*`는 "raft not available"을 보고하고, `system.cluster`는 로컬 노드만 보고하며, `system.lock`은 클러스터링이 제공하는 글로벌 레지스트리가 필요합니다.

모든 읽기 호출은 로컬이고 저렴합니다: 커밋된 상태에 대한 이 노드의 뷰를 보고하며, 네트워크를 차단하지 않습니다.

### 노드 정체성

`system.node`는 클러스터에서 이 노드 자체의 정체성을 보고합니다.

```lua
local id, err = system.node.id()      -- 이 노드의 ID
local addr, err = system.node.addr()  -- 광고된 네트워크 주소
local role, err = system.node.role()  -- "leader" | "voter" | "standby" | "non-member"
```

| 함수 | 반환 | 비고 |
|----------|---------|-------|
| `system.node.id()` | `string, error` | 릴레이 컨텍스트의 노드 ID |
| `system.node.addr()` | `string, error` | 광고된 주소 (예: `10.0.0.1:7946`); 멤버십을 사용할 수 없으면 오류 |
| `system.node.role()` | `string, error` | 이 노드의 Raft 역할; Raft가 실행 중이 아니면 오류 없이 `"non-member"` 반환 |

**권한:** `node`에 대한 `system.read`.

### 클러스터 멤버십

`system.cluster`는 클러스터 전체 뷰를 보고합니다: 멤버가 누구이고 누가 리더인지.

```lua
local members, err = system.cluster.members()  -- 노드 테이블 배열
local leader, err = system.cluster.leader()    -- 리더 노드 ID, 또는 알 수 없으면 ""
local n, err = system.cluster.size()           -- 보이는 멤버 수
```

`system.cluster.members()`는 노드 테이블 배열을 반환합니다. 로컬 노드가 한 번 포함되고 먼저 정렬됩니다.

| 필드 | 타입 | 설명 |
|-------|------|------|
| `id` | string | 노드 ID |
| `is_local` | boolean | 호출 노드의 경우 true |
| `addr` | string | 광고된 주소 (알 수 없으면 생략) |
| `meta` | table | 문자열-문자열 gossip 메타데이터 (없으면 생략) |

| 함수 | 반환 | 비고 |
|----------|---------|-------|
| `system.cluster.members()` | `table[], error` | 멤버십 정보에 도달할 수 없으면 오류 |
| `system.cluster.leader()` | `string, error` | 현재 Raft 리더의 ID; 리더를 알 수 없거나 Raft가 없으면 `""` (오류 없음) |
| `system.cluster.size()` | `number, error` | 보이는 멤버 수; 멤버십 정보 없으면 `0` |

**권한:** `cluster`에 대한 `system.read`.

### Raft 상태

`system.raft`는 Raft 합의 코어에 대한 이 노드의 로컬 뷰를 읽습니다. 이 노드에서 Raft가 실행 중이 아니면 모든 함수가 `nil, error`("raft not available")를 반환합니다.

```lua
local leader, err = system.raft.is_leader()      -- boolean
local member, err = system.raft.is_member()      -- boolean: voter 또는 standby
local role, err = system.raft.role()             -- system.node.role()과 같은 값
local term, err = system.raft.term()             -- 현재 Raft 텀
local idx, err = system.raft.commit_index()      -- 가장 높은 커밋된 로그 인덱스
local stats, err = system.raft.stats()           -- 원시 통계 맵 (string -> string)
```

| 함수 | 반환 | 비고 |
|----------|---------|-------|
| `system.raft.is_leader()` | `boolean, error` | 이 노드가 현재 리더이면 true |
| `system.raft.is_member()` | `boolean, error` | 이 노드가 커밋된 구성에서 voter 또는 standby이면 true |
| `system.raft.role()` | `string, error` | `"leader"` / `"voter"` / `"standby"` / `"non-member"` |
| `system.raft.term()` | `number, error` | 현재 텀; 통계에서 사용할 수 없으면 `0` |
| `system.raft.commit_index()` | `number, error` | 이 노드의 가장 높은 커밋된 로그 인덱스 |
| `system.raft.stats()` | `table, error` | 전체 원시 통계 맵; 키와 값은 문자열 |

**권한:** `raft`에 대한 `system.read`, `system.raft.stats()`는 `raft_stats`에 대한 `system.read` 필요.

### 분산 잠금

`system.lock`은 클러스터 전체 상호 배제를 제공합니다. 잠금은 호출 프로세스가 소유한 전역 고유 이름입니다. Strong 이름 범위 위에 구축되어 클러스터 전체에 최대 하나의 보유자만 존재할 수 있으며, 보유자 프로세스가 종료되거나 해당 노드가 떠나면 잠금이 자동으로 해제됩니다 — 정리할 고착된 잠금이 없습니다.

```lua
local ok, err = system.lock.acquire("orders.migration")
if ok then
  -- critical section: only one holder cluster-wide
  system.lock.release("orders.migration")
end
```

획득은 실패-즉시 방식입니다: 잠금이 이미 보유 중이면 차단하는 대신 즉시 `false`를 반환하므로 호출자가 자체 재시도와 백오프를 구현합니다. 현재 보유자만 해제할 수 있습니다; 보유하지 않은 잠금을 해제하는 것은 안전한 no-op입니다.

| 함수 | 반환 | 결과 |
|----------|---------|----------|
| `system.lock.acquire(name)` | `boolean, error` | `true, nil` 획득됨; `false, error` 이미 보유됨 (종류 `errors.ALREADY_EXISTS`); `nil, error` 실패 시 |
| `system.lock.release(name)` | `boolean, error` | `true, nil` 해제됨; `false, nil` 보유하지 않거나 다른 프로세스가 보유; `nil, error` 실패 시 |

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `name` | string | 클러스터 전체 잠금 이름 |

**권한:** 잠금 `name`에 대한 `system.lock` (따라서 정책이 호출자가 잠글 수 있는 이름을 제한할 수 있음).

## 권한

시스템 작업은 보안 정책 평가 대상입니다.

| 액션 | 리소스 | 설명 |
|------|--------|------|
| `system.read` | `memory` | 메모리 통계 읽기 |
| `system.read` | `memory_limit` | 메모리 제한 읽기 |
| `system.control` | `memory_limit` | 메모리 제한 설정 |
| `system.read` | `gc_percent` | GC 비율 읽기 |
| `system.gc` | `gc` | 가비지 컬렉션 강제 실행 |
| `system.gc` | `gc_percent` | GC 비율 설정 |
| `system.read` | `goroutines` | 고루틴 수 읽기 |
| `system.read` | `gomaxprocs` | GOMAXPROCS 읽기 |
| `system.control` | `gomaxprocs` | GOMAXPROCS 설정 |
| `system.read` | `cpu` | CPU 수 읽기 |
| `system.read` | `pid` | 프로세스 ID 읽기 |
| `system.read` | `hostname` | 호스트명 읽기 |
| `system.read` | `cwd` | 작업 디렉토리 읽기 |
| `system.read` | `hosts` | 호스트 / 호스트 프로세스 목록 조회 |
| `system.read` | `modules` | 로드된 모듈 목록 조회 |
| `system.read` | `supervisor` | 슈퍼바이저 상태 읽기 |
| `system.read` | `node` | 이 노드의 정체성 읽기 |
| `system.read` | `cluster` | 클러스터 멤버십 및 리더 읽기 |
| `system.read` | `raft` | Raft 상태 읽기 |
| `system.read` | `raft_stats` | 원시 Raft 통계 맵 읽기 |
| `system.lock` | `<잠금 이름>` | 분산 잠금 획득 또는 해제 |
| `system.exit` | - | 시스템 셧다운 트리거 |

## 에러

| 조건 | 종류 | 재시도 가능 |
|------|------|-------------|
| 권한 거부됨 | `errors.INVALID` | 아니오 |
| 잘못된 인수 | `errors.INVALID` | 아니오 |
| 필수 인수 누락 | `errors.INVALID` | 아니오 |
| 코드 매니저 사용 불가 | `errors.INTERNAL` | 아니오 |
| 서비스 정보 사용 불가 | `errors.INTERNAL` | 아니오 |
| OS 오류 (호스트명, cwd) | `errors.INTERNAL` | 아니오 |
| 이 노드에서 Raft 미실행 | `errors.INTERNAL` | 아니오 |
| 멤버십 사용 불가 | `errors.INTERNAL` | 아니오 |
| 잠금 이미 보유됨 | `errors.ALREADY_EXISTS` | 아니오 |

에러 처리는 [에러 처리](lua/core/errors.md)를 참조하세요.
