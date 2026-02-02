# 테스팅

내장 테스트 프레임워크를 사용하여 Wippy 애플리케이션의 테스트를 작성하고 실행합니다.

## 테스트 발견

테스트는 메타데이터로 발견됩니다. 테스트 러너는 `meta.type = "test"`인 모든 레지스트리 엔트리를 찾아 실행합니다.

```bash
wippy run app:test_runner app:terminal
```

러너는 `registry.find({["meta.type"] = "test"})`를 사용하여 테스트를 찾고 `funcs.call(entry.id)`로 호출합니다.

## 테스트 정의

`_index.yaml`에 `meta.type = "test"`로 테스트 함수를 등록합니다:

```yaml
version: "1.0"
namespace: app.test.errors

entries:
  - name: new
    kind: function.lua
    meta:
      type: test
      suite: errors
      description: errors.new creates structured errors
    source: file://new.lua
    method: main
    imports:
      assert2: app.lib:assert
```

**메타데이터 필드:**

- `meta.type`: 테스트 발견을 위해 `"test"`여야 함
- `meta.suite`: 관련 테스트 그룹화 (예: "errors", "json")
- `meta.order`: 스위트 내 실행 순서 (기본값: 0)
- `meta.description`: 테스트 설명 (출력에 표시됨)

## 테스트 함수 작성

테스트 함수는 성공 시 `true`를 반환하거나 실패 시 에러를 throw해야 합니다:

```lua
-- tests/test/errors/new.lua
local assert = require("assert2")

local function main()
    local e1 = errors.new("simple error")
    assert.ok(e1, "errors.new returns error")
    assert.eq(e1:message(), "simple error", "message matches")
    assert.eq(e1:kind(), "", "default kind is empty")
    assert.is_nil(e1:retryable(), "default retryable is nil")

    local e2 = errors.new({
        message = "not found",
        kind = errors.NOT_FOUND,
        retryable = false,
        details = {resource = "user", id = 123}
    })
    assert.eq(e2:message(), "not found", "message from table")
    assert.eq(e2:kind(), errors.NOT_FOUND, "kind from table")

    local d = e2:details()
    assert.eq(d.resource, "user", "details.resource")
    assert.eq(d.id, 123, "details.id")

    return true
end

return { main = main }
```

## 어설션 라이브러리

`tests/lib/assert.lua`에 재사용 가능한 어설션 모듈을 생성합니다:

