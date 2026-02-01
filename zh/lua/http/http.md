# HTTP
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>

处理 HTTP 请求并构建响应。访问请求数据、路由参数、头部和正文内容。使用状态码、头部和流式支持构建响应。

服务器配置请参见 [HTTP 服务器](http/server.md)。

## 加载

```lua
local http = require("http")
```

## 访问请求

获取当前 HTTP 请求上下文：

```lua
local req = http.request()

-- With options
local req = http.request({
    timeout = 5000,        -- 5 second body read timeout
    max_body = 10485760    -- 10MB max body
})
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `options.timeout` | integer | 正文读取超时时间（毫秒）（默认：300000 / 5 分钟） |
| `options.max_body` | integer | 最大正文大小（字节）（默认：120MB） |

**返回:** `Request, error`

## 访问响应

获取当前 HTTP 响应上下文：

```lua
local res = http.response()
```

**返回:** `Response, error`

## 请求方法

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

-- Route based on path
if path:match("^/api/") then
    return handle_api(req)
end
```

### query

获取单个查询参数。

```lua
-- GET /search?q=hello&page=2&limit=10
local query = req:query("q")        -- "hello"
local page = req:query("page")      -- "2"
local missing = req:query("foo")    -- nil

-- With defaults
local page = tonumber(req:query("page")) or 1
local limit = tonumber(req:query("limit")) or 20
local sort = req:query("sort") or "created_at"
```

### query_params

获取所有查询参数。同一键的多个值用逗号连接。

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

获取 Content-Type 头部。

```lua
local ct = req:content_type()  -- "application/json; charset=utf-8" or nil
```

### content_length

获取 Content-Length 头部值。

```lua
local length = req:content_length()  -- number of bytes
```

### host

获取 Host 头部。

```lua
local host = req:host()  -- "example.com:8080"
```

### param

获取 URL 路由参数（来自 `/users/:id` 这样的路径模式）。

```lua
-- Route: /users/:id/posts/:post_id
local user_id = req:param("id")
local post_id = req:param("post_id")

-- Validate parameter
local id = req:param("id")
if not id or not uuid.validate(id) then
    res:set_status(400)
    return res:write_json({error = "Invalid ID format"})
end
```

### params

获取所有路由参数。

```lua
-- Route: /orgs/:org/repos/:repo/issues/:issue
local p = req:params()
-- {org = "acme", repo = "widget", issue = "123"}

local issue = get_issue(p.org, p.repo, p.issue)
```

### body

读取完整的请求正文作为字符串。

```lua
local body = req:body()

-- Parse XML manually
if req:is_content_type("application/xml") then
    local data = parse_xml(body)
end

-- Log raw body for debugging
logger.debug("Request body", {body = body, length = #body})
```

### body_json

读取并解析正文为 JSON。

```lua
local data, err = req:body_json()
if err then
    res:set_status(400)
    return res:write_json({error = "Invalid JSON: " .. err:message()})
end

-- Validate required fields
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

-- Extract IP only
local ip = addr:match("^([^:]+)")

-- Rate limiting by IP
if rate_limiter:is_limited(ip) then
    res:set_status(429)
    return res:write_json({error = "Too many requests"})
end
```

### parse_multipart

解析 multipart 表单数据（文件上传）。

```lua
local form, err = req:parse_multipart()
if err then
    res:set_status(400)
    return res:write_json({error = "Invalid form data"})
end

-- Access form values
local title = form.values.title
local description = form.values.description

-- Access uploaded files
if form.files.avatar then
    local file = form.files.avatar[1]
    local filename = file:name()        -- "photo.jpg"
    local size = file:size()            -- 102400
    local content_type = file:header("Content-Type")  -- "image/jpeg"

    -- Read file content
    local stream = file:stream()
    local content = stream:read_all()
    stream:close()

    -- Save to storage
    storage.write("avatars/" .. filename, content)
end

-- Handle multiple files
if form.files.documents then
    for _, file in ipairs(form.files.documents) do
        process_document(file)
    end
end
```

### stream

获取请求正文作为流，用于大文件。

