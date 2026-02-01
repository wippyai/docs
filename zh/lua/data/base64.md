# Base64 编码
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>
<secondary-label ref="encoding"/>

将二进制数据编码为 base64 字符串，并将 base64 解码回二进制。使用符合 RFC 4648 的标准 base64 编码。

## 加载

```lua
local base64 = require("base64")
```

## 编码

### 编码数据

将字符串（包括二进制数据）编码为 base64。

```lua
-- Encode text
local encoded = base64.encode("Hello, World!")
print(encoded)  -- "SGVsbG8sIFdvcmxkIQ=="

-- Encode binary data (e.g., from file)
local image_data = fs.read_binary("photo.jpg")
local image_b64 = base64.encode(image_data)

-- Encode JSON for transport
local json = require("json")
local payload = json.encode({user = "alice", action = "login"})
local token_part = base64.encode(payload)

-- Encode credentials
local credentials = base64.encode("username:password")
local auth_header = "Basic " .. credentials
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `data` | string | 要编码的数据（文本或二进制） |

**返回:** `string, error` - 空字符串输入返回空字符串。

## 解码

### 解码数据

将 base64 字符串解码回原始数据。

```lua
-- Decode text
local decoded = base64.decode("SGVsbG8sIFdvcmxkIQ==")
print(decoded)  -- "Hello, World!"

-- Decode with error handling
local data, err = base64.decode(user_input)
if err then
    return nil, errors.new("INVALID", "Invalid base64 data")
end

-- Decode binary data
local image_b64 = request.body
local image_data, err = base64.decode(image_b64)
if err then
    return nil, err
end
fs.write_binary("output.jpg", image_data)

-- Decode JWT parts
local parts = string.split(jwt_token, ".")
local header = json.decode(base64.decode(parts[1]))
local payload = json.decode(base64.decode(parts[2]))
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `data` | string | Base64 编码的字符串 |

**返回:** `string, error` - 空字符串输入返回空字符串。

## 错误

| 条件 | 类型 | 可重试 |
|-----------|------|-----------|
| 输入不是字符串 | `errors.INVALID` | 否 |
| 无效的 base64 字符 | `errors.INVALID` | 否 |
| 损坏的填充 | `errors.INVALID` | 否 |

参见 [错误处理](lua/core/errors.md) 了解错误处理方法。
