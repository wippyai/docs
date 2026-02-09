# 테스트 프레임워크

`wippy/test` 모듈은 어서션, 생명주기 훅, 모킹을 갖춘 BDD 스타일 테스트 프레임워크를 제공합니다.

## 설정

의존성을 추가합니다:

```bash
wippy add wippy/test
wippy install
```

모듈은 `test` 명령을 자동으로 등록합니다. 설치 후 `wippy run test`로 프로젝트의 모든 테스트 엔트리를 검색하고 실행합니다.

## 테스트 정의하기

테스트는 `meta.type: test`를 가진 `function.lua` 엔트리입니다:

```yaml
version: "1.0"
namespace: app.test

entries:
  - name: math
    kind: function.lua
    meta:
      type: test
      suite: math
      description: Math operations
    source: file://math_test.lua
    method: run
    imports:
      test: wippy.test:test
```

### 테스트 메타데이터

| Field | Required | Description |
|-------|----------|-------------|
| `type` | Yes | 러너가 검색하려면 `"test"`여야 합니다 |
| `suite` | No | 러너 출력에서 테스트를 그룹화합니다 |
| `description` | No | 사람이 읽을 수 있는 설명 |
| `order` | No | 스위트 내 정렬 순서 (낮을수록 먼저 실행) |

## 테스트 작성하기

### BDD 스타일

`describe`와 `it` 블록을 사용하여 테스트를 구조화합니다:

```lua
local test = require("test")

local function define_tests()
    test.describe("calculator", function()
        test.it("adds numbers", function()
            test.eq(1 + 1, 2)
        end)

        test.it("multiplies numbers", function()
            test.eq(3 * 4, 12)
        end)
    end)
end

local run_cases = test.run_cases(define_tests)

local function run(options)
    local result = run_cases(options)
    if result.failed_tests > 0 then
        error("tests failed: " .. result.failed_tests)
    end
    return result
end

return { run = run }
```

### 중첩 스위트

스위트를 중첩하여 구성할 수 있습니다:

```lua
test.describe("user", function()
    test.describe("validation", function()
        test.it("requires name", function()
            test.ok(validate({}).error)
        end)

        test.it("accepts valid input", function()
            test.is_nil(validate({name = "Alice"}).error)
        end)
    end)

    test.describe("formatting", function()
        test.it("formats display name", function()
            test.eq(format_name("alice"), "Alice")
        end)
    end)
end)
```

### 테스트 건너뛰기

```lua
test.it_skip("not implemented yet", function()
    test.fail("TODO")
end)
```

건너뛴 테스트는 출력에 표시되지만 실패로 집계되지 않습니다.

### 스위트 별칭

`test.spec`과 `test.context`는 `test.describe`의 별칭입니다:

```lua
test.spec("feature", function()
    test.context("when valid input", function()
        test.it("succeeds", function()
            test.ok(true)
        end)
    end)
end)
```

## 어서션

### 동등성

```lua
test.eq(actual, expected, msg?)       -- actual == expected
test.neq(actual, expected, msg?)      -- actual ~= expected
```

### 참/거짓 판별

```lua
test.ok(val, msg?)                    -- val is truthy
test.fail(msg?)                       -- unconditional failure
```

### Nil 검사

```lua
test.is_nil(val, msg?)                -- val == nil
test.not_nil(val, msg?)               -- val ~= nil
```

### 타입 검사

```lua
test.is_true(val, msg?)               -- val == true
test.is_false(val, msg?)              -- val == false
test.is_string(val, msg?)
test.is_number(val, msg?)
test.is_table(val, msg?)
test.is_function(val, msg?)
test.is_boolean(val, msg?)
```

### 문자열 및 컬렉션

```lua
test.contains(str, substr, msg?)      -- substring match
test.matches(str, pattern, msg?)      -- Lua pattern match
test.has_key(tbl, key, msg?)          -- table key exists
test.len(val, expected, msg?)         -- #val == expected
```

### 수치 비교

```lua
test.gt(a, b, msg?)                   -- a > b
test.gte(a, b, msg?)                  -- a >= b
test.lt(a, b, msg?)                   -- a < b
test.lte(a, b, msg?)                  -- a <= b
```

### 오류 처리

```lua
test.throws(fn, msg?)                 -- fn() raises error, returns it
test.has_error(val, err, msg?)        -- val is nil, err is not nil
test.no_error(val, err, msg?)         -- err is nil
```

모든 어서션은 마지막 인자로 선택적 메시지를 받습니다. 실패 시 해당 메시지가 오류 출력에 포함됩니다.

## 생명주기 훅

