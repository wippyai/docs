# HTTP
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>

Handle HTTP requests and build responses. Access request data, route parameters, headers, and body content. Build responses with status codes, headers, and streaming support.

For server configuration, see [HTTP Server](http/server.md).

## Loading

```lua
local http = require("http")
```

## Accessing the Request

Get the current HTTP request context:

```lua
local req = http.request()

-- With options
local req = http.request({
    timeout = 5000,        -- 5 second body read timeout
    max_body = 10485760    -- 10MB max body
})
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `options.timeout` | integer | Body read timeout in ms (default: 300000 / 5 min) |
| `options.max_body` | integer | Max body size in bytes (default: 120MB) |

**Returns:** `Request, error`

## Accessing the Response

Get the current HTTP response context:

```lua
local res = http.response()
```

**Returns:** `Response, error`

## Request Methods

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

Gets a single query parameter.

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

Gets all query parameters. Multiple values for the same key are joined with commas.

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

Gets the Content-Type header.

```lua
local ct = req:content_type()  -- "application/json; charset=utf-8" or nil
```

### content_length

Gets the Content-Length header value.

```lua
local length = req:content_length()  -- number of bytes
```

### host

Gets the Host header.

```lua
local host = req:host()  -- "example.com:8080"
```

### param

Gets URL route parameters (from path patterns like `/users/:id`).

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

Gets all route parameters.

```lua
-- Route: /orgs/:org/repos/:repo/issues/:issue
local p = req:params()
-- {org = "acme", repo = "widget", issue = "123"}

local issue = get_issue(p.org, p.repo, p.issue)
```

### body

Reads the full request body as string.

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

Reads and parses body as JSON.

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

Parses multipart form data (file uploads).

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

Gets request body as a stream for large files.

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

## Response Methods

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

Writes to response body.

```lua
res:write("Hello, World!")

-- Build response incrementally
res:write("<html><body>")
res:write("<h1>Title</h1>")
res:write("<p>Content</p>")
res:write("</body></html>")
```

### write_json

Encodes value as JSON and writes it.

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

Flushes buffered data to client.

<code-block lang="lua">
-- Stream progress updates
for i = 1, 100 do
    res:write(string.format("Progress: %d%%\n", i))
    res:flush()
    time.sleep("100ms")
end
</code-block>

### set_transfer

Sets transfer encoding for streaming.

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

Writes a Server-Sent Event.

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

## Constants

### HTTP Methods

```lua
http.METHOD.GET
http.METHOD.POST
http.METHOD.PUT
http.METHOD.DELETE
http.METHOD.PATCH
http.METHOD.HEAD
http.METHOD.OPTIONS
```

### Status Codes

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

### Content Types

```lua
http.CONTENT.JSON       -- "application/json"
http.CONTENT.FORM       -- "application/x-www-form-urlencoded"
http.CONTENT.MULTIPART  -- "multipart/form-data"
http.CONTENT.TEXT       -- "text/plain"
http.CONTENT.STREAM     -- "application/octet-stream"
```

### Transfer Modes

```lua
http.TRANSFER.CHUNKED   -- "chunked"
http.TRANSFER.SSE       -- "sse"
```

### Error Types

Module-specific error type constants for precise error handling.

```lua
http.ERROR.PARSE_FAILED   -- Form/multipart parse error
http.ERROR.INVALID_STATE  -- Invalid response state
http.ERROR.WRITE_FAILED   -- Response write error
http.ERROR.STREAM_ERROR   -- Body stream error
```

## Errors

| Condition | Kind | Retryable |
|-----------|------|-----------|
| No HTTP context | `errors.INTERNAL` | no |
| Body too large | `errors.INVALID` | no |
| Read timeout | `errors.INTERNAL` | no |
| Invalid JSON | `errors.INVALID` | no |
| Not multipart | `errors.INVALID` | no |
| Headers already sent | `errors.INVALID` | no |
| Write failed | `errors.INTERNAL` | no |

See [Error Handling](lua/core/errors.md) for working with errors.
