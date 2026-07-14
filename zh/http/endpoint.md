---
title: "HTTP 端点"
description: "端点 (http.endpoint) 定义执行 Lua 函数的 HTTP 路由处理器。"
---

# HTTP 端点

端点 (`http.endpoint`) 定义执行 Lua 函数的 HTTP 路由处理器。

## 定义

```yaml
- name: get_user
  kind: http.endpoint
  meta:
    router: app:api_router
  method: GET
  path: /users/{id}
  func: app.users:get_user
```

## 配置

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `meta.router` | registry.ID | 否 | 父级路由器 (如果仅注册了一个路由器则默认使用该路由器) |
| `method` | string | 是 | HTTP 方法 |
| `path` | string | 是 | URL 路径模式 |
| `func` | registry.ID | 是 | 要执行的函数 |

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
| `TRACE` | 诊断回环 |

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
local http = require("http")

local function handler()
    local req = http.request()
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
local function handler()
    local req = http.request()
    local file_path = req:param("path")
    -- /files/docs/readme.md -> path = "docs/readme.md"
end
```

## 处理函数

端点函数从 `http` 模块获取请求和响应对象：

```lua
local http = require("http")
local json = require("json")

local function handler()
    local req = http.request()
    local res = http.response()

    -- 读取请求
    local body = req:body()
    local user_id = req:param("id")
    local page = req:query("page")
    local auth = req:header("Authorization")

    -- 处理
    local user = get_user(user_id)

    -- 写入响应
    res:set_content_type(http.CONTENT.JSON)
    res:set_status(http.STATUS.OK)
    res:write_json(user)
end

return { handler = handler }
```

### 请求对象

| 方法 | 返回值 | 说明 |
|------|--------|------|
| `req:method()` | string | HTTP 方法 |
| `req:path()` | string | 请求路径 |
| `req:param(name)` | string | URL 参数 |
| `req:params()` | table | 所有路径参数 |
| `req:query(name)` | string | 查询参数 |
| `req:query_params()` | table | 所有查询参数 |
| `req:header(name)` | string | 请求头 |
| `req:body()` | string | 请求体 |
| `req:body_json()` | table, error | 解析 JSON 请求体 |
| `req:has_body()` | boolean | 检查是否存在请求体 |
| `req:content_type()` | string | 内容类型 |
| `req:content_length()` | number | 请求体大小 (字节) |
| `req:host()` | string | 主机名 |
| `req:remote_addr()` | string | 客户端 IP 地址 |
| `req:accepts(type)` | boolean | 内容协商 |
| `req:is_content_type(type)` | boolean | 检查内容类型 |
| `req:stream()` | Stream | 以流形式读取请求体 (用于大文件) |
| `req:parse_multipart(max?)` | table, error | 解析 multipart 表单 |

### 响应对象

| 方法 | 说明 |
|------|------|
| `res:set_status(code)` | 设置 HTTP 状态码 |
| `res:set_header(name, value)` | 设置响应头 |
| `res:set_content_type(type)` | 设置内容类型 |
| `res:write(data)` | 写入原始响应体 |
| `res:write_json(data)` | 写入 JSON 响应 |
| `res:write_event(data)` | 发送 SSE 事件 |
| `res:set_transfer(encoding)` | 设置传输模式 (SSE, chunked) |
| `res:flush()` | 将响应刷新到客户端 |

## JSON API 模式

JSON API 的常见模式：

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

## 错误响应

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

### 受保护端点

```yaml
- name: admin_endpoint
  kind: http.endpoint
  meta:
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
