# HTTP Server

The HTTP server (`http.service`) listens on a port and hosts routers, endpoints, and static file handlers.

## Configuration

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

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `addr` | string | required | Listen address (`:8080`, `0.0.0.0:443`) |
| `timeouts.read` | duration | - | Request read timeout |
| `timeouts.write` | duration | - | Response write timeout |
| `timeouts.idle` | duration | - | Keep-alive connection timeout |
| `host.buffer_size` | int | 1024 | Message relay buffer size |
| `host.worker_count` | int | NumCPU | Message relay workers |

## Timeouts

Configure timeouts to prevent resource exhaustion:

```yaml
timeouts:
  read: "10s"    # Max time to read request headers
  write: "60s"   # Max time to write response
  idle: "120s"   # Keep-alive timeout
```

- `read` - Short (5-10s) for APIs, longer for uploads
- `write` - Match expected response generation time
- `idle` - Balance connection reuse vs resource usage

<note>
Duration format: <code>30s</code>, <code>1m</code>, <code>2h15m</code>. Use <code>0</code> to disable.
</note>

## Host Configuration

The `host` section configures the server's internal message relay used by components like WebSocket relay:

```yaml
host:
  buffer_size: 2048
  worker_count: 8
```

| Field | Default | Description |
|-------|---------|-------------|
| `buffer_size` | 1024 | Message queue capacity per worker |
| `worker_count` | NumCPU | Parallel message processing goroutines |

<tip>
Increase these values for high-throughput WebSocket applications. The message relay handles async delivery between HTTP components and processes.
</tip>

## Security

HTTP servers can have a default security context applied through the lifecycle configuration:

```yaml
lifecycle:
  auto_start: true
  security:
    actor:
      id: "gateway-service"
    policies:
      - app:http_access_policy
```

This sets a baseline actor and policies for all requests. For authenticated requests, the [token_auth middleware](http/middleware.md) overrides the actor based on the validated token, allowing per-user security policies.

## Lifecycle

Servers are managed by the supervisor:

```yaml
lifecycle:
  auto_start: true
  start_timeout: 30s
  stop_timeout: 60s
  depends_on:
    - app:database
```

| Field | Description |
|-------|-------------|
| `auto_start` | Start when application starts |
| `start_timeout` | Max time to wait for server to start |
| `stop_timeout` | Max time for graceful shutdown |
| `depends_on` | Start after these entries are ready |

## Connecting Components

Routers and static handlers reference the server via metadata:

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

## Multiple Servers

Run separate servers for different purposes:

```yaml
entries:
  # Public API
  - name: public
    kind: http.service
    addr: ":8080"
    lifecycle:
      auto_start: true

  # Admin (localhost only)
  - name: admin
    kind: http.service
    addr: "127.0.0.1:9090"
    lifecycle:
      auto_start: true
```

<warning>
TLS termination is typically handled by a reverse proxy (Nginx, Caddy, load balancer). Configure your proxy to forward to Wippy's HTTP server.
</warning>

## See Also

- [Routing](http/router.md) - Routers and endpoints
- [Static Files](http/static.md) - Static file serving
- [Middleware](http/middleware.md) - Available middleware
- [Security](system/security.md) - Security policies
- [WebSocket Relay](http/websocket-relay.md) - WebSocket messaging
