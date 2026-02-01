# HTTP 클라이언트
<secondary-label ref="network"/>
<secondary-label ref="io"/>
<secondary-label ref="permissions"/>

외부 서비스에 HTTP 요청을 보냅니다. 모든 HTTP 메서드, 헤더, 쿼리 파라미터, 폼 데이터, 파일 업로드, 스트리밍 응답, 동시 배치 요청을 지원합니다.

## 로딩

```lua
local http_client = require("http_client")
```

## HTTP 메서드

모든 메서드는 동일한 시그니처를 공유합니다: `method(url, options?)` 반환 `Response, error`.

### GET 요청

```lua
local resp, err = http_client.get("https://api.example.com/users")
if err then
    return nil, err
end

print(resp.status_code)  -- 200
print(resp.body)         -- 응답 본문
```

### POST 요청

```lua
local resp, err = http_client.post("https://api.example.com/users", {
    headers = {["Content-Type"] = "application/json"},
    body = json.encode({name = "Alice", email = "alice@example.com"})
})
```

### PUT 요청

```lua
local resp, err = http_client.put("https://api.example.com/users/123", {
    headers = {["Content-Type"] = "application/json"},
    body = json.encode({name = "Alice Smith"})
})
```

### PATCH 요청

```lua
local resp, err = http_client.patch("https://api.example.com/users/123", {
    body = json.encode({status = "active"})
})
```

### DELETE 요청

```lua
local resp, err = http_client.delete("https://api.example.com/users/123", {
    headers = {["Authorization"] = "Bearer " .. token}
})
```

### HEAD 요청

헤더만 반환하고 본문은 없습니다.

```lua
local resp, err = http_client.head("https://cdn.example.com/file.zip")
local size = resp.headers["Content-Length"]
```

### 커스텀 메서드

```lua
local resp, err = http_client.request("PROPFIND", "https://dav.example.com/folder", {
    headers = {["Depth"] = "1"}
})
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `method` | string | HTTP 메서드 |
| `url` | string | 요청 URL |
| `options` | table | 요청 옵션 (선택적) |

## 요청 옵션

| 필드 | 타입 | 설명 |
|------|------|------|
| `headers` | table | 요청 헤더 `{["Name"] = "value"}` |
| `body` | string | 요청 본문 |
| `query` | table | 쿼리 파라미터 `{key = "value"}` |
| `form` | table | 폼 데이터 (Content-Type 자동 설정) |
| `files` | table | 파일 업로드 (파일 정의 배열) |
| `cookies` | table | 요청 쿠키 `{name = "value"}` |
| `auth` | table | Basic auth `{user = "name", pass = "secret"}` |
| `timeout` | number/string | 타임아웃: 초 단위 숫자 또는 `"30s"`, `"1m"` 같은 문자열 |
| `stream` | boolean | 버퍼링 대신 응답 본문 스트리밍 |
| `max_response_body` | number | 최대 응답 크기 바이트 (0 = 기본값) |
| `unix_socket` | string | Unix 소켓 경로로 연결 |

### 쿼리 파라미터

```lua
local resp, err = http_client.get("https://api.example.com/search", {
    query = {
        q = "lua programming",
        page = "1",
        limit = "20"
    }
})
```

### 헤더와 인증

```lua
local resp, err = http_client.get("https://api.example.com/data", {
    headers = {
        ["Authorization"] = "Bearer " .. token,
        ["Accept"] = "application/json"
    }
})

-- 또는 basic auth 사용
local resp, err = http_client.get("https://api.example.com/data", {
    auth = {user = "admin", pass = "secret"}
})
```

### 폼 데이터

```lua
local resp, err = http_client.post("https://api.example.com/login", {
    form = {
        username = "alice",
        password = "secret123"
    }
})
```

### 파일 업로드

```lua
local resp, err = http_client.post("https://api.example.com/upload", {
    form = {title = "My Document"},
    files = {
        {
            name = "attachment",      -- 폼 필드 이름
            filename = "report.pdf",  -- 원본 파일명
            content = pdf_data,       -- 파일 내용
            content_type = "application/pdf"
        }
    }
})
```

| 파일 필드 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `name` | string | 예 | 폼 필드 이름 |
| `filename` | string | 아니오 | 원본 파일명 |
| `content` | string | 예* | 파일 내용 |
| `reader` | userdata | 예* | 대안: 내용용 io.Reader |
| `content_type` | string | 아니오 | MIME 타입 (기본값: `application/octet-stream`) |

*`content` 또는 `reader` 중 하나가 필수입니다.

### 타임아웃

```lua
-- 숫자: 초
local resp, err = http_client.get(url, {timeout = 30})

