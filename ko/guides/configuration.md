# 설정 레퍼런스

Wippy는 `.wippy.yaml` 파일로 설정됩니다. 모든 옵션에는 합리적인 기본값이 있습니다.

## 로그 매니저

런타임 로그 라우팅 제어. 콘솔 출력은 [CLI 플래그](guide-cli.md) (`-v`, `-c`, `-s`)로 설정됩니다.

| 필드 | 타입 | 기본값 | 설명 |
|-------|------|---------|-------------|
| `propagate_downstream` | bool | true | 콘솔/파일 출력으로 로그 전송 |
| `stream_to_events` | bool | false | 프로그래밍 접근을 위해 이벤트 버스에 로그 퍼블리시 |
| `min_level` | int | -1 | 최소 레벨: -1=debug, 0=info, 1=warn, 2=error |

```yaml
logmanager:
  propagate_downstream: true
  stream_to_events: false
  min_level: 0
```

참조: [Logger 모듈](lua-logger.md)

## 프로파일러

CPU/메모리 프로파일링을 위한 Go pprof HTTP 서버. `-p` 플래그 또는 설정으로 활성화.

| 필드 | 타입 | 기본값 | 설명 |
|-------|------|---------|-------------|
| `enabled` | bool | false | 프로파일러 서버 시작 |
| `address` | string | localhost:6060 | 리슨 주소 |
| `read_timeout` | duration | 15s | HTTP 읽기 타임아웃 |
| `write_timeout` | duration | 15s | HTTP 쓰기 타임아웃 |
| `idle_timeout` | duration | 60s | Keep-alive 타임아웃 |

```yaml
profiler:
  enabled: true
  address: "localhost:6060"
```

`http://localhost:6060/debug/pprof/`에서 접근

## 보안

전역 보안 동작. 개별 정책은 [security.policy 엔트리](guide-entry-kinds.md)로 정의됩니다.

| 필드 | 타입 | 기본값 | 설명 |
|-------|------|---------|-------------|
| `strict_mode` | bool | false | 보안 컨텍스트 불완전 시 접근 거부 |

```yaml
security:
  strict_mode: true
```

참조: [보안 시스템](system-security.md), [보안 모듈](lua-security.md)

## 레지스트리

엔트리 스토리지 및 버전 히스토리. 레지스트리는 모든 설정 엔트리를 보유합니다.

| 필드 | 타입 | 기본값 | 설명 |
|-------|------|---------|-------------|
| `enable_history` | bool | true | 엔트리 버전 추적 |
| `history_type` | string | memory | 스토리지: memory, sqlite, nil |
| `history_path` | string | .wippy/registry.db | SQLite 파일 경로 |

```yaml
registry:
  history_type: sqlite
  history_path: /var/lib/wippy/registry.db
```

참조: [레지스트리 개념](concept-registry.md), [레지스트리 모듈](lua-registry.md)

## 릴레이

노드 간 프로세스 메시지 라우팅.

| 필드 | 타입 | 기본값 | 설명 |
|-------|------|---------|-------------|
| `node_name` | string | local | 이 릴레이 노드의 식별자 |

```yaml
relay:
  node_name: worker-1
```

참조: [프로세스 모델](concept-process-model.md)

## 슈퍼바이저

서비스 라이프사이클 관리. 슈퍼바이즈된 엔트리의 시작/중지 방법 제어.

| 필드 | 타입 | 기본값 | 설명 |
|-------|------|---------|-------------|
| `host.buffer_size` | int | 1024 | 메시지 큐 용량 |
| `host.worker_count` | int | NumCPU | 동시 워커 |

```yaml
supervisor:
  host:
    buffer_size: 2048
    worker_count: 32
```

참조: [슈퍼비전 가이드](guide-supervision.md)

## 함수

함수 실행 호스트. `function.lua` 엔트리 실행.

| 필드 | 타입 | 기본값 | 설명 |
|-------|------|---------|-------------|
| `host.buffer_size` | int | 1024 | 태스크 큐 용량 |
| `host.worker_count` | int | NumCPU | 동시 워커 |

```yaml
functions:
  host:
    buffer_size: 2048
    worker_count: 32
```

참조: [함수 개념](concept-functions.md), [Funcs 모듈](lua-funcs.md)

## Lua 런타임

Lua VM 캐싱 및 표현식 평가.

| 필드 | 타입 | 기본값 | 설명 |
|-------|------|---------|-------------|
| `proto_cache_size` | int | 60000 | 컴파일된 프로토타입 캐시 |
| `main_cache_size` | int | 10000 | 메인 청크 캐시 |
| `expr.cache_enabled` | bool | true | 컴파일된 표현식 캐시 |
| `expr.capacity` | int | 5000 | 표현식 캐시 크기 |
| `json.cache_enabled` | bool | true | JSON 스키마 캐시 |
| `json.capacity` | int | 1000 | JSON 캐시 크기 |

