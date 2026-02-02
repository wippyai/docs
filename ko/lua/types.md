# 타입 시스템

Wippy는 흐름 감지 검사를 갖춘 점진적 타입 시스템을 포함합니다. 타입은 기본적으로 null을 허용하지 않습니다.

## 프리미티브

```lua
local n: number = 3.14
local i: integer = 42         -- integer는 number의 서브타입
local s: string = "hello"
local b: boolean = true
local a: any = "anything"     -- 명시적 동적 타입 (검사 제외)
local u: unknown = something  -- 사용 전 좁혀야 함
```

### any vs unknown

```lua
-- any: 타입 검사 제외
local a: any = get_data()
a.foo.bar.baz()              -- 에러 없음, 런타임에 크래시 가능

-- unknown: 안전한 unknown, 사용 전 좁혀야 함
local u: unknown = get_data()
u.foo                        -- 에러: unknown의 속성에 접근 불가
if type(u) == "table" then
    -- u가 여기서 table로 좁혀짐
end
```

## Nil 안전성

타입은 기본적으로 null을 허용하지 않습니다. 선택적 값에는 `?`를 사용합니다:

```lua
local x: number = nil         -- 에러: nil은 number에 할당 불가
local y: number? = nil        -- OK: number?는 "number 또는 nil"을 의미
local z: number? = 42         -- OK
```

### 제어 흐름 좁히기

타입 검사기는 제어 흐름을 추적합니다:

```lua
local function process(x: number?): number
    if x ~= nil then
        return x              -- x는 여기서 number
    end
    return 0
end

-- 조기 반환 패턴
local user, err = get_user(123)
if err then return nil, err end
-- user가 여기서 non-nil로 좁혀짐

-- 또는 기본값
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
local s: Status = "invalid"   -- 에러
```

## 함수 타입

```lua
local function add(a: number, b: number): number
    return a + b
end

-- 다중 반환
local function div_mod(a: number, b: number): (number, number)
    return math.floor(a / b), a % b
end

-- 에러 반환 (Lua 관용구)
local function fetch(url: string): (string?, error?)
    -- (data, nil) 또는 (nil, error) 반환
end

-- 일급 함수 타입
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

### 제약이 있는 제네릭

```lua
type HasName = {name: string}

local function greet<T: HasName>(obj: T): string
    return "Hello, " .. obj.name
end

greet({name = "Alice"})       -- OK
greet({age = 30})             -- 에러: 'name' 누락
```

## 교차 타입

여러 타입을 결합합니다:

```lua
type Named = {name: string}
type Aged = {age: number}
type Person = Named & Aged

local p: Person = {name = "Alice", age = 30}
```

## 태그드 유니온

```lua
type Result<T, E> =
    | {ok: true, value: T}
    | {ok: false, error: E}

type LoadState =
    | {status: "loading"}
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

## never 타입

`never`는 바텀 타입입니다 - 존재하는 값이 없습니다:

```lua
function fail(msg: string): never
    error(msg)
end
```

## 에러 처리 패턴

검사기는 Lua 에러 관용구를 이해합니다:

```lua
local value, err = call()
if err then
    -- value는 여기서 nil
    return nil, err
end
-- value는 여기서 non-nil, err는 nil
print(value)
```

## Non-Nil 어설션

표현식이 non-nil임을 어설트하려면 `!`를 사용합니다:

```lua
local user: User? = get_user()
local name = user!.name              -- user가 non-nil임을 어설트
```

런타임에 값이 nil이면 에러가 발생합니다. 값이 nil이 아님을 알지만 타입 검사기가 증명할 수 없을 때 사용합니다.

## 타입 캐스트

### 안전한 캐스트 (검증)

타입을 함수로 호출하여 검증하고 캐스트합니다:

```lua
local data: any = get_json()
local user = User(data)              -- 검증하고 User 반환
local name = user.name               -- 안전한 필드 접근
```

프리미티브와 커스텀 타입에 사용 가능합니다:

```lua
local x: any = get_value()
local s = string(x)                  -- string으로 캐스트
local n = integer(x)                 -- integer로 캐스트
local b = boolean(x)                 -- boolean으로 캐스트

type Point = {x: number, y: number}
local p = Point(data)                -- 레코드 구조 검증
```

### Type:is() 메서드

throw 없이 검증, `(value, nil)` 또는 `(nil, error)` 반환:

```lua
type Point = {x: number, y: number}
local data: any = get_input()

local p, err = Point:is(data)
if p then
    local sum = p.x + p.y            -- p는 유효한 Point
else
    return nil, err                  -- 검증 실패
end
```

결과는 조건문에서 좁혀집니다:

```lua
if Point:is(data) then
    local p: Point = data            -- data가 Point로 좁혀짐
end
```

