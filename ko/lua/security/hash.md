# 해시 함수
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>
<secondary-label ref="encoding"/>

암호화 해시 함수와 HMAC 메시지 인증을 제공합니다.

## 로딩

```lua
local hash = require("hash")
```

## 암호화 해시

### MD5

```lua
local hex = hash.md5("data")
local raw = hash.md5("data", true)
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `data` | string | 해시할 데이터 |
| `raw` | boolean? | hex 대신 원시 바이트 반환 |

**반환:** `string, error`

### SHA-1

```lua
local hex = hash.sha1("data")
local raw = hash.sha1("data", true)
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `data` | string | 해시할 데이터 |
| `raw` | boolean? | hex 대신 원시 바이트 반환 |

**반환:** `string, error`

### SHA-256

```lua
local hex = hash.sha256("data")
local raw = hash.sha256("data", true)
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `data` | string | 해시할 데이터 |
| `raw` | boolean? | hex 대신 원시 바이트 반환 |

**반환:** `string, error`

### SHA-512

```lua
local hex = hash.sha512("data")
local raw = hash.sha512("data", true)
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `data` | string | 해시할 데이터 |
| `raw` | boolean? | hex 대신 원시 바이트 반환 |

**반환:** `string, error`

## HMAC 인증

### HMAC-MD5

```lua
local hex = hash.hmac_md5("message", "secret")
local raw = hash.hmac_md5("message", "secret", true)
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `data` | string | 인증할 메시지 |
| `secret` | string | 비밀 키 |
| `raw` | boolean? | hex 대신 원시 바이트 반환 |

**반환:** `string, error`

### HMAC-SHA1

```lua
local hex = hash.hmac_sha1("message", "secret")
local raw = hash.hmac_sha1("message", "secret", true)
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `data` | string | 인증할 메시지 |
| `secret` | string | 비밀 키 |
| `raw` | boolean? | hex 대신 원시 바이트 반환 |

**반환:** `string, error`

### HMAC-SHA256

```lua
local hex = hash.hmac_sha256("message", "secret")
local raw = hash.hmac_sha256("message", "secret", true)
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `data` | string | 인증할 메시지 |
| `secret` | string | 비밀 키 |
| `raw` | boolean? | hex 대신 원시 바이트 반환 |

**반환:** `string, error`

### HMAC-SHA512

```lua
local hex = hash.hmac_sha512("message", "secret")
local raw = hash.hmac_sha512("message", "secret", true)
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `data` | string | 인증할 메시지 |
| `secret` | string | 비밀 키 |
| `raw` | boolean? | hex 대신 원시 바이트 반환 |

**반환:** `string, error`

## 비암호화 해시

### FNV-32

해시 테이블과 파티셔닝을 위한 빠른 해시.

```lua
local n = hash.fnv32("data")
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `data` | string | 해시할 데이터 |

**반환:** `number, error`

### FNV-64

충돌을 줄이기 위한 더 큰 출력의 빠른 해시.

```lua
local n = hash.fnv64("data")
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `data` | string | 해시할 데이터 |

**반환:** `number, error`

## 에러

| 조건 | 종류 | 재시도 가능 |
|------|------|-------------|
| 입력이 문자열이 아님 | `errors.INVALID` | 아니오 |
| 비밀이 문자열이 아님 (HMAC) | `errors.INVALID` | 아니오 |

에러 처리는 [에러 처리](lua-errors.md)를 참조하세요.
