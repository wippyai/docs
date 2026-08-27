---
title: "관측성"
description: "Wippy 로깅, Prometheus 메트릭, OpenTelemetry 트레이싱, 런타임 통계를 설정합니다."
---

# 관측성

Wippy는 로깅, 메트릭, 분산 트레이싱, 런타임 통계를 통해 애플리케이션과 런타임의 동작을 보여 줍니다.

## 개요

부트 시 세 가지 관측성 영역을 설정합니다:

| 기둥 | 백엔드 | 설정 |
|--------|---------|---------------|
| 로깅 | Zap (JSON 구조화) | `logger` 및 `logmanager` |
| 메트릭 | Prometheus | `prometheus` |
| 트레이싱 | OpenTelemetry | `otel` |

## 로거 설정

### 로거 인코딩

```yaml
logger:
  encoding: json       # json or console
```

레벨과 출력은 CLI 플래그(`-v`, `-c`, `-s`)로 제어되며 YAML에서는 `encoding`만 읽습니다.

### 로그 매니저

로그 매니저는 로그 전파 및 이벤트 스트리밍을 제어합니다:

```yaml
logmanager:
  propagate_downstream: true   # Propagate to child components
  stream_to_events: false      # Forward logs to event bus
  min_level: 0                 # -1=debug, 0=info, 1=warn, 2=error
```

`stream_to_events`를 활성화하면 로그 항목이 이벤트로 변환되어 프로세스가 이벤트 버스를 통해 구독할 수 있습니다.

내장 로그 매니저의 기본값은 `-1`이지만, `wippy run`은 시작할 때 CLI 로깅 선택을 적용합니다. 기본값은 info(`0`)이며 `-v` 또는 `--very-verbose`를 사용하면 debug(`-1`)입니다.

### 자동 컨텍스트

Lua에서 [logger 모듈](../lua/system/logger.md)을 통해 출력된 로그에는 자동으로 다음이 포함됩니다:

- `pid` - 현재 프로세스 PID
- `location` - 엔트리 ID와 호출 라인 (예: `app.api:handler:45`)

## Prometheus 메트릭

```yaml
prometheus:
  enabled: true
  address: "localhost:9090"
```

Prometheus 서버는 `enabled`가 `true`이고 `address`가 비어 있지 않을 때만 시작합니다. 해당 주소에서 메트릭은 `/metrics`, 런타임 라이브니스 핸들러는 `/livez`로 노출됩니다.

### 스크레이프 설정

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'wippy'
    static_configs:
      - targets: ['localhost:9090']
    scrape_interval: 15s
```

Lua 메트릭 API는 [메트릭 모듈](../lua/system/metrics.md)을 참고하세요.

## OpenTelemetry

OpenTelemetry(OTEL)는 분산 트레이싱과 선택적 메트릭 내보내기를 제공합니다.

### 기본 설정

```yaml
otel:
  enabled: true
  endpoint: "localhost:4318"
  protocol: http/protobuf      # grpc or http/protobuf
  service_name: my-app
  service_version: "1.0.0"
  insecure: true               # Use plaintext for a local collector
  sample_rate: 1.0             # 0.0 to 1.0
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

  # HTTP request tracing
  http:
    enabled: true
    extract_headers: true      # Read incoming trace context
    inject_headers: true       # Write trace context to the HTTP response

  # Process lifecycle tracing
  process:
    enabled: true
    trace_lifecycle: true      # Trace spawn/exit events

  # Queue message tracing
  queue:
    enabled: true

  # Function call tracing
  interceptor:
    enabled: true
```

OTEL을 활성화하면 HTTP 트레이싱과 전파, 프로세스 트레이싱과 라이프사이클 스팬, 함수 인터셉션, 큐 트레이싱, 트레이스 내보내기가 기본으로 활성화됩니다. Temporal 트레이싱과 메트릭 내보내기는 기본으로 비활성화됩니다. 고정된 런타임은 함수 인터셉터를 순서 100으로 등록합니다. 설정에서 `interceptor.order` 값을 디코딩할 수는 있지만 등록 순서는 바뀌지 않습니다.

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

트레이스되는 작업은 다음과 같습니다:

- 워크플로우 시작 및 완료
- 액티비티 실행
- 자식 워크플로우 호출
- 시그널 및 쿼리 처리

### 트레이스되는 항목

| 컴포넌트 | 스팬 이름 | 속성 |
|-----------|-----------|------------|
| HTTP 요청 | `{METHOD} {route}` | http.method, http.url, http.host |
| 함수 호출 | 함수 ID | process.pid, frame.id |
| 프로세스 라이프사이클 | `<source-id>.started/terminated`, 소스 프레임이 없으면 `process.started/terminated` | process.pid, lifecycle.event |
| 큐 발행 | `<queue-id>.publish` | 메시징 속성과 헤더의 트레이스 컨텍스트 |
| 큐 소비 | 핸들러 함수 ID | 함수 스팬이 상속한 메시징 속성 |
| Temporal 워크플로우 | Temporal SDK 작업 이름 | Temporal SDK 워크플로우 및 실행 메타데이터 |

### 컨텍스트 전파

설정된 통합은 다음 경로로 트레이스 컨텍스트를 전파합니다:

- **HTTP → 함수**: W3C Trace Context 헤더
- **함수 → 함수**: 프레임 컨텍스트 상속
- **프로세스 → 프로세스**: 스폰 컨텍스트
- **큐 발행 → 소비**: 메시지 헤더

### 환경 변수

OTEL은 환경 변수로 설정 가능합니다:

| 변수 | 설명 |
|----------|-------------|
| `OTEL_SDK_DISABLED` | OTEL 비활성화하려면 `true` 설정 |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | 컬렉터 엔드포인트. exporter 설정 전에 `http://` 또는 `https://` 스킴 제거 |
| `OTEL_EXPORTER_OTLP_PROTOCOL` | `grpc` 또는 `http/protobuf` |
| `OTEL_EXPORTER_OTLP_INSECURE` | 평문 컬렉터 연결을 사용하려면 `true` 설정 |
| `OTEL_SERVICE_NAME` | 서비스 이름 |
| `OTEL_SERVICE_VERSION` | 서비스 버전 |
| `OTEL_TRACES_SAMPLER` | `always_on`, `always_off`, `traceidratio`, `parentbased_traceidratio` 중 하나 |
| `OTEL_TRACES_SAMPLER_ARG` | 샘플 레이트 (0.0-1.0) |
| `OTEL_PROPAGATORS` | 프로파게이터 목록 |

## 런타임 통계

`system` 모듈은 내부 런타임 통계를 제공합니다:

```lua
local system = require("system")

-- Memory statistics
local mem, mem_err = system.memory.stats()
-- mem.alloc, mem.heap_alloc, mem.heap_objects, etc.

-- Goroutine count
local count, count_err = system.runtime.goroutines()

-- Supervisor states
local states, states_err = system.supervisor.states()
```

이 함수들은 `value, error`를 반환합니다. 현재 보안 스코프에 `system.read` 권한이 필요합니다.

## 참고

- [로거 모듈](../lua/system/logger.md) - Lua 로깅 API
- [메트릭 모듈](../lua/system/metrics.md) - Lua 메트릭 API
- [시스템 모듈](../lua/system/system.md) - 런타임 통계
