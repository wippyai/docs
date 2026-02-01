# ハッシュ関数
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>
<secondary-label ref="encoding"/>

暗号学的ハッシュ関数とHMACメッセージ認証。

## ロード

```lua
local hash = require("hash")
```

## 暗号学的ハッシュ

### MD5

```lua
local hex = hash.md5("data")
local raw = hash.md5("data", true)
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `data` | string | ハッシュするデータ |
| `raw` | boolean? | hexの代わりに生バイトを返す |

**戻り値:** `string, error`

### SHA-1

```lua
local hex = hash.sha1("data")
local raw = hash.sha1("data", true)
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `data` | string | ハッシュするデータ |
| `raw` | boolean? | hexの代わりに生バイトを返す |

**戻り値:** `string, error`

### SHA-256

```lua
local hex = hash.sha256("data")
local raw = hash.sha256("data", true)
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `data` | string | ハッシュするデータ |
| `raw` | boolean? | hexの代わりに生バイトを返す |

**戻り値:** `string, error`

### SHA-512

```lua
local hex = hash.sha512("data")
local raw = hash.sha512("data", true)
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `data` | string | ハッシュするデータ |
| `raw` | boolean? | hexの代わりに生バイトを返す |

**戻り値:** `string, error`

## HMAC認証

### HMAC-MD5

```lua
local hex = hash.hmac_md5("message", "secret")
local raw = hash.hmac_md5("message", "secret", true)
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `data` | string | 認証するメッセージ |
| `secret` | string | 秘密鍵 |
| `raw` | boolean? | hexの代わりに生バイトを返す |

**戻り値:** `string, error`

### HMAC-SHA1

```lua
local hex = hash.hmac_sha1("message", "secret")
local raw = hash.hmac_sha1("message", "secret", true)
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `data` | string | 認証するメッセージ |
| `secret` | string | 秘密鍵 |
| `raw` | boolean? | hexの代わりに生バイトを返す |

**戻り値:** `string, error`

### HMAC-SHA256

```lua
local hex = hash.hmac_sha256("message", "secret")
local raw = hash.hmac_sha256("message", "secret", true)
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `data` | string | 認証するメッセージ |
| `secret` | string | 秘密鍵 |
| `raw` | boolean? | hexの代わりに生バイトを返す |

**戻り値:** `string, error`

### HMAC-SHA512

```lua
local hex = hash.hmac_sha512("message", "secret")
local raw = hash.hmac_sha512("message", "secret", true)
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `data` | string | 認証するメッセージ |
| `secret` | string | 秘密鍵 |
| `raw` | boolean? | hexの代わりに生バイトを返す |

**戻り値:** `string, error`

## 非暗号学的ハッシュ

### FNV-32

ハッシュテーブルとパーティショニング用の高速ハッシュ。

```lua
local n = hash.fnv32("data")
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `data` | string | ハッシュするデータ |

**戻り値:** `number, error`

### FNV-64

衝突を減らすための大きな出力を持つ高速ハッシュ。

```lua
local n = hash.fnv64("data")
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `data` | string | ハッシュするデータ |

**戻り値:** `number, error`

## エラー

| 条件 | 種別 | 再試行可能 |
|-----------|------|-----------|
| 入力が文字列でない | `errors.INVALID` | no |
| シークレットが文字列でない（HMAC） | `errors.INVALID` | no |

エラーの処理については[エラー処理](lua-errors.md)を参照。

