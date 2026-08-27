---
title: "Observability"
description: "Configure Wippy logging, Prometheus metrics, OpenTelemetry tracing, and runtime statistics."
---

# Observability

Wippy exposes application and runtime behavior through logging, metrics, distributed tracing, and runtime statistics.

## Overview

Three observability areas are configured at boot:

| Pillar | Backend | Configuration |
|--------|---------|---------------|
| Logging | Zap (JSON structured) | `logger` and `logmanager` |
| Metrics | Prometheus | `prometheus` |
| Tracing | OpenTelemetry | `otel` |

## Logger Configuration

### Logger Encoding

```yaml
logger:
  encoding: json       # json or console
```

Level and output are controlled by CLI flags (`-v`, `-c`, `-s`); only `encoding` is read from YAML.

### Log Manager

The log manager controls log propagation and event streaming:

```yaml
logmanager:
  propagate_downstream: true   # Propagate to child components
  stream_to_events: false      # Forward logs to event bus
  min_level: 0                 # -1=debug, 0=info, 1=warn, 2=error
```

When `stream_to_events` is enabled, log entries become events that processes can subscribe to via the event bus.

The embedded log-manager default is `-1`, but `wippy run` applies its CLI logging choice at startup: info (`0`) by default and debug (`-1`) with `-v` or `--very-verbose`.

### Automatic Context

Logs emitted from Lua via the [logger module](../lua/system/logger.md) automatically include:

- `pid` - Current process PID
- `location` - Entry ID and caller line (e.g., `app.api:handler:45`)

## Prometheus Metrics

```yaml
prometheus:
  enabled: true
  address: "localhost:9090"
```

The Prometheus server starts only when `enabled` is `true` and `address` is non-empty. It exposes metrics at `/metrics` and the runtime liveness handler at `/livez` on that address.

### Scrape Configuration

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'wippy'
    static_configs:
      - targets: ['localhost:9090']
    scrape_interval: 15s
```

For the Lua metrics API, see [Metrics Module](../lua/system/metrics.md).

## OpenTelemetry

OpenTelemetry (OTEL) provides distributed tracing and optional metrics export.

### Basic Configuration

```yaml
otel:
  enabled: true
  endpoint: "localhost:4318"
  protocol: http/protobuf      # grpc or http/protobuf
  service_name: my-app
  service_version: "1.0.0"
  insecure: true               # Use plaintext for a local collector
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
    inject_headers: true       # Write trace context to the HTTP response

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
```

When OTEL is enabled, HTTP tracing and propagation, process tracing and lifecycle spans, function interception, queue tracing, and trace export are enabled by default. Temporal tracing and metric export default to disabled. The pinned runtime registers the function interceptor at order 100; although an `interceptor.order` value can be decoded from configuration, it does not change that registration order.

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

Traced operations include:

- Workflow starts and completions
- Activity executions
- Child workflow calls
- Signal and query handling

### What Gets Traced

| Component | Span Name | Attributes |
|-----------|-----------|------------|
| HTTP requests | `{METHOD} {route}` | http.method, http.url, http.host |
| Function calls | Function ID | process.pid, frame.id |
| Process lifecycle | `<source-id>.started/terminated`, or `process.started/terminated` without a source frame | process.pid, lifecycle.event |
| Queue publish | `<queue-id>.publish` | messaging attributes and trace context in headers |
| Queue consume | Handler function ID | messaging attributes inherited by the function span |
| Temporal workflows | Temporal SDK operation name | Temporal SDK workflow and run metadata |

### Context Propagation

The configured integrations propagate trace context through:

- **HTTP → Function**: W3C Trace Context headers
- **Function → Function**: Frame context inheritance
- **Process → Process**: Spawn context
- **Queue publish → consume**: Message headers

### Environment Variables

OTEL can be configured via environment:

| Variable | Description |
|----------|-------------|
| `OTEL_SDK_DISABLED` | Set to `true` to disable OTEL |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | Collector endpoint; an `http://` or `https://` scheme is removed before exporter setup |
| `OTEL_EXPORTER_OTLP_PROTOCOL` | `grpc` or `http/protobuf` |
| `OTEL_EXPORTER_OTLP_INSECURE` | Set to `true` to use a plaintext collector connection |
| `OTEL_SERVICE_NAME` | Service name |
| `OTEL_SERVICE_VERSION` | Service version |
| `OTEL_TRACES_SAMPLER` | `always_on`, `always_off`, `traceidratio`, or `parentbased_traceidratio` |
| `OTEL_TRACES_SAMPLER_ARG` | Sample rate (0.0-1.0) |
| `OTEL_PROPAGATORS` | Propagator list |

## Runtime Statistics

The `system` module provides internal runtime statistics:

```lua
local system = require("system")

-- Memory statistics
local mem, mem_err = system.memory.stats()
-- mem.alloc, mem.heap_alloc, mem.heap_objects, etc.

-- Goroutine count
local count, count_err = system.runtime.goroutines()

-- Supervisor states
local states, states_err = system.supervisor.states()
```

These functions return `value, error`. They require the `system.read` permission in the current security scope.

## See Also

- [Logger Module](../lua/system/logger.md) — Lua logging API
- [Metrics Module](../lua/system/metrics.md) — Lua metrics API
- [System Module](../lua/system/system.md) — Runtime statistics
