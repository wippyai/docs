# Observability

Configure logging, metrics, and distributed tracing for Wippy applications.

## Overview

Wippy provides three observability pillars configured at boot time:

| Pillar | Backend | Configuration |
|--------|---------|---------------|
| Logging | Zap (JSON structured) | `logger` and `logmanager` |
| Metrics | Prometheus | `prometheus` |
| Tracing | OpenTelemetry | `otel` |

## Logger Configuration

### Basic Logger

```yaml
logger:
  mode: production     # development or production
  level: info          # debug, info, warn, error
  encoding: json       # json or console
```

### Log Manager

The log manager controls log propagation and event streaming:

```yaml
logmanager:
  propagate_downstream: true   # Propagate to child components
  stream_to_events: false      # Forward logs to event bus
  min_level: 0                 # -1=debug, 0=info, 1=warn, 2=error
```

When `stream_to_events` is enabled, log entries become events that processes can subscribe to via the event bus.

### Automatic Context

All logs include:

- `pid` - Process ID
- `location` - Entry ID and line number (e.g., `app.api:handler:45`)

## Prometheus Metrics

```yaml
prometheus:
  enabled: true
  address: "localhost:9090"
```

Metrics are exposed at `/metrics` on the configured address.

### Scrape Configuration

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'wippy'
    static_configs:
      - targets: ['localhost:9090']
    scrape_interval: 15s
```

For the Lua metrics API, see [Metrics Module](lua-metrics.md).

## OpenTelemetry

OTEL provides distributed tracing and optional metrics export.

### Basic Configuration

```yaml
otel:
  enabled: true
  endpoint: "localhost:4318"
  protocol: http/protobuf      # grpc or http/protobuf
  service_name: my-app
  service_version: "1.0.0"
  insecure: false              # Allow non-TLS connections
  sample_rate: 1.0             # 0.0 to 1.0
  traces_enabled: true
  metrics_enabled: false
  propagators:
    - tracecontext
    - baggage
```

### Trace Sources

Enable tracing for specific components:

```yaml
otel:
  enabled: true
  endpoint: "localhost:4318"
  service_name: my-app

  # HTTP request tracing
  http:
    enabled: true
    extract_headers: true      # Read incoming trace context
    inject_headers: true       # Write outgoing trace context

  # Process lifecycle tracing
  process:
    enabled: true
    trace_lifecycle: true      # Trace spawn/exit events

  # Queue message tracing
  queue:
    enabled: true

  # Function call tracing
  interceptor:
    enabled: true
    order: 0                   # Interceptor execution order
```

### Temporal Workflows

Enable tracing for Temporal workflows:

```yaml
otel:
  enabled: true
  endpoint: "localhost:4318"
  service_name: my-app

  temporal:
    enabled: true
```

When enabled, the Temporal SDK's tracing interceptor is registered for both client and worker operations.

Traced operations:
- Workflow starts and completions
- Activity executions
- Child workflow calls
- Signal and query handling

### What Gets Traced

| Component | Span Name | Attributes |
|-----------|-----------|------------|
| HTTP requests | `{METHOD} {route}` | http.method, http.url, http.host |
| Function calls | Function ID | process.pid, frame.id |
| Process lifecycle | `{source}.started/terminated` | process.pid |
| Queue messages | Message topic | Trace context in headers |
| Temporal workflows | Workflow/Activity name | workflow.id, run.id |

### Context Propagation

Trace context propagates automatically:

- **HTTP → Function**: W3C Trace Context headers
- **Function → Function**: Frame context inheritance
- **Process → Process**: Spawn context
- **Queue publish → consume**: Message headers

### Environment Variables

OTEL can be configured via environment:

| Variable | Description |
|----------|-------------|
| `OTEL_SDK_DISABLED` | Set to `true` to disable OTEL |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | Collector endpoint |
| `OTEL_EXPORTER_OTLP_PROTOCOL` | `grpc` or `http/protobuf` |
| `OTEL_SERVICE_NAME` | Service name |
| `OTEL_SERVICE_VERSION` | Service version |
| `OTEL_TRACES_SAMPLER_ARG` | Sample rate (0.0-1.0) |
| `OTEL_PROPAGATORS` | Propagator list |

## Runtime Statistics

The `system` module provides internal runtime statistics:

```lua
local system = require("system")

-- Memory statistics
local mem = system.memory.stats()
-- mem.alloc, mem.heap_alloc, mem.heap_objects, etc.

-- Goroutine count
local count = system.runtime.goroutines()

-- Supervisor states
local states = system.supervisor.states()
```

## See Also

- [Logger Module](lua-logger.md) - Lua logging API
- [Metrics Module](lua-metrics.md) - Lua metrics API
- [System Module](lua-system.md) - Runtime statistics
