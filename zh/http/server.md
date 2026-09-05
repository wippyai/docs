---
title: "HTTP 服务器"
description: "HTTP 服务器 (http.service) 监听端口并承载路由器、端点和静态文件处理器。"
---

# HTTP 服务器

HTTP 服务器 (`http.service`) 监听端口并承载路由器、端点和静态文件处理器。

## 配置

```yaml
- name: gateway
  kind: http.service
  addr: ":8080"
  timeouts:
    read: "5s"
    write: "30s"
    idle: "60s"
  host:
    buffer_size: 1024
    worker_count: 4
  lifecycle:
    auto_start: true
    security:
      actor:
        id: "http-gateway"
      policies:
        - app:http_policy
```

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `addr` | string | 必填 | 监听地址 (`:8080`, `0.0.0.0:443`) |
| `timeouts.read` | duration | - | 请求读取超时 |
| `timeouts.write` | duration | - | 响应写入超时 |
| `timeouts.idle` | duration | - | Keep-alive 连接超时 |
| `host.buffer_size` | int | 1024 | 消息中继缓冲区大小 |
| `host.worker_count` | int | NumCPU | 消息中继工作线程数 |
| `network` | Registry ID | - | 通过 [网络 overlay](system/network.md) 绑定监听器（例如 Tailscale、I2P） |
| `tls` | object | - | TLS 终止（参见 [TLS](#tls)） |

## 超时设置

配置超时以防止资源耗尽：

```yaml
timeouts:
  read: "10s"    # 读取整个请求（请求头 + 请求体）的最大时间
  write: "60s"   # 写入响应的最大时间
  idle: "120s"   # Keep-alive 超时
```

- `read` - API 请求使用较短时间 (5-10s)，文件上传使用较长时间
- `write` - 根据预期的响应生成时间设置
- `idle` - 在连接复用和资源使用之间取得平衡

<note>
时间格式：<code>30s</code>、<code>1m</code>、<code>2h15m</code>。使用 <code>0</code> 禁用。
</note>

## Host 配置

`host` 部分配置服务器的内部消息中继，供 WebSocket relay 等组件使用：

```yaml
host:
  buffer_size: 2048
  worker_count: 8
```

| 字段 | 默认值 | 说明 |
|------|--------|------|
| `buffer_size` | 1024 | 每个工作线程的消息队列容量 |
| `worker_count` | NumCPU | 并行消息处理 goroutine 数量 |

<tip>
对于高吞吐量的 WebSocket 应用，请增加这些值。消息中继负责 HTTP 组件和进程之间的异步消息传递。
</tip>

## 安全性

HTTP 服务器可以通过 lifecycle 配置应用默认的安全上下文：

```yaml
lifecycle:
  auto_start: true
  security:
    actor:
      id: "gateway-service"
    policies:
      - app:http_access_policy
```

这为所有请求设置了基准 actor 和策略。对于已认证的请求，[token_auth 中间件](http/middleware.md) 会根据验证后的令牌覆盖 actor，从而实现基于用户的安全策略。

## 生命周期

服务器由 supervisor 管理：

```yaml
lifecycle:
  auto_start: true
  start_timeout: 30s
  stop_timeout: 60s
  depends_on:
    - app:database
```

| 字段 | 说明 |
|------|------|
| `auto_start` | 应用启动时自动启动 |
| `start_timeout` | 等待服务器启动的最大时间 |
| `stop_timeout` | 优雅关闭的最大时间 |
| `depends_on` | 在这些条目就绪后启动 |

## 连接组件

路由器和静态处理器通过 metadata 引用服务器：

```yaml
entries:
  - name: gateway
    kind: http.service
    addr: ":8080"

  - name: api
    kind: http.router
    meta:
      server: gateway
    prefix: /api

  - name: static
    kind: http.static
    meta:
      server: gateway
    path: /
    fs: app:public
```

## 多服务器

为不同用途运行独立的服务器：

```yaml
entries:
  # 公开 API
  - name: public
    kind: http.service
    addr: ":8080"
    lifecycle:
      auto_start: true

  # 管理后台 (仅本地访问)
  - name: admin
    kind: http.service
    addr: "127.0.0.1:9090"
    lifecycle:
      auto_start: true
```

## TLS

服务器可以直接终止 TLS。将 `tls.mode` 设置为 `manual`（提供您自己的证书）或 `auto`（由 overlay 网络驱动提供证书，例如 `network.tailscale`）。普通 clearnet 监听器不支持 `auto`。省略 `tls` 或将 mode 留空以运行纯 HTTP。

在 `auto` 模式下，服务器不得指定 `cert`/`key` — 由网络驱动提供。

### 手动证书

在 `mode: manual` 下，`cert` 和 `key` 携带 PEM 内容。可通过以下三种方式之一提供该内容（每个字段只选一种，切勿混用）：

1. **内联 PEM** — 字面的 PEM 字符串。
2. **`file://` 引用** — 相对于 manifest 的路径，在加载时解析并内联（防目录穿越）。
3. **环境注册表引用** — 使用 `${env:NAME}` 占位符，在解码时从已注册的 [env 变量](system/env.md) 中取出 PEM。

```yaml
- name: api
  kind: http.service
  addr: ":443"
  tls:
    mode: manual
    cert: file://./certs/server.pem
    key:  file://./certs/server.key
```

```yaml
- name: api
  kind: http.service
  addr: ":443"
  tls:
    mode: manual
    cert: ${env:app.env:tls_cert}
    key:  ${env:app.env:tls_key}
```

`${env:NAME}` 占位符通过[环境注册表](system/env.md)解析 `NAME` — 可以是已注册变量的公开名称，也可以是其条目 ID（例如 `app.env:tls_cert`）。它不是原始的操作系统环境变量；只有当以该名称注册了由 `env.storage.os` 支撑的变量时，才能取到操作系统的值。可以用 `${env:NAME|default}` 提供默认值。

<note>
遗留的 <code>cert_env</code> / <code>key_env</code> 伴随字段仍以同样方式通过环境注册表解析，但已<b>弃用</b> — 请优先使用上面所示的 <code>${env:NAME}</code> 占位符。
</note>

| 字段 | 说明 |
|------|------|
| `mode` | `""`（关闭）、`auto` 或 `manual` |
| `cert` / `key` | PEM 内容 — 内联、`file://` 引用或 `${env:NAME}` 占位符 |

### 双向 TLS (mTLS)

在 `mode: manual` 下，服务器还可以验证客户端证书：

```yaml
tls:
  mode: manual
  cert: ${env:app.env:tls_cert}
  key:  ${env:app.env:tls_key}
  client_ca: file://./certs/clients-ca.pem
  client_auth: require_and_verify
```

`client_ca` 接受与 `cert`/`key` 相同的三种形式（内联 PEM、`file://` 或 `${env:NAME}`）。遗留的 `client_ca_env` 伴随字段同样已弃用，请改用 `client_ca: ${env:NAME}`。

| 字段 | 说明 |
|------|------|
| `client_auth` | `request`、`require_any`、`verify_if_given`、`require_and_verify` |
| `client_ca` | 受信任客户端 CA 的 PEM 包（内联、`file://` 或 `${env:NAME}`） |

`verify_if_given` 和 `require_and_verify` 需要 CA。`request` 和 `require_any` 接受任何客户端证书而不进行 CA 验证。

## 参见

- [路由](http/router.md) - 路由器和端点
- [静态文件](http/static.md) - 静态文件服务
- [中间件](http/middleware.md) - 可用的中间件
- [安全性](system/security.md) - 安全策略
- [WebSocket Relay](http/websocket-relay.md) - WebSocket 消息传递
