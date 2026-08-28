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
    method: compute
```

### 설정 필드

| 필드 | 필수 | 설명 |
|-------|----------|-------------|
| `fs` | Yes | 바이너리가 포함된 파일시스템 엔트리 ID |
| `path` | Yes | 파일시스템 내 `.wasm` 파일 경로 |
| `hash` | Yes | 무결성 검증을 위한 SHA-256 해시 |
| `method` | Yes | 실행할 내보내기된 함수 이름 |
| `transport` | No | 호출 전송: `payload` (기본값) 또는 `wasi-http` |
| `wit` | No | raw/core 모듈용 WIT 시그니처 |
| `imports` | No | 활성화할 호스트 임포트 |
| `wasi` | No | WASI 설정 (`args`, `cwd`, `env`, `mounts`) |
| `limits` | No | 실행 제한 |

<note>
`process.wasm`은 `function.wasm`과 설정 구조체를 공유하므로 `pool` 블록은 스키마에서 수용되지만 무시됩니다 — 프로세스는 함수 풀이 아닌 프로세스 호스트 아래에서 실행됩니다.
</note>

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
| `name` | Yes | `wippy run <name>`에서 사용하는 명령 이름 |
| `short` | No | `wippy run list`에 표시되는 간단한 설명 |
| `main` | No | pack 또는 hub 모듈의 기본 명령으로 엔트리 지정 |
| `use_case` | No | entrypoint category; 기본값 `run` |
| `security` | No | 신뢰된 terminal launcher가 이 명령을 시작할 때만 적용되는 보안 컨텍스트 |

CLI 명령에는 `terminal.host`가 있어야 합니다. terminal host가 명령 프로세스에 사용되는 scheduler를 소유하므로 별도 `process.host`는 필요하지 않습니다. terminal host가 여러 개이면 `--host`로 하나를 선택하십시오.

## 프로세스 생명주기

WASM 프로세스는 Init/Step/Close 생명주기 모델을 따릅니다:

1. **Init** - 호출 컨텍스트, 메서드 및 입력 인자를 캡처합니다
2. **Step** - 첫 step에서 모듈을 instantiate하고 시작합니다. 이후 step은 dispatcher-bridge 작업을 진행하며, 동기 실행은 첫 step에서 완료될 수 있습니다
3. **Close** - 인스턴스 리소스가 해제됩니다

## Lua에서 스폰하기

WASM 프로세스를 스폰하고 완료를 모니터링합니다:

```lua
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

WASM 프로세스는 지원되는 clock polling 및 outgoing HTTP를 포함해 런타임이 dispatcher를 통해 bridge하는 호스트 작업을 위해 yield할 수 있습니다. scheduler는 pending 작업이 완료될 때까지 프로세스를 suspend한 뒤 resume합니다.

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

해당 asyncified 작업에서 yield/resume 메커니즘은 guest에 투명합니다. 모든 blocking WASI 호출이 yield한다고 가정하지 마십시오. 고정된 런타임에서 stream read와 write는 동기식입니다.

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

- [개요](./overview.md) - WebAssembly 런타임 개요
- [함수](./functions.md) - WASM 함수 설정
- [호스트 함수](./hosts.md) - 사용 가능한 호스트 인터페이스
- [프로세스 모델](../concepts/process-model.md) - 프로세스 생명주기
- [슈퍼비전](../guides/supervision.md) - 프로세스 슈퍼비전 트리
