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

## 超时设置

配置超时以防止资源耗尽：

```yaml
timeouts:
  read: "10s"    # 读取请求头的最大时间
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

<warning>
TLS 终止通常由反向代理处理 (Nginx、Caddy、负载均衡器)。配置代理将请求转发到 Wippy 的 HTTP 服务器。
</warning>

## 参见

- [路由](http/router.md) - 路由器和端点
- [静态文件](http/static.md) - 静态文件服务
- [中间件](http/middleware.md) - 可用的中间件
- [安全性](system/security.md) - 安全策略
- [WebSocket Relay](http/websocket-relay.md) - WebSocket 消息传递
