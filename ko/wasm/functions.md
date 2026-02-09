# WASM 함수

WASM 함수는 WebAssembly 코드를 실행하는 레지스트리 엔트리입니다. 인라인 WAT 소스용 `function.wat`과 사전 컴파일된 바이너리용 `function.wasm`, 두 가지 엔트리 종류를 사용할 수 있습니다.

## 인라인 WAT 함수

WebAssembly Text 형식을 사용하여 `_index.yaml`에서 직접 작은 WASM 함수를 정의합니다:

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

| Field | Required | Description |
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

| Field | Required | Description |
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

| Type | Description |
|------|-------------|
| `inline` | 동기, 단일 스레드. 호출마다 새 인스턴스 생성. |
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
  warm_start: true   # Pre-instantiate initial workers
```

`max_size`가 지정되지 않은 경우 기본 탄력적 풀 최대값은 워커 100개입니다.

## 트랜스포트

트랜스포트는 런타임과 WASM 모듈 간의 입출력 매핑 방식을 제어합니다.

| Transport | Description |
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

함수의 최대 실행 시간을 설정합니다:

```yaml
limits:
  max_execution_ms: 5000   # 5 second timeout
```

제한을 초과하면 실행이 취소되고 오류가 반환됩니다.

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

| Field | Description |
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

-- Filter: returns only active users
local active, err = funcs.call("myns:filter_active", users)
```

### JavaScript 컴포넌트

WASM 컴포넌트 모델로 컴파일되는 모든 언어가 사용 가능합니다. 다음은 JavaScript에서 컴파일된 함수입니다:

```yaml
  - name: js_add
    kind: function.wasm
    fs: myns:wasm_binaries
    path: /js_calculator.wasm
    hash: sha256:eda7db3925a40c12b5e8c36b0d228a4be4f2c79ee8b5c86b912cf8b3d9a70a7c
    method: add
    pool:
      type: inline
```

```lua
local result, err = funcs.call("myns:js_add", 10, 20)
-- result: 30
```

### WASI Clocks를 사용한 비동기 슬립

`wasi:clocks`와 `wasi:io`를 임포트하는 WASM 컴포넌트는 클럭과 폴링을 사용할 수 있습니다. 비동기 양보 메커니즘은 Wippy 디스패처와 통합됩니다:

```yaml
  - name: sleep_ms
    kind: function.wasm
    fs: myns:wasm_binaries
    path: /sleep_test.wasm
    hash: sha256:...
    method: "test-sleep#sleep-ms"
    imports:
      - wasi:io
      - wasi:clocks
    pool:
      type: inline
```

method 필드의 `#` 구분자는 인터페이스 메서드를 참조합니다: `test-sleep#sleep-ms`는 `test-sleep` 인터페이스의 `sleep-ms` 함수를 호출합니다.

## 참고

- [개요](wasm/overview.md) - WebAssembly 런타임 개요
- [호스트 함수](wasm/hosts.md) - 사용 가능한 호스트 인터페이스
- [프로세스](wasm/processes.md) - WASM을 프로세스로 실행하기
- [엔트리 종류](guides/entry-kinds.md) - 모든 레지스트리 엔트리 종류
