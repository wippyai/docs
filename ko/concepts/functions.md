# 함수

함수는 동기적이고 상태 비저장 엔트리 포인트입니다. 호출하면 실행되고 결과를 반환합니다. 함수가 실행될 때 호출자의 컨텍스트를 상속받습니다. 호출자가 취소하면 함수도 취소됩니다. 이로 인해 함수는 HTTP 핸들러, API 엔드포인트, 요청 라이프사이클 내에서 완료되어야 하는 모든 작업에 이상적입니다.

## 함수 호출

`funcs.call()`로 동기적으로 함수를 호출합니다:

```lua
local funcs = require("funcs")
local result, err = funcs.call("app.api:get_user", user_id)
```

논블로킹 실행에는 `funcs.async()`를 사용합니다:

```lua
local future = funcs.async("app.process:analyze", data)

local ch = future:response()
local result, ok = ch:receive()
```

전체 API는 [funcs 모듈](lua-funcs.md)을 참조하세요.

## 컨텍스트 전파

각 호출은 자체 컨텍스트 스코프를 가진 프레임을 생성합니다. 자식 함수는 명시적 전달 없이 부모 컨텍스트를 상속받습니다:

```lua
local ctx = require("ctx")

local trace_id = ctx.get("trace_id")
local user_id = ctx.get("user_id")
```

호출 시 컨텍스트 추가:

```lua
local exec = funcs.new()
    :with_context({trace_id = "abc-123"})
    :call("app.api:process", data)
```

보안 컨텍스트도 같은 방식으로 전파됩니다. 호출된 함수는 호출자의 액터를 보고 권한을 확인할 수 있습니다. 접근 제어 API는 [보안 모듈](lua-security.md)을 참조하세요.

## 레지스트리 정의

레지스트리 수준에서 함수 엔트리는 다음과 같습니다:

```yaml
- name: get_user
  kind: function.lua
  source: file://handlers/user.lua
  method: get
  pool:
    type: lazy
    max_size: 16
```

함수는 다른 런타임 컴포넌트(HTTP 핸들러, 큐 컨슈머, 스케줄된 작업)에 의해 호출될 수 있으며, 호출자의 보안 컨텍스트에 따른 권한 검사 대상입니다.

## 풀

함수는 실행을 관리하는 풀에서 실행됩니다. 풀 타입은 스케일링 동작을 결정합니다.

**Inline**은 호출자의 고루틴에서 실행됩니다. 동시성 없음, 할당 오버헤드 제로. 임베디드 컨텍스트에 사용됩니다.

**Static**은 고정된 수의 워커를 유지합니다. 모든 워커가 바쁘면 요청이 큐에 들어갑니다. 예측 가능한 리소스 사용량.

```yaml
pool:
  type: static
  workers: 8
  buffer: 512
```

**Lazy**는 비어 있는 상태로 시작하고 필요에 따라 워커를 생성합니다. 유휴 워커는 타임아웃 후 삭제됩니다. 가변 트래픽에 효율적.

```yaml
pool:
  type: lazy
  max_size: 32
```

**Adaptive**는 처리량에 따라 자동으로 스케일링합니다. 컨트롤러가 성능을 측정하고 현재 부하에 최적화하도록 워커 수를 조정합니다.

```yaml
pool:
  type: adaptive
  max_size: 256
```

<tip>
풀 타입을 지정하지 않으면 런타임이 설정에 따라 선택합니다. `workers`는 static, `max_size`는 lazy, 또는 명시적으로 `type`을 설정하여 완전한 제어가 가능합니다.
</tip>

## 인터셉터

함수 호출은 인터셉터 체인을 통과합니다. 인터셉터는 비즈니스 로직을 건드리지 않고 횡단 관심사를 처리합니다.

```yaml
- name: my_function
  kind: function.lua
  source: file://handler.lua
  method: main
  meta:
    options:
      retry:
        max_attempts: 3
        initial_delay: 100
        backoff_factor: 2.0
```

내장 인터셉터에는 지수 백오프가 있는 재시도가 포함됩니다. 로깅, 메트릭, 트레이싱, 인증, 서킷 브레이킹, 요청 변환을 위한 커스텀 인터셉터를 추가할 수 있습니다.

체인은 각 호출 전후에 실행됩니다. 각 인터셉터는 요청을 수정하거나, 실행을 단축하거나, 응답을 래핑할 수 있습니다.

## 컨트랙트

함수는 입력/출력 스키마를 컨트랙트로 노출할 수 있습니다. 컨트랙트는 런타임 검증과 문서 생성을 가능하게 하는 메서드 시그니처를 정의합니다.

```lua
local contract = require("contract")
local email = contract.get("app.email:sender")
email:send({to = "user@example.com", subject = "Hello"})
```

이 추상화는 호출 코드를 변경하지 않고 구현을 교체할 수 있게 합니다. 테스트, 멀티 테넌트 배포, 점진적 마이그레이션에 유용합니다.

## 함수 vs 프로세스

함수는 호출자 컨텍스트를 상속받고 호출자 라이프사이클에 연결됩니다. 호출자가 취소하면 함수도 취소됩니다. 이를 통해 HTTP 핸들러와 큐 컨슈머에서 직접 실행하는 엣지 실행이 가능합니다.

프로세스는 호스트 컨텍스트로 독립적으로 실행됩니다. 생성자보다 오래 살고 메시지를 통해 통신합니다. 백그라운드 작업에는 프로세스를, 요청 범위 작업에는 함수를 사용하세요.
