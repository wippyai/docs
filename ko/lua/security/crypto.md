---
title: "암호화 및 서명"
description: "난수 생성, HMAC, 암복호화, JWT, 키 파생을 위한 암호화 API입니다."
---

# 암호화 및 서명
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>
<secondary-label ref="io"/>

`crypto` 모듈은 난수 생성, HMAC 계산, 데이터 암복호화, JWT 인코딩과 검증, 키 파생을 제공합니다. 결정론적 워크플로우에서는 난수 생성과 무작위 nonce를 만드는 암호화가 기록된 부작용으로 실행되며, 리플레이는 기록된 바이트를 반환합니다. HMAC, 복호화, JWT 처리, PBKDF2, 비교를 포함한 다른 작업은 직접 실행됩니다.

이 페이지는 API 레퍼런스입니다. 각 코드 블록은 완전한 키 관리 또는 인증 시스템이 아니라 독립된 호출입니다. `data`, `key`, `aad`, `payload`, `token` 같은 이름은 애플리케이션에서 제공하는 값입니다. 키와 비밀번호는 애플리케이션의 비밀 관리 경계를 통해 로드하고, 하드코딩하거나 로그 또는 진단 결과에 반환하지 마세요. 여기에 표시된 `value, error` 결과를 사용하기 전에 오류를 전파하거나 처리하세요.

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

구현은 제공된 알파벳에서 바이트를 선택합니다. 비 ASCII 알파벳은 잘못된 UTF-8로 분할될 수 있으며, 알파벳의 바이트 길이가 256의 약수일 때만 모듈로 선택이 정확히 균등합니다. 균등한 무작위 비밀 자료에는 `crypto.random.bytes`를 사용하고 필요한 전송 형식으로 결과를 인코딩하세요.

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

문서에 나온 알고리즘 이름 중 하나만 전달하세요. 이 고정 런타임에서 지원하지 않는 값을 `encode`에 전달하면 오류 대신 HS256으로 폴백합니다. 호출 전에 설정 가능한 알고리즘을 검증하고 신뢰할 수 없는 필드를 `_header`에 복사하지 마세요. 특히 입력이 `alg` 같은 예약 JWT 헤더를 재정의하게 해서는 안 됩니다.

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
| `require_exp` | boolean? | `exp` 클레임 필수 (기본값: true) |

**반환:** `table, error`

`exp`와 `nbf`가 있으면 워크플로우 시간 기준이 아니라 JWT 라이브러리의 현재 wall clock을 기준으로 검증합니다. `require_exp = false`는 `exp` 클레임이 없어도 허용할 뿐, 존재하는 클레임의 검증을 비활성화하지 않습니다. 시간에 의존하는 결과를 리플레이에 민감한 워크플로우 제어에 사용하지 마세요. 액티비티에서 검사하거나 명시적으로 리플레이 안전한 값으로 시간을 검증하세요.

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

길이가 다르면 결과는 `false`입니다. 기본 상수 시간 비교 보장은 길이가 같은 입력에 적용되므로, 고정 길이 다이제스트 또는 길이가 같은 비밀을 비교하세요.

## 에러

| 조건 | 종류 | 재시도 가능 |
|------|------|-------------|
| 잘못된 길이 | `errors.INVALID` | 아니오 |
| 빈 키 | `errors.INVALID` | 아니오 |
| 잘못된 키 크기 | `errors.INVALID` | 아니오 |
| 복호화 실패 | `errors.INTERNAL` | 아니오 |
| 토큰 만료됨 | `errors.INTERNAL` | 아니오 |

에러 처리는 [에러 처리](../core/errors.md)를 참조하세요.
