---
title: "WASM 함수"
description: "인라인 WAT 함수와 사전 컴파일된 WASM 함수를 레지스트리 엔트리로 설정합니다."
---

# WASM 함수

인라인 WebAssembly Text 소스에는 `function.wat`, 사전 컴파일된 바이너리에는 `function.wasm`을 사용합니다.

**분류: 함수 설정 레퍼런스.** WAT 블록은 작은 레지스트리 예제입니다. 사전 컴파일 예제는 외부 컴포넌트 빌드, 파일 시스템 엔트리, guest WIT와 일치하는 export 메서드, 정확한 바이너리에서 계산한 SHA-256 digest를 전제로 합니다. 실제처럼 보이는 sample hash는 예시입니다.

## 인라인 WAT 함수

`_index.yaml`에서 WAT 함수를 직접 정의합니다.

```yaml
entries:
  - name: answer
    kind: function.wat
    source: |
      (module
        (func (export "answer") (result i32)
          i32.const 42
        )
      )
    wit: |
      answer: func() -> s32;
    method: answer
    pool:
      type: inline
```

더 큰 WAT 소스의 경우 파일 참조를 사용합니다:

```yaml
  - name: answer
    kind: function.wat
    source: file://answer.wat
    wit: |
      answer: func() -> s32;
    method: answer
    pool:
      type: inline
```

### WAT 설정 필드

| 필드 | 필수 | 설명 |
|-------|----------|-------------|
| `source` | Yes | 인라인 WAT 소스 또는 `file://` 참조 |
| `method` | Yes | 호출할 내보내기된 함수 이름 |
| `wit` | No | Raw/Core 모듈용 WIT 시그니처 |
| `pool` | No | 워커 풀 설정 |
| `transport` | No | 입출력 매핑 (기본값: `payload`) |
| `imports` | No | 활성화할 호스트 임포트 (예: `wasi:cli`, `wasi:io`) |
| `wasi` | No | WASI 설정 (args, env, mounts) |
| `limits` | No | 실행 제한 |

## 사전 컴파일된 WASM 함수

파일시스템 엔트리에서 컴파일된 `.wasm` 바이너리를 로드합니다:

```yaml
entries:
  - name: assets
    kind: fs.directory
    directory: ./wasm

  - name: compute
    kind: function.wasm
    fs: myns:assets
    path: /compute.wasm
    hash: sha256:292b796376f8b4cc360acf2ea6b82d1084871c3607a079f30b446da8e5c984a4
    method: compute
    pool:
      type: lazy
      max_size: 4
```

### WASM 설정 필드

| 필드 | 필수 | 설명 |
|-------|----------|-------------|
| `fs` | Yes | 바이너리가 포함된 파일시스템 엔트리 ID |
| `path` | Yes | 파일시스템 내 `.wasm` 파일 경로 |
| `hash` | Yes | 무결성 검증을 위한 SHA-256 해시 (`sha256:...`) |
| `method` | Yes | 호출할 내보내기된 함수 이름 |
| `wit` | No | Raw/Core 모듈용 WIT 시그니처 |
| `pool` | No | 워커 풀 설정 |
| `transport` | No | 입출력 매핑 (기본값: `payload`) |
| `imports` | No | 활성화할 호스트 임포트 |
| `wasi` | No | WASI 설정 |
| `limits` | No | 실행 제한 |

## 워커 풀

각 WASM 함수는 사전 컴파일된 인스턴스 풀을 사용합니다. 풀 타입은 동시성과 리소스 사용을 제어합니다.

| 타입 | 설명 |
|------|-------------|
| `inline` | mutex 직렬화. 순차 동기 호출은 하나의 warm instance를 재사용하고, asyncified 호출은 매 호출 후 닫히며 retained-memory 정책도 교체를 유발할 수 있음. |
| `lazy` | 유휴 워커 없음. 요청 시 `max_size`까지 확장. |
| `static` | 고정된 수의 워커와 요청 큐. |
| `adaptive` | 자동 스케일링 탄력적 풀. |

### 풀 설정

