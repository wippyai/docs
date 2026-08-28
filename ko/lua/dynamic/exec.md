---
title: "명령 실행"
description: "외부 프로세스를 시작하고 스트림 데이터를 교환하며 완료를 기다리고 시그널을 보냅니다."
---

# 명령 실행
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>
<secondary-label ref="permissions"/>

`exec` 모듈은 외부 실행 파일을 시작하고 입력, 출력, 라이프사이클 및 시그널에 접근할 수 있게 합니다. 이 페이지는 부분 레시피를 포함한 API 참조이며, 실행기 ID, 명령, 경로, 환경 값 및 보안 정책은 주변 애플리케이션에서 제공합니다.

실행기는 명령 문자열을 실행 파일과 인수로 파싱하며 셸을 호출하지 않습니다. 파이프, 리디렉션, 변수 확장, 명령 치환 같은 셸 연산자는 해석되지 않습니다. 선택한 백엔드와 운영 체제가 지원할 때만 실행 가능한 스크립트를 직접 시작할 수 있습니다.

예제를 사용하기 전에 [실행기](system/exec.md)의 설명대로 실행기 리소스와 명령 allowlist를 구성하고, 사용하는 정확한 리소스에 `exec.get`과 `exec.run`을 허가하세요. 예제는 Unix 명령과 경로를 사용하므로 실행기 호스트에서 사용할 수 있는 명령으로 바꾸세요.

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
```

프로세스를 만들고 실행하는 동안 실행기를 획득한 상태로 유지하세요. 마지막 프로세스를 만든 뒤 모든 반환 경로에서 `executor:release()`를 호출하세요. release는 멱등입니다.

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `id` | string | 리소스 ID |

**반환:** `Executor, error`

## 프로세스 생성

지정된 명령으로 새 프로세스를 생성합니다:

```lua
local proc, err = executor:exec("python script.py", {
    work_dir = "/scripts",
    env = {
        PYTHONPATH = "/app/lib",
        DEBUG = "true",
        API_KEY = api_key
    }
})
if err then
    executor:release() -- release is specified to return true, nil
    return nil, err
end
```

따옴표로 묶은 인수는 네이티브 실행기의 파서가 그룹화합니다. 셸 평가 없이 실행 파일로 직접 전달됩니다. 네이티브 실행기에서 `command_whitelist` 엔트리와 `exec.run` 정책 리소스는 실행 파일 이름만이 아니라 완전한 명령 문자열과 일치합니다.

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `cmd` | string | 실행할 명령 |
| `options.work_dir` | string | 작업 디렉토리 |
| `options.env` | table | 환경 변수 |

**반환:** `Process, error`

## `start` / `wait`

프로세스를 시작하고 완료를 기다립니다.

```lua
local executor, get_err = exec.get("app:exec")
if get_err then
    return nil, get_err
end

local proc, create_err = executor:exec("./build.sh")
if create_err then
    executor:release()
    return nil, create_err
end

local ok, start_err = proc:start()
if start_err then
    proc:close(true)
    executor:release()
    return nil, start_err
end

local exit_code, wait_err = proc:wait()
local _, release_err = executor:release()
if wait_err then
    return nil, wait_err
end
if release_err then
    return nil, release_err
end

if exit_code ~= 0 then
    return nil, errors.new({
        message = "Build failed with exit code: " .. exit_code,
        kind = errors.INTERNAL
    })
end
```

`wait()`는 자식이 종료될 때까지 yield하고 종료 코드를 반환하며 프로세스를 회수하고 핸들을 닫습니다. `wait()` 후 다른 프로세스 메서드는 프로세스가 닫혔으므로 `errors.INVALID`를 보고합니다.

## `stdout_stream` / `stderr_stream`

`start()` 후 프로세스 출력을 읽는 스트림을 엽니다. Docker 기반 프로세스 스트림은 컨테이너가 시작되기 전에는 사용할 수 없습니다. stdout과 stderr 모두 데이터가 있을 수 있다면 동시에 비우세요. stderr 파이프를 읽지 않은 채 stdout을 모두 읽으면 자식이 stderr 파이프를 채울 때 교착 상태가 발생할 수 있습니다.

```lua
local function fail(err)
    proc:close(true)   -- close is specified to return true, nil
    executor:release()
    return nil, err
end

local function drain(stream, done)
    coroutine.spawn(function()
        local chunks = {}
        while true do
            local chunk, read_err = stream:read(4096)
            if read_err then
                done:send({err = read_err})
                return
            end
            if not chunk then
                done:send({data = table.concat(chunks)})
                return
            end
            table.insert(chunks, chunk)
        end
    end)
end

local _, start_err = proc:start()
if start_err then return fail(start_err) end

local stdout, stdout_err = proc:stdout_stream()
if stdout_err then return fail(stdout_err) end
local stderr, stderr_err = proc:stderr_stream()
if stderr_err then return fail(stderr_err) end

local stdout_done = channel.new(1)
local stderr_done = channel.new(1)
drain(stdout, stdout_done)
drain(stderr, stderr_done)

