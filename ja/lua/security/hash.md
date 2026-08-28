---
title: "ハッシュ関数"
description: "暗号学的ハッシュ、HMAC値、PBKDF2鍵、FNV-1ハッシュを計算します。"
---

# ハッシュ関数
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>
<secondary-label ref="encoding"/>

`hash`モジュールは、暗号学的ハッシュ、HMAC値、PBKDF2で導出した鍵、非暗号学的なFNV-1ハッシュを計算します。このページは独立した呼び出しを示すAPIリファレンスです。リテラル入力は正常な使用例を示しています。データ、シークレット、パスワード、ソルトをアプリケーションから受け取る場合は、結果を使用する前に、文書化された2番目の`error`戻り値を取得して処理してください。

ハッシュは暗号化ではなく、エントロピーの低い入力を秘匿しません。パスワード、HMAC鍵、導出鍵、シークレットに依存する生のダイジェストをログに記録しないでください。新しいメッセージ認証設計にはHMAC-SHA256またはHMAC-SHA512を使用し、パスワード検証子には一意なランダムソルトを指定したPBKDF2を使用してください。

## ロード

```lua
local hash = require("hash")
```

## 暗号学的ハッシュ

### MD5

MD5には衝突耐性がありません。セキュリティ上の判断には使用せず、MD5を必要とするプロトコルとの互換性のためだけに使用してください。

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

SHA-1には衝突耐性がありません。セキュリティ上の判断には使用せず、SHA-1を必要とするプロトコルとの互換性のためだけに使用してください。

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

## HMAC

### HMAC-MD5

HMAC-MD5は、それを必要とするプロトコルとの互換性のためだけに使用してください。新しい設計ではHMAC-SHA256またはHMAC-SHA512を推奨します。

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

HMAC-SHA1は、それを必要とするプロトコルとの互換性のためだけに使用してください。新しい設計ではHMAC-SHA256またはHMAC-SHA512を推奨します。

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

### FNV-1 32-bit

ハッシュテーブルとパーティショニング用の高速ハッシュです。

```lua
local n = hash.fnv32("data")
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `data` | string | ハッシュするデータ |

**戻り値:** `number, error`

### FNV-1 64-bit

衝突を減らすための大きな出力を持つ高速ハッシュです。

```lua
local n = hash.fnv64("data")
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `data` | string | ハッシュするデータ |

**戻り値:** `number, error`

Luaの数値では、すべての符号なし64ビット整数を正確に表現できません。正確な64ビット値をLuaとの間で往復させる必要がある場合は`fnv64`を使用せず、適切なプロトコル実装が提供するバイト列または文字列表現を使用してください。

## 鍵導出

### PBKDF2-HMAC

PBKDF2-HMAC-SHA256またはPBKDF2-HMAC-SHA512で生の鍵バイト列を導出します。

```lua
local key, err = hash.pbkdf2(password, salt, 600000, 32)
if err then
    return nil, err
end
local key512, err = hash.pbkdf2(password, salt, 600000, 32, "sha512")
if err then
    return nil, err
end
```

ここでは、`password`はアプリケーションのシークレット境界を通じて渡され、`salt`は検証子と一緒に保存する新しいランダムバイト列です。戻り値は表示可能なテキストではなく、生の鍵バイト列です。

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `password` | string | 空でないパスワードまたはシークレット入力 |
| `salt` | string | 空でないソルトのバイト列 |
| `iterations` | integer | 10,000,000以下の正の反復回数 |
| `key_length` | integer | 正の出力長（バイト） |
| `algo` | string? | `sha256`（デフォルト）または`sha512` |

**戻り値:** `string, error`（生の導出鍵バイト列）

## エラー

| 条件 | 種別 | 再試行可能 |
|-----------|------|-----------|
| 入力が文字列でない | `errors.INVALID` | いいえ |
| シークレットが文字列でない（HMAC） | `errors.INVALID` | いいえ |
| PBKDF2のパスワードまたはソルトが空、制限値が不正、またはアルゴリズムが未対応 | `errors.INVALID` | いいえ |

エラーの扱いについては、[エラー処理](lua/core/errors.md)を参照してください。
