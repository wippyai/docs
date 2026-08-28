---
title: "테스트"
description: "wippy/test 어설션, 라이프사이클 훅, 모킹, 필터링, 종료 코드로 Lua 테스트를 작성하고 실행합니다."
---

# 테스트

`wippy/test` 프레임워크로 어설션, 라이프사이클 훅, 모킹을 포함한 Lua 테스트 케이스를 정의하고 `wippy test`로 실행합니다.

**분류:** 실행 가능한 튜토리얼. 완전한 라이브러리와 테스트 엔트리, 의존성 설정, 예상 러너 출력, 실패 검증을 포함합니다.

## 만들 항목

작은 라이브러리와 이를 검증하는 테스트 스위트를 만듭니다:

1. `add` 및 `div` 함수가 있는 `calc` 라이브러리.
2. 케이스를 설명하고 동작을 검증하며 보류 중인 케이스를 건너뛰는 테스트 엔트리.
3. `wippy test`를 사용한 성공적인 테스트 실행.

## 사전 요구 사항

- Wippy 런타임 `v0.3.32a`.
- 빈 작업 디렉터리. 프로젝트를 만들고 초기화한 뒤 테스트 프레임워크를 설치합니다:

  ```bash
  mkdir testing-demo
  cd testing-demo
  mkdir src
  wippy init
  wippy add wippy/test
  wippy install
  ```

  테스트 프레임워크는 `wippy/terminal`을 의존성으로 선언하므로 설치 과정에서 러너의 라이브 UI에 사용하는 터미널 호스트도 함께 가져옵니다.

완성된 프로젝트는 다음과 같습니다:

```text
testing-demo/
├── wippy.lock
└── src/
    ├── _index.yaml
    ├── calc.lua
    └── calc_test.lua
```

## 테스트 대상 코드

```lua
-- src/calc.lua
local function add(a, b)
    return a + b
end

local function div(a, b)
    if b == 0 then
        return nil, "division by zero"
    end
    return a / b
end

return { add = add, div = div }
```

## 테스트

테스트는 `meta.type: test`로 태그한 일반 `function.lua` 엔트리입니다. 메서드는 러너가 호출하는 `test.run_cases(...)`의 값을 반환합니다:

```lua
-- src/calc_test.lua
local test = require("test")
local calc = require("calc")

local function define_tests()
    test.describe("calculator", function()
        local started = false

        test.before_all(function()
            started = true
        end)

        test.it("setup ran", function()
            test.is_true(started)
        end)

        test.it("adds numbers", function()
            test.eq(calc.add(2, 3), 5)
        end)

        test.it("returns error on divide by zero", function()
            local result, err = calc.div(1, 0)
            test.has_error(result, err)
            test.contains(err, "division by zero")
        end)

        test.it_skip("not implemented yet", function()
            test.fail("should not run")
        end)
    end)
end

return { run = test.run_cases(define_tests) }
```

두 엔트리를 모두 등록합니다. 검색은 `meta.type: test`를 기준으로 하며 `meta.suite`는 출력에서 결과를 그룹화합니다:

```yaml
# src/_index.yaml
version: "1.0"
namespace: app

entries:
  - name: calc
    kind: library.lua
    source: file://calc.lua

  - name: calc_test
    kind: function.lua
    meta:
      name: Calculator Test
      type: test
      suite: calculator
    source: file://calc_test.lua
    method: run
    imports:
      test: wippy.test:test
      calc: app:calc
```

`imports` 맵은 테스트 안에서 `require(...)`가 해석되는 대상을 제어합니다. `test`는 프레임워크를, `calc`는 테스트 대상을 바인딩합니다.

## 실행

```bash
wippy test
```

반복 작업 중에는 엔트리 ID 부분 문자열(`namespace:name`)로 필터링합니다:

```bash
wippy test test calc_test
```

