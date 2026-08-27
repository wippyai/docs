---
title: "Hash Functions"
description: "Compute cryptographic hashes, HMAC values, PBKDF2 keys, and FNV-1 hashes."
---

# Hash Functions
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>
<secondary-label ref="encoding"/>

The `hash` module computes cryptographic hashes, HMAC values, PBKDF2-derived keys, and non-cryptographic FNV-1 hashes.

## Loading

```lua
local hash = require("hash")
```

## Cryptographic Hashes

### MD5

MD5 is not collision-resistant. Use it only for compatibility with protocols that require MD5, not for security decisions.

```lua
local hex = hash.md5("data")
local raw = hash.md5("data", true)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `data` | string | Data to hash |
| `raw` | boolean? | Return raw bytes instead of hex |

**Returns:** `string, error`

### SHA-1

SHA-1 is not collision-resistant. Use it only for compatibility with protocols that require SHA-1, not for security decisions.

```lua
local hex = hash.sha1("data")
local raw = hash.sha1("data", true)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `data` | string | Data to hash |
| `raw` | boolean? | Return raw bytes instead of hex |

**Returns:** `string, error`

### SHA-256

```lua
local hex = hash.sha256("data")
local raw = hash.sha256("data", true)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `data` | string | Data to hash |
| `raw` | boolean? | Return raw bytes instead of hex |

**Returns:** `string, error`

### SHA-512

```lua
local hex = hash.sha512("data")
local raw = hash.sha512("data", true)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `data` | string | Data to hash |
| `raw` | boolean? | Return raw bytes instead of hex |

**Returns:** `string, error`

## HMACs

### HMAC-MD5

```lua
local hex = hash.hmac_md5("message", "secret")
local raw = hash.hmac_md5("message", "secret", true)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `data` | string | Message to authenticate |
| `secret` | string | Secret key |
| `raw` | boolean? | Return raw bytes instead of hex |

**Returns:** `string, error`

### HMAC-SHA1

```lua
local hex = hash.hmac_sha1("message", "secret")
local raw = hash.hmac_sha1("message", "secret", true)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `data` | string | Message to authenticate |
| `secret` | string | Secret key |
| `raw` | boolean? | Return raw bytes instead of hex |

**Returns:** `string, error`

### HMAC-SHA256

```lua
local hex = hash.hmac_sha256("message", "secret")
local raw = hash.hmac_sha256("message", "secret", true)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `data` | string | Message to authenticate |
| `secret` | string | Secret key |
| `raw` | boolean? | Return raw bytes instead of hex |

**Returns:** `string, error`

### HMAC-SHA512

```lua
local hex = hash.hmac_sha512("message", "secret")
local raw = hash.hmac_sha512("message", "secret", true)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `data` | string | Message to authenticate |
| `secret` | string | Secret key |
| `raw` | boolean? | Return raw bytes instead of hex |

**Returns:** `string, error`

## Non-Cryptographic Hashes

### FNV-1 32-bit

Compute a hash for uses such as hash tables and partitioning.

```lua
local n = hash.fnv32("data")
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `data` | string | Data to hash |

**Returns:** `number, error`

### FNV-1 64-bit

Compute a wider hash for uses such as hash tables and partitioning, reducing collision probability.

```lua
local n = hash.fnv64("data")
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `data` | string | Data to hash |

**Returns:** `number, error`

## Key Derivation

### PBKDF2-HMAC

Derive raw key bytes with PBKDF2-HMAC-SHA256 or PBKDF2-HMAC-SHA512:

```lua
local key, err = hash.pbkdf2(password, salt, 600000, 32)
local key512, err = hash.pbkdf2(password, salt, 600000, 32, "sha512")
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `password` | string | Non-empty password or secret input |
| `salt` | string | Non-empty salt bytes |
| `iterations` | integer | Positive iteration count, at most 10,000,000 |
| `key_length` | integer | Positive output length in bytes |
| `algo` | string? | `sha256` (default) or `sha512` |

**Returns:** `string, error` (raw derived key bytes)

## Errors

| Condition | Kind | Retryable |
|-----------|------|-----------|
| Input not a string | `errors.INVALID` | no |
| Secret not a string (HMAC) | `errors.INVALID` | no |
| PBKDF2 password/salt empty, limits invalid, or algorithm unsupported | `errors.INVALID` | no |

See [Error Handling](lua/core/errors.md) for working with errors.
