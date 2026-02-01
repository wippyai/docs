# Base64エンコーディング
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>
<secondary-label ref="encoding"/>

バイナリデータをbase64文字列にエンコードし、base64をバイナリにデコード。RFC 4648に準拠した標準base64エンコーディングを使用。

## ロード

```lua
local base64 = require("base64")
```

## エンコーディング

### データのエンコード

文字列（バイナリデータを含む）をbase64にエンコード。

```lua
-- テキストをエンコード
local encoded = base64.encode("Hello, World!")
print(encoded)  -- "SGVsbG8sIFdvcmxkIQ=="

-- バイナリデータをエンコード（例: ファイルから）
local image_data = fs.read_binary("photo.jpg")
local image_b64 = base64.encode(image_data)

-- 転送用にJSONをエンコード
local json = require("json")
local payload = json.encode({user = "alice", action = "login"})
local token_part = base64.encode(payload)

-- 認証情報をエンコード
local credentials = base64.encode("username:password")
local auth_header = "Basic " .. credentials
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `data` | string | エンコードするデータ（テキストまたはバイナリ） |

**戻り値:** `string, error` - 空文字列入力は空文字列を返す。

## デコーディング

### データのデコード

base64文字列を元のデータにデコード。

```lua
-- テキストをデコード
local decoded = base64.decode("SGVsbG8sIFdvcmxkIQ==")
print(decoded)  -- "Hello, World!"

-- エラー処理付きでデコード
local data, err = base64.decode(user_input)
if err then
    return nil, errors.new("INVALID", "Invalid base64 data")
end

-- バイナリデータをデコード
local image_b64 = request.body
local image_data, err = base64.decode(image_b64)
if err then
    return nil, err
end
fs.write_binary("output.jpg", image_data)

-- JWTパーツをデコード
local parts = string.split(jwt_token, ".")
local header = json.decode(base64.decode(parts[1]))
local payload = json.decode(base64.decode(parts[2]))
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `data` | string | Base64エンコードされた文字列 |

**戻り値:** `string, error` - 空文字列入力は空文字列を返す。

## エラー

| 条件 | 種別 | 再試行可能 |
|-----------|------|-----------|
| 入力が文字列ではない | `errors.INVALID` | no |
| 無効なbase64文字 | `errors.INVALID` | no |
| 破損したパディング | `errors.INVALID` | no |

エラーの処理については[エラー処理](lua-errors.md)を参照。