```lua
test.describe("database", function()
    test.before_all(function()
        -- runs once before the suite
        db = connect()
    end)

    test.after_all(function()
        -- runs once after the suite
        db:close()
    end)

    test.before_each(function()
        -- runs before each test
        db:begin_transaction()
    end)

    test.after_each(function()
        -- runs after each test
        db:rollback()
    end)

    test.it("inserts a record", function()
        db:exec("INSERT INTO users (name) VALUES ('Alice')")
        local count = db:query_row("SELECT COUNT(*) FROM users")
        test.eq(count, 1)
    end)
end)
```

중첩 스위트의 훅은 순서대로 실행됩니다: 부모 `before_each`가 자식 `before_each` 전에 실행되고, 자식 `after_each`가 부모 `after_each` 전에 실행됩니다.

## 모킹

모킹 시스템은 전역 객체 필드를 교체하고 각 테스트 후 자동으로 복원합니다.

### 기본 모킹

```lua
test.describe("notifications", function()
    test.it("sends message", function()
        local sent = false
        test.mock("process.send", function(pid, topic, payload)
            sent = true
        end)

        notify_user("hello")
        test.is_true(sent)
        -- mock is auto-restored after this test
    end)
end)
```

### 모킹 API

```lua
test.mock("object.field", replacement)    -- replace a global field
test.mock_process("field", replacement)   -- shorthand for process fields
test.restore_mock("object.field")         -- restore one mock
test.restore_all_mocks()                  -- restore all mocks
```

모킹 경로는 점 표기법을 사용합니다: `"process.send"`는 `_G.process.send`를 교체합니다.

`process.send`에 대한 모킹은 원래 함수를 통해 테스트 프레임워크 메시지를 자동으로 프록시하므로, process.send가 모킹된 상태에서도 테스트 이벤트 리포팅이 계속 동작합니다.

모든 모킹은 `after_each` 훅을 통해 각 테스트 후 자동으로 복원됩니다.

## 테스트 실행하기

### 전체 테스트 실행

```bash
wippy run test
```

### 패턴으로 필터링

```bash
wippy run test math
wippy run test user validation
```

필터는 엔트리 ID와 매칭됩니다. 여러 패턴이 결합됩니다.

### 출력 예시

```
3 tests in 1 suites

  calculator
    + adds numbers                           0ms
    + multiplies numbers                     0ms
    - divides by zero                        1ms
      Error: expected error, got nil

  1 suite | 2 passed | 1 failed | 0 skipped | 3ms
```

## 간단한 테스트

BDD 프레임워크가 필요 없는 테스트의 경우, `true`를 반환하거나 오류를 발생시키는 간단한 함수를 정의합니다:

```lua
local funcs = require("funcs")

local function main()
    local result, err = funcs.call("app:my_function", "input")
    if err then
        error("call failed: " .. tostring(err))
    end
    if result ~= "expected" then
        error("expected 'expected', got: " .. tostring(result))
    end
    return true
end

return { main = main }
```

```yaml
  - name: integration
    kind: function.lua
    meta:
      type: test
      suite: integration
    source: file://integration_test.lua
    method: main
    modules:
      - funcs
```

러너는 테스트가 BDD 케이스 이벤트를 사용하는지 단순 값을 반환하는지 감지합니다. 두 패턴 모두 `wippy run test`에서 동작합니다.

## 프로젝트 구조

일반적인 테스트 레이아웃:

```
src/
  _index.yaml
  app.lua
  test/
    _index.yaml          # test entries
    math_test.lua
    user_test.lua
    integration_test.lua
```

테스트 `_index.yaml`은 테스트 네임스페이스와 엔트리를 정의합니다:

```yaml
version: "1.0"
namespace: app.test

entries:
  - name: math
    kind: function.lua
    meta:
      type: test
      suite: math
    source: file://math_test.lua
    method: run
    imports:
      test: wippy.test:test

  - name: user
    kind: function.lua
    meta:
      type: test
      suite: user
    source: file://user_test.lua
    method: run
    imports:
      test: wippy.test:test
```

## 인프라 요구사항

테스트 러너는 애플리케이션에 `process.host`와 `terminal.host`가 필요합니다. 일반적으로 이미 존재합니다. 없는 경우 추가하십시오:

```yaml
entries:
  - name: processes
    kind: process.host
    lifecycle:
      auto_start: true

  - name: terminal
    kind: terminal.host
    lifecycle:
      auto_start: true
```

## 참고

- [프레임워크 개요](framework/overview.md) - 프레임워크 모듈 사용법
- [CLI 레퍼런스](guides/cli.md) - CLI 명령
- [함수](concepts/functions.md) - 함수 레지스트리
