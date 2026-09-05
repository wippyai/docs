---
title: "Base64 Encoding"
description: "Encode binary data to base64 strings and decode base64 back to binary. Uses standard base64 encoding per RFC 4648."
---

# Base64 Encoding
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>
<secondary-label ref="encoding"/>

Encode binary data to base64 strings and decode base64 back to binary. Uses standard base64 encoding per RFC 4648.

## Loading

```lua
local base64 = require("base64")
```

## Encoding

### Encode Data

Encodes a string (including binary data) to base64.

```lua
-- Encode text
local encoded = base64.encode("Hello, World!")
print(encoded)  -- "SGVsbG8sIFdvcmxkIQ=="

-- Encode binary data (e.g., from file)
local image_data = fs.get("app:data"):readfile("photo.jpg")
local image_b64 = base64.encode(image_data)

-- Encode JSON for transport
local json = require("json")
local payload = json.encode({user = "alice", action = "login"})
local token_part = base64.encode(payload)

-- Encode credentials
local credentials = base64.encode("username:password")
local auth_header = "Basic " .. credentials
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `data` | string | Data to encode (text or binary) |

**Returns:** `string, error` - Empty string input returns empty string.

## Decoding

### Decode Data

Decodes a base64 string back to original data.

```lua
-- Decode text
local decoded = base64.decode("SGVsbG8sIFdvcmxkIQ==")
print(decoded)  -- "Hello, World!"

-- Decode with error handling
local data, err = base64.decode(user_input)
if err then
    return nil, errors.new("Invalid base64 data"):kind(errors.INVALID)
end

-- Decode binary data
local image_b64 = request.body
local image_data, err = base64.decode(image_b64)
if err then
    return nil, err
end
fs.get("app:data"):writefile("output.jpg", image_data)

-- Decode a base64-wrapped JSON document
local json = require("json")
local doc = json.decode(base64.decode(encoded_json))
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `data` | string | Base64 encoded string |

**Returns:** `string, error` - Empty string input returns empty string.

## Errors

| Condition | Kind | Retryable |
|-----------|------|-----------|
| Input not a string | `errors.INVALID` | no |
| Invalid base64 characters | `errors.INVALID` | no |
| Corrupted padding | `errors.INVALID` | no |

See [Error Handling](lua/core/errors.md) for working with errors.
