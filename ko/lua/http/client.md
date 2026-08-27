---
title: "HTTP 클라이언트"
description: "헤더, 인증, 폼, 업로드, TLS 옵션, 스트리밍 및 배치로 HTTP 요청을 전송합니다."
---

# HTTP 클라이언트
<secondary-label ref="network"/>
<secondary-label ref="io"/>
<secondary-label ref="permissions"/>

`http_client` 모듈은 헤더, 쿼리 파라미터, 폼, 파일 업로드, 인증, TLS 옵션, 스트리밍 응답 및 동시 배치로 HTTP 요청을 보냅니다.

이 페이지는 부분적인 요청 예제를 제공하는 API 레퍼런스입니다. URL, 토큰, 자격 증명, 요청 데이터와 인증서 자료는 애플리케이션이 제공합니다. 예제는 응답을 사용하기 전에 `Response, error`를 확인하고 스트리밍 본문을 명시적으로 닫습니다.

## 로딩

```lua
local http_client = require("http_client")
```

모듈을 불러오기 전에 실행 엔트리의 `modules:` 목록에 `http_client`를 추가하세요. JSON 및 파일시스템 예제에는 `json`과 `fs`도 필요합니다.

## HTTP 메서드

모든 메서드는 동일한 시그니처를 공유합니다: `method(url, options?)` 반환 `Response, error`.

### GET 요청

`GET` 요청을 보냅니다.

```lua
local resp, err = http_client.get("https://api.example.com/users")
if err then
    return nil, err
end

print(resp.status_code)  -- 200
print(resp.body)         -- response body
```

### POST 요청

`POST` 요청을 보냅니다.

```lua
local json = require("json")

local body, body_err = json.encode({name = "Alice", email = "alice@example.com"})
if body_err then return nil, body_err end
local resp, err = http_client.post("https://api.example.com/users", {
    headers = {["Content-Type"] = "application/json"},
    body = body
})
if err then return nil, err end
```

### PUT 요청

`PUT` 요청을 보냅니다.

```lua
local body, body_err = json.encode({name = "Alice Smith"})
if body_err then return nil, body_err end
local resp, err = http_client.put("https://api.example.com/users/123", {
    headers = {["Content-Type"] = "application/json"},
    body = body
})
if err then return nil, err end
```

### PATCH 요청

`PATCH` 요청을 보냅니다.

```lua
local body, body_err = json.encode({status = "active"})
if body_err then return nil, body_err end
local resp, err = http_client.patch("https://api.example.com/users/123", {
    headers = {["Content-Type"] = "application/json"},
    body = body
})
if err then return nil, err end
```

### DELETE 요청

`DELETE` 요청을 보냅니다.

```lua
local resp, err = http_client.delete("https://api.example.com/users/123", {
    headers = {["Authorization"] = "Bearer " .. token}
})
if err then return nil, err end
```

### HEAD 요청

`HEAD` 요청은 응답 본문 없이 헤더만 반환합니다.

```lua
local resp, err = http_client.head("https://cdn.example.com/file.zip")
if err then return nil, err end
local size = resp.headers["Content-Length"]
```

### 커스텀 메서드

```lua
local resp, err = http_client.request("PROPFIND", "https://dav.example.com/folder", {
    headers = {["Depth"] = "1"}
})
if err then return nil, err end
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
| `tls` | table | 요청별 TLS 설정 ([TLS 옵션](#tls-options) 참조) |
| `overlay_network` | string | [네트워크 오버레이](../../system/network.md)를 통해 라우팅할 `network.socks5`, `network.tailscale` 또는 `network.i2p` 엔트리의 레지스트리 ID |

`overlay_network`를 선택하려면 해당 네트워크 ID에 대한 `network.select` 권한이 필요합니다.

### 쿼리 파라미터

```lua
local resp, err = http_client.get("https://api.example.com/search", {
    query = {
        q = "lua programming",
        page = "1",
        limit = "20"
    }
})
if err then return nil, err end
```

### 헤더와 인증

```lua
local resp, err = http_client.get("https://api.example.com/data", {
    headers = {
        ["Authorization"] = "Bearer " .. token,
        ["Accept"] = "application/json"
    }
})
if err then return nil, err end

