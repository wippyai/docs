---
title: "타입 시스템"
description: "유니온, 레코드, 제네릭, 검증, 리플렉션을 포함한 Wippy 점진적 타입 시스템의 구문과 런타임 동작입니다."
---

# 타입 시스템

> **실험적.** 타입 시스템은 아직 발전 중이며 몇 가지 제한이 예상됩니다.

Wippy의 점진적 타입 시스템은 증분 어노테이션과 흐름 민감 검사를 지원합니다. 타입은 기본적으로 nullable이 아닙니다.

이 페이지는 완전한 프로그램이 아니라 언어 참조입니다. 각 코드 블록은 독립적인 타입 검사 예제이며, 한 블록 안의 대안들이 반드시 함께 사용되는 것은 아닙니다. `get_data`, `get_user`, `call`, `User` 같은 이름은 애플리케이션 코드를 나타내고, `ERROR`로 표시된 줄은 의도적으로 진단을 보여줍니다. 이 예제는 언어 구문과 기본 제공 타입 값을 사용하므로 런타임 모듈이 필요하지 않습니다.

## 프리미티브

```lua
local n: number = 3.14
local i: integer = 42         -- integer is subtype of number
local s: string = "hello"
local b: boolean = true
local a: any = "anything"     -- dynamic member and method access
local u: unknown = { source = "example" }  -- must narrow before use
```

### `any`와 `unknown`

```lua
-- any: dynamic member and method access
local a: any = get_data()
a.foo.bar.baz()              -- no error, may crash at runtime
local s: string = a          -- ERROR: any is not assignable to string

-- unknown: safe unknown, must narrow before use as a concrete type
local u: unknown = get_data()
u.foo                        -- no error: member access on unknown behaves like any
local n: number = u          -- ERROR: unknown not assignable to number, narrow first
if type(u) == "table" then
    -- u narrowed to table here
end
```

## Nil 안전성

타입은 기본적으로 nullable이 아닙니다. 선택적 값에는 `?`를 사용합니다:

```lua
local x: number = nil         -- ERROR: nil not assignable to number
local y: number? = nil        -- OK: number? means "number or nil"
local z: number? = 42         -- OK
```

### 제어 흐름 좁히기

타입 검사기는 제어 흐름을 추적합니다:

```lua
local function process(x: number?): number
    if x ~= nil then
        return x              -- x is number here
    end
    return 0
end

-- Early return pattern
local user, err = get_user(123)
if err then return nil, err end
-- user narrowed to non-nil here

-- Or default
local val = get_value() or 0  -- val: number
```

## 유니온 타입

```lua
local val: number | string = get_value()

if type(val) == "number" then
    print(val + 1)            -- val: number
else
    print(val:upper())        -- val: string
end
```

### 리터럴 타입

```lua
type Status = "pending" | "active" | "done"

local s: Status = "pending"   -- OK
local s: Status = "invalid"   -- ERROR
```

## 함수 타입

```lua
local function add(a: number, b: number): number
    return a + b
end

-- Multiple returns
local function div_mod(a: number, b: number): (number, number)
    return math.floor(a / b), a % b
end

-- Error returns (Lua idiom)
local function fetch(url: string): (string?, error?)
    -- returns (data, nil) or (nil, error)
end

-- First-class function types
local double: (number) -> number = function(x: number): number
    return x * 2
end
```

### 가변 인자 함수

```lua
local function sum(...: number): number
    local total: number = 0
    for _, v in ipairs({...}) do
        total = total + v
    end
    return total
end
```

## 레코드 타입

```lua
type User = {name: string, age: number}

local u: User = {name = "alice", age = 25}
```

### 선택적 필드

```lua
type Config = {
    host: string,
    port: number,
    timeout?: number,
    debug?: boolean
}

local cfg: Config = {host = "localhost", port = 8080}  -- OK
```

## 제네릭

```lua
local function identity<T>(x: T): T
    return x
end

local n: number = identity(42)
local s: string = identity("hello")
```

### 제약된 제네릭

```lua
type HasName = {name: string}

local function greet<T: HasName>(obj: T): string
    return "Hello, " .. obj.name
end

greet({name = "Alice"})       -- OK
greet({age = 30})             -- ERROR: missing 'name'
```

## 인터섹션 타입

여러 타입을 결합합니다:

