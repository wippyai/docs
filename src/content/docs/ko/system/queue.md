---
title: "큐"
description: "Wippy는 설정 가능한 드라이버와 컨슈머가 있는 비동기 메시지 처리를 위한 큐 시스템을 제공합니다."
---

# 큐

Wippy는 설정 가능한 드라이버와 컨슈머가 있는 비동기 메시지 처리를 위한 큐 시스템을 제공합니다.

## 아키텍처

```mermaid
flowchart LR
    P[Publisher] --> D[Driver]
    D --> Q[Queue]
    Q --> C[Consumer]
    C --> W[Worker Pool]
    W --> F[Function]
```

- **드라이버** - 백엔드 구현 (memory, AMQP, SQS)
- **큐** - 드라이버에 바인딩된 논리적 큐
- **컨슈머** - 동시성 설정으로 큐를 핸들러에 연결
- **워커 풀** - 동시 메시지 프로세서

여러 큐가 드라이버를 공유할 수 있습니다. 여러 컨슈머가 같은 큐에서 처리할 수 있습니다.

## 엔트리 종류

| Kind | 설명 |
|------|-------------|
| `queue.driver.memory` | 인메모리 큐 드라이버 |
| `queue.driver.amqp` | AMQP (RabbitMQ) 드라이버 |
| `queue.driver.sqs` | AWS SQS 드라이버 (LocalStack, ElasticMQ도 지원) |
| `queue.queue` | 드라이버 참조가 있는 큐 선언 |
| `queue.consumer` | 메시지를 처리하는 컨슈머 |

## 드라이버 설정

### 메모리 드라이버

개발 및 단일 노드 배포용 인프로세스 드라이버. 외부 의존성 없음.

```yaml
- name: memory_driver
  kind: queue.driver.memory
  lifecycle:
    auto_start: true
```

### AMQP 드라이버

RabbitMQ 및 AMQP 0-9-1 호환 브로커용.

```yaml
- name: amqp_driver
  kind: queue.driver.amqp
  url: "amqp://guest:guest@localhost:5672/"
  vhost: "/"
  connection_name: "wippy-service"
  heartbeat: "10s"
  connection_timeout: "30s"
  reconnect_delay: "1s"
  reconnect_max_delay: "30s"
  default_message_ttl: "1h"
  default_queue_expiry: "24h"
  prefetch_count: 10
  lifecycle:
    auto_start: true
```

| 필드 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `url` | string | `amqp://guest:guest@localhost:5672/` | 브로커 URL |
| `vhost` | string | - | 가상 호스트 오버라이드 |
| `connection_name` | string | - | 브로커 UI에 표시되는 식별자 |
| `auth_mechanism` | string | `PLAIN` | `PLAIN`, `EXTERNAL` (mTLS), 또는 `AMQPLAIN` |
| `heartbeat` | duration | - | Keep-alive 간격 |
| `connection_timeout` | duration | - | 다이얼 타임아웃 |
| `reconnect_delay` | duration | `1s` | 초기 재연결 백오프 |
| `reconnect_max_delay` | duration | `30s` | 최대 재연결 백오프 |
| `default_message_ttl` | duration | - | 선언된 큐에 적용되는 기본 메시지 TTL |
| `default_queue_ttl` | duration | - | 선언된 큐에 적용되는 기본 TTL |
| `default_queue_expiry` | duration | - | 선언된 큐의 기본 큐 만료 시간 |
| `prefetch_count` | int | - | 채널 수준 prefetch 상한 |
| `frame_size` | int | - | AMQP 프레임 크기 제한 |
| `channel_max` | int | - | 연결당 최대 채널 수 |
| `tls` | object | - | TLS 설정 (아래 참조) |

TLS 블록:

```yaml
  tls:
    enabled: true
    server_name: "rabbit.example.com"
    cert_env: "AMQP_CLIENT_CERT"
    key_env: "AMQP_CLIENT_KEY"
    ca_env: "AMQP_CA_CERT"
    insecure_skip_verify: false
```

인라인 `cert`/`key`/`ca` 필드는 PEM 콘텐츠를 담습니다. `*_env` 변형은 env 레지스트리를 통해 해결됩니다. 두 소스는 필드별로 상호 배타적입니다. `insecure_skip_verify`는 인증서 검증을 비활성화합니다 (개발용 전용).

### SQS 드라이버

AWS SQS 및 SQS 호환 엔드포인트 (LocalStack, ElasticMQ)용. 자격 증명, 리전 및 기타 AWS SDK 설정은 공유된 `config.aws` 리소스에서 가져옵니다.