-- Or use basic auth
local resp, err = http_client.get("https://api.example.com/data", {
    auth = {user = service_user, pass = service_password}
})
if err then return nil, err end
```

인증 값은 애플리케이션이 소유한 비밀 저장소에서 읽고 TLS를 통해서만 전송하세요.

### 폼 데이터

```lua
local resp, err = http_client.post("https://api.example.com/login", {
    form = {
        username = username,
        password = password
    }
})
if err then return nil, err end
```

### 파일 업로드

```lua
local resp, err = http_client.post("https://api.example.com/upload", {
    form = {title = "My Document"},
    files = {
        {
            name = "attachment",      -- form field name
            filename = "report.pdf",  -- original filename
            content = pdf_data,       -- file content
            content_type = "application/pdf"
        }
    }
})
if err then return nil, err end
```

| 파일 필드 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `name` | string | 예 | 폼 필드 이름 |
| `filename` | string | 아니오 | 원본 파일명 |
| `content` | string | 예* | 파일 내용 |
| `reader` | userdata | 예* | 대안: 내용용 io.Reader |
| `content_type` | string | 아니오 | 현재 무시됨: 이 필드와 관계없이 각 업로드 파트는 항상 `Content-Type: application/octet-stream`으로 전송됨 |

*`content` 또는 `reader` 중 하나가 필수입니다.

고정된 런타임은 전송 전에 `reader`를 메모리로 모두 읽고 닫지 않으며, EOF가 아닌 읽기 실패를 별도로 노출하지 않습니다. 이미 크기가 제한된 데이터에는 `content`를 사용하고 요청 후 호출자가 소유한 reader를 닫으세요. `content_type` 필드는 파싱되지만 런타임 `v0.3.32a`에서 전달되지 않습니다.

reader 기반 파일은 이 릴리스에서 단일 요청 호출만 지원합니다. `request_batch`는 `content`를 전달하지만 파싱된 `reader`는 버리므로 배치 파일 업로드는 `files[].content`를 제공해야 합니다.

### 타임아웃

```lua
-- Number: seconds
local resp, err = http_client.get(url, {timeout = 30})
if err then return nil, err end

-- String alternatives use Go duration format: "30s", "1m30s", or "1h".
```

### TLS 옵션 {id="tls-options"}

mTLS(상호 TLS) 및 커스텀 CA 인증서를 위한 요청별 TLS 설정을 구성합니다.

| 필드 | 타입 | 설명 |
|------|------|------|
| `cert` | string | PEM 형식의 클라이언트 인증서 |
| `key` | string | PEM 형식의 클라이언트 개인 키 |
| `ca` | string | PEM 형식의 커스텀 CA 인증서 |
| `server_name` | string | SNI 검증을 위한 서버 이름 |
| `insecure_skip_verify` | boolean | TLS 인증서 검증 건너뛰기 |

mTLS를 위해서는 `cert`와 `key`를 함께 제공해야 합니다. `ca` 필드는 시스템 인증서 풀을 커스텀 CA로 대체합니다.

#### mTLS 인증

```lua
local fs = require("fs")
local certs, volume_err = fs.get("app:certs")
if volume_err then return nil, volume_err end
local cert_pem, cert_err = certs:readfile("client.crt")
if cert_err then return nil, cert_err end
local key_pem, key_err = certs:readfile("client.key")
if key_err then return nil, key_err end

local resp, err = http_client.get("https://secure.example.com/api", {
    tls = {
        cert = cert_pem,
        key = key_pem,
    }
})
if err then return nil, err end
```

`insecure_skip_verify`는 제어된 진단 엔드포인트에서만 사용하세요. 인증서 체인과 호스트 이름 검증을 모두 비활성화합니다.

#### 커스텀 CA

```lua
local fs = require("fs")
local certs, volume_err = fs.get("app:certs")
if volume_err then return nil, volume_err end
local ca_pem, ca_err = certs:readfile("internal-ca.crt")
if ca_err then return nil, ca_err end

local resp, err = http_client.get("https://internal.example.com/api", {
    tls = {
        ca = ca_pem,
        server_name = "internal.example.com",
    }
})
if err then return nil, err end
```

#### 안전하지 않은 검증 건너뛰기

개발 환경에서 TLS 검증을 건너뜁니다. `http_client.insecure_tls` 보안 권한이 필요합니다.

```lua
local resp, err = http_client.get("https://localhost:8443/api", {
    tls = {
        insecure_skip_verify = true,
    }
})
if err then return nil, err end
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
    local data, decode_err = json.decode(resp.body)
    if decode_err then return nil, decode_err end
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

