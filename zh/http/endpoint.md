# HTTP 端点

端点 (`http.endpoint`) 定义执行 Lua 函数的 HTTP 路由处理器。

## 定义

```yaml
- name: get_user
  kind: http.endpoint
  router: api_router
  method: GET
  path: /users/{id}
  func: app.users:get_user
```

## 配置

| 字段 | 类型 | 说明 |
|------|------|------|
| `router` | registry.ID | 父级路由器 (如果只有一个路由器则可选) |
| `method` | string | HTTP 方法 |
| `path` | string | URL 路径模式 |
| `func` | registry.ID | 要执行的函数 |

## HTTP 方法

支持的方法：

| 方法 | 用途 |
|------|------|
| `GET` | 获取资源 |
| `POST` | 创建资源 |
| `PUT` | 替换资源 |
| `PATCH` | 部分更新 |
| `DELETE` | 删除资源 |
| `HEAD` | 仅获取头部 |
| `OPTIONS` | CORS 预检 (自动处理) |

## 路径参数

使用 `{param}` 语法定义 URL 参数：

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

在处理器中访问：

```lua
function(req, res)
    local user_id = req:param("id")
    local post_id = req:param("post_id")
end
```

## 通配符路径

使用 `{path...}` 捕获剩余路径：

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

## 处理函数

端点函数接收请求和响应对象：

```lua
function(req, res)
    -- 读取请求
    local body = req:body()
    local user_id = req:param("id")
    local page = req:query("page")
    local auth = req:header("Authorization")

    -- 处理
    local user = get_user(user_id)

    -- 写入响应
    res:set_header("Content-Type", "application/json")
    res:set_status(200)
    res:write(json.encode(user))
end
```

### 请求对象

| 方法 | 返回值 | 说明 |
|------|--------|------|
| `req:method()` | string | HTTP 方法 |
| `req:path()` | string | 请求路径 |
| `req:param(name)` | string | URL 参数 |
| `req:query(name)` | string | 查询参数 |
| `req:header(name)` | string | 请求头 |
| `req:headers()` | table | 所有请求头 |
| `req:body()` | string | 请求体 |
| `req:cookie(name)` | string | Cookie 值 |
| `req:remote_addr()` | string | 客户端 IP 地址 |

### 响应对象

| 方法 | 说明 |
|------|------|
| `res:set_status(code)` | 设置 HTTP 状态码 |
| `res:set_header(name, value)` | 设置响应头 |
| `res:set_cookie(name, value, opts)` | 设置 Cookie |
| `res:write(data)` | 写入响应体 |
| `res:redirect(url, code?)` | 重定向 (默认 302) |

## JSON API 模式

JSON API 的常见模式：

```lua
local json = require("json")

function(req, res)
    -- 解析 JSON 请求体
    local data, err = json.decode(req:body())
    if err then
        res:set_status(400)
        res:set_header("Content-Type", "application/json")
        res:write(json.encode({error = "Invalid JSON"}))
        return
    end

    -- 处理请求
    local result = process(data)

    -- 返回 JSON 响应
    res:set_status(200)
    res:set_header("Content-Type", "application/json")
    res:write(json.encode(result))
end
```

## 错误响应

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

## 示例

### CRUD 端点

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

### 受保护端点

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

## 参见

- [路由器](http/router.md) - 路由分组
- [HTTP 模块](lua/http/http.md) - 请求/响应 API
- [中间件](http/middleware.md) - 请求处理
