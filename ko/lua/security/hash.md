---
title: "해시 함수"
description: "암호화 해시 함수와 HMAC 메시지 인증을 제공합니다."
---

# 해시 함수
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>
<secondary-label ref="encoding"/>

`hash` 모듈은 암호화 해시, HMAC 값, PBKDF2 파생 키, 비암호화 FNV-1 해시를 계산합니다. 이 페이지는 독립 호출을 설명하는 API 참조입니다. 리터럴 입력은 성공적인 사용을 보여 줍니다. 데이터, 비밀, 비밀번호, salt가 애플리케이션에서 제공되면 결과를 사용하기 전에 문서화된 두 번째 `error` 반환을 확인하고 처리하세요.

해시는 암호화가 아니며 엔트로피가 낮은 입력을 숨기지 않습니다. 비밀번호, HMAC 키, 파생 키, 비밀에 의존하는 원시 다이제스트를 로그에 기록하지 마세요. 새 메시지 인증 설계에는 HMAC-SHA256 또는 HMAC-SHA512를 사용하고 비밀번호 검증자에는 고유한 임의 salt와 PBKDF2를 사용하세요.

## 로드

```lua
local hash = require("hash")
```

## 암호화 해시

### MD5

MD5는 충돌 저항성이 없습니다. 보안 판단이 아니라 MD5가 필요한 프로토콜과의 호환성에만 사용하세요.

```lua
local hex = hash.md5("data")
local raw = hash.md5("data", true)
```

| 매개변수 | 타입 | 설명 |
|-----------|------|-------------|
| `data` | string | 해시할 데이터 |
| `raw` | boolean? | 16진수 대신 원시 바이트 반환 |

**반환:** `string, error`

### SHA-1

SHA-1은 충돌 저항성이 없습니다. 보안 판단이 아니라 SHA-1이 필요한 프로토콜과의 호환성에만 사용하세요.

```lua
local hex = hash.sha1("data")
local raw = hash.sha1("data", true)
```

| 매개변수 | 타입 | 설명 |
|-----------|------|-------------|
| `data` | string | 해시할 데이터 |
| `raw` | boolean? | 16진수 대신 원시 바이트 반환 |

**반환:** `string, error`

### SHA-256

```lua
local hex = hash.sha256("data")
local raw = hash.sha256("data", true)
```

| 매개변수 | 타입 | 설명 |
|-----------|------|-------------|
| `data` | string | 해시할 데이터 |
| `raw` | boolean? | 16진수 대신 원시 바이트 반환 |

**반환:** `string, error`

### SHA-512

```lua
local hex = hash.sha512("data")
local raw = hash.sha512("data", true)
```

| 매개변수 | 타입 | 설명 |
|-----------|------|-------------|
| `data` | string | 해시할 데이터 |
| `raw` | boolean? | 16진수 대신 원시 바이트 반환 |

**반환:** `string, error`

## HMAC

### HMAC-MD5

HMAC-MD5는 이를 요구하는 프로토콜과의 호환성에만 사용하세요. 새 설계에는 HMAC-SHA256 또는 HMAC-SHA512를 권장합니다.

```lua
local hex = hash.hmac_md5("message", "secret")
local raw = hash.hmac_md5("message", "secret", true)
```

| 매개변수 | 타입 | 설명 |
|-----------|------|-------------|
| `data` | string | 인증할 메시지 |
| `secret` | string | 비밀 키 |
| `raw` | boolean? | 16진수 대신 원시 바이트 반환 |

**반환:** `string, error`

### HMAC-SHA1

HMAC-SHA1은 이를 요구하는 프로토콜과의 호환성에만 사용하세요. 새 설계에는 HMAC-SHA256 또는 HMAC-SHA512를 권장합니다.

```lua
local hex = hash.hmac_sha1("message", "secret")
local raw = hash.hmac_sha1("message", "secret", true)
```

| 매개변수 | 타입 | 설명 |
|-----------|------|-------------|
| `data` | string | 인증할 메시지 |
| `secret` | string | 비밀 키 |
| `raw` | boolean? | 16진수 대신 원시 바이트 반환 |

**반환:** `string, error`

### HMAC-SHA256

```lua
local hex = hash.hmac_sha256("message", "secret")
local raw = hash.hmac_sha256("message", "secret", true)
```

| 매개변수 | 타입 | 설명 |
|-----------|------|-------------|
| `data` | string | 인증할 메시지 |
| `secret` | string | 비밀 키 |
| `raw` | boolean? | 16진수 대신 원시 바이트 반환 |

**반환:** `string, error`

### HMAC-SHA512

```lua
local hex = hash.hmac_sha512("message", "secret")
local raw = hash.hmac_sha512("message", "secret", true)
```

| 매개변수 | 타입 | 설명 |
|-----------|------|-------------|
| `data` | string | 인증할 메시지 |
| `secret` | string | 비밀 키 |
| `raw` | boolean? | 16진수 대신 원시 바이트 반환 |

**반환:** `string, error`

## 비암호화 해시

### FNV-1 32비트

해시 테이블과 파티셔닝 같은 용도를 위한 해시를 계산합니다.

```lua
local n = hash.fnv32("data")
```

| 매개변수 | 타입 | 설명 |
|-----------|------|-------------|
| `data` | string | 해시할 데이터 |

**반환:** `number, error`

### FNV-1 64비트

해시 테이블과 파티셔닝 같은 용도에 더 넓은 해시를 계산해 충돌 가능성을 줄입니다.

```lua
local n = hash.fnv64("data")
```

| 매개변수 | 타입 | 설명 |
|-----------|------|-------------|
| `data` | string | 해시할 데이터 |

**반환:** `number, error`

## 키 파생

### PBKDF2

```lua
local key, err = hash.pbkdf2(password, salt, iterations, key_length)
local key, err = hash.pbkdf2(password, salt, iterations, key_length, "sha512")
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `password` | string | 비밀번호/패스프레이즈 (비어 있으면 안 됨) |
| `salt` | string | 솔트 값 (비어 있으면 안 됨) |
| `iterations` | integer | 반복 횟수 (1 ~ 10,000,000) |
| `key_length` | integer | 원하는 키 길이 (바이트) |
| `hash` | string? | `sha256` 또는 `sha512` (기본값: `sha256`) |

**반환:** `string, error` (원시 키 바이트)

## 에러

| 조건 | 종류 | 재시도 가능 |
|------|------|-------------|
| 입력이 문자열이 아님 | `errors.INVALID` | 아니오 |
| 비밀이 문자열이 아님 (HMAC) | `errors.INVALID` | 아니오 |
| 빈 비밀번호/솔트, 0 이하이거나 과도한 반복 횟수, 지원하지 않는 해시 (PBKDF2) | `errors.INVALID` | 아니오 |

오류 작업 방법은 [오류 처리](lua/core/errors.md)를 참고하세요.
