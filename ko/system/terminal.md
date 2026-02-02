# 터미널

터미널 호스트는 stdin/stdout/stderr 접근이 있는 Lua 스크립트를 실행합니다.

<note>
터미널 호스트는 한 번에 정확히 하나의 프로세스만 실행합니다. 프로세스 자체는 터미널 I/O 컨텍스트에 접근할 수 있는 일반 Lua 프로세스입니다.
</note>

## 엔트리 종류

| Kind | 설명 |
|------|-------------|
| `terminal.host` | 터미널 세션 호스트 |

## 설정

```yaml
- name: cli_host
  kind: terminal.host
  hide_logs: false
  lifecycle:
    auto_start: true
```

| 필드 | 타입 | 기본값 | 설명 |
|-------|------|---------|-------------|
| `hide_logs` | bool | false | 이벤트 버스로의 로그 출력 억제 |

## 터미널 컨텍스트

터미널 호스트에서 실행되는 스크립트는 다음을 포함한 터미널 컨텍스트를 받습니다:

- **stdin** - 표준 입력 리더
- **stdout** - 표준 출력 라이터
- **stderr** - 표준 에러 라이터
- **args** - 커맨드라인 인자

## Lua API

[IO 모듈](lua/system/io.md)은 터미널 작업을 제공합니다:

```lua
local io = require("io")

io.write("Enter name: ")
local name = io.readline()
io.print("Hello, " .. name)

local args = io.args()
```

터미널 컨텍스트 외부에서 호출하면 함수가 에러를 반환합니다.