```lua
local M = {}

function M.eq(actual: any, expected: any, msg: string?)
    if actual ~= expected then
        error((msg or "assertion failed") .. ": expected " .. tostring(expected) .. ", got " .. tostring(actual), 2)
    end
end

function M.neq(actual: any, expected: any, msg: string?)
    if actual == expected then
        error((msg or "assertion failed") .. ": expected not " .. tostring(expected), 2)
    end
end

function M.ok(val: any?, msg: string?): asserts val
    if not val then
        error((msg or "assertion failed") .. ": expected truthy value", 2)
    end
end

function M.fail(msg)
    error(msg or "assertion failed", 2)
end

function M.is_nil(val, msg)
    if val ~= nil then
        error((msg or "assertion failed") .. ": expected nil, got " .. tostring(val), 2)
    end
end

function M.not_nil(val: any?, msg: string?): asserts val
    if val == nil then
        error((msg or "assertion failed") .. ": expected non-nil value", 2)
    end
end

function M.is_string(val: any, msg: string?): asserts val is string
    if type(val) ~= "string" then
        error((msg or "assertion failed") .. ": expected string, got " .. type(val), 2)
    end
end

function M.is_number(val: any, msg: string?): asserts val is number
    if type(val) ~= "number" then
        error((msg or "assertion failed") .. ": expected number, got " .. type(val), 2)
    end
end

function M.is_table(val: any, msg: string?)
    if type(val) ~= "table" then
        error((msg or "assertion failed") .. ": expected table, got " .. type(val), 2)
    end
end

function M.is_boolean(val: any, msg: string?): asserts val is boolean
    if type(val) ~= "boolean" then
        error((msg or "assertion failed") .. ": expected boolean, got " .. type(val), 2)
    end
end

function M.contains(str, substr, msg)
    if type(str) ~= "string" or not string.find(str, substr, 1, true) then
        error((msg or "assertion failed") .. ": expected string to contain '" .. tostring(substr) .. "'", 2)
    end
end

function M.has_error(val, err, msg)
    if val ~= nil then
        error((msg or "has_error failed") .. ": expected nil result, got " .. tostring(val), 2)
    end
    if err == nil then
        error((msg or "has_error failed") .. ": expected error, got nil", 2)
    end
end

function M.no_error(val, err, msg)
    if err ~= nil then
        error((msg or "no_error failed") .. ": unexpected error: " .. tostring(err), 2)
    end
end

function M.throws(fn, msg)
    local ok, err = pcall(fn)
    if ok then
        error((msg or "throws failed") .. ": expected function to throw", 2)
    end
    return err
end

function M.not_throws(fn, msg)
    local ok, err = pcall(fn)
    if not ok then
        error((msg or "not_throws failed") .. ": unexpected error: " .. tostring(err), 2)
    end
end

function M.error_kind(err, expected_kind, msg)
    if err == nil then
        error((msg or "error_kind failed") .. ": error is nil", 2)
    end
    if type(err) ~= "table" then
        error((msg or "error_kind failed") .. ": error is not structured (got " .. type(err) .. ")", 2)
    end
    if err.kind ~= expected_kind then
        error((msg or "error_kind failed") .. ": expected kind '" .. tostring(expected_kind) .. "', got '" .. tostring(err.kind) .. "'", 2)
    end
end

function M.error_message(err, expected_msg, msg)
    if err == nil then
        error((msg or "error_message failed") .. ": error is nil", 2)
    end
    local actual_msg = type(err) == "table" and err.message or tostring(err)
    if actual_msg ~= expected_msg then
        error((msg or "error_message failed") .. ": expected message '" .. tostring(expected_msg) .. "', got '" .. tostring(actual_msg) .. "'", 2)
    end
end

function M.error_contains(err, substr, msg)
    if err == nil then
        error((msg or "error_contains failed") .. ": error is nil", 2)
    end
    local actual_msg = type(err) == "table" and err.message or tostring(err)
    if not string.find(actual_msg, substr, 1, true) then
        error((msg or "error_contains failed") .. ": expected error to contain '" .. tostring(substr) .. "', got '" .. tostring(actual_msg) .. "'", 2)
    end
end

return M
```

어설션 라이브러리를 등록합니다:

```yaml
# tests/lib/_index.yaml
version: "1.0"
namespace: app.lib

entries:
  - name: assert
    kind: function.lua
    source: file://assert.lua
```

## 에러 처리 테스트

Wippy 함수는 `(result, error)` 쌍을 반환합니다. 성공 및 에러 경로 모두 테스트합니다:

```lua
local assert = require("assert2")

local function main()
    -- 성공 경로 테스트
    local t, err = time.parse("2006-01-02 15:04:05", "2024-12-29 15:04:05")
    assert.is_nil(err, "parse succeeds")
    assert.not_nil(t, "parse returns time")
    assert.eq(t:year(), 2024, "parsed year")

    -- 에러 경로 테스트
    local bad_t, bad_err = time.parse("2006-01-02", "invalid-date")
    assert.is_nil(bad_t, "invalid parse returns nil")
    assert.not_nil(bad_err, "invalid parse returns error")

    return true
end

return { main = main }
```

**에러 패턴 어설션:**

```lua
local function main()
    -- 에러 종류 확인
    local user, err = fetch_user(-1)
    assert.is_nil(user, "no user on error")
    assert.eq(err:kind(), errors.INVALID, "INVALID kind")
    assert.eq(err:retryable(), false, "not retryable")

    -- 에러 메시지에 텍스트 포함 확인
    local _, compress_err = compress.gzip.encode("")
    assert.not_nil(compress_err, "error returned")
    assert.contains(tostring(compress_err), "empty", "error mentions empty")

    -- 함수가 throw하는지 확인
    assert.throws(function()
        error("something went wrong")
    end, "should throw")

    return true
end
```

