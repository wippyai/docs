# Observabilidad

Configure logging, métricas y trazado distribuido para aplicaciones Wippy.

## Visión General

Wippy proporciona tres pilares de observabilidad configurados al iniciar:

| Pilar | Backend | Configuración |
|--------|---------|---------------|
| Logging | Zap (JSON estructurado) | `logger` y `logmanager` |
| Métricas | Prometheus | `prometheus` |
| Trazado | OpenTelemetry | `otel` |

## Configuración del Logger

### Logger Básico

```yaml
logger:
  mode: production     # development o production
  level: info          # debug, info, warn, error
  encoding: json       # json o console
```

### Gestor de Logs

El gestor de logs controla la propagación de logs y streaming de eventos:

```yaml
logmanager:
  propagate_downstream: true   # Propagar a componentes hijos
  stream_to_events: false      # Reenviar logs al bus de eventos
  min_level: 0                 # -1=debug, 0=info, 1=warn, 2=error
```

Cuando `stream_to_events` está habilitado, las entradas de log se convierten en eventos a los que los procesos pueden suscribirse vía el bus de eventos.

### Contexto Automático

Todos los logs incluyen:

- `pid` - ID de Proceso
- `location` - ID de entrada y número de línea (ej., `app.api:handler:45`)

## Métricas Prometheus

```yaml
prometheus:
  enabled: true
  address: "localhost:9090"
```

Las métricas se exponen en `/metrics` en la dirección configurada.

### Configuración de Scrape

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'wippy'
    static_configs:
      - targets: ['localhost:9090']
    scrape_interval: 15s
```

Para la API de métricas en Lua, consulte el [Módulo Metrics](lua-metrics.md).

## OpenTelemetry

OTEL proporciona trazado distribuido y exportación opcional de métricas.

### Configuración Básica

```yaml
otel:
  enabled: true
  endpoint: "localhost:4318"
  protocol: http/protobuf      # grpc o http/protobuf
  service_name: my-app
  service_version: "1.0.0"
  insecure: false              # Permitir conexiones sin TLS
  sample_rate: 1.0             # 0.0 a 1.0
  traces_enabled: true
  metrics_enabled: false
  propagators:
    - tracecontext
    - baggage
```

### Fuentes de Trazas

Habilite trazado para componentes específicos:

```yaml
otel:
  enabled: true
  endpoint: "localhost:4318"
  service_name: my-app

  # Trazado de solicitudes HTTP
  http:
    enabled: true
    extract_headers: true      # Leer contexto de traza entrante
    inject_headers: true       # Escribir contexto de traza saliente

  # Trazado de ciclo de vida de procesos
  process:
    enabled: true
    trace_lifecycle: true      # Trazar eventos spawn/exit

  # Trazado de mensajes de cola
  queue:
    enabled: true

  # Trazado de llamadas de funciones
  interceptor:
    enabled: true
    order: 0                   # Orden de ejecución del interceptor
```

### Flujos de Trabajo Temporal

Habilite trazado para flujos de trabajo Temporal:

```yaml
otel:
  enabled: true
  endpoint: "localhost:4318"
  service_name: my-app

  temporal:
    enabled: true
```

Cuando está habilitado, el interceptor de trazado del SDK de Temporal se registra para operaciones de cliente y worker.

Operaciones trazadas:
- Inicios y completaciones de flujos de trabajo
- Ejecuciones de actividades
- Llamadas a flujos de trabajo hijos
- Manejo de señales y consultas

### Qué Se Traza

| Componente | Nombre de Span | Atributos |
|-----------|-----------|------------|
| Solicitudes HTTP | `{METHOD} {route}` | http.method, http.url, http.host |
| Llamadas de funciones | ID de Función | process.pid, frame.id |
| Ciclo de vida de procesos | `{source}.started/terminated` | process.pid |
| Mensajes de cola | Topic del mensaje | Contexto de traza en headers |
| Flujos de trabajo Temporal | Nombre de Workflow/Activity | workflow.id, run.id |

### Propagación de Contexto

El contexto de traza se propaga automáticamente:

- **HTTP -> Función**: Headers W3C Trace Context
- **Función -> Función**: Herencia de contexto de frame
- **Proceso -> Proceso**: Contexto de spawn
- **Cola publish -> consume**: Headers del mensaje

### Variables de Entorno

OTEL puede configurarse vía entorno:

| Variable | Descripción |
|----------|-------------|
| `OTEL_SDK_DISABLED` | Establecer a `true` para deshabilitar OTEL |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | Endpoint del colector |
| `OTEL_EXPORTER_OTLP_PROTOCOL` | `grpc` o `http/protobuf` |
| `OTEL_SERVICE_NAME` | Nombre del servicio |
| `OTEL_SERVICE_VERSION` | Versión del servicio |
| `OTEL_TRACES_SAMPLER_ARG` | Tasa de muestreo (0.0-1.0) |
| `OTEL_PROPAGATORS` | Lista de propagadores |

## Estadísticas del Runtime

El módulo `system` proporciona estadísticas internas del runtime:

```lua
local system = require("system")

-- Estadísticas de memoria
local mem = system.memory.stats()
-- mem.alloc, mem.heap_alloc, mem.heap_objects, etc.

-- Conteo de goroutines
local count = system.runtime.goroutines()

-- Estados del supervisor
local states = system.supervisor.states()
```

## Ver También

- [Módulo Logger](lua-logger.md) - API de logging en Lua
- [Módulo Metrics](lua-metrics.md) - API de métricas en Lua
- [Módulo System](lua-system.md) - Estadísticas del runtime
