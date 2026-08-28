---
title: "터미널"
description: "터미널 호스트는 stdin/stdout/stderr 접근이 있는 Lua 스크립트를 실행합니다."
---

# 터미널

`terminal.host`는 표준 입력, 출력 및 오류 stream에 접근할 수 있는 Lua script를 실행합니다. 이 페이지는 설정 레퍼런스이며 Lua 블록은 해당 host에서 실행된다고 가정하는 handler fragment입니다.

<note>
터미널 호스트는 한 번에 정확히 하나의 프로세스만 실행합니다. 프로세스 자체는 터미널 I/O 컨텍스트에 접근할 수 있는 일반 Lua 프로세스입니다.
</note>

## 엔트리 종류

| 종류 | 설명 |
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
| `hide_logs` | bool | false | downstream log propagation을 억제하면서 event bus로 log stream |

## 터미널 컨텍스트

터미널 호스트에서 실행되는 스크립트는 다음을 포함한 터미널 컨텍스트를 받습니다:

- **stdin** - 표준 입력 리더
- **stdout** - 표준 출력 라이터
- **stderr** - 표준 에러 라이터
- **args** - 커맨드라인 인자

## Lua API

[IO 모듈](../lua/system/io.md)은 터미널 작업을 제공합니다.

```lua
local io = require("io")

local _, write_err = io.write("Enter name: ")
if write_err then return nil, write_err end

local name, read_err = io.readline()
if read_err then return nil, read_err end

local _, print_err = io.print("Hello, " .. name)
if print_err then return nil, print_err end

local args = io.args()
```

`io.write`, `io.print`, `io.readline`은 terminal context 밖에서 오류를 반환합니다. terminal context가 없으면 `io.args()`는 빈 table을 반환합니다.

## 참고

- [Terminal I/O](../lua/system/io.md) — stdin/stdout/stderr 작업
- [TTY](../lua/system/tty.md) — raw 입력 이벤트, style 및 layout