## 테스트 스위트

`meta.suite`를 사용하여 관련 테스트를 그룹화합니다:

```yaml
version: "1.0"
namespace: app.test.channel

entries:
  - name: basic
    kind: function.lua
    meta:
      type: test
      suite: channel
      order: 1
    source: file://basic.lua
    method: main
    imports:
      assert2: app.lib:assert

  - name: buffered
    kind: function.lua
    meta:
      type: test
      suite: channel
      order: 2
    source: file://buffered.lua
    method: main
    imports:
      assert2: app.lib:assert

  - name: close
    kind: function.lua
    meta:
      type: test
      suite: channel
      order: 3
    source: file://close.lua
    method: main
    imports:
      assert2: app.lib:assert
```

같은 스위트의 테스트는 출력에서 그룹화되고 `meta.order`로 순서를 지정할 수 있습니다.

## 테스트 러너 구현

테스트 러너는 테스트를 발견하고 실행하는 프로세스입니다:

```yaml
# src/_index.yaml
entries:
  - name: test_runner
    kind: process.lua
    meta:
      comment: Runs all tests with meta.type=test
    source: file://runner.lua
    method: main
    modules:
      - io
      - registry
      - funcs
      - time
```

기본 러너 구현:

```lua
-- runner.lua
local io = require("io")
local registry = require("registry")
local funcs = require("funcs")
local time = require("time")

local function run_test(entry)
    local ok, result, err = pcall(function()
        return funcs.call(entry.id)
    end)

    if not ok then
        return false, result
    elseif err then
        return false, err
    elseif result == false then
        return false, "test returned false"
    else
        return true, nil
    end
end

local function main()
    local args = io.args()

    io.print("Running Tests")
    io.print("")

    -- 모든 테스트 찾기
    local entries, err = registry.find({["meta.type"] = "test"})
    if err then
        io.eprint("Error: " .. tostring(err))
        return 1
    end

    if not entries or #entries == 0 then
        io.print("No tests found")
        return 0
    end

    -- 패턴으로 필터링
    if #args > 0 then
        local filtered = {}
        for _, entry in ipairs(entries) do
            for _, pattern in ipairs(args) do
                if entry.id:find(pattern, 1, true) then
                    table.insert(filtered, entry)
                    break
                end
            end
        end
        entries = filtered
    end

    local passed = 0
    local failed = 0
    local failures = {}
    local start = time.now()

    -- 테스트 실행
    for _, entry in ipairs(entries) do
        local name = entry.id:match(":([^:]+)$") or entry.id
        io.write("  " .. name .. " ... ")

        local ok, err_obj = run_test(entry)

        if ok then
            io.print("ok")
            passed = passed + 1
        else
            io.print("FAILED")
            failed = failed + 1
            table.insert(failures, {id = entry.id, error = err_obj})
        end
    end

    local elapsed = time.now():sub(start):milliseconds()

    -- 실패 출력
    if #failures > 0 then
        io.print("")
        io.print("Failures:")
        for _, f in ipairs(failures) do
            io.print("")
            io.print("  " .. f.id)
            io.print("  " .. tostring(f.error))
        end
    end

    -- 요약
    io.print("")
    if failed > 0 then
        io.print("FAILED: " .. passed .. " passed, " .. failed .. " failed  " .. elapsed .. "ms")
        return 1
    else
        io.print("PASSED: " .. passed .. " tests  " .. elapsed .. "ms")
        return 0
    end
end

return { main = main }
```

`/home/wolfy-j/projects/wippy/tests/app/src/runner.lua`의 실제 테스트 러너는 다음을 포함합니다:

