# 加密与签名
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>
<secondary-label ref="io"/>

加密操作，包括加密、HMAC、JWT 和密钥派生。适配工作流使用。

## 加载

```lua
local crypto = require("crypto")
```

## 随机生成

### 随机字节

```lua
local bytes, err = crypto.random.bytes(32)
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `length` | integer | 字节数（1 到 1,048,576） |

**返回值:** `string, error`

### 随机字符串

```lua
local str, err = crypto.random.string(32)
local str, err = crypto.random.string(32, "0123456789abcdef")
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `length` | integer | 字符串长度（1 到 1,048,576） |
| `charset` | string? | 使用的字符集（默认：字母数字） |

**返回值:** `string, error`

### 随机 UUID

```lua
local id, err = crypto.random.uuid()
```

**返回值:** `string, error`

## HMAC

### HMAC-SHA256

```lua
local hex, err = crypto.hmac.sha256(key, data)
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `key` | string | HMAC 密钥 |
| `data` | string | 要认证的数据 |

**返回值:** `string, error`

### HMAC-SHA512

```lua
local hex, err = crypto.hmac.sha512(key, data)
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `key` | string | HMAC 密钥 |
| `data` | string | 要认证的数据 |

**返回值:** `string, error`

## 加密

### AES-GCM {id="encrypt-aes-gcm"}

```lua
local encrypted, err = crypto.encrypt.aes(data, key)
local encrypted, err = crypto.encrypt.aes(data, key, aad)
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `data` | string | 要加密的明文 |
| `key` | string | 16、24 或 32 字节（AES-128/192/256） |
| `aad` | string? | 附加认证数据 |

**返回值:** `string, error`（nonce 前置）

### ChaCha20-Poly1305 {id="encrypt-chacha20"}

```lua
local encrypted, err = crypto.encrypt.chacha20(data, key)
local encrypted, err = crypto.encrypt.chacha20(data, key, aad)
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `data` | string | 要加密的明文 |
| `key` | string | 必须为 32 字节 |
| `aad` | string? | 附加认证数据 |

**返回值:** `string, error`

## 解密

### AES-GCM {id="decrypt-aes-gcm"}

```lua
local plaintext, err = crypto.decrypt.aes(encrypted, key)
local plaintext, err = crypto.decrypt.aes(encrypted, key, aad)
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `data` | string | 来自 encrypt.aes 的加密数据 |
| `key` | string | 加密时使用的相同密钥 |
| `aad` | string? | 必须与加密时使用的 AAD 匹配 |

**返回值:** `string, error`

### ChaCha20-Poly1305 {id="decrypt-chacha20"}

```lua
local plaintext, err = crypto.decrypt.chacha20(encrypted, key)
local plaintext, err = crypto.decrypt.chacha20(encrypted, key, aad)
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `data` | string | 来自 encrypt.chacha20 的加密数据 |
| `key` | string | 加密时使用的相同密钥 |
| `aad` | string? | 必须与加密时使用的 AAD 匹配 |

**返回值:** `string, error`

## JWT

### 编码

```lua
local token, err = crypto.jwt.encode(payload, secret)
local token, err = crypto.jwt.encode(payload, secret, "HS256")
local token, err = crypto.jwt.encode(payload, private_key_pem, "RS256")
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `payload` | table | JWT 声明（`_header` 用于自定义头） |
| `key` | string | 密钥（HMAC）或 PEM 私钥（RSA） |
| `alg` | string? | HS256、HS384、HS512、RS256（默认：HS256） |

**返回值:** `string, error`

### 验证

```lua
local claims, err = crypto.jwt.verify(token, secret)
local claims, err = crypto.jwt.verify(token, secret, "HS256", false)
local claims, err = crypto.jwt.verify(token, public_key_pem, "RS256")
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `token` | string | 要验证的 JWT 令牌 |
| `key` | string | 密钥（HMAC）或 PEM 公钥（RSA） |
| `alg` | string? | 预期算法（默认：HS256） |
| `require_exp` | boolean? | 验证过期时间（默认：true） |

**返回值:** `table, error`

## 密钥派生

### PBKDF2

```lua
local key, err = crypto.pbkdf2(password, salt, iterations, key_length)
local key, err = crypto.pbkdf2(password, salt, iterations, key_length, "sha512")
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `password` | string | 密码/口令 |
| `salt` | string | 盐值 |
| `iterations` | integer | 迭代次数（最大 10,000,000） |
| `key_length` | integer | 所需密钥长度（字节） |
| `hash` | string? | sha256 或 sha512（默认：sha256） |

**返回值:** `string, error`

## 工具函数

### 常量时间比较

```lua
local equal = crypto.constant_time_compare(a, b)
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `a` | string | 第一个字符串 |
| `b` | string | 第二个字符串 |

**返回值:** `boolean`

## 错误

| 条件 | 类型 | 可重试 |
|-----------|------|-----------|
| 无效的长度 | `errors.INVALID` | 否 |
| 空密钥 | `errors.INVALID` | 否 |
| 无效的密钥大小 | `errors.INVALID` | 否 |
| 解密失败 | `errors.INTERNAL` | 否 |
| 令牌已过期 | `errors.INTERNAL` | 否 |

参见 [错误处理](lua/core/errors.md) 了解如何处理错误。
