---
title: "HTTP Endpoints"
description: "Endpoints (http.endpoint) define HTTP route handlers that execute Lua functions."
---

# HTTP Endpoints

An `http.endpoint` maps an HTTP method and path to a Lua handler function.

**Classification: configuration and API reference.** YAML blocks are registry
fragments that assume the referenced server, router, middleware, function
entries, and security policies already exist. Lua blocks focus on handler
contracts and identify application calls explicitly.

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
| `*` | Match every HTTP method |

## Path Parameters

Use `{param}` syntax for URL parameters:

```yaml
- name: get_user
  kind: http.endpoint
  meta:
    router: api
  method: GET
  path: /users/{id}
  func: get_user

- name: get_user_post
  kind: http.endpoint
  meta:
    router: api
  method: GET
  path: /users/{user_id}/posts/{post_id}
  func: get_user_post
```

Access in handler:

```lua
local http = require("http")

local function handler()
    local req, req_err = http.request()
    if req_err then return nil, req_err end
    local user_id, user_err = req:param("user_id")
    if user_err then return nil, user_err end
    local post_id, post_err = req:param("post_id")
    if post_err then return nil, post_err end
    return {user_id = user_id, post_id = post_id}
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

This catch-all segment makes the route match requests like `/files/docs/readme.md`. In that request, `req:param("path")` returns `docs/readme.md`.

## Handler Function

Endpoint functions obtain request and response objects from the `http` module:

```lua
local http = require("http")
local funcs = require("funcs")

local function handler()
    local req, req_err = http.request()
    if req_err then return nil, req_err end
    local res, res_err = http.response()
    if res_err then return nil, res_err end

    local user_id, param_err = req:param("id")
    if param_err then return nil, param_err end

    local user, call_err = funcs.call("app.users:get_user", user_id)
    if call_err then return nil, call_err end

    local type_err = res:set_content_type(http.CONTENT.JSON)
    if type_err then return nil, type_err end
    local status_err = res:set_status(http.STATUS.OK)
    if status_err then return nil, status_err end
    local write_err = res:write_json(user)
    if write_err then return nil, write_err end
    return true
end

return { handler = handler }
```

### Request Object

| Method | Returns | Description |
|--------|---------|-------------|
| `req:method()` | string, error | HTTP method |
| `req:path()` | string, error | Request path |
| `req:param(name)` | string or nil, error | URL parameter |
| `req:params()` | table, error | All path parameters |
| `req:query(name)` | string or nil, error | Query parameter |
| `req:query_params()` | table, error | All query parameters |
| `req:header(name)` | string or nil, error | Request header |
| `req:body()` | string, error | Request body |
| `req:body_json()` | value, error | Parse JSON body |
| `req:has_body()` | boolean, error | Check if body exists |
| `req:content_type()` | string or nil, error | Content type |
| `req:content_length()` | number, error | Body size in bytes |
| `req:host()` | string, error | Host header |
| `req:remote_addr()` | string, error | Client address in `IP:port` form unless middleware rewrites it |
| `req:accepts(type)` | boolean, error | Content negotiation |
| `req:is_content_type(type)` | boolean, error | Check content type |
| `req:stream()` | Stream, error | Body as stream for large files |
| `req:parse_multipart(max?)` | table, error | Parse multipart form |

### Response Object

| Method | Description |
|--------|-------------|
| `res:set_status(code)` | Set HTTP status code; returns an error if headers were sent |
| `res:set_header(name, value)` | Set response header; returns an error if headers were sent |
| `res:set_content_type(type)` | Set content type; returns an error if headers were sent |
| `res:write(data)` | Write raw body; returns an error on failure |
| `res:write_json(data)` | Write a JSON response; returns an error on failure |
| `res:write_event(data)` | Send and flush an SSE event; returns an error on failure |
| `res:set_transfer(encoding)` | Set `chunked` or `sse` transfer mode; returns an error if headers were sent |
| `res:flush()` | Flush the response; returns an error value |

## JSON API Pattern

A JSON API handler can parse the request body, reject invalid input, and write a JSON result:

```lua
local http = require("http")
local funcs = require("funcs")

local function handler()
    local req, req_err = http.request()
    if req_err then return nil, req_err end
    local res, res_err = http.response()
    if res_err then return nil, res_err end

    local data, err = req:body_json()
    if err then
        local status_err = res:set_status(http.STATUS.BAD_REQUEST)
        if status_err then return nil, status_err end
        local write_err = res:write_json({error = "Invalid JSON"})
        if write_err then return nil, write_err end
        return true
    end

    local result, process_err = funcs.call("app.api:process_request", data)
    if process_err then return nil, process_err end

    local status_err = res:set_status(http.STATUS.OK)
    if status_err then return nil, status_err end
    local write_err = res:write_json(result)
    if write_err then return nil, write_err end
    return true
end

return { handler = handler }
```

## Error Responses

```lua
local http = require("http")
local funcs = require("funcs")

local function api_error(res, status, code, message)
    local status_err = res:set_status(status)
    if status_err then return nil, status_err end
    local write_err = res:write_json({
        error = {
            code = code,
            message = message
        }
    })
    if write_err then return nil, write_err end
    return true
end

local function handler()
    local req, req_err = http.request()
    if req_err then return nil, req_err end
    local res, res_err = http.response()
    if res_err then return nil, res_err end

    local user_id, param_err = req:param("id")
    if param_err then return nil, param_err end
    local user, err = funcs.call("app.users:get_user", user_id)

    if err then
        if errors.is(err, errors.NOT_FOUND) then
            return api_error(res, http.STATUS.NOT_FOUND, "USER_NOT_FOUND", "User not found")
        end
        return api_error(res, http.STATUS.INTERNAL_ERROR, "INTERNAL_ERROR", "Server error")
    end

    local status_err = res:set_status(http.STATUS.OK)
    if status_err then return nil, status_err end
    local write_err = res:write_json(user)
    if write_err then return nil, write_err end
    return true
end

return { handler = handler }
```

## Examples

### CRUD Endpoints

```yaml
entries:
  - name: users_router
    kind: http.router
    meta:
      server: gateway
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

- [Router](./router.md) - Route grouping
- [HTTP Module](../lua/http/http.md) - Request/response API
- [Middleware](./middleware.md) - Request processing