```yaml
lua:
  proto_cache_size: 60000
  expr:
    cache_enabled: true
    capacity: 5000
```

참조: [Lua 개요](lua-overview.md)

## Finder

레지스트리 검색 캐싱. 엔트리 조회에 내부적으로 사용.

| 필드 | 타입 | 기본값 | 설명 |
|-------|------|---------|-------------|
| `query_cache_size` | int | 1000 | 캐시된 쿼리 결과 |
| `regex_cache_size` | int | 100 | 컴파일된 정규식 패턴 |

```yaml
finder:
  query_cache_size: 2000
```

## OpenTelemetry

OTLP를 통한 분산 트레이싱 및 메트릭 익스포트.

| 필드 | 타입 | 기본값 | 설명 |
|-------|------|---------|-------------|
| `enabled` | bool | false | OTEL 활성화 |
| `endpoint` | string | localhost:4318 | OTLP 엔드포인트 |
| `protocol` | string | http/protobuf | 프로토콜: grpc, http/protobuf |
| `service_name` | string | wippy | 서비스 식별자 |
| `sample_rate` | float | 1.0 | 트레이스 샘플링 (0.0-1.0) |
| `traces_enabled` | bool | false | 트레이스 익스포트 |
| `metrics_enabled` | bool | false | 메트릭 익스포트 |
| `http.enabled` | bool | true | HTTP 요청 트레이싱 |
| `process.enabled` | bool | true | 프로세스 라이프사이클 트레이싱 |
| `interceptor.enabled` | bool | false | 함수 호출 트레이싱 |

```yaml
otel:
  enabled: true
  endpoint: "http://jaeger:4318"
  traces_enabled: true
  process:
    trace_lifecycle: true
```

참조: [관측성 가이드](guide-observability.md)

## 셧다운

그레이스풀 셧다운 동작.

| 필드 | 타입 | 기본값 | 설명 |
|-------|------|---------|-------------|
| `timeout` | duration | 30s | 컴포넌트 중지 최대 대기 시간 |

```yaml
shutdown:
  timeout: 60s
```

## 메트릭

내부 메트릭 수집 버퍼.

| 필드 | 타입 | 기본값 | 설명 |
|-------|------|---------|-------------|
| `buffer.size` | int | 10000 | 메트릭 버퍼 용량 |
| `interceptor.enabled` | bool | false | 함수 호출 자동 추적 |

```yaml
metrics:
  buffer:
    size: 20000
  interceptor:
    enabled: true
```

참조: [메트릭 모듈](lua-metrics.md), [관측성 가이드](guide-observability.md)

## Prometheus

Prometheus 메트릭 엔드포인트.

| 필드 | 타입 | 기본값 | 설명 |
|-------|------|---------|-------------|
| `enabled` | bool | false | 메트릭 서버 시작 |
| `address` | string | localhost:9090 | 리슨 주소 |

```yaml
prometheus:
  enabled: true
  address: "0.0.0.0:9090"
```

Prometheus 스크레이핑을 위해 `/metrics` 엔드포인트 노출.

참조: [관측성 가이드](guide-observability.md)

## 클러스터

gossip 디스커버리를 사용한 멀티 노드 클러스터링.

| 필드 | 타입 | 기본값 | 설명 |
|-------|------|---------|-------------|
| `enabled` | bool | false | 클러스터링 활성화 |
| `name` | string | hostname | 노드 식별자 |
| `internode.bind_addr` | string | 0.0.0.0 | 노드 간 바인드 주소 |
| `internode.bind_port` | int | 0 | 포트 (0=자동 7950-7959) |
| `membership.bind_port` | int | 7946 | Gossip 포트 |
| `membership.join_addrs` | string | | 시드 노드 (쉼표 구분) |
| `membership.secret_key` | string | | 암호화 키 (base64) |
| `membership.secret_file` | string | | 키 파일 경로 |
| `membership.advertise_addr` | string | | NAT용 공개 주소 |

```yaml
cluster:
  enabled: true
  name: node-1
  membership:
    bind_port: 7946
    join_addrs: "10.0.0.1:7946,10.0.0.2:7946"
    secret_file: /etc/wippy/cluster.key
```

참조: [클러스터 가이드](guide-cluster.md)

## 환경 변수

| 변수 | 설명 |
|----------|-------------|
| `GOMEMLIMIT` | 메모리 제한 (`--memory-limit` 플래그 오버라이드) |

## 참고

- [CLI 레퍼런스](guide-cli.md) - 커맨드라인 옵션
- [엔트리 종류](guide-entry-kinds.md) - 모든 엔트리 타입
- [클러스터 가이드](guide-cluster.md) - 멀티 노드 설정
- [관측성 가이드](guide-observability.md) - 로깅, 메트릭, 트레이싱
