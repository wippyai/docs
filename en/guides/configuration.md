# Configuration Reference

Wippy is configured via `.wippy.yaml` files. All options have sensible defaults.

## Logger

Controls the zap logger encoder. CLI flags (`-v`, `-c`, `-s`) override level/output; the only yaml-driven option is the encoding.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `encoding` | string | console | Encoder: `console` (humanized) or `json` (structured) |

```yaml
logger:
  encoding: json
```

## Log Manager

Controls runtime log routing. Console output is configured via [CLI flags](guides/cli.md) (`-v`, `-c`, `-s`).

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `propagate_downstream` | bool | true | Send logs to console/file output |
| `stream_to_events` | bool | false | Publish logs to event bus for programmatic access |
| `min_level` | int | -1 | Minimum level: -1=debug, 0=info, 1=warn, 2=error |

```yaml
logmanager:
  propagate_downstream: true
  stream_to_events: false
  min_level: 0
```

See: [Logger Module](lua/system/logger.md)

## Profiler

Go pprof HTTP server for CPU/memory profiling. Enable with `-p` flag or config.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `enabled` | bool | false | Start profiler server |
| `address` | string | localhost:6060 | Listen address |
| `read_timeout` | duration | 15s | HTTP read timeout |
| `write_timeout` | duration | 15s | HTTP write timeout |
| `idle_timeout` | duration | 60s | Keep-alive timeout |

```yaml
profiler:
  enabled: true
  address: "localhost:6060"
```

Access at `http://localhost:6060/debug/pprof/`

## Security

Global security behavior. Individual policies are defined as [security.policy entries](guides/entry-kinds.md).

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `strict_mode` | bool | false | Deny access when security context is incomplete |

```yaml
security:
  strict_mode: true
```

See: [Security System](system/security.md), [Security Module](lua/security/security.md)

## Registry

Entry storage and version history. The registry holds all configuration entries.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `enable_history` | bool | true | Track entry versions |
| `history_type` | string | memory | Storage: memory, sqlite, nil |
| `history_path` | string | .wippy/registry.db | SQLite file path |

```yaml
registry:
  history_type: sqlite
  history_path: /var/lib/wippy/registry.db
```

See: [Registry Concept](concepts/registry.md), [Registry Module](lua/core/registry.md)

## Relay

Message routing between processes across nodes.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `node_name` | string | local | Identifier for this relay node |

```yaml
relay:
  node_name: worker-1
```

See: [Process Model](concepts/process-model.md)

## Supervisor

Service lifecycle management. Controls the supervisor's internal control mailbox used to dispatch lifecycle events.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `host.buffer_size` | int | 1024 | Internal control mailbox capacity |
| `host.worker_count` | int | 16 | Concurrent dispatcher workers |

```yaml
supervisor:
  host:
    buffer_size: 2048
    worker_count: 32
```

See: [Supervision Guide](guides/supervision.md)

<note>
Per-`process.host` workers and queues are configured on the entry itself (`workers`, `queue_size`, `local_queue_size`), not in this global section. See the [Process Host](system/process-host.md) entry kind.
</note>

## Lua Runtime

Lua VM caching and expression evaluation.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `proto_cache_size` | int | 60000 | Compiled prototype cache |
| `main_cache_size` | int | 10000 | Main chunk cache |
| `cache.enabled` | bool | false | Persist compiled bytecode/typecheck cache to disk |
| `cache.dir` | string | (system cache dir) | Cache directory path |
| `cache.mode` | string | `read_write` | Cache mode: `read_write`, `read_only`, `write_only` |
| `type_system.enabled` | bool | false | Enable static type checking |
| `type_system.strict` | bool | false | Treat type warnings as errors |

```yaml
lua:
  proto_cache_size: 60000
  cache:
    enabled: true
    dir: .cache/lua
  type_system:
    enabled: true
```

See: [Lua Overview](lua/overview.md)

## Finder

Registry search caching. Used internally for entry lookups.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `query_cache_size` | int | 1000 | Cached query results |
| `regex_cache_size` | int | 100 | Compiled regex patterns |

```yaml
finder:
  query_cache_size: 2000
```

## OpenTelemetry

