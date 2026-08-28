---
title: "HTTP"
description: "서버 측 HTTP 요청을 읽고 상태, 헤더, JSON, 스트리밍 및 이벤트 스트림 응답을 구성합니다."
---

# HTTP
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>

`http` 모듈은 현재 서버 측 요청을 읽고 헤더, 라우트 데이터, 본문, 스트리밍 출력 및 Server-Sent Events를 포함한 응답을 구성합니다.

이 페이지는 부분적인 handler 예제를 제공하는 API 레퍼런스입니다. `id`, `data`, `token`과 애플리케이션 callback은 주변 handler가 제공합니다. 요청 accessor는 일반적으로 `value, error`를 반환하고 응답 변경은 `error`를 반환하므로 결과를 사용하는 예제는 에러를 확인합니다.

서버 설정은 [HTTP 서버](http/server.md)를 참조하세요.

## 로딩

```lua
local http = require("http")
```

불러오기 전에 실행 엔트리의 `modules:` 목록에 `http`를 추가하세요. `uuid`, `fs`, `time`을 사용하는 예제는 해당 모듈도 별도로 요구합니다.

## 요청 접근

현재 HTTP 요청 컨텍스트 가져오기:

```lua
local req, err = http.request({
    timeout = 5000,        -- 5 second body read timeout
    max_body = 10485760    -- 10MB max body
})
if err then return nil, err end
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `options.timeout` | integer | 본문 읽기 타임아웃 ms (기본값: 300000 / 5분) |
| `options.max_body` | integer | 최대 본문 크기 바이트 (기본값: 120MB) |

**반환:** `Request, error`

## 응답 접근

현재 HTTP 응답 컨텍스트 가져오기:

```lua
local res, err = http.response()
if err then return nil, err end
```

**반환:** `Response, error`

## 요청 메서드

### `method`

```lua
local method, method_err = req:method()
if method_err then return nil, method_err end

if method == http.METHOD.GET then
    return get_resource(id)
elseif method == http.METHOD.POST then
    local data, body_err = req:body_json()
    if body_err then return nil, body_err end
    return create_resource(data)
elseif method == http.METHOD.PUT then
    local data, body_err = req:body_json()
    if body_err then return nil, body_err end
    return update_resource(id, data)
elseif method == http.METHOD.DELETE then
    return delete_resource(id)
end
```

### `path`

```lua
local path, err = req:path()
if err then return nil, err end
print(path)  -- "/api/users/123"

-- Route based on path
if path:match("^/api/") then
    return handle_api(req)
end
```

### `query`

단일 쿼리 파라미터를 가져옵니다.

```lua
-- GET /search?q=hello&page=2&limit=10
local query, query_err = req:query("q")
if query_err then return nil, query_err end

-- With defaults
local page_text, page_err = req:query("page")
if page_err then return nil, page_err end
local page = tonumber(page_text) or 1
```

### `query_params`

모든 쿼리 파라미터를 가져옵니다. 같은 키의 여러 값은 쉼표로 연결됩니다.

```lua
-- GET /search?tags=lua&tags=go&active=true
local params, err = req:query_params()
if err then return nil, err end
-- {tags = "lua,go", active = "true"}

for key, value in pairs(params) do
    print(key .. ": " .. value)
end
```

### `header`

```lua
local uuid = require("uuid")

local auth, auth_err = req:header("Authorization")
if auth_err then return nil, auth_err end
if not auth then
    local type_err = res:set_content_type(http.CONTENT.JSON)
    if type_err then return nil, type_err end
    local status_err = res:set_status(http.STATUS.UNAUTHORIZED)
    if status_err then return nil, status_err end
    return res:write_json({error = "Missing authorization"})
end

local correlation_id, correlation_err = req:header("X-Correlation-ID")
if correlation_err then return nil, correlation_err end
if not correlation_id then
    correlation_id, correlation_err = uuid.v4()
    if correlation_err then return nil, correlation_err end
