# HTTP
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>

HTTP 요청을 처리하고 응답을 빌드합니다. 요청 데이터, 라우트 파라미터, 헤더, 본문 내용에 접근합니다. 상태 코드, 헤더, 스트리밍 지원으로 응답을 빌드합니다.

서버 설정은 [HTTP 서버](http/server.md)를 참조하세요.

## 로딩

```lua
local http = require("http")
```

## 요청 접근

현재 HTTP 요청 컨텍스트 가져오기:

```lua
local req = http.request()

-- 옵션과 함께
local req = http.request({
    timeout = 5000,        -- 5초 본문 읽기 타임아웃
    max_body = 10485760    -- 10MB 최대 본문
})
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `options.timeout` | integer | 본문 읽기 타임아웃 ms (기본값: 300000 / 5분) |
| `options.max_body` | integer | 최대 본문 크기 바이트 (기본값: 120MB) |

**반환:** `Request, error`

## 응답 접근

현재 HTTP 응답 컨텍스트 가져오기:

```lua
local res = http.response()
```

**반환:** `Response, error`

## 요청 메서드

### method

```lua
local method = req:method()

if method == http.METHOD.GET then
    return get_resource(id)
elseif method == http.METHOD.POST then
    return create_resource(req:body_json())
elseif method == http.METHOD.PUT then
    return update_resource(id, req:body_json())
elseif method == http.METHOD.DELETE then
    return delete_resource(id)
end
```

### path

```lua
local path = req:path()
print(path)  -- "/api/users/123"

-- 경로 기반 라우팅
if path:match("^/api/") then
    return handle_api(req)
end
```

### query

단일 쿼리 파라미터를 가져옵니다.

```lua
-- GET /search?q=hello&page=2&limit=10
local query = req:query("q")        -- "hello"
local page = req:query("page")      -- "2"
local missing = req:query("foo")    -- nil

-- 기본값과 함께
local page = tonumber(req:query("page")) or 1
local limit = tonumber(req:query("limit")) or 20
local sort = req:query("sort") or "created_at"
```

### query_params

모든 쿼리 파라미터를 가져옵니다. 같은 키의 여러 값은 쉼표로 연결됩니다.

```lua
-- GET /search?tags=lua&tags=go&active=true
local params = req:query_params()
-- {tags = "lua,go", active = "true"}

for key, value in pairs(params) do
    print(key .. ": " .. value)
end
```

### header

```lua
local auth = req:header("Authorization")
if not auth then
    res:set_status(401)
    return res:write_json({error = "Missing authorization"})
end

local user_agent = req:header("User-Agent")
local correlation_id = req:header("X-Correlation-ID") or uuid.v4()
```

### content_type

Content-Type 헤더를 가져옵니다.

```lua
local ct = req:content_type()  -- "application/json; charset=utf-8" 또는 nil
```

### content_length

Content-Length 헤더 값을 가져옵니다.

```lua
local length = req:content_length()  -- 바이트 수
```

### host

Host 헤더를 가져옵니다.

```lua
local host = req:host()  -- "example.com:8080"
```

### param

URL 라우트 파라미터를 가져옵니다 (`/users/:id` 같은 경로 패턴에서).

```lua
-- 라우트: /users/:id/posts/:post_id
local user_id = req:param("id")
local post_id = req:param("post_id")

-- 파라미터 검증
local id = req:param("id")
if not id or not uuid.validate(id) then
    res:set_status(400)
    return res:write_json({error = "Invalid ID format"})
end
```

### params

모든 라우트 파라미터를 가져옵니다.

```lua
-- 라우트: /orgs/:org/repos/:repo/issues/:issue
local p = req:params()
-- {org = "acme", repo = "widget", issue = "123"}

local issue = get_issue(p.org, p.repo, p.issue)
```

### body

전체 요청 본문을 문자열로 읽습니다.

```lua
local body = req:body()

-- 수동으로 XML 파싱
if req:is_content_type("application/xml") then
    local data = parse_xml(body)
end