- 스위트 그룹화 및 순서 지정
- 스피너가 있는 실시간 진행 표시
- 진행 바
- 풀 등록 레이스를 위한 재시도 로직
- 컬러 출력
- 상세한 실패 보고서

## 테스트 실행

모든 테스트 실행:

```bash
wippy run app:test_runner app:terminal
```

패턴으로 테스트 필터링:

```bash
# "errors"를 포함하는 테스트 실행
wippy run app:test_runner app:terminal -- errors

# "channel" 또는 "time"을 포함하는 테스트 실행
wippy run app:test_runner app:terminal -- channel time
```

러너는 `entry.id:find(pattern, 1, true)`를 사용하여 테스트 엔트리 ID와 패턴을 매칭합니다.

## 테스트 출력 예제

```
  Running Tests

  12 tests in 3 suites

  ● errors (9) 9/9  15ms
  ● channel (8) 8/8  23ms
  ● time (6) 5/6  12ms
      ✗ parse_invalid

  Failures

    app.test.time:parse_invalid
    assertion failed: expected error, got nil

  FAILED  [████████████████████░]

  22 passed  1 failed  50ms
```

## 테스트 패턴

**채널 작업:**

```lua
local function main()
    local ch = channel.new(1)
    ch:send("hello")
    local val, ok = ch:receive()
    assert.eq(val, "hello", "received correct value")
    assert.eq(ok, true, "receive ok is true")
    return true
end
```

**함수 호출:**

```lua
local function main()
    local result, err = funcs.call("app.test.funcs:echo", "test input")
    assert.is_nil(err, "call echo no error")
    assert.eq(result.ok, true, "echo result ok")
    assert.eq(result.echo, "test input", "echo result has input")
    return true
end
```

**레지스트리 쿼리:**

```lua
local function main()
    local entries, err = registry.find({kind = "function.lua"})
    assert.is_nil(err, "find by kind no error")
    assert.not_nil(entries, "find returns entries")
    assert.ok(#entries > 0, "find has results")

    for _, entry in ipairs(entries) do
        assert.not_nil(entry.id, "entry has id")
        assert.eq(type(entry.id), "string", "id is string")
    end

    return true
end
```

## 프로젝트 구조

```
myapp/
├── tests/
│   ├── lib/
│   │   ├── _index.yaml        # Assert 라이브러리 등록
│   │   └── assert.lua         # 어설션 함수
│   ├── test/
│   │   ├── errors/
│   │   │   ├── _index.yaml    # 에러 테스트 메타데이터
│   │   │   ├── new.lua        # 에러 생성 테스트
│   │   │   ├── patterns.lua   # 에러 패턴 테스트
│   │   │   └── wrap.lua       # 에러 래핑 테스트
│   │   ├── channel/
│   │   │   ├── _index.yaml    # 채널 테스트 메타데이터
│   │   │   ├── basic.lua      # 기본 작업 테스트
│   │   │   └── buffered.lua   # 버퍼드 채널 테스트
│   │   └── ...
│   ├── _index.yaml            # 테스트 러너 등록
│   └── runner.lua             # 테스트 러너 구현
└── src/
    └── ...                     # 애플리케이션 코드
```

## 핵심 사항

1. 테스트는 레지스트리 엔트리의 `meta.type = "test"`로 발견됨
2. 테스트 함수는 `true`를 반환하거나 에러를 throw해야 함
3. `meta.suite`를 사용하여 관련 테스트 그룹화
4. `meta.order`를 사용하여 스위트 내 실행 순서 제어
5. `(result, error)` 반환 패턴으로 성공 및 에러 경로 모두 테스트
6. 명령줄 인자로 패턴을 전달하여 테스트 필터링
7. 테스트 러너는 `registry.find()`와 `funcs.call()`을 사용하여 테스트 실행

## 다음 단계

- [에러 처리](lua/core/errors.md) - 에러 패턴 및 어설션
- [레지스트리](lua/core/registry.md) - 레지스트리 쿼리 및 필터링
- [함수](concepts/functions.md) - 함수 호출 및 실행