end
```

### `content_type`

Content-Type 헤더를 가져옵니다.

```lua
local ct, type_err = req:content_type()  -- "application/json; charset=utf-8" or nil
if type_err then return nil, type_err end
```

### `content_length`

Content-Length 헤더 값을 가져옵니다.

```lua
local length, length_err = req:content_length()  -- number of bytes
if length_err then return nil, length_err end
```

### `host`

요청의 `Host` 헤더를 반환합니다.

Host 헤더를 가져옵니다.

```lua
local host, host_err = req:host()  -- "example.com:8080"
if host_err then return nil, host_err end
```

### `param`

URL 라우트 파라미터를 가져옵니다 (`/users/:id` 같은 경로 패턴에서).

```lua
-- Route: /users/:id/posts/:post_id
local id, param_err = req:param("id")
if param_err then return nil, param_err end
local valid = false
if id then
    local validate_err
    valid, validate_err = uuid.validate(id)
    if validate_err then return nil, validate_err end
end
if not valid then
    local type_err = res:set_content_type(http.CONTENT.JSON)
    if type_err then return nil, type_err end
    local status_err = res:set_status(http.STATUS.BAD_REQUEST)
    if status_err then return nil, status_err end
    return res:write_json({error = "Invalid ID format"})
end
```

### `params`

모든 라우트 파라미터를 가져옵니다.

```lua
-- Route: /orgs/:org/repos/:repo/issues/:issue
local p, err = req:params()
if err then return nil, err end
-- {org = "acme", repo = "widget", issue = "123"}

local issue = get_issue(p.org, p.repo, p.issue)
```

### `body`

전체 요청 본문을 문자열로 읽습니다.

```lua
local body, err = req:body()
if err then return nil, err end

-- Parse XML manually
local is_xml, type_err = req:is_content_type("application/xml")
if type_err then return nil, type_err end
if is_xml then
    local data = parse_xml(body)
end

