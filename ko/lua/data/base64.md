# Base64 인코딩
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>
<secondary-label ref="encoding"/>

바이너리 데이터를 base64 문자열로 인코딩하고 base64를 다시 바이너리로 디코딩합니다. RFC 4648에 따른 표준 base64 인코딩을 사용합니다.

## 로딩

```lua
local base64 = require("base64")
```

## 인코딩

### 데이터 인코딩

문자열(바이너리 데이터 포함)을 base64로 인코딩합니다.

```lua
-- 텍스트 인코딩
local encoded = base64.encode("Hello, World!")
print(encoded)  -- "SGVsbG8sIFdvcmxkIQ=="

-- 바이너리 데이터 인코딩 (예: 파일에서)
local image_data = fs.read_binary("photo.jpg")
local image_b64 = base64.encode(image_data)

-- 전송을 위해 JSON 인코딩
local json = require("json")
local payload = json.encode({user = "alice", action = "login"})
local token_part = base64.encode(payload)

-- 자격 증명 인코딩
local credentials = base64.encode("username:password")
local auth_header = "Basic " .. credentials
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `data` | string | 인코딩할 데이터 (텍스트 또는 바이너리) |

**반환:** `string, error` - 빈 문자열 입력은 빈 문자열 반환.

## 디코딩

### 데이터 디코딩

base64 문자열을 원본 데이터로 디코딩합니다.

```lua
-- 텍스트 디코딩
local decoded = base64.decode("SGVsbG8sIFdvcmxkIQ==")
print(decoded)  -- "Hello, World!"

-- 에러 처리와 함께 디코딩
local data, err = base64.decode(user_input)
if err then
    return nil, errors.new("INVALID", "Invalid base64 data")
end

-- 바이너리 데이터 디코딩
local image_b64 = request.body
local image_data, err = base64.decode(image_b64)
if err then
    return nil, err
end
fs.write_binary("output.jpg", image_data)

-- JWT 부분 디코딩
local parts = string.split(jwt_token, ".")
local header = json.decode(base64.decode(parts[1]))
local payload = json.decode(base64.decode(parts[2]))
```

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

에러 처리는 [에러 처리](lua/core/errors.md)를 참조하세요.
