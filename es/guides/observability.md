---
title: "Observabilidad"
description: "Configura logging de Wippy, métricas Prometheus, tracing de OpenTelemetry y estadísticas del runtime."
---

# Observabilidad

Wippy expone el comportamiento de la aplicación y del runtime mediante logging, métricas, tracing distribuido y estadísticas del runtime.

## Resumen

Se configuran tres áreas de observabilidad durante el boot:

| Pilar | Backend | Configuración |
|--------|---------|---------------|
| Logging | Zap (JSON estructurado) | `logger` y `logmanager` |
| Métricas | Prometheus | `prometheus` |
| Tracing | OpenTelemetry | `otel` |

## Configuración del logger

### Encoding del logger

```yaml
logger:
  encoding: json       # json or console
```

El nivel y el output se controlan mediante flags de CLI (`-v`, `-c`, `-s`); YAML solo lee `encoding`.

### Log Manager

El log manager controla la propagación de logs y el streaming de eventos:

```yaml
logmanager:
  propagate_downstream: true   # Propagate to child components
  stream_to_events: false      # Forward logs to event bus
  min_level: 0                 # -1=debug, 0=info, 1=warn, 2=error
```

Cuando `stream_to_events` está habilitado, las entradas de log se convierten en eventos a los que pueden suscribirse los procesos mediante el event bus.

El default embebido del log manager es `-1`, pero `wippy run` aplica al inicio su elección de logging de CLI: info (`0`) de forma predeterminada y debug (`-1`) con `-v` o `--very-verbose`.

### Contexto automático

Los logs emitidos desde Lua mediante el [módulo logger](lua/system/logger.md) incluyen automáticamente:

- `pid` - PID del proceso actual
- `location` - ID de entrada y línea del caller, por ejemplo `app.api:handler:45`

## Métricas Prometheus

```yaml
prometheus:
  enabled: true
  address: "localhost:9090"
```

El servidor Prometheus solo se inicia cuando `enabled` es `true` y `address` no está vacío. Expone métricas en `/metrics` y el handler de liveness del runtime en `/livez` en esa dirección.

### Configuración de scrape

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'wippy'
    static_configs:
      - targets: ['localhost:9090']
    scrape_interval: 15s
```

Para la API de métricas Lua, consulta el [módulo Metrics](lua/system/metrics.md).

## OpenTelemetry

OpenTelemetry (OTEL) proporciona tracing distribuido y export opcional de métricas.

### Configuración básica

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

### Fuentes de traces

Habilita tracing para componentes concretos:

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

Cuando OTEL está habilitado, se activan de forma predeterminada tracing y propagación HTTP, tracing de procesos y spans de ciclo de vida, interception de funciones, tracing de queues y export de traces. El tracing de Temporal y el export de métricas están deshabilitados de forma predeterminada. El runtime fijado registra el interceptor de funciones en order 100; aunque se puede decodificar un valor `interceptor.order` de la configuración, no cambia ese orden de registro.

### Workflows de Temporal

Habilita tracing para workflows de Temporal:

```yaml
otel:
  enabled: true
  endpoint: "localhost:4318"
  service_name: my-app

  temporal:
    enabled: true
```

Cuando se habilita, el interceptor de tracing del SDK de Temporal se registra para operaciones tanto de client como de worker.

Las operaciones traced incluyen:

- Inicio y finalización de workflows
- Ejecución de activities
- Llamadas a child workflows
- Gestión de signals y queries

### Qué se tracea

| Componente | Nombre de span | Atributos |
|-----------|-----------|------------|
| Requests HTTP | `{METHOD} {route}` | http.method, http.url, http.host |
| Llamadas de función | ID de función | process.pid, frame.id |
| Ciclo de vida de procesos | `<source-id>.started/terminated`, o `process.started/terminated` sin source frame | process.pid, lifecycle.event |
| Publicación en queue | `<queue-id>.publish` | atributos de messaging y trace context en headers |
| Consumo de queue | ID de función handler | atributos de messaging heredados por el span de función |
| Workflows de Temporal | Nombre de operación del SDK de Temporal | metadatos de workflow y run del SDK |

### Propagación del contexto

Las integraciones configuradas propagan trace context mediante:

- **HTTP → Function**: headers W3C Trace Context
- **Function → Function**: herencia de contexto del frame
- **Process → Process**: contexto de spawn
- **Queue publish → consume**: headers del mensaje

### Variables de entorno

OTEL se puede configurar mediante el entorno:

| Variable | Descripción |
|----------|-------------|
| `OTEL_SDK_DISABLED` | Establece `true` para deshabilitar OTEL |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | Endpoint del collector; se elimina un scheme `http://` o `https://` antes de configurar el exporter |
| `OTEL_EXPORTER_OTLP_PROTOCOL` | `grpc` o `http/protobuf` |
| `OTEL_EXPORTER_OTLP_INSECURE` | Establece `true` para usar una conexión plaintext al collector |
| `OTEL_SERVICE_NAME` | Nombre del servicio |
| `OTEL_SERVICE_VERSION` | Versión del servicio |
| `OTEL_TRACES_SAMPLER` | `always_on`, `always_off`, `traceidratio` o `parentbased_traceidratio` |
| `OTEL_TRACES_SAMPLER_ARG` | Sample rate (0.0-1.0) |
| `OTEL_PROPAGATORS` | Lista de propagators |

## Estadísticas del runtime

El módulo `system` proporciona estadísticas internas del runtime:

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

Estas funciones devuelven `value, error`. Requieren el permiso `system.read` en el security scope actual.

## Véase también

- [Módulo Logger](lua/system/logger.md) — API de logging Lua
- [Módulo Metrics](lua/system/metrics.md) — API de métricas Lua
- [Módulo System](lua/system/system.md) — Estadísticas del runtime