local stdout_result
local stderr_result
while not stdout_result or not stderr_result do
    local cases = {}
    if not stdout_result then table.insert(cases, stdout_done:case_receive()) end
    if not stderr_result then table.insert(cases, stderr_done:case_receive()) end

    local selected = channel.select(cases)
    if not selected.ok then
        return fail(errors.new("output drain channel closed"))
    end
    if selected.value.err then return fail(selected.value.err) end

    if selected.channel == stdout_done then
        stdout_result = selected.value
    else
        stderr_result = selected.value
    end
end

local _, stdout_close_err = stdout:close()
if stdout_close_err then return fail(stdout_close_err) end
local _, stderr_close_err = stderr:close()
if stderr_close_err then return fail(stderr_close_err) end

local exit_code, wait_err = proc:wait()
if wait_err then return fail(wait_err) end

local _, release_err = executor:release()
if release_err then return nil, release_err end

return {
    exit_code = exit_code,
    stdout = stdout_result.data,
    stderr = stderr_result.data
}
```

이 부분 레시피는 활성 `executor`에서 `proc`를 만들었다고 가정합니다. `channel`과 `coroutine` 전역은 같은 Lua 프로세스에서 두 reader를 조율합니다.

## `write_stdin`

프로세스 stdin에 데이터를 씁니다. `write_stdin`은 stdin을 닫지 않으므로 완료가 입력 스트림에 의존한다면 제한된 입력 계약을 가진 명령을 사용하세요.

```lua
-- This command exits after reading three lines; it does not require an EOF signal
local proc, create_err = executor:exec("head -n 3")
if create_err then
    executor:release()
    return nil, create_err
end

local function fail(err)
    proc:close(true)
    executor:release()
    return nil, err
end

local _, start_err = proc:start()
if start_err then
    return fail(start_err)
end

local stdout, stream_err = proc:stdout_stream()
if stream_err then
    return fail(stream_err)
end

for _, line in ipairs({"banana\n", "apple\n", "cherry\n"}) do
    local _, write_err = proc:write_stdin(line)
    if write_err then
        return fail(write_err)
    end
end

-- Read until the bounded command exits and closes stdout
local chunks = {}
while true do
    local chunk, read_err = stdout:read(4096)
    if read_err then
        return fail(read_err)
    end
    if not chunk then break end
    table.insert(chunks, chunk)
end
print(table.concat(chunks))  -- "banana\napple\ncherry\n"

local _, close_err = stdout:close()
if close_err then
    return fail(close_err)
end

local exit_code, wait_err = proc:wait()
if wait_err then return fail(wait_err) end
local _, release_err = executor:release()
if release_err then return nil, release_err end
if exit_code ~= 0 then
    return nil, errors.new("head exited with code " .. exit_code)
end
```

이 부분 레시피는 블록이 시작될 때 `executor`가 활성 상태라고 가정합니다.

## `signal` / `close`

시작된 프로세스에 대해 하나의 종료 경로를 선택합니다.

```lua
-- Stop and discard the handle. close() sends SIGTERM, reaps in the
-- background, and returns true even if signaling fails.
local _, close_err = proc:close()
if close_err then return nil, close_err end

-- For immediate forced shutdown, use this instead:
-- local _, close_err = proc:close(true) -- SIGKILL

-- When the exit code matters, signal and then wait instead of closing:
-- local _, signal_err = proc:signal(2) -- SIGINT on Unix
-- if signal_err then return nil, signal_err end
-- local exit_code, wait_err = proc:wait()
```

`close()`는 멱등입니다. `close()` 또는 `wait()`가 핸들을 닫은 뒤 `signal()`, `start()`, `wait()` 및 스트림 접근은 `errors.INVALID`를 반환합니다. 시그널 번호와 동작은 실행기 백엔드 및 운영 체제에 따라 달라집니다.

## 권한

실행 작업은 보안 정책 평가 대상입니다.

| 액션 | 리소스 | 설명 |
|------|--------|------|
| `exec.get` | 실행기 ID | 실행기 리소스 획득 |
| `exec.run` | 명령 | 특정 명령 실행 |

## 에러

| 조건 | 종류 | 재시도 가능 |
|------|------|-------------|
| 잘못된 ID | `errors.INVALID` | 아니오 |
| 권한 거부됨 | `errors.INVALID` | 아니오 |
| 프로세스 닫힘 | `errors.INVALID` | 아니오 |
| 프로세스 시작되지 않음 | `errors.INVALID` | 아니오 |
| 이미 시작됨 | `errors.INVALID` | 아니오 |
| 실행기 획득 또는 프로세스 생성 실패 | `errors.INTERNAL` | 아니오 |
| 시작, 대기, 시그널, stdin 또는 스트림 작업 실패 | `errors.INTERNAL` | 아니오 |

런타임 v0.3.32a에서 `exec.get`과 `exec.run` 정책 거부는 `errors.PERMISSION_DENIED`가 아니라 `errors.INVALID`를 사용합니다.

에러 처리는 [에러 처리](lua/core/errors.md)를 참조하세요.
