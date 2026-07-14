---
title: "HTTP Endpoints"
description: "Endpoints (http.endpoint) define HTTP route handlers that execute Lua functions."
---

# HTTP Endpoints

Endpoints (`http.endpoint`) define HTTP route handlers that execute Lua functions.

## Definition

```yaml
- name: get_user
  kind: http.endpoint
  meta:
    router: app:api_router
  method: GET
  path: /users/{id}
  func: app.users:get_user
```

## Configuration

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `meta.router` | registry.ID | Yes | Parent router (referenced by registry ID). |
| `method` | string | Yes | HTTP method |
| `path` | string | Yes | URL path pattern |
| `func` | registry.ID | Yes | Function to execute |

## HTTP Methods

Supported methods:

| Method | Use Case |
|--------|----------|
| `GET` | Retrieve resources |
| `POST` | Create resources |
| `PUT` | Replace resources |
| `PATCH` | Partial update |
| `DELETE` | Remove resources |
| `HEAD` | Headers only |
| `OPTIONS` | CORS preflight (auto-handled) |
| `TRACE` | Diagnostic loopback |

## Path Parameters

Use `{param}` syntax for URL parameters:

```yaml
- name: get_user
  kind: http.endpoint
  method: GET
  path: /users/{id}
  func: get_user

- name: get_user_post
  kind: http.endpoint
  method: GET
  path: /users/{user_id}/posts/{post_id}
  func: get_user_post
```

Access in handler:

```lua
local http = require("http")

local function handler()
    local req = http.request()
    local user_id = req:param("id")
    local post_id = req:param("post_id")
end
```

## Wildcard Paths

Use `{path...}` to match any remaining path segments:

```yaml
- name: file_handler
  kind: http.endpoint
  method: GET
  path: /files/{path...}
  func: serve_file
```

This catch-all segment makes the route match requests like `/files/docs/readme.md`. The captured tail is not currently exposed to Lua: `req:param("path")` returns `nil` for the wildcard value. Read `req:path()` if you need the full request path.

## Handler Function

Endpoint functions obtain request and response objects from the `http` module:

```lua
local http = require("http")
local json = require("json")

local function handler()
    local req = http.request()
    local res = http.response()

    -- Read request
    local body = req:body()
    local user_id = req:param("id")
    local page = req:query("page")
    local auth = req:header("Authorization")

    -- Process
    local user = get_user(user_id)

    -- Write response
    res:set_content_type(http.CONTENT.JSON)
    res:set_status(http.STATUS.OK)
    res:write_json(user)
end

return { handler = handler }
```

### Request Object

| Method | Returns | Description |
|--------|---------|-------------|
| `req:method()` | string | HTTP method |
| `req:path()` | string | Request path |
| `req:param(name)` | string | URL parameter |
| `req:params()` | table | All path parameters |
| `req:query(name)` | string | Query parameter |
| `req:query_params()` | table | All query parameters |
| `req:header(name)` | string | Request header |
| `req:body()` | string | Request body |
| `req:body_json()` | table, error | Parse JSON body |
| `req:has_body()` | boolean | Check if body exists |
| `req:content_type()` | string | Content type |
| `req:content_length()` | number | Body size in bytes |
| `req:host()` | string | Hostname |
| `req:remote_addr()` | string | Client IP address |
| `req:accepts(type)` | boolean | Content negotiation |
| `req:is_content_type(type)` | boolean | Check content type |
| `req:stream()` | Stream | Body as stream for large files |
| `req:parse_multipart(max?)` | table, error | Parse multipart form |

### Response Object

| Method | Description |
|--------|-------------|
| `res:set_status(code)` | Set HTTP status code |
| `res:set_header(name, value)` | Set response header |
| `res:set_content_type(type)` | Set content type |
| `res:write(data)` | Write raw body |
| `res:write_json(data)` | Write JSON response |
| `res:write_event(data)` | Send SSE event |
| `res:set_transfer(encoding)` | Set transfer mode (SSE, chunked) |
| `res:flush()` | Flush response to client |

## JSON API Pattern

Common pattern for JSON APIs:

```lua
local http = require("http")

local function handler()
    local req = http.request()
    local res = http.response()

    local data, err = req:body_json()
    if err then
        res:set_status(http.STATUS.BAD_REQUEST)
        res:write_json({error = "Invalid JSON"})
        return
    end

    local result = process(data)

    res:set_status(http.STATUS.OK)
    res:write_json(result)
end

return { handler = handler }
```

## Error Responses

```lua
local http = require("http")

local function api_error(res, status, code, message)
    res:set_status(status)
    res:write_json({
        error = {
            code = code,
            message = message
        }
    })
end

local function handler()
    local req = http.request()
    local res = http.response()

    local user_id = req:param("id")
    local user, err = db.get_user(user_id)

    if err then
        if errors.is(err, errors.NOT_FOUND) then
            return api_error(res, http.STATUS.NOT_FOUND, "USER_NOT_FOUND", "User not found")
        end
        return api_error(res, http.STATUS.INTERNAL_ERROR, "INTERNAL_ERROR", "Server error")
    end

    res:set_status(http.STATUS.OK)
    res:write_json(user)
end

return { handler = handler }
```

## Examples

### CRUD Endpoints

```yaml
entries:
  - name: users_router
    kind: http.router
    prefix: /api/users
    middleware:
      - cors
      - compress

  - name: list_users
    kind: http.endpoint
    meta:
      router: users_router
    method: GET
    path: /
    func: app.users:list

  - name: get_user
    kind: http.endpoint
    meta:
      router: users_router
    method: GET
    path: /{id}
    func: app.users:get

  - name: create_user
    kind: http.endpoint
    meta:
      router: users_router
    method: POST
    path: /
    func: app.users:create

  - name: update_user
    kind: http.endpoint
    meta:
      router: users_router
    method: PUT
    path: /{id}
    func: app.users:update

  - name: delete_user
    kind: http.endpoint
    meta:
      router: users_router
    method: DELETE
    path: /{id}
    func: app.users:delete
```

### Protected Endpoint

Authorization middleware is configured on the parent router, not on the endpoint. Post-match middleware (such as `endpoint_firewall`) runs after route matching and applies to every endpoint under the router:

```yaml
- name: admin_router
  kind: http.router
  meta:
    server: gateway
  prefix: /admin
  middleware:
    - cors
    - token_auth
  post_middleware:
    - endpoint_firewall
  post_options:
    endpoint_firewall.action: "admin"

- name: admin_endpoint
  kind: http.endpoint
  meta:
    router: admin_router
  method: POST
  path: /settings
  func: app.admin:update_settings
```

## See Also

- [Router](http/router.md) - Route grouping
- [HTTP Module](lua/http/http.md) - Request/response API
- [Middleware](http/middleware.md) - Request processing
