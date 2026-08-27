---
title: "호스트 함수"
description: "엔트리 import를 통해 Wippy 함수 호출, WASI Preview 1 호환성 또는 선택한 WASI Preview 2 인터페이스를 활성화합니다."
---

# 호스트 함수

각 엔트리는 `imports` 필드를 통해 아래 호스트 인터페이스를 opt-in합니다.

**분류: 호스트 인터페이스 레퍼런스.** YAML 블록은 부분 엔트리입니다. 파일 시스템 ID, 경로, 메서드 및 hash를 컴파일된 모듈의 값으로 교체하십시오. digest는 모듈의 실제 SHA-256 값이어야 합니다.

## 임포트 유형

| Import | Description |
|--------|-------------|
| `funcs` | Component Model 모듈에서 Wippy 레지스트리 함수 호출 |
| `wasi1` | raw/core 모듈을 위한 WASI Preview 1 호환성 |
| `wasi:cli` | 환경, 종료, stdin/stdout/stderr, 터미널 |
| `wasi:io` | 스트림 및 오류 처리 |
| `wasi:poll` | 비동기 polling / cooperative yielding (`wasi:io/poll` 인터페이스) |
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
    pool:
      type: inline
```

모듈이 실제로 필요한 임포트만 선언하십시오.

아래의 `funcs` 및 `wasi:*` 프로필에는 Component Model 모듈이 필요합니다. `wasi_snapshot_preview1`을 import하는 raw/core 모듈에는 `wasi1`을 사용하십시오. `wasi-preview1`, `preview1`, `wasi_snapshot_preview1` alias는 같은 프로필로 resolve됩니다. 지원되지 않는 import 또는 core 모듈의 Component Model 전용 프로필은 모듈 준비 중에 실패합니다.

## Wippy 함수 호출

`funcs` 프로필은 Component Model 모듈에 `wippy:runtime/funcs@0.1.0` 인터페이스를 등록합니다.

```wit
interface funcs {
  call-string: func(target: string, input: string) -> result<string, string>;
  call-bytes: func(target: string, input: list<u8>) -> result<list<u8>, string>;
}
```

두 메서드 모두 Wippy 함수 레지스트리를 통해 대상을 호출합니다. 호출은 실행 보안 컨텍스트를 상속하며 대상 레지스트리 ID에 대한 `funcs.call` 권한이 필요합니다.

## WASI 임포트

각 `wasi:*` 임포트는 관련된 WASI Preview 2 인터페이스 그룹을 활성화합니다.

### wasi:clocks

**Interfaces:** `wasi:clocks/wall-clock`, `wasi:clocks/monotonic-clock`

시간 연산을 위한 벽시계 및 모노토닉 클럭. 모노토닉 클럭은 비동기 슬립을 위해 Wippy 디스패처와 통합됩니다.

### wasi:io

**Interfaces:** `wasi:io/error`, `wasi:io/streams`

스트림 읽기/쓰기 연산과 오류 처리입니다. `wasi:io/poll` 인터페이스는 별도의 `wasi:poll` import가 제공합니다.

### wasi:poll

**Interfaces:** `wasi:io/poll`

비동기 polling입니다. poll 인터페이스는 dispatcher를 통한 cooperative yielding을 활성화합니다.

### wasi:cli

**Interfaces:** `wasi:cli/environment`, `wasi:cli/exit`, `wasi:cli/stdin`, `wasi:cli/stdout`, `wasi:cli/stderr`, `wasi:cli/terminal-stdin`, `wasi:cli/terminal-stdout`, `wasi:cli/terminal-stderr`

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

**Interfaces:** `wasi:sockets/instance-network`, `wasi:sockets/ip-name-lookup`, `wasi:sockets/tcp`, `wasi:sockets/tcp-create-socket`, `wasi:sockets/udp`, `wasi:sockets/udp-create-socket`

DNS 확인 기능이 포함된 TCP 및 UDP 네트워킹. 소켓 연산은 비동기 I/O를 위해 디스패처와 통합됩니다.

### wasi:http

**Interfaces:** `wasi:http/types`, `wasi:http/outgoing-handler`

WASM 모듈 내에서의 아웃바운드 HTTP 클라이언트 요청. WASI HTTP 사양에서 정의된 요청/응답 타입을 지원합니다.

outgoing 요청에는 URL에 대한 `http_client.request` 권한이 필요합니다. private IP 주소로의 요청에는 resolve된 주소에 대한 `http_client.private_ip`도 필요합니다.

## 소켓 권한

`wasi:sockets`를 활성화하면 인터페이스가 제공되지만 네트워크 접근이 허가되지는 않습니다. DNS lookup에는 이름에 대한 `socket.resolve`, outbound TCP 연결에는 주소에 대한 `socket.connect`, TCP 또는 UDP bind에는 주소에 대한 `socket.listen`이 필요합니다.

## 참고

- [개요](./overview.md) - WebAssembly 런타임 개요
- [함수](./functions.md) - WASM 함수 설정
- [프로세스](./processes.md) - WASM을 프로세스로 실행하기
