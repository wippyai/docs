# 관측성

Wippy 애플리케이션을 위한 로깅, 메트릭, 분산 트레이싱 설정.

## 개요

Wippy는 부트 시 설정하는 세 가지 관측성 요소를 제공합니다:

| 기둥 | 백엔드 | 설정 |
|--------|---------|---------------|
| 로깅 | Zap (JSON 구조화) | `logger` 및 `logmanager` |
| 메트릭 | Prometheus | `prometheus` |
| 트레이싱 | OpenTelemetry | `otel` |

## 로거 설정

### 기본 로거

```yaml
logger:
  mode: production     # development 또는 production
  level: info          # debug, info, warn, error
  encoding: json       # json 또는 console
```

### 로그 매니저

로그 매니저는 로그 전파 및 이벤트 스트리밍을 제어합니다:

```yaml
logmanager:
  propagate_downstream: true   # 자식 컴포넌트로 전파
  stream_to_events: false      # 이벤트 버스로 로그 전달
  min_level: 0                 # -1=debug, 0=info, 1=warn, 2=error
```

`stream_to_events`를 활성화하면 로그 항목이 이벤트로 변환되어 프로세스가 이벤트 버스를 통해 구독할 수 있습니다.

### 자동 컨텍스트

모든 로그에 포함되는 정보:

- `pid` - 프로세스 ID
- `location` - 엔트리 ID와 라인 번호 (예: `app.api:handler:45`)

## Prometheus 메트릭

```yaml
prometheus:
  enabled: true
  address: "localhost:9090"
```

메트릭은 설정된 주소의 `/metrics`에서 노출됩니다.

### 스크레이프 설정

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'wippy'
    static_configs:
      - targets: ['localhost:9090']
    scrape_interval: 15s
```

Lua 메트릭 API는 [메트릭 모듈](lua/system/metrics.md)을 참조하세요.

## OpenTelemetry

OTEL은 분산 트레이싱과 선택적 메트릭 내보내기를 제공합니다.

### 기본 설정

```yaml
otel:
  enabled: true
  endpoint: "localhost:4318"
  protocol: http/protobuf      # grpc 또는 http/protobuf
  service_name: my-app
  service_version: "1.0.0"
  insecure: false              # TLS 없는 연결 허용
  sample_rate: 1.0             # 0.0 ~ 1.0
  traces_enabled: true
  metrics_enabled: false
  propagators:
    - tracecontext
    - baggage
```

### 트레이스 소스

특정 컴포넌트에 대한 트레이싱 활성화:

```yaml
otel:
  enabled: true
  endpoint: "localhost:4318"
  service_name: my-app

  # HTTP 요청 트레이싱
  http:
    enabled: true
    extract_headers: true      # 들어오는 트레이스 컨텍스트 읽기
    inject_headers: true       # 나가는 트레이스 컨텍스트 쓰기

  # 프로세스 라이프사이클 트레이싱
  process:
    enabled: true
    trace_lifecycle: true      # spawn/exit 이벤트 트레이싱

  # 큐 메시지 트레이싱
  queue:
    enabled: true

  # 함수 호출 트레이싱
  interceptor:
    enabled: true
    order: 0                   # 인터셉터 실행 순서
```

### Temporal 워크플로우

Temporal 워크플로우에 대한 트레이싱 활성화:

```yaml
otel:
  enabled: true
  endpoint: "localhost:4318"
  service_name: my-app

  temporal:
    enabled: true
```

활성화되면 Temporal SDK의 트레이싱 인터셉터가 클라이언트와 워커 작업 모두에 등록됩니다.

트레이스되는 작업:
- 워크플로우 시작 및 완료
- 액티비티 실행
- 자식 워크플로우 호출
- 시그널 및 쿼리 처리

### 트레이스되는 항목

| 컴포넌트 | 스팬 이름 | 속성 |
|-----------|-----------|------------|
| HTTP 요청 | `{METHOD} {route}` | http.method, http.url, http.host |
| 함수 호출 | 함수 ID | process.pid, frame.id |
| 프로세스 라이프사이클 | `{source}.started/terminated` | process.pid |
| 큐 메시지 | 메시지 토픽 | 헤더의 트레이스 컨텍스트 |
| Temporal 워크플로우 | 워크플로우/액티비티 이름 | workflow.id, run.id |

### 컨텍스트 전파

트레이스 컨텍스트는 자동으로 전파됩니다:

- **HTTP → 함수**: W3C Trace Context 헤더
- **함수 → 함수**: 프레임 컨텍스트 상속
- **프로세스 → 프로세스**: 스폰 컨텍스트
- **큐 발행 → 소비**: 메시지 헤더

### 환경 변수

OTEL은 환경 변수로 설정 가능합니다:

| 변수 | 설명 |
|----------|-------------|
| `OTEL_SDK_DISABLED` | OTEL 비활성화하려면 `true` 설정 |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | 컬렉터 엔드포인트 |
| `OTEL_EXPORTER_OTLP_PROTOCOL` | `grpc` 또는 `http/protobuf` |
| `OTEL_SERVICE_NAME` | 서비스 이름 |
| `OTEL_SERVICE_VERSION` | 서비스 버전 |
| `OTEL_TRACES_SAMPLER_ARG` | 샘플 레이트 (0.0-1.0) |
| `OTEL_PROPAGATORS` | 프로파게이터 목록 |

## 런타임 통계

`system` 모듈은 내부 런타임 통계를 제공합니다:

```lua
local system = require("system")

-- 메모리 통계
local mem = system.memory.stats()
-- mem.alloc, mem.heap_alloc, mem.heap_objects 등

-- 고루틴 수
local count = system.runtime.goroutines()

-- 슈퍼바이저 상태
local states = system.supervisor.states()
```

## 참고

- [로거 모듈](lua/system/logger.md) - Lua 로깅 API
- [메트릭 모듈](lua/system/metrics.md) - Lua 메트릭 API
- [시스템 모듈](lua/system/system.md) - 런타임 통계
