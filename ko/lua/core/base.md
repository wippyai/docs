---
title: "표준 Lua 라이브러리"
description: "모든 Wippy 프로세스에서 자동으로 사용 가능한 핵심 Lua 라이브러리. require() 불필요."
---

# 표준 Lua 라이브러리
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

이 핵심 Lua 라이브러리는 모든 실행 가능한 Lua 엔트리에서 `require()` 없이 사용할 수 있습니다.

이 페이지는 API 참조입니다. 시그니처 블록은 사용 가능한 함수를 나열하고, 긴 블록은 완전한 엔트리가 아닌 독립적인 예제나 부분 패턴입니다. `check_health`와 `process_request` 같은 이름은 애플리케이션 콜백을 나타냅니다.

## 기본 제공 전역 함수

### 타입과 변환

```lua
type(value)         -- Returns: "nil", "number", "string", "boolean", "table", "function", "thread", "userdata"
tonumber(s [,base]) -- Convert to number, optional base (2-36)
tostring(value)     -- Convert to string, calls __tostring metamethod
```

### 어설션과 에러

```lua
assert(v [,msg])    -- Raises error if v is false/nil, returns v otherwise
error(msg [,level]) -- Raises error at specified stack level (default 1)
pcall(fn, ...)      -- Protected call, returns ok, result_or_error
xpcall(fn, errh)    -- Protected call with error handler function
```

### 테이블 순회

```lua
pairs(t)            -- Iterate all key-value pairs
ipairs(t)           -- Iterate array portion (1, 2, 3, ...)
next(t [,index])    -- Get next key-value pair after index
```

### 메타테이블

```lua
getmetatable(obj)       -- Get metatable (or __metatable field if protected)
setmetatable(t, mt)     -- Set metatable, returns t
```

### Raw 테이블 접근

메타메서드를 우회하여 직접 테이블 접근:

```lua
rawget(t, k)        -- Get t[k] without __index
rawset(t, k, v)     -- Set t[k]=v without __newindex
rawequal(a, b)      -- Compare without __eq
```

### 유틸리티

```lua
select(index, ...)  -- Return args from index onwards
select("#", ...)    -- Return number of args
unpack(t [,i [,j]]) -- Return t[i] through t[j] as multiple values
print(...)          -- Print values (uses structured logging in Wippy)
```

### 전역 변수

```lua
_G        -- The global environment table
_VERSION  -- Lua version string
```

## 테이블 조작

`table` 라이브러리는 제자리 배열 작업, 정렬, 연결 및 unpack을 제공합니다.

```lua
table.insert(t, [pos,] value)  -- pos에 값 삽입 (기본값: 끝)
table.remove(t [,pos])         -- pos의 요소 제거 및 반환 (기본값: 마지막)
table.concat(t [,sep [,i [,j]]]) -- 배열 요소를 구분자로 연결
table.sort(t [,comp])          -- 제자리 정렬, comp(a,b)는 a < b이면 true 반환
table.unpack(t [,i [,j]])      -- 테이블 요소를 다중 값으로 언팩
table.create(narr, nhash)      -- 배열과 해시 용량을 미리 할당한 테이블 생성
table.freeze(t)                -- 테이블을 불변으로 만들고 t 반환
table.isfrozen(t)              -- 테이블이 불변이면 true
```

```lua
local items = {"a", "b", "c"}

table.insert(items, "d")           -- {"a", "b", "c", "d"}
table.insert(items, 2, "x")        -- {"a", "x", "b", "c", "d"}
table.remove(items, 2)             -- {"a", "b", "c", "d"}, returns "x"

local csv = table.concat(items, ",")  -- "a,b,c,d"

table.sort(items, function(a, b)
    return a > b  -- Descending order
end)
```

## 문자열 작업

문자열 조작 함수. 문자열 값의 메서드로도 사용 가능:

### 패턴 매칭

```lua
string.find(s, pattern [,init [,plain]])   -- Find pattern, returns start, end, captures
string.match(s, pattern [,init])           -- Extract matching substring
string.gmatch(s, pattern)                  -- Iterator over all matches
string.gsub(s, pattern, repl [,n])         -- Replace matches, returns string, count
```

### 대소문자 변환

```lua
string.upper(s)   -- Convert to uppercase
string.lower(s)   -- Convert to lowercase
```

### 부분 문자열과 문자

