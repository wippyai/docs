---
title: "Base64 인코딩"
description: "문자열과 binary data를 표준 RFC 4648 Base64로 인코딩하고 다시 byte로 디코딩합니다."
---

# Base64 인코딩
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>
<secondary-label ref="encoding"/>

`base64` 모듈은 문자열과 binary data를 표준 RFC 4648 Base64로 인코딩하고 다시 byte로 디코딩합니다.

이 페이지는 API reference입니다. 출력 전용 expression은 성공 값을 보여 줍니다. filesystem과 transport 예제는 data를 사용하기 전에 optional second `error` return을 확인합니다. `username`, `password`, `encoded_image`, `user_input` 같은 이름은 application에서 제공하는 문자열입니다.

Base64는 encoding이며 encryption이나 authentication이 아닙니다. secret을 감추거나 data가 변조되지 않았음을 확인하는 데 사용하지 마십시오. Basic authentication credential은 TLS를 통해서만 보내고 literal 대신 application-owned secret storage에서 가져오십시오.

## 로딩

```lua
local base64 = require("base64")
```

require하기 전에 executable entry의 `modules:` list에 `base64`를 추가하십시오. filesystem과 JSON 예제에는 각각 `fs`와 `json`도 필요합니다.

## 인코딩

### `encode`

문자열(바이너리 데이터 포함)을 base64로 인코딩합니다.

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

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `data` | string | 인코딩할 데이터 (텍스트 또는 바이너리) |

**반환:** `string, error` - 빈 문자열 입력은 빈 문자열 반환.

## 디코딩

### `decode`

base64 문자열을 원본 데이터로 디코딩합니다.

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

마지막 block은 delimiter 처리만 보여 줍니다. signed token format을 parse하거나 verify하지 않습니다.

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `data` | string | Base64로 인코딩된 문자열 |

**반환:** `string, error` - 빈 문자열 입력은 빈 문자열 반환.

## 에러

| 조건 | 종류 | 재시도 가능 |
|------|------|-------------|
| 입력이 문자열이 아님 | `errors.INVALID` | 아니오 |
| 잘못된 base64 문자 | `errors.INVALID` | 아니오 |
| 손상된 패딩 | `errors.INVALID` | 아니오 |

[에러 처리](lua/core/errors.md)에서 error 사용법을 확인하십시오.