```yaml
- name: aws_config
  kind: config.aws
  region: us-east-1
  access_key_id_env: app:AWS_ACCESS_KEY_ID
  secret_access_key_env: app:AWS_SECRET_ACCESS_KEY

- name: sqs_driver
  kind: queue.driver.sqs
  config: app:aws_config
  endpoint: "http://localhost:9324"
  message_retention_period: 345600
  default_delay_seconds: 0
  lifecycle:
    auto_start: true
```

| 필드 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `config` | Registry ID | 필수 | 리전 및 자격 증명을 제공하는 `config.aws` 리소스 |
| `endpoint` | string | - | 사용자 지정 엔드포인트 URL (LocalStack, ElasticMQ); 실제 AWS의 경우 생략 |
| `message_retention_period` | int | `345600` (4일) | 큐 수준 보존 시간(초) (60–1209600) |
| `default_delay_seconds` | int | `0` | CreateQueue 시 적용되는 기본 전달 지연 (0–900) |
| `disable_message_checksum_validation` | bool | `false` | 송수신 시 SQS 메시지 체크섬 검사 비활성화 |
| `use_fips` | bool | `false` | FIPS 호환 엔드포인트 사용 |
| `use_dual_stack` | bool | `false` | 듀얼 스택 (IPv4 + IPv6) 엔드포인트 사용 |

큐는 첫 사용 시 드라이버에 의해 자동 생성됩니다. 발행 시 SQS 특정 속성을 지정하려면 SQS 접두사 헤더 (`sqs.*`)를 사용하세요. `correlation_id` 및 `content_type`과 같은 중립 키는 가능한 경우 SQS 시스템 속성으로 변환됩니다.

## 큐 설정

```yaml
- name: tasks
  kind: queue.queue
  driver: app.queue:memory_driver
  codec: json/plain
  queue_name: "app_tasks"
  driver_options:
    memory:
      max_length: 500
  dead_letter:
    queue: app.queue:tasks_dlq
    max_attempts: 5
```

