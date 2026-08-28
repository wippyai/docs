---
title: "暗号化 & 署名"
description: "ランダム値の生成、データ認証、コンテンツ暗号化、JWT検証、鍵導出を行います。"
---

# 暗号化 & 署名
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>
<secondary-label ref="io"/>

`crypto`モジュールは、ランダム値の生成、HMACの計算、データの暗号化と復号、JWTのエンコードと検証、鍵の導出を行います。決定論的ワークフローでは、ランダム生成と暗号化（ランダムなnonceを生成します）は記録される副作用として実行され、リプレイでは記録済みのバイト列が返されます。HMAC、復号、JWT処理、PBKDF2、比較を含むその他の操作は直接実行されます。

このページはAPIリファレンスです。各コードブロックは独立した呼び出しであり、完全な鍵管理システムや認証システムではありません。`data`、`key`、`aad`、`payload`、`token`などの名前は、アプリケーションから渡される値です。鍵とパスワードはアプリケーションのシークレット管理境界を通じて読み込み、ハードコード、ログ出力、診断結果への返却をしないでください。ここに示す`value, error`形式の結果は、値を使用する前にエラーを伝播または処理してください。

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

実装は、指定されたアルファベットからバイト単位で選択します。非ASCIIのアルファベットは不正なUTF-8に分割される可能性があり、剰余による選択が完全に一様になるのはアルファベットのバイト長が256を割り切る場合だけです。一様なランダム性を持つ秘密データには`crypto.random.bytes`を使用し、必要な転送形式に合わせて結果をエンコードしてください。

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

どちらの暗号化関数もnonceを生成して暗号文の先頭に付加します。nonceを削除または再利用せず、復号時には同じAADを使用してください。暗号文は、秘密情報を含まないログ値ではありません。長さや相関に関する情報を漏らす可能性があります。

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

**戻り値:** `string, error`（nonceが前置）

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

文書化されているアルゴリズム名のいずれか一つだけを渡してください。このランタイムの固定バージョンでは、未対応の値を`encode`に渡すとエラーではなくHS256へフォールバックします。設定可能なアルゴリズムは呼び出し前に検証し、信頼できないフィールドを`_header`へコピーしないでください。特に、入力から`alg`などの予約済みJWTヘッダーを上書きさせないでください。

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
| `require_exp` | boolean? | `exp`クレームを必須にする（デフォルト: true） |

**戻り値:** `table, error`

`exp`と`nbf`が存在する場合は常に、ワークフローの時刻基準ではなくJWTライブラリの現在の実時間に対して検証されます。`require_exp = false`を設定すると`exp`クレームの欠落を許容しますが、存在するクレームの検証は無効になりません。時間に依存する結果をリプレイに影響するワークフロー制御に使わないでください。アクティビティ内で確認するか、明示的にリプレイ安全な値と比較して時刻を検証してください。

発行者が想定するアルゴリズムを必ず渡してください。検証ではトークンをその方式だけに制限します。返されたクレームは認証済みデータとして扱いますが、自動的に認可されたアプリケーション入力とは見なさず、発行者、オーディエンス、サブジェクト、アプリケーション固有の制約も検証してください。

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

導出される鍵は生のバイト列です。保存するパスワード検証子ごとに新しいランダムソルトを使用し、ソルトとワークファクターのパラメータを検証子と一緒に保存してください。ソルトを秘密にする必要はありません。本番環境のパスワード保存に固定のサンプルソルトを使用しないでください。

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

長さが異なる場合、結果は`false`です。基盤となる定数時間比較の保証は同じ長さの入力に対して適用されるため、固定長のダイジェストまたは同じ長さのシークレットを比較してください。

## エラー

| 条件 | 種別 | 再試行可能 |
|-----------|------|-----------|
| 無効な長さ | `errors.INVALID` | いいえ |
| 空のキー | `errors.INVALID` | いいえ |
| 無効なキーサイズ | `errors.INVALID` | いいえ |
| 復号失敗 | `errors.INTERNAL` | いいえ |
| トークン期限切れ | `errors.INTERNAL` | いいえ |

エラーの扱いについては、[エラー処理](../core/errors.md)を参照してください。
