---
title: "HTTP 客户端"
description: "向外部服务发起 HTTP 请求。支持所有 HTTP 方法、头部、查询参数、表单数据、文件上传、流式响应和并发批量请求。"
---

# HTTP 客户端
<secondary-label ref="network"/>
<secondary-label ref="io"/>
<secondary-label ref="permissions"/>

向外部服务发起 HTTP 请求。支持所有 HTTP 方法、头部、查询参数、表单数据、文件上传、流式响应和并发批量请求。

## 加载

```lua
local http_client = require("http_client")
```

## HTTP 方法

所有方法具有相同的签名：`method(url, options?)` 返回 `Response, error`。

### GET 请求

```lua
local resp, err = http_client.get("https://api.example.com/users")
if err then
    return nil, err
end

print(resp.status_code)  -- 200
print(resp.body)         -- response body
```

### POST 请求

```lua
local resp, err = http_client.post("https://api.example.com/users", {
    headers = {["Content-Type"] = "application/json"},
    body = json.encode({name = "Alice", email = "alice@example.com"})
})
```

### PUT 请求

```lua
local resp, err = http_client.put("https://api.example.com/users/123", {
    headers = {["Content-Type"] = "application/json"},
    body = json.encode({name = "Alice Smith"})
})
```

### PATCH 请求

```lua
local resp, err = http_client.patch("https://api.example.com/users/123", {
    body = json.encode({status = "active"})
})
```

### DELETE 请求

```lua
local resp, err = http_client.delete("https://api.example.com/users/123", {
    headers = {["Authorization"] = "Bearer " .. token}
})
```

### HEAD 请求

仅返回头部，无正文。

```lua
local resp, err = http_client.head("https://cdn.example.com/file.zip")
local size = resp.headers["Content-Length"]
```

### 自定义方法

```lua
local resp, err = http_client.request("PROPFIND", "https://dav.example.com/folder", {
    headers = {["Depth"] = "1"}
})
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `method` | string | HTTP 方法 |
| `url` | string | 请求 URL |
| `options` | table | 请求选项（可选） |

## 请求选项

| 字段 | 类型 | 描述 |
|-------|------|-------------|
| `headers` | table | 请求头 `{["Name"] = "value"}` |
| `body` | string | 请求正文 |
| `query` | table | 查询参数 `{key = "value"}` |
| `form` | table | 表单数据（自动设置 Content-Type） |
| `files` | table | 文件上传（文件定义数组） |
| `cookies` | table | 请求 Cookie `{name = "value"}` |
| `auth` | table | Basic 认证 `{user = "name", pass = "secret"}` |
| `timeout` | number/string | 超时：数字为秒，或字符串如 `"30s"`、`"1m"` |
| `stream` | boolean | 流式响应正文而非缓冲 |
| `max_response_body` | number | 最大响应大小（字节）（0 = 默认） |
| `unix_socket` | string | 通过 Unix socket 路径连接 |
| `tls` | table | 每请求 TLS 配置（参见 [TLS 选项](#tls-选项)） |
| `overlay_network` | string | 通过[网络覆盖层](system/network.md)路由 —— `network.socks5` / `network.tailscale` / `network.i2p` 条目的注册表 ID |

### 查询参数

```lua
local resp, err = http_client.get("https://api.example.com/search", {
    query = {
        q = "lua programming",
        page = "1",
        limit = "20"
    }
})
```

### 头部和认证

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

### 表单数据

```lua
local resp, err = http_client.post("https://api.example.com/login", {
    form = {
        username = "alice",
        password = "secret123"
    }
})
```

### 文件上传

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

| 文件字段 | 类型 | 必需 | 描述 |
|------------|------|----------|-------------|
| `name` | string | 是 | 表单字段名 |
| `filename` | string | 否 | 原始文件名 |
| `content` | string | 是* | 文件内容 |
| `reader` | userdata | 是* | 替代方案：用于内容的 io.Reader |
| `content_type` | string | 否 | 当前被忽略：无论此字段如何，每个上传部分始终以 `Content-Type: application/octet-stream` 发送 |

*`content` 或 `reader` 必须提供其一。

### 超时

```lua
-- Number: seconds
local resp, err = http_client.get(url, {timeout = 30})

-- String: Go duration format
local resp, err = http_client.get(url, {timeout = "30s"})
local resp, err = http_client.get(url, {timeout = "1m30s"})
local resp, err = http_client.get(url, {timeout = "1h"})
```

### TLS 选项

配置每请求的 TLS 设置，用于 mTLS（双向 TLS）和自定义 CA 证书。

| 字段 | 类型 | 描述 |
|-------|------|-------------|
| `cert` | string | PEM 格式的客户端证书 |
| `key` | string | PEM 格式的客户端私钥 |
| `ca` | string | PEM 格式的自定义 CA 证书 |
| `server_name` | string | 用于 SNI 验证的服务器名称 |
| `insecure_skip_verify` | boolean | 跳过 TLS 证书验证 |

`cert` 和 `key` 必须同时提供才能使用 mTLS。`ca` 字段会使用自定义 CA 覆盖系统证书池。

#### mTLS 认证

```lua
local cert_pem = fs.read("/certs/client.crt")
local key_pem = fs.read("/certs/client.key")

