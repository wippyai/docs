# HTTP 中间件

中间件在路由处理前后对 HTTP 请求进行处理。

## 中间件工作原理

中间件包装 HTTP 处理器以添加处理逻辑。每个中间件接收选项映射并返回处理器包装器：

```yaml
middleware:
  - cors
  - ratelimit
options:
  cors.allow.origins: "https://example.com"
  ratelimit.requests: "100"
```

选项使用点号表示法：`middleware_name.option.name`。为了向后兼容，也支持旧版下划线格式。

## 匹配前与匹配后

<tip>
<b>匹配前</b>在路由匹配之前运行，用于 CORS 和压缩等横切关注点。
<b>匹配后</b>在路由匹配之后运行，用于需要路由信息的授权。
</tip>

```yaml
middleware:        # 匹配前
  - cors
  - compress
options:
  cors.allow.origins: "*"

post_middleware:   # 匹配后
  - endpoint_firewall
post_options:
  endpoint_firewall.action: "access"
```

---

## 可用中间件

### CORS {#cors}

<note>匹配前</note>

浏览器请求的跨域资源共享。

```yaml
middleware:
  - cors
options:
  cors.allow.origins: "https://app.example.com"
  cors.allow.credentials: "true"
```

| 选项 | 默认值 | 说明 |
|------|--------|------|
| `cors.allow.origins` | `*` | 允许的来源 (逗号分隔，支持 `*.example.com`) |
| `cors.allow.methods` | `GET,POST,PUT,DELETE,OPTIONS,PATCH` | 允许的方法 |
| `cors.allow.headers` | `Origin,Content-Type,Accept,Authorization,X-Requested-With` | 允许的请求头 |
| `cors.expose.headers` | - | 暴露给客户端的响应头 |
| `cors.allow.credentials` | `false` | 允许 Cookie/认证 |
| `cors.max.age` | `86400` | 预检缓存时间 (秒) |
| `cors.allow.private.network` | `false` | 私有网络访问 |

OPTIONS 预检请求自动处理。

---

### 限流 {#ratelimit}

<note>匹配前</note>

令牌桶限流，支持按 key 追踪。

```yaml
middleware:
  - ratelimit
options:
  ratelimit.requests: "100"
  ratelimit.window: "1m"
  ratelimit.key: "ip"
```

| 选项 | 默认值 | 说明 |
|------|--------|------|
| `ratelimit.requests` | `100` | 每个时间窗口的请求数 |
| `ratelimit.window` | `1m` | 时间窗口 |
| `ratelimit.burst` | `20` | 突发容量 |
| `ratelimit.key` | `ip` | Key 策略 |
| `ratelimit.cleanup_interval` | `5m` | 清理频率 |
| `ratelimit.entry_ttl` | `10m` | 条目过期时间 |
| `ratelimit.max_entries` | `100000` | 最大追踪 key 数 |

**Key 策略:** `ip`、`header:X-API-Key`、`query:api_key`

返回 `429 Too Many Requests`，包含响应头：`X-RateLimit-Limit`、`X-RateLimit-Remaining`、`X-RateLimit-Reset`。

---

### 压缩 {#compress}

<note>匹配前</note>

响应的 Gzip 压缩。

```yaml
middleware:
  - compress
options:
  compress.level: "default"
  compress.min.length: "1024"
```

| 选项 | 默认值 | 说明 |
|------|--------|------|
| `compress.level` | `default` | `fastest`、`default` 或 `best` |
| `compress.min.length` | `1024` | 最小响应大小 (字节) |

仅在客户端发送 `Accept-Encoding: gzip` 时压缩。

---

### 真实 IP {#real_ip}

<note>匹配前</note>

从代理头中提取客户端 IP。

```yaml
middleware:
  - real_ip
options:
  real_ip.trusted.subnets: "10.0.0.0/8,172.16.0.0/12"
```

| 选项 | 默认值 | 说明 |
|------|--------|------|
| `real_ip.trusted.subnets` | 私有网络 | 受信任的代理 CIDR |
| `real_ip.trust_all` | `false` | 信任所有来源 (不安全) |

