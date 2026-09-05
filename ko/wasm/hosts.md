---
title: "호스트 함수"
description: "WASM 모듈은 호스트 함수 임포트를 통해 런타임 기능에 접근합니다. 각 임포트는 imports 목록에서 엔트리별로 명시적으로 선언됩니다."
---

# 호스트 함수

WASM 모듈은 호스트 함수 임포트를 통해 런타임 기능에 접근합니다. 각 임포트는 `imports` 목록에서 엔트리별로 명시적으로 선언됩니다.

## 임포트 유형

| Import | 네임스페이스 | 모듈 종류 | 설명 |
|--------|-----------|-------------|-------------|
| `wasi:cli` | `wasi:cli/*` | component | 환경, 종료, stdin/stdout/stderr, 터미널 |
| `wasi:io` | `wasi:io/error`, `wasi:io/streams` | component | 스트림 및 오류 처리 |
| `wasi:poll` | `wasi:io/poll` | component | 비동기 폴링 / 협조적 양보 |
| `wasi:clocks` | `wasi:clocks/*` | component | 벽시계 및 모노토닉 클럭 |
| `wasi:filesystem` | `wasi:filesystem/*` | component | 마운트된 디렉터리를 통한 파일 시스템 접근 |
| `wasi:random` | `wasi:random/*` | component | 암호학적으로 안전한 난수 및 비안전 난수 |
| `wasi:sockets` | `wasi:sockets/*` | component | TCP/UDP 네트워킹 및 DNS 확인 |
| `wasi:http` | `wasi:http/*` | component | 아웃바운드 HTTP 클라이언트 요청 |
| `funcs` | `wippy:runtime/funcs@0.1.0` | component | 게스트에서 레지스트리 함수 호출 |
| `wasi1` | `wasi_snapshot_preview1` | core | WASI Preview 1 호환 임포트 |
| `socket` | `wippy:runtime/socket@0.1.0` | core | 정수 전용 임포트를 통한 인스턴스 소유 아웃바운드 TCP |

여덟 개의 `wasi:*` 프로파일과 `funcs`는 component 전용입니다: core 모듈에 선언하면 엔트리가 실패합니다. `wasi1`과 `socket`은 core 임포트를 노출합니다.

각 프로파일은 짧은 이름으로도, 자신이 제공하는 인터페이스 네임스페이스 중 어느 것으로도, 그리고 버전이 붙은 네임스페이스로도 해석됩니다. 조회 전에 버전 접미사가 제거되므로 `wasi:io/poll`, `wasi:io/poll@0.2.3`, `wasi:poll`은 모두 같은 프로파일을 선택합니다.

어떤 프로파일로도 해석되지 않는 임포트는 `unsupported wasm host import: <id>`로 엔트리를 실패시키고; core 모듈에 선언된 component 전용 프로파일은 `wasm host import requires component module: <id>`로 실패합니다.

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

DNS 확인 기능이 포함된 TCP 및 UDP 네트워킹. 소켓 연산은 게스트를 일시 중단하고 디스패처를 통해 실행되며, 디스패처는 모든 다이얼, 바인드, 조회를 [네트워크 서비스](system/network.md)에서 수행합니다.

### wasi:http

**Interfaces:** `wasi:http/types`, `wasi:http/outgoing-handler`

WASM 모듈 내에서의 아웃바운드 HTTP 클라이언트 요청. WASI HTTP 사양에서 정의된 요청/응답 타입을 지원합니다.

## funcs

**네임스페이스:** `wippy:runtime/funcs@0.1.0`

component 게스트에서 레지스트리 함수를 호출합니다. 두 개의 진입점이 노출됩니다:

```wit
interface funcs {
  call-string: func(target: string, input: string) -> result<string, string>;
  call-bytes: func(target: string, input: list<u8>) -> result<list<u8>, string>;
}
```

