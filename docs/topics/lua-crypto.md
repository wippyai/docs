# Encryption & Signing
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>
<secondary-label ref="io"/>

Cryptographic operations including encryption, HMAC, JWT, and key derivation. Adapted for workflows.

## Loading

```lua
local crypto = require("crypto")
```

## Random Generation

### Random Bytes

```lua
local bytes, err = crypto.random.bytes(32)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `length` | integer | Number of bytes (1 to 1,048,576) |

**Returns:** `string, error`

### Random String

```lua
local str, err = crypto.random.string(32)
local str, err = crypto.random.string(32, "0123456789abcdef")
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `length` | integer | String length (1 to 1,048,576) |
| `charset` | string? | Characters to use (default: alphanumeric) |

**Returns:** `string, error`

### Random UUID

```lua
local id, err = crypto.random.uuid()
```

**Returns:** `string, error`

## HMAC

### HMAC-SHA256

```lua
local hex, err = crypto.hmac.sha256(key, data)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `key` | string | HMAC key |
| `data` | string | Data to authenticate |

**Returns:** `string, error`

### HMAC-SHA512

```lua
local hex, err = crypto.hmac.sha512(key, data)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `key` | string | HMAC key |
| `data` | string | Data to authenticate |

**Returns:** `string, error`

## Encryption

### AES-GCM

```lua
local encrypted, err = crypto.encrypt.aes(data, key)
local encrypted, err = crypto.encrypt.aes(data, key, aad)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `data` | string | Plaintext to encrypt |
| `key` | string | 16, 24, or 32 bytes (AES-128/192/256) |
| `aad` | string? | Additional authenticated data |

**Returns:** `string, error` (nonce prepended)

### ChaCha20-Poly1305

```lua
local encrypted, err = crypto.encrypt.chacha20(data, key)
local encrypted, err = crypto.encrypt.chacha20(data, key, aad)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `data` | string | Plaintext to encrypt |
| `key` | string | Must be 32 bytes |
| `aad` | string? | Additional authenticated data |

**Returns:** `string, error`

## Decryption

### AES-GCM

```lua
local plaintext, err = crypto.decrypt.aes(encrypted, key)
local plaintext, err = crypto.decrypt.aes(encrypted, key, aad)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `data` | string | Encrypted data from encrypt.aes |
| `key` | string | Same key used for encryption |
| `aad` | string? | Must match AAD used in encryption |

**Returns:** `string, error`

### ChaCha20-Poly1305

```lua
local plaintext, err = crypto.decrypt.chacha20(encrypted, key)
local plaintext, err = crypto.decrypt.chacha20(encrypted, key, aad)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `data` | string | Encrypted data from encrypt.chacha20 |
| `key` | string | Same key used for encryption |
| `aad` | string? | Must match AAD used in encryption |

**Returns:** `string, error`

## JWT

### Encode

```lua
local token, err = crypto.jwt.encode(payload, secret)
local token, err = crypto.jwt.encode(payload, secret, "HS256")
local token, err = crypto.jwt.encode(payload, private_key_pem, "RS256")
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `payload` | table | JWT claims (`_header` for custom header) |
| `key` | string | Secret (HMAC) or PEM private key (RSA) |
| `alg` | string? | HS256, HS384, HS512, RS256 (default: HS256) |

**Returns:** `string, error`

### Verify

```lua
local claims, err = crypto.jwt.verify(token, secret)
local claims, err = crypto.jwt.verify(token, secret, "HS256", false)
local claims, err = crypto.jwt.verify(token, public_key_pem, "RS256")
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `token` | string | JWT token to verify |
| `key` | string | Secret (HMAC) or PEM public key (RSA) |
| `alg` | string? | Expected algorithm (default: HS256) |
| `require_exp` | boolean? | Validate expiration (default: true) |

**Returns:** `table, error`

## Key Derivation

### PBKDF2

```lua
local key, err = crypto.pbkdf2(password, salt, iterations, key_length)
local key, err = crypto.pbkdf2(password, salt, iterations, key_length, "sha512")
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `password` | string | Password/passphrase |
| `salt` | string | Salt value |
| `iterations` | integer | Iteration count (max 10,000,000) |
| `key_length` | integer | Desired key length in bytes |
| `hash` | string? | sha256 or sha512 (default: sha256) |

**Returns:** `string, error`

## Utility

### Constant-Time Compare

```lua
local equal = crypto.constant_time_compare(a, b)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `a` | string | First string |
| `b` | string | Second string |

**Returns:** `boolean`

## Errors

| Condition | Kind | Retryable |
|-----------|------|-----------|
| Invalid length | `errors.INVALID` | no |
| Empty key | `errors.INVALID` | no |
| Invalid key size | `errors.INVALID` | no |
| Decryption failed | `errors.INTERNAL` | no |
| Token expired | `errors.INTERNAL` | no |

See [Error Handling](lua-errors.md) for working with errors.
