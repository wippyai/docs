# 표준 Lua 라이브러리
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

모든 Wippy 프로세스에서 자동으로 사용 가능한 핵심 Lua 라이브러리. `require()` 불필요.

## 전역 함수

### 타입과 변환

```lua
type(value)         -- 반환: "nil", "number", "string", "boolean", "table", "function", "thread", "userdata"
tonumber(s [,base]) -- 숫자로 변환, 선택적 진법 (2-36)
tostring(value)     -- 문자열로 변환, __tostring 메타메서드 호출
```

### 어설션과 에러

```lua
assert(v [,msg])    -- v가 false/nil이면 에러 발생, 그렇지 않으면 v 반환
error(msg [,level]) -- 지정된 스택 레벨에서 에러 발생 (기본값 1)
pcall(fn, ...)      -- 보호된 호출, ok, result_or_error 반환
xpcall(fn, errh)    -- 에러 핸들러 함수가 있는 보호된 호출
```

### 테이블 순회

```lua
pairs(t)            -- 모든 키-값 쌍 순회
ipairs(t)           -- 배열 부분 순회 (1, 2, 3, ...)
next(t [,index])    -- index 다음의 키-값 쌍 가져오기
```

### 메타테이블

```lua
getmetatable(obj)       -- 메타테이블 가져오기 (보호되면 __metatable 필드)
setmetatable(t, mt)     -- 메타테이블 설정, t 반환
```

### Raw 테이블 접근

메타메서드를 우회하여 직접 테이블 접근:

```lua
rawget(t, k)        -- __index 없이 t[k] 가져오기
rawset(t, k, v)     -- __newindex 없이 t[k]=v 설정
rawequal(a, b)      -- __eq 없이 비교
```

### 유틸리티

```lua
select(index, ...)  -- index부터 인자 반환
select("#", ...)    -- 인자 개수 반환
unpack(t [,i [,j]]) -- t[i]부터 t[j]까지를 다중 값으로 반환
print(...)          -- 값 출력 (Wippy에서 구조화된 로깅 사용)
```

### 전역 변수

```lua
_G        -- 전역 환경 테이블
_VERSION  -- Lua 버전 문자열
```

## 테이블 조작

테이블 수정 함수:

```lua
table.insert(t, [pos,] value)  -- pos에 값 삽입 (기본값: 끝)
table.remove(t [,pos])         -- pos의 요소 제거 및 반환 (기본값: 마지막)
table.concat(t [,sep [,i [,j]]]) -- 배열 요소를 구분자로 연결
table.sort(t [,comp])          -- 제자리 정렬, comp(a,b)는 a < b이면 true 반환
table.pack(...)                -- varargs를 'n' 필드가 있는 테이블로 팩
table.unpack(t [,i [,j]])      -- 테이블 요소를 다중 값으로 언팩
```

```lua
local items = {"a", "b", "c"}

table.insert(items, "d")           -- {"a", "b", "c", "d"}
table.insert(items, 2, "x")        -- {"a", "x", "b", "c", "d"}
table.remove(items, 2)             -- {"a", "b", "c", "d"}, "x" 반환

local csv = table.concat(items, ",")  -- "a,b,c,d"

table.sort(items, function(a, b)
    return a > b  -- 내림차순
end)
```

## 문자열 작업

문자열 조작 함수. 문자열 값의 메서드로도 사용 가능:

### 패턴 매칭

```lua
string.find(s, pattern [,init [,plain]])   -- 패턴 찾기, start, end, captures 반환
string.match(s, pattern [,init])           -- 매칭되는 부분 문자열 추출
string.gmatch(s, pattern)                  -- 모든 매치에 대한 이터레이터
string.gsub(s, pattern, repl [,n])         -- 매치 대체, 문자열, count 반환
```

### 대소문자 변환

```lua
string.upper(s)   -- 대문자로 변환
string.lower(s)   -- 소문자로 변환
```