```lua
type Named = {name: string}
type Aged = {age: number}
type Person = Named & Aged

local p: Person = {name = "Alice", age = 30}
```

## 태그된 유니온

```lua
type Result<T, E> =
    {ok: true, value: T}
    | {ok: false, error: E}

type LoadState =
    {status: "loading"}
    | {status: "loaded", data: User}
    | {status: "error", message: string}

local function render(state: LoadState): string
    if state.status == "loading" then
        return "Loading..."
    elseif state.status == "loaded" then
        return "Hello, " .. state.data.name
    elseif state.status == "error" then
        return "Error: " .. state.message
    end
end
```

## `never` 타입

`never`는 가능한 값이 없는 바텀 타입입니다.

```lua
function fail(msg: string): never
    error(msg)
end
```

## 오류 처리 패턴

검사기는 일반적인 Lua `value, error` 반환 패턴을 이해합니다.

```lua
local value, err = call()
if err then
    -- value is nil here
    return nil, err
end
-- value is non-nil here, err is nil
print(value)
```

## Non-Nil 단언

`!`를 사용하여 표현식이 nil이 아님을 단언합니다:

```lua
local user: User? = get_user()
local name = (user!).name            -- assert user is non-nil
```

`!`는 타입 검사기 전용 단언입니다. 타입을 non-nil로 좁히지만 런타임 검사를 내보내지 않습니다. 실제 값이 nil이면 뒤따르는 작업은 nil 인덱싱 같은 일반적인 오류로 실패합니다. 값이 nil일 수 없음을 알지만 타입 검사기가 증명할 수 없을 때 사용하세요.

## 타입 캐스트

### 런타임 검증

타입을 함수처럼 호출해 값을 검증합니다. 검증은 요청한 정적 타입으로 원래 값을 반환하며 값을 변환하거나 강제 변환하지 않습니다.

```lua
local data: any = get_json()
local user = User(data)              -- validates and returns User
local name = user.name               -- safe field access
```

프리미티브와 커스텀 타입에서 작동합니다:

```lua
local x: any = get_value()
local s = string(x)                  -- requires an existing string
local n = integer(x)                 -- requires an existing integer
local b = boolean(x)                 -- requires an existing boolean

type Point = {x: number, y: number}
local p = Point(data)                -- validates record structure
```

예를 들어 `string(42)`는 검증 오류를 발생시킵니다. 변환이 목적이라면 `tostring(42)`를 사용하세요.

### Type:is() 메서드

`Type:is`는 예외를 발생시키지 않고 검증하며 `(value, nil)` 또는 `(nil, error)`를 반환합니다.

```lua
type Point = {x: number, y: number}
local data: any = get_input()

local p, err = Point:is(data)
if p then
    local sum = p.x + p.y            -- p is valid Point
else
    return nil, err                  -- validation failed
end
```

결과는 조건문에서 좁혀집니다:

```lua
if Point:is(data) then
    local p: Point = data            -- data narrowed to Point
end
```

### 안전하지 않은 캐스트

체크되지 않은 캐스트에는 `::` 또는 `as`를 사용합니다:

```lua
local data: any = get_data()
local user = data :: User            -- no runtime check
local user = data as User            -- same as ::
```

신중하게 사용하세요. 안전하지 않은 캐스트는 검증을 우회하며 값이 타입과 일치하지 않으면 런타임 오류를 일으킬 수 있습니다.

## 타입 리플렉션

타입은 인트로스펙션 메서드가 있는 1급 값입니다.

### 종류와 이름

```lua
type NumberType = number
print(NumberType:kind())             -- "number"
print(Point:kind())                  -- "record"
print(Point:name())                  -- "Point"
```

### 레코드 필드

레코드 필드를 순회합니다:

```lua
type User = {name: string, age: number}

for name, typ in User:fields() do
    print(name, typ:kind())
end
-- name    string
-- age     number
```

개별 필드 타입에 접근:

```lua
local nameType = User.name           -- type of 'name' field
print(nameType:kind())               -- "string"
```

### 컬렉션 타입

```lua
type NumberArray = {number}
print(NumberArray:elem():kind())     -- "number"

type NumberMap = {[string]: number}
print(NumberMap:key():kind())        -- "string"
print(NumberMap:val():kind())        -- "number"
```

### 선택적 타입