### 안전하지 않은 캐스트

검사되지 않는 캐스트에는 `::`또는 `as`를 사용합니다:

```lua
local data: any = get_data()
local user = data :: User            -- 런타임 검사 없음
local user = data as User            -- ::와 동일
```

주의해서 사용하세요. 안전하지 않은 캐스트는 검증을 우회하며 값이 타입과 일치하지 않으면 런타임 에러가 발생할 수 있습니다.

## 타입 리플렉션

타입은 인트로스펙션 메서드를 가진 일급 값입니다.

### Kind와 Name

```lua
print(Number:kind())                 -- "number"
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

개별 필드 타입에 접근합니다:

```lua
local nameType = User.name           -- 'name' 필드의 타입
print(nameType:kind())               -- "string"
```

### 컬렉션 타입

```lua
local arr: {number} = {1, 2, 3}
local arrType = typeof(arr)
print(arrType:elem():kind())         -- "number"

local map: {[string]: number} = {}
local mapType = typeof(map)
print(mapType:key():kind())          -- "string"
print(mapType:val():kind())          -- "number"
```

### 선택적 타입

```lua
local opt: number? = nil
local optType = typeof(opt)
print(optType:kind())                -- "optional"
print(optType:inner():kind())        -- "number"
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
local fn: (number, string) -> boolean

local fnType = typeof(fn)
for param in fnType:params() do
    print(param:kind())
end
print(fnType:ret():kind())           -- "boolean"
```

### 타입 비교

```lua
print(Number == Number)              -- true
print(Integer <= Number)             -- true (서브타입)
print(Integer < Number)              -- true (엄격한 서브타입)
```

### 테이블 키로서의 타입

```lua
local handlers = {}
handlers[Number] = function() return "number handler" end
handlers[String] = function() return "string handler" end

local h = handlers[typeof(value)]
if h then h() end
```

## 타입 어노테이션

함수 시그니처에 타입을 추가합니다:

```lua
-- 파라미터와 반환 타입
local function process(input: string): number
    return #input
end

-- 로컬 변수 타입
local count: number = 0

-- 타입 별칭
type StringArray = {string}
type StringMap = {[string]: number}
```

## 타입 검증기

어노테이션을 사용하여 타입에 런타임 검증 제약을 추가합니다:

```lua
-- 단일 검증기
local x: number @min(0) = 1

-- 다중 검증기
local x: number @min(0) @max(100) = 50

-- 문자열 패턴
local email: string @pattern("^.+@.+$") = "test@example.com"

-- 인자 없는 검증기
local x: number @integer = 42
```

### 내장 검증기

| 검증기 | 적용 대상 | 예제 |
|--------|----------|------|
| `@min(n)` | number | `local x: number @min(0) = 1` |
| `@max(n)` | number | `local x: number @max(100) = 50` |
| `@min_len(n)` | string, array | `local s: string @min_len(1) = "hi"` |
| `@max_len(n)` | string, array | `local s: string @max_len(10) = "hi"` |
| `@pattern(regex)` | string | `local email: string @pattern("^.+@.+$") = "a@b.com"` |

### 레코드 필드 검증기

```lua
type User = {
    age: number @min(0) @max(150),
    name: string @min_len(1) @max_len(100)
}
```

### 배열 요소 검증기

```lua
local scores: {number @min(0) @max(100)} = {85, 90}
```

### 유니온 멤버 검증기

```lua
local id: number @min(1) | string @min_len(1) = 1
```

## 분산 규칙

| 위치 | 분산 | 설명 |
|------|------|------|
| 읽기 전용 필드 | 공변 | 서브타입 사용 가능 |
| 가변 필드 | 불변 | 정확히 일치해야 함 |
| 함수 파라미터 | 반공변 | 수퍼타입 사용 가능 |
| 함수 반환 | 공변 | 서브타입 사용 가능 |

## 서브타이핑

- `integer`는 `number`의 서브타입
- `never`는 모든 타입의 서브타입
- 모든 타입은 `any`의 서브타입
- 유니온 서브타이핑: `A`는 `A | B`의 서브타입

## 점진적 도입

타입을 점진적으로 추가합니다 - 타입이 없는 코드는 계속 작동합니다:

```lua
-- 기존 코드는 변경 없이 작동
function old_function(x)
    return x + 1
end

-- 새 코드에 타입 추가
function new_function(x: number): number
    return x + 1
end
```

타입 추가를 시작할 곳:
1. API 경계의 함수 시그니처
2. HTTP 핸들러와 큐 컨슈머
3. 중요한 비즈니스 로직

## 타입 검사

타입 검사기를 실행합니다:

```bash
wippy lint
```

코드를 실행하지 않고 타입 에러를 보고합니다.
