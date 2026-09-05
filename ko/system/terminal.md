---
title: "터미널"
description: "터미널 호스트는 stdin/stdout/stderr 접근이 있는 Lua 스크립트를 실행합니다."
---

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

## 조합 가능한 터미널

프로세스가 보는 터미널은 장치가 아니라 포트입니다. 덕분에 터미널 소유권을 조합할 수 있습니다.

터미널 호스트의 프로세스는 물리 포트를 보유합니다. `tty.surface()`를 호출해 포트의 표시 리스를 가져오고 완성된 프레임을 발행합니다 — 화면 전체를 소유합니다.

셸 프로세스는 `tty.viewport()`로 가상 터미널을 만들어 다른 프로세스를 호스팅합니다. `terminal` 스폰 옵션을 통해 `viewport:grant()`를 자식에게 전달하면; 자식은 그 grant를 일반 터미널 포트로 해석하고, 장치에 연결되어 있지 않다는 사실을 모른 채 변경 없이 실행됩니다. 셸은 `viewport:snapshot()`으로 자식의 프레임을 읽어 자신의 레이아웃 어디에든 배치하고, `viewport:send()`로 입력을 자식의 좌표로 변환합니다.

```lua
local view = assert(tty.viewport({width = 78, height = 20}))
local child = assert(process.with_options({terminal = assert(view:grant())})
    :spawn_monitored("app:child", "app:workers"))
```

grant는 일회성입니다: 프로세스 승인이 이를 소비하고, 시작이 거부되면 해석되지 않은 채 남으며, 터미널을 연결할 수 없는 호스트는 옵션을 무시하는 대신 스폰을 거부합니다.

바이트 지향 프로그램은 `exec`를 통해 동일한 모델에 합류합니다. 자식이 PTY 프로세스를 할당하고 `process:attach_terminal()`을 호출하면; 그 어댑터가 PTY 에뮬레이션, 입력 인코딩, 크기 조정, 종료를 소유하고 자식이 보유한 포트가 물리든 가상이든 그 포트에 표시합니다.

```text
physical terminal -> shell surface -> viewport -> child process -> PTY proxy
```

## Lua API

[IO 모듈](lua/system/io.md)은 라인 지향 터미널 작업을 제공합니다:

```lua
local io = require("io")

io.write("Enter name: ")
local name = io.readline()
io.print("Hello, " .. name)

local args = io.args()
```

터미널 컨텍스트 외부에서 호출하면 함수가 에러를 반환합니다.

원시 입력 이벤트, 스타일이 적용된 렌더링, 서피스, 뷰포트는 [TTY](lua/system/tty.md)를 참조하세요. PTY 프로세스와 터미널 세션은 [명령 실행](lua/dynamic/exec.md)을 참조하세요.

## 참고

- [Terminal I/O](lua/system/io.md) — stdin/stdout/stderr 작업
- [TTY](lua/system/tty.md) — 입력 이벤트, 서피스, 캔버스, 뷰포트
- [명령 실행](lua/dynamic/exec.md) — PTY 프로세스와 터미널 세션
- [터미널 UI](tutorials/tty.md) — 뷰포트에서 자식을 호스팅하는 셸 만들기