| 필드 | 타입 | 필수 | 설명 |
|-------|------|----------|-------------|
| `driver` | 레지스트리 ID | 예 | 큐 드라이버 |
| `codec` | string | 아니오 | 메시지 본문의 와이어 인코딩. 기본값은 `json/plain` ([코덱](#codecs) 참고) |
| `queue_name` | string | 아니오 | 외부 큐 이름 (기본값은 엔트리 이름) |
| `driver_options` | object | 아니오 | 드라이버 kind로 키가 지정된 드라이버별 서브 백 |
| `dead_letter.queue` | Registry ID | 아니오 | 실패한 메시지의 큐 ID |
| `dead_letter.max_attempts` | int | 아니오 | DLQ로 라우팅하기 전 시도 횟수 |

### 드라이버 옵션

`driver_options` 아래의 키는 드라이버 이름으로 범위가 지정됩니다. 드라이버는 자체 서브 백만 읽습니다 — 다른 키는 비활성 상태이며, 이를 통해 단일 큐 엔트리가 필요한 경우 여러 드라이버에 대한 설정을 선언할 수 있습니다.

**memory:**

| 키 | 설명 |
|----|------|
| `max_length` | 경계 버퍼 크기 (0 = 무제한) |

**amqp:**

| 키 | 설명 |
|----|------|
| `durable` | 브로커 재시작 후에도 유지 |
| `auto_delete` | 마지막 컨슈머가 분리되면 삭제 |
| `message_ttl` | 큐별 메시지 TTL 오버라이드 |
| `queue_expiry` | 사용되지 않는 큐의 만료 시간 |
| `max_length` | 보존되는 최대 메시지 수 |

### 코덱

`codec`은 메시지 본문이 브로커에 전달되기 전에 직렬화되는 방식을 선택합니다. 페이로드 포맷 문자열이며 기본값은 `json/plain`입니다:

| 코덱 | 포맷 |
|-------|------|
| `json/plain` | JSON (기본값) |
| `application/msgpack` | MessagePack |

AMQP 드라이버는 게시되는 메시지에 일치하는 `content-type`(`application/json` 또는 `application/msgpack`)을 설정합니다. 알 수 없는 코덱은 게시 시점이 아니라 큐가 선언될 때 실패합니다.

## 컨슈머 설정

```yaml
- name: task_consumer
  kind: queue.consumer
  queue: app.queue:tasks
  func: app.queue:task_handler
  concurrency: 4
  prefetch: 20
  auto_ack: false
  driver_options:
    amqp:
      consumer_tag: "worker-1"
      exclusive: false
  lifecycle:
    auto_start: true
    depends_on:
      - app.queue:tasks
```

| 필드 | 기본값 | 설명 |
|-------|---------|-------------|
| `queue` | 필수 | 큐 레지스트리 ID |
| `func` | 필수 | 핸들러 함수 레지스트리 ID |
| `concurrency` | 1 | 병렬 워커 수 |
| `prefetch` | 10 | 워커당 버퍼 크기 |
| `auto_ack` | false | true이면 런타임이 브로커 ack를 호출하지 않음; 핸들러 성공/실패가 유일한 settle 신호 |
| `driver_options` | - | 드라이버별 서브 백 (큐와 동일한 구조) |

**amqp 컨슈머 옵션:**

| 키 | 설명 |
|----|------|
| `exclusive` | 단일 컨슈머 큐 액세스 |
| `no_local` | 동일한 연결에서 발행된 메시지 거부 |
| `no_wait` | 구독 시 브로커 확인을 기다리지 않음 |
| `consumer_tag` | 이 구독의 식별자 |

<tip>
컨슈머는 호출 컨텍스트를 준수하며 보안 정책의 적용을 받을 수 있습니다. 라이프사이클 레벨에서 액터와 정책을 설정하세요. <a href="system/security.md">보안</a> 참조.
</tip>

### 워커 풀

워커는 동시 고루틴으로 실행됩니다:

```
concurrency: 3, prefetch: 10

1. 드라이버가 버퍼에 최대 10개 메시지 전달
2. 3개 워커가 버퍼에서 동시에 가져옴
3. 워커가 완료되면 버퍼 리필
4. 모든 워커가 바쁘고 버퍼가 가득 차면 백프레셔
```

## 핸들러 함수

컨슈머 핸들러는 디코딩된 메시지 본문을 첫 번째 인수로 받습니다. 전달 메타데이터 (id, headers)에 액세스하려면 `queue.message()`를 사용하세요.

```lua
local queue = require("queue")
local logger = require("logger")

local function main(body)
    local msg = queue.message()
    logger:info("processing", {
        id = msg:id(),
        correlation_id = msg:header("correlation_id")
    })

    local ok, err = process_task(body)
    if err then
        return false  -- nack: redelivery or DLQ
    end
    return true       -- ack: remove from queue
end

return { main = main }
```

```yaml
- name: task_handler
  kind: function.lua
  source: file://task_handler.lua
  method: main
  modules:
    - queue
    - logger
```

### 확인 응답

런타임은 핸들러 반환값에 따라 자동으로 settle합니다:

| 핸들러 결과 | 액션 |
|----------------|--------|
| `true` 또는 비 `false` 반환 | Ack |
| `false` | Nack (드라이버에 따라 재배달 또는 dead-letter) |
| 발생한 오류 | Nack |

조기 settle을 위해서만 `msg:ack()` 또는 `msg:nack()`을 명시적으로 호출하세요. Settlement은 단일 샷입니다: 먼저 도착한 호출이 우선합니다.

### Dead-Letter 라우팅

큐에 `dead_letter`가 설정된 경우, `max_attempts`를 초과하여 nack된 메시지는 드라이버가 설정한 `x_dead_letter_reason` 및 `x_original_queue` 헤더와 함께 DLQ로 라우팅됩니다. 발행자는 `x_*` 헤더를 설정하면 안 됩니다 — 이들은 DLQ 기록용으로 예약되어 있습니다.

## 메시지 발행

Lua 코드에서:

```lua
local queue = require("queue")

queue.publish("app.queue:tasks", {
    id = "task-123",
    action = "process",
    data = payload
})
```

전체 API는 [Queue 모듈](lua/storage/queue.md)을 참조하세요.

## 정상 종료

컨슈머 중지 시:

1. 새 메시지 수신 중지
2. 워커 컨텍스트 취소
3. 처리 중인 메시지 완료 대기(타임아웃 적용)
4. 워커가 제시간에 완료되지 않으면 오류 반환

## 참고

- [Queue 모듈](lua/storage/queue.md) - Lua API 참조
- [큐 컨슈머 가이드](guides/queue-consumers.md) - 컨슈머 패턴 및 워커 풀
- [슈퍼비전](guides/supervision.md) - 컨슈머 라이프사이클 관리