```yaml
pool:
  type: static
  size: 4            # Total pool size
  workers: 2         # Worker threads
  buffer: 16         # Request queue buffer (default: workers * 64)
```

```yaml
pool:
  type: lazy
  max_size: 8        # Maximum concurrent instances
```

```yaml
pool:
  type: adaptive
  max_size: 16       # Upper scaling bound
```

100-worker 기본값은 암시적으로 선택된 풀(`type`을 설정하지 않은 경우)에만 적용됩니다. `type: lazy` 또는 `type: adaptive`를 명시하고 `max_size`를 생략하면 기본 최대값은 16 workers입니다.

### 워커 클래스와 코어 어피니티

`pool.worker_class`를 설정하면 함수가 위의 공유 풀 타입 대신 OS 스레드에 고정된 전용 워커 풀로 라우팅됩니다 (설정 시 `type`은 무시됩니다; 관례적 이름: `wasm`):

```yaml
pool:
  worker_class: wasm
  workers: 8         # optional; defaults to reserved cores, else min(NumCPU, 4)
```

코어 격리는 `.wippy.yaml`에서 런타임별로 옵트인합니다:

```yaml
scheduler:
  wasm_isolation:
    enabled: true      # default: false
    reserved_cores: 2  # cores reserved for WASM pools (default: 1)
```

격리가 활성화되면 액터 스케줄러와 고정된 WASM 풀이 서로 겹치지 않는 CPU 집합에서 실행됩니다 (`sched_setaffinity`, Linux 전용 — 다른 플랫폼은 풀 크기만 조정하고 스레드를 바인딩하지 않습니다). 그러면 오래 실행되는 WASM 호출이 액터 스케줄링을 굶주리게 만들 수 없습니다.

## 트랜스포트

트랜스포트는 런타임과 WASM 모듈 간의 입출력 매핑 방식을 제어합니다.

| 트랜스포트 | 설명 |
|-----------|-------------|
| `payload` | 런타임 페이로드를 WASM 호출 인자에 직접 매핑 (기본값) |
| `wasi-http` | HTTP 요청/응답 컨텍스트를 WASM 인자 및 결과에 매핑 |

### Payload 트랜스포트

기본 트랜스포트는 인자를 직접 전달합니다. Lua 값은 Go 타입으로 변환된 후 WIT 타입으로 로우어링됩니다:

```yaml
  - name: compute
    kind: function.wasm
    fs: myns:assets
    path: /compute.wasm
    hash: sha256:...
    method: compute
    pool:
      type: inline
```

```lua
-- Arguments passed directly as WASM function parameters
local result, err = funcs.call("myns:compute", 6, 7)
if err then return nil, err end
-- result: 42
```

### WASI HTTP 트랜스포트

`wasi-http` 트랜스포트는 HTTP 요청을 WASM에 매핑하고 결과를 HTTP 응답에 다시 기록합니다. WASM 함수를 HTTP 엔드포인트로 노출할 때 사용합니다:

```yaml
  - name: greet_wasm
    kind: function.wasm
    fs: myns:assets
    path: /greet.wasm
    hash: sha256:...
    method: greet
    transport: wasi-http
    pool:
      type: inline

  - name: greet_endpoint
    kind: http.endpoint
    method: POST
    path: /api/greet
    func: greet_wasm
```

## 실행 제한

실행 시간을 제한하고 linear memory를 너무 많이 유지하는 warm instance를 재활용합니다.

```yaml
limits:
  max_execution_ms: 5000
  max_retained_memory_bytes: 67108864
  retained_memory_check_interval: 16
```

| 필드 | 기본값 | 설명 |
|-------|---------|-------------|
| `max_execution_ms` | `0` | 최대 호출 시간(밀리초); `0`은 timeout 비활성화 |
| `max_retained_memory_bytes` | 64 MiB | 호출 후 retained memory가 이 값을 넘으면 warm worker instance를 재활용; 명시적 `0`은 재활용 비활성화 |
| `retained_memory_check_interval` | 아래 참조 | retained-memory 검사 사이의 완료된 호출 수 |