```lua
local stream = req:stream()

-- Process in chunks
while true do
    local chunk, err = stream:read(65536)  -- 64KB chunks
    if err or not chunk then break end
    process_chunk(chunk)
end
stream:close()
```

## 响应方法

### set_status

```lua
res:set_status(200)
res:set_status(http.STATUS.CREATED)

-- Common patterns
res:set_status(201)  -- Created
res:set_status(204)  -- No Content (for DELETE)
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

-- CORS headers
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

写入响应正文。

```lua
res:write("Hello, World!")

-- Build response incrementally
res:write("<html><body>")
res:write("<h1>Title</h1>")
res:write("<p>Content</p>")
res:write("</body></html>")
```

### write_json

将值编码为 JSON 并写入。

```lua
-- Success response
res:set_status(200)
res:write_json({
    data = users,
    total = count,
    page = page
})

-- Error response
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

将缓冲数据刷新到客户端。

<code-block lang="lua">
-- Stream progress updates
for i = 1, 100 do
    res:write(string.format("Progress: %d%%\n", i))
    res:flush()
    time.sleep("100ms")
end
</code-block>

### set_transfer

设置流式传输编码。

```lua
-- Chunked transfer
res:set_transfer(http.TRANSFER.CHUNKED)
for chunk in get_chunks() do
    res:write(chunk)
    res:flush()
end

-- Server-Sent Events
res:set_transfer(http.TRANSFER.SSE)
```

### write_event

写入一个 Server-Sent Event。

```lua
-- Real-time updates
res:set_transfer(http.TRANSFER.SSE)

res:write_event({name = "connected", data = {client_id = client_id}})

for progress in task:progress() do
    res:write_event({name = "progress", data = {percent = progress}})
end

res:write_event({name = "complete", data = {result = result}})

-- Chat messages
res:write_event({name = "message", data = {
    from = "alice",
    text = "Hello!",
    timestamp = time.now():unix()
}})
```

## 常量

### HTTP 方法

```lua
http.METHOD.GET
http.METHOD.POST
http.METHOD.PUT
http.METHOD.DELETE
http.METHOD.PATCH
http.METHOD.HEAD
http.METHOD.OPTIONS
```

### 状态码

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
http.STATUS.INTERNAL_ERROR       -- 500
http.STATUS.NOT_IMPLEMENTED      -- 501
http.STATUS.BAD_GATEWAY          -- 502
http.STATUS.SERVICE_UNAVAILABLE  -- 503
http.STATUS.GATEWAY_TIMEOUT      -- 504
http.STATUS.VERSION_NOT_SUPPORTED -- 505
```

### 内容类型

```lua
http.CONTENT.JSON       -- "application/json"
http.CONTENT.FORM       -- "application/x-www-form-urlencoded"
http.CONTENT.MULTIPART  -- "multipart/form-data"
http.CONTENT.TEXT       -- "text/plain"
http.CONTENT.STREAM     -- "application/octet-stream"
```

### 传输模式

```lua
http.TRANSFER.CHUNKED   -- "chunked"
http.TRANSFER.SSE       -- "sse"
```

### 错误类型

用于精确错误处理的模块特定错误类型常量。

```lua
http.ERROR.PARSE_FAILED   -- Form/multipart parse error
http.ERROR.INVALID_STATE  -- Invalid response state
http.ERROR.WRITE_FAILED   -- Response write error
http.ERROR.STREAM_ERROR   -- Body stream error
```

## 错误

| 条件 | 类型 | 可重试 |
|-----------|------|-----------|
| 无 HTTP 上下文 | `errors.INTERNAL` | 否 |
| 正文过大 | `errors.INVALID` | 否 |
| 读取超时 | `errors.INTERNAL` | 否 |
| 无效的 JSON | `errors.INVALID` | 否 |
| 不是 multipart | `errors.INVALID` | 否 |
| 头部已发送 | `errors.INVALID` | 否 |
| 写入失败 | `errors.INTERNAL` | 否 |

参见 [错误处理](lua/core/errors.md) 了解错误处理方法。
