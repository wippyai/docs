# HTTP Endpoints

Endpoints (`http.endpoint`) define HTTP route handlers that execute Lua functions.

## Definition

```yaml
- name: get_user
  kind: http.endpoint
  router: api_router
  method: GET
  path: /users/{id}
  func: app.users:get_user
```

## Configuration

| Field | Type | Description |
|-------|------|-------------|
| `router` | registry.ID | Parent router (optional if only one router) |
| `method` | string | HTTP method |
| `path` | string | URL path pattern |
| `func` | registry.ID | Function to execute |

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
function(req, res)
    local user_id = req:param("id")
    local post_id = req:param("post_id")
end
```

## Wildcard Paths

Capture remaining path with `{path...}`:

```yaml
- name: file_handler
  kind: http.endpoint
  method: GET
  path: /files/{path...}
  func: serve_file
```

```lua
function(req, res)
    local file_path = req:param("path")
    -- /files/docs/readme.md -> path = "docs/readme.md"
end
```

## Handler Function

Endpoint functions receive request and response objects:

```lua
function(req, res)
    -- Read request
    local body = req:body()
    local user_id = req:param("id")
    local page = req:query("page")
    local auth = req:header("Authorization")

    -- Process
    local user = get_user(user_id)

    -- Write response
    res:set_header("Content-Type", "application/json")
    res:set_status(200)
    res:write(json.encode(user))
end
```

### Request Object

| Method | Returns | Description |
|--------|---------|-------------|
| `req:method()` | string | HTTP method |
| `req:path()` | string | Request path |
| `req:param(name)` | string | URL parameter |
| `req:query(name)` | string | Query parameter |
| `req:header(name)` | string | Request header |
| `req:headers()` | table | All headers |
| `req:body()` | string | Request body |
| `req:cookie(name)` | string | Cookie value |
| `req:remote_addr()` | string | Client IP address |

### Response Object

| Method | Description |
|--------|-------------|
| `res:set_status(code)` | Set HTTP status |
| `res:set_header(name, value)` | Set header |
| `res:set_cookie(name, value, opts)` | Set cookie |
| `res:write(data)` | Write body |
| `res:redirect(url, code?)` | Redirect (default 302) |

## JSON API Pattern

Common pattern for JSON APIs:

```lua
local json = require("json")

function(req, res)
    -- Parse JSON body
    local data, err = json.decode(req:body())
    if err then
        res:set_status(400)
        res:set_header("Content-Type", "application/json")
        res:write(json.encode({error = "Invalid JSON"}))
        return
    end

    -- Process request
    local result = process(data)

    -- Return JSON response
    res:set_status(200)
    res:set_header("Content-Type", "application/json")
    res:write(json.encode(result))
end
```

## Error Responses

```lua
local function api_error(res, status, code, message)
    res:set_status(status)
    res:set_header("Content-Type", "application/json")
    res:write(json.encode({
        error = {
            code = code,
            message = message
        }
    }))
end

function(req, res)
    local user_id = req:param("id")
    local user, err = db.get_user(user_id)

    if err then
        if errors.is(err, errors.NOT_FOUND) then
            return api_error(res, 404, "USER_NOT_FOUND", "User not found")
        end
        return api_error(res, 500, "INTERNAL_ERROR", "Server error")
    end

    res:set_status(200)
    res:set_header("Content-Type", "application/json")
    res:write(json.encode(user))
end
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
    router: users_router
    method: GET
    path: /
    func: app.users:list

  - name: get_user
    kind: http.endpoint
    router: users_router
    method: GET
    path: /{id}
    func: app.users:get

  - name: create_user
    kind: http.endpoint
    router: users_router
    method: POST
    path: /
    func: app.users:create

  - name: update_user
    kind: http.endpoint
    router: users_router
    method: PUT
    path: /{id}
    func: app.users:update

  - name: delete_user
    kind: http.endpoint
    router: users_router
    method: DELETE
    path: /{id}
    func: app.users:delete
```

### Protected Endpoint

```yaml
- name: admin_endpoint
  kind: http.endpoint
  router: admin_router
  method: POST
  path: /settings
  func: app.admin:update_settings
  post_middleware:
    - endpoint_firewall
  post_options:
    endpoint_firewall.action: "admin"
```

## See Also

- [Router](http/router.md) - Route grouping
- [HTTP Module](lua/http/http.md) - Request/response API
- [Middleware](http/middleware.md) - Request processing
