# Configuration Reference

Wippy is configured via `.wippy.yaml` files. All options have sensible defaults.

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

Service lifecycle management. Controls how supervised entries start/stop.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `host.buffer_size` | int | 1024 | Message queue capacity |
| `host.worker_count` | int | NumCPU | Concurrent workers |

```yaml
supervisor:
  host:
    buffer_size: 2048
    worker_count: 32
```

See: [Supervision Guide](guides/supervision.md)

## Functions

Function execution host. Runs `function.lua` entries.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `host.buffer_size` | int | 1024 | Task queue capacity |
| `host.worker_count` | int | NumCPU | Concurrent workers |

```yaml
functions:
  host:
    buffer_size: 2048
    worker_count: 32
```

See: [Functions Concept](concepts/functions.md), [Funcs Module](lua/core/funcs.md)

## Lua Runtime

Lua VM caching and expression evaluation.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `proto_cache_size` | int | 60000 | Compiled prototype cache |
| `main_cache_size` | int | 10000 | Main chunk cache |
| `expr.cache_enabled` | bool | true | Cache compiled expressions |
| `expr.capacity` | int | 5000 | Expression cache size |
| `json.cache_enabled` | bool | true | Cache JSON schemas |
| `json.capacity` | int | 1000 | JSON cache size |

```yaml
lua:
  proto_cache_size: 60000
  expr:
    cache_enabled: true
    capacity: 5000
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
| `service_name` | string | wippy | Service identifier |
| `sample_rate` | float | 1.0 | Trace sampling (0.0-1.0) |
| `traces_enabled` | bool | false | Export traces |
| `metrics_enabled` | bool | false | Export metrics |
| `http.enabled` | bool | true | Trace HTTP requests |
| `process.enabled` | bool | true | Trace process lifecycle |
| `interceptor.enabled` | bool | false | Trace function calls |

```yaml
otel:
  enabled: true
  endpoint: "http://jaeger:4318"
  traces_enabled: true
  process:
    trace_lifecycle: true
```

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

See: [Cluster Guide](guides/cluster.md)

## Environment Variables

| Variable | Description |
|----------|-------------|
| `GOMEMLIMIT` | Memory limit (overrides `--memory-limit` flag) |

## See Also

- [CLI Reference](guides/cli.md) - Command line options
- [Entry Kinds](guides/entry-kinds.md) - All entry types
- [Cluster Guide](guides/cluster.md) - Multi-node setup
- [Observability Guide](guides/observability.md) - Logging, metrics, tracing
