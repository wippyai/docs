---
title: "WASM 프로세스"
description: "process.wasm을 사용하여 Wippy 프로세스 호스트 아래에서 WASM 모듈을 실행합니다."
---

# WASM 프로세스

`process.wasm` 엔트리는 spawn, monitoring 및 supervised shutdown을 제공하는 Wippy 프로세스 호스트 아래에서 WASM 모듈을 실행합니다.

**분류: 프로세스 설정 및 생명주기 레퍼런스.** binary-backed 블록은 외부 component build와 애플리케이션 소유의 파일 시스템, 프로세스 호스트, 환경 및 정책 엔트리를 전제로 합니다. placeholder hash는 정확한 binary digest로 교체해야 합니다.

## 엔트리 설정

```yaml
entries:
  - name: wasm_binaries
    kind: fs.directory
    directory: ./wasm

  - name: compute_worker
    kind: process.wasm
    fs: myns:wasm_binaries
    path: /worker.wasm
    hash: sha256:292b796376f8b4cc360acf2ea6b82d1084871c3607a079f30b446da8e5c984a4
    method: run
    imports:
      - wippy:actor
      - wasi:io
      - wasi:poll
    options:
      limits:
        memory_bytes: 67108864
      mailbox:
        capacity: 128
        bytes: 8388608
        message_bytes: 1048576
```

### 설정 필드

| 필드 | 필수 | 설명 |
|-------|----------|-------------|
| `fs` | 예 | 바이너리가 포함된 파일시스템 엔트리 ID |
| `path` | 예 | 파일시스템 내 `.wasm` 파일 경로 |
| `hash` | 예 | 무결성 검증을 위한 SHA-256 해시 |
| `method` | 예 | 실행할 내보내기된 함수 이름 |
| `transport` | 아니요 | 호출 전송: `payload` (기본값) 또는 `wasi-http` |
| `wit` | 아니요 | raw/core 모듈용 WIT 시그니처 |
| `imports` | 아니요 | 활성화할 호스트 임포트 |
| `wasi` | 아니요 | WASI 설정 (`args`, `cwd`, `env`, `mounts`) |
| `options` | 아니요 | Actor 제어: `worker_class`, `limits`, `mailbox` |

<note>
`process.wasm` Actor는 PID 수명 전체에 하나의 모듈 인스턴스를 소유하고 메시지 사이에 guest 상태를 유지합니다. 따라서 함수 pooling은 적용되지 않으며 `pool` 블록은 거부됩니다. Actor 제한은 `options.limits`에 둡니다. 이전 `limits` 및 `meta.options` 표기는 사용 중단 경고와 함께 일시적으로 허용됩니다.
</note>

## 상태 유지 Actor와 메시징

component guest에서 `wippy:actor`를 import하면 현재 PID와 제한된 mailbox에 접근할 수 있습니다. `wippy:actor/process@0.1.0` 인터페이스는 다음 기능을 제공합니다.

| 함수 | 동작 |
|----------|----------|
| `self()` | 현재 actor PID를 문자열로 반환 |
| `send(target, topic, payloads)` | 정책에 따라 허용된 메시지를 다른 PID로 전송 |
| `try-receive()` | 다음 메시지를 즉시 반환하며, 없으면 `none` 반환 |
| `receive()` | 메시지를 사용할 수 있을 때까지 중단 |
| `subscribe()` | mailbox 준비 상태를 위한 `wasi:io/poll` pollable 반환 |

메시지에는 보낸 PID, topic, 최대 16개의 payload가 포함됩니다. payload 형식은 `bytes`, UTF-8 `text`, UTF-8 `json`입니다. 전송은 대상 PID에 대한 `process.send`로 권한을 확인합니다. 형식이 잘못되었거나 크기 또는 용량 제한을 초과한 메시지는 guest가 받기 전에 mailbox에서 거부됩니다.

guest는 일반적으로 오래 실행되는 `run` 함수를 export합니다. 예:

```wit
package example:worker;

world worker {
  import wippy:actor/process@0.1.0;
  import wasi:io/poll@0.2.8;
  export run: func() -> result<_, string>;
}
```

`run`에서 반복적으로 `receive()`를 호출하고 guest 상태를 업데이트합니다. 응답하려면 `message.from`으로 `send()`를 사용합니다. `run`이 반환되면 프로세스가 종료됩니다.

## CLI 명령

