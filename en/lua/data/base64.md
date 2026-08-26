---
title: "Base64 Encoding"
description: "Encode strings and binary data as standard RFC 4648 Base64 and decode them back to bytes."
---

# Base64 Encoding
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>
<secondary-label ref="encoding"/>

The `base64` module encodes strings and binary data using standard RFC 4648 Base64 and decodes them back to bytes.

## Loading

```lua
local base64 = require("base64")
```

## Encoding

### `encode`

Encodes a string, including binary data, as Base64.

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

| Parameter | Type | Description |
|-----------|------|-------------|
| `data` | string | Data to encode (text or binary) |

**Returns:** `string, error` — an empty input returns an empty string

## Decoding

### `decode`

Decodes a Base64 string to its original bytes.

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

| Parameter | Type | Description |
|-----------|------|-------------|
| `data` | string | Base64-encoded string |

**Returns:** `string, error` — an empty input returns an empty string

## Errors

| Condition | Kind | Retryable |
|-----------|------|-----------|
| Input not a string | `errors.INVALID` | no |
| Invalid base64 characters | `errors.INVALID` | no |
| Corrupted padding | `errors.INVALID` | no |

See [Error Handling](lua/core/errors.md) for working with errors.
