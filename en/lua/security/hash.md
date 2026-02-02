# Hash Functions
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>
<secondary-label ref="encoding"/>

Cryptographic hash functions and HMAC message authentication.

## Loading

```lua
local hash = require("hash")
```

## Cryptographic Hashes

### MD5

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

## HMAC Authentication

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

### FNV-32

Fast hash for hash tables and partitioning.

```lua
local n = hash.fnv32("data")
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `data` | string | Data to hash |

**Returns:** `number, error`

### FNV-64

Fast hash with larger output for reduced collisions.

```lua
local n = hash.fnv64("data")
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `data` | string | Data to hash |

**Returns:** `number, error`

## Errors

| Condition | Kind | Retryable |
|-----------|------|-----------|
| Input not a string | `errors.INVALID` | no |
| Secret not a string (HMAC) | `errors.INVALID` | no |

See [Error Handling](lua/core/errors.md) for working with errors.
