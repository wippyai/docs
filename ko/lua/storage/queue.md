# 메시지 큐
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>
<secondary-label ref="permissions"/>

분산 큐에서 메시지를 발행하고 소비합니다. RabbitMQ 및 기타 AMQP 호환 브로커를 포함한 여러 백엔드를 지원합니다.

큐 설정은 [큐](system/queue.md)를 참조하세요.

## 로딩

```lua
local queue = require("queue")
```

## 메시지 발행

ID로 큐에 메시지 보내기:

```lua
local ok, err = queue.publish("app:tasks", {
    action = "send_email",
    user_id = 456,
    template = "welcome"
})
if err then
    return nil, err
end
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `queue_id` | string | 큐 식별자 (형식: "namespace:name") |
| `data` | any | 메시지 데이터 (테이블, 문자열, 숫자, 불리언) |
| `headers` | table | 선택적 메시지 헤더 |

**반환:** `boolean, error`

### 메시지 헤더

헤더는 라우팅, 우선순위, 추적을 가능하게 합니다:

```lua
queue.publish("app:notifications", {
    type = "order_shipped",
    order_id = order.id
}, {
    priority = "high",
    correlation_id = request_id
})
```

## 전달 컨텍스트 접근

큐 컨슈머 내에서 현재 메시지에 접근:

```lua
local msg, err = queue.message()
if err then
    return nil, err
end

local msg_id = msg:id()
local priority = msg:header("priority")
local all_headers = msg:headers()
```

**반환:** `Message, error`

컨슈머 컨텍스트에서 큐 메시지를 처리할 때만 사용 가능합니다.

## 메시지 메서드

| 메서드 | 반환 | 설명 |
|--------|------|------|
| `id()` | `string, error` | 고유 메시지 식별자 |
| `header(key)` | `any, error` | 단일 헤더 값 (없으면 nil) |
| `headers()` | `table, error` | 모든 메시지 헤더 |

## 컨슈머 패턴

큐 컨슈머는 페이로드를 직접 받는 진입점으로 정의됩니다:

```yaml
entries:
  - kind: queue.consumer
    id: email_worker
    queue: app:emails
    method: handle_email
```

```lua
function handle_email(payload)
    local msg = queue.message()

    logger:info("Processing", {
        message_id = msg:id(),
        to = payload.to
    })

    local ok, err = email.send(payload.to, payload.template, payload.data)
    if err then
        return nil, err  -- 메시지가 재큐잉되거나 데드레터링됨
    end
end
```

## 권한

큐 작업은 보안 정책 평가 대상입니다.

| 액션 | 리소스 | 설명 |
|------|--------|------|
| `queue.publish` | - | 메시지 발행 일반 권한 |
| `queue.publish.queue` | 큐 ID | 특정 큐에 발행 |

두 권한 모두 확인됩니다: 먼저 일반 권한, 그 다음 큐별 권한.

## 에러

| 조건 | 종류 | 재시도 가능 |
|------|------|-------------|
| 큐 ID 비어있음 | `errors.INVALID` | 아니오 |
| 메시지 데이터 비어있음 | `errors.INVALID` | 아니오 |
| 전달 컨텍스트 없음 | `errors.INVALID` | 아니오 |
| 권한 거부됨 | `errors.PERMISSION_DENIED` | 아니오 |
| 발행 실패 | `errors.INTERNAL` | 예 |

에러 처리는 [에러 처리](lua/core/errors.md)를 참조하세요.

## 참고

- [큐 설정](system/queue.md) - 큐 드라이버 및 엔트리 정의
- [큐 컨슈머 가이드](guides/queue-consumers.md) - 컨슈머 패턴 및 워커 풀
- [프로세스 관리](lua/core/process.md) - 프로세스 스폰 및 통신
- [채널](lua/core/channel.md) - 프로세스 간 통신 패턴
- [함수](lua/core/funcs.md) - 비동기 함수 호출
