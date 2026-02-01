# 프로세스 관리
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>
<secondary-label ref="permissions"/>

자식 프로세스를 스폰, 모니터링, 통신합니다. 메시지 전달, 슈퍼비전, 라이프사이클 관리를 갖춘 액터 모델 패턴을 구현합니다.

`process` 전역은 항상 사용 가능합니다.

## 프로세스 정보

현재 프레임 ID 또는 프로세스 ID 가져오기:

```lua
local frame_id = process.id()  -- 호출 체인 식별자
local pid = process.pid()       -- 프로세스 ID
```

## 메시지 보내기

PID 또는 등록된 이름으로 프로세스에 메시지 보내기:

```lua
local ok, err = process.send(destination, topic, ...)
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `destination` | string | PID 또는 등록된 이름 |
| `topic` | string | 토픽 이름 (`@`로 시작 불가) |
| `...` | any | 페이로드 값 |

**권한:** 대상 PID에 대해 `process.send`

## 프로세스 스폰

```lua
-- 기본 스폰
local pid, err = process.spawn(id, host, ...)

-- 모니터링과 함께 (EXIT 이벤트 수신)
local pid, err = process.spawn_monitored(id, host, ...)

-- 연결과 함께 (비정상 종료 시 LINK_DOWN 수신)
local pid, err = process.spawn_linked(id, host, ...)

-- 연결 및 모니터링 둘 다
local pid, err = process.spawn_linked_monitored(id, host, ...)
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `id` | string | 프로세스 소스 ID (예: `"app.workers:handler"`) |
| `host` | string | 호스트 ID (예: `"app:processes"`) |
| `...` | any | 스폰된 프로세스에 전달되는 인자 |

**권한:**
- 프로세스 id에 대해 `process.spawn`
- 호스트 id에 대해 `process.host`
- 모니터링 변형의 경우 프로세스 id에 대해 `process.spawn.monitored`
- 연결 변형의 경우 프로세스 id에 대해 `process.spawn.linked`

## 프로세스 제어

```lua
-- 프로세스 강제 종료
local ok, err = process.terminate(destination)

-- 선택적 데드라인과 함께 우아한 취소 요청
local ok, err = process.cancel(destination, "5s")
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `destination` | string | PID 또는 등록된 이름 |
| `deadline` | string\|integer | 기간 문자열 또는 밀리초 |

**권한:** 대상 PID에 대해 `process.terminate`, `process.cancel`

## 모니터링과 연결

기존 프로세스를 모니터링하거나 연결:

```lua
-- 모니터링: 대상 종료 시 EXIT 이벤트 수신
local ok, err = process.monitor(destination)
local ok, err = process.unmonitor(destination)

-- 연결: 양방향, 비정상 종료 시 LINK_DOWN 수신
local ok, err = process.link(destination)
local ok, err = process.unlink(destination)
```

**권한:** 대상 PID에 대해 `process.monitor`, `process.unmonitor`, `process.link`, `process.unlink`

## 프로세스 옵션

```lua
local options = process.get_options()
local ok, err = process.set_options({trap_links = true})
```

| 필드 | 타입 | 설명 |
|------|------|------|
| `trap_links` | boolean | LINK_DOWN 이벤트가 이벤트 채널에 전달되는지 여부 |

## 인박스와 이벤트

메시지와 라이프사이클 이벤트를 받기 위한 채널 가져오기:

```lua
local inbox = process.inbox()    -- @inbox 토픽의 메시지 객체
local events = process.events()  -- @events 토픽의 라이프사이클 이벤트
```

### 이벤트 유형

| 상수 | 설명 |
|------|------|
| `process.event.CANCEL` | 취소 요청됨 |
| `process.event.EXIT` | 모니터링되는 프로세스 종료 |
| `process.event.LINK_DOWN` | 연결된 프로세스 비정상 종료 |

### 이벤트 필드

| 필드 | 타입 | 설명 |
|------|------|------|
| `kind` | string | 이벤트 유형 상수 |
| `from` | string | 소스 PID |
| `result` | table | EXIT의 경우: `{value: any}` 또는 `{error: string}` |
| `deadline` | string | CANCEL의 경우: 데드라인 타임스탬프 |

## 토픽 구독

커스텀 토픽 구독:

```lua
local ch = process.listen(topic, options)
process.unlisten(ch)
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `topic` | string | 토픽 이름 (`@`로 시작 불가) |
| `options.message` | boolean | true이면 Message 객체 수신; false이면 raw 페이로드 |

## 메시지 객체

인박스 또는 `{message = true}`로 수신 시:

```lua
local msg = inbox:receive()

msg:topic()    -- string: 토픽 이름
msg:from()     -- string|nil: 발신자 PID
msg:payload()  -- any: 페이로드 데이터
```

## 동기 호출

프로세스를 스폰하고 결과를 기다려서 반환:

