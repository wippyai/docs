# HTTP Client
<secondary-label ref="network"/>
<secondary-label ref="io"/>
<secondary-label ref="permissions"/>

Make HTTP requests to external services. Supports all HTTP methods, headers, query parameters, form data, file uploads, streaming responses, and concurrent batch requests.

## Loading

```lua
local http_client = require("http_client")
```

## HTTP Methods

All methods share the same signature: `method(url, options?)` returning `Response, error`.

### GET Request

```lua
local resp, err = http_client.get("https://api.example.com/users")
if err then
    return nil, err
end

print(resp.status_code)  -- 200
print(resp.body)         -- response body
```

### POST Request

```lua
local resp, err = http_client.post("https://api.example.com/users", {
    headers = {["Content-Type"] = "application/json"},
    body = json.encode({name = "Alice", email = "alice@example.com"})
})
```

### PUT Request

```lua
local resp, err = http_client.put("https://api.example.com/users/123", {
    headers = {["Content-Type"] = "application/json"},
    body = json.encode({name = "Alice Smith"})
})
```

### PATCH Request

```lua
local resp, err = http_client.patch("https://api.example.com/users/123", {
    body = json.encode({status = "active"})
})
```

### DELETE Request

```lua
local resp, err = http_client.delete("https://api.example.com/users/123", {
    headers = {["Authorization"] = "Bearer " .. token}
})
```

### HEAD Request

Returns headers only, no body.

```lua
local resp, err = http_client.head("https://cdn.example.com/file.zip")
local size = resp.headers["Content-Length"]
```

### Custom Method

```lua
local resp, err = http_client.request("PROPFIND", "https://dav.example.com/folder", {
    headers = {["Depth"] = "1"}
})
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `method` | string | HTTP method |
| `url` | string | Request URL |
| `options` | table | Request options (optional) |

## Request Options

| Field | Type | Description |
|-------|------|-------------|
| `headers` | table | Request headers `{["Name"] = "value"}` |
| `body` | string | Request body |
| `query` | table | Query parameters `{key = "value"}` |
| `form` | table | Form data (sets Content-Type automatically) |
| `files` | table | File uploads (array of file definitions) |
| `cookies` | table | Request cookies `{name = "value"}` |
| `auth` | table | Basic auth `{user = "name", pass = "secret"}` |
| `timeout` | number/string | Timeout: number in seconds, or string like `"30s"`, `"1m"` |
| `stream` | boolean | Stream response body instead of buffering |
| `max_response_body` | number | Max response size in bytes (0 = default) |
| `unix_socket` | string | Connect via Unix socket path |

### Query Parameters

```lua
local resp, err = http_client.get("https://api.example.com/search", {
    query = {
        q = "lua programming",
        page = "1",
        limit = "20"
    }
})
```

### Headers and Authentication

```lua
local resp, err = http_client.get("https://api.example.com/data", {
    headers = {
        ["Authorization"] = "Bearer " .. token,
        ["Accept"] = "application/json"
    }
})

-- Or use basic auth
local resp, err = http_client.get("https://api.example.com/data", {
    auth = {user = "admin", pass = "secret"}
})
```

### Form Data

```lua
local resp, err = http_client.post("https://api.example.com/login", {
    form = {
        username = "alice",
        password = "secret123"
    }
})
```

### File Upload

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
```

| File Field | Type | Required | Description |
|------------|------|----------|-------------|
| `name` | string | yes | Form field name |
| `filename` | string | no | Original filename |
| `content` | string | yes* | File content |
| `reader` | userdata | yes* | Alternative: io.Reader for content |
| `content_type` | string | no | MIME type (default: `application/octet-stream`) |

*Either `content` or `reader` is required.

### Timeout

```lua
-- Number: seconds
local resp, err = http_client.get(url, {timeout = 30})

-- String: Go duration format
local resp, err = http_client.get(url, {timeout = "30s"})
local resp, err = http_client.get(url, {timeout = "1m30s"})
local resp, err = http_client.get(url, {timeout = "1h"})
```

## Response Object

| Field | Type | Description |
|-------|------|-------------|
| `status_code` | number | HTTP status code |
| `body` | string | Response body (if not streaming) |
| `body_size` | number | Body size in bytes (-1 if streaming) |
| `headers` | table | Response headers |
| `cookies` | table | Response cookies |
| `url` | string | Final URL (after redirects) |
| `stream` | Stream | Stream object (if `stream = true`) |

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

## Streaming Responses

For large responses, use streaming to avoid loading entire body into memory.

```lua
local resp, err = http_client.get("https://cdn.example.com/large-file.zip", {
    stream = true
})
if err then
    return nil, err
end

-- Process in chunks
while true do
    local chunk, err = resp.stream:read(65536)
    if err or not chunk then break end
    -- process chunk
end
resp.stream:close()
```

| Stream Method | Returns | Description |
|---------------|---------|-------------|
| `read(size)` | string, error | Read up to `size` bytes |
| `close()` | - | Close the stream |

## Batch Requests

Execute multiple requests concurrently.

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
    -- All succeeded
    for i, resp in ipairs(responses) do
        print("Response " .. i .. ":", resp.status_code)
    end
end
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `requests` | table | Array of `{method, url, options?}` |

**Returns:** `responses, errors` - arrays indexed by request position

**Notes:**
- Requests execute concurrently
- Streaming (`stream = true`) is not supported in batch
- Result arrays match request order (1-indexed)

## URL Encoding

### Encode

```lua
local encoded = http_client.encode_uri("hello world")
-- "hello+world"

local url = "https://api.example.com/search?q=" .. http_client.encode_uri(query)
```

### Decode

```lua
local decoded, err = http_client.decode_uri("hello+world")
-- "hello world"
```

## Permissions

HTTP requests are subject to security policy evaluation.

### Security Actions

| Action | Resource | Description |
|--------|----------|-------------|
| `http_client.request` | URL | Allow/deny requests to specific URLs |
| `http_client.unix_socket` | Socket path | Allow/deny Unix socket connections |
| `http_client.private_ip` | IP address | Allow/deny access to private IP ranges |

### Checking Access

```lua
local security = require("security")

if security.can("http_client.request", "https://api.example.com/users") then
    local resp = http_client.get("https://api.example.com/users")
end
```

### SSRF Protection

Private IP ranges (10.x, 192.168.x, 172.16-31.x, localhost) are blocked by default. Access requires the `http_client.private_ip` permission.

```lua
local resp, err = http_client.get("http://192.168.1.1/admin")
-- Error: not allowed: private IP 192.168.1.1
```

See [Security Model](system/security.md) for policy configuration.

## Errors

| Condition | Kind | Retryable |
|-----------|------|-----------|
| Security policy denied | `errors.PERMISSION_DENIED` | no |
| Private IP blocked | `errors.PERMISSION_DENIED` | no |
| Unix socket denied | `errors.PERMISSION_DENIED` | no |
| Invalid URL or options | `errors.INVALID` | no |
| No context | `errors.INTERNAL` | no |
| Network failure | `errors.INTERNAL` | yes |
| Timeout | `errors.INTERNAL` | yes |

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

See [Error Handling](lua/core/errors.md) for working with errors.
