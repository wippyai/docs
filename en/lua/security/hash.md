---
title: "Hash Functions"
description: "Cryptographic hashes, HMAC, key derivation and streaming MinHash signatures."
---

# Hash Functions
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>
<secondary-label ref="encoding"/>

The `hash` module computes cryptographic hashes, HMAC values, PBKDF2-derived keys, and non-cryptographic FNV-1 hashes. This page is an API reference of isolated calls. Literal inputs illustrate successful use; when data, secrets, passwords, or salts come from the application, capture and handle the documented second `error` return before consuming the result.

A hash is not encryption and does not conceal low-entropy input. Do not log passwords, HMAC keys, derived keys, or raw secret-dependent digests. Use HMAC-SHA256 or HMAC-SHA512 for new message-authentication designs and PBKDF2 with a unique random salt for password verifiers.

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

Use HMAC-MD5 only for compatibility with a protocol that requires it; prefer HMAC-SHA256 or HMAC-SHA512 for new designs.

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

Use HMAC-SHA1 only for compatibility with a protocol that requires it; prefer HMAC-SHA256 or HMAC-SHA512 for new designs.

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

Compute a 64-bit FNV-1 hash. In runtime v0.3.62a, the result is a string preserving all 64 bits: 16 lowercase hexadecimal characters by default, or eight big-endian bytes with `raw = true`.

```lua
local hex, err = hash.fnv64("data")
if err then return nil, err end
local raw, raw_err = hash.fnv64("data", true)
if raw_err then return nil, raw_err end
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `data` | string | Data to hash |
| `raw` | boolean? | Return eight raw bytes instead of hex; default `false` |

**Returns:** `string, error`

Callers upgrading from the previous numeric return must consume the string directly. Converting it to a floating-point number can lose the low bits again. `fnv32` continues to return an exact 32-bit number.

## MinHash

Available in runtime v0.3.62a. `hash.minhash` computes deterministic sketches of token shingles, locality-sensitive hashing (LSH) band keys, and estimates of Jaccard similarity for near-duplicate text.

Text is split into runs of ASCII letters, digits, underscore and bytes at or above `0x80`. ASCII letters are lowercased. An array of non-empty token strings supplies tokens unchanged. Compare sketches produced with the same tokenization, shingle width and algorithm.

### Functions

| Function | Returns | Options |
|----------|---------|---------|
| `hash.minhash.signature(input, options?)` | `Signature, error` | `k`, `shingle`, `bands`, `rows`, `domain` |
| `hash.minhash.sketch(input, options?)` | `string, error` | `k`, `shingle` |
| `hash.minhash.bands(sketch, options?)` | `{string}, error` | `bands`, `rows`, `domain` |
| `hash.minhash.similarity(a, b)` | `number, error` | None |
| `hash.minhash.new(options?)` | `MinHasher, error` | `k`, `shingle`, `bands`, `rows`, `domain` |

`input` is text or an array of tokens. `similarity` takes two non-empty serialized sketches of the same size and returns a value in `0..1`. Band keys select candidates; use the similarity estimate to compare them.

| Option | Default | Constraint |
|--------|---------|------------|
| `k` | `128` | Sketch bins, `1..65536`, not a multiple of `5` or `11` |
| `shingle` | `5` | Tokens per shingle, `1..1024` |
| `bands` | `16` | `bands * rows` equals the sketch bin count |
| `rows` | `8` | Bins per band |
| `domain` | `"minhash.lsh.v1"` | Namespace included in each band key |

Unknown options, wrong types, invalid dimensions and mismatched sketch sizes return non-retryable `errors.INVALID`.

A signature contains `tokens` (token count), `normalized` (hex SHA-256 of tokens joined by one space), `sketch` and `bands`. The sketch is `4*k` bytes, storing 32-bit big-endian words; each band key is 16 lowercase hex characters. Input without tokens has no `sketch` or `bands` in its signature; `sketch(input)` returns `""` for that input. Serialized sketches do not carry their configuration, so store the parameters alongside persisted sketches. The [algorithm specification](https://github.com/wippyai/runtime/blob/v0.3.62a/runtime/lua/modules/hash/spec.md#algorithm) defines the deterministic hashing and serialization.

```lua
local a, a_err = hash.minhash.signature("the quick brown fox jumps over the lazy dog")
if a_err then return nil, a_err end
local b, b_err = hash.minhash.signature("the quick brown fox jumps over the sleepy dog")
if b_err then return nil, b_err end
local score, score_err = hash.minhash.similarity(a.sketch, b.sketch)
if score_err then return nil, score_err end
return score
```

### Streaming

A MinHasher keeps the current token's hash, shingle window, sketch bins and normalized digest. Chunks may split a token; `sum()` equals the signature of the concatenated text and retains the state for further updates.

| Method | Returns | Behavior |
|--------|---------|----------|
| `hasher:update(chunk)` | `boolean, error` | Append a text chunk |
| `hasher:sum()` | `Signature, error` | Snapshot the current signature |
| `hasher:reset()` | No values | Discard accumulated input |

```lua
local hasher, create_err = hash.minhash.new()
if create_err then return nil, create_err end
local ok, update_err = hasher:update("the quick bro")
if not ok then return nil, update_err end
ok, update_err = hasher:update("wn fox jumps over the lazy dog")
if not ok then return nil, update_err end
local signature, sum_err = hasher:sum()
if sum_err then return nil, sum_err end
return signature
```

## Key Derivation

### PBKDF2

```lua
local key, err = hash.pbkdf2(password, salt, iterations, key_length)
local key, err = hash.pbkdf2(password, salt, iterations, key_length, "sha512")
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `password` | string | Password/passphrase (non-empty) |
| `salt` | string | Salt value (non-empty) |
| `iterations` | integer | Iteration count (1 to 10,000,000) |
| `key_length` | integer | Desired key length in bytes |
| `hash` | string? | `sha256` or `sha512` (default: `sha256`) |

**Returns:** `string, error` (raw key bytes)

## Errors

| Condition | Kind | Retryable |
|-----------|------|-----------|
| Input not a string | `errors.INVALID` | no |
| Secret not a string (HMAC) | `errors.INVALID` | no |
| Empty password/salt, non-positive or excessive iterations, unsupported hash (PBKDF2) | `errors.INVALID` | no |

See [Error Handling](lua/core/errors.md) for working with errors.
