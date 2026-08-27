---
title: "표현식 언어"
description: "Lua에서 expr-lang expression을 compile하고 evaluate합니다."
---

# 표현식 언어
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

`expr` 모듈은 Lua source code를 실행하지 않고 filtering, validation, calculation, rule evaluation을 수행할 수 있도록 [expr-lang](https://expr-lang.org/) expression을 compile하고 evaluate합니다. 이 페이지는 canonical Lua API reference입니다. example은 entry가 `expr` 모듈을 선언한 기존 Wippy Lua process 안에서 실행되며 standalone Wippy application은 아닙니다. expression과 capability-restricted Lua 중 선택할 때는 [동적 평가](./eval.md)를 참조하십시오.

## 로딩

```lua
local expr = require("expr")
```

## 캐싱

`expr.eval`은 compiled expression의 internal LRU cache(default capacity 1000)를 유지합니다. cache는 module에 내장되어 있으며 configuration이 필요하지 않습니다.

## 표현식 평가

표현식 문자열을 평가하고 결과를 반환합니다. 컴파일된 표현식에 대해 내부 LRU 캐시를 사용합니다:

```lua
-- Simple math
local result, err = expr.eval("1 + 2 * 3")
if err then
    return nil, err
end
-- result == 7

-- With variables
local total, total_err = expr.eval("price * quantity", {
    price = 29.99,
    quantity = 3
})
if total_err then
    return nil, total_err
end
-- total == 89.97

-- Ternary operator
local label, label_err = expr.eval('score > 90 ? "A" : score > 80 ? "B" : "C"', {
    score = 85
})
if label_err then
    return nil, label_err
end
-- label == "B"
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `expression` | string | expr-lang 구문 표현식 |
| `env` | `any` | expression용 variable environment(optional, 일반적으로 table) |

**반환:** `any, error`

## 표현식 컴파일

반복 평가를 위해 표현식을 재사용 가능한 `Program` 객체로 컴파일합니다:

```lua
-- Compile once for repeated use
local discount_calc, err = expr.compile("price * (1 - discount_rate)")
if err then
    return nil, err
end

-- Reuse with different inputs
local price1, run_err = discount_calc:run({price = 100, discount_rate = 0.1})
if run_err then
    return nil, run_err
end

local price2, second_run_err = discount_calc:run({price = 50, discount_rate = 0.2})
if second_run_err then
    return nil, second_run_err
end
-- price1 == 90 and price2 == 40
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `expression` | string | expr-lang 구문 표현식 |
| `env` | `any` | compilation용 type-hint environment(optional, 일반적으로 table) |

**반환:** `Program, error`

## 컴파일된 프로그램 실행

제공된 환경으로 컴파일된 표현식을 실행합니다:

```lua
-- Validation rule
local validator, compile_err = expr.compile("len(password) >= 8 and len(password) <= 128")
if compile_err then
    return nil, compile_err
end

local valid, run_err = validator:run({password = "securepass123"})
if run_err then
    return nil, run_err
end
-- valid == true

-- Pricing rule
local pricer, pricing_compile_err = expr.compile([[
    base_price * quantity * (1 - bulk_discount) + shipping
]])
if pricing_compile_err then
    return nil, pricing_compile_err
end

local order_total, pricing_run_err = pricer:run({
    base_price = 25.00,
    quantity = 10,
    bulk_discount = 0.15,
    shipping = 12.50
})
if pricing_run_err then
    return nil, pricing_run_err
end
-- order_total == 225.00
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `env` | `any` | expression용 variable environment(optional, 일반적으로 table) |

**반환:** `any, error`

## 내장 함수

Expr-lang은 common operation용 built-in function을 포함합니다.

```lua
local maximum, max_err = expr.eval("max(1, 5, 3)")
if max_err then
    return nil, max_err
end

local uppercase, upper_err = expr.eval('upper("hello")')
if upper_err then
    return nil, upper_err
end

local total, sum_err = expr.eval("sum(values)", {values = {1, 2, 3, 4}})
if sum_err then
    return nil, sum_err
end
-- maximum == 5, uppercase == "HELLO", and total == 10
```

다른 built-in에는 `min`, `abs`, `ceil`, `floor`, `len`, `lower`, `trim`이 있습니다. expr-lang은 string의 `contains`, membership test의 `in` 같은 operator도 제공합니다.

## 에러

| 조건 | 종류 | 재시도 가능 |
|------|------|-------------|
| 표현식이 비어있음 | `errors.INVALID` | 아니오 |
| 표현식 구문 잘못됨 | `errors.INTERNAL` | 아니오 |
| 표현식 평가 실패 | `errors.INTERNAL` | 아니오 |
| 결과 변환 실패 | `errors.INTERNAL` | 아니오 |

[에러 처리](../core/errors.md)에서 error 사용법을 확인하십시오.