```lua
string.sub(s, i [,j])      -- i부터 j까지 부분 문자열 (음수 인덱스는 끝에서부터)
string.len(s)              -- 문자열 길이 (또는 #s 사용)
string.byte(s [,i [,j]])   -- 문자의 숫자 코드
string.char(...)           -- 문자 코드에서 문자열 생성
string.rep(s, n)           -- 문자열을 n번 반복
string.reverse(s)          -- 문자열 뒤집기
```

### 포맷팅

```lua
string.format(fmt, ...)    -- Printf 스타일 포맷팅
string.pack(fmt, ...)      -- 값들을 바이너리 문자열로 패킹
string.unpack(fmt, s [,pos]) -- 바이너리 문자열을 언팩, 값들과 다음 위치 반환
string.packsize(fmt)       -- 패킹된 포맷의 바이트 크기
```

포맷 지정자: `%d` (정수), `%f` (부동소수), `%s` (문자열), `%q` (인용), `%x` (16진수), `%o` (8진수), `%e` (과학적), `%%` (리터럴 %)

```lua
local s = "Hello, World!"

-- Pattern matching
local start, stop = string.find(s, "World")  -- 8, 12
local word = string.match(s, "%w+")          -- "Hello"

-- Substitution
local new = string.gsub(s, "World", "Wippy") -- "Hello, Wippy!"

-- Method syntax
local upper = s:upper()                       -- "HELLO, WORLD!"
local part = s:sub(1, 5)                      -- "Hello"
```

### 패턴

| 패턴 | 매칭 |
|------|------|
| `.` | 모든 문자 |
| `%a` | 문자 |
| `%d` | 숫자 |
| `%w` | 알파뉴메릭 |
| `%s` | 공백 |
| `%p` | 구두점 |
| `%c` | 제어 문자 |
| `%x` | 16진수 숫자 |
| `%z` | 제로 (null) |
| `[set]` | 문자 클래스 |
| `[^set]` | 부정 클래스 |
| `*` | 0개 이상 (탐욕적) |
| `+` | 1개 이상 (탐욕적) |
| `-` | 0개 이상 (게으른) |
| `?` | 0개 또는 1개 |
| `^` | 문자열 시작 |
| `$` | 문자열 끝 |
| `%b()` | 균형 잡힌 쌍 |
| `(...)` | 캡처 그룹 |

대문자 버전 (`%A`, `%D` 등)은 보수를 매칭합니다.

## Math 함수

`math` 라이브러리는 숫자 상수와 일반적인 수학 연산을 제공합니다.

### 상수 {id="math-constants"}

```lua
math.pi       -- 3.14159...
math.huge     -- 표현 가능한 가장 큰 부동소수점 값
math.mininteger  -- 최소 정수
math.maxinteger  -- 최대 정수
```

### 기본 연산

```lua
math.abs(x)           -- Absolute value
math.min(...)         -- Minimum of arguments
math.max(...)         -- Maximum of arguments
math.floor(x)         -- Round down
math.ceil(x)          -- Round up
math.modf(x)          -- Integer and fractional parts
math.fmod(x, y)       -- Floating-point remainder
```

### 거듭제곱과 루트

```lua
math.sqrt(x)          -- Square root
math.pow(x, y)        -- x^y (or use x^y operator)
math.exp(x)           -- e^x
math.log(x)           -- 자연 로그
math.log10(x)         -- 상용 로그 (밑 10)
math.frexp(x)         -- 가수와 지수
math.ldexp(m, e)      -- m * 2^e
```

### 삼각함수

```lua
math.sin(x)   math.cos(x)   math.tan(x)    -- 라디안
math.asin(x)  math.acos(x)  math.atan(x)
math.atan2(y, x)                            -- y/x의 아크탄젠트
math.sinh(x)  math.cosh(x)  math.tanh(x)   -- 쌍곡선
math.deg(r)   -- 라디안을 도로
math.rad(d)   -- 도를 라디안으로
```

### 난수

```lua
math.random()         -- [0,1) 랜덤 부동소수
math.random(n)        -- [1,n] 랜덤 정수
math.random(m, n)     -- [m,n] 랜덤 정수
math.randomseed(x)    -- 효과 없음; 생성기는 자동으로 시드됨
```

`math.random`은 비결정적입니다. 워크플로우에서 동일하게 재생해야 하는 결정에는 사용하지 마세요. `math.randomseed`로도 결정론적으로 만들 수 없습니다.

### 타입 변환

```lua
math.tointeger(x)     -- Convert to integer or nil
math.type(x)          -- "integer", "float", or nil
math.ult(m, n)        -- Unsigned less-than comparison
```

