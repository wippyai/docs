---
title: "메시지 큐"
description: "설정된 큐에 메시지를 게시하고 전달을 처리합니다."
---

# 메시지 큐
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>
<secondary-label ref="permissions"/>

`queue` 모듈은 RabbitMQ 및 기타 AMQP 호환 브로커를 포함해 설정된 분산 큐에 메시지를 게시하고 전달을 처리합니다.

이 페이지는 API 레퍼런스입니다. 게시 예시는 큐 엔트리와 권한이 이미 있다고 가정합니다. 컨슈머 섹션은 `queue.consumer`가 호출하는 핸들러의 부분 예시이며 독립된 큐 배포가 아닙니다.

큐 설정은 [큐](system/queue.md)를 참고하세요.

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

헤더는 라우팅, 우선순위, 추적 메타데이터를 전달합니다. 키는 문자열이어야 하며 게시자 값은 문자열, 정수, 숫자, 불리언일 수 있습니다:

```lua
local ok, err = queue.publish("app:notifications", {
    type = "order_shipped",
    order_id = order.id
}, {
    priority = 5,
    correlation_id = request_id
})
if err then return nil, err end
```

컨슈머는 모든 헤더 값을 문자열로 받습니다. `x_original_queue`, `x_dead_letter_reason`, `x_dead_letter_time`, `attempts` 키는 전달 및 dead-letter 처리용으로 예약되어 있으므로 게시자가 설정하면 안 됩니다.

## 전달 컨텍스트 접근

큐 컨슈머 내에서 현재 메시지에 접근:

```lua
local msg, err = queue.message()
if err then
    return nil, err
end

local msg_id, id_err = msg:id()
if id_err then return nil, id_err end
local priority, header_err = msg:header("priority")
if header_err then return nil, header_err end
local all_headers, headers_err = msg:headers()
if headers_err then return nil, headers_err end
```

**반환:** `Message, error`

컨슈머 컨텍스트에서 큐 메시지를 처리할 때만 사용 가능합니다.

## 메시지 메서드

| 메서드 | 반환 | 설명 |
|--------|------|------|
| `id()` | `string, error` | 고유 메시지 식별자 |
| `header(key)` | `string?, error` | 정규화된 문자열 값, 없으면 nil |
| `headers()` | `{[string]: string}, error` | 정규화된 문자열 값의 모든 헤더 |
| `ack()` | `boolean, error` | 처리 확인 (single-shot) |
| `nack()` | `boolean, error` | 재전송 또는 dead-letter를 위한 실패 신호 (single-shot) |

런타임은 핸들러 성공 시 자동으로 ack하고 핸들러 오류 시 자동으로 nack합니다. 조기에 확정할 때만 `ack`/`nack`를 호출하세요. 확정은 한 번만 가능하며 컨슈머 핸들러가 반환된 뒤 `Message`는 유효하지 않습니다.

## 큐 정보

```lua
local stats, err = queue.info("app:tasks")
if err then return nil, err end
-- stats may contain: message_count, consumer_count, ready (driver-dependent)
```

**반환:** `table, error`

## 컨슈머 패턴

`queue.consumer` 엔트리는 큐를 `func`가 참조하는 핸들러에 바인딩합니다. 핸들러는 메시지 페이로드를 직접 받습니다:

```yaml
- name: email_worker
  kind: queue.consumer
  queue: app:emails
  func: app:email_handler
```

이 조각은 `app:emails`와 `app:email_handler` 함수 엔트리가 이미 있다고 가정합니다. 아래 함수 소스는 애플리케이션이 `deliver_email(payload)`를 제공하고 필요한 권한을 부여한다고 가정합니다.

```lua
local queue = require("queue")
local logger = require("logger")

local function main(payload)
    local msg, msg_err = queue.message()
    if msg_err then return nil, msg_err end

    local message_id, id_err = msg:id()
    if id_err then return nil, id_err end

    logger:info("Processing", {
        message_id = message_id,
        to = payload.to
    })

    local ok, send_err = deliver_email(payload)
    if send_err then return nil, send_err end
    return ok
end

return {main = main}
```

호출 오류를 반환하면 컨슈머는 확정되지 않은 전달을 nack합니다. 이후 재전달은 선택한 드라이버의 동작을 따르며, 내장 dead-letter 설정은 이 릴리스에서 강제되지 않습니다.

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
| 메시지 해제됨 또는 이미 확정됨 | `errors.INVALID` | 아니오 |
| 발행 허용되지 않음 | `errors.INVALID` | 아니오 |
| 발행 실패 | `errors.INTERNAL` | 아니오 |
| `info`에서 큐 또는 드라이버를 찾지 못함 | `errors.INTERNAL` | 아니오 |

에러 처리는 [에러 처리](lua/core/errors.md)를 참조하세요.

## 참고

- [큐 설정](system/queue.md) - 큐 드라이버 및 엔트리 정의
- [큐 컨슈머 가이드](guides/queue-consumers.md) - 컨슈머 패턴 및 워커 풀
- [프로세스 관리](lua/core/process.md) - 프로세스 스폰 및 통신
- [채널](lua/core/channel.md) - 프로세스 간 통신 패턴
- [함수](lua/core/funcs.md) - 비동기 함수 호출
