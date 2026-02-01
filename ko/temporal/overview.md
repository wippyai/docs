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
    api_key_env: "TEMPORAL_API_KEY"

# 파일에서
- name: temporal_client
  kind: temporal.client
  address: "your-namespace.tmprl.cloud:7233"
  namespace: "your-namespace"
  auth:
    type: api_key
    api_key_file: "/etc/secrets/temporal-api-key"
```

`_env`로 끝나는 필드는 시스템에 정의되어야 하는 환경 변수를 참조합니다. 환경 스토리지와 변수 설정은 [환경 시스템](system/env.md)을 참조하세요.

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
  key_pem_env: "TEMPORAL_CLIENT_KEY"
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
    # 동시성
    max_concurrent_activity_execution_size: 1000
    max_concurrent_workflow_task_execution_size: 1000
    max_concurrent_local_activity_execution_size: 1000
    max_concurrent_session_execution_size: 1000

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

    # 기능 플래그
    enable_logging_in_replay: false
    enable_session_worker: false
    disable_workflow_worker: false
    local_activity_worker_only: false
    disable_eager_activities: false

    # 버전닝
    deployment_name: ""
    build_id: ""
    build_id_env: "BUILD_ID"              # 환경 변수에서 읽기
    use_versioning: false
    default_versioning_behavior: "pinned" # 또는 "auto_upgrade"
```

`_env`로 끝나는 필드는 [환경 시스템](system/env.md) 엔트리를 통해 정의된 환경 변수를 참조합니다.

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