`target`은 `namespace:name` 형식의 레지스트리 ID입니다. 모든 호출은 해당 대상에 대해 `funcs.call`로 정책 검사를 받으므로, 게스트는 호출자의 스코프가 이미 허용하는 함수에만 접근할 수 있습니다.

## wasi1

**네임스페이스:** `wasi_snapshot_preview1`

core 모듈이 WASI Preview 1에 링크됨을 선언합니다. 이 프로파일은 `preview1`과 `wasi-preview1`로도 해석됩니다. 자체 호스트는 등록하지 않으며; Preview 1 임포트는 하부 WASM 런타임이 충족합니다.

## socket

**네임스페이스:** `wippy:runtime/socket@0.1.0`

core(비 component) 모듈용 아웃바운드 TCP입니다. 호스트는 정수 전용 함수 네 개를 내보내므로, 게스트는 component 툴링 없이도 이를 사용할 수 있습니다:

| 함수 | 시그니처 | 결과 |
|----------|-----------|--------|
| `connect` | `(host_ptr: i32, host_len: i32, port: i32, timeout_ms: i32) -> i64` | `status << 32 \| handle` |
| `send` | `(handle: i32, buf_ptr: i32, buf_len: i32) -> i64` | `status << 32 \| written` |
| `recv` | `(handle: i32, out_ptr: i32, out_cap: i32) -> i64` | `status << 32 \| read` |
| `close` | `(handle: i32) -> i32` | `status` |

64비트 결과의 상위 32비트는 상태를, 하위 32비트는 값을 담습니다.

| 상태 | 값 | 의미 |
|--------|-------|---------|
| `OK` | 0 | 연산 성공 |
| `Invalid` | 1 | 잘못된 인자 또는 범위를 벗어난 메모리 영역 |
| `Denied` | 2 | 네트워크 서비스가 다이얼을 거부함 |
| `Failed` | 3 | 연산 실패 |
| `UnknownHandle` | 4 | 핸들이 이 인스턴스의 열린 연결이 아님 |
| `Limit` | 5 | `max_open_sockets`에 도달함 |
| `Timeout` | 6 | 다이얼 또는 읽기/쓰기 데드라인 만료 |

`connect`는 게스트 메모리에서 호스트 이름을 읽습니다; `host_len`은 1에서 253바이트 사이, `port`는 1에서 65535 사이여야 합니다. `timeout_ms`는 다이얼 데드라인을 좁힙니다: 실질 데드라인은 `timeout_ms`와 엔트리의 `socket_timeout_ms` 중 더 작은 값입니다. `send`와 `recv`는 `socket_timeout_ms`로 제한됩니다. `recv`는 정상적인 스트림 종료를 읽기 수 0의 `OK`로 보고합니다.

연결은 이를 연 인스턴스가 소유합니다. 핸들은 다른 인스턴스에게는 의미가 없고, 열린 소켓 수는 인스턴스별로 계산되며, 인스턴스가 닫히거나 웜 워커가 회수될 때 모든 연결이 닫힙니다.

## 네트워크 인가

두 소켓 호스트 모두 접근 여부를 스스로 결정하지 않습니다. 모든 다이얼, 바인드, 조회는 런타임 네트워크 서비스를 거치며, 이 서비스가 `socket.connect`, `socket.listen`, `socket.resolve` 권한을 확인하고, 사설 IP 정책을 적용하며, 선택된 경우 [오버레이 네트워크](system/network.md)를 통해 라우팅합니다. `wasi:sockets`는 추가로 DNS 조회 전에 `socket.resolve`를, UDP 바인드 전에 `socket.listen`을 사전 확인합니다.

## 참고

- [개요](wasm/overview.md) - WebAssembly 런타임 개요
- [함수](wasm/functions.md) - WASM 함수 설정
- [프로세스](wasm/processes.md) - WASM을 프로세스로 실행하기
- [네트워크 오버레이](system/network.md) - 오버레이 선택 및 소켓 권한
