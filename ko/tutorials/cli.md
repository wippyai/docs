---
title: "CLI 애플리케이션"
description: "입력을 읽고 출력을 쓰며 사용자와 상호작용하는 명령줄 도구를 만듭니다."
---

# CLI 애플리케이션

터미널에 인사말을 출력하는 명령줄 프로세스를 만든 뒤 입력, 색상, 시스템 정보, 이름 있는 명령을 추가합니다.

**분류:** 실행 가능한 튜토리얼. 인사말 애플리케이션은 완전한 예제입니다. 이후 섹션은 각 섹션의 설명에 따라 `src/cli.lua` 또는 `app:cli` 엔트리를 선택적으로 대체합니다.

## 만들 애플리케이션

인사말을 출력하는 CLI 프로세스를 만듭니다.

```
$ wippy run -x app:cli
Hello from CLI!
```

## 사전 요구 사항

- `wippy` 명령으로 사용할 수 있는 Wippy 런타임 `v0.3.32a`. `wippy version --short`로 확인하세요.
- 대화형 터미널. 입력 예제에는 stdin이 필요하고, 색상 예제에는 ANSI 이스케이프 시퀀스를 표시하는 터미널이 필요합니다.

## 프로젝트 구조

```
cli-app/
├── wippy.lock
└── src/
    ├── _index.yaml
    └── cli.lua
```

## 1단계: 프로젝트 생성

```bash
mkdir cli-app && cd cli-app
mkdir src
```

## 2단계: 엔트리 정의

`src/_index.yaml`을 만듭니다.

```yaml
version: "1.0"
namespace: app

entries:
  # Terminal host connects processes to stdin/stdout
  - name: terminal
    kind: terminal.host
    lifecycle:
      auto_start: true

  # CLI process
  - name: cli
    kind: process.lua
    source: file://cli.lua
    method: main
    modules:
      - io
```

<tip>
<code>terminal.host</code>는 Lua 프로세스를 터미널에 연결합니다. 이것이 없으면 <code>io.print()</code>가 출력할 곳이 없습니다.
</tip>

## 3단계: CLI 코드

`src/cli.lua`를 만듭니다.

```lua
local io = require("io")

local function main()
    io.print("Hello from CLI!")
    return 0
end

return { main = main }
```

## 4단계: 실행

```bash
wippy init
wippy run -x app:cli
```

예상 출력:

```
Hello from CLI!
```

<note>
<code>-x</code> 플래그는 프로세스를 명령으로 실행합니다. 레지스트리에 <code>terminal.host</code>가 하나뿐이면 자동으로 감지하며, 터미널 호스트가 여러 개라면 <code>--host</code>를 사용합니다. 로깅 플래그를 지정하지 않으면 명령 모드가 런타임 로그를 숨겨 프로세스 출력을 읽기 쉽게 유지합니다.
</note>

## 사용자 입력 읽기

`src/cli.lua`를 다음 버전으로 바꿉니다. 이 코드는 터미널 읽기 및 쓰기 오류를 빈 입력으로 취급하지 않고 보고합니다.

```lua
local io = require("io")

local function main()
    local _, write_err = io.write("Enter your name: ")
    if write_err then
        io.eprint("Cannot write prompt:", write_err)
        return 1
    end

    local _, flush_err = io.flush()
    if flush_err then
        io.eprint("Cannot flush prompt:", flush_err)
        return 1
    end

    local name, read_err = io.readline()
    if read_err then
        io.eprint("Cannot read input:", read_err)
        return 1
    end

    if name and #name > 0 then
        io.print("Hello, " .. name .. "!")
    else
        io.print("Hello, stranger!")
    end

    return 0
end

return { main = main }
```

## 색상 출력

ANSI 이스케이프 코드로 색상을 사용하려면 `src/cli.lua`를 다음 버전으로 바꿉니다.

```lua
local io = require("io")

local reset = "\027[0m"
local function red(s) return "\027[31m" .. s .. reset end
local function green(s) return "\027[32m" .. s .. reset end
local function yellow(s) return "\027[33m" .. s .. reset end
local function cyan(s) return "\027[36m" .. s .. reset end
local function bold(s) return "\027[1m" .. s .. reset end

local function main()
    io.print(bold(cyan("Welcome!")))
    local _, write_err = io.write(yellow("Enter a number: "))
    if write_err then
        io.eprint("Cannot write prompt:", write_err)
        return 1
    end

    local _, flush_err = io.flush()
    if flush_err then
        io.eprint("Cannot flush prompt:", flush_err)
        return 1
    end

    local input, read_err = io.readline()
    if read_err then
        io.eprint("Cannot read input:", read_err)
        return 1
    end
    local n = tonumber(input)

    if n then
        io.print("Squared: " .. green(tostring(n * n)))
        return 0
    else
        io.print(red("Error: ") .. "not a number")
        return 1
    end
end

return { main = main }
```

## 시스템 정보

