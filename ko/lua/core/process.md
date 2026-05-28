# 프로세스 관리
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>
<secondary-label ref="permissions"/>

자식 프로세스를 스폰하고 모니터링하며 통신합니다. 메시지 전달, 슈퍼비전, 라이프사이클 관리를 갖춘 액터 모델 패턴을 구현합니다.

`process` 전역은 항상 사용 가능합니다 — `require()`가 필요 없으며 `modules:`에 나열할 필요가 없습니다.

## 프로세스 정보

현재 프레임 ID 또는 프로세스 ID 가져오기:

```lua
local frame_id = process.id()  -- 호출 체인 식별자
local pid = process.pid()       -- 프로세스 ID
```

## 메시지 전송

PID 또는 등록된 이름으로 프로세스에 메시지 전송:

```lua
local ok, err = process.send(destination, topic, ...)
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `destination` | string | PID 또는 등록된 이름 |
| `topic` | string | 토픽 이름 (`@`로 시작할 수 없음) |
| `...` | any | 페이로드 값 |

**권한:** 대상 PID에 대한 `process.send`

## 프로세스 스폰

```lua
-- 기본 스폰
local pid, err = process.spawn(id, host, ...)

-- 모니터링과 함께 (EXIT 이벤트 수신)
local pid, err = process.spawn_monitored(id, host, ...)

-- 링킹과 함께 (비정상 종료 시 LINK_DOWN 수신)
local pid, err = process.spawn_linked(id, host, ...)

-- 링킹과 모니터링 모두
local pid, err = process.spawn_linked_monitored(id, host, ...)
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `id` | string | 프로세스 소스 ID (예: `"app.workers:handler"`) |
| `host` | string | 호스트 ID (예: `"app:processes"`) |
| `...` | any | 스폰된 프로세스에 전달되는 인수 |

**권한:**
- 프로세스 id에 대한 `process.spawn`
- 호스트 id에 대한 `process.host`
- 모니터링 변형에 대해 프로세스 id의 `process.spawn.monitored`
- 링킹 변형에 대해 프로세스 id의 `process.spawn.linked`

## 프로세스 제어

```lua
-- 프로세스 강제 종료
local ok, err = process.terminate(destination)

-- 선택적 이유와 함께 그레이스풀 취소 요청
local ok, err = process.cancel(destination, "shutting down")
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `destination` | string | PID 또는 등록된 이름 |
| `reason` | string | 대상에게 전달되는 선택적 이유 |

**권한:** 대상 PID에 대한 `process.terminate`, `process.cancel`

## 모니터링 및 링킹

기존 프로세스 모니터링 또는 링킹:

```lua
-- 모니터링: 대상 종료 시 EXIT 이벤트 수신
local ok, err = process.monitor(destination)
local ok, err = process.unmonitor(destination)

-- 링킹: 양방향, 비정상 종료 시 LINK_DOWN 수신
local ok, err = process.link(destination)
local ok, err = process.unlink(destination)
```

**권한:** 대상 PID에 대한 `process.monitor`, `process.unmonitor`, `process.link`, `process.unlink`

## 프로세스 옵션

```lua
local options = process.get_options()
local ok, err = process.set_options({trap_links = true})
```

| 필드 | 타입 | 설명 |
|-------|------|------|
| `trap_links` | boolean | LINK_DOWN 이벤트를 이벤트 채널로 전달할지 여부 |

## 인박스 및 이벤트

메시지와 라이프사이클 이벤트를 수신하기 위한 채널 가져오기:

```lua
local inbox = process.inbox()    -- @inbox 토픽의 메시지 객체
local events = process.events()  -- @events 토픽의 라이프사이클 이벤트
```

### 이벤트 타입

| 상수 | 설명 |
|----------|-------------|
| `process.event.CANCEL` | 취소 요청됨 |
| `process.event.EXIT` | 모니터링된 프로세스 종료 |
| `process.event.LINK_DOWN` | 링크된 프로세스가 비정상 종료됨 |

### 이벤트 필드

| 필드 | 타입 | 설명 |
|-------|------|------|
| `kind` | string | 이벤트 타입 상수 |
| `from` | string | 소스 PID |
| `result` | table | EXIT의 경우: `{value: any}` 또는 `{error: string}` |
| `reason` | string | CANCEL의 경우: 프로세스가 취소되는 이유 |

## 토픽 구독

커스텀 토픽 구독:

```lua
local ch = process.listen(topic, options)
process.unlisten(ch)
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `topic` | string | 토픽 이름 (`@`로 시작할 수 없음) |
| `options.message` | boolean | true이면 Message 객체 수신; false이면 원시 페이로드 |

## 메시지 객체

인박스 또는 `{message = true}`로 수신할 때:

```lua
local msg = inbox:receive()

msg:topic()            -- string: 토픽 이름
msg:from()             -- string|nil: 발신자 PID
msg:payload()          -- Payload: 래퍼 (:data() 호출로 추출)
msg:payload():data()   -- any: 실제 페이로드 값
```

