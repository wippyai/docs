---
title: "명령 실행"
description: "<secondary-label ref='function'/ <secondary-label ref='process'/ <secondary-label ref='io'/ <secondary-label ref='permissions'/"
---

# 명령 실행
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>
<secondary-label ref="permissions"/>

I/O 스트림에 대한 완전한 제어와 함께 외부 명령과 셸 스크립트를 실행합니다.

실행기 설정은 [실행기](system/exec.md)를 참조하세요.

## 로딩

```lua
local exec = require("exec")
```

## 실행기 획득

ID로 프로세스 실행기 리소스를 가져옵니다:

```lua
local executor, err = exec.get("app:exec")
if err then
    return nil, err
end

-- 실행기 사용
local proc = executor:exec("ls -la")
-- ...

-- 완료 시 해제
executor:release()
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `id` | string | 리소스 ID |

**반환:** `Executor, error`

## 프로세스 생성

지정된 명령으로 새 프로세스를 생성합니다:

```lua
-- 단순 명령
local proc, err = executor:exec("echo 'Hello, World!'")

-- 작업 디렉토리 지정
local proc = executor:exec("npm install", {
    work_dir = "/app/project"
})

-- 환경 변수 지정
local proc = executor:exec("python script.py", {
    work_dir = "/scripts",
    env = {
        PYTHONPATH = "/app/lib",
        DEBUG = "true",
        API_KEY = api_key
    }
})

-- 셸 스크립트 실행
local proc = executor:exec("./deploy.sh production", {
    work_dir = "/app/scripts",
    env = {
        DEPLOY_ENV = "production"
    }
})
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `cmd` | string | 실행 파일과 리터럴 인자 |
| `options.work_dir` | string | 작업 디렉토리 |
| `options.env` | table | 환경 변수 |
| `options.pty` | table | 자식 프로세스에 의사 터미널 할당 |

**반환:** `Process, error`

프로세스는 생성되지만 시작되지는 않습니다.

### 명령 파싱

`cmd`는 셸과 유사한 인용 규칙으로 실행 파일과 리터럴 인자로 분리됩니다: 작은따옴표와 큰따옴표는 하나의 단어를 묶고, 백슬래시는 다음 문자를 이스케이프합니다. 셸이 없으므로 변수 확장, 글로빙, 파이프, 리다이렉션은 일어나지 않습니다. 닫히지 않은 인용부호는 `errors.INVALID`를 반환합니다.

```lua
-- 공백을 포함한 인자 하나가 그대로 전달됨
local proc = executor:exec("grep 'hello world' notes.txt")

-- $HOME은 확장되지 않고 $HOME 다섯 글자로 전달됨
local proc = executor:exec("echo $HOME")
```

셸 기능을 사용하려면 셸을 명시적으로 호출하세요:

```lua
local proc = executor:exec("/bin/sh -c 'ls *.log | wc -l'")
```

### PTY 옵션

PTY를 할당하면 자식 프로세스가 실제 터미널을 갖게 됩니다: 라인 편집, 작업 제어, 전체 화면 프로그램이 셸에서와 동일하게 동작합니다.

```lua
local proc = executor:exec("/bin/bash --noprofile --norc", {
    pty = {width = 100, height = 30, term = "xterm-256color"},
})
```

| 필드 | 타입 | 기본값 | 설명 |
|-------|------|---------|-------------|
| `width` | number | 80 | 초기 PTY 열 수, 1에서 65535 |
| `height` | number | 24 | 초기 PTY 행 수, 1에서 65535 |
| `term` | string | 없음 | 자식의 `TERM` 값 |

