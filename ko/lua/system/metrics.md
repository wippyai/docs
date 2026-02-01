# 메트릭 및 텔레메트리
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>

카운터, 게이지, 히스토그램을 사용하여 애플리케이션 메트릭을 기록합니다.

## 로딩

```lua
local metrics = require("metrics")
```

## 카운터

### 카운터 증가

```lua
metrics.counter_inc("requests_total", {method = "POST"})
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `name` | string | 메트릭 이름 |
| `labels` | table? | 레이블 키-값 쌍 |

**반환:** `boolean, error`

### 카운터에 더하기

```lua
metrics.counter_add("bytes_total", 1024, {direction = "out"})
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `name` | string | 메트릭 이름 |
| `value` | number | 더할 값 |
| `labels` | table? | 레이블 키-값 쌍 |

**반환:** `boolean, error`

## 게이지

### 게이지 설정

```lua
metrics.gauge_set("queue_depth", 42, {queue = "emails"})
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `name` | string | 메트릭 이름 |
| `value` | number | 현재 값 |
| `labels` | table? | 레이블 키-값 쌍 |

**반환:** `boolean, error`

### 게이지 증가

```lua
metrics.gauge_inc("connections", {pool = "db"})
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `name` | string | 메트릭 이름 |
| `labels` | table? | 레이블 키-값 쌍 |

**반환:** `boolean, error`

### 게이지 감소

```lua
metrics.gauge_dec("connections", {pool = "db"})
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `name` | string | 메트릭 이름 |
| `labels` | table? | 레이블 키-값 쌍 |

**반환:** `boolean, error`

## 히스토그램

### 관측 기록

```lua
metrics.histogram("duration_seconds", 0.123, {method = "GET"})
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `name` | string | 메트릭 이름 |
| `value` | number | 관측된 값 |
| `labels` | table? | 레이블 키-값 쌍 |

**반환:** `boolean, error`

## 에러

| 조건 | 종류 | 재시도 가능 |
|------|------|-------------|
| 컬렉터 사용 불가 | `errors.INTERNAL` | 아니오 |

에러 처리는 [에러 처리](lua-errors.md)를 참조하세요.
