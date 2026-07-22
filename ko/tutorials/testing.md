---
title: "테스트"
description: "wippy/test 프레임워크로 Lua 코드의 테스트를 작성하고 실행합니다 — 어설션, 라이프사이클 훅, 모킹을 갖춘 BDD 스타일 러너이며, wippy test 명령으로 실행됩니다."
---

# 테스트

`wippy/test` 프레임워크로 Lua 코드의 테스트를 작성하고 실행합니다 — 어설션, 라이프사이클 훅, 모킹을 갖춘 BDD 스타일 러너이며, `wippy test` 명령으로 실행됩니다.

## 무엇을 구축할 것인가

작은 라이브러리와 그것을 커버하는 테스트 스위트:

1. `add` 및 `div` 함수가 있는 `calc` 라이브러리.
2. 케이스를 설명하고, 동작을 어설트하며, 보류 중인 케이스를 건너뛰는 테스트 엔트리.
3. `wippy test`를 통한 그린 테스트 실행.

## 전제 조건

- Wippy 프로젝트 ([app-template](https://github.com/wippyai/app-template) 클론, 또는 빈 디렉토리에서 `wippy init`).
- 설치된 테스트 프레임워크와 터미널 호스트:

  ```bash
  wippy add wippy/test
  wippy add wippy/terminal
  wippy install
  ```

  러너는 라이브 터미널 UI를 렌더링하므로 `wippy/test`와 함께 `wippy/terminal`이 필요합니다.

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

테스트는 `meta.type: test`로 태그된 일반적인 `function.lua` 엔트리입니다. 그 메서드는 `test.run_cases(...)`가 생성한 값을 반환하며, 러너가 이를 호출합니다:

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

두 엔트리를 모두 등록합니다. 디스커버리는 `meta.type: test`를 기준으로 동작합니다; `meta.suite`는 출력에서 결과를 그룹화합니다:

```yaml
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

`imports` 맵은 테스트 내부에서 `require(...)`가 무엇으로 해석되는지 제어합니다: `test`는 프레임워크를, `calc`는 테스트 대상 유닛을 바인딩합니다.

## 실행하기

```bash
wippy test
```

반복 작업 중에 단일 스위트로 필터링합니다 (엔트리 id 또는 스위트 이름과 매칭):

```bash
wippy test calculator
```

위 스위트의 출력:

```
  calculator (4)  3/4  1 skipped  1ms
    o setup ran
    o adds numbers
    o returns error on divide by zero
    - not implemented yet (skipped)

  PASSED   3 tests   1 skipped   1ms
```

`wippy test`는 모든 케이스가 통과하면 `0`으로, 실패가 있으면 `1`로 종료되므로 CI에 바로 적용됩니다.

## 어설션

각 어설션은 실패 시 에러를 발생시킵니다; 타입 가드는 검증된 값도 반환합니다.

| 어설션 | 검사 내용 |
|---|---|
| `test.eq(a, b)` / `test.neq(a, b)` | 동등성 / 비동등성 |
| `test.ok(v)` / `test.fail(msg)` | 참 값 / 강제 실패 |
| `test.is_nil(v)` / `test.not_nil(v)` | Nil / 비-nil |
| `test.is_true(v)` / `test.is_false(v)` | 불리언 값 |
| `test.is_string/number/table/function/boolean(v)` | 타입 가드 (`v` 반환) |
| `test.contains(str, sub)` / `test.matches(str, pattern)` | 부분 문자열 / Lua 패턴 |
| `test.has_key(tbl, key)` / `test.len(v, n)` | 맵 키 / 길이 |
| `test.gt/gte/lt/lte(a, b)` | 숫자 비교 |
| `test.throws(fn)` / `test.has_error(val, err)` / `test.no_error(val, err)` | 에러 처리 |

모두 선택적 후행 메시지 인자를 받습니다.

## 라이프사이클 및 모킹

이들을 `describe` 블록 내부에서 호출합니다:

- `test.before_all` / `test.after_all` — 블록당 한 번 실행.
- `test.before_each` / `test.after_each` — 모든 케이스 전후로 실행.
- `test.mock("module.field", fn)` — 현재 케이스에 대해 함수를 교체; 모킹은 각 케이스 후 자동으로 복원됩니다. 일찍 제거하려면 `test.restore_all_mocks()`를 사용하세요.

중첩된 `describe` 블록은 부모 훅을 상속합니다 (바깥 `before_*`가 먼저, 안쪽 `after_*`가 먼저).

## 다음 단계

- [Hello World](tutorials/hello-world.md) — 최소한의 프로젝트 레이아웃
- [엔트리 종류](guides/entry-kinds.md) — `function.lua`, `library.lua` 및 관련 항목
- [테스트 프레임워크](framework/testing.md) — 러너와 이벤트 프로토콜에 대한 전체 레퍼런스