폭 곱하기 높이는 262,144셀을 초과할 수 없습니다. PTY 기반 프로세스는 자식의 출력을 단일 터미널 스트림으로 병합합니다; stdin/stdout 파이프 메서드 대신 [resize](#resize)와 [attach_terminal](#attach_terminal)로 제어하세요.

## start / wait

프로세스를 시작하고 완료를 기다립니다.

```lua
local proc = executor:exec("./build.sh")

local ok, err = proc:start()
if err then
    return nil, err
end

local exit_code, err = proc:wait()
if err then
    return nil, err
end

if exit_code ~= 0 then
    return nil, errors.new("INTERNAL", "Build failed with exit code: " .. exit_code)
end
```

## stdout_stream / stderr_stream

프로세스 출력을 읽기 위한 스트림을 가져옵니다.

```lua
local proc = executor:exec("./process-data.sh")

local stdout = proc:stdout_stream()
local stderr = proc:stderr_stream()

proc:start()

-- 모든 stdout 읽기
local output = {}
while true do
    local chunk = stdout:read(4096)
    if not chunk then break end
    table.insert(output, chunk)
end
local result = table.concat(output)

-- 에러 확인
local err_output = {}
while true do
    local chunk = stderr:read(4096)
    if not chunk then break end
    table.insert(err_output, chunk)
end

local exit_code = proc:wait()

stdout:close()
stderr:close()

if exit_code ~= 0 then
    return nil, errors.new("INTERNAL", table.concat(err_output))
end

return result
```

## write_stdin

프로세스 stdin에 데이터를 씁니다.

```lua
local proc = executor:exec("sort")
local stdout = proc:stdout_stream()

proc:start()

proc:write_stdin("banana\napple\ncherry\n")

local sorted = stdout:read()

proc:wait()
stdout:close()
```

각 호출은 주어진 바이트를 쓰고 반환합니다. stdin은 프로세스 수명 동안 열려 있으며, 입력 끝까지 읽는 명령은 프로세스에 시그널이 전달되거나 프로세스가 닫힐 때 종료됩니다.

## signal / close

시그널을 보내거나 프로세스를 해제합니다.

```lua
local proc = executor:exec("./long-running-server.sh")
proc:start()

-- ... 나중에 중지해야 할 때 ...

-- SIGTERM을 보내고 핸들을 해제
proc:close()

-- SIGKILL을 보내고 핸들을 해제
proc:close(true)

-- 또는 특정 시그널을 보내고 핸들을 유지
local SIGINT = 2
proc:signal(SIGINT)
```

`close(force?)`는 시작된 자식에 `SIGTERM`을, `force`가 true이면 `SIGKILL`을 보낸 뒤 백그라운드에서 회수하므로 호출이 블로킹되지 않습니다. 유예 기간 후에도 실행 중인 자식은 강제 종료되어 회수가 항상 완료됩니다. 시작되지 않은 핸들은 단순히 무효화되며, 두 번 닫아도 에러가 아닙니다.

회수는 자식의 stdout과 stderr 파이프를 닫으므로, `close()`를 호출하기 전에 필요한 출력을 모두 읽으세요. 그 이후에는 `wait()`을 포함한 프로세스의 모든 메서드가 `process closed`를 보고합니다 — 종료 코드가 중요하다면 대신 `signal()`과 `wait()`을 사용하세요.

## resize

PTY 기반 프로세스의 PTY 크기를 조정합니다. 파이프 기반 프로세스는 에러를 반환합니다.

```lua
local ok, err = proc:resize(120, 40)
```

| 파라미터 | 타입 | 설명 |
|-----------|------|-------------|
| `width` | number | 열 수, 1에서 65535 |
| `height` | number | 행 수, 1에서 65535 |

**반환:** `boolean, error`

프로세스를 터미널 세션에 넘기기 전에 초기 지오메트리를 설정할 때 사용합니다. 세션이 프로세스를 소유한 뒤에는 대신 `resize` 이벤트를 보내세요.

## attach_terminal

시작되지 않은 PTY 기반 프로세스를 호출 프로세스의 터미널에 연결하고 `TerminalSession`을 반환합니다.

```lua
local exec = require("exec")
local tty = require("tty")

local executor = assert(exec.get("app:exec"))
local proc = assert(executor:exec("/bin/bash --noprofile --norc", {
    pty = {term = "xterm-256color"},
}))
local session = assert(proc:attach_terminal())
```

**반환:** `TerminalSession, error`

이 호출은 프로세스를 소비합니다: 세션이 프로세스의 유일한 수명 주기 소유자가 되고 원래 핸들은 더 이상 사용할 수 없습니다. 세션은 현재 터미널 포트에 서피스를 열고 PTY 에뮬레이션, 입력 인코딩, 크기 조정, 정상 및 강제 종료, 회수를 소유합니다. 터미널 포트가 필요하며 — [터미널 호스트](system/terminal.md) 프로세스, 또는 [뷰포트 grant](lua/system/tty.md#viewport)로 스폰된 프로세스 — 포트에 입력 컨트롤러가 없거나 이미 열린 서피스가 있으면 실패합니다.

### TerminalSession

| 메서드 | 반환 | 설명 |
|--------|---------|-------------|
| `send(event)` | `boolean, error` | 정규 TTY 이벤트 하나를 자식에 전달 |
| `done()` | channel | 자식이 종료되면 한 번 발화하는 채널 |
| `status()` | `string, error` | `"running"` 또는 `"done"`, 실패 시 실패 에러 포함 |
| `close()` | `boolean, error` | 실행 중인 자식의 종료 요청 |

`send`는 [TTY](lua/system/tty.md#event-types)에 설명된 key, mouse, resize, focus, paste 레코드를 받습니다. 자식이 종료된 뒤 전송하면 에러를 반환합니다.

```lua
local channel = require("channel")

local events = assert(tty.events())
assert(tty.start())
local done = session:done()

while true do
    local selected = channel.select({
        events:case_receive(),
        done:case_receive(),
    })
    if not selected.ok or selected.channel == done then break end
    if selected.value.type == "close" then break end
    assert(session:send(selected.value))
end

assert(session:close())
```

## 권한

실행 작업은 보안 정책 평가 대상입니다.

| 액션 | 리소스 | 설명 |
|------|--------|------|
| `exec.get` | 실행기 ID | 실행기 리소스 획득 |
| `exec.run` | 명령 | 특정 명령 실행 |

`exec.run`은 원본 명령 문자열에 대해 평가되며, 요청된 옵션이 메타데이터로 전달됩니다:

| 키 | 타입 | 설명 |
|-----|------|-------------|
| `work_dir` | string | 요청된 작업 디렉토리, 설정되지 않으면 빈 문자열 |
| `env_names` | string[] | 전달된 환경 변수의 이름, 정렬됨; 값은 노출되지 않음 |
| `pty.requested` | boolean | PTY 요청 여부 |
| `pty.width` | number | 해석된 PTY 열 수, 요청된 경우 존재 |
| `pty.height` | number | 해석된 PTY 행 수, 요청된 경우 존재 |
| `pty.term` | string | 요청된 `TERM` 값, 요청된 경우 존재 |

따라서 정책은 일반 명령은 허용하면서 터미널이나 특정 작업 디렉토리를 요구하는 명령은 제한할 수 있습니다.

## 에러

| 조건 | 종류 | 재시도 가능 |
|------|------|-------------|
| 잘못된 ID | `errors.INVALID` | 아니오 |
| 권한 거부됨 | `errors.INVALID` | 아니오 |
| 프로세스 닫힘 | `errors.INVALID` | 아니오 |
| 프로세스 시작되지 않음 | `errors.INVALID` | 아니오 |
| 이미 시작됨 | `errors.INVALID` | 아니오 |
| 명령의 닫히지 않은 인용부호 | `errors.INVALID` | 아니오 |
| 프로세스에 PTY 없음 | `errors.INVALID` | 아니오 |
| 터미널 포트 사용 불가 | `errors.UNAVAILABLE` | 아니오 |

에러 처리는 [에러 처리](lua/core/errors.md)를 참조하세요.

## 참고

- [Executor](system/exec.md) — 실행기 설정
- [TTY](lua/system/tty.md) — 터미널 이벤트, 서피스, 뷰포트
- [터미널 UI](tutorials/tty.md) — 뷰포트에서 PTY 자식을 호스팅하는 셸