```lua
local result, err = process.call(id, host, ...)
```

**권한:** 프로세스 id에 대해 `process.call`, 호스트 id에 대해 `process.host`

## 프로세스 업그레이드

PID를 보존하면서 현재 프로세스를 새 정의로 업그레이드:

```lua
-- 상태를 전달하면서 새 버전으로 업그레이드
process.upgrade(source, ...)

-- 같은 정의 유지, 새 상태로 재실행
process.upgrade(nil, preserved_state)
```

## 컨텍스트 Spawner

자식 프로세스를 위한 커스텀 컨텍스트로 spawner 생성:

```lua
local spawner = process.with_context({request_id = "123"})
```

**권한:** "context"에 대해 `process.context`

### SpawnBuilder 메서드

SpawnBuilder는 불변 - 각 메서드는 새 인스턴스 반환:

```lua
spawner:with_context(values)      -- 컨텍스트 값 추가
spawner:with_actor(actor)         -- 보안 액터 설정
spawner:with_scope(scope)         -- 보안 스코프 설정
spawner:with_name(name)           -- 프로세스 이름 설정
spawner:with_message(topic, ...)  -- 스폰 후 보낼 메시지 큐
```

**권한:** `:with_actor()` 및 `:with_scope()`의 경우 "security"에 대해 `process.security`

### Spawner 스폰 메서드

```lua
spawner:spawn(id, host, ...)
spawner:spawn_monitored(id, host, ...)
spawner:spawn_linked(id, host, ...)
spawner:spawn_linked_monitored(id, host, ...)
```

모듈 수준 스폰 함수와 동일한 권한.

## 이름 레지스트리

이름으로 프로세스 등록 및 조회:

```lua
local ok, err = process.registry.register(name, pid)  -- pid 기본값은 self
local pid, err = process.registry.lookup(name)
local ok = process.registry.unregister(name)
```

**권한:** 이름에 대해 `process.registry.register`, `process.registry.unregister`

## 권한

권한은 호출 프로세스가 할 수 있는 것을 제어합니다. 모든 검사는 대상 리소스에 대해 호출자의 보안 컨텍스트(액터)를 사용합니다.

### 정책 평가

정책은 다음을 기반으로 허용/거부할 수 있습니다:
- **액터**: 요청을 만드는 보안 주체
- **액션**: 수행되는 작업 (예: `process.send`)
- **리소스**: 대상 (PID, 프로세스 id, 호스트 id, 또는 이름)
- **속성**: `pid` (호출자의 프로세스 ID)를 포함한 추가 컨텍스트

### 권한 참조

| 권한 | 함수 | 리소스 |
|------|------|--------|
| `process.spawn` | `spawn*()` | 프로세스 id |
| `process.spawn.monitored` | `spawn_monitored()`, `spawn_linked_monitored()` | 프로세스 id |
| `process.spawn.linked` | `spawn_linked()`, `spawn_linked_monitored()` | 프로세스 id |
| `process.host` | `spawn*()`, `call()` | 호스트 id |
| `process.send` | `send()` | 대상 PID |
| `process.call` | `call()` | 프로세스 id |
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

### 다중 권한

일부 작업은 여러 권한이 필요합니다:

| 작업 | 필요한 권한 |
|------|------------|
| `spawn()` | `process.spawn` + `process.host` |
| `spawn_monitored()` | `process.spawn` + `process.spawn.monitored` + `process.host` |
| `spawn_linked()` | `process.spawn` + `process.spawn.linked` + `process.host` |
| `spawn_linked_monitored()` | `process.spawn` + `process.spawn.monitored` + `process.spawn.linked` + `process.host` |
| `call()` | `process.call` + `process.host` |
| 커스텀 액터/스코프로 스폰 | 스폰 권한 + `process.security` |

## 에러

| 조건 | 종류 |
|------|------|
| 컨텍스트를 찾을 수 없음 | `errors.INVALID` |
| 프레임 컨텍스트를 찾을 수 없음 | `errors.INVALID` |
| 필수 인자 누락 | `errors.INVALID` |
| 예약된 토픽 접두사 (`@`) | `errors.INVALID` |
| 잘못된 기간 형식 | `errors.INVALID` |
| 이름이 등록되지 않음 | `errors.NOT_FOUND` |
| 권한 거부됨 | `errors.PERMISSION_DENIED` |
| 이름이 이미 등록됨 | `errors.ALREADY_EXISTS` |

에러 처리는 [에러 처리](lua/core/errors.md)를 참조하세요.

## 참고

- [채널](lua/core/channel.md) - 프로세스 간 통신
- [메시지 큐](lua/storage/queue.md) - 큐 기반 메시징
- [함수](lua/core/funcs.md) - 함수 호출
- [슈퍼비전](guides/supervision.md) - 프로세스 라이프사이클 관리