**头部优先级:** `True-Client-IP` > `X-Real-IP` > `X-Forwarded-For`

---

### Token 认证 {#token_auth}

<note>匹配前</note>

基于 Token 的认证。Token 存储配置请参阅[安全性](system/security.md)。

```yaml
middleware:
  - token_auth
options:
  token_auth.store: "app:tokens"
```

| 选项 | 默认值 | 说明 |
|------|--------|------|
| `token_auth.store` | 必填 | Token 存储的 Registry ID |
| `token_auth.header.name` | `Authorization` | 请求头名称 |
| `token_auth.header.prefix` | `Bearer ` | 请求头前缀 |
| `token_auth.query.param` | `x-auth-token` | 查询参数备选 |
| `token_auth.cookie.name` | `x-auth-token` | Cookie 备选 |

在上下文中设置 actor 和安全范围供下游中间件使用。不阻止请求，授权在防火墙中间件中进行。

---

### 指标 {#metrics}

<note>匹配前</note>

Prometheus 风格的 HTTP 指标。无配置选项。

```yaml
middleware:
  - metrics
```

| 指标 | 类型 | 说明 |
|------|------|------|
| `wippy_http_requests_total` | Counter | 总请求数 |
| `wippy_http_request_duration_seconds` | Histogram | 请求延迟 |
| `wippy_http_requests_in_flight` | Gauge | 并发请求数 |

---

### 端点防火墙 {#endpoint_firewall}

<warning>匹配后</warning>

基于匹配端点的授权。需要 `token_auth` 提供的 actor。

```yaml
post_middleware:
  - endpoint_firewall
post_options:
  endpoint_firewall.action: "access"
```

| 选项 | 默认值 | 说明 |
|------|--------|------|
| `endpoint_firewall.action` | `access` | 要检查的权限动作 |

返回 `401 Unauthorized` (无 actor) 或 `403 Forbidden` (权限拒绝)。

---

### 资源防火墙 {#resource_firewall}

<warning>匹配后</warning>

按 ID 保护特定资源。适用于路由器级别。

```yaml
post_middleware:
  - resource_firewall
post_options:
  resource_firewall.action: "admin"
  resource_firewall.target: "app:admin-panel"
```

| 选项 | 默认值 | 说明 |
|------|--------|------|
| `resource_firewall.action` | `access` | 权限动作 |
| `resource_firewall.target` | 必填 | 资源的 Registry ID |

---

### Sendfile {#sendfile}

<note>匹配前</note>

通过处理器的 `X-Sendfile` 头提供文件服务。

```yaml
middleware:
  - sendfile
options:
  sendfile.fs: "app:downloads"
```

处理器设置头部以触发文件服务：

| 头部 | 说明 |
|------|------|
| `X-Sendfile` | 文件系统中的文件路径 |
| `X-File-Name` | 下载文件名 |

支持范围请求以实现断点续传。

---

### WebSocket Relay {#websocket_relay}

<warning>匹配后</warning>

将 WebSocket 连接中继到进程。参阅 [WebSocket Relay](http/websocket-relay.md)。

```yaml
post_middleware:
  - websocket_relay
post_options:
  wsrelay.allowed.origins: "https://app.example.com"
```

---

## 中间件顺序

中间件按列出顺序执行。推荐顺序：

```yaml
middleware:
  - real_ip       # 1. 首先提取真实 IP
  - cors          # 2. 处理 CORS 预检
  - compress      # 3. 设置响应压缩
  - ratelimit     # 4. 检查限流
  - metrics       # 5. 记录指标
  - token_auth    # 6. 认证请求

post_middleware:
  - endpoint_firewall  # 路由匹配后授权
```

## 参见

- [路由](http/router.md) - 路由器配置
- [安全性](system/security.md) - Token 存储和策略
- [WebSocket Relay](http/websocket-relay.md) - WebSocket 处理
- [终端](system/terminal.md) - 终端服务
