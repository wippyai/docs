# WASM 프로세스

WASM 모듈은 `process.wasm` 엔트리 종류를 통해 프로세스로 실행될 수 있습니다. 프로세스는 Wippy 프로세스 호스트 내에서 실행되며 전체 프로세스 생명주기를 지원합니다: 스폰, 모니터링, 감독된 종료.

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

| Field | Required | Description |
|-------|----------|-------------|
| `fs` | Yes | 바이너리가 포함된 파일시스템 엔트리 ID |
| `path` | Yes | 파일시스템 내 `.wasm` 파일 경로 |
| `hash` | Yes | 무결성 검증을 위한 SHA-256 해시 |
| `method` | Yes | 실행할 내보내기된 함수 이름 |
| `imports` | No | 활성화할 호스트 임포트 |
| `wasi` | No | WASI 설정 (args, env, mounts) |
| `limits` | No | 실행 제한 |

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

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | `wippy run <name>`에서 사용하는 명령 이름 |
| `short` | No | `wippy run list`에 표시되는 간단한 설명 |

CLI 명령이 동작하려면 `terminal.host`와 `process.host`가 있어야 합니다.

## 프로세스 생명주기

WASM 프로세스는 Init/Step/Close 생명주기 모델을 따릅니다:

1. **Init** - 모듈이 인스턴스화되고 입력 인자가 캡처됩니다
2. **Step** - 실행이 진행됩니다. 비동기 모듈의 경우 스케줄러가 양보/재개 사이클을 구동합니다. 동기 모듈의 경우 단일 스텝에서 실행이 완료됩니다.
3. **Close** - 인스턴스 리소스가 해제됩니다

## Lua에서 스폰하기

WASM 프로세스를 스폰하고 완료를 모니터링합니다:

```lua
local process = require("process")
local time = require("time")

-- Spawn with monitoring
local pid, err = process.spawn_monitored(
    "myns:compute_worker",   -- entry ID
    "myns:processes",        -- process group
    6, 7                     -- arguments passed to the WASM function
)

if err then
    error("spawn failed: " .. tostring(err))
end

-- Wait for the process to complete
local event = process.receive(time.seconds(10))
if event and event.type == "EXIT" then
    local result = event.value  -- return value from the WASM function
end
```

## 비동기 실행

WASI 인터페이스를 임포트하는 WASM 프로세스는 비동기 연산을 수행할 수 있습니다. 스케줄러는 I/O 중에 프로세스를 일시 중단하고 연산이 완료되면 재개합니다:

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
      - funcs
    wasi:
      env:
        - id: myns:api_url
          name: API_URL
          required: true
```

양보/재개 메커니즘은 WASM 코드에 투명합니다. 게스트의 표준 블로킹 호출 (sleep, read, write, HTTP 요청)은 디스패처에 자동으로 양보합니다.

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