## 코루틴

`coroutine` 라이브러리는 코루틴 생성과 제어를 제공합니다. 채널 기반 동시성 패턴은 [채널과 코루틴](lua/core/channel.md)을 참조하세요.

```lua
coroutine.create(fn)        -- Create coroutine from function
coroutine.resume(co, ...)   -- Start/continue coroutine
coroutine.yield(...)        -- Suspend coroutine, return values to resume
coroutine.status(co)        -- "running", "suspended", "normal", "dead"
coroutine.running()         -- Current coroutine (nil if main thread)
coroutine.wrap(fn)          -- Create coroutine as callable function
```

### 동시 코루틴 스폰

Wippy는 스케줄러가 관리하는 동시 작업을 위한 `coroutine.spawn`을 추가합니다.

```lua
coroutine.spawn(fn)         -- Spawn function as concurrent coroutine
```

```lua
local time = require("time")

-- Spawn background task
coroutine.spawn(function()
    while true do
        check_health()
        time.sleep("30s")
    end
end)

-- Continue main execution immediately
process_request()
```

이 부분 패턴은 엔트리의 `modules:`에 `time`이 있고 `check_health`와 `process_request` 함수를 제공한다고 가정합니다. 스폰된 코루틴은 같은 Lua 프로세스에서 동시에 실행됩니다. `process_request()`에는 즉시 도달하고 각 상태 확인 뒤 30초 동안 sleep합니다.

## 에러 처리

전역 `errors` 테이블은 구조화된 오류를 만들고 분류합니다. 전체 API는 [에러 처리](lua/core/errors.md)를 참조하세요.

### 상수 {id="error-constants"}

```lua
errors.UNKNOWN           -- Unclassified error
errors.INVALID           -- Invalid argument or input
errors.NOT_FOUND         -- Resource not found
errors.ALREADY_EXISTS    -- Resource already exists
errors.PERMISSION_DENIED -- Permission denied
errors.TIMEOUT           -- Operation timed out
errors.CANCELED          -- Operation cancelled
errors.UNAVAILABLE       -- Service unavailable
errors.INTERNAL          -- Internal error
errors.CONFLICT          -- Conflict (e.g., concurrent modification)
errors.RATE_LIMITED      -- Rate limit exceeded
```

### 함수 {id="error-functions"}

```lua
-- Create error from string
local err = errors.new("something went wrong")

-- Create error with metadata
local err = errors.new({
    message = "User not found",
    kind = errors.NOT_FOUND,
    retryable = false,
    details = {user_id = 123}
})

-- Wrap existing error with context
local wrapped = errors.wrap(err, "failed to load profile")

-- Check error kind
if errors.is(err, errors.NOT_FOUND) then
    -- handle not found
end

-- Get call stack from error
local stack = errors.call_stack(err)
```

### 에러 메서드

```lua
err:message()    -- 에러 메시지 문자열 가져오기
err:kind()       -- 에러 종류 가져오기 (예: "NOT_FOUND")
err:retryable()  -- true, false, 또는 nil (알 수 없음)
err:details()    -- 상세 테이블 또는 nil 가져오기
err:stack()      -- 스택 트레이스를 문자열로 가져오기
```

## 제한된 기능

보안을 위해 다음 표준 Lua 기능은 사용 불가:

| 기능 | 대안 |
|------|------|
| `load`, `loadstring`, `loadfile`, `dofile` | [동적 평가](lua/dynamic/eval.md) 모듈 사용 |
| `collectgarbage` | 자동 GC |
| `rawlen` | `#` 연산자 사용 |
| 표준 `io.*` 파일 라이브러리 | [파일 시스템](lua/storage/filesystem.md) 모듈 사용; Wippy의 `io` 모듈은 [터미널 I/O](lua/system/io.md)입니다 |
| `os.execute`, `os.exit`, `os.getenv`, `os.remove`, `os.rename`, `os.tmpname` | [명령 실행](lua/dynamic/exec.md), [환경](lua/system/env.md) 모듈 사용 |
| `string.dump` | 사용 불가 |
| `debug.*` | 사용 불가 |
| `utf8.*` | 사용 불가 |
| `package.loadlib` | 네이티브 라이브러리 미지원 |

## 참고

- [채널과 코루틴](lua/core/channel.md) - 동시성을 위한 Go 스타일 채널
- [에러 처리](lua/core/errors.md) - 구조화된 에러 생성 및 처리
- [OS 시간](lua/system/ostime.md) - 시스템 시간 함수
