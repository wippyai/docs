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

-- Encode binary data from a configured filesystem volume
local fs = require("fs")
local assets = assert(fs.get("app:assets"))
local image_data = assert(assets:readfile("photo.jpg"))
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
    return nil, errors.new({
        message = "Invalid base64 data",
        kind = errors.INVALID
    })
end

-- Decode binary data
local image_b64 = request.body
local image_data, err = base64.decode(image_b64)
if err then
    return nil, err
end
local fs = require("fs")
local output = assert(fs.get("app:output"))
local ok, write_err = output:writefile("output.jpg", image_data)
if write_err then
    return nil, write_err
end

-- Decode the first field from a dot-delimited value
local value = base64.encode("header") .. "." .. base64.encode("payload")
local encoded_field = assert(value:match("^([^.]+)"))
local field, err = base64.decode(encoded_field)
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