-- Process in chunks
local read_err
while true do
    local chunk
    chunk, read_err = resp.stream:read(65536)
    if read_err or not chunk then break end
    -- process chunk
end
local _, close_err = resp.stream:close()
if read_err then return nil, read_err end
if close_err then return nil, close_err end
```

| 스트림 메서드 | 반환 | 설명 |
|--------------|------|------|
| `read(n?)` | string, error | 최대 `n` 바이트 읽기 (기본값: 구현 버퍼) |
| `close()` | boolean, error | 스트림 닫기 |

`resp.stream`은 완전한 [스트림](../core/stream.md) 객체입니다 — `seek`, `stat`, `scanner`도 사용할 수 있습니다. 스트리밍 응답 본문은 호출자가 소유하며 모든 종료 경로에서 닫아야 합니다.

## 배치 요청

`request_batch`는 여러 요청을 동시에 실행합니다.

```lua
local requests = {
    {"GET", "https://api.example.com/users"},
    {"GET", "https://api.example.com/products"},
    {"POST", "https://api.example.com/log", {body = "event"}}
}
local responses, batch_errors = http_client.request_batch(requests)

if not responses then
    return nil, batch_errors  -- whole-batch dispatch or validation failure
end

if batch_errors then
    for i = 1, #requests do
        local err = batch_errors[i]
        if err then
            print("Request " .. i .. " failed:", err)
        end
    end
else
    -- All succeeded
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
- reader 기반 파일 업로드는 배치에서 지원되지 않으므로 `files[].content` 사용
- 결과 배열은 요청 순서와 일치 (1-인덱싱)

## URL 인코딩

### 인코딩

```lua
local encoded = http_client.encode_uri("hello world")
-- "hello+world"

local url = "https://api.example.com/search?q=" .. http_client.encode_uri(query)
```

### 디코딩

`http_client.encode_uri`로 인코딩한 문자열을 디코딩합니다.

```lua
local decoded, err = http_client.decode_uri("hello+world")
if err then return nil, err end
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
| `http_client.insecure_tls` | URL | 안전하지 않은 TLS 허용/거부 (검증 건너뛰기) |
| `network.select` | 네트워크 ID | 명시적인 `overlay_network` 선택 허용/거부 |

### 접근 확인

```lua
local security = require("security")

if security.can("http_client.request", "https://api.example.com/users") then
    local resp, request_err = http_client.get("https://api.example.com/users")
    if request_err then return nil, request_err end
end
```

### SSRF 보호

사설 IP 범위(10.x, 192.168.x, 172.16-31.x, localhost)는 기본적으로 차단됩니다. 접근하려면 `http_client.private_ip` 권한이 필요합니다.

```lua
local resp, err = http_client.get("http://192.168.1.1/admin")
-- Error: not allowed: private IP 192.168.1.1
```

정책 설정은 [보안 모델](../../system/security.md)을 참조하세요.

## 에러

| 조건 | 종류 | 재시도 가능 |
|------|------|-------------|
| 보안 정책 거부 | `errors.PERMISSION_DENIED` | 아니오 |
| 사설 IP 차단 | `errors.PERMISSION_DENIED` | 아니오 |
| Unix 소켓 거부 | `errors.PERMISSION_DENIED` | 아니오 |
| 안전하지 않은 TLS 거부 | `errors.PERMISSION_DENIED` | 아니오 |
| 잘못된 배치 항목, 배치 스트리밍 또는 잘못된 URI escape | `errors.INVALID` | 아니오 |
| 컨텍스트 없음 | `errors.INTERNAL` | 아니오 |
| 잘못된 전송 URL 또는 네트워크 실패 | `errors.INTERNAL` | 예 |
| 타임아웃 | `errors.INTERNAL` | 예 |

지원되지 않는 옵션 값은 구조화된 에러 대신 무시되는 경우가 많습니다. 잘못된 Lua 인자 타입과 빈 배치는 Lua 인자 에러를 발생시킵니다.

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

에러 처리는 [에러 처리](../core/errors.md)를 참조하세요.