첫 번째 `test`는 프레임워크의 테스트 러너 엔트리포인트를 선택합니다. 나머지 인수는 테스트 엔트리 ID에 적용되는 부분 문자열 필터입니다.

이 스위트의 예상 출력은 다음과 같습니다:

```
    o setup ran <duration>
    o adds numbers <duration>
    o returns error on divide by zero <duration>
    - not implemented yet (skipped)
  o calculator (4) 3/4 1 skipped <duration>

  PASSED
  3 tests  1 skipped  <duration>
```

라이브 렌더러는 스위트 요약보다 먼저 각 케이스를 출력합니다. 실행마다 소요 시간은 달라집니다.

모든 케이스가 통과하면 `wippy test`는 `0`, 하나라도 실패하면 `1`로 종료되므로 CI에서 명령의 종료 상태를 사용할 수 있습니다.

실패 경로를 검증하려면 예상 합계를 잠시 `5`에서 `6`으로 바꾸세요. 러너는 `FAILED`를 출력하고 상태 1로 종료해야 합니다. 계속하기 전에 `5`로 복원하세요.

## 어설션

각 어설션은 실패 시 오류를 발생시킵니다. 타입 가드는 검증한 값도 반환합니다.

| 어설션 | 검사 내용 |
|---|---|
| `test.eq(a, b)` / `test.neq(a, b)` | 동등 / 비동등 |
| `test.ok(v)` / `test.fail(msg)` | 참 값 / 강제 실패 |
| `test.is_nil(v)` / `test.not_nil(v)` | nil / nil 아님 |
| `test.is_true(v)` / `test.is_false(v)` | 불리언 값 |
| `test.is_string/number/table/function/boolean(v)` | 타입 가드(`v` 반환) |
| `test.contains(str, sub)` / `test.matches(str, pattern)` | 부분 문자열 / Lua 패턴 |
| `test.has_key(tbl, key)` / `test.len(v, n)` | 맵 키 / 길이 |
| `test.gt/gte/lt/lte(a, b)` | 숫자 비교 |
| `test.throws(fn)` / `test.has_error(val, err)` / `test.no_error(val, err)` | 오류 처리 |

모두 선택적인 마지막 메시지 인수를 받습니다.

## 라이프사이클 및 모킹

다음 함수는 `describe` 블록 안에서 호출합니다:

- `test.before_all` / `test.after_all` — 블록마다 한 번 실행.
- `test.before_each` / `test.after_each` — 모든 케이스 전후에 실행.
- `test.mock("module.field", fn)` — 현재 케이스에서 함수를 교체합니다. 모킹은 각 케이스 뒤에 자동으로 복원됩니다. 일찍 제거하려면 `test.restore_all_mocks()`를 사용하세요.

중첩 `describe` 블록은 부모 훅을 상속합니다. 바깥쪽 `before_*`가 먼저, 안쪽 `after_*`가 먼저 실행됩니다.

## 문제 해결

- `No test runner found`는 `wippy.lock`에 `wippy/test`가 없다는 뜻입니다. `wippy add wippy/test`와 `wippy install`을 실행하세요.
- `calc` 또는 `test` 모듈을 찾지 못하면 `imports` 키가 해당 `require(...)` 호출과 일치하는지 확인하세요.
- 테스트 파일의 엔트리에 `meta.type: test`가 없으면 검색되지 않습니다.
- 시간과 터미널 글리프는 터미널마다 다릅니다. 자동화에서는 최종 상태와 프로세스 종료 코드를 사용하세요.

## 정리

`testing-demo` 디렉터리에서 나온 뒤 더 이상 일회용 프로젝트가 필요하지 않으면 제거하세요.

## 다음 단계

- [Hello World](tutorials/hello-world.md) — 최소 프로젝트 레이아웃
- [엔트리 종류](guides/entry-kinds.md) — `function.lua`, `library.lua` 및 관련 엔트리
- [테스트 프레임워크](framework/testing.md) — 러너와 이벤트 프로토콜 참조
