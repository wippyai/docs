# 설정 레퍼런스

Wippy는 `.wippy.yaml` 파일로 설정됩니다. 모든 옵션에는 합리적인 기본값이 있습니다.

## Logger

zap 로거 인코더를 제어합니다. CLI 플래그(`-v`, `-c`, `-s`)는 레벨/출력을 재정의합니다. yaml로 제어할 수 있는 유일한 옵션은 인코딩입니다.

| 필드 | 타입 | 기본값 | 설명 |
|-------|------|---------|-------------|
| `encoding` | string | console | 인코더: `console`(사람이 읽기 쉬운) 또는 `json`(구조화됨) |

```yaml
logger:
  encoding: json
```

## 로그 매니저

런타임 로그 라우팅 제어. 콘솔 출력은 [CLI 플래그](guides/cli.md) (`-v`, `-c`, `-s`)로 설정됩니다.

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

참조: [Logger 모듈](lua/system/logger.md)

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

전역 보안 동작. 개별 정책은 [security.policy 엔트리](guides/entry-kinds.md)로 정의됩니다.

| 필드 | 타입 | 기본값 | 설명 |
|-------|------|---------|-------------|
| `strict_mode` | bool | false | 보안 컨텍스트 불완전 시 접근 거부 |

```yaml
security:
  strict_mode: true
```

참조: [보안 시스템](system/security.md), [보안 모듈](lua/security/security.md)

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

참조: [레지스트리 개념](concepts/registry.md), [레지스트리 모듈](lua/core/registry.md)

## 릴레이

노드 간 프로세스 메시지 라우팅.

| 필드 | 타입 | 기본값 | 설명 |
|-------|------|---------|-------------|
| `node_name` | string | local | 이 릴레이 노드의 식별자 |

```yaml
relay:
  node_name: worker-1
```

참조: [프로세스 모델](concepts/process-model.md)

## 슈퍼바이저

서비스 라이프사이클 관리. 라이프사이클 이벤트 디스패치에 사용되는 슈퍼바이저의 내부 제어 메일박스를 제어합니다.

| 필드 | 타입 | 기본값 | 설명 |
|-------|------|---------|-------------|
| `host.buffer_size` | int | 1024 | 내부 제어 메일박스 용량 |
| `host.worker_count` | int | 16 | 동시 디스패처 워커 |

```yaml
supervisor:
  host:
    buffer_size: 2048
    worker_count: 32
```

참조: [슈퍼비전 가이드](guides/supervision.md)

<note>
`process.host`별 워커와 큐는 이 전역 섹션이 아니라 엔트리 자체에서 (`workers`, `queue_size`, `local_queue_size`) 설정합니다. [Process Host](system/process-host.md) 엔트리 종류를 참조하세요.
</note>

## Lua 런타임

Lua VM 캐싱 및 표현식 평가.

| 필드 | 타입 | 기본값 | 설명 |
|-------|------|---------|-------------|
| `proto_cache_size` | int | 60000 | 컴파일된 프로토타입 캐시 |
| `main_cache_size` | int | 10000 | 메인 청크 캐시 |
| `cache.enabled` | bool | false | 컴파일된 바이트코드/타입체크 캐시를 디스크에 영속화 |
| `cache.dir` | string | (시스템 캐시 디렉토리) | 캐시 디렉토리 경로 |
| `cache.mode` | string | `read_write` | 캐시 모드: `read_write`, `read_only`, `write_only` |
| `type_system.enabled` | bool | false | 정적 타입 검사 활성화 |
| `type_system.strict` | bool | false | 타입 경고를 오류로 처리 |

```yaml
lua:
  proto_cache_size: 60000
  cache:
    enabled: true
    dir: .cache/lua
  type_system:
    enabled: true
```

