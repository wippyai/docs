# 暗号化 & 署名
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>
<secondary-label ref="io"/>

暗号化、HMAC、JWT、鍵導出を含む暗号操作を提供します。ワークフロー向けに適応されています。

## ロード

```lua
local crypto = require("crypto")
```

## 乱数生成

### ランダムバイト

```lua
local bytes, err = crypto.random.bytes(32)
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `length` | integer | バイト数（1から1,048,576） |

**戻り値:** `string, error`

### ランダム文字列

```lua
local str, err = crypto.random.string(32)
local str, err = crypto.random.string(32, "0123456789abcdef")
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `length` | integer | 文字列長（1から1,048,576） |
| `charset` | string? | 使用する文字（デフォルト: 英数字） |

**戻り値:** `string, error`

### ランダムUUID

```lua
local id, err = crypto.random.uuid()
```

**戻り値:** `string, error`

## HMAC

### HMAC-SHA256

```lua
local hex, err = crypto.hmac.sha256(key, data)
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `key` | string | HMACキー |
| `data` | string | 認証するデータ |

**戻り値:** `string, error`

### HMAC-SHA512

```lua
local hex, err = crypto.hmac.sha512(key, data)
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `key` | string | HMACキー |
| `data` | string | 認証するデータ |

**戻り値:** `string, error`

## 暗号化

### AES-GCM {id="encrypt-aes-gcm"}

```lua
local encrypted, err = crypto.encrypt.aes(data, key)
local encrypted, err = crypto.encrypt.aes(data, key, aad)
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `data` | string | 暗号化する平文 |
| `key` | string | 16、24、または32バイト（AES-128/192/256） |
| `aad` | string? | 追加の認証データ |

**戻り値:** `string, error`（nonceが前置）

### ChaCha20-Poly1305 {id="encrypt-chacha20"}

```lua
local encrypted, err = crypto.encrypt.chacha20(data, key)
local encrypted, err = crypto.encrypt.chacha20(data, key, aad)
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `data` | string | 暗号化する平文 |
| `key` | string | 32バイトである必要あり |
| `aad` | string? | 追加の認証データ |

**戻り値:** `string, error`

## 復号

### AES-GCM {id="decrypt-aes-gcm"}

```lua
local plaintext, err = crypto.decrypt.aes(encrypted, key)
local plaintext, err = crypto.decrypt.aes(encrypted, key, aad)
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `data` | string | encrypt.aesからの暗号化データ |
| `key` | string | 暗号化に使用した同じキー |
| `aad` | string? | 暗号化で使用したAADと一致する必要あり |

**戻り値:** `string, error`

### ChaCha20-Poly1305 {id="decrypt-chacha20"}

```lua
local plaintext, err = crypto.decrypt.chacha20(encrypted, key)
local plaintext, err = crypto.decrypt.chacha20(encrypted, key, aad)
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `data` | string | encrypt.chacha20からの暗号化データ |
| `key` | string | 暗号化に使用した同じキー |
| `aad` | string? | 暗号化で使用したAADと一致する必要あり |

**戻り値:** `string, error`

## JWT

### エンコード

```lua
local token, err = crypto.jwt.encode(payload, secret)
local token, err = crypto.jwt.encode(payload, secret, "HS256")
local token, err = crypto.jwt.encode(payload, private_key_pem, "RS256")
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `payload` | table | JWTクレーム（カスタムヘッダーには`_header`） |
| `key` | string | シークレット（HMAC）またはPEM秘密鍵（RSA） |
| `alg` | string? | HS256、HS384、HS512、RS256（デフォルト: HS256） |

**戻り値:** `string, error`

### 検証

```lua
local claims, err = crypto.jwt.verify(token, secret)
local claims, err = crypto.jwt.verify(token, secret, "HS256", false)
local claims, err = crypto.jwt.verify(token, public_key_pem, "RS256")
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `token` | string | 検証するJWTトークン |
| `key` | string | シークレット（HMAC）またはPEM公開鍵（RSA） |
| `alg` | string? | 期待するアルゴリズム（デフォルト: HS256） |
| `require_exp` | boolean? | 有効期限を検証（デフォルト: true） |

**戻り値:** `table, error`

## 鍵導出

### PBKDF2

```lua
local key, err = crypto.pbkdf2(password, salt, iterations, key_length)
local key, err = crypto.pbkdf2(password, salt, iterations, key_length, "sha512")
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `password` | string | パスワード/パスフレーズ |
| `salt` | string | ソルト値 |
| `iterations` | integer | イテレーション回数（最大10,000,000） |
| `key_length` | integer | 希望する鍵長（バイト） |
| `hash` | string? | sha256またはsha512（デフォルト: sha256） |

**戻り値:** `string, error`

## ユーティリティ

### 定数時間比較

```lua
local equal = crypto.constant_time_compare(a, b)
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `a` | string | 最初の文字列 |
| `b` | string | 2番目の文字列 |

**戻り値:** `boolean`

## エラー

| 条件 | 種別 | 再試行可能 |
|-----------|------|-----------|
| 無効な長さ | `errors.INVALID` | no |
| 空のキー | `errors.INVALID` | no |
| 無効なキーサイズ | `errors.INVALID` | no |
| 復号失敗 | `errors.INTERNAL` | no |
| トークン期限切れ | `errors.INTERNAL` | no |

エラーの処理については[エラー処理](lua/core/errors.md)を参照。