### 부분 문자열과 문자

```lua
string.sub(s, i [,j])      -- i부터 j까지 부분 문자열 (음수 인덱스는 끝에서부터)
string.len(s)              -- 문자열 길이 (또는 #s 사용)
string.byte(s [,i [,j]])   -- 문자의 숫자 코드
string.char(...)           -- 문자 코드에서 문자열 생성
string.rep(s, n [,sep])    -- 문자열을 구분자와 함께 n번 반복
string.reverse(s)          -- 문자열 뒤집기
```

### 포맷팅

```lua
string.format(fmt, ...)    -- Printf 스타일 포맷팅
```

포맷 지정자: `%d` (정수), `%f` (부동소수), `%s` (문자열), `%q` (인용), `%x` (16진수), `%o` (8진수), `%e` (과학적), `%%` (리터럴 %)

```lua
local s = "Hello, World!"

-- 패턴 매칭
local start, stop = string.find(s, "World")  -- 8, 12
local word = string.match(s, "%w+")          -- "Hello"

-- 대체
local new = string.gsub(s, "World", "Wippy") -- "Hello, Wippy!"

-- 메서드 구문
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

수학 함수와 상수:

### 상수 {id="math-constants"}

```lua
math.pi       -- 3.14159...
math.huge     -- 무한대
math.mininteger  -- 최소 정수
math.maxinteger  -- 최대 정수
```

### 기본 연산

```lua
math.abs(x)           -- 절대값
math.min(...)         -- 인자 중 최소값
math.max(...)         -- 인자 중 최대값
math.floor(x)         -- 내림
math.ceil(x)          -- 올림
math.modf(x)          -- 정수와 소수 부분
math.fmod(x, y)       -- 부동소수 나머지
```

### 거듭제곱과 루트

```lua
math.sqrt(x)          -- 제곱근
math.pow(x, y)        -- x^y (또는 x^y 연산자 사용)
math.exp(x)           -- e^x
math.log(x [,base])   -- 자연 로그 (또는 base n 로그)
```

### 삼각함수

```lua
math.sin(x)   math.cos(x)   math.tan(x)    -- 라디안
math.asin(x)  math.acos(x)  math.atan(y [,x])
math.sinh(x)  math.cosh(x)  math.tanh(x)   -- 쌍곡선
math.deg(r)   -- 라디안을 도로
math.rad(d)   -- 도를 라디안으로
```

### 난수

```lua
math.random()         -- [0,1) 랜덤 부동소수
math.random(n)        -- [1,n] 랜덤 정수
math.random(m, n)     -- [m,n] 랜덤 정수
math.randomseed(x)    -- 랜덤 시드 설정
```

### 타입 변환

```lua
math.tointeger(x)     -- 정수로 변환 또는 nil
math.type(x)          -- "integer", "float", 또는 nil
math.ult(m, n)        -- 부호 없는 미만 비교
```

## 코루틴

코루틴 생성과 제어. 채널과 동시 패턴은 [채널과 코루틴](lua/core/channel.md) 참조:

```lua
coroutine.create(fn)        -- 함수에서 코루틴 생성
coroutine.resume(co, ...)   -- 코루틴 시작/계속
coroutine.yield(...)        -- 코루틴 중단, resume에 값 반환
coroutine.status(co)        -- "running", "suspended", "normal", "dead"
coroutine.running()         -- 현재 코루틴 (메인 스레드면 nil)
coroutine.wrap(fn)          -- 호출 가능한 함수로 코루틴 생성
```

### 동시 코루틴 스폰

독립적으로 실행되는 동시 코루틴 스폰 (Wippy 전용):

```lua
coroutine.spawn(fn)         -- 함수를 동시 코루틴으로 스폰
```

```lua
-- 백그라운드 작업 스폰
coroutine.spawn(function()
    while true do
        check_health()
        time.sleep("30s")
    end
end)

