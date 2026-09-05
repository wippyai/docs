---
title: "설정 레퍼런스"
description: "Wippy는 .wippy.yaml 파일로 설정됩니다. 모든 옵션에는 합리적인 기본값이 있습니다."
---

# 설정 레퍼런스

Wippy는 `.wippy.yaml` 파일로 설정됩니다. 모든 옵션에는 합리적인 기본값이 있습니다.

아래의 모든 값은 실행 시 `wippy run --set section.path=value`로 재정의할 수 있습니다(반복 가능하며, 파일보다 우선합니다). 이러한 설정 섹션이 아니라 개별 레지스트리 *엔트리*를 재정의하려면 `override:` 섹션이나 `-o`를 사용하세요 — [엔트리 재정의](guides/entry-kinds.md#overriding-entries)를 참고하세요.

## 설정 합성 {#config-composition}

`--config`는 반복 가능하며, 파일은 같은 스키마를 사용해 왼쪽에서 오른쪽으로 합성됩니다:

```bash
wippy run --config .wippy.yaml --config .wippy.local.yaml
```

- 뒤의 파일이 일치하는 값을 재정의하고 나머지는 모두 유지합니다.
- 명시적으로 지정된 파일은 모두 존재해야 합니다. `--config`가 없으면 기본 `.wippy.yaml`은 선택 사항입니다.
- 첫 번째 파일이 상대 경로 해석에 사용되는 디렉토리를 고정합니다.
- 파일 이름에는 예약된 의미가 없습니다; 기본값 외에는 아무것도 자동 발견되지 않습니다.

설정은 파일 합성, `--profile` 선택, `--set` 재정의 순서로 적용됩니다. 팩에서 실행되는 애플리케이션의 경우, 팩된 런타임 기본값이 이 모든 것 아래에 위치합니다 ([런타임 기본값 게시](guides/publishing.md#publishing-runtime-defaults) 참조).

## 프로파일 {#profiles}

설정 파일은 `profiles:` 아래에 이름 있는 오버레이를 선언할 수 있습니다. 각 프로파일 본문은 일반 설정 섹션을 그대로 반영하며, `--profile <name>`으로 선택하면 병합된 기본 설정 위에 해당 값이 오버레이됩니다:

```yaml
version: "1.0"

vars:
  port: 8085

override:
  app:db:kind: db.sql.sqlite

disable:
  namespaces: ["legacy.**"]

profiles:
  pg:
    vars:
      port: 18085
    override:
      app:db:kind: db.sql.postgres
    disable:
      namespaces.add: ["experimental.**"]
```

```bash
wippy run --profile pg
```

- `--profile`은 반복 가능합니다; 프로파일은 파일 합성 이후, `--set` 이전에 왼쪽에서 오른쪽으로 합성됩니다. 알 수 없는 이름은 오류입니다.
- 값은 리프 단위로 병합됩니다 (마지막 작성자가 이깁니다). `profiles:` 섹션 자체는 해석된 설정에서 제거됩니다.
- `disable` 섹션은 프로파일 안에서 리스트 연산을 지원합니다 — `namespaces.add`, `namespaces.remove`, `entries.add`, `entries.remove` — 그래서 프로파일이 기본 리스트를 교체하는 대신 조정할 수 있습니다.
- `${name}` 참조는 병합된 `vars:` 섹션에서 보간됩니다. 프로파일 vars 안에서는 OS 환경 참조가 허용되지 않습니다; 기본 설정에서 `${env:NAME}`을 사용하세요 (파일 로드 시 해석됨).

`wippy run`, `test`, `pack`이 `--profile`을 받습니다; `run list`, `install`, `update`, `lint`, `registry`도 워크스페이스 프로파일용으로 이를 받습니다 (`--set`과 함께). 애플리케이션은 팩 안에 프로파일을 실어 보낼 수 있습니다 — [프로파일 게시](guides/publishing.md#publishing-profiles)를 참조하세요.

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
| `min_level` | int | 0 (`-v`일 때 `-1`) | 최소 레벨: -1=debug, 0=info, 1=warn, 2=error. CLI가 파일을 읽은 뒤 자신의 플래그로 이 키를 기록하므로 파일 값은 무시됩니다. `--set logmanager.min_level=<n>`으로 변경하십시오 |

```yaml
logmanager:
  propagate_downstream: true
  stream_to_events: false
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
| `strict_mode` | bool | true | 보안 컨텍스트가 불완전할 때 접근 거부 |

```yaml
security:
  strict_mode: false
```

참조: [보안 시스템](system/security.md), [보안 모듈](lua/security/security.md)

## 레지스트리

엔트리 스토리지 및 버전 히스토리. 레지스트리는 모든 설정 엔트리를 보유합니다.

| 필드 | 타입 | 기본값 | 설명 |
|-------|------|---------|-------------|
| `enable_history` | bool | true | 엔트리 버전 추적 |
| `history_type` | string | memory | 스토리지: `memory`, `sqlite`, `postgres`, `nil` |
| `history_path` | string | .wippy/registry.db | SQLite 파일 경로 (`history_type: sqlite`일 때 사용) |
| `history_dsn` | string | | Postgres DSN (`history_type: postgres`일 때 사용) |
| `history_schema` | string | | Postgres 스키마 이름 (`history_type: postgres`일 때 사용) |
| `event_wait_timeout` | duration | 30s | 레지스트리 적용 중 리스너 확인 응답에 대한 작업별 대기 시간 |
| `dispatch_internal_kinds` | string[] | `[registry.entry, ns.dependency, ns.requirement, ns.definition]` | 컴포넌트 리스너로 디스패치되지 않고 내부적으로 처리되는 엔트리 kind |
| `dependency_resolve_timeout` | duration | 0 (없음) | 의존성 해석에 대한 제한 시간 |
| `dependency_download_timeout` | duration | 0 (없음) | 각 모듈 다운로드 및 다운로드 URL 요청에 대한 제한 시간 |
| `dependency_lock_path` | string | 탐색된 `wippy.lock` | 의존성 핸들러가 읽고 쓰는 잠금 파일 |
| `dependency_vendor_dir` | string | `<lock dir>/<directories.modules>/vendor` | 다운로드된 모듈 팩을 담는 디렉토리 |

```yaml
registry:
  history_type: sqlite
  history_path: /var/lib/wippy/registry.db
```

```yaml
registry:
  history_type: postgres
  history_dsn: ${env:WIPPY_REGISTRY_HISTORY_DSN}
  history_schema: wippy_registry
```

참조: [레지스트리 개념](concepts/registry.md), [레지스트리 모듈](lua/core/registry.md)

## 아티팩트

구체화된 [빌드 타임 아티팩트](guides/artifacts.md)의 출력 루트입니다.

| 필드 | 타입 | 기본값 | 설명 |
|-------|------|---------|-------------|
| `materialization_root` | string | 의존성 vendor 디렉토리의 상위 | 각 아티팩트 형식이 자체 하위 트리를 기록하는 애플리케이션 소유 루트 |

```yaml
artifact:
  materialization_root: build/wippy
```

참조: [빌드 타임 아티팩트](guides/artifacts.md#where-output-lands)

## 워크스페이스

`org/module`을 키로 하는 로컬 모듈 대체입니다. 값은 디렉토리이며, 상대 경로는 첫 번째 `--config` 파일의 디렉토리를 기준으로 해석되고, `null`은 이전 설정 레이어나 프로파일에서 상속된 대체를 비활성화합니다.

```yaml
workspace:
  replacements:
    acme/http: ../local-http
    acme/sql: null
```

대체는 `wippy.lock`에 절대 기록되지 않습니다. [대체를 사용한 로컬 개발](guides/dependency-management.md#local-development-with-replacements)을 참조하세요.

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
| `cache.enabled` | bool | `type_system.enabled` | 컴파일된 바이트코드/타입체크 캐시를 디스크에 영속화; 명시적으로 설정하지 않으면 `type_system.enabled`를 따름 |
| `cache.dir` | string | `.wippy/cache/lua` | 캐시 디렉토리 경로 (설정/작업 디렉토리 기준 상대 경로) |
| `cache.mode` | string | `readwrite` | 캐시 모드: `readwrite` (기본값), `readonly`, `off`; 알 수 없는 값은 `readwrite`로 대체됨 |
| `cache.compile.enabled` | bool | true | 컴파일된 바이트코드 영속화 (`cache.enabled`일 때) |
| `cache.typecheck.enabled` | bool | true | 타입체크 결과 영속화 (`cache.enabled`일 때) |
| `cache.max_bytes` | int | 1073741824 | 디스크 캐시 크기 상한 (바이트) |
| `cache.max_entries` | int | 20000 | 최대 캐시 엔트리 수 |
| `cache.prune_interval` | int | 256 | 캐시 정리 패스 사이의 쓰기 횟수 |
| `type_system.enabled` | bool | false | 정적 타입 검사 활성화 |
| `type_system.strict` | bool | false | 타입 경고를 오류로 처리 |
| `invalidation_wait_timeout` | duration | `registry.event_wait_timeout` (30s) | 엔트리 변경 후 코드 무효화 확인 응답 대기 시간 |
| `eval.max_steps` | int | 10000 | `eval` 실행의 기본 스케줄러 스텝 예산; 음수 값은 거부됨 |
| `eval.cache_size` | int | 256 | 평가된 소스의 컴파일된 프로그램 캐시 엔트리 수 |
| `eval.cache_ttl` | duration | 0 (만료 없음) | 캐시된 컴파일 프로그램의 수명 |

```yaml
lua:
  cache:
    enabled: true
    dir: .cache/lua
  type_system:
    enabled: true
```

참조: [Lua 개요](lua/overview.md)

## 스케줄러

WASM 런타임을 위한 코어 파티셔닝. 활성화하면 `reserved_cores`개의 CPU가 WASM 실행용으로 예약되고 나머지가 액터 스케줄러를 담당합니다. 잘못된 분할(예: 사용 가능한 것보다 많은 예약 코어)은 로그에 남고 무시됩니다.

| 필드 | 타입 | 기본값 | 설명 |
|-------|------|---------|-------------|
| `wasm_isolation.enabled` | bool | false | WASM 작업과 액터 작업 사이에 코어를 분할 |
| `wasm_isolation.reserved_cores` | int | 1 | WASM 실행용으로 예약된 코어 수 |

```yaml
scheduler:
  wasm_isolation:
    enabled: true
    reserved_cores: 2
```

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

표준 OTEL 환경 변수(`OTEL_SDK_DISABLED`, `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_EXPORTER_OTLP_PROTOCOL`, `OTEL_EXPORTER_OTLP_INSECURE`, `OTEL_SERVICE_NAME`, `OTEL_SERVICE_VERSION`, `OTEL_TRACES_SAMPLER`, `OTEL_TRACES_SAMPLER_ARG`, `OTEL_PROPAGATORS`)는 해당 필드를 재정의합니다.

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
| `interceptor.enabled` | bool | true | 함수 호출 자동 추적 |

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
| `max_cardinality` | int | 1024 | 메트릭당 유지되는 고유 레이블 세트 수 (LRU); `0` 이하이면 기본값 사용 |

```yaml
prometheus:
  enabled: true
  address: "0.0.0.0:9090"
```

Prometheus 스크레이핑을 위해 `/metrics` 엔드포인트와 함께 `/livez`를 노출합니다.

참조: [관측성 가이드](guides/observability.md)

## 클러스터

멀티 노드 클러스터링: gossip 멤버십과 제한된 Raft 합의 코어. 아키텍처와 운영 모델은 [클러스터 가이드](guides/cluster.md)를 참조하세요. 이 섹션은 설정 키 레퍼런스입니다.

### 최상위

| 필드 | 타입 | 기본값 | 설명 |
|-------|------|---------|-------------|
| `enabled` | bool | false | 클러스터링 활성화 |
| `name` | string | hostname | 노드 이름; 클러스터 전체에서 고유해야 함 |
| `failure_domain` | string | | 가용 영역/랙 레이블; gossip에서 광고되어 voter가 도메인 간에 분산됨 |
| `kv_crdt_tombstone_retention` | duration | 0 | `store.kv.crdt` 삭제 툼스톤이 회수되는 경과 시간; `0`이면 수명 기반 GC 비활성화 |
| `kv_crdt_tombstone_gc_alive_peers` | bool | false | 현재 살아 있는 멤버십을 툼스톤 확인 응답 집합으로 사용 |

### 멤버십 (gossip)

memberlist를 통한 SWIM gossip. 노드 디스커버리, 장애 감지, 메타데이터 전파에 사용됩니다.

| 필드 | 타입 | 기본값 | 설명 |
|-------|------|---------|-------------|
| `membership.bind_addr` | string | 0.0.0.0 | Gossip 바인드 주소 |
| `membership.bind_port` | int | 7946 | Gossip 바인드 포트 (TCP+UDP) |
| `membership.advertise_addr` | string | | 피어가 이 노드에 도달하기 위해 사용하는 주소 (NAT/k8s) |
| `membership.join_addrs` | string | | 쉼표로 구분된 시드 `host:port` 쌍 |
| `membership.secret_key` | string | | Base64로 인코딩된 gossip 암호화 키 (인라인) |
| `membership.secret_file` | string | | gossip 암호화 키를 보유하는 파일 경로 |
| `membership.gossip_interval` | duration | 500ms | Gossip 전파 주기 |
| `membership.push_pull_interval` | duration | 5s | 전체 상태 동기화 주기 |
| `membership.dead_node_reclaim_time` | duration | 30s | 죽은 노드의 이름/주소를 회수할 수 있게 되는 시점 |
| `membership.probe_interval` | duration | 1s | 장애 감지 프로브 주기 |
| `membership.probe_timeout` | duration | 200ms | 프로브당 ack 대기 시간 |
| `membership.tcp_timeout` | duration | 1s | TCP 폴백 프로브 타임아웃 |
| `membership.suspicion_mult` | int | 3 | Suspicion 타임아웃 배수 |

Gossip 시크릿은 필수입니다. `membership.secret_key` 또는 `membership.secret_file`을 설정하세요(둘 다 주어지면 파일이 우선합니다); 둘 다 없으면 클러스터 컴포넌트가 시작에 실패합니다. 값은 base64로 인코딩됩니다.

네 개의 프로브 키는 설정되지 않으면 memberlist의 로컬 네트워크 기본값을 상속합니다; 지연이 큰 링크에서는 값을 올리세요 (예: `probe_interval: 2s`, `probe_timeout: 500ms`, `suspicion_mult: 5`).

### 인터노드 (전송)

노드 간 릴레이와 Raft 트래픽을 전달하는 TCP 메시. Raft는 인터노드 요청/응답을 통해 이 메시 위에서 동작하며, 별도의 Raft 포트는 없습니다.

| 필드 | 타입 | 기본값 | 설명 |
|-------|------|---------|-------------|
| `internode.bind_addr` | string | 0.0.0.0 | 메시 바인드 주소 |
| `internode.bind_port` | int | 0 | 메시 포트 (0 = 자동: 7950-7959, 이후 임시 포트) |
| `internode.auto_port` | bool | true | 부팅 시 실제 포트를 감지하여 고정하고 gossip에서 광고 |
| `internode.advertise_addr` | string | | 업그레이드된 피어에게 게시되는 추가 릴레이 엔드포인트(IP 또는 DNS 이름) — NAT 또는 로드밸런서 뒤의 도달성용 |
| `internode.advertise_port` | int | 0 | `advertise_addr`용 포트 (0 = 바인드 포트; `advertise_addr` 필요) |
| `internode.identity_key` | string | | 이 노드를 식별하는 base64 인코딩 ed25519 개인 키 (인라인) |
| `internode.identity_key_file` | string | | 해당 키를 담은 파일의 경로 |
| `internode.trusted_peer_keys` | map | | 이 노드를 포함한 노드 이름별 base64 인코딩 ed25519 공개 키 |

`advertise_addr`/`advertise_port`는 노드 메타데이터에 추가 엔드포인트를 게시하며 바인드 엔드포인트는 변경 없이 계속 광고되므로, 혼합 버전 클러스터가 롤링 업그레이드 중에도 계속 연결됩니다.

클러스터링이 활성화되면 노드 간 아이덴티티는 필수입니다. `identity_key`와 `identity_key_file`은 상호 배타적이며 둘 중 하나는 반드시 있어야 합니다; 값은 (표준 또는 raw base64로) 32바이트 ed25519 시드 또는 64바이트 ed25519 개인 키로 디코딩됩니다. `trusted_peer_keys`는 각 노드 이름을 그 노드의 32바이트 ed25519 공개 키에 매핑하며, 로컬 `cluster.name`에 대한 엔트리가 로컬 아이덴티티와 일치하는 값으로 포함되어야 합니다 — 그렇지 않으면 시작에 실패합니다. [클러스터 가이드](guides/cluster.md#internode-identity)를 참조하세요.

### Raft (합의)

제한된 Raft. Raft 상태는 기본적으로 fs-durable이며 `raft.data_dir`(기본값 `~/.wippy/store`) 아래에 저장됩니다. 재시작된 노드는 여전히 피어로부터 쿼럼에 다시 참여합니다. [`store.kv.raft`](system/store.md#cluster-kv-stores) 엔트리는 이를 통해 복제됩니다. 부트스트랩은 gossip 기반(Consul/Nomad의 `bootstrap_expect` 방식)입니다.

| 필드 | 타입 | 기본값 | 설명 |
|-------|------|---------|-------------|
| `raft.data_dir` | string | `~/.wippy/store` | fs-durable Raft 상태와 durable CRDT 스냅샷용 디렉터리(`<data_dir>/_sys/` 아래). 경로가 해석되지 않을 때만 디스크 없음(홈 디렉터리가 없고 설정도 없는 경우) |
| `raft.enabled` | bool | true | Raft 노드 실행; `false`이면 gossip 전용 클라이언트 |
| `raft.role` | string | server | `server`는 Raft 노드를 실행하고, `client`는 gossip 전용 |
| `raft.eligible` | bool | true | 이 노드가 voter로 선택될 수 있는지 여부 |
| `raft.priority` | int | 100 | Voter 선택 우선순위 (낮을수록 선호) |
| `raft.bootstrap_expect` | int | 1 | 초기 쿼럼 크기: `0`=기존 클러스터에 참여, `1`=단일 노드, `N`=N개의 eligible 피어를 기다린 후 쿼럼 형성 |
| `raft.max_voters` | int | 5 | Voter 상한선 (홀수여야 함); 초과하는 eligible 노드는 standby가 됨 |
| `raft.max_standbys` | int | 4 | 승격을 위해 준비 상태로 유지되는 비투표 멤버; voters+standbys를 초과하는 노드는 Raft 멤버가 아님 |
| `raft.reconcile_debounce` | duration | 2s | voter 조정자 실행 전 gossip 이벤트 이후 집계 창 |
| `raft.reconcile_timeout` | duration | 2s | 조정 패스당 상한 |
| `raft.heartbeat_timeout` | duration | 3s | 선거를 시작하기 전 팔로워 대기 시간 |
| `raft.election_timeout` | duration | 3s | 후보 선거 타임아웃 (heartbeat 이상으로 제한됨) |
| `raft.commit_timeout` | duration | 500ms | 유휴 리더 하트비트 주기 |
| `raft.snapshot_threshold` | uint64 | 8192 | 새 스냅샷 전 마지막 스냅샷 이후의 로그 항목 수 |
| `raft.snapshot_interval` | duration | 2m | 스냅샷 확인 간격 |
| `raft.snapshot_retain` | int | 3 | 보관되는 스냅샷 수 |
| `raft.trailing_logs` | uint64 | 10240 | 스냅샷 이후 보관되는 로그 항목 수 |
| `raft.max_append_entries` | int | 16 | AppendEntries RPC당 최대 항목 수 |
| `raft.leader_probe_interval` | duration | 3s | 글로벌 레지스트리 리더 도달 가능성 프로브 주기 |
| `raft.leader_probe_grace` | int | 3 | 리더를 도달 불가능으로 선언하기 전 연속 프로브 실패 횟수 |
| `raft.registry_backend` | string | kv | 클러스터 이름 레지스트리 구현: `kv` (공유 kv 키스페이스) 또는 `fsm` (전용 Raft FSM) |
| `raft.global_dissem_tombstone_retention` | duration | 0 | 글로벌 이름 전파 캐시가 삭제 툼스톤을 유지하는 기간 |

단일 노드 (개발) — 클러스터링 활성화, 즉시 자체 부트스트랩:

```yaml
cluster:
  enabled: true
  name: dev
  membership:
    secret_key: "d2lwcHktZG9jcy1nb3NzaXAtc2VjcmV0LTMyYnl0ZXM="
  internode:
    identity_key: "d2lwcHktZG9jcy1kZXYtbm9kZS1leGFtcGxlc2VlZCE="
    trusted_peer_keys:
      dev: "rNqImcjOzef28dzvma80mSrCW1px5LBAc5TbaYqAgm0="
  raft:
    bootstrap_expect: 1
```

3노드 voting 클러스터 — 각 노드가 다른 노드를 시드로 나열하고 쿼럼을 형성하기 전에 세 노드 모두를 기다림. 모든 노드가 동일한 `trusted_peer_keys` 맵과 자체 개인 키를 가집니다:

```yaml
cluster:
  enabled: true
  name: node-1
  failure_domain: us-east-1a
  membership:
    bind_port: 7946
    join_addrs: "node-2:7946,node-3:7946"
    secret_file: /etc/wippy/cluster.key
  internode:
    identity_key_file: /etc/wippy/node-1.key
    trusted_peer_keys:
      node-1: "okmamN3PKkMpPwPBurknHy2Wi3dwp/rz+uTM2fF9aD0="
      node-2: "PWX+oOYrFdtjUxbgmTkXCFI0KEvG++ZM52HOWfDkqP8="
      node-3: "QfP0fgllbj4s95VAztTORhy3bv9mst1l0lwuUNvO/hE="
  raft:
    bootstrap_expect: 3
    max_voters: 5
```

Gossip 전용 클라이언트 — 명명/메시징을 위해 클러스터에 참여하지만 Raft를 실행하지 않음. 여전히 자체 아이덴티티가 필요하며 모든 노드의 신뢰 맵에 나타나야 합니다:

```yaml
cluster:
  enabled: true
  name: edge-7
  membership:
    join_addrs: "node-1:7946,node-2:7946"
    secret_file: /etc/wippy/cluster.key
  internode:
    identity_key_file: /etc/wippy/edge-7.key
    trusted_peer_keys:
      node-1: "okmamN3PKkMpPwPBurknHy2Wi3dwp/rz+uTM2fF9aD0="
      node-2: "PWX+oOYrFdtjUxbgmTkXCFI0KEvG++ZM52HOWfDkqP8="
      node-3: "QfP0fgllbj4s95VAztTORhy3bv9mst1l0lwuUNvO/hE="
      edge-7: "7lzP4jBAkC3P+0jq4vtMsC45571BlVXk3mSlOD/Z0SA="
  raft:
    role: client
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

## HTTP 디스패처

HTTP 디스패치 함수와 아웃바운드 요청에 사용되는 공유 HTTP 클라이언트 풀 튜닝.

| 필드 | 타입 | 기본값 | 설명 |
|-------|------|---------|-------------|
| `dispatcher.http.timeout` | duration | 0 (없음) | 요청당 타임아웃 |
| `dispatcher.http.max_idle_conns` | int | 0 (stdlib) | 모든 호스트의 최대 유휴 연결 수 |
| `dispatcher.http.max_idle_per_host` | int | 0 (stdlib) | 호스트당 최대 유휴 연결 수 |
| `dispatcher.http.idle_conn_timeout` | duration | 0 (stdlib) | 유휴 연결 타임아웃 |
| `dispatcher.http.max_clients` | int | 0 (무제한) | 최대 풀링 클라이언트 수 |

```yaml
dispatcher:
  http:
    timeout: 30s
    max_idle_per_host: 32
```

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
| `GOMEMLIMIT` | 메모리 제한 (`--memory-limit` 플래그 재정의) |

## 참고

- [CLI 레퍼런스](guides/cli.md) - 커맨드라인 옵션
- [클러스터 가이드](guides/cluster.md) - 클러스터링 아키텍처 및 운영
- [엔트리 종류](guides/entry-kinds.md) - 모든 엔트리 타입
- [관측성 가이드](guides/observability.md) - 로깅, 메트릭, 트레이싱