실행 시간 제한을 넘으면 호출이 취소되고 오류를 반환합니다. 기본 64 MiB retained-memory 제한은 16회 호출마다 검사합니다. `max_retained_memory_bytes`를 양수로 명시하고 interval을 생략하면 런타임은 매 호출 후 검사합니다. 검사 비용을 분산하려면 양수 interval을 설정하십시오.

## WASI 설정

게스트 모듈의 WASI 기능을 설정합니다:

```yaml
wasi:
  args: ["--verbose"]
  cwd: "/app"
  env:
    - id: myns:api_key
      name: API_KEY
      required: true
    - id: myns:debug_mode
      name: DEBUG
  mounts:
    - fs: myns:data_files
      guest: /data
      read_only: true
    - fs: myns:output
      guest: /output
```

| 필드 | 설명 |
|-------|-------------|
| `args` | 게스트에 전달되는 커맨드라인 인자 |
| `cwd` | 게스트 내부의 작업 디렉터리 (절대 경로여야 함) |
| `env` | 레지스트리 env 엔트리에서 매핑되는 환경 변수 |
| `mounts` | 레지스트리 파일시스템 엔트리에서의 파일시스템 마운트 |

환경 변수는 호출 시점에 환경 레지스트리에서 확인됩니다. 필수 변수가 존재하지 않으면 오류가 발생합니다.

마운트 경로는 절대 경로이고 고유해야 합니다. 각 마운트는 런타임 파일시스템 엔트리를 게스트 디렉터리 경로에 매핑합니다.

## 예제

### 데이터 변환 파이프라인

```yaml
entries:
  - name: wasm_binaries
    kind: fs.directory
    directory: ./wasm

  - name: transform_users
    kind: function.wasm
    fs: myns:wasm_binaries
    path: /mapper.wasm
    hash: sha256:7304fc7d19778605458ae5804dae9a7343dcd3f5fc22bcc9415e98b5047192dd
    method: transform-users
    pool:
      type: lazy
      max_size: 4

  - name: filter_active
    kind: function.wasm
    fs: myns:wasm_binaries
    path: /mapper.wasm
    hash: sha256:7304fc7d19778605458ae5804dae9a7343dcd3f5fc22bcc9415e98b5047192dd
    method: filter-active
    pool:
      type: lazy
      max_size: 4
```

```lua
local funcs = require("funcs")

local users = {
    {id = 1, name = "Alice", tags = {"admin", "dev"}, active = true},
    {id = 2, name = "Bob", tags = {"user"}, active = false},
    {id = 3, name = "Carol", tags = {"dev"}, active = true},
}

-- Transform: adds display field and tag count
local transformed, err = funcs.call("myns:transform_users", users)
if err then return nil, err end

-- Filter: returns only active users
local active, filter_err = funcs.call("myns:filter_active", users)
if filter_err then return nil, filter_err end
```

### WASI Clocks를 사용한 비동기 슬립

`wasi:clocks`, `wasi:io` 및 별도의 `wasi:poll` 프로필을 import하는 WASM 컴포넌트는 clock과 polling을 사용할 수 있습니다. 비동기 yield 메커니즘은 Wippy dispatcher와 통합됩니다.

```yaml
  - name: sleep_ms
    kind: function.wasm
    fs: myns:wasm_binaries
    path: /sleep_test.wasm
    hash: sha256:...
    method: "test-sleep#sleep-ms"
    imports:
      - wasi:io
      - wasi:poll
      - wasi:clocks
    pool:
      type: inline
```

method 필드의 `#` 구분자는 인터페이스 메서드를 참조합니다: `test-sleep#sleep-ms`는 `test-sleep` 인터페이스의 `sleep-ms` 함수를 호출합니다.

## 참고

- [개요](./overview.md) - WebAssembly 런타임 개요
- [호스트 함수](./hosts.md) - 사용 가능한 호스트 인터페이스
- [프로세스](./processes.md) - WASM을 프로세스로 실행하기
- [엔트리 종류](../guides/entry-kinds.md) - 모든 레지스트리 엔트리 종류
