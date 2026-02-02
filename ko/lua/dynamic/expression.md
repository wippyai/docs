# 표현식 언어
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

[expr-lang](https://expr-lang.org/) 구문을 사용하여 동적 표현식을 평가합니다. 전체 Lua 실행 없이 필터링, 검증, 규칙 평가를 위한 안전한 표현식을 컴파일하고 실행합니다.

## 설정

표현식 캐시는 부팅 시 설정됩니다:

```yaml
lua:
  expr:
    cache_enabled: true   # 표현식 캐싱 활성화
    capacity: 5000        # 캐시 용량
```

## 로딩

```lua
local expr = require("expr")
```

## 표현식 평가

표현식 문자열을 평가하고 결과를 반환합니다. 컴파일된 표현식에 대해 내부 LRU 캐시를 사용합니다:

```lua
-- 단순 수학
local result = expr.eval("1 + 2 * 3")  -- 7

-- 변수 사용
local total = expr.eval("price * quantity", {
    price = 29.99,
    quantity = 3
})  -- 89.97

-- 불리언 표현식
local is_adult = expr.eval("age >= 18", {age = 21})  -- true

-- 문자열 연산
local greeting = expr.eval('name + " is " + status', {
    name = "Alice",
    status = "online"
})  -- "Alice is online"

-- 삼항 연산자
local label = expr.eval('score > 90 ? "A" : score > 80 ? "B" : "C"', {
    score = 85
})  -- "B"

-- 배열 연산
local has_admin = expr.eval('"admin" in roles', {
    roles = {"user", "admin", "viewer"}
})  -- true
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `expression` | string | expr-lang 구문 표현식 |
| `env` | table | 표현식을 위한 변수 환경 (선택적) |

**반환:** `any, error`

## 표현식 컴파일

반복 평가를 위해 표현식을 재사용 가능한 Program 객체로 컴파일합니다:

```lua
-- 반복 사용을 위해 한 번 컴파일
local discount_calc, err = expr.compile("price * (1 - discount_rate)")
if err then
    return nil, err
end

-- 다른 입력으로 재사용
local price1 = discount_calc:run({price = 100, discount_rate = 0.1})  -- 90
local price2 = discount_calc:run({price = 50, discount_rate = 0.2})   -- 40
local price3 = discount_calc:run({price = 200, discount_rate = 0.15}) -- 170
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `expression` | string | expr-lang 구문 표현식 |
| `env` | table | 컴파일을 위한 타입 힌트 환경 (선택적) |

**반환:** `Program, error`

## 컴파일된 프로그램 실행

제공된 환경으로 컴파일된 표현식을 실행합니다:

```lua
-- 검증 규칙
local validator, _ = expr.compile("len(password) >= 8 and len(password) <= 128")

local valid1 = validator:run({password = "short"})       -- false
local valid2 = validator:run({password = "securepass123"}) -- true

-- 가격 규칙
local pricer, _ = expr.compile([[
    base_price * quantity * (1 - bulk_discount) + shipping
]])

local order_total = pricer:run({
    base_price = 25.00,
    quantity = 10,
    bulk_discount = 0.15,
    shipping = 12.50
})  -- 225.00
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `env` | table | 표현식을 위한 변수 환경 (선택적) |

**반환:** `any, error`

## 내장 함수

Expr-lang은 많은 내장 함수를 제공합니다:

```lua
-- 수학 함수
expr.eval("max(1, 5, 3)")        -- 5
expr.eval("min(10, 2, 8)")       -- 2
expr.eval("abs(-42)")            -- 42
expr.eval("ceil(3.2)")           -- 4
expr.eval("floor(3.8)")          -- 3

-- 문자열 함수
expr.eval('len("hello")')        -- 5
expr.eval('upper("hello")')      -- "HELLO"
expr.eval('lower("HELLO")')      -- "hello"
expr.eval('trim("  hi  ")')      -- "hi"
expr.eval('contains("hello", "ell")')  -- true

-- 배열 함수
expr.eval("len(items)", {items = {1,2,3}})  -- 3
expr.eval("sum(values)", {values = {1,2,3,4}})  -- 10
```

## 에러

| 조건 | 종류 | 재시도 가능 |
|------|------|-------------|
| 표현식이 비어있음 | `errors.INVALID` | 아니오 |
| 표현식 구문 잘못됨 | `errors.INTERNAL` | 아니오 |
| 표현식 평가 실패 | `errors.INTERNAL` | 아니오 |
| 결과 변환 실패 | `errors.INTERNAL` | 아니오 |

에러 처리는 [에러 처리](lua/core/errors.md)를 참조하세요.