`meta.command`를 사용하여 WASM 프로세스를 이름이 있는 명령으로 등록합니다:

```yaml
  - name: greet
    kind: process.wasm
    meta:
      command:
        name: greet
        short: Greet someone via WASM
    fs: myns:wasm_binaries
    path: /component.wasm
    hash: sha256:...
    method: greet
```

다음과 같이 실행합니다:

```bash
wippy run greet
```

사용 가능한 명령 목록을 확인합니다:

```bash
wippy run list
```

| 필드 | 필수 | 설명 |
|-------|----------|-------------|
| `name` | 예 | `wippy run <name>`에서 사용하는 명령 이름 |
| `short` | 아니요 | `wippy run list`에 표시되는 간단한 설명 |
| `main` | 아니요 | pack 또는 hub 모듈의 기본 명령으로 엔트리 지정 |
| `use_case` | 아니요 | entrypoint category; 기본값 `run` |
| `security` | 아니요 | 신뢰된 terminal launcher가 이 명령을 시작할 때만 적용되는 보안 컨텍스트 |

CLI 명령이 동작하려면 `terminal.host`가 있어야 합니다. 이것이 명령을 실행하는 프로세스 호스트입니다.

## 프로세스 생명주기

WASM 프로세스는 Init/Step/Close 생명주기 모델을 따릅니다:

1. **Init** - 호출 컨텍스트, 메서드 및 입력 인자를 캡처합니다
2. **Step** - 첫 step에서 모듈을 instantiate하고 시작합니다. 이후 step은 dispatcher-bridge 작업을 진행하며, 동기 실행은 첫 step에서 완료될 수 있습니다
3. **Close** - 인스턴스 리소스가 해제됩니다

## Lua에서 스폰하기

WASM 프로세스를 스폰하고 완료를 모니터링합니다:

```lua
local errors = require("errors")

-- Spawn with monitoring
local pid, err = process.spawn_monitored(
    "myns:compute_worker",   -- entry ID
    "myns:processes",        -- process host
    6, 7                     -- arguments passed to the WASM function
)

if err then
    return nil, err
end

-- Wait for the process to complete
local events = process.events()
while true do
    local event, open = events:receive()
    if not open then return nil, errors.new("process event channel closed") end
    if event.kind == process.event.EXIT and event.from == pid then
        local result = event.result.value  -- return value from the WASM function
        return result, event.result.error
    end
end
```

## 비동기 실행

WASM 프로세스는 mailbox send/receive, polling, clocks, sockets, DNS, filesystem streams, outgoing HTTP를 포함해 런타임이 dispatcher를 통해 bridge하는 호스트 작업을 위해 yield할 수 있습니다. scheduler는 pending 작업이 완료될 때까지 프로세스를 suspend한 뒤 같은 guest instance를 resume합니다.

```yaml
  - name: http_worker
    kind: process.wasm
    fs: myns:wasm_binaries
    path: /http_worker.wasm
    hash: sha256:...
    method: run
    imports:
      - wasi:io
      - wasi:cli
      - wasi:http
    wasi:
      env:
        - id: myns:api_url
          name: API_URL
          required: true
```

yield/resume 메커니즘은 asyncified core module 또는 지원되는 pollable 인터페이스를 사용하는 component에 투명합니다.

## WASI 설정

프로세스는 함수와 동일한 WASI 설정을 지원합니다:

```yaml
  - name: file_processor
    kind: process.wasm
    fs: myns:wasm_binaries
    path: /processor.wasm
    hash: sha256:...
    method: process
    imports:
      - wasi:cli
      - wasi:io
      - wasi:clocks
      - wasi:filesystem
    wasi:
      args: ["--input", "/data/input.csv"]
      cwd: "/app"
      env:
        - id: myns:output_format
          name: OUTPUT_FORMAT
      mounts:
        - fs: myns:input_data
          guest: /data
          read_only: true
        - fs: myns:output_dir
          guest: /output
```

## 참고

- [개요](wasm/overview.md) - WebAssembly 런타임 개요
- [함수](wasm/functions.md) - WASM 함수 설정
- [호스트 함수](wasm/hosts.md) - 사용 가능한 호스트 인터페이스
- [프로세스 모델](concepts/process-model.md) - 프로세스 생명주기
- [슈퍼비전](guides/supervision.md) - 프로세스 슈퍼비전 트리
