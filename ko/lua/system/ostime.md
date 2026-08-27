---
title: "OS 시간"
description: "Lua global os table로 runtime time을 읽고 date를 format하며 time difference를 계산합니다."
---

# OS 시간
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

global `os` table은 timestamp, date formatting, elapsed-time measurement, time-difference calculation을 제공합니다. workflow에서 current-time read는 workflow time reference를 사용하고, workflow 밖에서는 system clock을 사용합니다.

이 페이지는 API reference입니다. timestamp literal과 formatted output은 예시이며 current value는 runtime 또는 workflow clock과 timezone에 따라 달라집니다.

## 로딩

`os` table은 global이며 `require`로 load할 필요가 없습니다.

```lua
os.time()
os.date()
os.clock()
os.difftime()
```

## 타임스탬프 가져오기

Unix 타임스탬프 (1970년 1월 1일 UTC 이후 초) 가져오기:

```lua
-- Current timestamp
local now = os.time()  -- 1718462445

-- Specific date/time
local t = os.time({
    year = 2024,
    month = 12,
    day = 25,
    hour = 10,
    min = 30,
    sec = 0
})
```

**시그니처:** `os.time([spec]) -> number`

**파라미터:**

| 필드 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `year` | number | 현재 연도 | 4자리 연도 (예: 2024) |
| `month` | number | 현재 월 | 월 1-12 |
| `day` | number | 현재 일 | 월의 일 1-31 |
| `hour` | number | 0 | 시 0-23 |
| `min` | number | 0 | 분 0-59 |
| `sec` | number | 0 | 초 0-59 |

인수 없이 호출하면 현재 Unix 타임스탬프를 반환합니다.

테이블과 함께 호출하면 누락된 필드는 위에 표시된 기본값을 사용합니다. `year`, `month`, `day` 필드는 지정되지 않으면 현재 날짜가 기본값입니다.

```lua
-- Just date (time defaults to midnight)
os.time({year = 2024, month = 6, day = 15})

-- Partial (fills in current year/month)
os.time({day = 1})  -- first of current month
```

## 날짜 포맷팅

타임스탬프를 문자열로 포맷하거나 날짜 테이블을 반환합니다:

<code-block lang="lua">
local now = os.time()

-- Default format
os.date()  -- "Sat Jun 15 14:30:45 2024"

-- Custom format
os.date("%Y-%m-%d", now)           -- "2024-06-15"
os.date("%H:%M:%S", now)           -- "14:30:45"
os.date("%Y-%m-%dT%H:%M:%S", now)  -- "2024-06-15T14:30:45"

-- UTC time (prefix format with !)
os.date("!%Y-%m-%d %H:%M:%S", now)  -- UTC instead of local

-- Date table
local t = os.date("*t", now)
</code-block>

**시그니처:** `os.date([format], [timestamp]) -> string | table`

| 파라미터 | 타입 | 기본값 | 설명 |
|----------|------|--------|------|
| `format` | string | `"%c"` | 포맷 문자열, 테이블용 `"*t"` |
| `timestamp` | number | 현재 시간 | 포맷할 Unix 타임스탬프 |

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
| `%U` | ISO 8601 week number (01-53, week starts Monday) | 24 |
| `%W` | ISO 8601 week number (01-53, week starts Monday) | 24 |
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
| `year` | number | 4자리 연도 | 2024 |
| `month` | number | 월 (1-12) | 6 |
| `day` | number | 월의 일 (1-31) | 15 |
| `hour` | number | 시 (0-23) | 14 |
| `min` | number | 분 (0-59) | 30 |
| `sec` | number | 초 (0-59) | 45 |
| `wday` | number | 요일 (1-7, 일요일=1) | 7 |
| `yday` | number | 연중 일 (1-366) | 167 |
| `isdst` | boolean | 이 release에서는 zone UTC offset이 nonzero이면 `true`. reliable DST indicator가 아님 | false |

UTC 날짜 테이블은 `"!*t"`를 사용하세요.

## 경과 시간 측정

current runtime time reference와 OS-time module initialization time 사이의 초를 읽습니다.

```lua
local start = os.clock()

-- do work
for i = 1, 1000000 do end

local elapsed = os.clock() - start
print(string.format("Took %.3f seconds", elapsed))
```

**시그니처:** `os.clock() -> number`

standard Lua의 CPU-time definition과 달리 이 implementation은 elapsed time 기반입니다. workflow에서는 workflow time reference를 사용합니다.

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
| `t2` | number | 나중 타임스탬프 |
| `t1` | number | 이전 타임스탬프 |

`t2 - t1`을 초 단위로 반환합니다. `t1 > t2`이면 음수가 될 수 있습니다.

## 플랫폼 상수

런타임을 식별하는 상수:

```lua
os.platform  -- "wippy"
```
