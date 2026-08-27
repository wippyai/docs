---
title: "Observability"
description: "Konfigurieren Sie Wippy-Logging, Prometheus-Metriken, OpenTelemetry-Tracing und Runtime-Statistiken."
---

# Observability

Wippy macht das Verhalten von Anwendung und Runtime durch Logging, Metriken, verteiltes Tracing und Runtime-Statistiken sichtbar.

## Übersicht

Drei Observability-Bereiche werden beim Start konfiguriert:

| Säule | Backend | Konfiguration |
|-------|---------|---------------|
| Logging | Zap (JSON strukturiert) | `logger` und `logmanager` |
| Metriken | Prometheus | `prometheus` |
| Tracing | OpenTelemetry | `otel` |

## Logger-Konfiguration

### Logger-Kodierung

```yaml
logger:
  encoding: json       # json or console
```

Level und Ausgabe werden über CLI-Flags (`-v`, `-c`, `-s`) gesteuert; nur `encoding` wird aus YAML gelesen.

### Log-Manager

Der Log-Manager steuert Log-Propagierung und Event-Streaming:

```yaml
logmanager:
  propagate_downstream: true   # Propagate to child components
  stream_to_events: false      # Forward logs to event bus
  min_level: 0                 # -1=debug, 0=info, 1=warn, 2=error
```

Wenn `stream_to_events` aktiviert ist, werden Log-Einträge zu Events, die Prozesse über den Event-Bus abonnieren können.

Der eingebettete Standard des Log-Managers ist `-1`, aber `wippy run` wendet beim Start seine CLI-Logging-Auswahl an: standardmäßig Info (`0`), mit `-v` oder `--very-verbose` Debug (`-1`).

### Automatischer Kontext

Logs, die aus Lua über das [Logger-Modul](../lua/system/logger.md) ausgegeben werden, enthalten automatisch:

- `pid` - Aktuelle Prozess-PID
- `location` - Entry-ID und aufrufende Zeile (z.B. `app.api:handler:45`)

## Prometheus-Metriken

```yaml
prometheus:
  enabled: true
  address: "localhost:9090"
```

Der Prometheus-Server startet nur, wenn `enabled` den Wert `true` hat und `address` nicht leer ist. Er stellt unter dieser Adresse Metriken unter `/metrics` und den Runtime-Liveness-Handler unter `/livez` bereit.

### Scrape-Konfiguration

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'wippy'
    static_configs:
      - targets: ['localhost:9090']
    scrape_interval: 15s
```

Die Lua-Metrik-API beschreibt das [Metrik-Modul](../lua/system/metrics.md).

## OpenTelemetry

OpenTelemetry (OTEL) bietet verteiltes Tracing und optionalen Metrikexport.

### Basis-Konfiguration

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

### Trace-Quellen

Tracing für bestimmte Komponenten aktivieren:

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

### Temporal Workflows

Tracing für Temporal-Workflows aktivieren:

```yaml
otel:
  enabled: true
  endpoint: "localhost:4318"
  service_name: my-app

  temporal:
    enabled: true
```

Wenn aktiviert, wird der Tracing-Interceptor des Temporal SDK sowohl für Client- als auch Worker-Operationen registriert.

Wenn OTEL aktiviert ist, sind HTTP-Tracing und -Propagation, Prozess-Tracing und Lebenszyklus-Spans, Function-Interception, Queue-Tracing und Trace-Export standardmäßig aktiv. Temporal-Tracing und Metrikexport sind standardmäßig deaktiviert. Die festgelegte Runtime registriert den Function-Interceptor mit Reihenfolge 100; ein `interceptor.order`-Wert kann zwar aus der Konfiguration dekodiert werden, ändert diese Registrierungsreihenfolge aber nicht.

Getracete Operationen:
- Workflow-Starts und -Abschlüsse
- Activity-Ausführungen
- Kind-Workflow-Aufrufe
- Signal- und Query-Behandlung

### Was wird getracet

| Komponente | Span-Name | Attribute |
|------------|-----------|-----------|
| HTTP-Requests | `{METHOD} {route}` | http.method, http.url, http.host |
| Funktionsaufrufe | Funktions-ID | process.pid, frame.id |
| Prozess-Lebenszyklus | `<source-id>.started/terminated`, ohne Source-Frame `process.started/terminated` | process.pid, lifecycle.event |
| Queue-Publish | `<queue-id>.publish` | Messaging-Attribute und Trace-Kontext in Headern |
| Queue-Consume | ID der Handler-Funktion | Von der Function-Span geerbte Messaging-Attribute |
| Temporal-Workflows | Operationsname des Temporal SDK | Workflow- und Run-Metadaten des Temporal SDK |

### Kontext-Propagierung

Die konfigurierten Integrationen geben Trace-Kontext weiter über:

- **HTTP → Funktion**: W3C Trace Context Header
- **Funktion → Funktion**: Frame-Kontext-Vererbung
- **Prozess → Prozess**: Spawn-Kontext
- **Queue publish → consume**: Nachrichten-Header

### Umgebungsvariablen

OTEL kann über Umgebungsvariablen konfiguriert werden:

| Variable | Beschreibung |
|----------|--------------|
| `OTEL_SDK_DISABLED` | Auf `true` setzen um OTEL zu deaktivieren |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | Collector-Endpoint; ein Schema `http://` oder `https://` wird vor dem Exporter-Setup entfernt |
| `OTEL_EXPORTER_OTLP_PROTOCOL` | `grpc` oder `http/protobuf` |
| `OTEL_EXPORTER_OTLP_INSECURE` | Auf `true` setzen, um eine unverschlüsselte Collector-Verbindung zu verwenden |
| `OTEL_SERVICE_NAME` | Dienstname |
| `OTEL_SERVICE_VERSION` | Dienstversion |
| `OTEL_TRACES_SAMPLER` | `always_on`, `always_off`, `traceidratio` oder `parentbased_traceidratio` |
| `OTEL_TRACES_SAMPLER_ARG` | Sample-Rate (0.0-1.0) |
| `OTEL_PROPAGATORS` | Propagator-Liste |

## Runtime-Statistiken

Das `system`-Modul bietet interne Runtime-Statistiken:

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

Diese Funktionen geben `value, error` zurück. Sie erfordern im aktuellen Security-Scope die Berechtigung `system.read`.

## Siehe auch

- [Logger-Modul](../lua/system/logger.md) — Lua-Logging-API
- [Metrik-Modul](../lua/system/metrics.md) — Lua-Metrik-API
- [System-Modul](../lua/system/system.md) — Runtime-Statistiken
