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

This is an API reference. Output-only expressions show successful values; filesystem and transport examples check the optional second `error` return before consuming data. Names such as `username`, `password`, `encoded_image`, and `user_input` are application-supplied strings.

Base64 is an encoding, not encryption or authentication. Do not use it to conceal secrets or to verify that data has not been modified. Send Basic authentication credentials only over TLS and obtain them from application-owned secret storage rather than literals.

## Loading

```lua
local base64 = require("base64")
```

Add `base64` to the executable entry's `modules:` list before requiring it. Filesystem and JSON examples also require `fs` and `json` respectively.

## Encoding

### `encode`

Encodes a string, including binary data, as Base64.

```lua
-- Encode text
local encoded, err = base64.encode("Hello, World!")
if err then return nil, err end
print(encoded)  -- "SGVsbG8sIFdvcmxkIQ=="

-- Encode binary data from a configured filesystem volume
local fs = require("fs")
local assets = assert(fs.get("app:assets"))
local image_data = assert(assets:readfile("photo.jpg"))
local image_b64, encode_err = base64.encode(image_data)
if encode_err then return nil, encode_err end

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

| Parameter | Type | Description |
|-----------|------|-------------|
| `data` | string | Data to encode (text or binary) |

**Returns:** `string, error` — an empty input returns an empty string

## Decoding

### `decode`

Decodes a Base64 string to its original bytes.

```lua
-- Decode text
local decoded, decode_err = base64.decode("SGVsbG8sIFdvcmxkIQ==")
if decode_err then return nil, decode_err end
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
local image_data, err = base64.decode(encoded_image)
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
local encoded_header, header_err = base64.encode("header")
if header_err then return nil, header_err end
local encoded_payload, payload_err = base64.encode("payload")
if payload_err then return nil, payload_err end
local value = encoded_header .. "." .. encoded_payload
local encoded_field = assert(value:match("^([^.]+)"))
local field, err = base64.decode(encoded_field)
if err then return nil, err end
```

The final block demonstrates delimiter handling only. It does not parse or verify a signed token format.

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

See [Error Handling](../core/errors.md) for working with errors.