```lua
type OptionalNumber = number?
print(OptionalNumber:kind())         -- "optional"
print(OptionalNumber:inner():kind()) -- "number"
```

### 유니온 타입

```lua
type Status = "pending" | "active" | "done"

for variant in Status:variants() do
    print(variant)
end
```

### 함수 타입

```lua
type Predicate = (number, string) -> boolean
for param in Predicate:params() do
    print(param:kind())
end
print(Predicate:ret():kind())        -- "boolean"
```

`typeof(expression)`은 런타임 리플렉션 함수가 아니라 타입 구문입니다. `type Config = typeof(default_config)` 같은 별칭에서 사용하며, 결과 별칭이 런타임 타입 값입니다.

### 타입 비교

```lua
type NumberType = number
type IntegerType = integer

print(NumberType == NumberType)      -- true
print(IntegerType <= NumberType)     -- true (subtype)
print(IntegerType < NumberType)      -- true (strict subtype)
```

### 테이블 키로서의 타입

```lua
type NumberType = number
type StringType = string

local handlers = {}
handlers[NumberType] = function() return "number handler" end
handlers[StringType] = function() return "string handler" end

local h = handlers[NumberType]
if h then h() end
```

## 타입 어노테이션

함수 시그니처에 타입을 추가합니다:

```lua
-- Parameter and return types
local function process(input: string): number
    return #input
end

-- Local variable types
local count: number = 0

-- Type aliases
type StringArray = {string}
type StringMap = {[string]: number}
```

## 타입 검증자

어노테이션으로 타입 별칭에 검증 제약을 연결한 다음 타입을 호출하거나 `Type:is()`를 사용해 런타임에 적용합니다.

```lua
type NonNegative = number @min(0)
type Percentage = number @min(0) @max(100)
type Email = string @pattern("^.+@.+$")

local x = NonNegative(1)
local percent, err = Percentage:is(50)
local email = Email("test@example.com")
```

로컬 변수의 어노테이션은 린터가 정적으로 검사합니다. 할당 시 자동 런타임 검사를 삽입하지 않으며, 타입 값이 값을 검증할 때 런타임 적용이 이루어집니다.

### 내장 검증자

| 검증자 | 적용 대상 | 예제 |
|-----------|------------|---------|
| `@min(n)` | number | `type Positive = number @min(1)` |
| `@max(n)` | number | `type Percentage = number @max(100)` |
| `@min_len(n)` | string, array | `type NonEmpty = string @min_len(1)` |
| `@max_len(n)` | string, array | `type ShortName = string @max_len(10)` |
| `@pattern(regex)` | string | `type Email = string @pattern("^.+@.+$")` |

### 레코드 필드 검증자

```lua
type User = {
    age: number @min(0) @max(150),
    name: string @min_len(1) @max_len(100)
}
```

### 배열 요소 검증자

```lua
local scores: {number @min(0) @max(100)} = {85, 90}
```

### 유니온 멤버 검증자

```lua
local id: number @min(1) | string @min_len(1) = 1
```

## 변성(Variance) 규칙

| 위치 | 변성 | 설명 |
|----------|----------|-------------|
| 읽기 전용 필드 | 공변 | 서브타입 사용 가능 |
| 가변 필드 | 준불변 | 일반적으로 불변이지만 새로운 리터럴과 refinement는 기본 타입으로 확장될 수 있음 |
| 함수 파라미터 | 반공변 | 슈퍼타입 사용 가능 |
| 함수 반환 | 공변 | 서브타입 사용 가능 |

## 서브타이핑

- `integer`는 `number`의 서브타입
- `never`는 모든 타입의 서브타입
- 모든 타입은 `any`의 서브타입
- 유니온 서브타이핑: `A`는 `A | B`의 서브타입

## 점진적 도입

타입은 점진적으로 추가할 수 있으며 타입이 없는 코드는 계속 작동합니다.

```lua
-- Existing code works unchanged
function old_function(x)
    return x + 1
end

-- New code gets types
function new_function(x: number): number
    return x + 1
end
```

유용한 시작점은 다음과 같습니다.

1. API 경계의 함수 시그니처
2. HTTP 핸들러 및 큐 컨슈머
3. 핵심 비즈니스 로직

## 타입 검사

다음 명령으로 타입 검사기를 실행합니다.

```bash
wippy lint
```

이 명령은 코드를 실행하지 않고 타입 오류를 보고합니다.