## 동기 호출

프로세스를 스폰하고 결과를 기다렸다가 반환:

```lua
local result, err = process.exec(id, host, ...)
```

**권한:** 프로세스 id에 대한 `process.exec`, 호스트 id에 대한 `process.host`

## 프로세스 업그레이드

PID를 보존하면서 현재 프로세스를 새 정의로 업그레이드:

```lua
-- 상태를 전달하며 새 버전으로 업그레이드
process.upgrade(id, ...)

-- 같은 정의를 유지하며 새 상태로 재실행
process.upgrade(nil, preserved_state)
```

## 컨텍스트 스포너

자식 프로세스를 위한 커스텀 컨텍스트가 있는 스포너 생성:

```lua
local spawner = process.with_context({request_id = "123"})
```

**권한:** "context"에 대한 `process.context`

### 옵션이 있는 스포너

`process.with_options(options)`는 컨텍스트 값 대신 스폰 시 옵션(예: 네트워크 선택자)을 가진 스포너를 생성합니다:

```lua
local spawner = process.with_options({network = "app:tor_proxy"})
```

| 옵션 | 타입 | 설명 |
|--------|------|------|
| `network` | string | 자식의 아웃바운드 연결에 사용할 `network.*` 엔트리의 레지스트리 ID |

**권한:** "context"에 대한 `process.context`; 네트워크를 선택하면 해당 네트워크 ID에 대한 `network.select`가 추가로 필요합니다.

### SpawnBuilder 메서드

SpawnBuilder는 불변입니다 — 각 메서드는 새 인스턴스를 반환합니다:

```lua
spawner:with_context(values)      -- 컨텍스트 값 추가
spawner:with_actor(actor)         -- 보안 액터 설정
spawner:with_scope(scope)         -- 보안 범위 설정
spawner:with_name(name)           -- 프로세스 이름 설정
spawner:with_message(topic, ...)  -- 스폰 후 전송할 메시지 큐에 추가
```

**권한:** `:with_actor()`와 `:with_scope()`에 대해 "security"에 대한 `process.security`

### 스포너 스폰 메서드

```lua
spawner:spawn(id, host, ...)
spawner:spawn_monitored(id, host, ...)
spawner:spawn_linked(id, host, ...)
spawner:spawn_linked_monitored(id, host, ...)
```

모듈 수준 스폰 함수와 동일한 권한.

## 이름 레지스트리

프로세스를 이름으로 등록하고 PID 대신 해당 이름으로 도달합니다. `destination`을 받는 모든 함수(`send`, `terminate`, `cancel`, `monitor`, `link`, ...)는 PID 대신 등록된 이름을 허용합니다.

```lua
local ok, err = process.registry.register(name)               -- 자신, 로컬 범위
local pid, err = process.registry.lookup(name)
local ok, err = process.registry.unregister(name)
```

### 범위

