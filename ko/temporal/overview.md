---
title: "Temporal 통합"
description: "Wippy는 내구성 있는 워크플로우 실행, 자동 리플레이, 재시작을 견디는 장기 실행 프로세스를 위해 Temporal.io와 통합됩니다."
---

# Temporal 통합

Wippy는 내구성 있는 워크플로우 실행, 자동 리플레이, 재시작을 견디는 장기 실행 프로세스를 위해 [Temporal.io](https://temporal.io)와 통합됩니다.

## 클라이언트 설정

`temporal.client` 엔트리 kind는 Temporal 서버에 대한 연결을 정의합니다.

```yaml
- name: temporal_client
  kind: temporal.client
  address: "localhost:7233"
  namespace: "default"
  lifecycle:
    auto_start: true
```

### 필수 필드

| 필드 | 설명 |
|-------|-------------|
| `address` | Temporal 서버 주소 (host:port) |

### 선택적 필드

| 필드 | 기본값 | 설명 |
|-------|---------|-------------|
| `namespace` | "default" | Temporal 네임스페이스 |
| `tq_prefix` | "" | 모든 작업에 대한 태스크 큐 이름 접두사 |
| `connection_timeout` | "10s" | 연결 타임아웃 |
| `keep_alive_time` | "30s" | Keep-alive 간격 |
| `keep_alive_timeout` | "10s" | Keep-alive 타임아웃 |

### 인증

#### 인증 없음

```yaml
- name: temporal_client
  kind: temporal.client
  address: "localhost:7233"
  auth:
    type: none
```

#### API 키 (Temporal Cloud)

다음 방법 중 하나로 API 키 제공:

```yaml
# 직접 값
- name: temporal_client
  kind: temporal.client
  address: "your-namespace.tmprl.cloud:7233"
  namespace: "your-namespace"
  auth:
    type: api_key
    api_key: "your-api-key"

# 환경 변수에서
- name: temporal_client
  kind: temporal.client
  address: "your-namespace.tmprl.cloud:7233"
  namespace: "your-namespace"
  auth:
    type: api_key
    api_key: ${env:TEMPORAL_API_KEY}

# 파일에서
- name: temporal_client
  kind: temporal.client
  address: "your-namespace.tmprl.cloud:7233"
  namespace: "your-namespace"
  auth:
    type: api_key
    api_key_file: "/etc/secrets/temporal-api-key"
```

인증 및 자격 증명 필드는 디코드 시점에 [환경 레지스트리](system/env.md)를 통해 `${env:NAME}` 플레이스홀더를 해석합니다. 레거시 `api_key_env` / `key_pem_env` 디렉티브도 같은 방식으로 해석되지만 더 이상 권장되지 않습니다. `api_key: ${env:NAME}` / `key_pem: ${env:NAME}`을 사용하세요.

#### mTLS

```yaml
- name: temporal_client
  kind: temporal.client
  address: "temporal.example.com:7233"
  namespace: "production"
  auth:
    type: mtls
    cert_file: "/path/to/client.pem"
    key_file: "/path/to/client.key"
  tls:
    enabled: true
    ca_file: "/path/to/ca.pem"
```

인증서와 키는 PEM 문자열이나 환경에서도 제공 가능:

```yaml
auth:
  type: mtls
  cert_pem: |
    -----BEGIN CERTIFICATE-----
    ...
    -----END CERTIFICATE-----
  key_pem: ${env:TEMPORAL_CLIENT_KEY}
```

### TLS 설정

```yaml
tls:
  enabled: true
  ca_file: "/path/to/ca.pem"
  server_name: "temporal.example.com"    # 서버 이름 검증 오버라이드
  insecure_skip_verify: false            # 검증 건너뛰기 (개발 전용)
```

### 헬스 체크

```yaml
health_check:
  enabled: true
  interval: "30s"
```

### 보안 컨텍스트 전파

Wippy는 호출하는 액터와 스코프를 서명된 Temporal 헤더로 워크플로우와 액티비티에 전파합니다. 서명은 클라이언트 엔트리가 보유한 키를 사용하는 HMAC-SHA256입니다:

```yaml
- name: temporal_client
  kind: temporal.client
  address: "localhost:7233"
  security_hmac_key: ${env:TEMPORAL_SECURITY_KEY}
  security_hmac_previous_keys:
    - ${env:TEMPORAL_SECURITY_KEY_PREVIOUS}
```

| 필드 | 설명 |
|-------|-------------|
| `security_hmac_key` | base64로 인코딩된 서명 키; 최소 32바이트로 디코딩되어야 함 |
| `security_hmac_previous_keys` | 로테이션을 위해 검증에는 여전히 허용되는 base64 인코딩 키 |

두 필드는 바이트 필드이므로 YAML에서 base64입니다. 디코딩된 길이가 32바이트 미만인 키는 설정 검증 단계에서 거부되며, `security_hmac_key` 없이 `security_hmac_previous_keys`를 선언하는 것도 마찬가지입니다. 새 헤더는 항상 `security_hmac_key`로 서명되고, 검증 시에는 나열된 모든 이전 키를 시도합니다. 따라서 로테이션 절차는 다음과 같습니다: 새 키를 `security_hmac_key`로 추가하고, 이전 키를 `security_hmac_previous_keys`로 옮긴 뒤, 그 키를 지닌 진행 중인 실행이 없어지면 제거합니다.

**액터나 스코프 하에서 워크플로우를 시작하려면 키가 필요합니다.** 호출자에게 보안 컨텍스트가 있는데 클라이언트에 서명 키가 없으면 헤더에 서명할 수 없어 시작이 실패합니다. 키가 없는 클라이언트는 액터도 스코프도 없는 컨텍스트에서만 워크플로우를 시작할 수 있습니다.

워커는 자신이 참조하는 클라이언트 엔트리에서 키를 획득하므로, 워커는 자체 설정 없이 `client:`로부터 서명과 검증을 상속합니다. [워크플로우](temporal/workflows.md#security-context)와 [액티비티](temporal/activities.md)를 참조하세요.

## 워커 설정

`temporal.worker` 엔트리 kind는 워크플로우와 액티비티를 실행하는 워커를 정의합니다.

```yaml
- name: worker
  kind: temporal.worker
  client: app:temporal_client
  task_queue: "my-app-queue"
  lifecycle:
    auto_start: true
    depends_on:
      - app:temporal_client
```

### 필수 필드

| 필드 | 설명 |
|-------|-------------|
| `client` | `temporal.client` 엔트리 참조 |
| `task_queue` | 태스크 큐 이름 |

### 워커 옵션

워커 동작 세부 조정:

```yaml
- name: worker
  kind: temporal.worker
  client: app:temporal_client
  task_queue: "my-app-queue"
  worker_options:
    # 아이덴티티
    identity: ""                          # 워커 아이덴티티 (Temporal UI에 표시됨)

    # 동시성
    max_concurrent_activity_execution_size: 1000
    max_concurrent_workflow_task_execution_size: 1000
    max_concurrent_local_activity_execution_size: 1000
    max_concurrent_session_execution_size: 1000
    max_concurrent_eager_activity_execution_size: 0

    # 폴러
    max_concurrent_activity_task_pollers: 20
    max_concurrent_workflow_task_pollers: 20

    # 레이트 제한
    worker_activities_per_second: 0        # 0 = 무제한
    worker_local_activities_per_second: 0
    task_queue_activities_per_second: 0

    # 타임아웃
    sticky_schedule_to_start_timeout: "5s"
    worker_stop_timeout: "0s"
    deadlock_detection_timeout: "0s"
    max_heartbeat_throttle_interval: "0s"
    default_heartbeat_throttle_interval: "0s"

    # 기능 플래그
    enable_logging_in_replay: false
    enable_session_worker: false
    disable_workflow_worker: false
    local_activity_worker_only: false
    disable_eager_activities: false
    disable_registration_aliasing: false

    # 버전닝
    deployment_name: ""
    build_id: ""
    build_id: ${env:BUILD_ID}              # env 레지스트리에서 읽기
    use_versioning: false
    default_versioning_behavior: "pinned" # 또는 "auto_upgrade"
```

자격 증명 및 식별자 필드는 디코드 시점에 [환경 레지스트리](system/env.md)를 통해 `${env:NAME}` 플레이스홀더를 해석합니다. 레거시 `build_id_env` 디렉티브도 같은 방식으로 해석되지만 더 이상 권장되지 않습니다. `build_id: ${env:NAME}`을 사용하세요.

### 버전 관리 동작

`default_versioning_behavior`는 `use_versioning`이 활성화된 경우 새 워크플로 실행이 워커 빌드 ID를 선택하는 방식을 제어합니다:

| 값 | 동작 |
|------|------|
| `pinned` | 워크플로는 실행 전체에 걸쳐 시작했던 빌드 ID에 고정됩니다 |
| `auto_upgrade` | 워크플로는 각 태스크 이후 호환되는 최신 빌드 ID에서 재개될 수 있습니다 |

`build_id: ${env:NAME}`은 리터럴 `build_id`가 제공되지 않았을 때 env 레지스트리에서 빌드 ID를 읽습니다.

### 세션 워커

`enable_session_worker: true`는 워커가 Temporal Sessions를 실행하도록 합니다: 단일 워커에 고정된 일련의 액티비티입니다 (액티비티들이 임시 디렉토리나 열려 있는 연결 같은 로컬 상태를 공유할 때 유용합니다). `max_concurrent_session_execution_size`는 워커의 동시 세션 수를 제한합니다.

### 동시성 기본값

| 옵션 | 기본값 |
|--------|---------|
| `max_concurrent_activity_execution_size` | 1000 |
| `max_concurrent_workflow_task_execution_size` | 1000 |
| `max_concurrent_local_activity_execution_size` | 1000 |
| `max_concurrent_session_execution_size` | 1000 |
| `max_concurrent_activity_task_pollers` | 20 |
| `max_concurrent_workflow_task_pollers` | 20 |
| `sticky_schedule_to_start_timeout` | 5s |

## 전체 예제

```yaml
version: "1.0"
namespace: app

entries:
  - name: temporal_client
    kind: temporal.client
    address: "localhost:7233"
    namespace: "default"
    lifecycle:
      auto_start: true

  - name: worker
    kind: temporal.worker
    client: app:temporal_client
    task_queue: "orders"
    lifecycle:
      auto_start: true
      depends_on:
        - app:temporal_client

  - name: order_workflow
    kind: workflow.lua
    source: file://order_workflow.lua
    method: main
    modules:
      - funcs
      - time
    meta:
      temporal:
        workflow:
          worker: app:worker

  - name: charge_payment
    kind: function.lua
    source: file://payment.lua
    method: charge
    modules:
      - http_client
      - json
    meta:
      temporal:
        activity:
          worker: app:worker
```

## 참고

- [액티비티](temporal/activities.md) - 액티비티 정의
- [워크플로우](temporal/workflows.md) - 워크플로우 구현
