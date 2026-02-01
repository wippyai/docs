# 哈希函数
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>
<secondary-label ref="encoding"/>

加密哈希函数和 HMAC 消息认证。

## 加载

```lua
local hash = require("hash")
```

## 加密哈希

### MD5

```lua
local hex = hash.md5("data")
local raw = hash.md5("data", true)
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `data` | string | 要哈希的数据 |
| `raw` | boolean? | 返回原始字节而非十六进制 |

**返回值:** `string, error`

### SHA-1

```lua
local hex = hash.sha1("data")
local raw = hash.sha1("data", true)
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `data` | string | 要哈希的数据 |
| `raw` | boolean? | 返回原始字节而非十六进制 |

**返回值:** `string, error`

### SHA-256

```lua
local hex = hash.sha256("data")
local raw = hash.sha256("data", true)
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `data` | string | 要哈希的数据 |
| `raw` | boolean? | 返回原始字节而非十六进制 |

**返回值:** `string, error`

### SHA-512

```lua
local hex = hash.sha512("data")
local raw = hash.sha512("data", true)
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `data` | string | 要哈希的数据 |
| `raw` | boolean? | 返回原始字节而非十六进制 |

**返回值:** `string, error`

## HMAC 认证

### HMAC-MD5

```lua
local hex = hash.hmac_md5("message", "secret")
local raw = hash.hmac_md5("message", "secret", true)
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `data` | string | 要认证的消息 |
| `secret` | string | 密钥 |
| `raw` | boolean? | 返回原始字节而非十六进制 |

**返回值:** `string, error`

### HMAC-SHA1

```lua
local hex = hash.hmac_sha1("message", "secret")
local raw = hash.hmac_sha1("message", "secret", true)
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `data` | string | 要认证的消息 |
| `secret` | string | 密钥 |
| `raw` | boolean? | 返回原始字节而非十六进制 |

**返回值:** `string, error`

### HMAC-SHA256

```lua
local hex = hash.hmac_sha256("message", "secret")
local raw = hash.hmac_sha256("message", "secret", true)
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `data` | string | 要认证的消息 |
| `secret` | string | 密钥 |
| `raw` | boolean? | 返回原始字节而非十六进制 |

**返回值:** `string, error`

### HMAC-SHA512

```lua
local hex = hash.hmac_sha512("message", "secret")
local raw = hash.hmac_sha512("message", "secret", true)
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `data` | string | 要认证的消息 |
| `secret` | string | 密钥 |
| `raw` | boolean? | 返回原始字节而非十六进制 |

**返回值:** `string, error`

## 非加密哈希

### FNV-32

用于哈希表和分区的快速哈希。

```lua
local n = hash.fnv32("data")
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `data` | string | 要哈希的数据 |

**返回值:** `number, error`

### FNV-64

具有更大输出以减少冲突的快速哈希。

```lua
local n = hash.fnv64("data")
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `data` | string | 要哈希的数据 |

**返回值:** `number, error`

## 错误

| 条件 | 类型 | 可重试 |
|-----------|------|-----------|
| 输入不是字符串 | `errors.INVALID` | 否 |
| 密钥不是字符串（HMAC） | `errors.INVALID` | 否 |

参见 [错误处理](lua/core/errors.md) 了解如何处理错误。
