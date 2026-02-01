# 암호화 및 서명
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>
<secondary-label ref="io"/>

암호화, HMAC, JWT, 키 파생을 포함한 암호화 작업을 제공합니다. 워크플로우에 맞게 조정되었습니다.

## 로딩

```lua
local crypto = require("crypto")
```

## 난수 생성

### 난수 바이트

```lua
local bytes, err = crypto.random.bytes(32)
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `length` | integer | 바이트 수 (1 ~ 1,048,576) |

**반환:** `string, error`

### 난수 문자열

```lua
local str, err = crypto.random.string(32)
local str, err = crypto.random.string(32, "0123456789abcdef")
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `length` | integer | 문자열 길이 (1 ~ 1,048,576) |
| `charset` | string? | 사용할 문자 (기본값: 영숫자) |

**반환:** `string, error`

### 난수 UUID

```lua
local id, err = crypto.random.uuid()
```

**반환:** `string, error`

## HMAC

### HMAC-SHA256

```lua
local hex, err = crypto.hmac.sha256(key, data)
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `key` | string | HMAC 키 |
| `data` | string | 인증할 데이터 |

**반환:** `string, error`

### HMAC-SHA512

```lua
local hex, err = crypto.hmac.sha512(key, data)
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `key` | string | HMAC 키 |
| `data` | string | 인증할 데이터 |

**반환:** `string, error`

## 암호화

### AES-GCM {id="encrypt-aes-gcm"}

```lua
local encrypted, err = crypto.encrypt.aes(data, key)
local encrypted, err = crypto.encrypt.aes(data, key, aad)
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `data` | string | 암호화할 평문 |
| `key` | string | 16, 24, 또는 32 바이트 (AES-128/192/256) |
| `aad` | string? | 추가 인증 데이터 |

**반환:** `string, error` (nonce가 앞에 추가됨)

### ChaCha20-Poly1305 {id="encrypt-chacha20"}

```lua
local encrypted, err = crypto.encrypt.chacha20(data, key)
local encrypted, err = crypto.encrypt.chacha20(data, key, aad)
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `data` | string | 암호화할 평문 |
| `key` | string | 32 바이트여야 함 |
| `aad` | string? | 추가 인증 데이터 |

**반환:** `string, error`

## 복호화

### AES-GCM {id="decrypt-aes-gcm"}

```lua
local plaintext, err = crypto.decrypt.aes(encrypted, key)
local plaintext, err = crypto.decrypt.aes(encrypted, key, aad)
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `data` | string | encrypt.aes에서 암호화된 데이터 |
| `key` | string | 암호화에 사용된 동일한 키 |
| `aad` | string? | 암호화에 사용된 AAD와 일치해야 함 |

**반환:** `string, error`

### ChaCha20-Poly1305 {id="decrypt-chacha20"}

```lua
local plaintext, err = crypto.decrypt.chacha20(encrypted, key)
local plaintext, err = crypto.decrypt.chacha20(encrypted, key, aad)
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `data` | string | encrypt.chacha20에서 암호화된 데이터 |
| `key` | string | 암호화에 사용된 동일한 키 |
| `aad` | string? | 암호화에 사용된 AAD와 일치해야 함 |

**반환:** `string, error`

## JWT

### 인코딩

```lua
local token, err = crypto.jwt.encode(payload, secret)
local token, err = crypto.jwt.encode(payload, secret, "HS256")
local token, err = crypto.jwt.encode(payload, private_key_pem, "RS256")
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `payload` | table | JWT 클레임 (커스텀 헤더용 `_header`) |
| `key` | string | 비밀 (HMAC) 또는 PEM 개인 키 (RSA) |
| `alg` | string? | HS256, HS384, HS512, RS256 (기본값: HS256) |

**반환:** `string, error`

### 검증

```lua
local claims, err = crypto.jwt.verify(token, secret)
local claims, err = crypto.jwt.verify(token, secret, "HS256", false)
local claims, err = crypto.jwt.verify(token, public_key_pem, "RS256")
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `token` | string | 검증할 JWT 토큰 |
| `key` | string | 비밀 (HMAC) 또는 PEM 공개 키 (RSA) |
| `alg` | string? | 예상 알고리즘 (기본값: HS256) |
| `require_exp` | boolean? | 만료 검증 (기본값: true) |

**반환:** `table, error`

## 키 파생

### PBKDF2

```lua
local key, err = crypto.pbkdf2(password, salt, iterations, key_length)
local key, err = crypto.pbkdf2(password, salt, iterations, key_length, "sha512")
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `password` | string | 비밀번호/패스프레이즈 |
| `salt` | string | 솔트 값 |
| `iterations` | integer | 반복 횟수 (최대 10,000,000) |
| `key_length` | integer | 원하는 키 길이 (바이트) |
| `hash` | string? | sha256 또는 sha512 (기본값: sha256) |

**반환:** `string, error`

## 유틸리티

### 상수 시간 비교

```lua
local equal = crypto.constant_time_compare(a, b)
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `a` | string | 첫 번째 문자열 |
| `b` | string | 두 번째 문자열 |

**반환:** `boolean`

## 에러

| 조건 | 종류 | 재시도 가능 |
|------|------|-------------|
| 잘못된 길이 | `errors.INVALID` | 아니오 |
| 빈 키 | `errors.INVALID` | 아니오 |
| 잘못된 키 크기 | `errors.INVALID` | 아니오 |
| 복호화 실패 | `errors.INTERNAL` | 아니오 |
| 토큰 만료됨 | `errors.INTERNAL` | 아니오 |

에러 처리는 [에러 처리](lua-errors.md)를 참조하세요.