-- 메인 실행 즉시 계속
process_request()
```

## 에러 처리

구조화된 에러 생성과 분류. 전체 문서는 [에러 처리](lua/core/errors.md) 참조:

### 상수 {id="error-constants"}

```lua
errors.UNKNOWN           -- 분류되지 않은 에러
errors.INVALID           -- 잘못된 인자 또는 입력
errors.NOT_FOUND         -- 리소스를 찾을 수 없음
errors.ALREADY_EXISTS    -- 리소스가 이미 존재
errors.PERMISSION_DENIED -- 권한 거부됨
errors.TIMEOUT           -- 작업 시간 초과
errors.CANCELED          -- 작업 취소됨
errors.UNAVAILABLE       -- 서비스 사용 불가
errors.INTERNAL          -- 내부 에러
errors.CONFLICT          -- 충돌 (예: 동시 수정)
errors.RATE_LIMITED      -- 속도 제한 초과
```

### 함수 {id="error-functions"}

```lua
-- 문자열에서 에러 생성
local err = errors.new("something went wrong")

-- 메타데이터가 있는 에러 생성
local err = errors.new({
    message = "User not found",
    kind = errors.NOT_FOUND,
    retryable = false,
    details = {user_id = 123}
})

-- 컨텍스트와 함께 기존 에러 래핑
local wrapped = errors.wrap(err, "failed to load profile")

-- 에러 종류 확인
if errors.is(err, errors.NOT_FOUND) then
    -- not found 처리
end

-- 에러에서 호출 스택 가져오기
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

## UTF-8 유니코드

유니코드 UTF-8 문자열 처리:

### 상수 {id="utf8-constants"}

```lua
utf8.charpattern  -- 단일 UTF-8 문자에 매칭하는 패턴
```

### 함수 {id="utf8-functions"}

```lua
utf8.char(...)           -- 유니코드 코드포인트에서 문자열 생성
utf8.codes(s)            -- 코드포인트에 대한 이터레이터: for pos, code in utf8.codes(s)
utf8.codepoint(s [,i [,j]]) -- 위치 i부터 j까지의 코드포인트 가져오기
utf8.len(s [,i [,j]])    -- UTF-8 문자 수 (바이트 아님)
utf8.offset(s, n [,i])   -- 위치 i에서 n번째 문자의 바이트 위치
```

```lua
local s = "Hello, 세계"

-- 문자 수 (바이트 아님)
print(utf8.len(s))  -- 9

-- 코드포인트 순회
for pos, code in utf8.codes(s) do
    print(pos, code, utf8.char(code))
end

-- 위치의 코드포인트 가져오기
local code = utf8.codepoint(s, 8)  -- 첫 번째 한글 문자

-- 코드포인트에서 문자열 생성
local emoji = utf8.char(0x1F600)  -- 웃는 얼굴
```

## 제한된 기능

보안을 위해 다음 표준 Lua 기능은 사용 불가:

| 기능 | 대안 |
|------|------|
| `load`, `loadstring`, `loadfile`, `dofile` | [동적 평가](lua/dynamic/eval.md) 모듈 사용 |
| `collectgarbage` | 자동 GC |
| `rawlen` | `#` 연산자 사용 |
| `io.*` | [파일 시스템](lua/storage/filesystem.md) 모듈 사용 |
| `os.execute`, `os.exit`, `os.remove`, `os.rename`, `os.tmpname` | [명령 실행](lua/dynamic/exec.md), [환경](lua/system/env.md) 모듈 사용 |
| `debug.*` (traceback 제외) | 사용 불가 |
| `package.loadlib` | 네이티브 라이브러리 미지원 |

## 참고

- [채널과 코루틴](lua/core/channel.md) - 동시성을 위한 Go 스타일 채널
- [에러 처리](lua/core/errors.md) - 구조화된 에러 생성 및 처리
- [OS 시간](lua/system/ostime.md) - 시스템 시간 함수