local resp, err = http_client.get("https://secure.example.com/api", {
    tls = {
        cert = cert_pem,
        key = key_pem,
    }
})
```

#### 自定义 CA

```lua
local ca_pem = fs.read("/certs/internal-ca.crt")

local resp, err = http_client.get("https://internal.example.com/api", {
    tls = {
        ca = ca_pem,
        server_name = "internal.example.com",
    }
})
```

#### 跳过不安全验证

在开发环境中跳过 TLS 验证。需要 `http_client.insecure_tls` 安全权限。

```lua
local resp, err = http_client.get("https://localhost:8443/api", {
    tls = {
        insecure_skip_verify = true,
    }
})
```

## 响应对象

| 字段 | 类型 | 描述 |
|-------|------|-------------|
| `status_code` | number | HTTP 状态码 |
| `body` | string | 响应正文（非流式时） |
| `body_size` | number | 正文大小（字节）（流式时为 -1） |
| `headers` | table | 响应头 |
| `cookies` | table | 响应 Cookie |
| `url` | string | 最终 URL（重定向后） |
| `stream` | Stream | 流对象（`stream = true` 时） |

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

## 流式响应

对于大型响应，使用流式以避免将整个正文加载到内存中。

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

| 流方法 | 返回 | 描述 |
|---------------|---------|-------------|
| `read(n?)` | string, error | 读取最多 `n` 字节（默认：实现缓冲区大小） |
| `close()` | boolean, error | 关闭流 |

`resp.stream` 是一个完整的 [stream](lua/core/stream.md) 对象——`seek`、`stat` 和 `scanner` 也可用。

## 批量请求

并发执行多个请求。

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

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `requests` | table | `{method, url, options?}` 数组 |

**返回:** `responses, errors` - 按请求位置索引的数组

**注意：**
- 请求并发执行
- 批量中不支持流式（`stream = true`）
- 结果数组与请求顺序匹配（从 1 开始索引）

## URL 编码

### 编码

```lua
local encoded = http_client.encode_uri("hello world")
-- "hello+world"

local url = "https://api.example.com/search?q=" .. http_client.encode_uri(query)
```

### 解码

```lua
local decoded, err = http_client.decode_uri("hello+world")
-- "hello world"
```

## 权限

HTTP 请求受安全策略评估约束。

### 安全操作

| 操作 | 资源 | 描述 |
|--------|----------|-------------|
| `http_client.request` | URL | 允许/拒绝对特定 URL 的请求 |
| `http_client.unix_socket` | Socket 路径 | 允许/拒绝 Unix socket 连接 |
| `http_client.private_ip` | IP 地址 | 允许/拒绝访问私有 IP 范围 |
| `http_client.insecure_tls` | URL | 允许/禁止不安全的 TLS（跳过验证） |
| `network.select` | 网络条目 ID | 允许/禁止通过请求中给定的 `overlay_network` 路由 |

### 检查访问权限

```lua
local security = require("security")

if security.can("http_client.request", "https://api.example.com/users") then
    local resp = http_client.get("https://api.example.com/users")
end
```

### SSRF 防护

非公网 IP 范围默认被阻止。访问需要针对该地址的 `http_client.private_ip` 权限：

- 回环地址、私有地址（10.x、172.16-31.x、192.168.x）、链路本地单播和组播地址，以及未指定地址
- 运营商级 NAT `100.64.0.0/10`、`192.0.0.0/24`、组播 `224.0.0.0/4`、保留 `240.0.0.0/4`
- 文档和基准测试范围 `192.0.2.0/24`、`198.18.0.0/15`、`198.51.100.0/24`、`203.0.113.0/24`、`2001:db8::/32`
- IPv6 组播 `ff00::/8`

```lua
local resp, err = http_client.get("http://192.168.1.1/admin")
-- Error: not allowed: private IP 192.168.1.1
```

该检查在拨号时进行，而非针对 URL 字符串，并覆盖主机解析出的每一个地址。解析出多个地址的主机名会逐个地址检查：被拒绝的地址会被跳过并尝试下一个，只有当所有候选地址都被拒绝或不可达时请求才失败。因此，解析到私有地址的公网主机名会像私有 IP 字面量一样被阻止。

### 重定向

最多跟随九次重定向；第十次会以 `stopped after 10 redirects` 失败，这个计数包含原始请求。

每一跳都单独授权。在跟随重定向之前，客户端会针对目标 URL 评估 `http_client.request` 并对其应用私有 IP 检查，因此无法借助重定向从一个被允许的 URL 到达一个被拒绝的 URL。任一检查未通过的跳转都会中止该请求。

参见 [安全模型](system/security.md) 了解策略配置。

## 错误

| 条件 | 类型 | 可重试 |
|-----------|------|-----------|
| 安全策略拒绝 | `errors.PERMISSION_DENIED` | 否 |
| 私有 IP 被阻止 | `errors.PERMISSION_DENIED` | 否 |
| Unix socket 被拒绝 | `errors.PERMISSION_DENIED` | 否 |
| 不安全 TLS 被拒绝 | `errors.PERMISSION_DENIED` | 否 |
| 无效的 URL 或选项 | `errors.INVALID` | 否 |
| 无上下文 | `errors.INTERNAL` | 否 |
| 网络故障 | `errors.INTERNAL` | 是 |
| 超时 | `errors.INTERNAL` | 是 |

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

参见 [错误处理](lua/core/errors.md) 了解错误处理方法。
