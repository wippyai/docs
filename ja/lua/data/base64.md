---
title: "Base64エンコーディング"
description: "バイナリデータをbase64文字列にエンコードし、base64をバイナリにデコード。RFC 4648に準拠した標準base64エンコーディングを使用。"
---

# Base64エンコーディング
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>
<secondary-label ref="encoding"/>

`base64`モジュールは、文字列やバイナリデータを標準RFC 4648 Base64でエンコードし、元のバイト列にデコードします。

これはAPIリファレンスです。出力のみを示す式は成功時の値を例示し、ファイルシステムや転送の例ではデータを利用する前に省略可能な2番目の戻り値`error`を確認します。`username`、`password`、`encoded_image`、`user_input`などの名前は、アプリケーションから渡される文字列です。

Base64はエンコーディングであり、暗号化や認証ではありません。秘密情報を隠したり、データが改変されていないことを検証したりする目的には使用しないでください。Basic認証の資格情報はTLS経由でのみ送信し、リテラルではなくアプリケーションが管理するシークレットストレージから取得してください。

## ロード

```lua
local base64 = require("base64")
```

使用する前に、実行可能エントリの`modules:`リストに`base64`を追加してください。ファイルシステムとJSONの例では、それぞれ`fs`と`json`も必要です。

## エンコーディング

### `encode`

バイナリデータを含む文字列をBase64としてエンコードします。

```lua
-- Encode text
local encoded, err = base64.encode("Hello, World!")
if err then return nil, err end
print(encoded)  -- "SGVsbG8sIFdvcmxkIQ=="

-- バイナリデータをエンコード（例: ファイルから）
local image_data = fs.get("app:data"):readfile("photo.jpg")
local image_b64 = base64.encode(image_data)

-- Encode JSON for transport
local json = require("json")
local payload, json_err = json.encode({user = "alice", action = "login"})
if json_err then return nil, json_err end
local token_part, token_err = base64.encode(payload)
if token_err then return nil, token_err end

-- Encode credentials
local credentials, credentials_err = base64.encode(username .. ":" .. password)
if credentials_err then return nil, credentials_err end
local auth_header = "Basic " .. credentials
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `data` | string | エンコードするデータ（テキストまたはバイナリ） |

**戻り値:** `string, error` — 空の入力は空文字列を返します

## デコーディング

### `decode`

Base64文字列を元のバイト列にデコードします。

```lua
-- Decode text
local decoded, decode_err = base64.decode("SGVsbG8sIFdvcmxkIQ==")
if decode_err then return nil, decode_err end
print(decoded)  -- "Hello, World!"

-- Decode with error handling
local data, err = base64.decode(user_input)
if err then
    return nil, errors.new("Invalid base64 data"):kind(errors.INVALID)
end

-- Decode binary data
local image_data, err = base64.decode(encoded_image)
if err then
    return nil, err
end
fs.get("app:data"):writefile("output.jpg", image_data)

-- base64でラップされたJSONドキュメントをデコード
local json = require("json")
local doc = json.decode(base64.decode(encoded_json))
```

最後のブロックは、区切り文字の処理だけを示しています。署名付きトークン形式の解析や検証は行いません。

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `data` | string | Base64エンコードされた文字列 |

**戻り値:** `string, error` — 空の入力は空文字列を返します

## エラー

| 条件 | 種別 | 再試行可能 |
|-----------|------|-----------|
| 入力が文字列ではない | `errors.INVALID` | いいえ |
| 無効なbase64文字 | `errors.INVALID` | いいえ |
| 破損したパディング | `errors.INVALID` | いいえ |

エラーの処理については、[エラー処理](lua/core/errors.md)を参照してください。