참조: [Lua 개요](lua/overview.md)

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
| `service_name` | string | wippy-runtime | 서비스 식별자 |
| `service_version` | string | | 서비스 버전 태그 |
| `insecure` | bool | true | 평문 OTLP 연결 허용 |
| `sample_rate` | float | 1.0 | 트레이스 샘플링 (0.0-1.0) |
| `propagators` | string[] | `[tracecontext, baggage]` | 컨텍스트 전파자 |
| `traces_enabled` | bool | true | 트레이스 익스포트 |
| `metrics_enabled` | bool | false | 메트릭 익스포트 |
| `http.enabled` | bool | true | HTTP 요청 트레이싱 |
| `http.extract_headers` | bool | true | 수신 헤더에서 트레이스 컨텍스트 추출 |
| `http.inject_headers` | bool | true | 발신 헤더에 트레이스 컨텍스트 주입 |
| `process.enabled` | bool | true | 프로세스 라이프사이클 트레이싱 |
| `process.trace_lifecycle` | bool | true | spawn/terminate에 대한 span 발행 |
| `interceptor.enabled` | bool | true | 함수 호출 트레이싱 |
| `interceptor.order` | int | 100 | 인터셉터 우선순위 |
| `queue.enabled` | bool | true | 큐 publish/consume 트레이싱 |
| `temporal.enabled` | bool | false | Temporal 워크플로우 트레이싱 |

```yaml
otel:
  enabled: true
  endpoint: "http://jaeger:4318"
  traces_enabled: true
  process:
    trace_lifecycle: true
```

표준 OTEL 환경 변수(`OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_SERVICE_NAME`, `OTEL_TRACES_SAMPLER_ARG`, `OTEL_PROPAGATORS`, `OTEL_SDK_DISABLED`)는 해당 필드를 재정의합니다.

참조: [관측성 가이드](guides/observability.md)

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

참조: [메트릭 모듈](lua/system/metrics.md), [관측성 가이드](guides/observability.md)

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

참조: [관측성 가이드](guides/observability.md)

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

## LSP

에디터 통합을 위한 Language Server Protocol 서버.

| 필드 | 타입 | 기본값 | 설명 |
|-------|------|---------|-------------|
| `enabled` | bool | false | TCP 서버 활성화 |
| `address` | string | :7777 | TCP 리슨 주소 |
| `http_enabled` | bool | false | HTTP 전송 활성화 |
| `http_address` | string | :7778 | HTTP 리슨 주소 |
| `http_path` | string | /lsp | HTTP 엔드포인트 경로 |
| `http_allow_origin` | string | * | CORS 허용 오리진 |
| `max_message_bytes` | int | 8388608 | 수신 메시지 최대 크기 |

```yaml
lsp:
  enabled: true
  address: ":7777"
  http_enabled: true
```

참조: [LSP 가이드](guides/lsp.md)

## 네트워크 서비스

오버레이 네트워크 관리자 (SOCKS5, I2P, Tailscale 드라이버).

| 필드 | 타입 | 기본값 | 설명 |
|-------|------|---------|-------------|
| `state_dir` | string | .wippy/net | 드라이버 상태 저장 디렉토리 |
| `default_network` | string | | 엔트리가 `network`를 생략할 때 적용되는 기본 네트워크 ID |

```yaml
network_service:
  state_dir: /var/lib/wippy/net
  default_network: app:tailscale
```

참조: [네트워크 오버레이](system/network.md)

## 모듈

`wippy install`/`update`에서 사용되는 모듈 레지스트리 클라이언트.

| 필드 | 타입 | 기본값 | 설명 |
|-------|------|---------|-------------|
| `registry_url` | string | https://hub.wippy.ai | 레지스트리 엔드포인트 |

```yaml
modules:
  registry_url: https://internal-registry.example.com
```

## 익스텐션

부팅 시 로드되는 네이티브 Go 플러그인 익스텐션 (Unix 전용).

| 필드 | 타입 | 기본값 | 설명 |
|-------|------|---------|-------------|
| `enabled` | bool | true | 익스텐션 로드 |
| `paths` | string[] | | 플러그인 파일 경로 (설정 디렉토리 기준) |

```yaml
extensions:
  enabled: true
  paths:
    - ./extensions/myplugin.so
```

## 환경 변수

| 변수 | 설명 |
|----------|-------------|
| `GOMEMLIMIT` | 메모리 제한 (`--memory-limit` 플래그 오버라이드) |

## 참고

- [CLI 레퍼런스](guides/cli.md) - 커맨드라인 옵션
- [엔트리 종류](guides/entry-kinds.md) - 모든 엔트리 타입
- [관측성 가이드](guides/observability.md) - 로깅, 메트릭, 트레이싱
