# UUID 생성
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

범용 고유 식별자를 생성합니다. 워크플로우에 맞게 조정됨 - 난수 UUID는 리플레이 시 일관된 값을 반환합니다.

## 로딩

```lua
local uuid = require("uuid")
```

## 난수 UUID

### 버전 1

타임스탬프와 노드 ID가 포함된 시간 기반 UUID.

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

시간 순서 UUID. 생성 시간별로 정렬 가능.

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
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `namespace` | string | 유효한 UUID 문자열 |
| `name` | string | 해시할 값 |

**반환:** `string, error`

## 검사

### 검증

```lua
local valid = uuid.validate(input)
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `input` | any | 확인할 값 |

**반환:** `boolean`

### 버전 가져오기

```lua
local ver, err = uuid.version(id)
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `uuid` | string | 유효한 UUID 문자열 |

**반환:** `integer, error`

### 변형 가져오기

```lua
local var, err = uuid.variant(id)
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `uuid` | string | 유효한 UUID 문자열 |

**반환:** `string, error` (RFC4122, Microsoft, NCS, 또는 Invalid)

### 파싱

```lua
local info, err = uuid.parse(id)
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `uuid` | string | 유효한 UUID 문자열 |

**반환:** `table, error`

반환된 테이블 필드:
- `version` (integer): UUID 버전 (1, 3, 4, 5, 또는 7)
- `variant` (string): RFC4122, Microsoft, NCS, 또는 Invalid
- `timestamp` (integer): Unix 타임스탬프 (v1 및 v7만)
- `node` (string): 노드 ID (v1만)

### 포맷

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

에러 처리는 [에러 처리](lua-errors.md)를 참조하세요.