선택적 `scope` 인수는 이름의 일관성 보장을 선택합니다. 기본값은 `LOCAL`입니다. 네 가지 범위와 그 보장은 [클러스터 가이드](guides/cluster.md#명명-및-이름-범위)에 설명되어 있습니다; 간략히:

| 상수 | 가시성 | 보장 |
|----------|------------|-----------|
| `process.registry.LOCAL` | 이 노드만 | 즉각적, 노드-로컬 |
| `process.registry.EVENTUAL` | 클러스터 전체 | 결과적 일관성 (gossip) |
| `process.registry.CONSISTENT` | 클러스터 전체 | 선형화 가능한 싱글톤 (Raft) |
| `process.registry.STRONG` | 클러스터 전체 | Consistent + 모든 살아있는 노드 승인 |

단독 노드에서는 `LOCAL`만 의미가 있습니다; 클러스터 범위는 [클러스터링](guides/cluster.md)이 필요합니다.

### register

```lua
local ok, err = process.registry.register(name, scope, pid)
```

| 파라미터 | 타입 | 필수 | 기본값 | 설명 |
|----------|------|------|---------|------|
| `name` | string | 예 | | 등록할 이름 |
| `scope` | number | 아니오 | `LOCAL` | 위의 범위 상수 중 하나 |
| `pid` | string | 아니오 | 자신 | 등록할 PID; 기본값은 호출 프로세스 |

성공 시 `true`를 반환하고, 실패 시 `nil, error`를 반환합니다. 충돌(다른 PID로 클러스터 범위에 이미 등록된 이름)은 `errors.ALREADY_EXISTS`를 반환합니다. 동일한 PID로 같은 이름을 등록하면 멱등합니다. `STRONG` 등록은 모든 살아있는 노드가 승인하거나 예약 데드라인이 만료될 때까지 차단됩니다; 타임아웃 시 오류를 반환합니다.

다른 PID를 대신하여 등록하면 대상 PID에 대한 `process.registry.foreign` 권한이 추가로 필요합니다.

### lookup

```lua
local pid, err = process.registry.lookup(name)
```

등록된 PID 문자열을 반환하거나, 이름이 등록되지 않은 경우 `nil, error`를 `errors.NOT_FOUND` 종류와 함께 반환합니다.

### unregister

```lua
local ok, err = process.registry.unregister(name, scope)
```

`scope`는 기본값이 `LOCAL`이며 이름이 등록된 범위와 일치해야 합니다. `CONSISTENT`와 `STRONG`의 경우, 소유 프로세스만 등록 해제할 수 있습니다; 다른 PID가 소유한 이름을 등록 해제하면 `false`를 반환합니다. 이름은 소유 프로세스가 종료될 때(그리고 클러스터 범위의 경우 해당 노드가 떠날 때) 자동으로 해제되므로, 명시적인 등록 해제는 조기 해제에 사용됩니다.

## 권한

권한은 호출 프로세스가 할 수 있는 것을 제어합니다. 모든 검사는 호출자의 보안 컨텍스트(액터)를 대상 리소스에 대해 사용합니다.

### 정책 평가

정책은 다음을 기반으로 허용/거부할 수 있습니다:
- **액터**: 요청을 하는 보안 주체
- **액션**: 수행되는 작업 (예: `process.send`)
- **리소스**: 대상 (PID, 프로세스 id, 호스트 id, 또는 이름)
- **속성**: `pid` (호출자의 프로세스 ID)를 포함한 추가 컨텍스트

### 권한 레퍼런스

| 권한 | 함수 | 리소스 |
|------------|-----------|----------|
| `process.spawn` | `spawn*()` | 프로세스 id |
| `process.spawn.monitored` | `spawn_monitored()`, `spawn_linked_monitored()` | 프로세스 id |
| `process.spawn.linked` | `spawn_linked()`, `spawn_linked_monitored()` | 프로세스 id |
| `process.host` | `spawn*()`, `exec()` | 호스트 id |
| `process.send` | `send()` | 대상 PID |
| `process.exec` | `exec()` | 프로세스 id |
| `process.terminate` | `terminate()` | 대상 PID |
| `process.cancel` | `cancel()` | 대상 PID |
| `process.monitor` | `monitor()` | 대상 PID |
| `process.unmonitor` | `unmonitor()` | 대상 PID |
| `process.link` | `link()` | 대상 PID |
| `process.unlink` | `unlink()` | 대상 PID |
| `process.context` | `with_context()` | "context" |
| `process.security` | `:with_actor()`, `:with_scope()` | "security" |
| `process.registry.register` | `registry.register()` | 이름 |
| `process.registry.unregister` | `registry.unregister()` | 이름 |
| `process.registry.foreign` | `registry.register()` | 대상 PID |

클러스터 이름 범위는 이러한 액션의 범위-접미사 변형(`process.registry.register.eventual`, `.consistent`, `.strong`, 그리고 일치하는 `unregister` 액션)으로 권한이 부여되므로, 정책이 클러스터 전체 명명과 별도로 로컬 명명을 허용할 수 있습니다.

### 다중 권한

일부 작업에는 여러 권한이 필요합니다:

| 작업 | 필요한 권한 |
|-----------|---------------------|
| `spawn()` | `process.spawn` + `process.host` |
| `spawn_monitored()` | `process.spawn` + `process.spawn.monitored` + `process.host` |
| `spawn_linked()` | `process.spawn` + `process.spawn.linked` + `process.host` |
| `spawn_linked_monitored()` | `process.spawn` + `process.spawn.monitored` + `process.spawn.linked` + `process.host` |
| `exec()` | `process.exec` + `process.host` |
| 커스텀 액터/범위로 스폰 | 스폰 권한 + `process.security` |

## 에러

| 조건 | 종류 |
|-----------|------|
| 컨텍스트 없음 | `errors.INVALID` |
| 프레임 컨텍스트 없음 | `errors.INVALID` |
| 필수 인수 누락 | `errors.INVALID` |
| 예약된 토픽 접두사 (`@`) | `errors.INVALID` |
| 잘못된 duration 형식 | `errors.INVALID` |
| 이름 미등록 | `errors.NOT_FOUND` |
| 권한 거부됨 | `errors.PERMISSION_DENIED` |
| 이름 이미 등록됨 | `errors.ALREADY_EXISTS` |

에러 처리는 [에러 처리](lua/core/errors.md)를 참조하세요.

## 참고

- [채널](lua/core/channel.md) - 프로세스 간 통신
- [메시지 큐](lua/storage/queue.md) - 큐 기반 메시징
- [함수](lua/core/funcs.md) - 함수 호출
- [슈퍼비전](guides/supervision.md) - 프로세스 라이프사이클 관리
- [클러스터](guides/cluster.md) - 이름 범위와 클러스터 전체 명명
