# 명령 실행
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>
<secondary-label ref="permissions"/>

I/O 스트림에 대한 완전한 제어와 함께 외부 명령과 셸 스크립트를 실행합니다.

실행기 설정은 [실행기](system-exec.md)를 참조하세요.

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
| `cmd` | string | 실행할 명령 |
| `options.work_dir` | string | 작업 디렉토리 |
| `options.env` | table | 환경 변수 |

**반환:** `Process, error`

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
-- 명령으로 데이터 파이프
local proc = executor:exec("sort")
local stdout = proc:stdout_stream()

proc:start()

-- 입력 쓰기
proc:write_stdin("banana\napple\ncherry\n")
proc:write_stdin("")  -- EOF 신호

-- 정렬된 출력 읽기
local sorted = stdout:read()
print(sorted)  -- "apple\nbanana\ncherry\n"

proc:wait()
stdout:close()
```

## signal / close

시그널을 보내거나 프로세스를 닫습니다.

```lua
local proc = executor:exec("./long-running-server.sh")
proc:start()

-- ... 나중에 중지해야 할 때 ...

-- 정상 종료 (SIGTERM)
proc:close()

-- 또는 강제 종료 (SIGKILL)
proc:close(true)

-- 또는 특정 시그널 전송
local SIGINT = 2
proc:signal(SIGINT)
```

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
| 권한 거부됨 | `errors.PERMISSION_DENIED` | 아니오 |
| 프로세스 닫힘 | `errors.INVALID` | 아니오 |
| 프로세스 시작되지 않음 | `errors.INVALID` | 아니오 |
| 이미 시작됨 | `errors.INVALID` | 아니오 |

에러 처리는 [에러 처리](lua-errors.md)를 참조하세요.
