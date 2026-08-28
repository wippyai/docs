---
title: "메트릭 및 텔레메트리"
description: "application counter, gauge 및 histogram observation을 기록합니다."
---

# 메트릭 및 텔레메트리
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>

`metrics` 모듈은 application counter, gauge, histogram observation을 기록합니다.

이 페이지는 API reference입니다. snippet은 한 번에 하나의 observation을 보여 주고 collector error를 propagate합니다.

각 function은 observation을 active collector에 전달한 뒤 `true, nil`을 반환합니다. execution context에 collector가 없으면 `nil`과 retry 불가능한 `errors.INTERNAL` error를 반환합니다.

label은 optional입니다. string key와 string value를 모두 가진 entry만 기록되며 다른 entry는 조용히 무시됩니다. table이 아닌 labels argument는 label이 없는 것으로 처리됩니다.

metric name은 local validation 없이 전달됩니다.

## 로딩

```lua
local metrics = require("metrics")
```

## 카운터

### `metrics.counter_inc`

counter를 1 증가시킵니다.

```lua
local recorded, err = metrics.counter_inc("requests_total", {method = "POST"})
if err then return nil, err end
return recorded
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `name` | string | 메트릭 이름 |
| `labels` | table? | 레이블 키-값 쌍 |

**반환:** `boolean, error`

### `metrics.counter_add`

counter에 값을 더합니다.

```lua
local recorded, err = metrics.counter_add("bytes_total", 1024, {direction = "out"})
if err then return nil, err end
return recorded
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `name` | string | 메트릭 이름 |
| `value` | number | 더할 값 |
| `labels` | table? | 레이블 키-값 쌍 |

**반환:** `boolean, error`

runtime은 값을 변경하지 않고 전달하며 positive value를 요구하지 않습니다.

## 게이지

### `metrics.gauge_set`

gauge를 현재 값으로 설정합니다.

```lua
local recorded, err = metrics.gauge_set("queue_depth", 42, {queue = "emails"})
if err then return nil, err end
return recorded
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `name` | string | 메트릭 이름 |
| `value` | number | 현재 값 |
| `labels` | table? | 레이블 키-값 쌍 |

**반환:** `boolean, error`

### `metrics.gauge_inc`

gauge를 1 증가시킵니다.

```lua
local recorded, err = metrics.gauge_inc("connections", {pool = "db"})
if err then return nil, err end
return recorded
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `name` | string | 메트릭 이름 |
| `labels` | table? | 레이블 키-값 쌍 |

**반환:** `boolean, error`

### `metrics.gauge_dec`

gauge를 1 감소시킵니다.

```lua
local recorded, err = metrics.gauge_dec("connections", {pool = "db"})
if err then return nil, err end
return recorded
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `name` | string | 메트릭 이름 |
| `labels` | table? | 레이블 키-값 쌍 |

**반환:** `boolean, error`

## 히스토그램

### `metrics.histogram`

histogram observation을 기록합니다.

```lua
local recorded, err = metrics.histogram("duration_seconds", 0.123, {method = "GET"})
if err then return nil, err end
return recorded
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

잘못된 name 또는 value type은 structured error를 반환하지 않고 Lua argument error를 raise합니다.

[에러 처리](lua/core/errors.md)에서 error 사용법을 확인하십시오.