시스템 읽기는 보호되는 연산입니다. 다음 정책을 추가하고 `app:cli` 엔트리를 교체하여 명령에 액터, 정책, `system` 모듈을 부여합니다.

```yaml
  - name: cli-system-read
    kind: security.policy
    policy:
      actions:
        - system.read
      resources: "*"
      effect: allow

  - name: cli
    kind: process.lua
    source: file://cli.lua
    method: main
    modules:
      - io
      - system
    security:
      actor:
        id: app:cli
      policies:
        - app:cli-system-read
```

그런 다음 `src/cli.lua`를 교체합니다.

```lua
local io = require("io")
local system = require("system")

local function main()
    local hostname, hostname_err = system.process.hostname()
    if hostname_err then
        io.eprint("Cannot read hostname:", hostname_err)
        return 1
    end

    local cpu_count, cpu_err = system.runtime.cpu_count()
    if cpu_err then
        io.eprint("Cannot read CPU count:", cpu_err)
        return 1
    end

    local goroutines, goroutine_err = system.runtime.goroutines()
    if goroutine_err then
        io.eprint("Cannot read goroutine count:", goroutine_err)
        return 1
    end

    local mem, memory_err = system.memory.stats()
    if memory_err then
        io.eprint("Cannot read memory stats:", memory_err)
        return 1
    end

    io.print("Host: " .. hostname)
    io.print("CPUs: " .. cpu_count)
    io.print("Goroutines: " .. goroutines)
    io.print("Memory: " .. string.format("%.1f MB", mem.heap_alloc / 1024 / 1024))

    return 0
end

return { main = main }
```

## 이름 있는 명령

`-x app:cli` 대신 이름으로 프로세스를 호출하려면 명령 메타데이터를 추가합니다.

`app:cli` 엔트리를 다음 버전으로 바꿉니다. 기본 프로젝트의 `terminal.host` 엔트리는 유지하세요.

```yaml
  - name: cli
    kind: process.lua
    meta:
      command:
        name: greet
        short: Greet the user
    source: file://cli.lua
    method: main
    modules:
      - io
```

이름 있는 명령을 실행합니다.

```bash
wippy run greet
```

사용 가능한 모든 명령을 나열합니다.

```bash
wippy run list
```

```
Available commands:

  greet  Greet the user  (app:cli)

Run with: wippy run <command>
```

## 종료 코드

`main()`에서 숫자를 반환하여 프로세스 종료 코드를 설정합니다.

```lua
local function main()
    if error_occurred then
        return 1  -- Error
    end
    return 0      -- Success
end
```

## I/O 참조

| 함수 | 반환값 | 설명 |
|----------|---------|-------------|
| `io.print(...)` | 터미널 컨텍스트가 있으면 `boolean`, 없으면 `nil, error` | 탭으로 구분하고 끝에 줄바꿈을 붙여 stdout에 씁니다. |
| `io.write(...)` | `boolean, error` | 구분자나 줄바꿈 없이 stdout에 씁니다. |
| `io.eprint(...)` | 터미널 컨텍스트가 있으면 `boolean`, 없으면 `nil, error` | 탭으로 구분하고 끝에 줄바꿈을 붙여 stderr에 씁니다. |
| `io.readline()` | `string, error` | 끝의 줄바꿈을 제외하고 한 줄을 읽습니다. 데이터 없는 EOF는 오류입니다. |
| `io.flush()` | `boolean, error` | 스트림이 지원하면 stdout을 플러시합니다. |

## CLI 플래그

| 플래그 | 설명 |
|------|-------------|
| `wippy run -x app:cli` | CLI 프로세스를 실행합니다(`terminal.host` 자동 감지). |
| `wippy run -x app:cli --host app:terminal` | 터미널 호스트를 명시합니다. |
| `wippy run -x app:cli -v` | 상세 로깅과 함께 실행합니다. |

## 문제 해결과 정리

- `no terminal host found`는 레지스트리에 `terminal.host`가 없다는 뜻입니다. 2단계의 엔트리를 사용하세요. 호스트가 여러 개면 `--host app:terminal`을 전달합니다.
- `no terminal context`는 프로세스가 터미널 호스트를 통해 시작되지 않았다는 뜻입니다. 백그라운드 `process.service`가 아니라 `wippy run -x app:cli`를 사용하세요.
- stdin이 닫혀 있으면 EOF 입력 오류가 발생하는 것이 정상입니다. 입력 예제는 대화형 터미널에서 실행하세요.
- ANSI 시퀀스가 문자 그대로 보이면 색상을 사용하지 않는 예제를 쓰거나 ANSI를 지원하는 터미널을 사용하세요.
- 명령은 `main()`이 반환된 뒤 종료됩니다. 디렉터리를 벗어난 후 `cli-app/`가 일회용 연습 프로젝트였다면 삭제하세요.

## 다음 단계

- [I/O 모듈](../lua/system/io.md) — I/O API 참조
- [시스템 모듈](../lua/system/system.md) — 런타임 및 시스템 정보
- [에코 서비스](echo-service.md) — 다중 프로세스 애플리케이션 만들기
