# OS 시간
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

표준 Lua `os` 시간 함수입니다. 타임스탬프, 날짜 포맷팅, 시간 계산을 위한 실제 벽시계 시간을 제공합니다.

## 로딩

전역 `os` 테이블. require가 필요 없습니다.

```lua
os.time()
os.date()
os.clock()
os.difftime()
```

## 타임스탬프 가져오기

Unix 타임스탬프 (1970년 1월 1일 UTC 이후 초) 가져오기:

```lua
-- 현재 타임스탬프
local now = os.time()  -- 1718462445

-- 특정 날짜/시간
local t = os.time({
    year = 2024,
    month = 12,
    day = 25,
    hour = 10,
    min = 30,
    sec = 0
})
```

**시그니처:** `os.time([spec]) -> integer`

**파라미터:**

| 필드 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `year` | integer | 현재 연도 | 4자리 연도 (예: 2024) |
| `month` | integer | 현재 월 | 월 1-12 |
| `day` | integer | 현재 일 | 월의 일 1-31 |
| `hour` | integer | 0 | 시 0-23 |
| `min` | integer | 0 | 분 0-59 |
| `sec` | integer | 0 | 초 0-59 |

인수 없이 호출하면 현재 Unix 타임스탬프를 반환합니다.

테이블과 함께 호출하면 누락된 필드는 위에 표시된 기본값을 사용합니다. `year`, `month`, `day` 필드는 지정되지 않으면 현재 날짜가 기본값입니다.

```lua
-- 날짜만 (시간은 자정이 기본값)
os.time({year = 2024, month = 6, day = 15})

-- 부분 지정 (현재 연도/월 사용)
os.time({day = 1})  -- 현재 월의 1일
```

## 날짜 포맷팅

타임스탬프를 문자열로 포맷하거나 날짜 테이블을 반환합니다:

<code-block lang="lua">
local now = os.time()

-- 기본 포맷
os.date()  -- "Sat Jun 15 14:30:45 2024"

-- 커스텀 포맷
os.date("%Y-%m-%d", now)           -- "2024-06-15"
os.date("%H:%M:%S", now)           -- "14:30:45"
os.date("%Y-%m-%dT%H:%M:%S", now)  -- "2024-06-15T14:30:45"

-- UTC 시간 (포맷 앞에 ! 접두사)
os.date("!%Y-%m-%d %H:%M:%S", now)  -- 로컬 대신 UTC

-- 날짜 테이블
local t = os.date("*t", now)
</code-block>

**시그니처:** `os.date([format], [timestamp]) -> string | table`

| 파라미터 | 타입 | 기본값 | 설명 |
|----------|------|--------|------|
| `format` | string | `"%c"` | 포맷 문자열, 테이블용 `"*t"` |
| `timestamp` | integer | 현재 시간 | 포맷할 Unix 타임스탬프 |

### 포맷 지정자

| 코드 | 출력 | 예시 |
|------|------|------|
| `%Y` | 4자리 연도 | 2024 |
| `%y` | 2자리 연도 | 24 |
| `%m` | 월 (01-12) | 06 |
| `%d` | 일 (01-31) | 15 |
| `%H` | 시 24시간 (00-23) | 14 |
| `%I` | 시 12시간 (01-12) | 02 |
| `%M` | 분 (00-59) | 30 |
| `%S` | 초 (00-59) | 45 |
| `%p` | AM/PM | PM |
| `%A` | 요일 이름 | Saturday |
| `%a` | 요일 약어 | Sat |
| `%B` | 월 이름 | June |
| `%b` | 월 약어 | Jun |
| `%w` | 요일 (0-6, 일요일=0) | 6 |
| `%j` | 연중 일 (001-366) | 167 |
| `%U` | 주 번호 (00-53) | 24 |
| `%z` | 시간대 오프셋 | -0700 |
| `%Z` | 시간대 이름 | PDT |
| `%c` | 전체 날짜/시간 | Sat Jun 15 14:30:45 2024 |
| `%x` | 날짜만 | 06/15/24 |
| `%X` | 시간만 | 14:30:45 |
| `%%` | 리터럴 % | % |

### 날짜 테이블

포맷이 `"*t"`일 때 테이블을 반환합니다:

```lua
local t = os.date("*t")
```

| 필드 | 타입 | 설명 | 예시 |
|------|------|------|------|
| `year` | integer | 4자리 연도 | 2024 |
| `month` | integer | 월 (1-12) | 6 |
| `day` | integer | 월의 일 (1-31) | 15 |
| `hour` | integer | 시 (0-23) | 14 |
| `min` | integer | 분 (0-59) | 30 |
| `sec` | integer | 초 (0-59) | 45 |
| `wday` | integer | 요일 (1-7, 일요일=1) | 7 |
| `yday` | integer | 연중 일 (1-366) | 167 |
| `isdst` | boolean | 일광 절약 시간 | false |

UTC 날짜 테이블은 `"!*t"`를 사용하세요.

## 경과 시간 측정

Lua 런타임 시작 이후 경과된 초를 가져옵니다:

```lua
local start = os.clock()

-- 작업 수행
for i = 1, 1000000 do end

local elapsed = os.clock() - start
print(string.format("Took %.3f seconds", elapsed))
```

**시그니처:** `os.clock() -> number`

## 시간 차이

두 타임스탬프 간의 차이를 초 단위로 가져옵니다:

```lua
local t1 = os.time({year = 2024, month = 1, day = 1})
local t2 = os.time({year = 2024, month = 12, day = 31})

local diff = os.difftime(t2, t1)  -- t2 - t1
local days = diff / 86400
print(days)  -- 365
```

**시그니처:** `os.difftime(t2, t1) -> number`

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `t2` | integer | 나중 타임스탬프 |
| `t1` | integer | 이전 타임스탬프 |

`t2 - t1`을 초 단위로 반환합니다. `t1 > t2`이면 음수가 될 수 있습니다.

## 플랫폼 상수

런타임을 식별하는 상수:

```lua
os.platform  -- "wippy"
```