-- 디버깅을 위해 raw 본문 로깅
logger.debug("Request body", {body = body, length = #body})
```

### body_json

본문을 JSON으로 읽고 파싱합니다.

```lua
local data, err = req:body_json()
if err then
    res:set_status(400)
    return res:write_json({error = "Invalid JSON: " .. err:message()})
end

-- 필수 필드 검증
if not data.name or not data.email then
    res:set_status(400)
    return res:write_json({error = "Missing required fields"})
end

local user = create_user(data)
```

### has_body

```lua
if req:has_body() then
    local data = req:body_json()
    process(data)
else
    res:set_status(400)
    return res:write_json({error = "Request body required"})
end
```

### is_content_type

```lua
if not req:is_content_type("application/json") then
    res:set_status(415)
    return res:write_json({error = "Content-Type must be application/json"})
end
```

### accepts

```lua
if req:accepts("application/json") then
    res:write_json(data)
elseif req:accepts("text/html") then
    res:set_content_type("text/html")
    res:write(render_html(data))
else
    res:set_status(406)
    res:write_json({error = "Cannot produce acceptable response"})
end
```

### remote_addr

```lua
local addr = req:remote_addr()  -- "192.168.1.100:54321"

-- IP만 추출
local ip = addr:match("^([^:]+)")

-- IP별 속도 제한
if rate_limiter:is_limited(ip) then
    res:set_status(429)
    return res:write_json({error = "Too many requests"})
end
```

### parse_multipart

multipart 폼 데이터(파일 업로드)를 파싱합니다.

```lua
local form, err = req:parse_multipart()
if err then
    res:set_status(400)
    return res:write_json({error = "Invalid form data"})
end

-- 폼 값 접근
local title = form.values.title
local description = form.values.description

-- 업로드된 파일 접근
if form.files.avatar then
    local file = form.files.avatar[1]
    local filename = file:name()        -- "photo.jpg"
    local size = file:size()            -- 102400
    local content_type = file:header("Content-Type")  -- "image/jpeg"

    -- 파일 내용 읽기
    local stream = file:stream()
    local content = stream:read_all()
    stream:close()

    -- 스토리지에 저장
    storage.write("avatars/" .. filename, content)
end

-- 여러 파일 처리
if form.files.documents then
    for _, file in ipairs(form.files.documents) do
        process_document(file)
    end
end
```

### stream

대용량 파일용 요청 본문을 스트림으로 가져옵니다.

```lua
local stream = req:stream()

-- 청크로 처리
while true do
    local chunk, err = stream:read(65536)  -- 64KB 청크
    if err or not chunk then break end
    process_chunk(chunk)
end
stream:close()
```

## 응답 메서드

### set_status

```lua
res:set_status(200)
res:set_status(http.STATUS.CREATED)

-- 일반 패턴
res:set_status(201)  -- Created
res:set_status(204)  -- No Content (DELETE용)
res:set_status(400)  -- Bad Request
res:set_status(401)  -- Unauthorized
res:set_status(403)  -- Forbidden
res:set_status(404)  -- Not Found
res:set_status(500)  -- Internal Server Error
```

### set_header

```lua
res:set_header("X-Request-ID", correlation_id)
res:set_header("Cache-Control", "max-age=3600")
res:set_header("X-RateLimit-Remaining", tostring(remaining))

-- CORS 헤더
res:set_header("Access-Control-Allow-Origin", "*")
res:set_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE")
res:set_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
```

### set_content_type

```lua
res:set_content_type("application/json")
res:set_content_type(http.CONTENT.JSON)
res:set_content_type("text/html; charset=utf-8")
res:set_content_type("application/pdf")
```

### write

응답 본문에 씁니다.

```lua
res:write("Hello, World!")

-- 점진적으로 응답 빌드
res:write("<html><body>")
res:write("<h1>Title</h1>")
res:write("<p>Content</p>")
res:write("</body></html>")
```

### write_json

값을 JSON으로 인코딩하고 씁니다.

```lua
-- 성공 응답
res:set_status(200)
res:write_json({
    data = users,
    total = count,
    page = page
})

-- 에러 응답
res:set_status(400)
res:write_json({
    error = "Validation failed",
    details = {
        {field = "email", message = "Invalid format"},
        {field = "age", message = "Must be positive"}
    }
})
```

### flush

버퍼된 데이터를 클라이언트로 플러시합니다.

<code-block lang="lua">
-- 진행 상황 업데이트 스트리밍
for i = 1, 100 do
    res:write(string.format("Progress: %d%%\n", i))
    res:flush()
    time.sleep("100ms")
end
</code-block>

### set_transfer

스트리밍용 전송 인코딩을 설정합니다.

```lua
-- 청크 전송
res:set_transfer(http.TRANSFER.CHUNKED)
for chunk in get_chunks() do
    res:write(chunk)
    res:flush()
end

-- Server-Sent Events
res:set_transfer(http.TRANSFER.SSE)
```

### write_event

Server-Sent Event를 씁니다.

```lua
-- 실시간 업데이트
res:set_transfer(http.TRANSFER.SSE)

res:write_event({name = "connected", data = {client_id = client_id}})

for progress in task:progress() do
    res:write_event({name = "progress", data = {percent = progress}})
end

res:write_event({name = "complete", data = {result = result}})

-- 채팅 메시지
res:write_event({name = "message", data = {
    from = "alice",
    text = "Hello!",
    timestamp = time.now():unix()
}})
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
-- 성공 (2xx)
http.STATUS.OK                   -- 200
http.STATUS.CREATED              -- 201
http.STATUS.ACCEPTED             -- 202
http.STATUS.NO_CONTENT           -- 204
http.STATUS.PARTIAL_CONTENT      -- 206

-- 리다이렉트 (3xx)
http.STATUS.MOVED_PERMANENTLY    -- 301
http.STATUS.FOUND                -- 302
http.STATUS.SEE_OTHER            -- 303
http.STATUS.NOT_MODIFIED         -- 304
http.STATUS.TEMPORARY_REDIRECT   -- 307
http.STATUS.PERMANENT_REDIRECT   -- 308

-- 클라이언트 에러 (4xx)
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

-- 서버 에러 (5xx)
http.STATUS.INTERNAL_ERROR       -- 500
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

### 에러 타입

정밀한 에러 처리를 위한 모듈별 에러 타입 상수.

```lua
http.ERROR.PARSE_FAILED   -- 폼/multipart 파싱 에러
http.ERROR.INVALID_STATE  -- 잘못된 응답 상태
http.ERROR.WRITE_FAILED   -- 응답 쓰기 에러
http.ERROR.STREAM_ERROR   -- 본문 스트림 에러
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