Distributed tracing and metrics export via OTLP.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `enabled` | bool | false | Enable OTEL |
| `endpoint` | string | localhost:4318 | OTLP endpoint |
| `protocol` | string | http/protobuf | Protocol: grpc, http/protobuf |
| `service_name` | string | wippy-runtime | Service identifier |
| `service_version` | string | | Service version tag |
| `insecure` | bool | true | Allow plaintext OTLP connection |
| `sample_rate` | float | 1.0 | Trace sampling (0.0-1.0) |
| `propagators` | string[] | `[tracecontext, baggage]` | Context propagators |
| `traces_enabled` | bool | true | Export traces |
| `metrics_enabled` | bool | false | Export metrics |
| `http.enabled` | bool | true | Trace HTTP requests |
| `http.extract_headers` | bool | true | Extract trace context from inbound headers |
| `http.inject_headers` | bool | true | Inject trace context into outbound headers |
| `process.enabled` | bool | true | Trace process lifecycle |
| `process.trace_lifecycle` | bool | true | Emit spans for spawn/terminate |
| `interceptor.enabled` | bool | true | Trace function calls |
| `interceptor.order` | int | 100 | Interceptor priority |
| `queue.enabled` | bool | true | Trace queue publish/consume |
| `temporal.enabled` | bool | false | Trace Temporal workflows |

```yaml
otel:
  enabled: true
  endpoint: "http://jaeger:4318"
  traces_enabled: true
  process:
    trace_lifecycle: true
```

Standard OTEL environment variables (`OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_SERVICE_NAME`, `OTEL_TRACES_SAMPLER_ARG`, `OTEL_PROPAGATORS`, `OTEL_SDK_DISABLED`) override the matching fields.

See: [Observability Guide](guides/observability.md)

## Shutdown

Graceful shutdown behavior.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `timeout` | duration | 30s | Max wait for components to stop |

```yaml
shutdown:
  timeout: 60s
```

## Metrics

Internal metrics collection buffer.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `buffer.size` | int | 10000 | Metrics buffer capacity |
| `interceptor.enabled` | bool | false | Auto-track function calls |

```yaml
metrics:
  buffer:
    size: 20000
  interceptor:
    enabled: true
```

See: [Metrics Module](lua/system/metrics.md), [Observability Guide](guides/observability.md)

## Prometheus

Prometheus metrics endpoint.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `enabled` | bool | false | Start metrics server |
| `address` | string | localhost:9090 | Listen address |

```yaml
prometheus:
  enabled: true
  address: "0.0.0.0:9090"
```

Exposes `/metrics` endpoint for Prometheus scraping.

See: [Observability Guide](guides/observability.md)

## Cluster

Multi-node clustering with gossip discovery.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `enabled` | bool | false | Enable clustering |
| `name` | string | hostname | Node identifier |
| `internode.bind_addr` | string | 0.0.0.0 | Inter-node bind address |
| `internode.bind_port` | int | 0 | Port (0=auto 7950-7959) |
| `membership.bind_port` | int | 7946 | Gossip port |
| `membership.join_addrs` | string | | Seed nodes (comma-separated) |
| `membership.secret_key` | string | | Encryption key (base64) |
| `membership.secret_file` | string | | Key file path |
| `membership.advertise_addr` | string | | Public address for NAT |

```yaml
cluster:
  enabled: true
  name: node-1
  membership:
    bind_port: 7946
    join_addrs: "10.0.0.1:7946,10.0.0.2:7946"
    secret_file: /etc/wippy/cluster.key
```

## LSP

Language Server Protocol server for editor integrations.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `enabled` | bool | false | Enable the TCP server |
| `address` | string | :7777 | TCP listen address |
| `http_enabled` | bool | false | Enable the HTTP transport |
| `http_address` | string | :7778 | HTTP listen address |
| `http_path` | string | /lsp | HTTP endpoint path |
| `http_allow_origin` | string | * | CORS allowed origin |
| `max_message_bytes` | int | 8388608 | Max incoming message size |

```yaml
lsp:
  enabled: true
  address: ":7777"
  http_enabled: true
```

See: [LSP Guide](guides/lsp.md)

## Network Service

Overlay network manager (SOCKS5, I2P, Tailscale drivers).

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `state_dir` | string | .wippy/net | Driver state storage directory |
| `default_network` | string | | Default network ID applied when entries omit `network` |

```yaml
network_service:
  state_dir: /var/lib/wippy/net
  default_network: app:tailscale
```

See: [Network Overlays](system/network.md)

## Modules

Module registry client used by `wippy install`/`update`.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `registry_url` | string | https://hub.wippy.ai | Registry endpoint |

```yaml
modules:
  registry_url: https://internal-registry.example.com
```

## Extensions

Native Go plugin extensions loaded at boot (Unix only).

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `enabled` | bool | true | Load extensions |
| `paths` | string[] | | Plugin file paths (relative to config dir) |

```yaml
extensions:
  enabled: true
  paths:
    - ./extensions/myplugin.so
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `GOMEMLIMIT` | Memory limit (overrides `--memory-limit` flag) |

## See Also

- [CLI Reference](guides/cli.md) - Command line options
- [Entry Kinds](guides/entry-kinds.md) - All entry types
- [Observability Guide](guides/observability.md) - Logging, metrics, tracing
