---
title: "Temporal 통합"
description: "Wippy는 내구성 있는 워크플로우 실행, 자동 리플레이, 재시작을 견디는 장기 실행 프로세스를 위해 Temporal.io와 통합됩니다."
---

# Temporal 통합

이 페이지는 Temporal 클라이언트와 워커를 위한 설정 레퍼런스입니다. 마지막 레지스트리 조각은 엔트리가 연결되는 방식을 보여 주며, 그 자체로 완전한 프로젝트는 아닙니다.

`temporal.client`와 `temporal.worker` 엔트리 kind는 Wippy 워크플로우 및 액티비티를 [Temporal](https://temporal.io)에 연결합니다.

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
# Direct value
- name: temporal_client
  kind: temporal.client
  address: "your-namespace.tmprl.cloud:7233"
  namespace: "your-namespace"
  auth:
    type: api_key
    api_key: "your-api-key"

# From environment variable
- name: temporal_client
  kind: temporal.client
  address: "your-namespace.tmprl.cloud:7233"
  namespace: "your-namespace"
  auth:
    type: api_key
    api_key: ${env:TEMPORAL_API_KEY}

# From file
- name: temporal_client
  kind: temporal.client
  address: "your-namespace.tmprl.cloud:7233"
  namespace: "your-namespace"
  auth:
    type: api_key
    api_key_file: "/etc/secrets/temporal-api-key"
```

인증 및 자격 증명 필드는 디코딩 시 [환경 레지스트리](system/env.md)를 통해 `${env:NAME}` 플레이스홀더를 해석합니다. 기존 `api_key_env` / `key_pem_env` 지시어도 같은 방식으로 해석되지만 더 이상 권장되지 않습니다. `api_key: ${env:NAME}` / `key_pem: ${env:NAME}`을 사용하세요.

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
  server_name: "temporal.example.com"    # Override server name verification
  insecure_skip_verify: false            # Skip verification (dev only)
```

### 헬스 체크

```yaml
health_check:
  enabled: true
  interval: "30s"
```

## 워커 설정

`temporal.worker` 엔트리 kind는 워크플로우와 액티비티를 실행하는 워커를 정의합니다.

```yaml
- name: worker
  kind: temporal.worker
  client: app:temporal_client
  task_queue: "my-app-queue"
  lifecycle:
    auto_start: true
    requires:
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
    # Identity
    identity: ""                          # Worker identity (appears in Temporal UI)

    # Concurrency
    max_concurrent_activity_execution_size: 1000
    max_concurrent_workflow_task_execution_size: 1000
    max_concurrent_local_activity_execution_size: 1000
    max_concurrent_session_execution_size: 1000
    max_concurrent_eager_activity_execution_size: 0

    # Pollers
    max_concurrent_activity_task_pollers: 20
    max_concurrent_workflow_task_pollers: 20

    # Rate limiting
    worker_activities_per_second: 0        # 0 = unlimited
    worker_local_activities_per_second: 0
    task_queue_activities_per_second: 0

    # Timeouts
    sticky_schedule_to_start_timeout: "5s"
    worker_stop_timeout: "0s"
    deadlock_detection_timeout: "0s"
    max_heartbeat_throttle_interval: "0s"
    default_heartbeat_throttle_interval: "0s"

    # Feature flags
    enable_logging_in_replay: false
    enable_session_worker: false
    disable_workflow_worker: false
    local_activity_worker_only: false
    disable_eager_activities: false
    disable_registration_aliasing: false

    # Versioning
    deployment_name: ""
    build_id: ${env:BUILD_ID}              # Read from env registry
    use_versioning: false
    default_versioning_behavior: "pinned" # or "auto_upgrade"
```

자격 증명과 식별자 필드는 디코딩 시 [환경 레지스트리](system/env.md)를 통해 `${env:NAME}` 플레이스홀더를 해석합니다. 기존 `build_id_env` 지시어도 같은 방식으로 해석되지만 더 이상 권장되지 않습니다. `build_id: ${env:NAME}`을 사용하세요.

### 버전 관리 동작

`default_versioning_behavior`는 `use_versioning`이 활성화된 경우 새 워크플로 실행이 워커 빌드 ID를 선택하는 방식을 제어합니다:

| 값 | 동작 |
|------|------|
| `pinned` | 워크플로는 실행 전체에 걸쳐 시작했던 빌드 ID에 고정됩니다 |
| `auto_upgrade` | 워크플로는 각 태스크 이후 호환되는 최신 빌드 ID에서 재개될 수 있습니다 |

리터럴 `build_id`를 제공하지 않으면 `build_id: ${env:NAME}`이 환경 레지스트리에서 빌드 ID를 읽습니다.

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

## 설정 예제

이 레지스트리 조각은 워크플로우 하나와 액티비티 하나를 워커에 연결합니다. `localhost:7233`에서 접근 가능한 Temporal 서버와 참조된 Lua 소스 파일 두 개가 있다고 가정합니다. 구현은 워크플로우 및 액티비티 페이지를 참고하세요.

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
      requires:
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
      - env
      - errors
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
