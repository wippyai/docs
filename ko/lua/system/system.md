# 시스템
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="permissions"/>

메모리 사용량, 가비지 컬렉션 통계, CPU 정보, 프로세스 메타데이터를 포함한 런타임 시스템 정보를 조회합니다.

## 로딩

```lua
local system = require("system")
```

## 종료

종료 코드와 함께 시스템 종료를 트리거합니다. 터미널 앱에 유용합니다. 실행 중인 액터에서 호출하면 전체 시스템이 종료됩니다:

```lua
local ok, err = system.exit(0)
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `code` | integer | 종료 코드 (0 = 성공), 기본값 0 |

**반환:** `boolean, error`

## 모듈 목록

메타데이터와 함께 로드된 모든 Lua 모듈을 가져옵니다:

```lua
local mods, err = system.modules()
```

**반환:** `table[], error`

각 모듈 테이블에는 다음이 포함됩니다:

| 필드 | 타입 | 설명 |
|------|------|------|
| `name` | string | 모듈 이름 |
| `description` | string | 모듈 설명 |
| `class` | string[] | 모듈 분류 태그 |

## 메모리 통계

상세한 메모리 통계를 가져옵니다:

```lua
local stats, err = system.memory.stats()
```

**반환:** `table, error`

통계 테이블에는 다음이 포함됩니다:

| 필드 | 타입 | 설명 |
|------|------|------|
| `alloc` | number | 할당되어 사용 중인 바이트 |
| `total_alloc` | number | 누적 할당 바이트 |
| `sys` | number | 시스템에서 얻은 바이트 |
| `heap_alloc` | number | 힙에 할당된 바이트 |
| `heap_sys` | number | 힙을 위해 시스템에서 얻은 바이트 |
| `heap_idle` | number | 유휴 스팬의 바이트 |
| `heap_in_use` | number | 비유휴 스팬의 바이트 |
| `heap_released` | number | OS에 반환된 바이트 |
| `heap_objects` | number | 할당된 힙 객체 수 |
| `stack_in_use` | number | 스택 할당자가 사용하는 바이트 |
| `stack_sys` | number | 스택을 위해 시스템에서 얻은 바이트 |
| `mspan_in_use` | number | 사용 중인 mspan 구조체 바이트 |
| `mspan_sys` | number | mspan을 위해 시스템에서 얻은 바이트 |
| `num_gc` | number | 완료된 GC 사이클 수 |
| `next_gc` | number | 다음 GC를 위한 목표 힙 크기 |

## 현재 할당량

현재 할당된 바이트를 가져옵니다:

```lua
local bytes, err = system.memory.allocated()
```

**반환:** `number, error`

## 힙 객체

할당된 힙 객체 수를 가져옵니다:

```lua
local count, err = system.memory.heap_objects()
```

**반환:** `number, error`

## 메모리 제한

메모리 제한을 설정합니다 (이전 값 반환):

```lua
local prev, err = system.memory.set_limit(1024 * 1024 * 100)
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `limit` | integer | 바이트 단위 메모리 제한, -1은 무제한 |

**반환:** `number, error`

현재 메모리 제한을 가져옵니다:

```lua
local limit, err = system.memory.get_limit()
```

**반환:** `number, error`

## 강제 GC

가비지 컬렉션을 강제 실행합니다:

```lua
local ok, err = system.gc.collect()
```

**반환:** `boolean, error`

## GC 목표 퍼센트

GC 목표 퍼센트를 설정합니다 (이전 값 반환). 100 값은 힙이 두 배가 될 때 GC가 트리거됨을 의미합니다:

```lua
local prev, err = system.gc.set_percent(200)
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `percent` | integer | GC 목표 퍼센트 |

**반환:** `number, error`

현재 GC 목표 퍼센트를 가져옵니다:

```lua
local percent, err = system.gc.get_percent()
```

**반환:** `number, error`

## 고루틴 수

활성 고루틴 수를 가져옵니다:

```lua
local count, err = system.runtime.goroutines()
```

**반환:** `number, error`

## GOMAXPROCS

GOMAXPROCS 값을 가져오거나 설정합니다:

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

논리 CPU 수를 가져옵니다:

```lua
local cpus, err = system.runtime.cpu_count()
```

**반환:** `number, error`

## 프로세스 ID

현재 프로세스 ID를 가져옵니다:

```lua
local pid, err = system.process.pid()
```

**반환:** `number, error`

## 호스트명

시스템 호스트명을 가져옵니다:

```lua
local hostname, err = system.process.hostname()
```

**반환:** `string, error`

## 서비스 상태

특정 감독 서비스의 상태를 가져옵니다:

```lua
local state, err = system.supervisor.state("namespace:service")
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `service_id` | string | 서비스 ID (예: "namespace:service") |

**반환:** `table, error`

상태 테이블에는 다음이 포함됩니다:

| 필드 | 타입 | 설명 |
|------|------|------|
| `id` | string | 서비스 ID |
| `status` | string | 현재 상태 |
| `desired` | string | 원하는 상태 |
| `retry_count` | number | 재시도 횟수 |
| `last_update` | number | 마지막 업데이트 타임스탬프 (나노초) |
| `started_at` | number | 시작 타임스탬프 (나노초) |
| `details` | string | 선택적 상세 정보 (포맷됨) |

## 모든 서비스 상태

모든 감독 서비스의 상태를 가져옵니다:

```lua
local states, err = system.supervisor.states()
```

**반환:** `table[], error`

각 상태 테이블은 `system.supervisor.state()`와 동일한 형식입니다.

## 권한

시스템 작업은 보안 정책 평가 대상입니다.

| 액션 | 리소스 | 설명 |
|------|--------|------|
| `system.read` | `memory` | 메모리 통계 읽기 |
| `system.read` | `memory_limit` | 메모리 제한 읽기 |
| `system.control` | `memory_limit` | 메모리 제한 설정 |
| `system.read` | `gc_percent` | GC 퍼센트 읽기 |
| `system.gc` | `gc` | 가비지 컬렉션 강제 실행 |
| `system.gc` | `gc_percent` | GC 퍼센트 설정 |
| `system.read` | `goroutines` | 고루틴 수 읽기 |
| `system.read` | `gomaxprocs` | GOMAXPROCS 읽기 |
| `system.control` | `gomaxprocs` | GOMAXPROCS 설정 |
| `system.read` | `cpu` | CPU 수 읽기 |
| `system.read` | `pid` | 프로세스 ID 읽기 |
| `system.read` | `hostname` | 호스트명 읽기 |
| `system.read` | `modules` | 로드된 모듈 목록 |
| `system.read` | `supervisor` | 수퍼바이저 상태 읽기 |
| `system.exit` | - | 시스템 종료 트리거 |

## 에러

| 조건 | 종류 | 재시도 가능 |
|------|------|-------------|
| 권한 거부됨 | `errors.PERMISSION_DENIED` | 아니오 |
| 잘못된 인수 | `errors.INVALID` | 아니오 |
| 필수 인수 누락 | `errors.INVALID` | 아니오 |
| 코드 매니저 사용 불가 | `errors.INTERNAL` | 아니오 |
| 서비스 정보 사용 불가 | `errors.INTERNAL` | 아니오 |
| 호스트명 가져오기 OS 에러 | `errors.INTERNAL` | 아니오 |

에러 처리는 [에러 처리](lua/core/errors.md)를 참조하세요.
