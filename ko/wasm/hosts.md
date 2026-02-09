# 호스트 함수

WASM 모듈은 호스트 함수 임포트를 통해 런타임 기능에 접근합니다. 각 임포트는 `imports` 목록에서 엔트리별로 명시적으로 선언됩니다.

## 임포트 유형

| Import | Description |
|--------|-------------|
| `funcs` | WASM 모듈 내에서 다른 Wippy 함수 (Lua 또는 WASM) 호출 |
| `wasi:cli` | 환경, 종료, stdin/stdout/stderr, 터미널 |
| `wasi:io` | 스트림, 오류 처리, 폴링 |
| `wasi:clocks` | 벽시계 및 모노토닉 클럭 |
| `wasi:filesystem` | 마운트된 디렉터리를 통한 파일 시스템 접근 |
| `wasi:random` | 암호학적으로 안전한 난수 |
| `wasi:sockets` | TCP/UDP 네트워킹 및 DNS 확인 |
| `wasi:http` | 아웃바운드 HTTP 클라이언트 요청 |

엔트리 설정에서 임포트를 활성화합니다:

```yaml
  - name: my_function
    kind: function.wasm
    fs: myns:assets
    path: /module.wasm
    hash: sha256:...
    method: run
    imports:
      - wasi:cli
      - wasi:io
      - wasi:clocks
      - wasi:filesystem
      - funcs
    pool:
      type: inline
```

모듈이 실제로 필요한 임포트만 선언하십시오.

## Wippy 함수 호스트

**Namespace:** `wippy:runtime/funcs@0.1.0`

WASM 모듈이 Lua 함수 및 다른 WASM 함수를 포함하여 Wippy 레지스트리의 모든 함수를 호출할 수 있도록 합니다.

### 인터페이스

```wit
interface funcs {
    call-string: func(target: string, input: string) -> result<string, string>;
    call-bytes: func(target: string, input: list<u8>) -> result<list<u8>, string>;
}
```

| Function | Description |
|----------|-------------|
| `call-string` | 문자열 입출력으로 함수 호출 |
| `call-bytes` | 바이너리 입출력으로 함수 호출 |

`target` 파라미터는 레지스트리 ID 형식을 사용합니다: `namespace:entry_name`.

### 예제

Lua 함수를 호출하는 WASM 컴포넌트:

```yaml
  - name: orchestrator
    kind: function.wasm
    fs: myns:assets
    path: /orchestrator.wasm
    hash: sha256:...
    method: run
    imports:
      - funcs
    pool:
      type: lazy
      max_size: 4
```

## WASI 임포트

각 `wasi:*` 임포트는 관련된 WASI Preview 2 인터페이스 그룹을 활성화합니다.

### wasi:clocks

**Interfaces:** `wasi:clocks/wall-clock`, `wasi:clocks/monotonic-clock`

시간 연산을 위한 벽시계 및 모노토닉 클럭. 모노토닉 클럭은 비동기 슬립을 위해 Wippy 디스패처와 통합됩니다.

### wasi:io

**Interfaces:** `wasi:io/error`, `wasi:io/streams`, `wasi:io/poll`

스트림 읽기/쓰기 연산 및 비동기 폴링. poll 인터페이스는 디스패처를 통한 협력적 양보를 가능하게 합니다.

### wasi:cli

**Interfaces:** `wasi:cli/environment`, `wasi:cli/exit`, `wasi:cli/stdin`, `wasi:cli/stdout`, `wasi:cli/stderr`

환경 변수, 프로세스 종료 코드, 표준 I/O 스트림에 대한 접근. 환경 변수는 WASI 설정을 통해 Wippy 환경 레지스트리에서 매핑됩니다.

### wasi:filesystem

**Interfaces:** `wasi:filesystem/types`, `wasi:filesystem/preopens`

마운트된 디렉터리를 통한 파일 시스템 접근. 마운트는 엔트리별로 설정되며 Wippy 파일시스템 엔트리를 게스트 경로에 매핑합니다.

```yaml
wasi:
  mounts:
    - fs: myns:data
      guest: /data
      read_only: true
```

### wasi:random

**Interfaces:** `wasi:random/random`, `wasi:random/insecure`, `wasi:random/insecure-seed`

암호학적으로 안전한 난수 및 비보안 난수 생성.

### wasi:sockets

**Interfaces:** `wasi:sockets/network`, `wasi:sockets/instance-network`, `wasi:sockets/ip-name-lookup`, `wasi:sockets/tcp`, `wasi:sockets/tcp-create-socket`, `wasi:sockets/udp`

DNS 확인 기능이 포함된 TCP 및 UDP 네트워킹. 소켓 연산은 비동기 I/O를 위해 디스패처와 통합됩니다.

### wasi:http

**Interfaces:** `wasi:http/types`, `wasi:http/outgoing-handler`

WASM 모듈 내에서의 아웃바운드 HTTP 클라이언트 요청. WASI HTTP 사양에서 정의된 요청/응답 타입을 지원합니다.

## 참고

- [개요](wasm/overview.md) - WebAssembly 런타임 개요
- [함수](wasm/functions.md) - WASM 함수 설정
- [프로세스](wasm/processes.md) - WASM을 프로세스로 실행하기