-- 문자열: Go duration 형식
local resp, err = http_client.get(url, {timeout = "30s"})
local resp, err = http_client.get(url, {timeout = "1m30s"})
local resp, err = http_client.get(url, {timeout = "1h"})
```

## 응답 객체

| 필드 | 타입 | 설명 |
|------|------|------|
| `status_code` | number | HTTP 상태 코드 |
| `body` | string | 응답 본문 (스트리밍이 아닌 경우) |
| `body_size` | number | 본문 크기 바이트 (스트리밍이면 -1) |
| `headers` | table | 응답 헤더 |
| `cookies` | table | 응답 쿠키 |
| `url` | string | 최종 URL (리다이렉트 후) |
| `stream` | Stream | 스트림 객체 (`stream = true`인 경우) |

```lua
local resp, err = http_client.get("https://api.example.com/data")
if err then
    return nil, err
end

if resp.status_code == 200 then
    local data = json.decode(resp.body)
    print("Content-Type:", resp.headers["Content-Type"])
end
```

## 스트리밍 응답

대용량 응답의 경우, 전체 본문을 메모리에 로드하지 않도록 스트리밍을 사용합니다.

```lua
local resp, err = http_client.get("https://cdn.example.com/large-file.zip", {
    stream = true
})
if err then
    return nil, err
end

-- 청크로 처리
while true do
    local chunk, err = resp.stream:read(65536)
    if err or not chunk then break end
    -- 청크 처리
end
resp.stream:close()
```

| 스트림 메서드 | 반환 | 설명 |
|--------------|------|------|
| `read(size)` | string, error | 최대 `size` 바이트 읽기 |
| `close()` | - | 스트림 닫기 |

## 배치 요청

여러 요청을 동시에 실행합니다.

```lua
local responses, errors = http_client.request_batch({
    {"GET", "https://api.example.com/users"},
    {"GET", "https://api.example.com/products"},
    {"POST", "https://api.example.com/log", {body = "event"}}
})

if errors then
    for i, err in ipairs(errors) do
        if err then
            print("Request " .. i .. " failed:", err)
        end
    end
else
    -- 모두 성공
    for i, resp in ipairs(responses) do
        print("Response " .. i .. ":", resp.status_code)
    end
end
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `requests` | table | `{method, url, options?}` 배열 |

**반환:** `responses, errors` - 요청 위치별로 인덱싱된 배열

**참고:**
- 요청은 동시에 실행됨
- 배치에서는 스트리밍(`stream = true`)이 지원되지 않음
- 결과 배열은 요청 순서와 일치 (1-인덱싱)

## URL 인코딩

### 인코딩

```lua
local encoded = http_client.encode_uri("hello world")
-- "hello+world"

local url = "https://api.example.com/search?q=" .. http_client.encode_uri(query)
```

### 디코딩

```lua
local decoded, err = http_client.decode_uri("hello+world")
-- "hello world"
```

## 권한

HTTP 요청은 보안 정책 평가 대상입니다.

### 보안 액션

| 액션 | 리소스 | 설명 |
|------|--------|------|
| `http_client.request` | URL | 특정 URL에 대한 요청 허용/거부 |
| `http_client.unix_socket` | 소켓 경로 | Unix 소켓 연결 허용/거부 |
| `http_client.private_ip` | IP 주소 | 사설 IP 범위 접근 허용/거부 |

### 접근 확인

```lua
local security = require("security")

if security.can("http_client.request", "https://api.example.com/users") then
    local resp = http_client.get("https://api.example.com/users")
end
```

### SSRF 보호

사설 IP 범위(10.x, 192.168.x, 172.16-31.x, localhost)는 기본적으로 차단됩니다. 접근하려면 `http_client.private_ip` 권한이 필요합니다.

```lua
local resp, err = http_client.get("http://192.168.1.1/admin")
-- Error: not allowed: private IP 192.168.1.1
```

정책 설정은 [보안 모델](system-security.md)을 참조하세요.

## 에러

| 조건 | 종류 | 재시도 가능 |
|------|------|-------------|
| 보안 정책 거부 | `errors.PERMISSION_DENIED` | 아니오 |
| 사설 IP 차단 | `errors.PERMISSION_DENIED` | 아니오 |
| Unix 소켓 거부 | `errors.PERMISSION_DENIED` | 아니오 |
| 잘못된 URL 또는 옵션 | `errors.INVALID` | 아니오 |
| 컨텍스트 없음 | `errors.INTERNAL` | 아니오 |
| 네트워크 실패 | `errors.INTERNAL` | 예 |
| 타임아웃 | `errors.INTERNAL` | 예 |

```lua
local resp, err = http_client.get(url)
if err then
    if errors.is(err, errors.PERMISSION_DENIED) then
        print("Access denied:", err:message())
    elseif err:retryable() then
        print("Temporary error:", err:message())
    end
    return nil, err
end
```

에러 처리는 [에러 처리](lua-errors.md)를 참조하세요.