-- Avoid logging raw request bodies; record only non-sensitive metadata.
logger.debug("Request body read", {length = #body})
```

`body()`, `body_json()`, `stream()`, `parse_multipart()`는 같은 요청 본문을 소비합니다. handler마다 하나의 읽기 경로만 선택하세요. `body()`와 `body_json()`은 요청 객체의 타임아웃과 크기 제한을 적용하지만 `stream()`은 증분 방식이며 두 옵션을 적용하지 않습니다.

### `body_json`

본문을 JSON으로 읽고 파싱합니다.

```lua
local data, err = req:body_json()
if err then
    local type_err = res:set_content_type(http.CONTENT.JSON)
    if type_err then return nil, type_err end
    local status_err = res:set_status(http.STATUS.BAD_REQUEST)
    if status_err then return nil, status_err end
    return res:write_json({error = "Invalid JSON: " .. err:message()})
end

-- Validate required fields
if not data.name or not data.email then
    local type_err = res:set_content_type(http.CONTENT.JSON)
    if type_err then return nil, type_err end
    local status_err = res:set_status(http.STATUS.BAD_REQUEST)
    if status_err then return nil, status_err end
    return res:write_json({error = "Missing required fields"})
end

local user = create_user(data)
```

### `has_body`

요청에 본문이 있는지 확인합니다.

```lua
local has_body, body_state_err = req:has_body()
if body_state_err then return nil, body_state_err end
if has_body then
    local data, body_err = req:body_json()
    if body_err then return nil, body_err end
    process(data)
else
    local type_err = res:set_content_type(http.CONTENT.JSON)
    if type_err then return nil, type_err end
    local status_err = res:set_status(http.STATUS.BAD_REQUEST)
    if status_err then return nil, status_err end
    return res:write_json({error = "Request body required"})
end
```

`has_body()`는 본문 객체와 양의 `Content-Length`가 모두 있을 때만 `true`입니다. chunked 요청처럼 길이를 알 수 없는 본문은 `false`일 수 있으므로 허용하는 handler는 선택한 본문 reader를 직접 시도하고 에러를 처리해야 합니다.

### `is_content_type`

```lua
local is_json, type_check_err = req:is_content_type("application/json")
if type_check_err then return nil, type_check_err end
if not is_json then
    local type_err = res:set_content_type(http.CONTENT.JSON)
    if type_err then return nil, type_err end
    local status_err = res:set_status(415)
    if status_err then return nil, status_err end
    return res:write_json({error = "Content-Type must be application/json"})
end
```

### `accepts`

요청이 지정한 콘텐츠 타입을 허용하는지 확인합니다.

```lua
local accepts_json, json_accept_err = req:accepts("application/json")
if json_accept_err then return nil, json_accept_err end
local accepts_html, html_accept_err = req:accepts("text/html")
if html_accept_err then return nil, html_accept_err end

if accepts_json then
    return res:write_json(data)
elseif accepts_html then
    local type_err = res:set_content_type("text/html; charset=utf-8")
    if type_err then return nil, type_err end
    return res:write(render_html(data))
else
    local type_err = res:set_content_type(http.CONTENT.JSON)
    if type_err then return nil, type_err end
    local status_err = res:set_status(http.STATUS.NOT_ACCEPTABLE)
    if status_err then return nil, status_err end
    return res:write_json({error = "Cannot produce acceptable response"})
end
```

고정된 `accepts()` helper는 쉼표로 구분된 정확한 값과 `*/*`만 처리합니다. media-type 파라미터, subtype wildcard, quality weight는 처리하지 않으며 `Accept` 헤더가 없으면 `false`입니다.

### `remote_addr`

```lua
local addr, addr_err = req:remote_addr()  -- "192.168.1.100:54321"
if addr_err then return nil, addr_err end

-- Extract the host from IPv4 and bracketed IPv6 addresses
local ip = addr:match("^%[([^%]]+)%]:%d+$")
    or addr:match("^([^:]+):%d+$")
    or addr

-- Rate limiting by IP
if rate_limiter:is_limited(ip) then
    local type_err = res:set_content_type(http.CONTENT.JSON)
    if type_err then return nil, type_err end
    local status_err = res:set_status(http.STATUS.TOO_MANY_REQUESTS)
    if status_err then return nil, status_err end
    return res:write_json({error = "Too many requests"})
end
```

### `parse_multipart`

multipart 폼 데이터(파일 업로드)를 파싱합니다. 선택적 `max_memory` 정수(임시 파일로 넘기기 전 메모리에 보관하는 바이트 수, 기본값 32MB)를 받습니다.

```lua
local uuid = require("uuid")

local form, err = req:parse_multipart()  -- or req:parse_multipart(8 * 1024 * 1024)
if err then
    local type_err = res:set_content_type(http.CONTENT.JSON)
    if type_err then return nil, type_err end
    local status_err = res:set_status(http.STATUS.BAD_REQUEST)
    if status_err then return nil, status_err end
    return res:write_json({error = "Invalid form data"})
end

-- Access form values
local title = form.values.title
local description = form.values.description

-- Access uploaded files
if form.files.avatar then
    local file = form.files.avatar[1]
    local filename, name_err = file:name()        -- untrusted client metadata
    if name_err then return nil, name_err end
    local size, size_err = file:size()
    if size_err then return nil, size_err end
    local content_type, header_err = file:header("Content-Type")  -- "image/jpeg"
    if header_err then return nil, header_err end

    -- Stream the upload to a configured filesystem volume
    local fs = require("fs")
    local uploads, fs_err = fs.get("app:avatars")
    if fs_err then
        return nil, fs_err
    end

    local stream, stream_err = file:stream()
    if stream_err then return nil, stream_err end
    local stored_name, id_err = uuid.v7()
    if id_err then
        stream:close()
        return nil, id_err
    end
    local _, write_err = uploads:writefile(stored_name, stream, "wx")
    local _, close_err = stream:close()
    if write_err then return nil, write_err end
    if close_err then return nil, close_err end
end

-- Handle multiple files
if form.files.documents then
    for _, file in ipairs(form.files.documents) do
        process_document(file)
    end
end
```

multipart 필드는 한 번 나타나면 문자열, 반복되면 배열입니다. 업로드 파일 이름과 `Content-Type`은 신뢰할 수 없는 메타데이터로 취급하세요. 배타적 `wx` 쓰기는 기존 객체 덮어쓰기를 막지만, 실패한 대상이 이 요청 소유임을 증명하지 않으므로 임의로 삭제하면 안 됩니다.

### `stream`

대용량 파일용 요청 본문을 스트림으로 가져옵니다.

```lua
local stream, stream_err = req:stream()
if stream_err then return nil, stream_err end

-- Process in chunks
local read_err
while true do
    local chunk
    chunk, read_err = stream:read(65536)  -- 64KB chunks
    if read_err or not chunk then break end
    process_chunk(chunk)
end
local _, close_err = stream:close()
if read_err then return nil, read_err end
if close_err then return nil, close_err end
```

## 응답 메서드

### `set_status`

`set_status()`는 상태를 쓰고 응답 헤더를 즉시 확정합니다. 먼저 `set_header()`, `set_content_type()`, `set_transfer()`를 호출하세요. 이후 헤더 변경은 `errors.INVALID`를 반환합니다.

```lua
local status_err = res:set_status(http.STATUS.CREATED)
if status_err then return nil, status_err end

-- Other common choices: 204 No Content, 400 Bad Request,
-- 401 Unauthorized, 403 Forbidden, 404 Not Found, and 500 Internal Error.
```

### `set_header`

```lua
local request_id_err = res:set_header("X-Request-ID", correlation_id)
if request_id_err then return nil, request_id_err end
local cache_err = res:set_header("Cache-Control", "max-age=3600")
if cache_err then return nil, cache_err end
local rate_err = res:set_header("X-RateLimit-Remaining", tostring(remaining))
if rate_err then return nil, rate_err end

-- CORS headers
local origin_err = res:set_header("Access-Control-Allow-Origin", "*")
if origin_err then return nil, origin_err end
local methods_err = res:set_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE")
if methods_err then return nil, methods_err end
local headers_err = res:set_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
if headers_err then return nil, headers_err end
```

### `set_content_type`

```lua
local type_err = res:set_content_type(http.CONTENT.JSON)
if type_err then return nil, type_err end

-- Other examples: "text/html; charset=utf-8" or "application/pdf".
```

### `write`

응답 본문에 씁니다.

```lua
local write_err = res:write("Hello, World!")
if write_err then return nil, write_err end

-- Build response incrementally
for _, fragment in ipairs({
    "<html><body>",
    "<h1>Title</h1>",
    "<p>Content</p>",
    "</body></html>"
}) do
    local fragment_err = res:write(fragment)
    if fragment_err then return nil, fragment_err end
end
```

### `write_json`

값을 JSON으로 인코딩하고 씁니다.

```lua
-- Success response
local write_err = res:write_json({
    data = users,
    total = count,
    page = page
})
if write_err then return nil, write_err end

-- Error response
local type_err = res:set_content_type(http.CONTENT.JSON)
if type_err then return nil, type_err end
local status_err = res:set_status(http.STATUS.BAD_REQUEST)
if status_err then return nil, status_err end
local error_write_err = res:write_json({
    error = "Validation failed",
    details = {
        {field = "email", message = "Invalid format"},
        {field = "age", message = "Must be positive"}
    }
})
if error_write_err then return nil, error_write_err end
```

`write()`, `write_json()`, `flush()`, `write_event()`도 헤더를 확정합니다. `write_json()`은 아직 헤더가 확정되지 않은 경우에만 `Content-Type: application/json`을 설정합니다.

### `flush`

버퍼된 데이터를 클라이언트로 플러시합니다.

<code-block lang="lua">
-- Stream progress updates
for i = 1, 100 do
    local write_err = res:write(string.format("Progress: %d%%\n", i))
    if write_err then return nil, write_err end
    local flush_err = res:flush()
    if flush_err then return nil, flush_err end
    local _, sleep_err = time.sleep("100ms")
    if sleep_err then return nil, sleep_err end
end
</code-block>

### `set_transfer`

스트리밍용 전송 인코딩을 설정합니다.

```lua
-- Chunked transfer
local transfer_err = res:set_transfer(http.TRANSFER.CHUNKED)
if transfer_err then return nil, transfer_err end
for chunk in get_chunks() do
    local write_err = res:write(chunk)
    if write_err then return nil, write_err end
    local flush_err = res:flush()
    if flush_err then return nil, flush_err end
end

-- Server-Sent Events
local sse_err = res:set_transfer(http.TRANSFER.SSE)
if sse_err then return nil, sse_err end
```

### `write_event`

Server-Sent Event를 씁니다.

```lua
-- Real-time updates
local transfer_err = res:set_transfer(http.TRANSFER.SSE)
if transfer_err then return nil, transfer_err end

local connected_err = res:write_event({name = "connected", data = {client_id = client_id}})
if connected_err then return nil, connected_err end

for progress in task:progress() do
    local event_err = res:write_event({name = "progress", data = {percent = progress}})
    if event_err then return nil, event_err end
end

local complete_err = res:write_event({name = "complete", data = {result = result}})
if complete_err then return nil, complete_err end

-- Chat messages
local message_err = res:write_event({name = "message", data = {
    from = "alice",
    text = "Hello!",
    timestamp = time.now():unix()
}})
if message_err then return nil, message_err end
```

## 상수

### HTTP 메서드

```lua
http.METHOD.GET
http.METHOD.POST
http.METHOD.PUT
http.METHOD.DELETE
http.METHOD.PATCH
http.METHOD.HEAD
http.METHOD.OPTIONS
```

### 상태 코드

```lua
-- Success (2xx)
http.STATUS.OK                   -- 200
http.STATUS.CREATED              -- 201
http.STATUS.ACCEPTED             -- 202
http.STATUS.NO_CONTENT           -- 204
http.STATUS.PARTIAL_CONTENT      -- 206

-- Redirect (3xx)
http.STATUS.MOVED_PERMANENTLY    -- 301
http.STATUS.FOUND                -- 302
http.STATUS.SEE_OTHER            -- 303
http.STATUS.NOT_MODIFIED         -- 304
http.STATUS.TEMPORARY_REDIRECT   -- 307
http.STATUS.PERMANENT_REDIRECT   -- 308

-- Client Error (4xx)
http.STATUS.BAD_REQUEST          -- 400
http.STATUS.UNAUTHORIZED         -- 401
http.STATUS.PAYMENT_REQUIRED     -- 402
http.STATUS.FORBIDDEN            -- 403
http.STATUS.NOT_FOUND            -- 404
http.STATUS.METHOD_NOT_ALLOWED   -- 405
http.STATUS.NOT_ACCEPTABLE       -- 406
http.STATUS.CONFLICT             -- 409
http.STATUS.GONE                 -- 410
http.STATUS.UNPROCESSABLE        -- 422
http.STATUS.TOO_MANY_REQUESTS    -- 429

-- Server Error (5xx)
http.STATUS.INTERNAL_ERROR       -- 500 (alias: INTERNAL_SERVER_ERROR)
http.STATUS.NOT_IMPLEMENTED      -- 501
http.STATUS.BAD_GATEWAY          -- 502
http.STATUS.SERVICE_UNAVAILABLE  -- 503
http.STATUS.GATEWAY_TIMEOUT      -- 504
http.STATUS.VERSION_NOT_SUPPORTED -- 505
```

### 콘텐츠 타입

```lua
http.CONTENT.JSON       -- "application/json"
http.CONTENT.FORM       -- "application/x-www-form-urlencoded"
http.CONTENT.MULTIPART  -- "multipart/form-data"
http.CONTENT.TEXT       -- "text/plain"
http.CONTENT.STREAM     -- "application/octet-stream"
```

### 전송 모드

```lua
http.TRANSFER.CHUNKED   -- "chunked"
http.TRANSFER.SSE       -- "sse"
```

### 레거시 에러 타입 상수

모듈은 호환성을 위해 이 문자열을 내보내지만 현재 요청 및 응답 메서드는 이를 반환하지 않습니다. 런타임 실패는 아래의 구조화된 `errors.*` 종류를 사용합니다.

```lua
http.ERROR.PARSE_FAILED   -- Form/multipart parse error
http.ERROR.INVALID_STATE  -- Invalid response state
http.ERROR.WRITE_FAILED   -- Response write error
http.ERROR.STREAM_ERROR   -- Body stream error
```

## 에러

| 조건 | 종류 | 재시도 가능 |
|------|------|-------------|
| HTTP 컨텍스트 없음 | `errors.INTERNAL` | 아니오 |
| 본문 너무 큼 | `errors.INVALID` | 아니오 |
| 읽기 타임아웃 | `errors.INTERNAL` | 아니오 |
| 잘못된 JSON | `errors.INVALID` | 아니오 |
| multipart 아님 | `errors.INVALID` | 아니오 |
| 헤더 이미 전송됨 | `errors.INVALID` | 아니오 |
| 쓰기 실패 | `errors.INTERNAL` | 아니오 |

에러 처리는 [에러 처리](lua/core/errors.md)를 참조하세요.
