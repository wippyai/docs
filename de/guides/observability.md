# Observability

Konfiguration von Logging, Metriken und verteiltem Tracing für Wippy-Anwendungen.

## Übersicht

Wippy bietet drei Observability-Säulen, die beim Start konfiguriert werden:

| Säule | Backend | Konfiguration |
|-------|---------|---------------|
| Logging | Zap (JSON strukturiert) | `logger` und `logmanager` |
| Metriken | Prometheus | `prometheus` |
| Tracing | OpenTelemetry | `otel` |

## Logger-Konfiguration

### Basis-Logger

```yaml
logger:
  mode: production     # development oder production
  level: info          # debug, info, warn, error
  encoding: json       # json oder console
```

### Log-Manager

Der Log-Manager steuert Log-Propagierung und Event-Streaming:

```yaml
logmanager:
  propagate_downstream: true   # An Kindkomponenten propagieren
  stream_to_events: false      # Logs an Event-Bus weiterleiten
  min_level: 0                 # -1=debug, 0=info, 1=warn, 2=error
```

Wenn `stream_to_events` aktiviert ist, werden Log-Einträge zu Events, die Prozesse über den Event-Bus abonnieren können.

### Automatischer Kontext

Alle Logs enthalten:

- `pid` - Prozess-ID
- `location` - Entry-ID und Zeilennummer (z.B. `app.api:handler:45`)

## Prometheus-Metriken

```yaml
prometheus:
  enabled: true
  address: "localhost:9090"
```

Metriken werden unter `/metrics` auf der konfigurierten Adresse bereitgestellt.

### Scrape-Konfiguration

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'wippy'
    static_configs:
      - targets: ['localhost:9090']
    scrape_interval: 15s
```

Für die Lua-Metriken-API siehe [Metriken-Modul](lua/system/metrics.md).

## OpenTelemetry

OTEL bietet verteiltes Tracing und optionalen Metrik-Export.

### Basis-Konfiguration

```yaml
otel:
  enabled: true
  endpoint: "localhost:4318"
  protocol: http/protobuf      # grpc oder http/protobuf
  service_name: my-app
  service_version: "1.0.0"
  insecure: false              # Nicht-TLS-Verbindungen erlauben
  sample_rate: 1.0             # 0.0 bis 1.0
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

  # HTTP-Request-Tracing
  http:
    enabled: true
    extract_headers: true      # Eingehenden Trace-Kontext lesen
    inject_headers: true       # Ausgehenden Trace-Kontext schreiben

  # Prozess-Lebenszyklus-Tracing
  process:
    enabled: true
    trace_lifecycle: true      # Spawn/Exit-Events tracen

  # Queue-Nachrichten-Tracing
  queue:
    enabled: true

  # Funktionsaufruf-Tracing
  interceptor:
    enabled: true
    order: 0                   # Interceptor-Ausführungsreihenfolge
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
| Prozess-Lebenszyklus | `{source}.started/terminated` | process.pid |
| Queue-Nachrichten | Nachrichten-Topic | Trace-Kontext in Headern |
| Temporal-Workflows | Workflow/Activity-Name | workflow.id, run.id |

### Kontext-Propagierung

Trace-Kontext propagiert automatisch:

- **HTTP → Funktion**: W3C Trace Context Header
- **Funktion → Funktion**: Frame-Kontext-Vererbung
- **Prozess → Prozess**: Spawn-Kontext
- **Queue publish → consume**: Nachrichten-Header

### Umgebungsvariablen

OTEL kann über Umgebungsvariablen konfiguriert werden:

| Variable | Beschreibung |
|----------|--------------|
| `OTEL_SDK_DISABLED` | Auf `true` setzen um OTEL zu deaktivieren |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | Collector-Endpunkt |
| `OTEL_EXPORTER_OTLP_PROTOCOL` | `grpc` oder `http/protobuf` |
| `OTEL_SERVICE_NAME` | Dienstname |
| `OTEL_SERVICE_VERSION` | Dienstversion |
| `OTEL_TRACES_SAMPLER_ARG` | Sample-Rate (0.0-1.0) |
| `OTEL_PROPAGATORS` | Propagator-Liste |

## Runtime-Statistiken

Das `system`-Modul bietet interne Runtime-Statistiken:

```lua
local system = require("system")

-- Speicherstatistiken
local mem = system.memory.stats()
-- mem.alloc, mem.heap_alloc, mem.heap_objects, etc.

-- Goroutine-Anzahl
local count = system.runtime.goroutines()

-- Supervisor-Zustände
local states = system.supervisor.states()
```

## Siehe auch

- [Logger-Modul](lua/system/logger.md) - Lua-Logging-API
- [Metriken-Modul](lua/system/metrics.md) - Lua-Metriken-API
- [System-Modul](lua/system/system.md) - Runtime-Statistiken
