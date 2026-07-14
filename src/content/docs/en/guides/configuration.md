---
title: "Configuration Reference"
description: "Wippy is configured via .wippy.yaml files. All options have sensible defaults."
---

# Configuration Reference

Wippy is configured via `.wippy.yaml` files. All options have sensible defaults.

Any value below can be overridden at launch with `wippy run --set section.path=value` (repeatable, takes precedence over the file). To override individual registry *entries* rather than these config sections, use the `override:` section or `-o` — see [Overriding Entries](guides/entry-kinds.md#overriding-entries).

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
| `node_name` | string | derived per-instance ID | Identifier for this relay node (default: UUIDv5 of machine-id/hostname + working dir; overridable via `WIPPY_NODE_ID` / `WIPPY_RELAY_NODE_NAME`) |

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
| `cache.dir` | string | `.wippy/cache/lua` | Cache directory path (relative to the config/working directory) |
| `cache.mode` | string | `readwrite` | Cache mode: `readwrite` (default), `readonly`, `off` |
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
| `address` | string | | Listen address; must be set explicitly when `enabled: true`, otherwise the metrics server does not start |

```yaml
prometheus:
  enabled: true
  address: "0.0.0.0:9090"
```

Exposes `/metrics` endpoint for Prometheus scraping.

See: [Observability Guide](guides/observability.md)

## Cluster

Multi-node clustering: gossip membership plus a bounded Raft consensus core. See the [Cluster Guide](guides/cluster.md) for the architecture and operational model; this section is the config-key reference.

### Top-level

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `enabled` | bool | false | Enable clustering |
| `name` | string | hostname | Node name; must be unique across the cluster |
| `failure_domain` | string | | Zone/rack label; advertised in gossip so voters spread across domains |

### Membership (gossip)

SWIM gossip via memberlist. Used for node discovery, failure detection, and metadata dissemination.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `membership.bind_addr` | string | 0.0.0.0 | Gossip bind address |
| `membership.bind_port` | int | 7946 | Gossip bind port (TCP+UDP) |
| `membership.advertise_addr` | string | | Address peers use to reach this node (NAT/k8s) |
| `membership.join_addrs` | string | | Comma-separated seed `host:port` pairs |
| `membership.secret_key` | string | | Base64-encoded gossip encryption key (inline) |
| `membership.secret_file` | string | | Path to file holding the gossip encryption key |

### Internode (transport)

TCP mesh carrying the relay and Raft traffic between nodes. Raft rides this mesh (yamux-multiplexed); there is no separate Raft port.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `internode.bind_addr` | string | 0.0.0.0 | Mesh bind address |
| `internode.bind_port` | int | 0 | Mesh port (0 = auto: 7950-7959, then ephemeral) |
| `internode.auto_port` | bool | true | Discover the actual port at boot, pin it, and advertise it in gossip |

### Raft (consensus)

Bounded Raft. Raft state is fs-durable by default, stored under `raft.data_dir` (default `~/.wippy/store`); a restarted node still rejoins quorum from peers. [`store.kv.raft`](system/store.md#cluster-kv-stores) entries replicate through it. Bootstrap is gossip-driven (Consul/Nomad `bootstrap_expect` style).

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `raft.data_dir` | string | `~/.wippy/store` | Directory for fs-durable Raft state and durable CRDT snapshots (under `<data_dir>/_sys/`). Diskless only when no path resolves (no home dir and none set) |
| `raft.enabled` | bool | true | Run a Raft node; `false` makes this a gossip-only client |
| `raft.role` | string | server | `server` runs a Raft node; `client` is gossip-only |
| `raft.eligible` | bool | true | Whether this node may be selected as a voter |
| `raft.priority` | int | 100 | Voter selection priority (lower is preferred) |
| `raft.bootstrap_expect` | int | 1 | Initial quorum size: `0`=join existing, `1`=single-node, `N`=wait for N eligible peers then form quorum |
| `raft.max_voters` | int | 5 | Voter ceiling (must be odd); extra eligible nodes become standbys |
| `raft.max_standbys` | int | 4 | Non-voting members kept warm for promotion; nodes beyond voters+standbys are not Raft members |
| `raft.reconcile_debounce` | duration | 2s | Coalesce window after a gossip event before the voter reconciler runs |
| `raft.reconcile_timeout` | duration | 2s | Bound per reconcile pass |
| `raft.heartbeat_timeout` | duration | 3s | Follower idle wait before starting an election |
| `raft.election_timeout` | duration | 3s | Candidate election timeout (clamped to >= heartbeat) |
| `raft.commit_timeout` | duration | 500ms | Idle leader heartbeat cadence |
| `raft.snapshot_threshold` | uint64 | 8192 | Log entries since last snapshot before a new one |
| `raft.snapshot_interval` | duration | 2m | Snapshot check interval |
| `raft.snapshot_retain` | int | 3 | Snapshots retained |
| `raft.trailing_logs` | uint64 | 10240 | Log entries retained after a snapshot |
| `raft.max_append_entries` | int | 16 | Max entries per AppendEntries RPC |
| `raft.leader_probe_interval` | duration | 3s | Global-registry leader-reachability probe cadence |
| `raft.leader_probe_grace` | int | 3 | Consecutive probe failures before leader is declared unreachable |

Single-node (development) — clustering on, bootstraps itself immediately:

```yaml
cluster:
  enabled: true
  name: dev
  raft:
    bootstrap_expect: 1
```

Three-node voting cluster — each node lists the others as seeds and waits for all three before forming quorum:

```yaml
cluster:
  enabled: true
  name: node-1
  failure_domain: us-east-1a
  membership:
    bind_port: 7946
    join_addrs: "node-2:7946,node-3:7946"
    secret_file: /etc/wippy/cluster.key
  raft:
    bootstrap_expect: 3
    max_voters: 5
```

Gossip-only client — joins the cluster for naming/messaging but never runs Raft:

```yaml
cluster:
  enabled: true
  name: edge-7
  membership:
    join_addrs: "node-1:7946,node-2:7946"
  raft:
    role: client
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

## HTTP Dispatcher

Tuning for the shared HTTP client pool used by HTTP-dispatched functions and outbound requests.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `dispatcher.http.timeout` | duration | 0 (none) | Per-request timeout |
| `dispatcher.http.max_idle_conns` | int | 0 (stdlib) | Max idle connections across all hosts |
| `dispatcher.http.max_idle_per_host` | int | 0 (stdlib) | Max idle connections per host |
| `dispatcher.http.idle_conn_timeout` | duration | 0 (stdlib) | Idle connection timeout |
| `dispatcher.http.max_clients` | int | 0 (unbounded) | Max distinct pooled clients |

```yaml
dispatcher:
  http:
    timeout: 30s
    max_idle_per_host: 32
```

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
| `GOMEMLIMIT` | Memory limit fallback when `--memory-limit` flag is not set (precedence: `--memory-limit` flag > `GOMEMLIMIT` > 1G default) |

## See Also

- [CLI Reference](guides/cli.md) - Command line options
- [Cluster Guide](guides/cluster.md) - Clustering architecture and operations
- [Entry Kinds](guides/entry-kinds.md) - All entry types
- [Observability Guide](guides/observability.md) - Logging, metrics, tracing
