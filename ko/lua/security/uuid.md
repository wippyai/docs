---
title: "UUID 생성"
description: "UUID를 generate, validate, inspect, parse 및 format합니다."
---

# UUID 생성
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

`uuid` 모듈은 UUID를 generate, validate, inspect, parse, format합니다. deterministic workflow에서 v1, v4, v7 generation은 recorded side effect로 실행되며 replay 중에는 recorded value를 반환합니다. namespace 기반 v3와 v5 generation은 deterministic하며 직접 실행됩니다.

이 페이지는 isolated call의 API reference입니다. `namespace`, `name`, `input`, `id` 같은 value는 surrounding application에서 옵니다. generated, parsed, inspected, formatted result를 사용하기 전에 second `error` return을 capture하고 처리하십시오. UUID는 identifier이지 bearer credential이 아닙니다. 어떤 UUID version도 authentication token이나 secret으로 사용하지 마십시오.

## 로딩

```lua
local uuid = require("uuid")
```

## 비결정적 UUID

### 버전 1

타임스탬프와 노드 ID가 포함된 시간 기반 UUID.

version 1은 creation time과 node identifier를 노출합니다. 이 정보가 sensitive하면 피하고 opaque identifier만 필요할 때는 v4를 사용하십시오.

```lua
local id, err = uuid.v1()
```

**반환:** `string, error`

### 버전 4

난수 UUID.

```lua
local id, err = uuid.v4()
```

**반환:** `string, error`

### 버전 7

chronological indexing을 위해 creation time을 encode하는 time-ordered UUID입니다. 특히 같은 timestamp interval에 생성된 value에 대해 strictly monotonic sequence로 의존하지 마십시오.

```lua
local id, err = uuid.v7()
```

**반환:** `string, error`

## 결정론적 UUID

### 버전 3

MD5를 사용하여 네임스페이스와 이름에서 결정론적 UUID.

```lua
local id, err = uuid.v3(namespace, name)
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `namespace` | string | 유효한 UUID 문자열 |
| `name` | string | 해시할 값 |

**반환:** `string, error`

### 버전 5

SHA-1을 사용하여 네임스페이스와 이름에서 결정론적 UUID.

```lua
local NS_URL = "6ba7b811-9dad-11d1-80b4-00c04fd430c8"
local id, err = uuid.v5(NS_URL, "https://example.com/resource")
if err then
    return nil, err
end
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `namespace` | string | 유효한 UUID 문자열 |
| `name` | string | 해시할 값 |

**반환:** `string, error`

## 검사

### `validate`

```lua
local valid = uuid.validate(input)
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `input` | any | 확인할 값 |

**반환:** `boolean, nil`. string이 아니거나 malformed input이면 `false`를 반환하며 validation은 structured error를 raise하지 않습니다.

### `version`

```lua
local ver, err = uuid.version(id)
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `uuid` | string | 유효한 UUID 문자열 |

**반환:** `integer, error`

### `variant`

```lua
local var, err = uuid.variant(id)
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `uuid` | string | 유효한 UUID 문자열 |

**반환:** `string, error` (RFC4122, Reserved, Microsoft, Future, NCS, 또는 Invalid)

### `parse`

```lua
local info, err = uuid.parse(id)
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `uuid` | string | 유효한 UUID 문자열 |

**반환:** `table, error`

반환된 테이블 필드:
- `version` (integer): UUID 버전 (1, 3, 4, 5, 또는 7)
- `variant` (string): RFC4122, Reserved, Microsoft, Future, NCS, 또는 Invalid
- `timestamp` (integer): Unix 타임스탬프 (v1 및 v7만)
- `node` (string): raw 6-byte node identifier(v1만); display 또는 text storage 전에 encode하십시오.

### `format`

```lua
local formatted, err = uuid.format(id, "standard")
local formatted, err = uuid.format(id, "simple")
local formatted, err = uuid.format(id, "urn")
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `uuid` | string | 유효한 UUID 문자열 |
| `format` | string? | standard (기본값), simple, 또는 urn |

**반환:** `string, error`

## 에러

| 조건 | 종류 | 재시도 가능 |
|------|------|-------------|
| 잘못된 입력 타입 | `errors.INVALID` | 아니오 |
| 잘못된 UUID 형식 | `errors.INVALID` | 아니오 |
| 지원되지 않는 포맷 타입 | `errors.INVALID` | 아니오 |
| 생성 실패 | `errors.INTERNAL` | 아니오 |

[에러 처리](../core/errors.md)에서 error 사용법을 확인하십시오.
