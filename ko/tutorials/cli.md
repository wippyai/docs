# CLI 애플리케이션

입력을 읽고, 출력을 쓰고, 사용자와 상호작용하는 커맨드라인 도구를 빌드합니다.

## 만들 것

사용자에게 인사하는 간단한 CLI:

```
$ wippy run -x app:cli
Hello from CLI!
```

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

`src/_index.yaml` 생성:

```yaml
version: "1.0"
namespace: app

entries:
  # 터미널 호스트가 프로세스를 stdin/stdout에 연결
  - name: terminal
    kind: terminal.host
    lifecycle:
      auto_start: true

  # CLI 프로세스
  - name: cli
    kind: process.lua
    source: file://cli.lua
    method: main
    modules:
      - io
```

<tip>
<code>terminal.host</code>가 Lua 프로세스를 터미널에 연결합니다. 없으면 <code>io.print()</code>가 쓸 곳이 없습니다.
</tip>

## 3단계: CLI 코드

`src/cli.lua` 생성:

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

출력:
```
Hello from CLI!
```

<note>
<code>-x</code> 플래그는 <code>terminal.host</code>를 자동 감지하고 깨끗한 출력을 위해 사일런트 모드로 실행합니다.
</note>

## 사용자 입력 읽기

```lua
local io = require("io")

local function main()
    io.write("Enter your name: ")
    local name = io.readline()

    if name and #name > 0 then
        io.print("Hello, " .. name .. "!")
    else
        io.print("Hello, stranger!")
    end

    return 0
end

return { main = main }
```

## 컬러 출력

ANSI 이스케이프 코드로 색상 사용:

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
    io.write(yellow("Enter a number: "))

    local input = io.readline()
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

`system` 모듈로 런타임 통계에 접근:

```yaml
# 엔트리 정의에 추가
modules:
  - io
  - system
```

```lua
local io = require("io")
local system = require("system")

local function main()
    io.print("Host: " .. system.process.hostname())
    io.print("CPUs: " .. system.runtime.cpu_count())
    io.print("Goroutines: " .. system.runtime.goroutines())

    local mem = system.memory.stats()
    io.print("Memory: " .. string.format("%.1f MB", mem.heap_alloc / 1024 / 1024))

    return 0
end

return { main = main }
```

## 종료 코드

`main()`에서 반환하여 종료 코드 설정:

```lua
local function main()
    if error_occurred then
        return 1  -- 에러
    end
    return 0      -- 성공
end
```

## I/O 참조

| 함수 | 설명 |
|----------|-------------|
| `io.print(...)` | 개행과 함께 stdout에 쓰기 |
| `io.write(...)` | 개행 없이 stdout에 쓰기 |
| `io.eprint(...)` | 개행과 함께 stderr에 쓰기 |
| `io.readline()` | stdin에서 줄 읽기 |
| `io.flush()` | 출력 버퍼 플러시 |

## CLI 플래그

| 플래그 | 설명 |
|------|-------------|
| `wippy run -x app:cli` | CLI 프로세스 실행 (terminal.host 자동 감지) |
| `wippy run -x app:cli --host app:term` | 명시적 터미널 호스트 |
| `wippy run -x app:cli -v` | 상세 로깅 포함 |

## 다음 단계

- [I/O 모듈](lua/system/io.md) - 전체 I/O 참조
- [시스템 모듈](lua/system/system.md) - 런타임 및 시스템 정보
- [에코 서비스](echo-service.md) - 다중 프로세스 애플리케이션
